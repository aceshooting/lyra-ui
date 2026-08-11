import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { trueDefaultSpellcheckConverter as spellcheckConverter } from '../../../internal/converters.js';
import { chevronIcon } from '../../../internal/icons.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './prompt-studio.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_moveDown, LYRA_DEFAULT_moveUp, LYRA_DEFAULT_promptStudioAddMessage, LYRA_DEFAULT_promptStudioLabel, LYRA_DEFAULT_promptStudioMessageContent, LYRA_DEFAULT_promptStudioMessageRole, LYRA_DEFAULT_promptStudioMessages, LYRA_DEFAULT_promptStudioPreview, LYRA_DEFAULT_promptStudioRemoveMessage, LYRA_DEFAULT_promptStudioRoleAssistant, LYRA_DEFAULT_promptStudioRoleSystem, LYRA_DEFAULT_promptStudioRoleTool, LYRA_DEFAULT_promptStudioRoleUser, LYRA_DEFAULT_promptStudioRun, LYRA_DEFAULT_promptStudioSave, LYRA_DEFAULT_promptStudioVariableName, LYRA_DEFAULT_promptStudioVariableValue, LYRA_DEFAULT_promptStudioVariables, LYRA_DEFAULT_promptStudioVersions } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type PromptStudioRole = 'system' | 'user' | 'assistant' | 'tool';
export type PromptStudioWrap = 'hard' | 'soft' | 'off';
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
  messages: PromptStudioMessage[];
  variables?: PromptStudioVariable[];
  createdAt?: string;
}
export interface PromptStudioState {
  messages: PromptStudioMessage[];
  variables: PromptStudioVariable[];
}
export interface PromptStudioMessageReorderDetail {
  messages: PromptStudioMessage[];
  messageId: string;
  fromIndex: number;
  toIndex: number;
}
export interface LyraPromptStudioEventMap {
  focus: CustomEvent<undefined>;
  blur: CustomEvent<undefined>;
  'lr-change': CustomEvent<PromptStudioState>;
  'lr-message-reorder': CustomEvent<PromptStudioMessageReorderDetail>;
  'lr-run': CustomEvent<PromptStudioState>;
  'lr-save': CustomEvent<PromptStudioState>;
  'lr-version-select': CustomEvent<{ version: PromptStudioVersion }>;
}

type PromptStudioMessageMovePart = 'move-message-up' | 'move-message-down';

/**
 * `<lr-prompt-studio>` — a provider-neutral prompt-development workbench for ordered role
 * messages, `{{variable}}` substitution, version selection, preview, save, and run intents.
 * The host owns persistence and model execution. Opting into message reordering exposes native,
 * keyboard-operable move controls; every proposed move is cancelable before the editor state changes.
 *
 * @customElement lr-prompt-studio
 * @event lr-change - Messages or variables changed. Carries their complete next state.
 * @event lr-message-reorder - A cancelable request to reorder messages. Carries the proposed
 *   complete message order and the moved message's id and indexes. Prevent it to persist or reject
 *   the proposed order yourself, then assign `messages` when the host is ready to render it.
 * @event lr-run - The current prompt was requested for execution.
 * @event lr-save - The current prompt was requested for persistence.
 * @event lr-version-select - A complete saved version was activated.
 * @event focus - Re-dispatched when the message textarea or a variable input receives focus,
 *   since native focus neither bubbles nor crosses the shadow boundary.
 * @event blur - Re-dispatched when the message textarea or a variable input loses focus.
 * @csspart base - The named studio region.
 * @csspart toolbar - Save/run controls.
 * @csspart editor - Messages and variables workspace.
 * @csspart messages - Ordered prompt-message editor.
 * @csspart message - One prompt message.
 * @csspart message-role - A message role selector.
 * @csspart message-content - A message textarea.
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

  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) messages: PromptStudioMessage[] = [];
  @property({ attribute: false }) variables: PromptStudioVariable[] = [];
  @property({ attribute: false }) versions: PromptStudioVersion[] = [];
  @property({ attribute: 'selected-version-id' }) selectedVersionId = '';
  @property() label = '';
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
      messages: this.messages.map((message) => ({ ...message })),
      variables: this.variables.map((variable) => ({ ...variable })),
    };
  }

  private emitChange(messages = this.messages, variables = this.variables): void {
    this.messages = messages;
    this.variables = variables;
    this.emit('lr-change', this.state());
  }

  private updateMessage(id: string, patch: Partial<PromptStudioMessage>): void {
    this.emitChange(this.messages.map((message) => (message.id === id ? { ...message, ...patch } : message)));
  }

  private removeMessage(id: string): void {
    this.emitChange(this.messages.filter((message) => message.id !== id));
  }

  private addMessage(): void {
    const existingIds = new Set(this.messages.map((message) => message.id));
    const base = `message-${Date.now()}-${this.messages.length}`;
    let id = base;
    let suffix = 1;
    while (existingIds.has(id)) {
      id = `${base}-${suffix}`;
      suffix++;
    }
    this.emitChange([...this.messages, { id, role: 'user', content: '' }]);
  }

  private updateVariable(index: number, patch: Partial<PromptStudioVariable>): void {
    this.emitChange(
      this.messages,
      this.variables.map((variable, itemIndex) => (itemIndex === index ? { ...variable, ...patch } : variable)),
    );
  }

  private requestMessageMove(messageId: string, fromIndex: number, offset: -1 | 1): void {
    const toIndex = fromIndex + offset;
    if (
      this.disabled ||
      !this.reorderable ||
      toIndex < 0 ||
      toIndex >= this.messages.length ||
      this.messages[fromIndex]?.id !== messageId
    ) {
      return;
    }

    const nextMessages = this.messages.map((message) => ({ ...message }));
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
    this.emitChange(nextMessages);
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

  private resolve(content: string): string {
    let resolved = content;
    for (const variable of this.variables) {
      if (!variable.name) continue;
      resolved = resolved.split(`{{${variable.name}}}`).join(variable.value);
    }
    return resolved;
  }

  // Native focus/blur events don't bubble and don't cross the shadow boundary on their own, so
  // the message textarea and variable inputs need an explicit bridge to make host-level
  // `addEventListener('focus' | 'blur', ...)` observe real focus/blur at all.
  private onFocus = (): void => { this.emit('focus'); };
  private onBlur = (): void => { this.emit('blur'); };

  private renderMessage = (message: PromptStudioMessage, index: number): TemplateResult => {
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
                ?disabled=${this.disabled || index === this.messages.length - 1}
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
    const label = this.getAttribute('aria-label') || this.label || this.localize('promptStudioLabel');
    return html`
      <section part="base" aria-label=${label}>
        <header part="toolbar">
          <h2>${label}</h2>
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
            <ol part="messages">${repeat(this.messages, (message) => message.id, this.renderMessage)}</ol>
            <button part="add-message" type="button" ?disabled=${this.disabled} @click=${this.addMessage}>
              ${this.localize('promptStudioAddMessage')}
            </button>
          </section>
          ${this.variables.length
            ? html`
                <section part="variables" aria-label=${this.localize('promptStudioVariables')}>
                  <h3>${this.localize('promptStudioVariables')}</h3>
                  ${this.variables.map((variable, index) => {
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
          ${this.versions.length
            ? html`
                <nav part="versions" aria-label=${this.localize('promptStudioVersions')}>
                  ${this.versions.map(
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
          ${this.messages.map(
            (message) => html`<article><strong>${this.roleLabel(message.role)}</strong><pre>${this.resolve(message.content)}</pre></article>`,
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
