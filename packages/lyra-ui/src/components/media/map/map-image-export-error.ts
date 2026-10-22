export type LyraMapImageExportType = 'image/png' | 'image/jpeg' | 'image/webp';
export interface LyraMapImageExportOptions { readonly type?: LyraMapImageExportType; readonly attribution?: boolean; }
export type LyraMapImageExportErrorCode = 'invalid-options' | 'busy' | 'cancelled' | 'timeout' | 'not-ready' | 'capture-failed' | 'blank-frame' | 'limit' | 'attribution-failed' | 'encoding-failed';
/** The sanitized `exportImage()` rejection. Its stable `code` is the only diagnostic it carries. */
export class LyraMapImageExportError extends Error {
  constructor(readonly code: LyraMapImageExportErrorCode) { super(`Map image export failed: ${code}`); this.name = 'LyraMapImageExportError'; }
}
