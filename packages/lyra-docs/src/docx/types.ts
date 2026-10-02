/** Lifecycle of one document session. Destruction is terminal. */
export type DocxStatus = 'idle' | 'opening' | 'ready' | 'error' | 'destroyed';
export type DocxCommand = 'bold' | 'italic' | 'underline' | 'undo' | 'redo';
export type DocxRevision = Readonly<{ documentId: string; value: number }>;
export type DocxSource = Readonly<{ kind: 'blank' }> | Readonly<{ kind: 'docx'; bytes: Uint8Array }>;
export type DocxRefusalCode =
  | 'invalid-option' | 'invalid-mount' | 'not-ready' | 'already-open'
  | 'busy' | 'composing' | 'read-only' | 'unsupported' | 'no-selection'
  | 'stale-revision' | 'stale-selection' | 'stale-save'
  | 'aborted' | 'destroyed' | 'engine-unavailable' | 'invalid-document'
  | 'resource-limit' | 'external-resource' | 'open-failed' | 'save-failed' | 'engine-failed';
export type DocxResult<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; code: DocxRefusalCode }>;

export interface DocxSessionOptions {
  readonly mount: HTMLElement;
  /** Fixed for the session; selection, focus and export remain available. */
  readonly readOnly?: boolean;
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
export interface DocxSnapshot {
  readonly status: DocxStatus;
  readonly activity: 'saving' | null;
  readonly revision: DocxRevision | null;
  readonly dirty: boolean;
  readonly readOnly: boolean;
  readonly composing: boolean;
  readonly selection: DocxSelection;
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
  can(command: DocxCommand): DocxCommandAvailability;
  retainSelection(): DocxResult<DocxSelectionLease>;
  execute(command: DocxCommand, options?: {
    expectedRevision?: DocxRevision;
    selection?: DocxSelectionLease;
  }): DocxResult<DocxRevision>;
  focus(): DocxResult<void>;
  save(options?: { signal?: AbortSignal; expectedRevision?: DocxRevision }): Promise<DocxResult<DocxSaveReceipt>>;
  /** Only the latest genuine receipt at the current revision can clear dirty. */
  acknowledgeSaved(receipt: DocxSaveReceipt): DocxResult<void>;
  destroy(): void;
}
