import { nothing, type PropertyValues, type TemplateResult } from 'lit';
import { html, unsafeStatic } from 'lit/static-html.js';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '@aceshooting/lyra-ui/utilities/lyra-element.js';
import { resolveLyraScopedString } from '@aceshooting/lyra-ui/localization.js';
import { tag } from '@aceshooting/lyra-ui/utilities/prefix.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '@aceshooting/lyra-ui/utilities/announcer.js';
import { createDocxSession } from './create-session.js';
import { refreshInternalDocxTableLabels } from './session.js';
import { captureTableToolIntent, tableInsertDraft } from './table-tools.js';
import {
  captureImageToolIntent, imageDescriptionDraft, imageDimensionDraft,
  imageRatioPartner, imageResizeDraft, imageResizeUnchanged,
} from './image-tools.js';
import { captureImageInsertionIntent, imageInsertionDefaults, imageInsertionDraft } from './image-insertion-tools.js';
import { inspectDocxImage } from './image-bytes.js';
import type {
  DocxCommand, DocxEdit, DocxRefusalCode, DocxResult, DocxRevision, DocxSaveReceipt,
  DocxSelectionLease, DocxSession, DocxSnapshot, DocxSource, DocxSearchResults, DocxTableAction,
  DocxImageAction, DocxImageDescription, DocxImageDirection, DocxImageSource, DocxInsertImageOptions, DocxCommandAvailability,
} from './types.js';
import { DOCX_EDITOR_STRINGS } from './strings.js';
import { styles } from './docx-editor.styles.js';

interface DocxEditorEvents {
  'lr-before-open': CustomEvent<{ kind: DocxSource['kind']; currentRevision: DocxRevision | null }>;
  'lr-ready': CustomEvent<{ revision: DocxRevision }>;
  'lr-change': CustomEvent<{ snapshot: Readonly<DocxSnapshot> | null }>;
  'lr-selection-change': CustomEvent<{ selection: DocxSnapshot['selection'] }>;
  'lr-error': CustomEvent<{ code: DocxRefusalCode }>;
  'lr-save': CustomEvent<{ receipt: DocxSaveReceipt }>;
}

const commandLabels = {
  bold: 'docxEditorBold',
  italic: 'docxEditorItalic',
  underline: 'docxEditorUnderline',
  undo: 'docxEditorUndo',
  redo: 'docxEditorRedo',
} as const satisfies Record<DocxCommand, string>;
const commands: readonly DocxCommand[] = ['bold', 'italic', 'underline', 'undo', 'redo'];
const buttonTag = unsafeStatic(tag('button'));
const selectTag = unsafeStatic(tag('select'));
const optionTag = unsafeStatic(tag('option'));
const comboboxTag = unsafeStatic(tag('combobox'));
const numberInputTag = unsafeStatic(tag('number-input'));
const colorPickerTag = unsafeStatic(tag('color-picker'));
const popoverTag = unsafeStatic(tag('popover'));
const inputTag = unsafeStatic(tag('input'));
const checkboxTag = unsafeStatic(tag('checkbox'));
const textareaTag = unsafeStatic(tag('textarea'));
const alignments = ['left', 'center', 'right', 'justify'] as const;
const listKinds = ['bullet', 'numbered'] as const;
const tableActions = [
  ['row-above', { type: 'insert-table-row', where: 'above' }, 'docxEditorTableRowAbove'],
  ['row-below', { type: 'insert-table-row', where: 'below' }, 'docxEditorTableRowBelow'],
  ['column-left', { type: 'insert-table-column', where: 'left' }, 'docxEditorTableColumnLeft'],
  ['column-right', { type: 'insert-table-column', where: 'right' }, 'docxEditorTableColumnRight'],
  ['delete-row', { type: 'delete-table-row' }, 'docxEditorTableDeleteRow'],
  ['delete-column', { type: 'delete-table-column' }, 'docxEditorTableDeleteColumn'],
  ['delete-table', { type: 'delete-table' }, 'docxEditorTableDelete'],
] as const;
const maxInputBytes = 4 * 1024 * 1024;
type ImageInsertionPhase = 'idle' | 'reading' | 'draft' | 'dispatched';
const refused = <T>(code: DocxRefusalCode): DocxResult<T> => ({ ok: false, code });

/**
 * Experimental DOCX editing surface. The engine owns only the stable, empty light-DOM child
 * slotted into the document area. Import the companion's `docx/editor.css` separately for engine
 * content styling. A disconnect destroys the session, including undo history and selection;
 * callers reopen their own saved bytes after reconnect. Save returns bytes without persisting or
 * clearing dirty state; call `acknowledgeSaved()` after durable host persistence.
 *
 * @event lr-before-open - Cancelable when a dirty document would be replaced.
 * @event lr-ready - A document finished opening.
 * @event lr-change - Session state or revision changed; no document bytes are included.
 * @event lr-selection-change - Selection kind or version changed.
 * @event lr-error - A normalized refusal code; no document contents are exposed.
 * @event lr-save - Explicit save completed; detail contains the save receipt and bytes.
 * @customElement lr-docx-editor
 * @slot document - Reserved for the component-owned, stable light-DOM engine mount.
 * @cssprop --lr-docx-editor-document-max-block-size - Document scroll viewport maximum block size; defaults to 30rem. Set a valid length or none to let the document grow. Pages keep 100% scale and scroll horizontally in narrower allocations.
 * @csspart base - The root editor surface.
 * @csspart toolbar - File and formatting controls.
 * @csspart file-actions - New, Open and Save controls.
 * @csspart new-button - Creates a blank document.
 * @csspart open-button - Opens the local file picker.
 * @csspart save-button - Requests explicit serialization.
 * @csspart file-input - Native local DOCX file picker.
 * @csspart format-actions - Formatting and history controls.
 * @csspart format-button - One formatting or history control, identified by data-command.
 * @csspart editing-tools - Paragraph, alignment, list, font, color and link tools.
 * @csspart paragraph-style - Actual styles offered by the current document.
 * @csspart alignment-actions - Four paragraph alignment actions.
 * @csspart list-actions - Bullet and numbered list actions.
 * @csspart edit-button - One alignment or list action.
 * @csspart font-family - Font family picker with on-demand suggestions.
 * @csspart font-size - Font size field in points.
 * @csspart text-color - Hex text color picker; a missing snapshot color is not inferred.
 * @csspart color-state - Identifies a color unavailable through the editor selection contract.
 * @csspart color-auto - Applies automatic authored text color.
 * @csspart link-popover - URL and optional text editor.
 * @csspart link-trigger - Opens the link editor.
 * @csspart link-fields - Link form contents.
 * @csspart link-href - URL field.
 * @csspart link-text - Optional replacement text field.
 * @csspart link-actions - Apply, remove and cancel controls.
 * @csspart link-apply - Applies a validated link.
 * @csspart link-remove - Removes the current link.
 * @csspart link-cancel - Closes the link editor.
 * @csspart table-tools - Table insertion and contextual editing controls.
 * @csspart table-insert-popover - Table dimensions dialog.
 * @csspart table-insert-trigger - Opens the table insertion dialog.
 * @csspart table-fields - Table dimension fields and controls.
 * @csspart table-rows - Requested row count, from 1 to 20.
 * @csspart table-columns - Requested column count, from 1 to 20.
 * @csspart table-hint - Dimension limits or stale-selection guidance.
 * @csspart table-dialog-actions - Insert and cancel controls.
 * @csspart table-insert-apply - Inserts the requested rectangular table.
 * @csspart table-insert-cancel - Cancels table insertion.
 * @csspart table-context - Current table dimensions and available cell coordinates.
 * @csspart table-actions - Contextual row, column and whole-table actions.
 * @csspart table-button - A table action, identified by data-table-action.
 * @csspart image-tools - Image navigation and contextual existing inline-image controls.
 * @csspart image-previous - Selects the previous eligible body image, wrapping at the start.
 * @csspart image-next - Selects the next eligible body image, wrapping at the end.
 * @csspart image-navigation-status - Feedback when no eligible image is available.
 * @csspart image-context - Actual selected image dimensions in points.
 * @csspart image-resize-popover - Image dimensions dialog.
 * @csspart image-resize-trigger - Opens the image resize dialog.
 * @csspart image-resize-fields - Dimension fields, ratio option and controls.
 * @csspart image-width - Requested width in points.
 * @csspart image-height - Requested height in points.
 * @csspart image-ratio - Preserve the captured original aspect ratio.
 * @csspart image-resize-hint - Dimension limits or stale-selection guidance.
 * @csspart image-resize-actions - Resize Apply and Cancel controls.
 * @csspart image-resize-apply - Applies both image dimensions as one edit.
 * @csspart image-resize-cancel - Cancels resizing.
 * @csspart image-description-popover - Image title and description dialog.
 * @csspart image-description-trigger - Opens the image description dialog.
 * @csspart image-description-fields - Metadata fields and controls.
 * @csspart image-title - Bounded image title field.
 * @csspart image-description - Bounded multiline description field.
 * @csspart image-description-hint - Metadata guidance or stale-selection guidance.
 * @csspart image-description-actions - Metadata Apply and Cancel controls.
 * @csspart image-description-apply - Applies both metadata fields as one edit.
 * @csspart image-description-cancel - Cancels description editing.
 * @csspart image-delete - Deletes the originally selected image as one edit.
 * @csspart image-insert-trigger - Opens the local image picker at the original caret.
 * @csspart image-insert-dialog - Local image dimensions and description dialog.
 * @csspart image-insert-file - Native local image picker.
 * @csspart image-insert-fields - Local image draft and controls.
 * @csspart image-insert-width - Requested insertion width in points.
 * @csspart image-insert-height - Requested insertion height in points.
 * @csspart image-insert-ratio - Preserve the original encoded image ratio.
 * @csspart image-insert-title - Optional bounded title.
 * @csspart image-insert-description - Optional bounded multiline description.
 * @csspart image-insert-hint - Supported formats, size guidance or stale-intent feedback.
 * @csspart image-insert-actions - Insert and Cancel controls.
 * @csspart image-insert-apply - Inserts the original local image at the retained caret.
 * @csspart image-insert-cancel - Cancels picking, reading or editing a local image draft.
 * @csspart image-insert-status - Local image preparation or refusal feedback.
 * @csspart find - On-demand search and single-match replacement surface.
 * @csspart find-toggle - Opens and closes the find surface.
 * @csspart find-query - Search query field.
 * @csspart find-match-case - Case-sensitive option.
 * @csspart find-whole-word - Whole-word option.
 * @csspart find-submit - Runs a bounded search.
 * @csspart find-count - Match count and truncation notice.
 * @csspart find-previous - Selects the previous match.
 * @csspart find-next - Selects the next match.
 * @csspart find-replace - Replacement text field.
 * @csspart find-replace-button - Replaces one selected match.
 * @csspart confirm - Dirty document replacement confirmation.
 * @csspart discard-button - Confirms replacement of unsaved content.
 * @csspart keep-button - Cancels replacement of unsaved content.
 * @csspart document - Scrollable engine surface.
 * @csspart error - Localized load or save failure.
 * @csspart edit-error - Localized editing refusal.
 * @csspart status - Filename and current document state.
 * @csspart filename - The local file name or untitled fallback.
 * @csspart state - Current load, dirty or save state.
 */
export class LyraDocxEditor extends LyraElement<DocxEditorEvents> {
  static override styles = [LyraElement.styles, styles];

  /** Resolve the editor's private message slice through Lyra's public scoped resolver. */
  protected override localize(key: string, fallback?: string, values?: Record<string, string | number>): string {
    if (!Object.prototype.hasOwnProperty.call(DOCX_EDITOR_STRINGS, key)) return super.localize(key, fallback, values);
    // Register inherited-locale observation even though this slice lives outside Lyra UI's catalog.
    void this.effectiveLocale;
    return resolveLyraScopedString(this, key, DOCX_EDITOR_STRINGS, this.strings, fallback, values);
  }

  /** Applied when the next document is opened. The session fixes this value at creation. */
  @property({ type: Boolean, attribute: 'read-only', reflect: true }) readOnly = false;

  @state() private currentSnapshot: Readonly<DocxSnapshot> | null = null;
  @state() private filename = '';
  @state() private localError: DocxRefusalCode | null = null;
  @state() private openingFile = false;
  @state() private wasDisconnected = false;
  @state() private pendingAction: 'new' | 'open' | null = null;
  @state() private toolbarKey = 'bold';
  @state() private paragraphStyleItems: readonly { id: string; label: string }[] = [];
  @state() private fontFamilyItems: readonly string[] = [];
  @state() private findOpen = false;
  @state() private searchResults: DocxSearchResults | null = null;
  @state() private searchIndex = -1;
  @state() private query = '';
  @state() private matchCase = false;
  @state() private wholeWord = false;
  @state() private replacement = '';
  @state() private linkHref = '';
  @state() private linkText = '';
  @state() private editError: DocxRefusalCode | null = null;
  @state() private tableRows = '2';
  @state() private tableColumns = '2';
  @state() private tableDialogOpen = false;
  private tableIntent: ReturnType<typeof captureTableToolIntent> = null;
  private tableDialogGeneration = 0;
  private cancelTableFocusReturn: (() => void) | null = null;
  private tableLabelState: { session: DocxSession; row: string; column: string } | null = null;
  @state() private imageDialog: 'resize' | 'description' | null = null;
  @state() private imageWidth = '';
  @state() private imageHeight = '';
  @state() private imageKeepRatio = true;
  @state() private imageTitle = '';
  @state() private imageDescriptionText = '';
  @state() private imageNavigationEmpty = false;
  private imageIntent: ReturnType<typeof captureImageToolIntent> = null;
  private imageDialogGeneration = 0;
  private cancelImageFocusReturn: (() => void) | null = null;
  @state() private insertionPhase: ImageInsertionPhase = 'idle';
  @state() private insertionWidth = '';
  @state() private insertionHeight = '';
  @state() private insertionKeepRatio = true;
  @state() private insertionTitle = '';
  @state() private insertionDescription = '';
  @state() private insertionError: DocxRefusalCode | null = null;
  private insertionIntent: ReturnType<typeof captureImageInsertionIntent> = null;
  private insertionDefaults: ReturnType<typeof imageInsertionDefaults> = null;
  private insertionBytes: Uint8Array | null = null;
  private insertionGeneration = 0;
  private insertionAwaitingPicker = false;
  private cancelInsertionFocusReturn: (() => void) | null = null;

  private mount: HTMLDivElement | null = null;
  private session: DocxSession | null = null;
  private unsubscribeSession: (() => void) | null = null;
  private toolbarSelection: DocxSelectionLease | null = null;
  @state() private openInProgress = false;
  private sourceReadSequence = 0;
  private politeSink: AnnouncementSink | null = null;
  private assertiveSink: AnnouncementSink | null = null;
  private announcementsArmed = false;
  private pickerFocusReturn = false;

  override connectedCallback(): void {
    super.connectedCallback();
    this.politeSink = acquireAnnouncementSink('polite', { document: this.ownerDocument, source: this });
    this.assertiveSink = acquireAnnouncementSink('assertive', { document: this.ownerDocument, source: this });
    if (!this.mount) {
      const mount = this.ownerDocument.createElement('div');
      mount.slot = 'document';
      mount.setAttribute('role', 'document');
      mount.setAttribute('aria-label', this.editorLabel());
      mount.setAttribute('aria-keyshortcuts', 'Alt+F10');
      mount.title = this.localize('docxEditorShortcut');
      this.mount = mount;
      this.append(mount);
    }
    this.addEventListener('keydown', this.onHostKeyDown, { capture: true });
  }

  override disconnectedCallback(): void {
    this.sourceReadSequence++;
    this.removeEventListener('keydown', this.onHostKeyDown, { capture: true });
    this.disposeSession();
    this.mount?.remove();
    this.mount = null;
    this.currentSnapshot = null;
    this.openInProgress = false;
    this.openingFile = false;
    this.localError = null;
    this.wasDisconnected = true;
    this.pendingAction = null;
    this.clearEditingDrafts();
    this.emit('lr-change', { snapshot: null });
    this.politeSink?.release();
    this.politeSink = null;
    this.assertiveSink?.release();
    this.assertiveSink = null;
    this.announcementsArmed = false;
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.refreshTableLabels();
    const enabled = this.enabledToolbarButtons();
    if (enabled.length && !enabled.some(button => button.getAttribute('data-tool-key') === this.toolbarKey))
      this.toolbarKey = enabled[0]!.getAttribute('data-tool-key') ?? 'bold';
    if (this.mount) {
      this.mount.setAttribute('aria-label', this.editorLabel());
      this.mount.title = this.localize('docxEditorShortcut');
    }
    if (!this.announcementsArmed && this.wasDisconnected)
      this.politeSink?.announce(this.localize('docxEditorDisconnected'));
    this.announcementsArmed = true;
  }

  /** Current immutable session state, or null before opening and after disconnect. */
  snapshot(): Readonly<DocxSnapshot> | null { return this.currentSnapshot; }

  private editorLabel(): string {
    return this.getAttribute('aria-label') ?? this.localize('docxEditorLabel');
  }

  private disposeSession(): void {
    this.toolbarSelection?.release();
    this.toolbarSelection = null;
    this.unsubscribeSession?.();
    this.unsubscribeSession = null;
    this.session?.destroy();
    this.session = null;
    this.mount?.replaceChildren();
    this.clearEditingDrafts();
  }

  private clearEditingDrafts(): void {
    this.resetImageInsertion();
    this.imageDialogGeneration++;
    this.cancelImageFocusReturn?.();
    this.releaseImageIntent();
    this.imageDialog = null;
    this.imageWidth = '';
    this.imageHeight = '';
    this.imageKeepRatio = true;
    this.imageTitle = '';
    this.imageDescriptionText = '';
    this.imageNavigationEmpty = false;
    for (const kind of ['resize', 'description'] as const) void this.imagePopover(kind)?.hide({ focusTrigger: false });
    this.tableDialogGeneration++;
    this.cancelTableFocusReturn?.();
    this.releaseTableIntent();
    this.tableDialogOpen = false;
    this.tableRows = '2';
    this.tableColumns = '2';
    this.tableLabelState = null;
    void this.tablePopover()?.hide({ focusTrigger: false });
    this.pickerFocusReturn = false;
    this.paragraphStyleItems = [];
    this.fontFamilyItems = [];
    this.searchResults = null;
    this.searchIndex = -1;
    this.editError = null;
    this.findOpen = false;
    this.query = '';
    this.replacement = '';
    this.linkHref = '';
    this.linkText = '';
  }

  private syncSession(): void {
    const owner = this.session;
    if (!owner) return;
    const previous = this.currentSnapshot;
    const next = owner.snapshot();
    if (next === previous) return;
    if (next.selection.version !== previous?.selection.version ||
        next.revision?.documentId !== previous?.revision?.documentId || next.revision?.value !== previous?.revision?.value)
      this.releaseToolbarSelection();
    if (this.tableIntent && !this.tableIntent.valid(owner)) this.tableIntent.release();
    if (this.imageIntent && !this.imageIntent.valid(owner)) this.imageIntent.release();
    if (this.insertionIntent && !this.insertionIntent.valid(owner)) {
      if (this.insertionPhase === 'reading' || this.insertionPhase === 'idle') this.cancelImageInsertion(false);
      else this.insertionIntent.release();
    }
    if (!this.isConnected || this.session !== owner || this.currentSnapshot !== previous || owner.snapshot() !== next) return;
    this.currentSnapshot = next;
    const current = () => this.isConnected && this.session === owner && this.currentSnapshot === next && owner.snapshot() === next;
    if (next.image) this.imageNavigationEmpty = false;
    if (previous?.revision?.documentId !== next.revision?.documentId ||
        previous?.revision?.value !== next.revision?.value) {
      this.searchResults = null;
      this.searchIndex = -1;
    }
    this.emit('lr-change', { snapshot: next });
    if (!current()) return;
    if (this.announcementsArmed && next.status === 'opening' && previous?.status !== 'opening')
      this.politeSink?.announce(this.localize('docxEditorOpening'));
    if (this.announcementsArmed && next.activity === 'saving' && previous?.activity !== 'saving')
      this.politeSink?.announce(this.localize('docxEditorSaving'));
    if (this.announcementsArmed && next.activity === 'inserting-image' && previous?.activity !== 'inserting-image')
      this.politeSink?.announce(this.localize('docxEditorInsertingImage'));
    if (next.status === 'ready' && previous?.status !== 'ready' && next.revision) {
      this.emit('lr-ready', { revision: next.revision });
      if (!current()) return;
    }
    if (this.announcementsArmed && next.status === 'ready' && previous?.status !== 'ready')
      this.politeSink?.announce(this.localize('docxEditorReady'));
    if (this.announcementsArmed && next.dirty && !previous?.dirty && next.status === 'ready')
      this.politeSink?.announce(this.localize('docxEditorUnsaved'));
    if (next.selection.version !== previous?.selection.version || next.selection.kind !== previous?.selection.kind) {
      this.emit('lr-selection-change', { selection: next.selection });
      if (!current()) return;
    }
    if (next.status === 'error' && next.error?.code && (previous?.status !== 'error' || previous.error?.code !== next.error.code)) {
      this.emit('lr-error', { code: next.error.code });
      if (!current()) return;
    }
    if (this.announcementsArmed && next.status === 'error' && previous?.status !== 'error')
      this.assertiveSink?.announce(this.localize('docxEditorError'));
  }

  private reportError(code: DocxRefusalCode): void {
    this.localError = code;
    this.emit('lr-error', { code });
    if (this.announcementsArmed) this.assertiveSink?.announce(this.localize('docxEditorError'));
  }

  private async load(source: DocxSource, filename: string, signal?: AbortSignal): Promise<DocxResult<DocxRevision>> {
    if (this.openInProgress) return refused('busy');
    if (!this.isConnected || !this.mount) return refused('invalid-mount');
    if (signal?.aborted) return refused('aborted');
    if (source.kind === 'docx' && source.bytes.byteLength > maxInputBytes) {
      this.reportError('resource-limit');
      return refused('resource-limit');
    }
    if (this.currentSnapshot?.dirty) {
      const priorSession = this.session;
      const priorSnapshot = this.currentSnapshot;
      const priorMount = this.mount;
      const event = this.emit('lr-before-open', {
        kind: source.kind,
        currentRevision: this.currentSnapshot.revision,
      }, { cancelable: true });
      if (event.defaultPrevented) return refused('aborted');
      if (!this.isConnected || this.mount !== priorMount) return refused('destroyed');
      if (this.session !== priorSession || this.currentSnapshot !== priorSnapshot || this.openInProgress)
        return refused('busy');
    }
    this.openInProgress = true;
    this.localError = null;
    this.wasDisconnected = false;
    this.pendingAction = null;
    this.disposeSession();
    this.currentSnapshot = null;
    this.filename = '';
    const created = createDocxSession({
      mount: this.mount,
      readOnly: this.readOnly,
      locale: this.effectiveLocale,
    });
    if (!created.ok) {
      this.openInProgress = false;
      this.reportError(created.code);
      return created;
    }
    const session = created.value;
    this.session = session;
    this.unsubscribeSession = session.subscribe(() => this.syncSession());
    this.syncSession();
    let result: DocxResult<DocxRevision>;
    try { result = await session.open(source, { signal }); }
    catch { result = refused('open-failed'); }
    if (this.session !== session) return refused('destroyed');
    this.openInProgress = false;
    this.syncSession();
    if (result.ok) this.filename = filename;
    else if (result.code === 'aborted') {
      this.disposeSession();
      this.currentSnapshot = null;
    } else if (this.snapshot()?.status !== 'error') this.reportError(result.code);
    return result;
  }

  /** Open caller-owned DOCX bytes or a local file. Replacing dirty content can be vetoed. */
  async open(input: Uint8Array | File, options: { signal?: AbortSignal; name?: string } = {}): Promise<DocxResult<DocxRevision>> {
    const sourceRead = ++this.sourceReadSequence;
    if (input instanceof Uint8Array) {
      this.openingFile = false;
      return this.load({ kind: 'docx', bytes: input }, options.name ?? '', options.signal);
    }
    if (!input || typeof input.arrayBuffer !== 'function') return refused('invalid-option');
    if (input.size > maxInputBytes) {
      this.reportError('resource-limit');
      return refused('resource-limit');
    }
    if (options.signal?.aborted) return refused('aborted');
    this.openingFile = true;
    try {
      const bytes = new Uint8Array(await input.arrayBuffer());
      if (options.signal?.aborted || sourceRead !== this.sourceReadSequence) return refused('aborted');
      return await this.load({ kind: 'docx', bytes }, options.name ?? input.name, options.signal);
    } catch {
      if (options.signal?.aborted || sourceRead !== this.sourceReadSequence) return refused('aborted');
      this.reportError('open-failed');
      return refused('open-failed');
    } finally {
      if (sourceRead === this.sourceReadSequence) this.openingFile = false;
    }
  }

  /** Create a blank document. Replacing dirty content can be vetoed. */
  newDocument(options: { signal?: AbortSignal } = {}): Promise<DocxResult<DocxRevision>> {
    this.sourceReadSequence++;
    this.openingFile = false;
    return this.load({ kind: 'blank' }, '', options.signal);
  }

  can(command: DocxCommand | DocxEdit) {
    return this.session?.can(command) ?? { enabled: false, reason: 'not-ready' as const };
  }

  /** Execute a supported formatting, editing or history command. */
  execute(command: DocxCommand | DocxEdit, options: { expectedRevision?: DocxRevision; selection?: DocxSelectionLease } = {}): DocxResult<DocxRevision> {
    if (!this.session) return refused('not-ready');
    const result = this.session.execute(command, options);
    this.syncSession();
    return result;
  }

  /** Inspect paragraph styles in the open document on demand. */
  paragraphStyles() { return this.session?.paragraphStyles() ?? refused('not-ready'); }

  /** Inspect candidate font families on demand; this does not load font assets. */
  fontFamilies() { return this.session?.fontFamilies() ?? refused('not-ready'); }

  /** Read complete bounded title and description from the settled image cache, without changing selection. */
  imageDescription(): DocxResult<Readonly<DocxImageDescription>> {
    return this.session?.imageDescription() ?? refused('not-ready');
  }

  /** Select an eligible body image in document order, wrapping without changing document content. */
  selectImage(direction: DocxImageDirection): DocxResult<void> {
    const result = this.session?.selectImage(direction) ?? refused<void>('not-ready');
    this.syncSession();
    return result;
  }

  /** Cached advisory caret availability; insertion verifies the package and exact original intent. */
  canInsertImage(): DocxCommandAvailability {
    return this.session?.canInsertImage() ?? { enabled: false, reason: 'not-ready' };
  }

  /** Insert owned raster bytes at the original plain body caret. A committed original result survives replacement. */
  async insertImage(source: DocxImageSource, options?: DocxInsertImageOptions): Promise<DocxResult<DocxRevision>> {
    const owner = this.session;
    if (!owner) return refused('not-ready');
    const result = await owner.insertImage(source, options);
    if (this.session === owner) this.syncSession();
    return result;
  }

  /** Search the current revision without changing document content. */
  find(query: string, options: { matchCase?: boolean; wholeWord?: boolean; limit?: number } = {}) {
    return this.session?.find(query, options) ?? refused('not-ready');
  }

  /** Navigate to a revision-stamped result of the latest search. */
  selectMatch(id: string, options: { expectedRevision?: DocxRevision } = {}) {
    if (!this.session) return refused<void>('not-ready');
    const result = this.session.selectMatch(id, options);
    this.syncSession();
    return result;
  }

  /** Replace one match, including deletion with an empty string. */
  replaceMatch(id: string, text: string, options: { expectedRevision?: DocxRevision } = {}) {
    if (!this.session) return refused<DocxRevision>('not-ready');
    const result = this.session.replaceMatch(id, text, options);
    this.syncSession();
    return result;
  }

  /** Serialize explicitly; persistence is owned by the caller. */
  async save(options: { signal?: AbortSignal; expectedRevision?: DocxRevision } = {}): Promise<DocxResult<DocxSaveReceipt>> {
    if (!this.session) return refused('not-ready');
    const session = this.session;
    const result = await session.save(options);
    if (this.session !== session) return refused('destroyed');
    this.syncSession();
    if (result.ok) {
      this.localError = null;
      this.emit('lr-save', { receipt: result.value });
    }
    else if (this.snapshot()?.status !== 'error' &&
      ['save-failed', 'engine-failed', 'resource-limit'].includes(result.code)) this.reportError(result.code);
    return result;
  }

  /** Mark a genuine save receipt persisted by the host. */
  acknowledgeSaved(receipt: DocxSaveReceipt): DocxResult<void> {
    if (!this.session) return refused('not-ready');
    const result = this.session.acknowledgeSaved(receipt);
    this.syncSession();
    return result;
  }

  /** Return keyboard focus to the editing surface. */
  focusEditor(): DocxResult<void> { return this.session?.focus() ?? refused('not-ready'); }

  private releaseToolbarSelection(): void {
    this.toolbarSelection?.release();
    this.toolbarSelection = null;
  }

  private retainToolbarSelection(): void {
    if (this.toolbarSelection) return;
    const result = this.session?.retainSelection();
    if (result?.ok) this.toolbarSelection = result.value;
  }

  private reportEditRefusal(code: DocxRefusalCode): void {
    this.editError = code;
    this.emit('lr-error', { code });
    if (this.announcementsArmed) this.assertiveSink?.announce(this.localize('docxEditorEditUnavailable'));
  }

  private runEdit(edit: DocxEdit, returnFocus = true): void {
    const lease = this.toolbarSelection;
    this.toolbarSelection = null;
    const result = this.execute(edit, lease ? { selection: lease } : {});
    lease?.release();
    if (result.ok) this.editError = null;
    else this.reportEditRefusal(result.code);
    if (returnFocus) this.focusEditor();
  }

  private loadParagraphStyles(): void {
    this.pickerFocusReturn = false;
    this.retainToolbarSelection();
    const result = this.paragraphStyles();
    if (result.ok) this.paragraphStyleItems = result.value.items;
    else this.reportEditRefusal(result.code);
  }

  private loadFontFamilies(): void {
    this.pickerFocusReturn = false;
    this.retainToolbarSelection();
    const result = this.fontFamilies();
    if (result.ok) this.fontFamilyItems = result.value.items;
    else this.reportEditRefusal(result.code);
  }

  private onParagraphStyleChange(event: CustomEvent<{ value: string | string[] }>): void {
    event.stopPropagation();
    if (typeof event.detail.value === 'string' && event.detail.value) {
      this.pickerFocusReturn = true;
      this.runEdit({ type: 'paragraph-style', styleId: event.detail.value }, false);
    }
  }

  private onFontFamilyChange(event: CustomEvent<{ value: string | string[] }>): void {
    event.stopPropagation();
    if (typeof event.detail.value === 'string' && event.detail.value) {
      this.pickerFocusReturn = true;
      this.runEdit({ type: 'font-family', family: event.detail.value }, false);
    }
  }

  private onFontSizeChange(event: CustomEvent<{ value: string }>): void {
    event.stopPropagation();
    const points = Number(event.detail.value);
    this.runEdit({ type: 'font-size', points });
  }

  private onColorChange(event: Event): void {
    event.stopPropagation();
    const color = (event.currentTarget as HTMLElement & { value: string }).value;
    this.pickerFocusReturn = true;
    this.runEdit({ type: 'text-color', color }, false);
    if (!this.editError) void (event.currentTarget as HTMLElement & { hide(): Promise<void> }).hide();
  }

  private onPickerClosed(): void {
    this.releaseToolbarSelection();
    if (this.pickerFocusReturn) {
      this.pickerFocusReturn = false;
      queueMicrotask(() => { if (this.isConnected) this.focusEditor(); });
    }
  }

  private openLinkEditor(): void {
    this.retainToolbarSelection();
    this.linkHref = '';
    this.linkText = '';
  }

  private closeLinkEditor(returnFocus = true): void {
    const popover = this.renderRoot.querySelector<HTMLElement & { hide(options?: { focusTrigger?: boolean }): Promise<void> }>('[part="link-popover"]');
    void popover?.hide({ focusTrigger: false }).then(() => {
      this.releaseToolbarSelection();
      if (returnFocus) this.focusEditor();
    });
  }

  private applyLink(): void {
    this.runEdit(this.linkEdit(), false);
    if (this.editError === null) this.closeLinkEditor();
  }

  private linkEdit(): DocxEdit {
    const href = this.linkHref.trim();
    const text = this.linkText;
    return text ? { type: 'link', href, text } : { type: 'link', href };
  }

  private refreshTableLabels(): void {
    const session = this.session;
    if (!session) return;
    const row = this.localize('docxEditorTableRowBelow');
    const column = this.localize('docxEditorTableColumnRight');
    const previous = this.tableLabelState;
    if (previous?.session === session && previous.row === row && previous.column === column) return;
    if (refreshInternalDocxTableLabels(session, { insertRowBelow: row, insertColumnRight: column }))
      this.tableLabelState = { session, row, column };
  }

  private tablePopover() {
    return this.renderRoot.querySelector<HTMLElement & { open: boolean; hide(options?: { focusTrigger?: boolean }): Promise<void> }>(
      '[part="table-insert-popover"]');
  }

  private releaseTableIntent(): void {
    this.tableIntent?.release();
    this.tableIntent = null;
  }

  private prepareTableIntent(): void {
    if (this.tableDialogOpen) return;
    this.releaseToolbarSelection();
    this.releaseTableIntent();
    this.tableIntent = captureTableToolIntent(this.session);
  }

  private onTableActivationKey(event: KeyboardEvent): void {
    if ((event.key === 'Enter' || event.key === ' ') && !event.isComposing && event.keyCode !== 229) this.prepareTableIntent();
  }

  private openTableDialog(event: Event): void {
    if (!this.tableIntent?.valid(this.session)) { event.preventDefault(); this.releaseTableIntent(); return; }
    this.tableDialogGeneration++;
    this.cancelTableFocusReturn?.();
    this.tableRows = '2';
    this.tableColumns = '2';
    this.tableDialogOpen = true;
    this.editError = null;
  }

  private onTableDialogHidden(): void {
    if (this.tablePopover()?.open) return;
    this.tableDialogOpen = false;
    this.releaseTableIntent();
  }

  private closeTableDialog(returnToEditor: boolean): void {
    this.cancelTableFocusReturn?.();
    const session = this.session;
    const generation = this.tableDialogGeneration;
    const selectionVersion = session?.snapshot().selection.version;
    const popover = this.tablePopover();
    if (!popover) return;
    const document = this.ownerDocument;
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
      document.removeEventListener('focusin', cancel, true);
      document.removeEventListener('pointerdown', cancel, true);
      if (this.cancelTableFocusReturn === cancel) this.cancelTableFocusReturn = null;
    };
    this.cancelTableFocusReturn = cancel;
    document.addEventListener('focusin', cancel, true);
    document.addEventListener('pointerdown', cancel, true);
    void popover.hide({ focusTrigger: false }).then(() => {
      const shouldFocus = !cancelled && this.isConnected && this.session === session && generation === this.tableDialogGeneration &&
        !popover.open && session?.snapshot().selection.version === selectionVersion;
      cancel();
      if (!shouldFocus) return;
      if (returnToEditor) this.focusEditor();
      else this.renderRoot.querySelector<HTMLElement>('[part="table-insert-trigger"]')?.focus();
    }, cancel);
  }

  private runTableEdit(action: DocxTableAction, fromDialog = false): void {
    const session = this.session;
    const intent = this.tableIntent;
    const result = intent?.execute(session, action) ?? refused<DocxRevision>('stale-selection');
    this.syncSession();
    if (result.ok) {
      this.editError = null;
      if (fromDialog) this.closeTableDialog(true);
      else if (this.isConnected && this.session === session) this.focusEditor();
    } else this.reportEditRefusal(result.code);
    if (!fromDialog) this.releaseTableIntent();
  }

  private insertTable(): void {
    const action = tableInsertDraft(this.tableRows, this.tableColumns);
    if (!action) return;
    this.runTableEdit(action, true);
  }

  private insertionPopover() {
    return this.renderRoot.querySelector<HTMLElement & { open: boolean; show(): Promise<void>; hide(options?: { focusTrigger?: boolean }): Promise<void> }>(
      '[part="image-insert-dialog"]');
  }

  private resetImageInsertion(hide = true): void {
    this.insertionGeneration++;
    this.cancelInsertionFocusReturn?.();
    this.insertionIntent?.release();
    this.insertionIntent = null;
    this.insertionBytes = null;
    this.insertionDefaults = null;
    this.insertionAwaitingPicker = false;
    this.insertionPhase = 'idle';
    this.insertionWidth = '';
    this.insertionHeight = '';
    this.insertionKeepRatio = true;
    this.insertionTitle = '';
    this.insertionDescription = '';
    this.insertionError = null;
    const input = this.renderRoot.querySelector<HTMLInputElement>('[part="image-insert-file"]');
    if (input) input.value = '';
    if (hide) void this.insertionPopover()?.hide({ focusTrigger: false });
  }

  private prepareImageInsertion(): void {
    if (this.insertionPhase !== 'idle') return;
    if (this.insertionIntent?.valid(this.session)) return;
    this.resetImageInsertion(false);
    this.releaseToolbarSelection();
    this.insertionIntent = captureImageInsertionIntent(this.session);
  }

  private onImageInsertionKey(event: KeyboardEvent): void {
    if ((event.key === 'Enter' || event.key === ' ') && !event.isComposing && event.keyCode !== 229)
      this.prepareImageInsertion();
  }

  private openImageInsertionPicker(): void {
    if (this.insertionPhase !== 'idle') return;
    this.prepareImageInsertion();
    if (!this.insertionIntent?.valid(this.session) || !this.canInsertImage().enabled) {
      this.cancelImageInsertion(false); return;
    }
    const input = this.renderRoot.querySelector<HTMLInputElement>('[part="image-insert-file"]');
    if (!input) { this.cancelImageInsertion(false); return; }
    input.value = '';
    this.insertionAwaitingPicker = true;
    this.insertionPhase = 'reading';
    input.click();
  }

  private cancelImageInsertion(returnFocus: boolean): void {
    if (this.insertionPhase === 'dispatched' || (!this.insertionIntent && this.insertionPhase === 'idle')) return;
    const owner = this.session, selectionVersion = owner?.snapshot().selection.version, popover = this.insertionPopover();
    this.resetImageInsertion(false);
    const generation = this.insertionGeneration;
    if (!returnFocus || !popover) { void popover?.hide({ focusTrigger: false }); return; }
    const document = this.ownerDocument;
    let cancelled = false;
    const cancel = () => {
      cancelled = true; document.removeEventListener('focusin', cancel, true); document.removeEventListener('pointerdown', cancel, true);
      if (this.cancelInsertionFocusReturn === cancel) this.cancelInsertionFocusReturn = null;
    };
    this.cancelInsertionFocusReturn = cancel;
    document.addEventListener('focusin', cancel, true); document.addEventListener('pointerdown', cancel, true);
    void popover.hide({ focusTrigger: false }).then(async () => {
      await this.updateComplete;
      if (cancelled || !this.isConnected || this.session !== owner || generation !== this.insertionGeneration || popover.open) {
        cancel(); return;
      }
      const trigger = this.renderRoot.querySelector<LyraElement>('[part="image-insert-trigger"]');
      await trigger?.updateComplete;
      const restore = !cancelled && this.isConnected && this.session === owner && generation === this.insertionGeneration &&
        !popover.open && trigger?.isConnected && this.renderRoot.contains(trigger) &&
        owner?.snapshot().activity === null && owner.snapshot().selection.version === selectionVersion;
      cancel();
      if (restore) trigger.focus();
    }).catch(cancel);
  }

  private onImageInsertionHide(event: Event): void {
    if (this.insertionPhase !== 'reading' && this.insertionPhase !== 'draft') return;
    event.preventDefault();
    const owner = this.session, popover = this.insertionPopover();
    this.resetImageInsertion(false);
    const generation = this.insertionGeneration;
    // End the current lifecycle request before closing with explicit focus ownership.
    queueMicrotask(() => {
      if (this.isConnected && this.session === owner && generation === this.insertionGeneration &&
          popover === this.insertionPopover() && popover?.open) void popover.hide({ focusTrigger: false });
    });
  }

  private handoffImageInsertion(event: Event): void {
    if (this.insertionPhase !== 'reading' && this.insertionPhase !== 'draft') return;
    const otherTool = event.composedPath().some(node => node instanceof HTMLElement && this.renderRoot.contains(node) &&
      node.hasAttribute('data-tool-key') && node.getAttribute('data-tool-key') !== 'image-insert');
    if (otherTool) this.cancelImageInsertion(false);
  }

  private insertionFeedback(code: DocxRefusalCode): string {
    return this.localize(code === 'resource-limit' ? 'docxEditorImageInsertLimit' :
      code === 'invalid-document' ? 'docxEditorImageInsertInvalid' : code === 'unsupported' ? 'docxEditorImageInsertUnsupported' :
        code === 'stale-selection' || code === 'stale-revision' ? 'docxEditorImageInsertStale' : 'docxEditorImageInsertRefused');
  }

  private refuseImageInsertion(code: DocxRefusalCode, owner: DocxSession | null, generation: number): void {
    if (!this.isConnected || this.session !== owner || this.insertionGeneration !== generation) return;
    this.cancelImageInsertion(false);
    if (!this.isConnected || this.session !== owner || this.insertionGeneration !== generation + 1) return;
    this.insertionError = code;
    if (this.announcementsArmed) this.assertiveSink?.announce(this.insertionFeedback(code));
  }

  private readImageInsertionFile = async (event: Event): Promise<void> => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.item(0);
    input.value = '';
    if (!this.insertionAwaitingPicker || this.insertionPhase !== 'reading') return;
    this.insertionAwaitingPicker = false;
    if (!file) { this.cancelImageInsertion(true); return; }
    const owner = this.session, intent = this.insertionIntent, generation = this.insertionGeneration;
    const valid = () => this.isConnected && this.session === owner && this.insertionIntent === intent &&
      this.insertionGeneration === generation && this.insertionPhase === 'reading' && Boolean(intent?.valid(owner));
    try {
      if (!valid()) { this.refuseImageInsertion('stale-selection', owner, generation); return; }
      if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > maxInputBytes) {
        this.refuseImageInsertion('resource-limit', owner, generation); return;
      }
      await this.updateComplete;
      if (!valid()) { this.refuseImageInsertion('stale-selection', owner, generation); return; }
      const popover = this.insertionPopover();
      if (!popover) { this.refuseImageInsertion('not-ready', owner, generation); return; }
      await popover.show();
      if (!valid()) { this.refuseImageInsertion('stale-selection', owner, generation); return; }
      if (!popover.open) { this.cancelImageInsertion(false); return; }
      const buffer = await file.arrayBuffer();
      if (!valid()) { this.refuseImageInsertion('stale-selection', owner, generation); return; }
      if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 1 || buffer.byteLength > maxInputBytes) {
        this.refuseImageInsertion('resource-limit', owner, generation); return;
      }
      const bytes = new Uint8Array(buffer), inspected = inspectDocxImage(bytes);
      if (!inspected.ok) { this.refuseImageInsertion(inspected.code, owner, generation); return; }
      if (inspected.value.hasJpegApp1) { this.refuseImageInsertion('unsupported', owner, generation); return; }
      const defaults = imageInsertionDefaults(inspected.value.pixelWidth, inspected.value.pixelHeight);
      if (!defaults) { this.refuseImageInsertion('invalid-document', owner, generation); return; }
      if (!valid()) { this.refuseImageInsertion('stale-selection', owner, generation); return; }
      this.insertionBytes = bytes;
      this.insertionDefaults = defaults;
      this.insertionWidth = defaults.width;
      this.insertionHeight = defaults.height;
      this.insertionKeepRatio = defaults.ratioAvailable;
      this.insertionTitle = '';
      this.insertionDescription = '';
      this.insertionPhase = 'draft';
      await this.updateComplete;
      const active = this.shadowRoot?.activeElement;
      if (this.isConnected && this.session === owner && generation === this.insertionGeneration && intent?.valid(owner) &&
          this.insertionPhase === 'draft' && popover.open && active?.closest('[part="image-insert-dialog"]') === popover)
        this.renderRoot.querySelector<HTMLElement>('[part="image-insert-width"]')?.focus();
    } catch {
      this.refuseImageInsertion('invalid-document', owner, generation);
    }
  };

  private changeInsertionDimension(event: CustomEvent<{ value: string }>, axis: 'width' | 'height'): void {
    event.stopPropagation();
    const value = event.detail.value;
    if (axis === 'width') this.insertionWidth = value;
    else this.insertionHeight = value;
    if (!this.insertionKeepRatio || !this.insertionDefaults?.ratioAvailable) return;
    const partner = imageRatioPartner(value, axis, this.insertionDefaults.original);
    if (axis === 'width') this.insertionHeight = partner ?? '';
    else this.insertionWidth = partner ?? '';
  }

  private dispatchImageInsertion(): void {
    const owner = this.session, intent = this.insertionIntent, generation = this.insertionGeneration;
    const source = this.insertionBytes && imageInsertionDraft(this.insertionBytes, this.insertionWidth,
      this.insertionHeight, this.insertionTitle, this.insertionDescription);
    if (this.insertionPhase !== 'draft' || !owner || !intent?.valid(owner) || !source || !this.canInsertImage().enabled) return;
    const popover = this.insertionPopover();
    this.insertionPhase = 'dispatched';
    this.insertionIntent = null;
    this.insertionBytes = null;
    this.insertionDefaults = null;
    this.insertionWidth = ''; this.insertionHeight = ''; this.insertionTitle = ''; this.insertionDescription = '';
    const document = this.ownerDocument;
    let focusCancelled = false;
    const cancelFocus = () => {
      focusCancelled = true;
      document.removeEventListener('focusin', cancelFocus, true);
      document.removeEventListener('pointerdown', cancelFocus, true);
      if (this.cancelInsertionFocusReturn === cancelFocus) this.cancelInsertionFocusReturn = null;
    };
    this.cancelInsertionFocusReturn = cancelFocus;
    document.addEventListener('focusin', cancelFocus, true);
    document.addEventListener('pointerdown', cancelFocus, true);
    const pending = intent.dispatch(source);
    void popover?.hide({ focusTrigger: false });
    const complete = (result: DocxResult<DocxRevision>) => {
      const restoreFocus = !focusCancelled;
      cancelFocus();
      if (!this.isConnected || this.session !== owner || this.insertionGeneration !== generation) return;
      this.insertionPhase = 'idle';
      this.insertionError = result.ok ? null : result.code;
      if (this.announcementsArmed) {
        if (result.ok) this.politeSink?.announce(this.localize('docxEditorImageInserted'));
        else this.assertiveSink?.announce(this.insertionFeedback(result.code));
      }
      if (result.ok && restoreFocus && this.isConnected && this.session === owner && this.insertionGeneration === generation) this.focusEditor();
    };
    void pending.then(complete, () => complete(refused('engine-failed')));
  }

  private imagePopover(kind: 'resize' | 'description') {
    return this.renderRoot.querySelector<HTMLElement & { open: boolean; hide(options?: { focusTrigger?: boolean }): Promise<void> }>(
      `[part="image-${kind}-popover"]`);
  }

  private navigateImage(direction: DocxImageDirection): void {
    const result = this.selectImage(direction);
    this.imageNavigationEmpty = !result.ok && result.code === 'no-selection';
    if (result.ok) this.editError = null;
    else if (result.code === 'no-selection') {
      if (this.announcementsArmed) this.politeSink?.announce(this.localize('docxEditorNoImage'));
    } else this.reportEditRefusal(result.code);
  }

  private releaseImageIntent(): void {
    this.imageIntent?.release();
    this.imageIntent = null;
  }

  private prepareImageIntent(): void {
    if (this.imageDialog) return;
    this.releaseToolbarSelection();
    this.releaseImageIntent();
    this.imageIntent = captureImageToolIntent(this.session);
  }

  private onImageActivationKey(event: KeyboardEvent): void {
    if ((event.key === 'Enter' || event.key === ' ') && !event.isComposing && event.keyCode !== 229) this.prepareImageIntent();
  }

  private openImageDialog(event: Event, kind: 'resize' | 'description'): void {
    const intent = this.imageIntent;
    if (!intent?.valid(this.session)) { event.preventDefault(); this.releaseImageIntent(); return; }
    if (kind === 'description') {
      const description = intent.description(this.session);
      if (!description.ok) {
        event.preventDefault(); this.releaseImageIntent(); this.reportEditRefusal(description.code); return;
      }
      this.imageTitle = description.value.title;
      this.imageDescriptionText = description.value.description;
    } else {
      this.imageWidth = imageDimensionDraft(intent.image.widthPoints);
      this.imageHeight = imageDimensionDraft(intent.image.heightPoints);
      this.imageKeepRatio = true;
    }
    this.imageDialogGeneration++;
    this.cancelImageFocusReturn?.();
    this.imageDialog = kind;
    this.editError = null;
  }

  private onImageFieldFocus(event: FocusEvent, insertion = false): void {
    const fields = event.currentTarget;
    const kind = insertion ? 'insert' : this.imageDialog;
    if (!event.isTrusted || !(fields instanceof HTMLElement) || !kind) return;
    const popover = kind === 'insert' ? this.insertionPopover() : this.imagePopover(kind);
    const generation = insertion ? this.insertionGeneration : this.imageDialogGeneration;
    const parts = ['image-width', 'image-height', 'image-ratio', 'image-title', 'image-description',
      'image-resize-apply', 'image-resize-cancel', 'image-description-apply', 'image-description-cancel',
      'image-insert-width', 'image-insert-height', 'image-insert-ratio', 'image-insert-title',
      'image-insert-description', 'image-insert-apply', 'image-insert-cancel'];
    const path = event.composedPath();
    const host = path.find(node => node instanceof HTMLElement && fields.contains(node) &&
      parts.includes(node.getAttribute('part') ?? '')) as HTMLElement | undefined;
    const native = path.find(node => node instanceof HTMLElement) as HTMLElement | undefined;
    const owned = () => {
      let active = this.shadowRoot?.activeElement;
      if (active !== host) return false;
      while (active instanceof HTMLElement && active.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      const current = insertion ? (this.insertionPhase === 'reading' || this.insertionPhase === 'draft') &&
        generation === this.insertionGeneration : this.imageDialog === kind && generation === this.imageDialogGeneration;
      return active === native && this.isConnected && current &&
        popover?.open && fields === popover.querySelector(`[part="image-${kind}-fields"]`);
    };
    if (!host || !native || !owned()) return;
    const content = popover?.shadowRoot?.querySelector<HTMLElement>('[part~="content"]');
    if (!content?.offsetHeight || !content.clientHeight) return;
    const clip = content.getBoundingClientRect();
    const scale = clip.height / content.offsetHeight;
    if (!Number.isFinite(scale) || scale <= 0) return;
    const top = Math.max(0, clip.top + content.clientTop * scale);
    const bottom = Math.min(this.ownerDocument.defaultView?.innerHeight ?? 0,
      clip.top + (content.clientTop + content.clientHeight) * scale);
    const box = host.getBoundingClientRect(), nativeBox = native.getBoundingClientRect();
    const target = box.height <= bottom - top ? box : nativeBox.height <= bottom - top ? nativeBox : null;
    // Oversized controls keep the browser's own caret scrolling.
    if (!target || bottom <= top) return;
    const delta = target.top < top ? target.top - top : target.bottom > bottom ? target.bottom - bottom : 0;
    const next = Math.min(Math.max(0, content.scrollTop + delta / scale), Math.max(0, content.scrollHeight - content.clientHeight));
    if (Number.isFinite(next) && next !== content.scrollTop && owned()) content.scrollTop = next;
  }

  private onImageDialogHidden(kind: 'resize' | 'description'): void {
    if (this.imagePopover(kind)?.open || this.imageDialog !== kind) return;
    this.imageDialog = null;
    this.releaseImageIntent();
  }

  private closeImageDialog(returnToEditor: boolean): void {
    const kind = this.imageDialog;
    if (!kind) return;
    this.cancelImageFocusReturn?.();
    const session = this.session;
    const generation = this.imageDialogGeneration;
    const selectionVersion = session?.snapshot().selection.version;
    const popover = this.imagePopover(kind);
    if (!popover) return;
    const document = this.ownerDocument;
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
      document.removeEventListener('focusin', cancel, true);
      document.removeEventListener('pointerdown', cancel, true);
      if (this.cancelImageFocusReturn === cancel) this.cancelImageFocusReturn = null;
    };
    this.cancelImageFocusReturn = cancel;
    document.addEventListener('focusin', cancel, true);
    document.addEventListener('pointerdown', cancel, true);
    void popover.hide({ focusTrigger: false }).then(() => {
      const shouldFocus = !cancelled && this.isConnected && this.session === session && generation === this.imageDialogGeneration &&
        !popover.open && session?.snapshot().selection.version === selectionVersion;
      cancel();
      if (!shouldFocus) return;
      if (returnToEditor) this.focusEditor();
      else this.renderRoot.querySelector<HTMLElement>(`[part="image-${kind}-trigger"]`)?.focus();
    }, cancel);
  }

  private changeImageDimension(event: CustomEvent<{ value: string }>, axis: 'width' | 'height'): void {
    event.stopPropagation();
    const value = event.detail.value;
    if (axis === 'width') this.imageWidth = value;
    else this.imageHeight = value;
    if (!this.imageKeepRatio || !this.imageIntent) return;
    const partner = imageRatioPartner(value, axis, this.imageIntent.image);
    if (axis === 'width') this.imageHeight = partner ?? '';
    else this.imageWidth = partner ?? '';
  }

  private runImageEdit(action: DocxImageAction, fromDialog = false): void {
    const session = this.session;
    const result = this.imageIntent?.execute(session, action) ?? refused<DocxRevision>('stale-selection');
    this.syncSession();
    if (result.ok) {
      this.editError = null;
      if (fromDialog) this.closeImageDialog(true);
      else if (this.isConnected && this.session === session) this.focusEditor();
    } else this.reportEditRefusal(result.code);
    if (!fromDialog) this.releaseImageIntent();
  }

  private applyImageResize(): void {
    let action = imageResizeDraft(this.imageWidth, this.imageHeight);
    if (!action || !this.imageIntent) return;
    if (imageResizeUnchanged(action, this.imageIntent.image)) action = { type: 'resize-image', ...this.imageIntent.image };
    this.runImageEdit(action, true);
  }

  private applyImageDescription(): void {
    const action = imageDescriptionDraft(this.imageTitle, this.imageDescriptionText);
    if (action) this.runImageEdit(action, true);
  }

  private runFind(): void {
    if (!this.findActionAvailable() || !this.query) return;
    const result = this.find(this.query, { matchCase: this.matchCase, wholeWord: this.wholeWord, limit: 100 });
    if (!result.ok) { this.reportEditRefusal(result.code); return; }
    this.editError = null;
    this.searchResults = result.value;
    this.searchIndex = -1;
    if (this.announcementsArmed) this.politeSink?.announce(this.localize('docxEditorFindCount', undefined,
      { count: result.value.matches.length }));
  }

  private navigateMatch(direction: -1 | 1): void {
    if (!this.findActionAvailable()) return;
    const results = this.searchResults;
    if (!results?.matches.length) return;
    const index = this.searchIndex < 0 && direction === -1 ? results.matches.length - 1 :
      (this.searchIndex + direction + results.matches.length) % results.matches.length;
    const match = results.matches[index];
    if (!match) return;
    const result = this.selectMatch(match.id, { expectedRevision: results.revision });
    if (result.ok) { this.searchIndex = index; this.editError = null; }
    else { this.searchResults = null; this.searchIndex = -1; this.reportEditRefusal(result.code); }
  }

  private replaceCurrentMatch(): void {
    if (!this.findActionAvailable(true)) return;
    const results = this.searchResults;
    const match = results?.matches[this.searchIndex];
    if (!match || !results) return;
    const result = this.replaceMatch(match.id, this.replacement, { expectedRevision: results.revision });
    if (result.ok) {
      this.searchResults = null;
      this.searchIndex = -1;
      this.editError = null;
      if (this.announcementsArmed) this.politeSink?.announce(this.localize('docxEditorReplaced'));
    } else this.reportEditRefusal(result.code);
  }

  private findActionAvailable(replacing = false): boolean {
    const snapshot = this.currentSnapshot;
    return snapshot?.status === 'ready' && !snapshot.composing && snapshot.activity === null &&
      (!replacing || !snapshot.readOnly);
  }

  private onHostKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && !event.isComposing && event.keyCode !== 229 && (this.insertionPhase === 'reading' || this.insertionPhase === 'draft') &&
        event.composedPath().some(node => node instanceof HTMLElement && node.getAttribute('part') === 'image-insert-dialog')) {
      event.preventDefault(); event.stopPropagation(); this.cancelImageInsertion(true); return;
    }
    if (event.key === 'Escape' && this.insertionPhase === 'idle' && this.insertionIntent) this.cancelImageInsertion(false);
    if ((event.key === 'Enter' || event.key === ' ') && !event.isComposing && event.keyCode !== 229) this.handoffImageInsertion(event);
    if (event.altKey && event.key === 'F10') {
      event.preventDefault();
      event.stopPropagation();
      this.retainToolbarSelection();
      const targets = this.enabledToolbarButtons();
      const first = targets[0];
      (first ?? this.renderRoot.querySelector<HTMLElement>('[part="new-button"]'))?.focus();
      if (first) this.toolbarKey = first.getAttribute('data-tool-key') ?? 'bold';
      return;
    }
    if ((event.isComposing || event.keyCode === 229) && event.composedPath().some(node => node instanceof HTMLElement &&
      ['table-insert-popover', 'image-resize-popover', 'image-description-popover', 'image-insert-dialog'].includes(node.getAttribute('part') ?? ''))) return;
    if (event.key === 'Escape' && this.imageDialog && event.composedPath().some(node => node instanceof HTMLElement &&
      node.getAttribute('part') === `image-${this.imageDialog}-popover`)) {
      event.preventDefault(); event.stopPropagation(); this.closeImageDialog(false); return;
    }
    if (event.key === 'Escape' && this.tableDialogOpen && event.composedPath().some(node => node instanceof HTMLElement &&
      node.getAttribute('part') === 'table-insert-popover')) {
      event.preventDefault();
      event.stopPropagation();
      this.closeTableDialog(false);
      return;
    }
    if (event.key === 'Escape' && this.pendingAction) {
      event.preventDefault();
      this.pendingAction = null;
      this.focusEditor();
      return;
    }
    if (event.key === 'Escape' && event.composedPath().some(node => node instanceof HTMLElement &&
      node.getAttribute('part') === 'link-popover')) {
      event.preventDefault();
      this.closeLinkEditor();
      return;
    }
    if (event.key === 'Escape' && this.findOpen && event.composedPath().some(node => node instanceof HTMLElement &&
      node.getAttribute('part') === 'find')) {
      event.preventDefault();
      this.findOpen = false;
      this.focusEditor();
      return;
    }
    if (event.key === 'Escape' && event.composedPath().some(node => node instanceof HTMLElement &&
      ['paragraph-style', 'font-family', 'text-color'].includes(node.getAttribute('part') ?? '') &&
      Boolean((node as HTMLElement & { open?: boolean }).open))) {
      this.pickerFocusReturn = true;
      return;
    }
    const toolbarTarget = event.composedPath().find(node => node instanceof HTMLElement &&
      node.hasAttribute('data-tool-key') && this.renderRoot.contains(node));
    if (toolbarTarget && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      const targets = this.enabledToolbarButtons();
      if (targets.length === 0) return;
      event.preventDefault();
      const current = Math.max(0, targets.indexOf(toolbarTarget as HTMLElement));
      const forward = this.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? targets.length - 1 :
        event.key === forward ? (current + 1) % targets.length : (current - 1 + targets.length) % targets.length;
      const target = targets[next];
      if (target) {
        this.toolbarKey = target.getAttribute('data-tool-key') ?? 'bold';
        target.focus();
      }
      return;
    }
    if (event.key === 'Escape' && this.shadowRoot?.activeElement?.closest('[part="toolbar"]')) {
      event.preventDefault();
      this.releaseToolbarSelection();
      this.focusEditor();
    }
  };

  private onToolbarFocusIn = (event: FocusEvent): void => {
    const target = event.composedPath().find(node => node instanceof HTMLElement &&
      node.hasAttribute('data-tool-key') && this.renderRoot.contains(node)) as HTMLElement | undefined;
    if (target) this.toolbarKey = target.getAttribute('data-tool-key') ?? 'bold';
  };

  private enabledToolbarButtons(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('[data-tool-key]')]
      .filter(button => !button.hasAttribute('disabled') && !button.hidden && !button.inert &&
        !button.closest('[inert]') && button.getAttribute('aria-hidden') !== 'true');
  }

  private runToolbarCommand(command: DocxCommand): void {
    const lease = this.toolbarSelection;
    this.toolbarSelection = null;
    const result = this.execute(command, lease ? { selection: lease } : {});
    lease?.release();
    if (!result.ok && result.code === 'engine-failed') this.reportError(result.code);
    this.focusEditor();
  }

  private openFilePicker(): void {
    this.renderRoot.querySelector<HTMLInputElement>('[part="file-input"]')?.click();
  }

  private requestToolbarAction(action: 'new' | 'open'): void {
    this.releaseToolbarSelection();
    if (this.currentSnapshot?.dirty) {
      this.pendingAction = action;
      void this.updateComplete.then(() => {
        if (this.pendingAction === action) this.renderRoot.querySelector<HTMLElement>('[part="keep-button"]')?.focus();
      });
      return;
    }
    if (action === 'new') {
      const sourceRead = this.sourceReadSequence + 1;
      const pending = this.newDocument();
      void pending.then(async result => {
        await this.updateComplete;
        if (!this.isConnected || sourceRead !== this.sourceReadSequence) return;
        if (result.ok) this.focusEditor();
        else this.renderRoot.querySelector<HTMLElement>('[part="new-button"]')?.focus();
      });
    } else this.openFilePicker();
  }

  private confirmToolbarAction(): void {
    const action = this.pendingAction;
    this.pendingAction = null;
    if (action === 'new') {
      const sourceRead = this.sourceReadSequence + 1;
      const pending = this.newDocument();
      void pending.then(async result => {
        await this.updateComplete;
        if (!this.isConnected || sourceRead !== this.sourceReadSequence) return;
        if (result.ok) this.focusEditor();
        else this.renderRoot.querySelector<HTMLElement>('[part="new-button"]')?.focus();
      });
    } else if (action === 'open') this.openFilePicker();
  }

  private onFileSelected = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.item(0);
    input.value = '';
    if (file) {
      const sourceRead = this.sourceReadSequence + 1;
      const pending = this.open(file);
      void pending.then(async result => {
        await this.updateComplete;
        if (!this.isConnected || sourceRead !== this.sourceReadSequence) return;
        if (result.ok) this.focusEditor();
        else this.renderRoot.querySelector<HTMLElement>('[part="open-button"]')?.focus();
      });
    }
  };

  private statusText(): string {
    const snapshot = this.currentSnapshot;
    if (this.openingFile || snapshot?.status === 'opening') return this.localize('docxEditorOpening');
    if (snapshot?.activity === 'inserting-image') return this.localize('docxEditorInsertingImage');
    if (snapshot?.activity === 'saving') return this.localize('docxEditorSaving');
    if (snapshot?.status === 'error' || this.localError) return this.localize('docxEditorError');
    if (snapshot?.dirty) return this.localize('docxEditorUnsaved');
    if (snapshot?.status === 'ready') return this.localize('docxEditorReady');
    if (this.wasDisconnected) return this.localize('docxEditorDisconnected');
    return this.localize('docxEditorIdle');
  }

  private renderCommand(command: DocxCommand): TemplateResult {
    const availability = this.currentSnapshot?.commands[command];
    const formatting = command !== 'undo' && command !== 'redo';
    const active = availability?.active;
    return html`<${buttonTag}
      part="format-button"
      data-command=${command}
      data-tool-key=${command}
      data-active=${active === true ? 'true' : 'false'}
      size="s"
      appearance=${active === true ? 'filled' : active === 'mixed' ? 'filled-outlined' : 'quiet'}
      ?disabled=${!availability?.enabled}
      tabindex=${availability?.enabled && this.toolbarKey === command ? '0' : '-1'}
      .pressed=${formatting ? active === 'mixed' ? 'mixed' : active === true : null}
      @pointerdown=${() => { if (formatting) this.retainToolbarSelection(); }}
      @click=${() => this.runToolbarCommand(command)}
    >${this.localize(commandLabels[command])}</${buttonTag}>`;
  }

  private renderAlignment(value: typeof alignments[number]): TemplateResult {
    const edit: DocxEdit = { type: 'alignment', value };
    const active = this.currentSnapshot?.formatting.alignment === value;
    const key = `docxEditorAlign${value[0]!.toUpperCase()}${value.slice(1)}`;
    return html`<${buttonTag} part="edit-button" data-edit="alignment" data-value=${value}
      data-tool-key=${`alignment-${value}`}
      size="s" appearance=${active ? 'filled' : 'quiet'} .pressed=${active}
      ?disabled=${!this.can(edit).enabled}
      tabindex=${this.toolbarKey === `alignment-${value}` ? '0' : '-1'}
      @pointerdown=${() => this.retainToolbarSelection()}
      @click=${() => this.runEdit(edit)}>${this.localize(key)}</${buttonTag}>`;
  }

  private renderList(kind: typeof listKinds[number]): TemplateResult {
    const edit: DocxEdit = { type: 'toggle-list', kind };
    const active = kind === 'bullet' ? this.currentSnapshot?.formatting.bulletList :
      this.currentSnapshot?.formatting.numberedList;
    return html`<${buttonTag} part="edit-button" data-edit="toggle-list" data-kind=${kind}
      data-tool-key=${`toggle-list-${kind}`}
      size="s" appearance=${active ? 'filled' : 'quiet'} .pressed=${Boolean(active)}
      ?disabled=${!this.can(edit).enabled}
      tabindex=${this.toolbarKey === `toggle-list-${kind}` ? '0' : '-1'}
      @pointerdown=${() => this.retainToolbarSelection()}
      @click=${() => this.runEdit(edit)}>${this.localize(kind === 'bullet' ? 'docxEditorBullets' : 'docxEditorNumbering')}</${buttonTag}>`;
  }

  private renderEditingTools(): TemplateResult {
    const ready = this.currentSnapshot?.status === 'ready';
    const editable = ready && !this.currentSnapshot?.readOnly && !this.currentSnapshot?.composing &&
      this.currentSnapshot?.activity === null;
    const formatting = this.currentSnapshot?.formatting;
    const color = formatting?.color ?? '';
    return html`<div part="editing-tools" role="group" aria-label=${this.localize('docxEditorFormatting')}>
      <${selectTag} part="paragraph-style" data-edit="paragraph-style" size="s"
        aria-label=${this.localize('docxEditorParagraphStyle')}
        placeholder=${this.localize('docxEditorParagraphStyle')}
        .value=${formatting?.paragraphStyleId ?? ''} ?disabled=${!editable}
        @pointerdown=${() => this.retainToolbarSelection()}
        @lr-show=${() => this.loadParagraphStyles()}
        @lr-after-hide=${() => this.onPickerClosed()}
        @lr-change=${(event: CustomEvent<{ value: string | string[] }>) => this.onParagraphStyleChange(event)}>
        ${formatting?.paragraphStyleId && !this.paragraphStyleItems.some(item => item.id === formatting.paragraphStyleId) ?
          html`<${optionTag} value=${formatting.paragraphStyleId}>${formatting.paragraphStyleId}</${optionTag}>` : nothing}
        ${this.paragraphStyleItems.map(item => html`<${optionTag} value=${item.id}>${item.label}</${optionTag}>`)}
      </${selectTag}>
      <div part="alignment-actions" role="group" aria-label=${this.localize('docxEditorAlignment')}>
        ${alignments.map(value => this.renderAlignment(value))}
      </div>
      <div part="list-actions" role="group" aria-label=${this.localize('docxEditorLists')}>
        ${listKinds.map(kind => this.renderList(kind))}
      </div>
      <${comboboxTag} part="font-family" data-edit="font-family" size="s" allow-custom-value
        aria-label=${this.localize('docxEditorFontFamily')}
        placeholder=${this.localize('docxEditorFontFamily')}
        .value=${formatting?.fontFamily ?? []} ?disabled=${!editable}
        @pointerdown=${() => this.retainToolbarSelection()}
        @lr-show=${() => this.loadFontFamilies()}
        @lr-after-hide=${() => this.onPickerClosed()}
        @lr-change=${(event: CustomEvent<{ value: string | string[] }>) => this.onFontFamilyChange(event)}>
        ${formatting?.fontFamily && !this.fontFamilyItems.includes(formatting.fontFamily) ?
          html`<${optionTag} value=${formatting.fontFamily}>${formatting.fontFamily}</${optionTag}>` : nothing}
        ${this.fontFamilyItems.map(family => html`<${optionTag} value=${family}>${family}</${optionTag}>`)}
      </${comboboxTag}>
      <${numberInputTag} part="font-size" data-edit="font-size" size="s"
        aria-label=${this.localize('docxEditorFontSize')}
        placeholder=${this.localize('docxEditorFontSize')}
        min="1" max="1638" step="0.5" inputmode="decimal"
        .value=${formatting?.fontSizePoints == null ? '' : String(formatting.fontSizePoints)}
        ?disabled=${!editable}
        @pointerdown=${() => this.retainToolbarSelection()}
        @lr-change=${(event: CustomEvent<{ value: string }>) => this.onFontSizeChange(event)}></${numberInputTag}>
      <${colorPickerTag} part="text-color" data-edit="text-color" size="s" format="hex"
        aria-label=${this.localize('docxEditorTextColor')}
        .value=${color} data-color-known=${formatting?.color == null ? 'false' : 'true'} ?disabled=${!editable}
        @pointerdown=${() => this.retainToolbarSelection()}
        @lr-change=${(event: Event) => this.onColorChange(event)}
        @lr-after-hide=${() => this.onPickerClosed()}></${colorPickerTag}>
      ${ready && formatting?.color == null ? html`<span part="color-state">${this.localize('docxEditorColorUnknown')}</span>` : nothing}
      <${buttonTag} part="color-auto" data-edit="text-color-auto" data-tool-key="text-color-auto"
        size="s" appearance="quiet" tabindex=${this.toolbarKey === 'text-color-auto' ? '0' : '-1'}
        ?disabled=${!this.can({ type: 'text-color', color: 'auto' }).enabled}
        @pointerdown=${() => this.retainToolbarSelection()}
        @click=${() => this.runEdit({ type: 'text-color', color: 'auto' })}>${this.localize('docxEditorAutomaticColor')}</${buttonTag}>
      ${this.renderLinkEditor(Boolean(editable))}
      <${buttonTag} part="find-toggle" data-tool-key="find" size="s" appearance=${this.findOpen ? 'filled' : 'quiet'}
        tabindex=${this.toolbarKey === 'find' ? '0' : '-1'}
        .pressed=${this.findOpen} ?disabled=${!ready}
        @click=${() => { this.findOpen = !this.findOpen; if (this.findOpen) void this.updateComplete.then(() =>
          this.renderRoot.querySelector<HTMLElement>('[part="find-query"]')?.focus()); }}>
        ${this.localize('docxEditorFind')}
      </${buttonTag}>
    </div>`;
  }

  private renderLinkEditor(editable: boolean): TemplateResult {
    return html`<${popoverTag} part="link-popover" data-edit="link" popup-role="dialog"
      aria-label=${this.localize('docxEditorLink')}
      @lr-show=${() => this.openLinkEditor()}
      @lr-after-hide=${() => this.releaseToolbarSelection()}>
      <${buttonTag} slot="trigger" part="link-trigger" data-tool-key="link" size="s" appearance="quiet"
        tabindex=${this.toolbarKey === 'link' ? '0' : '-1'}
        ?disabled=${!editable} @pointerdown=${() => this.retainToolbarSelection()}>
        ${this.localize('docxEditorLink')}
      </${buttonTag}>
      <div part="link-fields">
        <${inputTag} part="link-href" type="text" inputmode="url" size="s" label=${this.localize('docxEditorLinkUrl')}
          hint=${this.localize('docxEditorLinkHint')}
          .value=${this.linkHref} @lr-input=${(event: CustomEvent<{ value: string }>) => { this.linkHref = event.detail.value; }}
          @lr-change=${(event: Event) => event.stopPropagation()}></${inputTag}>
        <${inputTag} part="link-text" size="s" label=${this.localize('docxEditorLinkText')}
          .value=${this.linkText} @lr-input=${(event: CustomEvent<{ value: string }>) => { this.linkText = event.detail.value; }}
          @lr-change=${(event: Event) => event.stopPropagation()}></${inputTag}>
        <div part="link-actions">
          <${buttonTag} part="link-apply" size="s" ?disabled=${!this.can(this.linkEdit()).enabled}
            @click=${() => this.applyLink()}>${this.localize('docxEditorApplyLink')}</${buttonTag}>
          <${buttonTag} part="link-remove" data-edit="remove-link" size="s" appearance="quiet"
            ?disabled=${!this.can({ type: 'remove-link' }).enabled}
            @click=${() => { this.runEdit({ type: 'remove-link' }, false); if (!this.editError) this.closeLinkEditor(); }}>
            ${this.localize('docxEditorRemoveLink')}
          </${buttonTag}>
          <${buttonTag} part="link-cancel" size="s" appearance="quiet"
            @click=${() => this.closeLinkEditor()}>${this.localize('docxEditorCancel')}</${buttonTag}>
        </div>
      </div>
    </${popoverTag}>`;
  }

  private renderImageInsertionTools(): TemplateResult {
    const intentValid = this.insertionIntent?.valid(this.session) ?? false;
    const available = this.canInsertImage().enabled;
    const reading = this.insertionPhase === 'reading';
    const draft = this.insertionPhase === 'draft';
    const fieldsDisabled = !draft || !intentValid || !available;
    const source = this.insertionBytes && imageInsertionDraft(this.insertionBytes, this.insertionWidth,
      this.insertionHeight, this.insertionTitle, this.insertionDescription);
    return html`<${popoverTag} part="image-insert-dialog" popup-role="dialog" trigger="manual"
      placement="bottom-start" top-layer aria-label=${this.localize('docxEditorInsertImage')}
      @lr-show=${(event: Event) => {
        if ((!reading && !draft) || !intentValid) event.preventDefault();
      }}
      @lr-hide=${(event: Event) => this.onImageInsertionHide(event)}>
      <${buttonTag} slot="trigger" part="image-insert-trigger" data-tool-key="image-insert" size="s" appearance="quiet" wrap
        tabindex=${this.toolbarKey === 'image-insert' ? '0' : '-1'}
        ?disabled=${!available || this.insertionPhase !== 'idle'}
        @pointerdown=${() => this.prepareImageInsertion()}
        @keydown=${(event: KeyboardEvent) => this.onImageInsertionKey(event)}
        @blur=${() => { if (this.insertionPhase === 'idle') this.cancelImageInsertion(false); }}
        @click=${() => this.openImageInsertionPicker()}>${this.localize('docxEditorInsertImage')}</${buttonTag}>
      <div part="image-insert-fields" @focusin=${(event: FocusEvent) => this.onImageFieldFocus(event, true)}
        @keydown=${(event: KeyboardEvent) => {
          if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229 && event.composedPath().some(node =>
            node instanceof HTMLElement && ['image-insert-width', 'image-insert-height', 'image-insert-title'].includes(node.getAttribute('part') ?? ''))) {
            event.preventDefault(); event.stopPropagation(); this.dispatchImageInsertion();
          }
        }}>
        ${reading ? html`<p part="image-insert-hint">${this.localize('docxEditorReadingImage')}</p>` : nothing}
        ${draft ? html`
          <${numberInputTag} part="image-insert-width" size="s" without-steppers label=${this.localize('docxEditorImageWidth')}
            min="1" max="1440" step="any" inputmode="decimal" .value=${this.insertionWidth} ?disabled=${fieldsDisabled}
            @lr-input=${(event: CustomEvent<{ value: string }>) => this.changeInsertionDimension(event, 'width')}
            @lr-change=${(event: Event) => event.stopPropagation()}></${numberInputTag}>
          <${numberInputTag} part="image-insert-height" size="s" without-steppers label=${this.localize('docxEditorImageHeight')}
            min="1" max="1440" step="any" inputmode="decimal" .value=${this.insertionHeight} ?disabled=${fieldsDisabled}
            @lr-input=${(event: CustomEvent<{ value: string }>) => this.changeInsertionDimension(event, 'height')}
            @lr-change=${(event: Event) => event.stopPropagation()}></${numberInputTag}>
          <${checkboxTag} part="image-insert-ratio" .checked=${this.insertionKeepRatio}
            ?disabled=${fieldsDisabled || !this.insertionDefaults?.ratioAvailable}
            @lr-change=${(event: Event) => {
              event.stopPropagation();
              this.insertionKeepRatio = (event.currentTarget as HTMLElement & { checked: boolean }).checked;
              if (this.insertionKeepRatio && this.insertionDefaults?.ratioAvailable)
                this.insertionHeight = imageRatioPartner(this.insertionWidth, 'width', this.insertionDefaults.original) ?? '';
            }}>${this.localize('docxEditorImageRatio')}</${checkboxTag}>
          <p part="image-insert-hint">${this.localize(!intentValid ? 'docxEditorImageInsertStale' :
            this.insertionDefaults?.ratioAvailable ? 'docxEditorImageInsertSizeHint' : 'docxEditorImageInsertRatioUnavailable')}</p>
          <${inputTag} part="image-insert-title" size="s" label=${this.localize('docxEditorImageTitle')}
            maxlength="256" .value=${this.insertionTitle} ?disabled=${fieldsDisabled}
            @lr-input=${(event: CustomEvent<{ value: string }>) => { event.stopPropagation(); this.insertionTitle = event.detail.value; }}
            @lr-change=${(event: Event) => event.stopPropagation()}></${inputTag}>
          <${textareaTag} part="image-insert-description" size="s" label=${this.localize('docxEditorImageDescription')}
            rows="4" resize="vertical" maxlength="2048" .value=${this.insertionDescription} ?disabled=${fieldsDisabled}
            @lr-input=${(event: CustomEvent<{ value: string }>) => { event.stopPropagation(); this.insertionDescription = event.detail.value; }}
            @lr-change=${(event: Event) => event.stopPropagation()}></${textareaTag}>
          <p part="image-insert-hint">${this.localize('docxEditorImageInsertMetadataHint')}</p>
          <p part="image-insert-hint">${this.localize('docxEditorImageInsertScopeHint')}</p>` : nothing}
        <div part="image-insert-actions">
          ${draft ? html`<${buttonTag} part="image-insert-apply" size="s" wrap ?disabled=${fieldsDisabled || !source}
            @click=${() => this.dispatchImageInsertion()}>${this.localize('docxEditorInsertImage')}</${buttonTag}>` : nothing}
          ${reading || draft ? html`<${buttonTag} part="image-insert-cancel" size="s" appearance="quiet" ?autofocus=${reading}
            @click=${() => this.cancelImageInsertion(true)}>${this.localize('docxEditorCancel')}</${buttonTag}>` : nothing}
        </div>
      </div>
    </${popoverTag}>
    <input part="image-insert-file" type="file" accept=".png,.jpg,.jpeg,.gif,image/png,image/jpeg,image/gif"
      tabindex="-1" aria-hidden="true" @change=${this.readImageInsertionFile}
      @cancel=${() => { if (this.insertionAwaitingPicker) this.cancelImageInsertion(true); }}>
    ${this.insertionError ? html`<p part="image-insert-status">${this.insertionFeedback(this.insertionError)}</p>` : nothing}`;
  }

  private renderTableTools(): TemplateResult {
    const draft = tableInsertDraft(this.tableRows, this.tableColumns);
    const intentValid = this.tableIntent?.valid(this.session) ?? false;
    const table = this.currentSnapshot?.table;
    const number = (value: number) => value.toLocaleString(this.effectiveLocale);
    const context = table ? this.localize('docxEditorTableDimensions', undefined,
      { rows: number(table.rows), columns: number(table.columns) }) : '';
    const cell = table?.rowIndex != null && table.columnIndex != null ? this.localize('docxEditorTableCell', undefined,
      { row: number(table.rowIndex + 1), column: number(table.columnIndex + 1) }) : '';
    return html`<div part="table-tools" role="group" aria-label=${this.localize('docxEditorTable')}>
      <${popoverTag} part="table-insert-popover" popup-role="dialog" placement="bottom-start"
        aria-label=${this.localize('docxEditorInsertTable')}
        @lr-show=${(event: Event) => this.openTableDialog(event)} @lr-after-hide=${() => this.onTableDialogHidden()}>
        <${buttonTag} slot="trigger" part="table-insert-trigger" data-tool-key="table-insert" size="s" appearance="quiet"
          tabindex=${this.toolbarKey === 'table-insert' ? '0' : '-1'}
          ?disabled=${!this.can({ type: 'insert-table', rows: 2, columns: 2 }).enabled}
          @pointerdown=${() => this.prepareTableIntent()} @focusin=${() => this.prepareTableIntent()}
          @keydown=${(event: KeyboardEvent) => this.onTableActivationKey(event)}>${this.localize('docxEditorInsertTable')}</${buttonTag}>
        <div part="table-fields" @keydown=${(event: KeyboardEvent) => {
          if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229 && event.composedPath().some(node => node instanceof HTMLElement &&
              ['table-rows', 'table-columns'].includes(node.getAttribute('part') ?? ''))) {
            event.preventDefault(); event.stopPropagation(); this.insertTable();
          }
        }}>
          <${numberInputTag} part="table-rows" size="s" autofocus label=${this.localize('docxEditorTableRows')}
            min="1" max="20" step="1" .value=${this.tableRows}
            @lr-input=${(event: CustomEvent<{ value: string }>) => { event.stopPropagation(); this.tableRows = event.detail.value; }}
            @lr-change=${(event: Event) => event.stopPropagation()}></${numberInputTag}>
          <${numberInputTag} part="table-columns" size="s" label=${this.localize('docxEditorTableColumns')}
            min="1" max="20" step="1" .value=${this.tableColumns}
            @lr-input=${(event: CustomEvent<{ value: string }>) => { event.stopPropagation(); this.tableColumns = event.detail.value; }}
            @lr-change=${(event: Event) => event.stopPropagation()}></${numberInputTag}>
          <p part="table-hint">${this.localize(this.tableDialogOpen && !intentValid ? 'docxEditorTableStale' : 'docxEditorTableSizeHint')}</p>
          <div part="table-dialog-actions">
            <${buttonTag} part="table-insert-apply" size="s"
              ?disabled=${!intentValid || !draft || !this.can(draft).enabled}
              @click=${() => this.insertTable()}>${this.localize('docxEditorInsertTable')}</${buttonTag}>
            <${buttonTag} part="table-insert-cancel" size="s" appearance="quiet"
              @click=${() => this.closeTableDialog(false)}>${this.localize('docxEditorCancel')}</${buttonTag}>
          </div>
        </div>
      </${popoverTag}>
      ${table ? html`<span part="table-context"><bdi>${context}</bdi> <bdi>${cell}</bdi></span>
        <div part="table-actions">${tableActions.map(([key, action, label]) => html`
          <${buttonTag} part="table-button" data-table-action=${key} data-tool-key=${`table-${key}`} size="s" appearance="quiet"
            tabindex=${this.toolbarKey === `table-${key}` ? '0' : '-1'} ?disabled=${!this.can(action).enabled}
            @pointerdown=${() => this.prepareTableIntent()} @focusin=${() => this.prepareTableIntent()}
            @keydown=${(event: KeyboardEvent) => this.onTableActivationKey(event)}
            @click=${() => this.runTableEdit(action)}>${this.localize(label)}</${buttonTag}>`)}</div>` : nothing}
    </div>`;
  }

  private renderImageTools(): TemplateResult {
    const image = this.currentSnapshot?.image;
    if (this.currentSnapshot?.status !== 'ready' && !this.imageDialog) return html``;
    const navigationDisabled = this.currentSnapshot?.status !== 'ready' || this.currentSnapshot.activity !== null || this.currentSnapshot.composing;
    const intentValid = this.imageIntent?.valid(this.session) ?? false;
    const available = this.can({ type: 'delete-image' }).enabled;
    const fieldsDisabled = !intentValid || !available;
    const resize = imageResizeDraft(this.imageWidth, this.imageHeight);
    const description = imageDescriptionDraft(this.imageTitle, this.imageDescriptionText);
    const dimension = (value: number) => value.toLocaleString(this.effectiveLocale, { maximumFractionDigits: 4 });
    const context = image ? this.localize('docxEditorImageDimensions', undefined,
      { width: dimension(image.widthPoints), height: dimension(image.heightPoints) }) : '';
    return html`<div part="image-tools" role="group" aria-label=${this.localize('docxEditorImage')}>
      <${buttonTag} part="image-previous" data-tool-key="image-previous" size="s" appearance="quiet" wrap
        tabindex=${this.toolbarKey === 'image-previous' ? '0' : '-1'} ?disabled=${navigationDisabled}
        @click=${() => this.navigateImage('previous')}>${this.localize('docxEditorPreviousImage')}</${buttonTag}>
      <${buttonTag} part="image-next" data-tool-key="image-next" size="s" appearance="quiet" wrap
        tabindex=${this.toolbarKey === 'image-next' ? '0' : '-1'} ?disabled=${navigationDisabled}
        @click=${() => this.navigateImage('next')}>${this.localize('docxEditorNextImage')}</${buttonTag}>
      ${this.imageNavigationEmpty ? html`<span part="image-navigation-status">${this.localize('docxEditorNoImage')}</span>` : nothing}
      ${!image && !this.imageDialog ? nothing : html`
      <span part="image-context"><bdi>${context}</bdi></span>
      <${popoverTag} part="image-resize-popover" popup-role="dialog" placement="bottom-start" top-layer
        aria-label=${this.localize('docxEditorResizeImage')}
        @lr-show=${(event: Event) => this.openImageDialog(event, 'resize')}
        @lr-after-hide=${() => this.onImageDialogHidden('resize')}>
        <${buttonTag} slot="trigger" part="image-resize-trigger" data-tool-key="image-resize" size="s" appearance="quiet" wrap
          tabindex=${this.toolbarKey === 'image-resize' ? '0' : '-1'}
          ?disabled=${!available || this.imageDialog === 'description'}
          @pointerdown=${() => this.prepareImageIntent()} @focusin=${() => this.prepareImageIntent()}
          @keydown=${(event: KeyboardEvent) => this.onImageActivationKey(event)}>${this.localize('docxEditorResizeImage')}</${buttonTag}>
        <div part="image-resize-fields" @focusin=${this.onImageFieldFocus} @keydown=${(event: KeyboardEvent) => {
          if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229 && event.composedPath().some(node =>
            node instanceof HTMLElement && ['image-width', 'image-height'].includes(node.getAttribute('part') ?? ''))) {
            event.preventDefault(); event.stopPropagation(); this.applyImageResize();
          }
        }}>
          <${numberInputTag} part="image-width" size="s" autofocus label=${this.localize('docxEditorImageWidth')}
            min="1" max="1440" step="any" inputmode="decimal" without-steppers .value=${this.imageWidth} ?disabled=${fieldsDisabled}
            @lr-input=${(event: CustomEvent<{ value: string }>) => this.changeImageDimension(event, 'width')}
            @lr-change=${(event: Event) => event.stopPropagation()}></${numberInputTag}>
          <${numberInputTag} part="image-height" size="s" label=${this.localize('docxEditorImageHeight')}
            min="1" max="1440" step="any" inputmode="decimal" without-steppers .value=${this.imageHeight} ?disabled=${fieldsDisabled}
            @lr-input=${(event: CustomEvent<{ value: string }>) => this.changeImageDimension(event, 'height')}
            @lr-change=${(event: Event) => event.stopPropagation()}></${numberInputTag}>
          <${checkboxTag} part="image-ratio" size="s" .checked=${this.imageKeepRatio} ?disabled=${fieldsDisabled}
            @lr-change=${(event: CustomEvent<{ checked: boolean }>) => {
              event.stopPropagation(); this.imageKeepRatio = event.detail.checked;
            }}>${this.localize('docxEditorImageRatio')}</${checkboxTag}>
          <p part="image-resize-hint">${this.localize(this.imageDialog === 'resize' && !intentValid ? 'docxEditorImageStale' : 'docxEditorImageSizeHint')}</p>
          <div part="image-resize-actions">
            <${buttonTag} part="image-resize-apply" size="s"
              ?disabled=${!intentValid || !resize || !this.can(resize).enabled}
              @click=${() => this.applyImageResize()}>${this.localize('docxEditorImageApply')}</${buttonTag}>
            <${buttonTag} part="image-resize-cancel" size="s" appearance="quiet"
              @click=${() => this.closeImageDialog(false)}>${this.localize('docxEditorCancel')}</${buttonTag}>
          </div>
        </div>
      </${popoverTag}>
      <${popoverTag} part="image-description-popover" popup-role="dialog" placement="bottom-start" top-layer
        aria-label=${this.localize('docxEditorDescribeImage')}
        @lr-show=${(event: Event) => this.openImageDialog(event, 'description')}
        @lr-after-hide=${() => this.onImageDialogHidden('description')}>
        <${buttonTag} slot="trigger" part="image-description-trigger" data-tool-key="image-description" size="s" appearance="quiet" wrap
          tabindex=${this.toolbarKey === 'image-description' ? '0' : '-1'}
          ?disabled=${!available || this.imageDialog === 'resize'}
          @pointerdown=${() => this.prepareImageIntent()} @focusin=${() => this.prepareImageIntent()}
          @keydown=${(event: KeyboardEvent) => this.onImageActivationKey(event)}>${this.localize('docxEditorDescribeImage')}</${buttonTag}>
        <div part="image-description-fields" @focusin=${this.onImageFieldFocus} @keydown=${(event: KeyboardEvent) => {
          if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229 && event.composedPath().some(node =>
            node instanceof HTMLElement && node.getAttribute('part') === 'image-title')) {
            event.preventDefault(); event.stopPropagation(); this.applyImageDescription();
          }
        }}>
          <${inputTag} part="image-title" size="s" autofocus label=${this.localize('docxEditorImageTitle')}
            maxlength="256" .value=${this.imageTitle} ?disabled=${fieldsDisabled}
            @lr-input=${(event: CustomEvent<{ value: string }>) => { event.stopPropagation(); this.imageTitle = event.detail.value; }}
            @lr-change=${(event: Event) => event.stopPropagation()}></${inputTag}>
          <${textareaTag} part="image-description" size="s" rows="4" resize="vertical" with-count
            label=${this.localize('docxEditorImageDescription')} maxlength="2048" .value=${this.imageDescriptionText}
            ?disabled=${fieldsDisabled}
            @lr-input=${(event: CustomEvent<{ value: string }>) => { event.stopPropagation(); this.imageDescriptionText = event.detail.value; }}
            @lr-change=${(event: Event) => event.stopPropagation()}></${textareaTag}>
          <p part="image-description-hint">${this.localize(this.imageDialog === 'description' && !intentValid ? 'docxEditorImageStale' : 'docxEditorImageDescriptionHint')}</p>
          <div part="image-description-actions">
            <${buttonTag} part="image-description-apply" size="s"
              ?disabled=${!intentValid || !description || !this.can(description).enabled}
              @click=${() => this.applyImageDescription()}>${this.localize('docxEditorImageApply')}</${buttonTag}>
            <${buttonTag} part="image-description-cancel" size="s" appearance="quiet"
              @click=${() => this.closeImageDialog(false)}>${this.localize('docxEditorCancel')}</${buttonTag}>
          </div>
        </div>
      </${popoverTag}>
      <${buttonTag} part="image-delete" data-tool-key="image-delete" size="s" appearance="quiet" wrap
        tabindex=${this.toolbarKey === 'image-delete' ? '0' : '-1'} ?disabled=${!available || this.imageDialog !== null}
        @pointerdown=${() => this.prepareImageIntent()} @focusin=${() => this.prepareImageIntent()}
        @keydown=${(event: KeyboardEvent) => this.onImageActivationKey(event)}
        @click=${() => this.runImageEdit({ type: 'delete-image' })}>${this.localize('docxEditorDeleteImage')}</${buttonTag}>`}
    </div>`;
  }

  private renderFind(): TemplateResult {
    if (!this.findOpen) return html``;
    const results = this.searchResults;
    const count = results?.matches.length ?? 0;
    const available = this.findActionAvailable();
    const replaceAvailable = this.findActionAvailable(true);
    return html`<div part="find" role="search" aria-label=${this.localize('docxEditorFind')}>
      <${inputTag} part="find-query" type="search" size="s" label=${this.localize('docxEditorFindQuery')}
        .value=${this.query} @lr-input=${(event: CustomEvent<{ value: string }>) => {
          this.query = event.detail.value; this.searchResults = null; this.searchIndex = -1;
        }} @lr-change=${(event: Event) => event.stopPropagation()}
        @keydown=${(event: KeyboardEvent) => {
          if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); this.runFind(); }
        }}></${inputTag}>
      <${checkboxTag} part="find-match-case" size="s" .checked=${this.matchCase}
        @lr-change=${(event: CustomEvent<{ checked: boolean }>) => {
          event.stopPropagation(); this.matchCase = event.detail.checked; this.searchResults = null;
        }}>${this.localize('docxEditorMatchCase')}</${checkboxTag}>
      <${checkboxTag} part="find-whole-word" size="s" .checked=${this.wholeWord}
        @lr-change=${(event: CustomEvent<{ checked: boolean }>) => {
          event.stopPropagation(); this.wholeWord = event.detail.checked; this.searchResults = null;
        }}>${this.localize('docxEditorWholeWord')}</${checkboxTag}>
      <${buttonTag} part="find-submit" size="s" appearance="quiet"
        ?disabled=${!this.query || !available}
        @click=${() => this.runFind()}>${this.localize('docxEditorFindSubmit')}</${buttonTag}>
      <span part="find-count">${results ? this.localize('docxEditorFindCount', undefined, { count }) : nothing}
        ${results?.truncated ? this.localize('docxEditorFindTruncated') : nothing}</span>
      <${buttonTag} part="find-previous" size="s" appearance="quiet" ?disabled=${!count || !available}
        @click=${() => this.navigateMatch(-1)}>${this.localize('docxEditorPrevious')}</${buttonTag}>
      <${buttonTag} part="find-next" size="s" appearance="quiet" ?disabled=${!count || !available}
        @click=${() => this.navigateMatch(1)}>${this.localize('docxEditorNext')}</${buttonTag}>
      <${inputTag} part="find-replace" size="s" label=${this.localize('docxEditorReplacement')}
        .value=${this.replacement} ?disabled=${this.currentSnapshot?.readOnly || !count}
        @lr-input=${(event: CustomEvent<{ value: string }>) => { this.replacement = event.detail.value; }}
        @lr-change=${(event: Event) => event.stopPropagation()}></${inputTag}>
      <${buttonTag} part="find-replace-button" size="s" appearance="quiet"
        ?disabled=${!replaceAvailable || this.searchIndex < 0 || !count}
        @click=${() => this.replaceCurrentMatch()}>${this.localize('docxEditorReplace')}</${buttonTag}>
    </div>`;
  }

  override render(): TemplateResult {
    const status = this.statusText();
    const hasError = this.currentSnapshot?.status === 'error' || this.localError !== null;
    return html`
      <section part="base" aria-label=${this.editorLabel()}>
        <div part="toolbar" role="toolbar" aria-label=${this.editorLabel()}
          @focusin=${this.onToolbarFocusIn} @pointerdown=${(event: PointerEvent) => this.handoffImageInsertion(event)}>
          <div part="file-actions">
            <${buttonTag} part="new-button" size="s" appearance="quiet" ?disabled=${this.openInProgress || Boolean(this.currentSnapshot?.activity)}
              @click=${() => this.requestToolbarAction('new')}>${this.localize('docxEditorNew')}</${buttonTag}>
            <${buttonTag} part="open-button" size="s" appearance="quiet" ?disabled=${this.openInProgress || Boolean(this.currentSnapshot?.activity)}
              @click=${() => this.requestToolbarAction('open')}>${this.localize('docxEditorOpen')}</${buttonTag}>
            <${buttonTag} part="save-button" size="s" appearance="quiet"
              ?disabled=${this.currentSnapshot?.status !== 'ready' || this.currentSnapshot.activity !== null}
              @click=${() => { this.releaseToolbarSelection(); void this.save(); }}>${this.localize('docxEditorSave')}</${buttonTag}>
            <input part="file-input" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              tabindex="-1" aria-hidden="true" @change=${this.onFileSelected}>
          </div>
          <div part="format-actions">${commands.map(command => this.renderCommand(command))}</div>
          ${this.renderEditingTools()}
          ${this.renderImageInsertionTools()}
          ${this.renderTableTools()}
          ${this.renderImageTools()}
        </div>
        ${this.pendingAction ? html`
          <div part="confirm" role="group" aria-label=${this.localize('docxEditorDiscardQuestion')}>
            <span>${this.localize('docxEditorDiscardQuestion')}</span>
            <${buttonTag} part="discard-button" size="s" variant="danger" appearance="quiet"
              @click=${this.confirmToolbarAction}>${this.localize('docxEditorDiscard')}</${buttonTag}>
            <${buttonTag} part="keep-button" size="s" appearance="quiet"
              @click=${() => { this.pendingAction = null; this.focusEditor(); }}>${this.localize('docxEditorKeep')}</${buttonTag}>
          </div>
        ` : nothing}
        ${this.renderFind()}
        <div part="document" role="region" tabindex="0" aria-label=${this.editorLabel()}><slot name="document"></slot></div>
        ${hasError ? html`<p part="error">${this.localize('docxEditorError')}</p>` : nothing}
        ${this.editError ? html`<p part="edit-error">${this.localize('docxEditorEditUnavailable')}</p>` : nothing}
        <div part="status">
          <span part="filename">${this.filename || this.localize('docxEditorUntitled')}</span>
          <span part="state">${status}</span>
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-docx-editor': LyraDocxEditor;
  }
}
