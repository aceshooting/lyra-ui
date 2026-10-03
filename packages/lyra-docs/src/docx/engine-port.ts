import type {
  DocxAction, DocxCommandAvailability, DocxResult, DocxSelection,
  DocxSource, DocxFormatting, DocxParagraphStyles, DocxFontFamilies
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
  readonly formatting: Readonly<DocxFormatting>;
}
/** Private search addresses never cross the public session boundary. */
interface DocxEngineMatch {
  readonly token: object;
  readonly text: string;
  readonly before: string;
  readonly after: string;
}
export interface DocxEngineSearchOptions {
  readonly matchCase: boolean;
  readonly wholeWord: boolean;
  readonly limit: number;
}
/** DOCX-specific engine seam. An implementation must qualify these guarantees. */
export interface DocxEnginePort {
  inspect(): DocxEngineState;
  /** A change event is one committed document change, never initial loading. */
  subscribe(listener: (event: DocxEngineEvent) => void): () => void;
  can(command: DocxAction): DocxCommandAvailability;
  execute(command: DocxAction, retainedSelection?: object): DocxResult<void>;
  paragraphStyles(): DocxParagraphStyles;
  fontFamilies(): DocxFontFamilies;
  find(query: string, options: DocxEngineSearchOptions): { readonly matches: readonly DocxEngineMatch[]; readonly truncated: boolean };
  selectMatch(token: object): DocxResult<void>;
  replaceMatch(token: object, text: string): DocxResult<void>;
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
