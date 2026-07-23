import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import type { DocumentRef } from '../../../ai/types.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { AttachmentCapability } from '../../media/attachment-trigger/attachment-trigger.class.js';
import type { LyraSourceEntry } from '../../retrieval/source-picker/source-picker.class.js';
import type { MentionItem, LyraMentionPopover } from '../../utility/mention-popover/mention-popover.class.js';
import type { LyraChatComposer, ChatComposerStatus } from '../chat-composer/chat-composer.class.js';
import type { LyraModelCatalog } from '../model-select/model-select.class.js';
import type { PromptQueueItem } from '../prompt-queue/prompt-queue.class.js';
import type { LyraVoiceCatalog } from '../voice-picker/voice-picker.class.js';
import '../../media/attachment-chip/attachment-chip.js';
import '../../media/attachment-trigger/attachment-trigger.js';
import '../../retrieval/source-picker/source-picker.js';
import '../../utility/mention-popover/mention-popover.js';
import '../chat-composer/chat-composer.js';
import '../model-select/model-select.js';
import '../prompt-queue/prompt-queue.js';
import '../voice-picker/voice-picker.js';
import { styles } from './prompt-input.styles.js';

export interface PromptSuggestion extends MentionItem {
  /** Inserted after the trigger. Defaults to `label`. */
  insertText?: string;
}

export interface PromptInputAttachment extends DocumentRef {
  file?: File;
  size?: number;
}

interface ActiveSuggestion {
  trigger: '@' | '/';
  start: number;
  query: string;
}

export interface LyraPromptInputEventMap {
  'lr-input': CustomEvent<{ value: string }>;
  'lr-submit': CustomEvent<{ value: string }>;
  'lr-stop': CustomEvent<undefined>;
  'lr-mention-select': CustomEvent<{ id: string; label: string; trigger: '@' | '/' }>;
  'lr-attachments-add': CustomEvent<{ files: File[]; capability: AttachmentCapability }>;
  'lr-attachment-remove': CustomEvent<{ id: string }>;
  'lr-model-change': CustomEvent<{ value: string; inCatalog: boolean }>;
  'lr-voice-change': CustomEvent<{ value: string; inCatalog: boolean }>;
}

/**
 * `<lr-prompt-input>` — a composed AI prompt surface combining the chat composer with attachments,
 * model and voice selection, retrieval sources, mentions, slash commands, and a queued-turn list.
 * It performs no upload, model call, retrieval, or persistence.
 *
 * @customElement lr-prompt-input
 * @slot controls - Replaces the data-driven model, voice, and source controls.
 * @slot leading - Replaces the default attachment trigger.
 * @slot chips - Replaces the data-driven attachment chips.
 * @slot trailing - Replaces the composer's send/stop action.
 * @slot footer - Content below the composer.
 * @event lr-input - Prompt text changed. `detail: { value }`.
 * @event lr-submit - Prompt submission was requested. `detail: { value }`.
 * @event lr-stop - Stop generation was requested.
 * @event lr-mention-select - A mention or slash command was inserted.
 * @event lr-attachments-add - Files were selected. `detail: { files, capability }`.
 * @event lr-attachment-remove - Attachment removal was requested. `detail: { id }`.
 * @event lr-model-change - Model selection changed. `detail: { value, inCatalog }`.
 * @event lr-voice-change - Voice selection changed. `detail: { value, inCatalog }`.
 * @csspart base - The prompt surface.
 * @csspart controls - Model, voice, and source controls.
 * @csspart sources - The collapsible source-picker region.
 * @csspart sources-summary - The source-picker disclosure.
 * @csspart source-picker - The composed source picker.
 * @csspart queue - The composed prompt queue.
 * @csspart composer - The composed chat composer.
 * @csspart leading - The composer's leading attachment control.
 * @csspart chips - The attachment-chip tray.
 * @csspart footer - The footer slot.
 */
export class LyraPromptInput extends LyraElement<LyraPromptInputEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property() value = '';
  @property() status: ChatComposerStatus = 'idle';
  @property() placeholder = '';
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({
    type: Boolean,
    attribute: 'submit-on-enter',
    converter: trueDefaultBooleanConverter,
  })
  submitOnEnter = true;
  @property({ attribute: false }) attachments: PromptInputAttachment[] = [];
  @property({ attribute: false }) attachmentCapabilities: AttachmentCapability[] = ['files', 'image', 'audio'];
  @property({ attribute: false }) mentionItems: PromptSuggestion[] = [];
  @property({ attribute: false }) commandItems: PromptSuggestion[] = [];
  @property({ attribute: false }) modelCatalog?: LyraModelCatalog;
  @property() model = '';
  @property({ attribute: false }) voiceCatalog?: LyraVoiceCatalog;
  @property() voice = '';
  @property({ attribute: false }) sources: LyraSourceEntry[] = [];
  @property({ attribute: false }) selectedSourceIds: string[] = [];
  @property({ attribute: false }) queue: PromptQueueItem[] = [];
  @property() label = '';
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  @state() private activeSuggestion: ActiveSuggestion | null = null;
  @query('lr-chat-composer') private composer?: LyraChatComposer;
  @query('lr-mention-popover') private suggestionPopover?: LyraMentionPopover;
  private suggestionAnchor?: HTMLElement;

  override focus(options?: FocusOptions): void {
    this.composer?.focus(options);
  }

  override blur(): void {
    this.composer?.blur();
  }

  override click(): void {
    if (this.disabled) return;
    this.composer?.click();
  }

  select(): void {
    this.composer?.select();
  }

  protected override updated(_changed: PropertyValues): void {
    if (this.suggestionPopover && this.suggestionAnchor) {
      this.suggestionPopover.anchor = this.suggestionAnchor;
    }
    this.syncSuggestionAria();
  }

  private suggestions(): PromptSuggestion[] {
    return this.activeSuggestion?.trigger === '/' ? this.commandItems : this.mentionItems;
  }

  private detectSuggestion(value: string): void {
    const caret = this.composer?.selectionStart ?? value.length;
    const prefix = value.slice(0, caret);
    const match = /(?:^|\s)([@/])([^\s@/]*)$/.exec(prefix);
    if (!match || (match[1] !== '@' && match[1] !== '/')) {
      this.activeSuggestion = null;
      return;
    }
    const start = caret - match[2]!.length - 1;
    const items = match[1] === '@' ? this.mentionItems : this.commandItems;
    this.activeSuggestion = items.length
      ? { trigger: match[1], start, query: match[2] ?? '' }
      : null;
  }

  private onInput(event: CustomEvent<{ value: string }>): void {
    event.stopPropagation();
    const composer = event.currentTarget as LyraChatComposer | null;
    this.suggestionAnchor = composer?.input ?? this.composer?.input ?? undefined;
    this.value = event.detail.value;
    this.detectSuggestion(this.value);
    this.emit('lr-input', { value: this.value });
  }

  private onSubmit(event: CustomEvent<{ value: string }>): void {
    event.stopPropagation();
    this.emit('lr-submit', event.detail);
  }

  private onStop(event: Event): void {
    event.stopPropagation();
    this.emit('lr-stop');
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (!this.activeSuggestion || !this.suggestionPopover?.open) return;
    if (this.suggestionPopover.handleKeyDown(event)) {
      this.requestUpdate();
      queueMicrotask(() => this.syncSuggestionAria());
    }
  }

  private syncSuggestionAria(): void {
    const input = this.composer?.input;
    const popover = this.suggestionPopover;
    if (!input) return;
    if (this.activeSuggestion && popover?.open) {
      input.setAttribute('aria-controls', popover.listboxId);
      const active = popover.activeDescendantId;
      if (active) input.setAttribute('aria-activedescendant', active);
      else input.removeAttribute('aria-activedescendant');
    } else {
      input.removeAttribute('aria-controls');
      input.removeAttribute('aria-activedescendant');
    }
  }

  private onSuggestionSelect(event: CustomEvent<{ id: string; label: string }>): void {
    event.stopPropagation();
    const active = this.activeSuggestion;
    if (!active) return;
    const item = this.suggestions().find((candidate) => candidate.id === event.detail.id);
    const caret = this.composer?.selectionStart ?? this.value.length;
    const inserted = `${active.trigger}${item?.insertText ?? event.detail.label} `;
    this.value = this.value.slice(0, active.start) + inserted + this.value.slice(caret);
    const nextCaret = active.start + inserted.length;
    this.activeSuggestion = null;
    this.emit('lr-input', { value: this.value });
    this.emit('lr-mention-select', {
      id: event.detail.id,
      label: event.detail.label,
      trigger: active.trigger,
    });
    void this.updateComplete.then(() => {
      this.composer?.setSelectionRange(nextCaret, nextCaret);
      this.syncSuggestionAria();
    });
  }

  private onPick(event: CustomEvent<{ capability: AttachmentCapability; files: FileList | File[] }>): void {
    event.stopPropagation();
    this.emit('lr-attachments-add', {
      files: Array.from(event.detail.files),
      capability: event.detail.capability,
    });
  }

  private renderAttachment(attachment: PromptInputAttachment): TemplateResult {
    return html`<lr-attachment-chip
      .id=${attachment.id}
      .file=${attachment.file}
      .name=${attachment.name}
      .size=${attachment.size ?? 0}
      .mimeType=${attachment.mimeType ?? ''}
      .previewSrc=${attachment.uri ?? ''}
      .removable=${!this.disabled}
      compact
      @lr-remove=${(event: Event) => {
        event.stopPropagation();
        this.emit('lr-attachment-remove', { id: attachment.id });
      }}
    ></lr-attachment-chip>`;
  }

  private renderControls(): TemplateResult | typeof nothing {
    if (!this.modelCatalog?.length && !this.voiceCatalog?.length && !this.sources.length) return nothing;
    return html`<div part="controls" aria-label=${this.localize('promptInputControls')}>
      ${this.modelCatalog?.length
        ? html`<lr-model-select
            .catalog=${this.modelCatalog}
            .value=${this.model}
            .disabled=${this.disabled}
            @lr-change=${(event: CustomEvent<{ value: string; inCatalog: boolean }>) => {
              event.stopPropagation();
              this.emit('lr-model-change', event.detail);
            }}
          ></lr-model-select>`
        : nothing}
      ${this.voiceCatalog?.length
        ? html`<lr-voice-picker
            .catalog=${this.voiceCatalog}
            .value=${this.voice}
            .disabled=${this.disabled}
            @lr-change=${(event: CustomEvent<{ value: string; inCatalog: boolean }>) => {
              event.stopPropagation();
              this.emit('lr-voice-change', event.detail);
            }}
          ></lr-voice-picker>`
        : nothing}
      ${this.sources.length
        ? html`<details part="sources" .inert=${this.disabled} aria-disabled=${String(this.disabled)}>
            <summary part="sources-summary">${this.localize('promptInputSources')}</summary>
            <lr-source-picker
              part="source-picker"
              .sources=${this.sources}
              .selectedIds=${this.selectedSourceIds}
            ></lr-source-picker>
          </details>`
        : nothing}
    </div>`;
  }

  override render(): TemplateResult {
    const label = this.accessibleLabel || this.label || this.localize('promptInputLabel');
    return html`<section part="base" aria-label=${label}>
      ${this.queue.length
        ? html`<lr-prompt-queue part="queue" .items=${this.queue} .disabled=${this.disabled}></lr-prompt-queue>`
        : nothing}
      <slot name="controls">${this.renderControls()}</slot>
      <lr-chat-composer
        part="composer"
        .value=${this.value}
        .status=${this.status}
        .placeholder=${this.placeholder}
        .disabled=${this.disabled}
        .submitOnEnter=${this.submitOnEnter}
        .accessibleLabel=${label}
        @lr-input=${this.onInput}
        @lr-submit=${this.onSubmit}
        @lr-stop=${this.onStop}
        @keydown=${this.onKeyDown}
      >
        <span slot="leading" part="leading">
          <slot name="leading">
            <lr-attachment-trigger
              .capabilities=${this.attachmentCapabilities}
              .disabled=${this.disabled}
              @lr-pick=${this.onPick}
            ></lr-attachment-trigger>
          </slot>
        </span>
        <div slot="chips" part="chips" role="group" aria-label=${this.localize('promptInputAttachments')}>
          <slot name="chips">${this.attachments.map((attachment) => this.renderAttachment(attachment))}</slot>
        </div>
        <slot name="trailing" slot="trailing"></slot>
      </lr-chat-composer>
      <lr-mention-popover
        .anchor=${this.suggestionAnchor}
        .items=${this.suggestions()}
        .query=${this.activeSuggestion?.query ?? ''}
        .open=${!this.disabled && this.activeSuggestion !== null}
        @lr-mention-select=${this.onSuggestionSelect}
        @lr-mention-close=${() => {
          this.activeSuggestion = null;
        }}
      ></lr-mention-popover>
      <div part="footer"><slot name="footer"></slot></div>
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-prompt-input': LyraPromptInput;
  }
}
