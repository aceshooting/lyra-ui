/** Lifecycle of one document session. Destruction is terminal. */
export type DocxStatus = 'idle' | 'opening' | 'ready' | 'error' | 'destroyed';
export type DocxCommand = 'bold' | 'italic' | 'underline' | 'strikethrough' | 'superscript' | 'subscript' | 'undo' | 'redo';
/** Word's text highlight palette (`w:highlight`); `none` removes highlighting. */
export type DocxHighlight =
  | 'yellow' | 'green' | 'cyan' | 'magenta' | 'blue' | 'red' | 'darkBlue' | 'darkCyan' | 'darkGreen'
  | 'darkMagenta' | 'darkRed' | 'darkYellow' | 'darkGray' | 'lightGray' | 'black' | 'none';
export type DocxAlignment = 'left' | 'center' | 'right' | 'justify';
/**
 * Formatting, simple table and selected inline-image actions. Style ids are at most 128 code units and must identify a document paragraph style.
 * Font families accept 1–64 Unicode letters, numbers, combining marks, spaces or - . + _.
 * Font sizes are 1–1638 points in half-point steps. Colors are #RRGGBB or auto; highlights use Word's named palette.
 * Line spacing is a multiple from 1 to 5 in 0.05 steps.
 * Links accept HTTP(S) without credentials, mailto or fragments, at most 2048 code units;
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
  | Readonly<{ type: 'highlight'; color: DocxHighlight }>
  | Readonly<{ type: 'indent'; direction: 'increase' | 'decrease' }>
  | Readonly<{ type: 'line-spacing'; multiple: number }>
  | Readonly<{ type: 'clear-formatting' }>
  | Readonly<{ type: 'page-break' }>
  | Readonly<{ type: 'link'; href: string; text?: string }>
  | Readonly<{ type: 'remove-link' }>
  | DocxTableAction
  | DocxImageAction;
/** Simple, unnested table authoring. Inserted/grown tables are at most 20 by 20 cells. */
export type DocxTableAction =
  | Readonly<{ type: 'insert-table'; rows: number; columns: number }>
  | Readonly<{ type: 'insert-table-row'; where: 'above' | 'below' }>
  | Readonly<{ type: 'insert-table-column'; where: 'left' | 'right' }>
  | Readonly<{ type: 'delete-table-row' }>
  | Readonly<{ type: 'delete-table-column' }>
  | Readonly<{ type: 'delete-table' }>;
/** Existing plain body inline images; resize uses 1–1440 points on each axis. */
export type DocxImageAction =
  | Readonly<{ type: 'resize-image'; widthPoints: number; heightPoints: number }>
  | Readonly<{ type: 'image-description'; title: string; description: string }>
  | Readonly<{ type: 'delete-image' }>;
/** Copied actual dimensions. Advisory only; execution verifies canonical eligibility. */
export interface DocxImageContext {
  readonly widthPoints: number;
  readonly heightPoints: number;
}
/** Complete bounded XML text: title <=256 and description <=2048 UTF-16 code units. */
export interface DocxImageDescription {
  readonly title: string;
  readonly description: string;
}
export type DocxImageDirection = 'next' | 'previous';

/** One local raster image, copied synchronously when insertion starts. */
export interface DocxImageSource {
  readonly bytes: Uint8Array;
  readonly widthPoints: number;
  readonly heightPoints: number;
  readonly title?: string;
  readonly description?: string;
}
export interface DocxInsertImageOptions {
  readonly expectedRevision?: DocxRevision;
  readonly selection?: DocxSelectionLease;
  readonly signal?: AbortSignal;
}
export type DocxAction = DocxCommand | DocxEdit;
/** Rendered selection context, advisory only; execution checks canonical topology. */
export interface DocxTableContext {
  readonly rows: number;
  readonly columns: number;
  readonly rowIndex: number | null;
  readonly columnIndex: number | null;
}
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
  readonly activity: 'saving' | 'inserting-image' | null;
  readonly revision: DocxRevision | null;
  readonly dirty: boolean;
  readonly readOnly: boolean;
  readonly composing: boolean;
  readonly selection: DocxSelection;
  readonly formatting: DocxFormatting;
  readonly table: DocxTableContext | null;
  readonly image: DocxImageContext | null;
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
  /** Table availability is advisory and pure; execute verifies canonical topology and bounds. */
  can(command: DocxAction): DocxCommandAvailability;
  /** Cached caret availability; insertion separately qualifies the current package. */
  canInsertImage(): DocxCommandAvailability;
  /** Insert one owned raster at the original caret; success identifies its committed revision. */
  insertImage(source: DocxImageSource, options?: DocxInsertImageOptions): Promise<DocxResult<DocxRevision>>;
  retainSelection(): DocxResult<DocxSelectionLease>;
  execute(command: DocxAction, options?: {
    expectedRevision?: DocxRevision;
    selection?: DocxSelectionLease;
  }): DocxResult<DocxRevision>;
  /** On-demand document paragraph styles; at most 256 copied entries. */
  paragraphStyles(): DocxResult<DocxParagraphStyles>;
  /** Pure bounded cached metadata; pending native input returns busy without settlement. */
  imageDescription(): DocxResult<Readonly<DocxImageDescription>>;
  /** Select an eligible existing body image in document order, wrapping at each end. */
  selectImage(direction: DocxImageDirection): DocxResult<void>;
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
