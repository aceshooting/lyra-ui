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

export type LyraFileTypeMetadata = {
  label: string;
  description?: string;
  icon: LyraFileTypeIcon;
  category: LyraFileTypeCategory;
  extensions?: readonly string[];
};

const generic: LyraFileTypeMetadata = { label: 'File', icon: 'file', category: 'generic' };

const catalog: Record<string, LyraFileTypeMetadata> = {
  'application/pdf': { label: 'PDF', icon: 'pdf', category: 'document', extensions: ['.pdf'] },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { label: 'Word document', icon: 'word', category: 'document', extensions: ['.docx'] },
  'application/msword': { label: 'Word document', icon: 'word', category: 'document', extensions: ['.doc'] },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { label: 'Excel spreadsheet', icon: 'spreadsheet', category: 'spreadsheet', extensions: ['.xlsx'] },
  'application/vnd.ms-excel': { label: 'Excel spreadsheet', icon: 'spreadsheet', category: 'spreadsheet', extensions: ['.xls'] },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { label: 'PowerPoint presentation', icon: 'presentation', category: 'presentation', extensions: ['.pptx'] },
  'application/vnd.ms-powerpoint': { label: 'PowerPoint presentation', icon: 'presentation', category: 'presentation', extensions: ['.ppt'] },
  'application/vnd.oasis.opendocument.text': { label: 'OpenDocument text', icon: 'word', category: 'document', extensions: ['.odt'] },
  'application/vnd.oasis.opendocument.spreadsheet': { label: 'OpenDocument spreadsheet', icon: 'spreadsheet', category: 'spreadsheet', extensions: ['.ods'] },
  'application/vnd.oasis.opendocument.presentation': { label: 'OpenDocument presentation', icon: 'presentation', category: 'presentation', extensions: ['.odp'] },
  'application/rtf': { label: 'Rich text document', icon: 'word', category: 'document', extensions: ['.rtf'] },
  'application/epub+zip': { label: 'EPUB ebook', icon: 'word', category: 'document', extensions: ['.epub'] },
  'application/x-mobipocket-ebook': { label: 'MOBI ebook', icon: 'word', category: 'document', extensions: ['.mobi'] },
  'text/plain': { label: 'Plain text', icon: 'text', category: 'document', extensions: ['.txt'] },
  'text/csv': { label: 'CSV spreadsheet', icon: 'spreadsheet', category: 'spreadsheet', extensions: ['.csv'] },
  'text/markdown': { label: 'Markdown', icon: 'code', category: 'code', extensions: ['.md', '.markdown'] },
  'text/html': { label: 'HTML document', icon: 'code', category: 'code', extensions: ['.html', '.htm'] },
  'text/xml': { label: 'XML document', icon: 'code', category: 'code', extensions: ['.xml'] },
  'application/xml': { label: 'XML document', icon: 'code', category: 'code', extensions: ['.xml'] },
  'application/json': { label: 'JSON data', icon: 'code', category: 'code', extensions: ['.json'] },
  'application/yaml': { label: 'YAML data', icon: 'code', category: 'code', extensions: ['.yaml', '.yml'] },
  'text/yaml': { label: 'YAML data', icon: 'code', category: 'code', extensions: ['.yaml', '.yml'] },
  'application/zip': { label: 'ZIP archive', icon: 'archive', category: 'archive', extensions: ['.zip'] },
  'application/x-zip-compressed': { label: 'ZIP archive', icon: 'archive', category: 'archive', extensions: ['.zip'] },
  'application/gzip': { label: 'GZip archive', icon: 'archive', category: 'archive', extensions: ['.gz', '.gzip'] },
  'application/x-gzip': { label: 'GZip archive', icon: 'archive', category: 'archive', extensions: ['.gz', '.gzip'] },
  'application/x-tar': { label: 'TAR archive', icon: 'archive', category: 'archive', extensions: ['.tar'] },
  'application/x-7z-compressed': { label: '7-Zip archive', icon: 'archive', category: 'archive', extensions: ['.7z'] },
  'application/vnd.rar': { label: 'RAR archive', icon: 'archive', category: 'archive', extensions: ['.rar'] },
  'image/jpeg': { label: 'JPEG image', icon: 'image', category: 'image', extensions: ['.jpg', '.jpeg'] },
  'image/png': { label: 'PNG image', icon: 'image', category: 'image', extensions: ['.png'] },
  'image/gif': { label: 'GIF image', icon: 'image', category: 'image', extensions: ['.gif'] },
  'image/webp': { label: 'WebP image', icon: 'image', category: 'image', extensions: ['.webp'] },
  'image/svg+xml': { label: 'SVG image', icon: 'image', category: 'image', extensions: ['.svg'] },
  'image/tiff': { label: 'TIFF image', icon: 'image', category: 'image', extensions: ['.tif', '.tiff'] },
  'image/bmp': { label: 'BMP image', icon: 'image', category: 'image', extensions: ['.bmp'] },
  'image/heic': { label: 'HEIC image', icon: 'image', category: 'image', extensions: ['.heic'] },
  'audio/mpeg': { label: 'MPEG audio', icon: 'audio', category: 'audio', extensions: ['.mp3', '.mpeg'] },
  'audio/mp3': { label: 'MP3 audio', icon: 'audio', category: 'audio', extensions: ['.mp3'] },
  'audio/wav': { label: 'WAV audio', icon: 'audio', category: 'audio', extensions: ['.wav'] },
  'audio/x-wav': { label: 'WAV audio', icon: 'audio', category: 'audio', extensions: ['.wav'] },
  'video/mp4': { label: 'MP4 video', icon: 'video', category: 'video', extensions: ['.mp4'] },
  'video/webm': { label: 'WebM video', icon: 'video', category: 'video', extensions: ['.webm'] },
};

const extensionCatalog = new Map<string, LyraFileTypeMetadata>();
for (const metadata of Object.values(catalog)) {
  for (const extension of metadata.extensions ?? []) extensionCatalog.set(extension, metadata);
}

function normalizeMimeType(value: string): string {
  return value.trim().toLowerCase().split(';', 1)[0];
}

/** Adds or replaces a custom MIME mapping used by future metadata lookups. */
export function registerFileTypeMetadata(
  mimeTypes: string | readonly string[],
  metadata: LyraFileTypeMetadata,
): void {
  for (const mimeType of typeof mimeTypes === 'string' ? [mimeTypes] : mimeTypes) {
    catalog[normalizeMimeType(mimeType)] = metadata;
  }
  for (const extension of metadata.extensions ?? []) {
    const normalizedExtension = extension.trim().toLowerCase();
    if (normalizedExtension) {
      extensionCatalog.set(
        normalizedExtension.startsWith('.') ? normalizedExtension : `.${normalizedExtension}`,
        metadata,
      );
    }
  }
}

/** Returns presentation metadata for a MIME type, with a safe generic fallback. */
export function getFileTypeMetadata(mimeType: string, fileName = ''): LyraFileTypeMetadata {
  const normalized = normalizeMimeType(mimeType);
  const explicit = normalized && normalized !== 'application/octet-stream' ? catalog[normalized] : undefined;
  if (explicit) return { ...explicit };
  if (!normalized || normalized === 'application/octet-stream') {
    const match = /(?:^|\.)((?:[a-z0-9]+))$/i.exec(fileName.trim().toLowerCase());
    const byExtension = match ? extensionCatalog.get(`.${match[1]}`) : undefined;
    if (byExtension) return { ...byExtension };
  }
  return { ...generic };
}
