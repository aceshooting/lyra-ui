import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { trueDefaultSpellcheckConverter as spellcheckConverter } from '../../../internal/converters.js';
import { chevronIcon } from '../../../internal/icons.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraTextWrap } from '../../../internal/shared-unions.js';
import type { ChatMessageRole } from '../../conversation/chat-message/chat-message.class.js';
import { styles } from './prompt-studio.styles.js';
import { overallSemanticLabel } from '../semantic-owner.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_moveDown, LYRA_DEFAULT_moveUp, LYRA_DEFAULT_promptStudioAddMessage, LYRA_DEFAULT_promptStudioLabel, LYRA_DEFAULT_promptStudioMessageContent, LYRA_DEFAULT_promptStudioMessageRole, LYRA_DEFAULT_promptStudioMessages, LYRA_DEFAULT_promptStudioPreview, LYRA_DEFAULT_promptStudioPreviewLimit, LYRA_DEFAULT_promptStudioRemoveMessage, LYRA_DEFAULT_promptStudioRoleAssistant, LYRA_DEFAULT_promptStudioRoleSystem, LYRA_DEFAULT_promptStudioRoleTool, LYRA_DEFAULT_promptStudioRoleUser, LYRA_DEFAULT_promptStudioRun, LYRA_DEFAULT_promptStudioSave, LYRA_DEFAULT_promptStudioVariableName, LYRA_DEFAULT_promptStudioVariableValue, LYRA_DEFAULT_promptStudioVariables, LYRA_DEFAULT_promptStudioVersions } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** Conversation message roles plus the tool-result role needed by prompt authoring. */
export type PromptStudioRole = ChatMessageRole | 'tool';
/** Retained name for the shared native `<textarea wrap>` vocabulary. */
export type PromptStudioWrap = LyraTextWrap;
export interface PromptStudioMessage {
  id: string;
  role: PromptStudioRole;
  content: string;
  name?: string;
}
export interface PromptStudioVariable {
  name: string;
  value: string;
  description?: string;
}
export interface PromptStudioVersion {
  id: string;
  label: string;
  messages: readonly PromptStudioMessage[];
  variables?: readonly PromptStudioVariable[];
  createdAt?: string;
}
export interface PromptStudioState {
  messages: PromptStudioMessage[];
  variables: PromptStudioVariable[];
}
export interface PromptStudioMessageReorderDetail {
  readonly messages: readonly PromptStudioMessage[];
  readonly messageId: string;
  readonly fromIndex: number;
  readonly toIndex: number;
}
export interface LyraPromptStudioEventMap {
  focus: CustomEvent<null>;
  blur: CustomEvent<null>;
  'lr-change': CustomEvent<LyraEventDetailSnapshot<PromptStudioState>>;
  'lr-message-reorder': CustomEvent<LyraEventDetailSnapshot<PromptStudioMessageReorderDetail>>;
  'lr-run': CustomEvent<LyraEventDetailSnapshot<PromptStudioState>>;
  'lr-save': CustomEvent<LyraEventDetailSnapshot<PromptStudioState>>;
  'lr-version-select': CustomEvent<LyraEventDetailSnapshot<{ version: PromptStudioVersion }>>;
}

type PromptStudioMessageMovePart = 'move-message-up' | 'move-message-down';

const PREVIEW_MAX_DEPTH = 64;
const PREVIEW_MAX_SUBSTITUTIONS = 10_000;
const PREVIEW_MAX_TEXT_LENGTH = 1_048_576;

/**
 * `<lr-prompt-studio>` — a provider-neutral prompt-development workbench for ordered role
 * messages, `{{variable}}` substitution, version selection, preview, save, and run intents.
 * The host owns persistence and model execution. Opting into message reordering exposes native,
 * keyboard-operable move controls; every proposed move is cancelable before the editor state changes.
 * Empty/blank message and version ids are omitted; duplicates use deterministic first-wins
 * semantics. Variable rows are
 * occurrence-addressed because their names are editable and may temporarily be empty or repeated;
 * duplicate names remain independently editable while placeholder resolution uses the first one.
 * Variable values resolve recursively; undefined and cyclic placeholders remain intact within
 * preview bounds. One preview projection allows at most 64 nested variable resolutions, 10,000
 * placeholder substitutions, and 1,048,576 UTF-16 code units each of aggregate preview output and
 * aggregate memoized intermediate text. A localized visible fallback replaces the preview when
 * a limit would be exceeded; raw editor state and save/run payloads are unchanged.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 *
 * @customElement lr-prompt-studio
 * @event lr-change - A cancelable proposal that messages or variables are about to change.
 *   Carries their complete next state. Prevent it to keep the current state unchanged, the same
 *   veto point `lr-message-reorder` already offers for reordering.
 * @event lr-message-reorder - A cancelable request to reorder messages. Carries the proposed
 *   complete message order and the moved message's id and indexes. Prevent it to persist or reject
 *   the proposed order yourself, then assign `messages` when the host is ready to render it.
 * @event lr-run - The current prompt was requested for execution.
 * @event lr-save - The current prompt was requested for persistence.
 * @event lr-version-select - A complete saved version was activated.
 * @event focus - Re-dispatched when the message role selector, textarea, or a variable input receives focus,
 *   since native focus neither bubbles nor crosses the shadow boundary.
 * @event blur - Re-dispatched when the message textarea or a variable input loses focus.
 * @csspart base - The named studio region.
 * @csspart toolbar - Save/run controls.
 * @csspart editor - Messages and variables workspace.
 * @csspart messages - Ordered prompt-message editor.
 * @csspart message - One prompt message.
 * @csspart message-role - A message role selector.
 * @csspart message-content - A message textarea. It deliberately keeps native vertical resizing;
 *   configurable `resize` and auto-grow behavior are intentionally omitted.
 * @csspart message-actions - Reorder and removal actions for one message, when reordering is enabled.
 * @csspart move-message-up - A move-message-up action.
 * @csspart move-message-down - A move-message-down action.
 * @csspart remove-message - A message removal action.
 * @csspart add-message - The add-message action.
 * @csspart variables - Variable editor.
 * @csspart variable - One variable row.
 * @csspart versions - Saved-version controls.
 * @csspart version - One saved version.
 * @csspart preview - Resolved read-only preview.
 * @csspart save - The save action.
 * @csspart run - The run action.
 * @cssprop [--lr-prompt-studio-field-hover-border=var(--lr-color-brand)] - Enabled field hover border.
 * @cssprop [--lr-prompt-studio-version-selected-border=var(--lr-color-brand)] - Selected version border.
 * @cssprop [--lr-prompt-studio-version-selected-bg=var(--lr-color-brand-quiet)] - Selected version background.
 * @cssprop [--lr-prompt-studio-version-selected-color=var(--lr-color-text)] - Selected version foreground.
 * @cssprop [--lr-prompt-studio-version-selected-hover-bg=color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-hover))] - Selected version hover background.
 * @status stable
 * @since 7.0.0
 */
export class LyraPromptStudio extends LyraElement<LyraPromptStudioEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    moveDown: LYRA_DEFAULT_moveDown,
    moveUp: LYRA_DEFAULT_moveUp,
    promptStudioAddMessage: LYRA_DEFAULT_promptStudioAddMessage,
    promptStudioLabel: LYRA_DEFAULT_promptStudioLabel,
    promptStudioMessageContent: LYRA_DEFAULT_promptStudioMessageContent,
    promptStudioMessageRole: LYRA_DEFAULT_promptStudioMessageRole,
    promptStudioMessages: LYRA_DEFAULT_promptStudioMessages,
    promptStudioPreview: LYRA_DEFAULT_promptStudioPreview,
    promptStudioPreviewLimit: LYRA_DEFAULT_promptStudioPreviewLimit,
    promptStudioRemoveMessage: LYRA_DEFAULT_promptStudioRemoveMessage,
    promptStudioRoleAssistant: LYRA_DEFAULT_promptStudioRoleAssistant,
    promptStudioRoleSystem: LYRA_DEFAULT_promptStudioRoleSystem,
    promptStudioRoleTool: LYRA_DEFAULT_promptStudioRoleTool,
    promptStudioRoleUser: LYRA_DEFAULT_promptStudioRoleUser,
    promptStudioRun: LYRA_DEFAULT_promptStudioRun,
    promptStudioSave: LYRA_DEFAULT_promptStudioSave,
    promptStudioVariableName: LYRA_DEFAULT_promptStudioVariableName,
    promptStudioVariableValue: LYRA_DEFAULT_promptStudioVariableValue,
    promptStudioVariables: LYRA_DEFAULT_promptStudioVariables,
    promptStudioVersions: LYRA_DEFAULT_promptStudioVersions,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze(['messages', 'variables', 'versions']);

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-change',
    'lr-message-reorder',
    'lr-run',
    'lr-save',
    'lr-version-select',
  ]);

  /** Host-controlled messages; a runtime non-array value renders as not-yet-loaded empty data. */
  @property({ attribute: false }) messages: readonly PromptStudioMessage[] = [];
  /** Host-controlled variables; a runtime non-array value renders as not-yet-loaded empty data. */
  @property({ attribute: false }) variables: readonly PromptStudioVariable[] = [];
  /** Host-controlled saved versions; a runtime non-array value renders as not-yet-loaded empty data. */
  @property({ attribute: false }) versions: readonly PromptStudioVersion[] = [];
  @property({ attribute: 'selected-version-id' }) selectedVersionId: string | null = null;
  /** Accessible name for the studio region. It is independent from the visible `heading`; when
   * absent, the heading text names the region. A host `aria-label` remains authoritative. */
  @property() label = '';
  /** Visible toolbar heading. Falls back to the localized “Prompt studio” string. */
  @property() heading = '';
  @property({ type: Boolean, reflect: true }) running = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  /** Opts into native move-up/move-down buttons for each message. A move first emits the
   * cancelable `lr-message-reorder` request, so a host that needs asynchronous persistence can
   * prevent it and later assign its accepted message order. */
  @property({ type: Boolean, reflect: true }) reorderable = false;
  /** Native editing-assistance attributes forwarded to the message textarea and variable inputs. */
  @property({ converter: spellcheckConverter }) override spellcheck = true;
  @property() override autocapitalize = '';
  /** Named `autoCorrect` to avoid the boolean `HTMLElement.autocorrect` DOM typing collision while
   * preserving the native lowercase `autocorrect` attribute. */
  @property({ attribute: 'autocorrect' }) autoCorrect = '';
  /** Native `<textarea>` wrapping mode. Variable `<input>` controls do not support `wrap`. */
  @property() wrap: PromptStudioWrap = 'soft';
  /** The moved row's next usable action. Lit retains keyed rows but native button focus is not
   * preserved when their position changes, so restore it after the new boundary state renders. */
  private pendingMessageMoveFocus?: { messageId: string; part: PromptStudioMessageMovePart };

  override disconnectedCallback(): void {
    this.pendingMessageMoveFocus = undefined;
    super.disconnectedCallback();
  }

  private roleLabel(role: PromptStudioRole): string {
    switch (role) {
      case 'system':
        return this.localize('promptStudioRoleSystem');
      case 'user':
        return this.localize('promptStudioRoleUser');
      case 'assistant':
        return this.localize('promptStudioRoleAssistant');
      case 'tool':
        return this.localize('promptStudioRoleTool');
    }
  }

  private state(): PromptStudioState {
    return {
      messages: this.uniqueMessages().map((message) => ({ ...message })),
      variables: this.variableItems().map((variable) => ({ ...variable })),
    };
  }

  private messageItems(source: unknown = this.messages): readonly PromptStudioMessage[] {
    return Array.isArray(source) ? source : [];
  }

  private variableItems(source: unknown = this.variables): readonly PromptStudioVariable[] {
    return Array.isArray(source) ? source : [];
  }

  private uniqueMessages(source: unknown = this.messages): PromptStudioMessage[] {
    const seen = new Set<string>();
    return this.messageItems(source).filter((message) => {
      if (!message || typeof message.id !== 'string' || message.id.trim().length === 0 || seen.has(message.id)) return false;
      seen.add(message.id);
      return true;
    });
  }

  private uniqueVersions(): PromptStudioVersion[] {
    const seen = new Set<string>();
    return (Array.isArray(this.versions) ? this.versions : []).filter((version) => {
      if (!version || typeof version.id !== 'string' || version.id.trim().length === 0 || seen.has(version.id)) return false;
      seen.add(version.id);
      return true;
    });
  }

  private emitChange(messages = this.messages, variables = this.variables): void {
    this.emitNormalizedChange(this.uniqueMessages(messages), variables);
  }

  private emitNormalizedChange(
    messages: readonly PromptStudioMessage[],
    variables = this.variables,
  ): void {
    // The proposal is a snapshot, mirroring requestMessageMove()'s identical cancelable-veto
    // pattern below: a listener may hold, persist, or alter its own copy without mutating the
    // component's accepted next state behind the veto point.
    const proposal: PromptStudioState = {
      messages: messages.map((message) => ({ ...message })),
      variables: this.variableItems(variables).map((variable) => ({ ...variable })),
    };
    if (this.emit('lr-change', proposal, { cancelable: true }).defaultPrevented) return;
    this.messages = proposal.messages;
    this.variables = proposal.variables;
  }

  private updateMessage(id: string, patch: Partial<PromptStudioMessage>): void {
    let found = false;
    this.emitNormalizedChange(this.uniqueMessages().map((message) => {
      if (!found && message.id === id) {
        found = true;
        return { ...message, ...patch };
      }
      return message;
    }));
  }

  private removeMessage(id: string): void {
    let removed = false;
    this.emitNormalizedChange(this.uniqueMessages().filter((message) => {
      if (!removed && message.id === id) {
        removed = true;
        return false;
      }
      return true;
    }));
  }

  private addMessage(): void {
    const messages = this.uniqueMessages();
    const existingIds = new Set(messages.map((message) => message.id));
    const base = `message-${Date.now()}-${messages.length}`;
    let id = base;
    let suffix = 1;
    while (existingIds.has(id)) {
      id = `${base}-${suffix}`;
      suffix++;
    }
    this.emitNormalizedChange([...messages, { id, role: 'user', content: '' }]);
  }

  private updateVariable(index: number, patch: Partial<PromptStudioVariable>): void {
    this.emitChange(
      this.messages,
      this.variableItems().map((variable, candidateIndex) =>
        candidateIndex === index ? { ...variable, ...patch } : variable),
    );
  }

  private requestMessageMove(messageId: string, fromIndex: number, offset: -1 | 1): void {
    const messages = this.uniqueMessages();
    const toIndex = fromIndex + offset;
    if (
      this.disabled ||
      !this.reorderable ||
      toIndex < 0 ||
      toIndex >= messages.length ||
      messages[fromIndex]?.id !== messageId
    ) {
      return;
    }

    const nextMessages = messages.map((message) => ({ ...message }));
    const [moved] = nextMessages.splice(fromIndex, 1);
    if (!moved) return;
    nextMessages.splice(toIndex, 0, moved);
    const event = this.emit(
      'lr-message-reorder',
      {
        // The proposal is a snapshot: a listener may hold, persist, or alter its own copy without
        // mutating the component's accepted next state behind the cancelable veto point.
        messages: nextMessages.map((message) => ({ ...message })),
        messageId,
        fromIndex,
        toIndex,
      },
      { cancelable: true },
    );
    if (event.defaultPrevented) return;
    // A move onto its directional boundary disables the action that initiated it. Keep keyboard
    // focus on the same message by using the other still-enabled move action in that case.
    const part: PromptStudioMessageMovePart =
      toIndex === 0
        ? 'move-message-down'
        : toIndex === nextMessages.length - 1
          ? 'move-message-up'
          : offset < 0
            ? 'move-message-up'
            : 'move-message-down';
    this.pendingMessageMoveFocus = { messageId, part };
    this.emitNormalizedChange(nextMessages);
    this.scheduleAfterUpdate(() => this.restoreMessageMoveFocus(), 'prompt-studio-message-reorder-focus');
  }

  private restoreMessageMoveFocus(): void {
    const pending = this.pendingMessageMoveFocus;
    this.pendingMessageMoveFocus = undefined;
    if (!pending || !this.isConnected) return;
    const rows = this.shadowRoot?.querySelectorAll<HTMLElement>('[data-message-id]') ?? [];
    const row = [...rows].find(
      (candidate) => candidate.dataset['messageId'] === pending.messageId,
    );
    const action = row?.querySelector<HTMLButtonElement>(`[part='${pending.part}']`);
    if (action && !action.disabled) action.focus();
  }

  private resolvePreviews(
    messages: readonly PromptStudioMessage[],
    variableItems: readonly PromptStudioVariable[],
  ): string[] | null {
    const variables = new Map<string, string>();
    for (const variable of variableItems) {
      if (variable.name !== '' && !variables.has(variable.name)) variables.set(variable.name, variable.value);
    }
    let substitutions = 0;
    let outputLength = 0;
    let memoLength = 0;
    const previews: string[] = [];

    for (const message of messages) {
      // Each message keeps its own cycle context, preserving literal cyclic placeholders even
      // when different messages enter the same cycle through different variable names.
      const resolved = new Map<string, string>();
      const visiting = new Set<string>();
      const resolveText = (content: string, remaining: () => number): string | null => {
        const parts: string[] = [];
        let length = 0;
        let position = 0;
        const appendLiteral = (end: number): boolean => {
          const size = end - position;
          if (size > remaining() - length) return false;
          if (size > 0) parts.push(content.slice(position, end));
          length += size;
          return true;
        };
        const placeholders = /\{\{([^{}]+)\}\}/g;
        let match: RegExpExecArray | null;
        while ((match = placeholders.exec(content)) !== null) {
          if (!appendLiteral(match.index) || substitutions >= PREVIEW_MAX_SUBSTITUTIONS) return null;
          substitutions++;
          const next = resolveName(match[1]!, match[0]);
          // Nested resolutions can consume memo budget while this text is still being built.
          // Check its current remainder before retaining a fragment or constructing the result.
          if (next === null || next.length > remaining() - length) return null;
          if (next.length > 0) parts.push(next);
          length += next.length;
          position = placeholders.lastIndex;
        }
        if (!appendLiteral(content.length)) return null;
        return parts.join('');
      };
      const resolveName = (name: string, literal: string): string | null => {
        const cached = resolved.get(name);
        if (cached !== undefined) return cached;
        const value = variables.get(name);
        if (value === undefined || visiting.has(name)) return literal;
        if (visiting.size >= PREVIEW_MAX_DEPTH) return null;
        visiting.add(name);
        const next = resolveText(value, () => PREVIEW_MAX_TEXT_LENGTH - memoLength);
        visiting.delete(name);
        if (next === null) return null;
        memoLength += next.length;
        resolved.set(name, next);
        return next;
      };
      const preview = resolveText(message.content, () => PREVIEW_MAX_TEXT_LENGTH - outputLength);
      if (preview === null) return null;
      outputLength += preview.length;
      previews.push(preview);
    }
    return previews;
  }

  // Native focus/blur events don't bubble and don't cross the shadow boundary on their own, so
  // the message textarea and variable inputs need an explicit bridge to make host-level
  // `addEventListener('focus' | 'blur', ...)` observe real focus/blur at all.
  private onFocus = (): void => { this.emit('focus'); };
  private onBlur = (): void => { this.emit('blur'); };

  private renderMessage = (
    message: PromptStudioMessage,
    index: number,
    messageCount: number,
  ): TemplateResult => {
    const displayIndex = getNumberFormat(this.effectiveLocale).format(index + 1);
    const role = this.roleLabel(message.role);
    return html`<li part="message" data-message-id=${message.id}>
      <span class="message-role-wrapper">
        <select
          part="message-role"
          aria-label=${this.localize('promptStudioMessageRole', undefined, { index: displayIndex, role })}
          .value=${message.role}
          ?disabled=${this.disabled}
          @change=${(event: Event) =>
            this.updateMessage(message.id, { role: (event.target as HTMLSelectElement).value as PromptStudioRole })}
          @focus=${this.onFocus}
          @blur=${this.onBlur}
        >
          ${(['system', 'user', 'assistant', 'tool'] as const).map(
            (role) => html`<option value=${role}>${this.roleLabel(role)}</option>`,
          )}
        </select>
        <span class="message-role-chevron" aria-hidden="true">${chevronIcon()}</span>
      </span>
      <textarea
        part="message-content"
        aria-label=${this.localize('promptStudioMessageContent', undefined, { index: displayIndex, role })}
        spellcheck=${this.spellcheck}
        autocapitalize=${this.autocapitalize || nothing}
        autocorrect=${this.autoCorrect || nothing}
        wrap=${this.wrap}
        .value=${message.content}
        ?disabled=${this.disabled}
        @input=${(event: Event) =>
          this.updateMessage(message.id, { content: (event.target as HTMLTextAreaElement).value })}
        @focus=${this.onFocus}
        @blur=${this.onBlur}
      ></textarea>
      ${this.reorderable
        ? html`
            <div part="message-actions">
              <button
                part="move-message-up"
                type="button"
                ?disabled=${this.disabled || index === 0}
                aria-label=${this.localize('moveUp')}
                @click=${() => this.requestMessageMove(message.id, index, -1)}
              >
                ${chevronIcon()}
              </button>
              <button
                part="move-message-down"
                type="button"
                ?disabled=${this.disabled || index === messageCount - 1}
                aria-label=${this.localize('moveDown')}
                @click=${() => this.requestMessageMove(message.id, index, 1)}
              >
                ${chevronIcon()}
              </button>
              ${this.renderRemoveMessage(message.id)}
            </div>
          `
        : this.renderRemoveMessage(message.id)}
    </li>`;
  };

  private renderRemoveMessage(id: string): TemplateResult {
    return html`<button
      part="remove-message"
      type="button"
      ?disabled=${this.disabled}
      aria-label=${this.localize('promptStudioRemoveMessage')}
      @click=${() => this.removeMessage(id)}
    >
      ×
    </button>`;
  }

  override render(): TemplateResult {
    const heading = this.heading || this.localize('promptStudioLabel');
    const label = this.label || heading;
    const messages = this.uniqueMessages();
    const variables = this.variableItems();
    const versions = this.uniqueVersions();
    const previews = this.resolvePreviews(messages, variables);
    return html`
      <section part="base" aria-label=${overallSemanticLabel(this, label) ?? nothing}>
        <header part="toolbar">
          <h2>${heading}</h2>
          <button part="save" type="button" ?disabled=${this.disabled} @click=${() => this.emit('lr-save', this.state())}>
            ${this.localize('promptStudioSave')}
          </button>
          <button
            part="run"
            type="button"
            ?disabled=${this.disabled || this.running}
            @click=${() => this.emit('lr-run', this.state())}
          >
            ${this.localize('promptStudioRun')}
          </button>
        </header>
        <div part="editor">
          <section aria-label=${this.localize('promptStudioMessages')}>
            <ol part="messages">${repeat(
              messages,
              (message) => message.id,
              (message, index) => this.renderMessage(message, index, messages.length),
            )}</ol>
            <button part="add-message" type="button" ?disabled=${this.disabled} @click=${this.addMessage}>
              ${this.localize('promptStudioAddMessage')}
            </button>
          </section>
          ${variables.length
            ? html`
                <section part="variables" aria-label=${this.localize('promptStudioVariables')}>
                  <h3>${this.localize('promptStudioVariables')}</h3>
                  ${variables.map((variable, index) => {
                    const displayIndex = getNumberFormat(this.effectiveLocale).format(index + 1);
                    return html`
                      <div part="variable">
                        <input
                          aria-label=${this.localize('promptStudioVariableName', undefined, { index: displayIndex })}
                          spellcheck=${this.spellcheck}
                          autocapitalize=${this.autocapitalize || nothing}
                          autocorrect=${this.autoCorrect || nothing}
                          .value=${variable.name}
                          ?disabled=${this.disabled}
                          @input=${(event: Event) =>
                            this.updateVariable(index, { name: (event.target as HTMLInputElement).value })}
                          @focus=${this.onFocus}
                          @blur=${this.onBlur}
                        />
                        <input
                          aria-label=${this.localize('promptStudioVariableValue', undefined, { index: displayIndex })}
                          spellcheck=${this.spellcheck}
                          autocapitalize=${this.autocapitalize || nothing}
                          autocorrect=${this.autoCorrect || nothing}
                          .value=${variable.value}
                          ?disabled=${this.disabled}
                          @input=${(event: Event) =>
                            this.updateVariable(index, { value: (event.target as HTMLInputElement).value })}
                          @focus=${this.onFocus}
                          @blur=${this.onBlur}
                        />
                      </div>
                    `;
                  })}
                </section>
              `
            : nothing}
          ${versions.length
            ? html`
                <nav part="versions" aria-label=${this.localize('promptStudioVersions')}>
                  ${versions.map(
                    (version) => html`
                      <button
                        part="version"
                        type="button"
                        data-version-id=${version.id}
                        aria-pressed=${version.id === this.selectedVersionId ? 'true' : 'false'}
                        ?disabled=${this.disabled}
                        @click=${() => this.emit('lr-version-select', { version })}
                      >
                        ${version.label}
                      </button>
                    `,
                  )}
                </nav>
              `
            : nothing}
        </div>
        <section part="preview" aria-label=${this.localize('promptStudioPreview')}>
          <h3>${this.localize('promptStudioPreview')}</h3>
          ${previews === null
            ? html`<p>${this.localize('promptStudioPreviewLimit')}</p>`
            : messages.map(
                (message, index) => html`<article><strong>${this.roleLabel(message.role)}</strong><pre>${previews[index]}</pre></article>`,
              )}
        </section>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-prompt-studio': LyraPromptStudio;
  }
}
