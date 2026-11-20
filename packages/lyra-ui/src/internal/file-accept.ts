import { AggregateFileLimitTracker } from './aggregate-file-limits.js';
import { finiteCount, finiteRange } from './numbers.js';

/**
 * Parses a native-`accept`-style string (`".csv,.xlsx"`, `"text/csv"`,
 * `"image/*"`, or any mix, comma-separated) and reports whether `file`
 * matches it — the same three forms the browser's own file picker accepts,
 * now also enforced on the drag-drop path (previously `accept` only
 * constrained the native picker dialog and had no effect on drop).
 *
 * `file` may be a `DataTransferItem` cast as `File` (the dragenter-preview
 * call site, before the drop payload has real `File` objects) - unlike
 * `File`, `DataTransferItem` has no `.name`, only `.type`, so extension
 * patterns (`.csv`) can't be evaluated pre-drop. By default an unresolved
 * extension pattern counts as no match, since that's the correct behavior
 * once real `File` objects are available at drop time. Pass
 * `assumeExtensionMatch: true` to instead treat an unresolved extension
 * pattern as a possible match — this is what dragenter preview uses so it
 * doesn't render a false "reject" state for accept lists that are
 * extension-only, when the file may well be accepted once dropped.
 */
export function matchesAccept(file: File, accept: string, assumeExtensionMatch = false): boolean {
  const parts = (typeof accept === 'string' ? accept : '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return true;

  const name = file.name?.toLowerCase();
  const type = (file.type || '').toLowerCase();

  return parts.some((p) => {
    if (p.startsWith('.')) return name === undefined ? assumeExtensionMatch : name.endsWith(p);
    if (p === '*/*') return true;
    if (p.endsWith('/*')) return type.startsWith(p.slice(0, -1));
    return type === p;
  });
}

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

/** Exact-MIME gate: the denylist is evaluated first, an empty allowlist allows everything else. */
export const mimeTypeFilter =
  (allowed: readonly string[], forbidden: readonly string[]) =>
  ({ type }: File): boolean =>
    !forbidden.includes(type) && (allowed.length === 0 || allowed.includes(type));
