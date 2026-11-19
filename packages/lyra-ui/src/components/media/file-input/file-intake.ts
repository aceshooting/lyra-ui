import { getNumberFormat } from '../../../internal/intl-cache.js';
import type { LyraMessageKey } from '../../../internal/localization-types.js';
import type { DropSessionController, DropSessionState } from '../../../internal/drop-session-controller.js';
import type { FileIntakeRejected, FileIntakeResult } from './accept.js';
export {
  classifyFiles, EMPTY_MIME_TYPES, mimeTypeFilter, snapshotMimeTypes, DEFAULT_MAX_FILES, DEFAULT_MAX_FILE_SIZE_BYTES, DEFAULT_MAX_TOTAL_SIZE_BYTES,
  type FileIntakeRejected, type FileIntakeResult,
} from './accept.js';

/** Frozen `lr-files` detail; `remaining*` is the allowance left under the limit (`null` while unset). */
export interface FileIntakeDetail {
  readonly files: readonly File[];
  readonly rejected: readonly FileIntakeRejected[];
  readonly remainingFiles: number | null;
  readonly remainingTotalSize: number | null;
}

export function freezeDetail(
  { files, rejected, remainingFiles, remainingTotalSize }: FileIntakeResult,
  extra: readonly FileIntakeRejected[] = [],
): FileIntakeDetail {
  return Object.freeze({
    files: Object.freeze([...files]),
    rejected: Object.freeze([...rejected, ...extra].map((item) => Object.freeze({ ...item }))),
    remainingFiles,
    remainingTotalSize,
  });
}

/** Drops an enclosing drop target must not process a second time. */
const claimedDrops = new WeakSet<Event>();

/** Runs one drop: files, plus folder contents while `multiple`, otherwise each folder as a `'directory'`
 *  rejection. A drop an inner file target already took only ends this target's drag session. */
export function handleDrop(
  host: Element,
  session: DropSessionController,
  e: DragEvent,
  multiple: boolean,
  emit: (files: File[], rejected: FileIntakeRejected[]) => void,
): void {
  if (claimedDrops.has(e)) return session.reset();
  const drop = session.beginDrop(e);
  if (!drop) return;
  claimedDrops.add(e);
  const { token, folders, overLimit } = drop;
  // A dropped folder also appears in `dataTransfer.files` as an empty, typeless pseudo-file.
  const files = drop.files.filter((file) => file.type || !folders.some((folder) => folder.name === file.name));
  const FileCtor = host.ownerDocument.defaultView?.File ?? globalThis.File;
  const failure = (name: string, reason: 'directory' | 'read' | 'limit'): FileIntakeRejected =>
    Object.freeze({ file: new FileCtor([], name), reason });
  if (overLimit && multiple) {
    emit([], [failure(folders[0]?.name ?? '', 'limit')]);
    return;
  }
  if (folders.length && multiple) {
    void session.readFolders(folders, token).then((result) => {
      if (!session.isCurrent(token) || result.status === 'cancelled') return;
      if (result.status === 'error' || result.status === 'limit') {
        emit([], [failure(result.name, result.status === 'limit' ? 'limit' : 'read')]);
        return;
      }
      const all = [...files, ...result.files];
      if (all.length) emit(all, []);
    });
    return;
  }
  const rejectedFolders = folders.map((folder) => failure(folder.name, 'directory'));
  if (files.length || rejectedFolders.length) emit(files, rejectedFolders);
}

/** Caller-owned outcome copy with `{count}` substituted; `undefined` falls back to the localized default. */
function outcomeText(override: string | undefined, fallback: () => string, count: string): string {
  return override == null ? fallback() : override.replace(/\{count\}/g, count);
}

/** Most rejection rows rendered and announced at once; the full list stays in the `lr-files` detail. */
const MAX_RENDERED_REJECTIONS = 20;

type IntakeMessage = (key: LyraMessageKey, values?: Record<string, number | string>) => string;

export function dragInstruction(state: DropSessionState, localize: IntakeMessage): string {
  if (state === 'accept') return localize('dropzoneReleaseToAdd');
  if (state === 'reject') return localize('dropzoneRejectedType');
  return '';
}

const rejectionKeys = {
  type: 'fileInputRejectedType', size: 'fileInputRejectedSize', count: 'fileInputRejectedCount',
  directory: 'fileInputFolderRejected', read: 'fileInputRejectedRead', limit: 'fileInputRejectedLimit',
  maxFiles: 'fileInputRejectedMaxFiles', maxTotalSize: 'fileInputRejectedMaxTotalSize',
} as const satisfies Record<FileIntakeRejected['reason'], LyraMessageKey>;

export function rejectionMessages(rejected: readonly FileIntakeRejected[], locale: string, localize: IntakeMessage): string[] {
  const shown = rejected.slice(0, MAX_RENDERED_REJECTIONS).map(({ reason, file }) => localize(rejectionKeys[reason], { filename: file.name }));
  const hidden = rejected.length - shown.length;
  if (hidden) shown.push(localize('fileInputRejectionsMore', { count: getNumberFormat(locale).format(hidden), pluralCount: hidden }));
  return shown;
}

export function selectionMessage(
  { files, rejected }: FileIntakeDetail, locale: string, localize: IntakeMessage,
  acceptedMessage?: string, rejectedMessage?: string,
): string {
  const messages: string[] = [];
  const format = getNumberFormat(locale);
  for (const [n, override, key] of [
    [files.length, acceptedMessage, files.length === 1 ? 'fileInputAcceptedOne' : 'fileInputAcceptedMany'],
    [rejected.length, rejectedMessage, rejected.length === 1 ? 'fileInputRejectedOne' : 'fileInputRejectedMany'],
  ] as const) {
    if (!n) continue;
    const count = format.format(n);
    const text = outcomeText(override, () => localize(key, { count, pluralCount: n }), count);
    if (text) messages.push(text);
  }
  return messages.join(' ');
}
