import type {
  DocxCommand, DocxCommandAvailability, DocxResult, DocxSelection,
  DocxSource
} from './types.js';

/** Internal ownership seam; no browser validation is implemented here. */
export interface DocxMountOwnership {
  /** Must detect removal/adoption, including transient remove/reinsert. */
  valid(): boolean;
  /** Release observer and exclusive mount claim, idempotently. */
  release(): void;
}
export type DocxEngineEvent = 'change' | 'user-selection' | 'focus-selection' | 'composition' | 'state';
interface DocxEngineState {
  readonly selection: DocxSelection['kind'];
  readonly composing: boolean;
}
/** DOCX-specific engine seam. An implementation must qualify these guarantees. */
export interface DocxEnginePort {
  inspect(): DocxEngineState;
  /** A change event is one committed document change, never initial loading. */
  subscribe(listener: (event: DocxEngineEvent) => void): () => void;
  can(command: DocxCommand): DocxCommandAvailability;
  execute(command: DocxCommand, retainedSelection?: object): DocxResult<void>;
  focus(): void;
  retainSelection(): object;
  releaseSelection(token: object): void;
  /**
   * Export one coherent committed snapshot. Resolve/reject only after the input
   * suspension or transaction barrier is released, including after cancellation.
   * A revision check alone cannot supply this guarantee.
   */
  save(signal: AbortSignal): Promise<Uint8Array>;
  /** Terminal, releases engine-owned resources even if the facade is retained. */
  destroy(): void;
}
export interface DocxSessionPort {
  /** Validates empty, connected same-document light DOM and exclusive ownership. */
  claimMount(mount: HTMLElement, lost: () => void): DocxResult<DocxMountOwnership>;
  /**
   * Resolves only after parsing, attach, initial selection/capabilities and layout.
   * On rejection, clean all partially allocated resources. A late successful
   * result remains destroyable after abort, and is never attached by the facade.
   * Native editing must not start before the caller subscribes to this handle.
   */
  open(source: DocxSource, options: { readOnly: boolean; signal: AbortSignal }): Promise<DocxResult<DocxEnginePort>>;
  /** Isolated notification-fault diagnostic, with no document/error payload. */
  subscriberFailed?(): void;
}
