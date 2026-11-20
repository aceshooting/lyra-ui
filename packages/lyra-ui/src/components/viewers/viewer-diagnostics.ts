/** Severity of a non-visual runtime diagnostic emitted by a document viewer. */
export type LyraViewerDiagnosticSeverity = 'warning' | 'error';

/** Stable diagnostic codes currently emitted by viewer integrations. */
export type LyraViewerDiagnosticCode =
  | 'delimited-parse-diagnostic'
  | 'geojson-map-unavailable'
  | 'notebook-sanitizer-unavailable'
  | 'notebook-output-too-large'
  | 'docx-conversion-message'
  | 'pptx-slide-render-error'
  | 'pptx-node-render-error'
  | 'pptx-search-error';

/**
 * Structured detail for `lr-viewer-diagnostic`. Diagnostics are not user-facing strings.
 * Recoverable diagnostics set `fatal: false` and never accompany `lr-render-error`, which stays
 * reserved for terminal failures. A fatal post-load peer diagnostic sets `fatal: true` and
 * accompanies the terminal error state.
 */
export interface LyraViewerDiagnostic {
  readonly code: LyraViewerDiagnosticCode;
  readonly severity: LyraViewerDiagnosticSeverity;
  readonly fatal: boolean;
  readonly source: 'dompurify' | 'maplibre-gl' | 'mammoth' | 'papaparse' | 'pptx-renderer';
  readonly cause: unknown;
  readonly page?: number;
  readonly nodeId?: string;
}

/** Detail for the bubbling, composed `lr-viewer-diagnostic` event. */
export interface LyraViewerDiagnosticEventDetail {
  readonly diagnostic: LyraViewerDiagnostic;
}
