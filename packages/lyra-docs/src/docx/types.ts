/** Lifecycle of one document session. Destruction is terminal. */
export type DocxStatus = 'idle' | 'opening' | 'ready' | 'error' | 'destroyed';
export type DocxCommand = 'bold' | 'italic' | 'underline' | 'undo' | 'redo';
export type DocxAlignment = 'left' | 'center' | 'right' | 'justify';
/**
 * Formatting actions. Style ids are at most 128 code units and must identify a document paragraph style.
 * Font families accept 1–64 Unicode letters, numbers, combining marks, spaces or - . + _.
 * Font sizes are 1–1638 points in half-point steps. Colors are #RRGGBB or auto.
 * Links accept HTTPS without credentials, mailto or fragments, at most 2048 code units;
 * optional link text is at most 4096 code units and must be valid XML 1.0 text.
 * Other URL schemes, whitespace and controls are refused.
 */
export type DocxEdit =
  | Readonly<{ type: 'paragraph-style'; styleId: string }>
  | Readonly<{ type: 'alignment'; value: DocxAlignment }>
  | Readonly<{ type: 'toggle-list'; kind: 'bullet' | 'numbered' }>
  | Readonly<{ type: 'font-family'; family: string }>
  | Readonly<{ type: 'font-size'; points: number }>
  | Readonly<{ type: 'text-color'; color: string }>
  | Readonly<{ type: 'link'; href: string; text?: string }>
  | Readonly<{ type: 'remove-link' }>;
export type DocxAction = DocxCommand | DocxEdit;
export type DocxRevision = Readonly<{ documentId: string; value: number }>;
export type DocxSource = Readonly<{ kind: 'blank' }> | Readonly<{ kind: 'docx'; bytes: Uint8Array }>;
export type DocxRefusalCode =
  | 'invalid-option' | 'invalid-mount' | 'not-ready' | 'already-open'
  | 'busy' | 'composing' | 'read-only' | 'unsupported' | 'no-selection'
  | 'stale-revision' | 'stale-selection' | 'stale-search' | 'stale-save'
  | 'aborted' | 'destroyed' | 'engine-unavailable' | 'invalid-document'
  | 'resource-limit' | 'external-resource' | 'open-failed' | 'save-failed' | 'engine-failed';
export type DocxResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; code: DocxRefusalCode }>;

export interface DocxSessionOptions {
  readonly mount: HTMLElement;
  /** Fixed for the session; selection, focus and export remain available. */
  readonly readOnly?: boolean;
  /** Initial engine language; document language and authored content are unchanged. */
  readonly locale?: string;
  /** Translate engine messages without exposing engine-specific types. */
  readonly translate?: (key: string, values?: Record<string, string | number>) => string;
}
export interface DocxSelection {
  readonly version: number;
  readonly kind: 'none' | 'caret' | 'text' | 'other';
}
export interface DocxCommandAvailability {
  readonly enabled: boolean;
  /** Present exactly when disabled. */
  readonly reason?: DocxRefusalCode;
  /** Formatting state; omitted for history commands. */
  readonly active?: boolean | 'mixed';
}
/** Selection formatting. Null means the value cannot be derived, including mixed selections. */
export interface DocxFormatting {
  readonly paragraphStyleId: string | null;
  readonly alignment: DocxAlignment | null;
  readonly fontFamily: string | null;
  readonly fontSizePoints: number | null;
  /** Currently null: the document engine does not expose a public selection-color reader. */
  readonly color: string | null;
  readonly bulletList: boolean;
  readonly numberedList: boolean;
}
export interface DocxParagraphStyles {
  readonly items: readonly Readonly<{ id: string; label: string }>[];
  readonly truncated: boolean;
}
export interface DocxFontFamilies {
  readonly items: readonly string[];
  readonly truncated: boolean;
}
export interface DocxSearchOptions {
  readonly matchCase?: boolean;
  readonly wholeWord?: boolean;
  /** Maximum returned matches, an integer from 1 to 100. Defaults to 100. */
  readonly limit?: number;
}
export interface DocxSearchMatch {
  /** Opaque id, valid only for this session's latest search at the same document revision. */
  readonly id: string;
  readonly text: string;
  /** At most 48 code units of context on either side. */
  readonly before: string;
  readonly after: string;
}
export interface DocxSearchResults {
  readonly revision: DocxRevision;
  readonly matches: readonly Readonly<DocxSearchMatch>[];
  readonly truncated: boolean;
}
export interface DocxSnapshot {
  readonly status: DocxStatus;
  readonly activity: 'saving' | null;
  readonly revision: DocxRevision | null;
  readonly dirty: boolean;
  readonly readOnly: boolean;
  readonly composing: boolean;
  readonly selection: DocxSelection;
  readonly formatting: DocxFormatting;
  readonly commands: Readonly<Record<DocxCommand, DocxCommandAvailability>>;
  readonly error: Readonly<{ code: DocxRefusalCode }> | null;
}
export interface DocxSelectionLease {
  /** Release retained selection; repeated calls are safe. */
  release(): void;
}
export interface DocxSaveReceipt {
  readonly revision: DocxRevision;
  /** Caller-owned copy. Object identity authenticates an acknowledgement. */
  readonly bytes: Uint8Array;
}
/** One document, explicit export and explicit persistence acknowledgement. */
export interface DocxSession {
  /** Cached immutable state; unchanged reads have the same identity. */
  snapshot(): Readonly<DocxSnapshot>;
  /** No initial callback. Read state before and after subscribing. */
  subscribe(listener: () => void): () => void;
  open(source: DocxSource, options?: { signal?: AbortSignal }): Promise<DocxResult<DocxRevision>>;
  can(command: DocxAction): DocxCommandAvailability;
  retainSelection(): DocxResult<DocxSelectionLease>;
  execute(command: DocxAction, options?: {
    expectedRevision?: DocxRevision;
    selection?: DocxSelectionLease;
  }): DocxResult<DocxRevision>;
  /** On-demand document paragraph styles; at most 256 copied entries. */
  paragraphStyles(): DocxResult<DocxParagraphStyles>;
  /** On-demand font choices; at most 128 entries, without downloading fonts. */
  fontFamilies(): DocxResult<DocxFontFamilies>;
  /** Literal search, 1–256 code units. A new search invalidates previous match ids. */
  find(query: string, options?: DocxSearchOptions): DocxResult<DocxSearchResults>;
  /** Read-only navigation does not dirty the document. Foreign, forged or invalidated ids return stale-search. */
  selectMatch(id: string, options?: { expectedRevision?: DocxRevision }): DocxResult<void>;
  /** One undoable replacement, at most 4096 code units of XML 1.0 text. Empty text deletes the match. */
  replaceMatch(id: string, text: string, options?: { expectedRevision?: DocxRevision }): DocxResult<DocxRevision>;
  focus(): DocxResult<void>;
  save(options?: { signal?: AbortSignal; expectedRevision?: DocxRevision }): Promise<DocxResult<DocxSaveReceipt>>;
  /** Only the latest genuine receipt at the current revision can clear dirty. */
  acknowledgeSaved(receipt: DocxSaveReceipt): DocxResult<void>;
  destroy(): void;
}
