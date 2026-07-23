import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './prompt-studio.styles.js';

export type PromptStudioRole = 'system' | 'user' | 'assistant' | 'tool';
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
export interface LyraPromptStudioEventMap {
  'lr-change': CustomEvent<PromptStudioState>;
  'lr-run': CustomEvent<PromptStudioState>;
  'lr-save': CustomEvent<PromptStudioState>;
  'lr-version-select': CustomEvent<{ version: PromptStudioVersion }>;
}

/**
 * `<lr-prompt-studio>` — a provider-neutral prompt-development workbench for ordered role
 * messages, `{{variable}}` substitution, version selection, preview, save, and run intents.
 * The host owns persistence and model execution.
 *
 * @customElement lr-prompt-studio
 * @event lr-change - Messages or variables changed. Carries their complete next state.
 * @event lr-run - The current prompt was requested for execution.
 * @event lr-save - The current prompt was requested for persistence.
 * @event lr-version-select - A complete saved version was activated.
 * @csspart base - The named studio region.
 * @csspart toolbar - Save/run controls.
 * @csspart editor - Messages and variables workspace.
 * @csspart messages - Ordered prompt-message editor.
 * @csspart message - One prompt message.
 * @csspart message-role - A message role selector.
 * @csspart message-content - A message textarea.
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
 * @cssprop [--lr-prompt-studio-version-selected-hover-bg=var(--lr-color-brand-quiet)] - Selected version hover background.
 */
export class LyraPromptStudio extends LyraElement<LyraPromptStudioEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) messages: PromptStudioMessage[] = [];
  @property({ attribute: false }) variables: PromptStudioVariable[] = [];
  @property({ attribute: false }) versions: PromptStudioVersion[] = [];
  @property({ attribute: 'selected-version-id' }) selectedVersionId = '';
  @property() label = '';
  @property({ type: Boolean, reflect: true }) running = false;
  @property({ type: Boolean, reflect: true }) disabled = false;

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

  private resolve(content: string): string {
    let resolved = content;
    for (const variable of this.variables) {
      if (!variable.name) continue;
      resolved = resolved.split(`{{${variable.name}}}`).join(variable.value);
    }
    return resolved;
  }

  private renderMessage = (message: PromptStudioMessage): TemplateResult => html`
    <li part="message">
      <select
        part="message-role"
        aria-label=${this.roleLabel(message.role)}
        .value=${message.role}
        ?disabled=${this.disabled}
        @change=${(event: Event) =>
          this.updateMessage(message.id, { role: (event.target as HTMLSelectElement).value as PromptStudioRole })}
      >
        ${(['system', 'user', 'assistant', 'tool'] as const).map(
          (role) => html`<option value=${role}>${this.roleLabel(role)}</option>`,
        )}
      </select>
      <textarea
        part="message-content"
        aria-label=${this.roleLabel(message.role)}
        .value=${message.content}
        ?disabled=${this.disabled}
        @input=${(event: Event) =>
          this.updateMessage(message.id, { content: (event.target as HTMLTextAreaElement).value })}
      ></textarea>
      <button
        part="remove-message"
        type="button"
        ?disabled=${this.disabled}
        aria-label=${this.localize('promptStudioRemoveMessage')}
        @click=${() => this.removeMessage(message.id)}
      >
        ×
      </button>
    </li>
  `;

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
            <ol part="messages">${this.messages.map(this.renderMessage)}</ol>
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
                          .value=${variable.name}
                          ?disabled=${this.disabled}
                          @input=${(event: Event) =>
                            this.updateVariable(index, { name: (event.target as HTMLInputElement).value })}
                        />
                        <input
                          aria-label=${this.localize('promptStudioVariableValue', undefined, { index: displayIndex })}
                          .value=${variable.value}
                          ?disabled=${this.disabled}
                          @input=${(event: Event) =>
                            this.updateVariable(index, { value: (event.target as HTMLInputElement).value })}
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
