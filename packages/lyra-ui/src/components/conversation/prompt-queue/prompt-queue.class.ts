import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import type { DocumentRef } from '../../../ai/types.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import '../../forms/button/button.js';
import '../../forms/textarea/textarea.js';
import { styles } from './prompt-queue.styles.js';

export interface PromptQueueItem {
  id: string;
  value: string;
  attachments?: DocumentRef[];
  createdAt?: number;
  metadata?: Record<string, unknown>;
}

export type PromptQueueChangeReason = 'edit' | 'remove' | 'reorder';

export interface PromptQueueChangeDetail {
  items: PromptQueueItem[];
  reason: PromptQueueChangeReason;
  itemId: string;
}

export interface LyraPromptQueueEventMap {
  'lr-queue-change': CustomEvent<PromptQueueChangeDetail>;
  'lr-send-now': CustomEvent<{ item: PromptQueueItem }>;
}

/**
 * `<lr-prompt-queue>` — a controlled queue of follow-up prompts that can be edited, reordered,
 * removed, or sent immediately while another agent turn is active.
 *
 * @customElement lr-prompt-queue
 * @event lr-queue-change - A proposed controlled queue update. `detail: { items, reason, itemId }`.
 * @event lr-send-now - Immediate send was requested. `detail: { item }`.
 * @csspart base - The queue wrapper.
 * @csspart heading - The queue heading.
 * @csspart list - The ordered queue list.
 * @csspart item - One queued prompt.
 * @csspart value - Read-only prompt text when `editable` is false.
 * @csspart editor - A queued prompt editor.
 * @csspart actions - One item's action row.
 * @csspart action - Every item action.
 * @csspart empty - The empty state.
 */
export class LyraPromptQueue extends LyraElement<LyraPromptQueueEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) items: PromptQueueItem[] = [];
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) editable = true;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() label = '';
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  private emitChange(items: PromptQueueItem[], reason: PromptQueueChangeReason, itemId: string): void {
    this.emit('lr-queue-change', { items, reason, itemId });
  }

  private edit(item: PromptQueueItem, value: string): void {
    this.emitChange(
      this.items.map((candidate) => candidate.id === item.id ? { ...candidate, value } : { ...candidate }),
      'edit',
      item.id,
    );
  }

  private removeItem(item: PromptQueueItem): void {
    this.emitChange(this.items.filter((candidate) => candidate.id !== item.id).map((candidate) => ({ ...candidate })), 'remove', item.id);
  }

  private move(item: PromptQueueItem, offset: -1 | 1): void {
    const index = this.items.findIndex((candidate) => candidate.id === item.id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= this.items.length) return;
    const next = this.items.map((candidate) => ({ ...candidate }));
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    this.emitChange(next, 'reorder', item.id);
  }

  private renderItem(item: PromptQueueItem, index: number): TemplateResult {
    return html`<li part="item" data-id=${item.id}>
      ${this.editable
        ? html`<lr-textarea
            part="editor"
            .value=${item.value}
            .disabled=${this.disabled}
            .label=${`${this.localize('promptQueueLabel')} ${index + 1}`}
            resize="auto"
            @lr-input=${(event: CustomEvent<{ value: string }>) => this.edit(item, event.detail.value)}
          ></lr-textarea>`
        : html`<span part="value">${item.value}</span>`}
      <div part="actions">
        <lr-button
          part="action"
          data-action="up"
          size="xs"
          appearance="plain"
          .disabled=${this.disabled || index === 0}
          @click=${() => this.move(item, -1)}
        >${this.localize('moveUp')}</lr-button>
        <lr-button
          part="action"
          data-action="down"
          size="xs"
          appearance="plain"
          .disabled=${this.disabled || index === this.items.length - 1}
          @click=${() => this.move(item, 1)}
        >${this.localize('moveDown')}</lr-button>
        <lr-button
          part="action"
          data-action="send"
          size="xs"
          appearance="plain"
          .disabled=${this.disabled}
          @click=${() => this.emit('lr-send-now', { item })}
        >${this.localize('promptQueueSendNow')}</lr-button>
        <lr-button
          part="action"
          data-action="remove"
          size="xs"
          appearance="plain"
          variant="danger"
          .disabled=${this.disabled}
          @click=${() => this.removeItem(item)}
        >${this.localize('remove')}</lr-button>
      </div>
    </li>`;
  }

  override render(): TemplateResult {
    const label = this.accessibleLabel || this.label || this.localize('promptQueueLabel');
    return html`<section part="base" aria-label=${label}>
      <h3 part="heading">${label}</h3>
      ${this.items.length
        ? html`<ol part="list" role="list">
            ${repeat(this.items, (item) => item.id, (item, index) => this.renderItem(item, index))}
          </ol>`
        : html`<p part="empty">${this.localize('promptQueueEmpty')}</p>`}
    </section>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-prompt-queue': LyraPromptQueue;
  }
}
