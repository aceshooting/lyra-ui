import type { ReactiveController, ReactiveControllerHost } from 'lit';

/** Drag-session preview/outcome state. `'default'` is the resting state; `'accept'`/`'reject'`
 *  preview what a drop would do, driven by {@link DropSessionCallbacks.previewRejects}. */
export type DropSessionState = 'default' | 'accept' | 'reject';

export interface DropSessionHost extends ReactiveControllerHost {
  readonly isConnected: boolean;
}

export interface DropSessionCallbacks {
  /** Whether the host currently refuses drag/drop input (own or fieldset-cascaded disabled). */
  isDisabled(): boolean;
  /** Preview classification for a dragenter/dragover payload: item-shaped values exposing only
   *  `.kind`/`.type` (never real `File` data -- sizes and names aren't available pre-drop). Return
   *  `true` to preview the session as a reject. */
  previewRejects(items: readonly DataTransferItem[]): boolean;
  /** Invoked every time this controller sets `state` (including a same-value reset), mirroring
   *  the exact call sites the original implementation this was extracted from used to sync
   *  `CustomStateSet`/announcements from -- never coalesced or deduplicated. */
  onStateChange(): void;
}

const MAX_DROPPED_FOLDER_ENTRIES = 10_000;

export type DroppedFolderReadResult =
  | { status: 'complete'; files: File[] }
  | { status: 'cancelled' }
  | { status: 'limit'; name: string }
  | { status: 'error'; name: string };

export interface DropSessionBeginResult {
  /** Cancellation token for this drop; pass to {@link DropSessionController.readFolders} and
   *  {@link DropSessionController.isCurrent}. */
  readonly token: number;
  /** Files already available synchronously from `DataTransfer.files`. */
  readonly files: File[];
  /** Top-level directory entries found among `DataTransfer.items`, needing an async walk. */
  readonly folders: FileSystemEntry[];
  /** `true` when the dropped item count exceeded the traversal budget before any entry was read. */
  readonly overLimit: boolean;
}

type DroppedFileReadResult =
  | { status: 'complete'; file: File }
  | { status: 'cancelled' }
  | { status: 'error' };
type DroppedDirectoryBatchResult =
  | { status: 'complete'; entries: FileSystemEntry[] }
  | { status: 'cancelled' }
  | { status: 'error' };

function isFileValue(value: unknown): value is File {
  if (value === null || typeof value !== 'object') return false;
  try {
    const candidate = value as Partial<File>;
    return Object.prototype.toString.call(value) === '[object File]'
      && typeof candidate.name === 'string'
      && typeof candidate.lastModified === 'number'
      && typeof candidate.size === 'number'
      && typeof candidate.type === 'string'
      && typeof candidate.slice === 'function';
  } catch {
    return false;
  }
}

/**
 * Owns one drag-and-drop region's nested-depth tracking, accept/reject preview state, and legacy
 * File System API folder traversal -- extracted from `lr-file-input`'s original implementation so
 * `lr-drop-zone` shares the exact mechanics rather than reimplementing them, and so `lr-file-input`
 * itself now composes this controller instead of owning the drag-session state twice.
 *
 * Deliberately host-agnostic about *classification*: what makes a dropped file acceptable (an
 * `accept` pattern, a size/count/total-size limit) differs per host property set, so `isAllowed`/
 * `classify`-shaped decisions stay owned by the component using this controller. This controller
 * only tracks the session and harvests raw dropped files/folder entries.
 *
 * @internal
 */
export class DropSessionController implements ReactiveController {
  private counter = 0;
  private token = 0;
  private sessionState: DropSessionState = 'default';

  constructor(
    private readonly host: DropSessionHost,
    private readonly callbacks: DropSessionCallbacks,
  ) {
    host.addController(this);
  }

  /** Current preview/outcome state. */
  get state(): DropSessionState {
    return this.sessionState;
  }

  /** `true` whenever `state` isn't `'default'`. */
  get dragging(): boolean {
    return this.sessionState !== 'default';
  }

  hostDisconnected(): void {
    this.reset();
  }

  /** Ends the session (resets the nested-depth counter to `0` and `state` to `'default'`) and
   *  bumps the cancellation token, so any folder read already in flight resolves as stale. Always
   *  invokes {@link DropSessionCallbacks.onStateChange}, even if `state` was already `'default'` --
   *  callers that reset unconditionally on every drop/disable rely on that. */
  reset(): void {
    this.token++;
    this.counter = 0;
    this.sessionState = 'default';
    this.callbacks.onStateChange();
  }

  onDragEnter = (e: DragEvent): void => {
    e.preventDefault();
    if (this.callbacks.isDisabled()) return;
    this.counter++;
    const items = e.dataTransfer ? [...e.dataTransfer.items].filter((i) => i.kind === 'file') : [];
    this.sessionState = items.length
      ? (this.callbacks.previewRejects(items) ? 'reject' : 'accept')
      : 'default';
    this.callbacks.onStateChange();
  };

  onDragOver = (e: DragEvent): void => {
    // Always suppress the browser's default drop action (e.g. navigating the whole page to the
    // dropped file), even while disabled -- only classification/emission is gated on disabled.
    e.preventDefault();
  };

  onDragLeave = (e: DragEvent): void => {
    if (this.callbacks.isDisabled()) return;
    e.preventDefault();
    this.counter = Math.max(0, this.counter - 1);
    if (this.counter === 0) {
      this.sessionState = 'default';
      this.callbacks.onStateChange();
    }
  };

  /** Synchronous drop intake: suppresses the browser default (unconditionally, before the
   *  disabled gate), resets the session, and separates files already available from
   *  `dataTransfer.files` from top-level directory entries needing a follow-up async walk.
   *  Returns `undefined` while disabled -- the caller does nothing further in that case. */
  beginDrop(e: DragEvent): DropSessionBeginResult | undefined {
    e.preventDefault();
    if (this.callbacks.isDisabled()) return undefined;
    this.reset();
    const token = this.token;
    const files = [...(e.dataTransfer?.files ?? [])];
    const folders: FileSystemEntry[] = [];
    const items = e.dataTransfer?.items;
    // Inspect at most one item beyond the traversal budget. Besides avoiding an unbounded spread,
    // this lets an over-limit root list fail atomically before any directory reader is opened.
    const itemCount = Math.min(items?.length ?? 0, MAX_DROPPED_FOLDER_ENTRIES + 1);
    for (let index = 0; index < itemCount; index++) {
      const item = items?.[index];
      const entry = (item as DataTransferItem & {
        webkitGetAsEntry?: () => FileSystemEntry | null;
      } | undefined)?.webkitGetAsEntry?.();
      if (entry?.isDirectory) folders.push(entry);
    }
    const overLimit = (items?.length ?? 0) > MAX_DROPPED_FOLDER_ENTRIES;
    return { token, files, folders, overLimit };
  }

  /** Whether `token` (from {@link beginDrop}) is still the live session: no reset/disable/
   *  disconnect has happened since. */
  isCurrent(token: number): boolean {
    return token === this.token && this.host.isConnected && !this.callbacks.isDisabled();
  }

  private readDroppedFile(
    entry: FileSystemFileEntry,
    isCurrent: () => boolean,
  ): Promise<DroppedFileReadResult> {
    if (!isCurrent()) return Promise.resolve({ status: 'cancelled' });
    return new Promise<DroppedFileReadResult>((resolve) => {
      try {
        entry.file(
          (file) => resolve(isCurrent() ? { status: 'complete', file } : { status: 'cancelled' }),
          () => resolve(isCurrent() ? { status: 'error' } : { status: 'cancelled' }),
        );
      } catch {
        resolve(isCurrent() ? { status: 'error' } : { status: 'cancelled' });
      }
    });
  }

  private readDroppedDirectoryBatch(
    reader: FileSystemDirectoryReader,
    isCurrent: () => boolean,
  ): Promise<DroppedDirectoryBatchResult> {
    if (!isCurrent()) return Promise.resolve({ status: 'cancelled' });
    return new Promise<DroppedDirectoryBatchResult>((resolve) => {
      try {
        reader.readEntries(
          (entries) => resolve(isCurrent() ? { status: 'complete', entries } : { status: 'cancelled' }),
          () => resolve(isCurrent() ? { status: 'error' } : { status: 'cancelled' }),
        );
      } catch {
        resolve(isCurrent() ? { status: 'error' } : { status: 'cancelled' });
      }
    });
  }

  /** Walks legacy File System API folders one operation at a time, with a bounded queue. `token`
   *  is the one {@link beginDrop} returned; the walk aborts (resolving `'cancelled'`) the instant
   *  it stops being current. */
  async readFolders(folders: FileSystemEntry[], token: number): Promise<DroppedFolderReadResult> {
    const isCurrent = () => this.isCurrent(token);
    const files: File[] = [];
    const queue: FileSystemEntry[] = [];
    let entryCount = 0;
    const enqueue = (entry: FileSystemEntry): boolean => {
      if (entryCount >= MAX_DROPPED_FOLDER_ENTRIES) return false;
      entryCount++;
      queue.push(entry);
      return true;
    };

    for (const folder of folders) {
      if (!isCurrent()) return { status: 'cancelled' };
      if (!enqueue(folder)) return { status: 'limit', name: folder.name };
    }

    for (let index = 0; index < queue.length; index++) {
      if (!isCurrent()) return { status: 'cancelled' };
      const entry = queue[index]!;
      if (entry.isFile) {
        const result = await this.readDroppedFile(entry as FileSystemFileEntry, isCurrent);
        if (result.status === 'cancelled' || !isCurrent()) return { status: 'cancelled' };
        if (result.status === 'error') return { status: 'error', name: entry.name };
        files.push(result.file);
        continue;
      }
      if (!entry.isDirectory) continue;

      let reader: FileSystemDirectoryReader;
      try {
        reader = (entry as FileSystemDirectoryEntry).createReader();
      } catch {
        return { status: 'error', name: entry.name };
      }
      while (true) {
        if (!isCurrent()) return { status: 'cancelled' };
        const batch = await this.readDroppedDirectoryBatch(reader, isCurrent);
        if (batch.status === 'cancelled' || !isCurrent()) return { status: 'cancelled' };
        if (batch.status === 'error') return { status: 'error', name: entry.name };
        if (!batch.entries.length) break;
        for (const child of batch.entries) {
          if (!isCurrent()) return { status: 'cancelled' };
          if (!enqueue(child)) return { status: 'limit', name: entry.name };
        }
      }
    }
    return { status: 'complete', files };
  }
}

/** Reads a `DataTransfer.files`/`.items`-shaped clipboard or drop payload into a plain `File[]`,
 *  ignoring anything that isn't a real `File`. Shared by every drop/paste-consuming component so
 *  a hostile or partial `FileList`-alike can't smuggle a non-`File` value past `isAllowed()`. */
export function readFileList(list: FileList | null | undefined): File[] {
  const files: File[] = [];
  if (!list) return files;
  for (let index = 0; index < list.length; index++) {
    const file = list[index];
    if (isFileValue(file)) files.push(file);
  }
  return files;
}
