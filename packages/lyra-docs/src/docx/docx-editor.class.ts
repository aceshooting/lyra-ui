import { nothing, type PropertyValues, type TemplateResult } from 'lit';
import { html, unsafeStatic } from 'lit/static-html.js';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '@aceshooting/lyra-ui/utilities/lyra-element.js';
import { resolveLyraScopedString } from '@aceshooting/lyra-ui/localization.js';
import { tag } from '@aceshooting/lyra-ui/utilities/prefix.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '@aceshooting/lyra-ui/utilities/announcer.js';
import { createDocxSession } from './create-session.js';
import type {
  DocxCommand, DocxRefusalCode, DocxResult, DocxRevision, DocxSaveReceipt,
  DocxSelectionLease, DocxSession, DocxSnapshot, DocxSource,
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
const maxInputBytes = 4 * 1024 * 1024;
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
 * @csspart base - The root editor surface.
 * @csspart toolbar - File and formatting controls.
 * @csspart file-actions - New, Open and Save controls.
 * @csspart new-button - Creates a blank document.
 * @csspart open-button - Opens the local file picker.
 * @csspart save-button - Requests explicit serialization.
 * @csspart file-input - Native local DOCX file picker.
 * @csspart format-actions - Formatting and history controls.
 * @csspart format-button - One formatting or history control, identified by data-command.
 * @csspart confirm - Dirty document replacement confirmation.
 * @csspart discard-button - Confirms replacement of unsaved content.
 * @csspart keep-button - Cancels replacement of unsaved content.
 * @csspart document - Scrollable engine surface.
 * @csspart error - Localized load or save failure.
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
  @state() private toolbarIndex = 0;

  private mount: HTMLDivElement | null = null;
  private session: DocxSession | null = null;
  private unsubscribeSession: (() => void) | null = null;
  private toolbarSelection: DocxSelectionLease | null = null;
  private openInProgress = false;
  private sourceReadSequence = 0;
  private politeSink: AnnouncementSink | null = null;
  private assertiveSink: AnnouncementSink | null = null;
  private announcementsArmed = false;

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
    this.localError = null;
    this.wasDisconnected = true;
    this.pendingAction = null;
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
    if (this.mount) {
      this.mount.setAttribute('aria-label', this.editorLabel());
      this.mount.title = this.localize('docxEditorShortcut');
    }
    if (!this.announcementsArmed && this.wasDisconnected)
      this.politeSink?.announce(this.localize('docxEditorDisconnected'));
    this.announcementsArmed = true;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('currentSnapshot')) {
      const enabled = commands.filter(command => this.currentSnapshot?.commands[command].enabled);
      if (enabled.length > 0 && !enabled.includes(commands[this.toolbarIndex]!))
        this.toolbarIndex = commands.indexOf(enabled[0]!);
    }
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
  }

  private syncSession(): void {
    if (!this.session) return;
    const previous = this.currentSnapshot;
    const next = this.session.snapshot();
    if (next === previous) return;
    this.currentSnapshot = next;
    this.emit('lr-change', { snapshot: next });
    if (this.announcementsArmed && next.status === 'opening' && previous?.status !== 'opening')
      this.politeSink?.announce(this.localize('docxEditorOpening'));
    if (this.announcementsArmed && next.activity === 'saving' && previous?.activity !== 'saving')
      this.politeSink?.announce(this.localize('docxEditorSaving'));
    if (next.status === 'ready' && previous?.status !== 'ready' && next.revision)
      this.emit('lr-ready', { revision: next.revision });
    if (this.announcementsArmed && next.status === 'ready' && previous?.status !== 'ready')
      this.politeSink?.announce(this.localize('docxEditorReady'));
    if (this.announcementsArmed && next.dirty && !previous?.dirty && next.status === 'ready')
      this.politeSink?.announce(this.localize('docxEditorUnsaved'));
    if (next.selection.version !== previous?.selection.version || next.selection.kind !== previous?.selection.kind)
      this.emit('lr-selection-change', { selection: next.selection });
    if (next.status === 'error' && next.error?.code && (previous?.status !== 'error' || previous.error?.code !== next.error.code))
      this.emit('lr-error', { code: next.error.code });
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

  can(command: DocxCommand) {
    return this.session?.can(command) ?? { enabled: false, reason: 'not-ready' as const };
  }

  /** Execute one currently supported editing or history command. */
  execute(command: DocxCommand, options: { expectedRevision?: DocxRevision; selection?: DocxSelectionLease } = {}): DocxResult<DocxRevision> {
    if (!this.session) return refused('not-ready');
    const result = this.session.execute(command, options);
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
    this.releaseToolbarSelection();
    const result = this.session?.retainSelection();
    if (result?.ok) this.toolbarSelection = result.value;
  }

  private onHostKeyDown = (event: KeyboardEvent): void => {
    if (event.altKey && event.key === 'F10') {
      event.preventDefault();
      this.retainToolbarSelection();
      const targets = this.enabledToolbarButtons();
      const first = targets[0];
      (first ?? this.renderRoot.querySelector<HTMLElement>('[part="new-button"]'))?.focus();
      if (first) this.toolbarIndex = commands.indexOf(first.getAttribute('data-command') as DocxCommand);
      return;
    }
    if (event.key === 'Escape' && this.pendingAction) {
      event.preventDefault();
      this.pendingAction = null;
      this.focusEditor();
      return;
    }
    const formatTarget = event.composedPath().find(node => node instanceof HTMLElement &&
      node.getAttribute('part') === 'format-button' && this.renderRoot.contains(node));
    if (formatTarget && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      const targets = this.enabledToolbarButtons();
      if (targets.length === 0) return;
      event.preventDefault();
      const current = Math.max(0, targets.indexOf(formatTarget as HTMLElement));
      const forward = this.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? targets.length - 1 :
        event.key === forward ? (current + 1) % targets.length : (current - 1 + targets.length) % targets.length;
      const target = targets[next];
      if (target) {
        this.toolbarIndex = commands.indexOf(target.getAttribute('data-command') as DocxCommand);
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

  private enabledToolbarButtons(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('[part="format-button"]')]
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
    if (action === 'new') void this.newDocument().then(result => {
      if (result.ok) this.focusEditor();
      else this.renderRoot.querySelector<HTMLElement>('[part="new-button"]')?.focus();
    });
    else this.openFilePicker();
  }

  private confirmToolbarAction(): void {
    const action = this.pendingAction;
    this.pendingAction = null;
    if (action === 'new') void this.newDocument().then(result => {
      if (result.ok) this.focusEditor();
      else this.renderRoot.querySelector<HTMLElement>('[part="new-button"]')?.focus();
    });
    else if (action === 'open') this.openFilePicker();
  }

  private onFileSelected = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.item(0);
    input.value = '';
    if (file) void this.open(file).then(result => {
      if (result.ok) this.focusEditor();
      else this.renderRoot.querySelector<HTMLElement>('[part="open-button"]')?.focus();
    });
  };

  private statusText(): string {
    const snapshot = this.currentSnapshot;
    if (this.openingFile || snapshot?.status === 'opening') return this.localize('docxEditorOpening');
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
      data-active=${active === true ? 'true' : 'false'}
      size="s"
      appearance=${active === true ? 'filled' : active === 'mixed' ? 'filled-outlined' : 'quiet'}
      ?disabled=${!availability?.enabled}
      tabindex=${availability?.enabled && this.toolbarIndex === commands.indexOf(command) ? '0' : '-1'}
      .pressed=${formatting ? active === 'mixed' ? 'mixed' : active === true : null}
      @pointerdown=${() => { if (formatting) this.retainToolbarSelection(); }}
      @click=${() => this.runToolbarCommand(command)}
    >${this.localize(commandLabels[command])}</${buttonTag}>`;
  }

  override render(): TemplateResult {
    const status = this.statusText();
    const hasError = this.currentSnapshot?.status === 'error' || this.localError !== null;
    return html`
      <section part="base" aria-label=${this.editorLabel()}>
        <div part="toolbar" role="toolbar" aria-label=${this.editorLabel()}>
          <div part="file-actions">
            <${buttonTag} part="new-button" size="s" appearance="quiet" ?disabled=${this.openInProgress}
              @click=${() => this.requestToolbarAction('new')}>${this.localize('docxEditorNew')}</${buttonTag}>
            <${buttonTag} part="open-button" size="s" appearance="quiet" ?disabled=${this.openInProgress}
              @click=${() => this.requestToolbarAction('open')}>${this.localize('docxEditorOpen')}</${buttonTag}>
            <${buttonTag} part="save-button" size="s" appearance="quiet"
              ?disabled=${this.currentSnapshot?.status !== 'ready' || this.currentSnapshot.activity === 'saving'}
              @click=${() => { this.releaseToolbarSelection(); void this.save(); }}>${this.localize('docxEditorSave')}</${buttonTag}>
            <input part="file-input" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              tabindex="-1" aria-hidden="true" @change=${this.onFileSelected}>
          </div>
          <div part="format-actions">${commands.map(command => this.renderCommand(command))}</div>
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
        <div part="document"><slot name="document"></slot></div>
        ${hasError ? html`<p part="error">${this.localize('docxEditorError')}</p>` : nothing}
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
