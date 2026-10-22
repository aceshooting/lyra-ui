import { LyraDocxEditor } from '../src/docx/docx-editor.class.js';
import type { DocxImageDirection, DocxRefusalCode, DocxResult, DocxSession } from '../src/docx/types.js';

/**
 * A real, unconnected `LyraDocxEditor` for driving the editor's handlers in Node. Tests replace only the
 * private collaborators a handler reads and assert what the handler does with them.
 */

export const refusal = (code: DocxRefusalCode): DocxResult<never> => ({ ok: false, code });
export const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));
export const session = (value: Record<string, unknown> = {}) => value as unknown as DocxSession;

export type Stub = (...args: never[]) => unknown;

/** The private surface these tests read and replace, named as the element declares it. */
export interface Internals {
  isConnected: boolean;
  renderRoot: unknown;
  session: DocxSession | null;
  sourceReadSequence: number;
  insertionIntent: unknown;
  insertionGeneration: number;
  insertionAwaitingPicker: boolean;
  insertionError: unknown;
  insertionBytes: unknown;
  insertionWidth: string;
  insertionHeight: string;
  insertionKeepRatio: boolean;
  imageIntent: unknown;
  imageDialog: unknown;
  imageDialogGeneration: number;
  imageDrag: unknown;
  imagePreview: unknown;
  imageNavigationEmpty: boolean;
  imageReplacementIntent: unknown;
  announcementsArmed: boolean;
  politeSink: unknown;
  assertiveSink: unknown;
  currentSnapshot: unknown;
  editError: unknown;
  mount: unknown;
  commandsOpen: boolean;
  imageFrameRequest: number;
  insertionPhase: string;
  toolbarKey: string;
  openPanelTrigger: string | null;
  selectedCommand: unknown;
  commandSources: unknown;
  commandIntent: unknown;
  chartLayer: unknown;
  openInProgress: boolean;
  settleCommand(operation: () => Promise<DocxResult<unknown>>): Promise<DocxResult<unknown>>;
  openImageInsertionPicker(): void;
  cancelImageInsertion(returnFocus: boolean): void;
  readImageInsertionFile(event: Event): Promise<void>;
  insertionFeedback(code: DocxRefusalCode): string;
  navigateImage(direction: DocxImageDirection): void;
  openImageDialog(event: Event, kind: 'resize' | 'description'): void;
  runImageEdit(action: unknown, fromDialog?: boolean): Promise<void>;
  endImageDrag(event: PointerEvent): Promise<void>;
  commandAvailability(item: unknown): unknown;
  onHostKeyDown(event: KeyboardEvent): void;
  scheduleImageFrame(): void;
  onCommandSelected(event: unknown): void;
  onToolbarPanelShow(event: unknown): void;
  onToolbarPanelHidden(event: unknown): void;
  onToolbarFocusIn(event: unknown): void;
  onFileSelected(event: unknown): void;
  onImageInsertionKey(event: KeyboardEvent): void;
  onImageActivationKey(event: KeyboardEvent): void;
  newFromToolbar(): void;
  prepareImageReplacement(): void;
  replacementFeedback(code: DocxRefusalCode): string;
  render(): unknown;
  renderCharts(): unknown;
  [name: string]: unknown;
}

/** A real element that was never connected: its fields and handlers exist, rendering never starts. */
export function editor(state: Partial<Internals> = {}) {
  const element = new LyraDocxEditor();
  Object.defineProperty(element, 'isConnected', { value: true, writable: true, configurable: true });
  Object.defineProperty(element, 'updateComplete', { get: () => Promise.resolve(true), configurable: true });
  const internals = element as unknown as Internals;
  Object.assign(internals, state);
  const stub = (name: string, implementation: Stub) => { internals[name] = implementation; };
  return { i: internals, stub };
}
