import { AggregateFileLimitTracker } from '../../../internal/aggregate-file-limits.js';
import type { DropSessionController } from '../../../internal/drop-session-controller.js';
import { finiteCount, finiteRange } from '../../../internal/numbers.js';
import { matchesAccept } from './accept.js';

export const DEFAULT_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
/** Fallback for an invalid (negative/`NaN`) `maxFiles` override; `0`/`Infinity` mean no limit. */
export const DEFAULT_MAX_FILES = 100;
/** Fallback for an invalid (negative/`NaN`) `maxTotalSize` override; `0`/`Infinity` mean no limit. */
export const DEFAULT_MAX_TOTAL_SIZE_BYTES = 250 * 1024 * 1024;

export interface FileIntakeRejected {
  readonly file: File;
  readonly reason: 'type' | 'count' | 'size' | 'directory' | 'read' | 'limit' | 'maxFiles' | 'maxTotalSize';
}

export interface FileIntakeResult {
  files: File[];
  rejected: FileIntakeRejected[];
  remainingFiles: number | null;
  remainingTotalSize: number | null;
}

/** Frozen `lr-files` detail; `remaining*` is the allowance left under the limit (`null` while unset). */
export interface FileIntakeDetail {
  readonly files: readonly File[];
  readonly rejected: readonly FileIntakeRejected[];
  readonly remainingFiles: number | null;
  readonly remainingTotalSize: number | null;
}

/** The `accept`/limit properties every file-intake component shares; an omitted one is unset. */
export interface FileIntakeLimits {
  accept: string;
  maxFileSize: number;
  maxFiles: number;
  maxTotalSize: number;
  heldFileCount: number;
  heldTotalSize: number;
}

/** `0`/`Infinity` mean "no limit" (`null`); any other invalid value falls back to a sane cap
 *  instead of silently disabling the check. */
const limit = (value = 0, fallback = 1): number | null =>
  value === 0 || value === Infinity ? null : finiteRange(value > 0 ? value : NaN, fallback, 1);

/** Sorts a batch into accepted and rejected files, counting `retained` files and the held totals
 *  against the limits. `isPreview` marks dragenter items, which have no name or size yet. */
export function classifyFiles(
  options: Partial<FileIntakeLimits>,
  fileList: File[],
  multiple: boolean,
  retained: readonly File[] = [],
  isPreview = false,
  typeAllowed: (file: File) => boolean = () => true,
): FileIntakeResult {
  const limits = {
    maxFiles: limit(options.maxFiles, DEFAULT_MAX_FILES),
    maxTotalSize: limit(options.maxTotalSize, DEFAULT_MAX_TOTAL_SIZE_BYTES),
  };
  const maxFileSize = limit(options.maxFileSize, DEFAULT_MAX_FILE_SIZE_BYTES);
  const tracker = new AggregateFileLimitTracker(
    retained.length + finiteCount(options.heldFileCount ?? 0, 0),
    retained.reduce((total, file) => total + (Number.isFinite(file.size) ? file.size : 0), 0) +
      finiteCount(options.heldTotalSize ?? 0, 0),
  );
  if (!multiple && fileList.length > 1) {
    return {
      files: [],
      rejected: fileList.map((file) => ({ file, reason: 'count' as const })),
      ...tracker.allowance(limits),
    };
  }
  const files: File[] = [];
  const rejected: FileIntakeRejected[] = [];
  for (const file of fileList) {
    // Extension patterns can't be evaluated while previewing, so they count as a possible match.
    const reason = !typeAllowed(file) || (options.accept && !matchesAccept(file, options.accept, isPreview))
      ? 'type'
      : maxFileSize !== null && file.size > maxFileSize
        ? 'size'
        : tracker.evaluate(file, limits);
    if (reason) rejected.push({ file, reason });
    else files.push(file);
  }
  return { files, rejected, ...tracker.allowance(limits) };
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

const MAX_MIME_TYPES = 10_000;
export const EMPTY_MIME_TYPES: readonly string[] = Object.freeze([]);

export function snapshotMimeTypes(value: unknown): readonly string[] {
  try {
    if (!Array.isArray(value)) return EMPTY_MIME_TYPES;
    const count = Math.min(value.length, MAX_MIME_TYPES);
    const values: string[] = [];
    for (let index = 0; index < count; index++) {
      try {
        const candidate = value[index];
        if (typeof candidate === 'string') values.push(candidate);
      } catch {
        // A hostile indexed getter invalidates only its own entry.
      }
    }
    return values.length ? Object.freeze(values) : EMPTY_MIME_TYPES;
  } catch {
    return EMPTY_MIME_TYPES;
  }
}

/** Caller-owned outcome copy with `{count}` substituted; `undefined` falls back to the localized default. */
export function outcomeText(override: string | undefined, fallback: () => string, count: string): string {
  return override == null ? fallback() : override.replace(/\{count\}/g, count);
}

/** Exact-MIME gate: the denylist is evaluated first, an empty allowlist allows everything else. */
export const mimeTypeFilter =
  (allowed: readonly string[], forbidden: readonly string[]) =>
  ({ type }: File): boolean =>
    !forbidden.includes(type) && (allowed.length === 0 || allowed.includes(type));
