export type LyraFileTypeIcon =
  | 'file'
  | 'pdf'
  | 'word'
  | 'spreadsheet'
  | 'presentation'
  | 'text'
  | 'code'
  | 'archive'
  | 'image'
  | 'audio'
  | 'video';

export type LyraFileTypeCategory =
  | 'document'
  | 'spreadsheet'
  | 'presentation'
  | 'image'
  | 'audio'
  | 'video'
  | 'archive'
  | 'code'
  | 'generic';

export interface LyraFileTypeMetadata {
  readonly label: string;
  readonly description?: string;
  readonly icon: LyraFileTypeIcon;
  readonly category: LyraFileTypeCategory;
  readonly extensions?: readonly string[];
}

export interface LyraFileTypeMetadataEntry {
  readonly mimeTypes: string | readonly string[];
  readonly metadata: LyraFileTypeMetadata;
}

export interface LyraResolvedFileTypeMetadata extends LyraFileTypeMetadata {
  /** Built-ins use localized component strings; consumer records remain verbatim. */
  readonly provenance: 'builtin' | 'consumer';
}

export interface LyraFileTypeMetadataRegistry {
  resolve(mimeType: string, fileName?: string): LyraResolvedFileTypeMetadata;
}

const ICONS = new Set<LyraFileTypeIcon>([
  'file', 'pdf', 'word', 'spreadsheet', 'presentation', 'text', 'code', 'archive', 'image', 'audio', 'video',
]);
const CATEGORIES = new Set<LyraFileTypeCategory>([
  'document', 'spreadsheet', 'presentation', 'image', 'audio', 'video', 'archive', 'code', 'generic',
]);
const MAX_MIME_TYPES = 512;
const MAX_EXTENSIONS = 64;
const MAX_MIME_LENGTH = 256;
const MAX_EXTENSION_LENGTH = 64;
const MAX_FILENAME_LOOKUP = 4096;

const BUILTIN_ENTRIES: readonly LyraFileTypeMetadataEntry[] = [
  { mimeTypes: 'application/pdf', metadata: { label: 'PDF', icon: 'pdf', category: 'document', extensions: ['.pdf'] } },
  { mimeTypes: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', metadata: { label: 'Word document', icon: 'word', category: 'document', extensions: ['.docx'] } },
  { mimeTypes: 'application/msword', metadata: { label: 'Word document', icon: 'word', category: 'document', extensions: ['.doc'] } },
  { mimeTypes: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', metadata: { label: 'Excel spreadsheet', icon: 'spreadsheet', category: 'spreadsheet', extensions: ['.xlsx'] } },
  { mimeTypes: 'application/vnd.ms-excel', metadata: { label: 'Excel spreadsheet', icon: 'spreadsheet', category: 'spreadsheet', extensions: ['.xls'] } },
  { mimeTypes: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', metadata: { label: 'PowerPoint presentation', icon: 'presentation', category: 'presentation', extensions: ['.pptx'] } },
  { mimeTypes: 'application/vnd.ms-powerpoint', metadata: { label: 'PowerPoint presentation', icon: 'presentation', category: 'presentation', extensions: ['.ppt'] } },
  { mimeTypes: 'application/vnd.oasis.opendocument.text', metadata: { label: 'OpenDocument text', icon: 'word', category: 'document', extensions: ['.odt'] } },
  { mimeTypes: 'application/vnd.oasis.opendocument.spreadsheet', metadata: { label: 'OpenDocument spreadsheet', icon: 'spreadsheet', category: 'spreadsheet', extensions: ['.ods'] } },
  { mimeTypes: 'application/vnd.oasis.opendocument.presentation', metadata: { label: 'OpenDocument presentation', icon: 'presentation', category: 'presentation', extensions: ['.odp'] } },
  { mimeTypes: 'application/rtf', metadata: { label: 'Rich text document', icon: 'word', category: 'document', extensions: ['.rtf'] } },
  { mimeTypes: 'application/epub+zip', metadata: { label: 'EPUB ebook', icon: 'word', category: 'document', extensions: ['.epub'] } },
  { mimeTypes: 'application/x-mobipocket-ebook', metadata: { label: 'MOBI ebook', icon: 'word', category: 'document', extensions: ['.mobi'] } },
  { mimeTypes: 'text/plain', metadata: { label: 'Plain text', icon: 'text', category: 'document', extensions: ['.txt'] } },
  { mimeTypes: 'text/csv', metadata: { label: 'CSV spreadsheet', icon: 'spreadsheet', category: 'spreadsheet', extensions: ['.csv'] } },
  { mimeTypes: 'text/markdown', metadata: { label: 'Markdown', icon: 'code', category: 'code', extensions: ['.md', '.markdown'] } },
  { mimeTypes: 'text/html', metadata: { label: 'HTML document', icon: 'code', category: 'code', extensions: ['.html', '.htm'] } },
  { mimeTypes: ['text/xml', 'application/xml'], metadata: { label: 'XML document', icon: 'code', category: 'code', extensions: ['.xml'] } },
  { mimeTypes: 'application/json', metadata: { label: 'JSON data', icon: 'code', category: 'code', extensions: ['.json'] } },
  { mimeTypes: ['application/yaml', 'text/yaml'], metadata: { label: 'YAML data', icon: 'code', category: 'code', extensions: ['.yaml', '.yml'] } },
  { mimeTypes: ['application/zip', 'application/x-zip-compressed'], metadata: { label: 'ZIP archive', icon: 'archive', category: 'archive', extensions: ['.zip'] } },
  { mimeTypes: ['application/gzip', 'application/x-gzip'], metadata: { label: 'GZip archive', icon: 'archive', category: 'archive', extensions: ['.gz', '.gzip', '.tar.gz'] } },
  { mimeTypes: 'application/x-tar', metadata: { label: 'TAR archive', icon: 'archive', category: 'archive', extensions: ['.tar'] } },
  { mimeTypes: 'application/x-7z-compressed', metadata: { label: '7-Zip archive', icon: 'archive', category: 'archive', extensions: ['.7z'] } },
  { mimeTypes: 'application/vnd.rar', metadata: { label: 'RAR archive', icon: 'archive', category: 'archive', extensions: ['.rar'] } },
  { mimeTypes: 'image/jpeg', metadata: { label: 'JPEG image', icon: 'image', category: 'image', extensions: ['.jpg', '.jpeg'] } },
  { mimeTypes: 'image/png', metadata: { label: 'PNG image', icon: 'image', category: 'image', extensions: ['.png'] } },
  { mimeTypes: 'image/gif', metadata: { label: 'GIF image', icon: 'image', category: 'image', extensions: ['.gif'] } },
  { mimeTypes: 'image/webp', metadata: { label: 'WebP image', icon: 'image', category: 'image', extensions: ['.webp'] } },
  { mimeTypes: 'image/svg+xml', metadata: { label: 'SVG image', icon: 'image', category: 'image', extensions: ['.svg'] } },
  { mimeTypes: 'image/tiff', metadata: { label: 'TIFF image', icon: 'image', category: 'image', extensions: ['.tif', '.tiff'] } },
  { mimeTypes: 'image/bmp', metadata: { label: 'BMP image', icon: 'image', category: 'image', extensions: ['.bmp'] } },
  { mimeTypes: 'image/heic', metadata: { label: 'HEIC image', icon: 'image', category: 'image', extensions: ['.heic'] } },
  { mimeTypes: ['audio/mpeg', 'audio/mp3'], metadata: { label: 'MPEG audio', icon: 'audio', category: 'audio', extensions: ['.mp3', '.mpeg'] } },
  { mimeTypes: ['audio/wav', 'audio/x-wav'], metadata: { label: 'WAV audio', icon: 'audio', category: 'audio', extensions: ['.wav'] } },
  { mimeTypes: 'video/mp4', metadata: { label: 'MP4 video', icon: 'video', category: 'video', extensions: ['.mp4'] } },
  { mimeTypes: 'video/webm', metadata: { label: 'WebM video', icon: 'video', category: 'video', extensions: ['.webm'] } },
];

const GENERIC: LyraResolvedFileTypeMetadata = Object.freeze({
  label: 'File', icon: 'file', category: 'generic', provenance: 'builtin',
});

function normalizeMimeType(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase().split(';', 1)[0] ?? '';
  if (!normalized || normalized.length > MAX_MIME_LENGTH || !normalized.includes('/')) return undefined;
  return normalized;
}

function normalizeExtension(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.length > MAX_EXTENSION_LENGTH || /[\s/\\?#]/.test(trimmed)) return undefined;
  const normalized = trimmed.startsWith('.') ? trimmed : `.${trimmed}`;
  return normalized.length > 1 ? normalized : undefined;
}

function boundedIterable<T>(values: Iterable<T>, maximum: number): T[] {
  const result: T[] = [];
  const iterator = values[Symbol.iterator]();
  while (result.length < maximum) {
    const next = iterator.next();
    if (next.done) break;
    result.push(next.value);
  }
  return result;
}

function snapshotMetadata(
  value: LyraFileTypeMetadata,
  provenance: LyraResolvedFileTypeMetadata['provenance'],
): LyraResolvedFileTypeMetadata | undefined {
  try {
    if (!value || typeof value !== 'object') return undefined;
    const label = value.label;
    const description = value.description;
    const icon = value.icon;
    const category = value.category;
    if (
      typeof label !== 'string' || label.length === 0 || label.length > 512 ||
      (description != null && (typeof description !== 'string' || description.length > 2048)) ||
      !ICONS.has(icon) || !CATEGORIES.has(category)
    ) return undefined;
    const rawExtensions = Array.isArray(value.extensions) ? value.extensions.slice(0, MAX_EXTENSIONS) : [];
    const extensions = Object.freeze(
      [...new Set(rawExtensions.map(normalizeExtension).filter((item): item is string => item != null))],
    );
    return Object.freeze({
      label,
      ...(description == null ? {} : { description }),
      icon,
      category,
      ...(extensions.length ? { extensions } : {}),
      provenance,
    });
  } catch {
    return undefined;
  }
}

function snapshotEntry(
  value: LyraFileTypeMetadataEntry,
  provenance: LyraResolvedFileTypeMetadata['provenance'],
): { mimeTypes: readonly string[]; metadata: LyraResolvedFileTypeMetadata } | undefined {
  try {
    const rawMimeTypes = typeof value.mimeTypes === 'string'
      ? [value.mimeTypes]
      : boundedIterable(value.mimeTypes, MAX_MIME_TYPES);
    const mimeTypes = Object.freeze(
      [...new Set(rawMimeTypes.map(normalizeMimeType).filter((item): item is string => item != null))],
    );
    const metadata = snapshotMetadata(value.metadata, provenance);
    return mimeTypes.length && metadata ? { mimeTypes, metadata } : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Creates an immutable, instance-injectable metadata registry. Built-ins are always present;
 * consumer entries are applied in order with last-entry-wins MIME and extension collisions.
 * Replacing a MIME atomically releases extension aliases owned by its previous record.
 */
export function createFileTypeMetadataRegistry(
  entries: readonly LyraFileTypeMetadataEntry[] = [],
): LyraFileTypeMetadataRegistry {
  const byMime = new Map<string, LyraResolvedFileTypeMetadata>();
  const byExtension = new Map<string, { mimeType: string; metadata: LyraResolvedFileTypeMetadata }>();

  const install = (entry: LyraFileTypeMetadataEntry, provenance: LyraResolvedFileTypeMetadata['provenance']): void => {
    const snapshot = snapshotEntry(entry, provenance);
    if (!snapshot) return;
    for (const mimeType of snapshot.mimeTypes) {
      const previous = byMime.get(mimeType);
      for (const extension of previous?.extensions ?? []) {
        if (byExtension.get(extension)?.mimeType === mimeType) byExtension.delete(extension);
      }
      byMime.set(mimeType, snapshot.metadata);
      for (const extension of snapshot.metadata.extensions ?? []) {
        byExtension.set(extension, { mimeType, metadata: snapshot.metadata });
      }
    }
  };

  for (const entry of BUILTIN_ENTRIES) install(entry, 'builtin');
  let count = 0;
  try {
    for (const entry of boundedIterable(entries, MAX_MIME_TYPES)) {
      if (count >= MAX_MIME_TYPES) break;
      install(entry, 'consumer');
      count += 1;
    }
  } catch {
    // A hostile iterable cannot corrupt the built-in snapshot.
  }

  const suffixes = Object.freeze(
    [...byExtension.keys()].sort(
      (a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0),
    ),
  );
  return Object.freeze({
    resolve(mimeType: string, fileName = ''): LyraResolvedFileTypeMetadata {
      const normalized = normalizeMimeType(mimeType);
      const explicit = normalized && normalized !== 'application/octet-stream' ? byMime.get(normalized) : undefined;
      if (explicit) return explicit;
      if (!normalized || normalized === 'application/octet-stream') {
        const normalizedName = typeof fileName === 'string'
          ? fileName.trim().toLowerCase().slice(-MAX_FILENAME_LOOKUP)
          : '';
        const suffix = suffixes.find((candidate) => normalizedName.endsWith(candidate));
        const extensionMatch = suffix ? byExtension.get(suffix)?.metadata : undefined;
        if (extensionMatch) return extensionMatch;
      }
      return GENERIC;
    },
  });
}

export const defaultFileTypeMetadataRegistry = createFileTypeMetadataRegistry();

/** Resolves through the immutable built-in registry. For custom records, construct and inject a registry. */
export function getFileTypeMetadata(mimeType: string, fileName = ''): LyraResolvedFileTypeMetadata {
  return defaultFileTypeMetadataRegistry.resolve(mimeType, fileName);
}
