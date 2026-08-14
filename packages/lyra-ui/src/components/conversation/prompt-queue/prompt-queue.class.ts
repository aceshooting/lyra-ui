import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import type { DocumentRef } from '../../../ai/types.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styles } from './prompt-queue.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_moveDown, LYRA_DEFAULT_moveUp, LYRA_DEFAULT_promptQueueActionLabel, LYRA_DEFAULT_promptQueueEmpty, LYRA_DEFAULT_promptQueueItemLabel, LYRA_DEFAULT_promptQueueLabel, LYRA_DEFAULT_promptQueueSendNow, LYRA_DEFAULT_remove } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


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
 * When the host accepts a removal while that row's action owns focus, the equivalent action on
 * the nearest surviving row receives focus; an emptied queue focuses its stable region instead.
 * Controlled updates never steal focus when the removed row did not own it.
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
 * @status stable
 * @since 7.0.0
 */
export class LyraPromptQueue extends LyraElement<LyraPromptQueueEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    moveDown: LYRA_DEFAULT_moveDown,
    moveUp: LYRA_DEFAULT_moveUp,
    promptQueueActionLabel: LYRA_DEFAULT_promptQueueActionLabel,
    promptQueueEmpty: LYRA_DEFAULT_promptQueueEmpty,
    promptQueueItemLabel: LYRA_DEFAULT_promptQueueItemLabel,
    promptQueueLabel: LYRA_DEFAULT_promptQueueLabel,
    promptQueueSendNow: LYRA_DEFAULT_promptQueueSendNow,
    remove: LYRA_DEFAULT_remove,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  @property({ attribute: false }) items: PromptQueueItem[] = [];
  @property({ type: Boolean, reflect: true, converter: trueDefaultBooleanConverter }) editable = true;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() label = '';
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  private pendingRemovalFocus?: {
    targetId?: string;
    action?: string;
    actionIndex: number;
    origin: Element;
  };

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!changed.has('items') && !changed.has('editable') && !changed.has('disabled')) return;
    const focusedControl = activeElementIn(this.shadowRoot) as HTMLElement | null;
    const action = focusedControl?.getAttribute('data-action') ?? undefined;
    const editorFocused = focusedControl?.getAttribute('part') === 'editor';
    if (!action && !editorFocused) return;
    const focusedItem = focusedControl?.closest<HTMLElement>('[data-id]');
    const focusedId = focusedItem?.dataset['id'];
    if (!focusedId || !focusedControl) return;

    const previousItems = (changed.get('items') as PromptQueueItem[] | undefined) ?? [];
    const rowRemoved = changed.has('items') && !this.items.some((item) => item.id === focusedId);
    const editorRemoved = editorFocused && changed.has('editable') && !this.editable;
    const controlDisabled = changed.has('disabled') && this.disabled;
    if (!rowRemoved && !editorRemoved && !controlDisabled) return;
    const previousIndex = previousItems.findIndex((item) => item.id === focusedId);
    const target = rowRemoved
      ? this.items[Math.min(Math.max(previousIndex, 0), this.items.length - 1)]
      : this.items.find((item) => item.id === focusedId);
    const rowActions = focusedItem?.querySelectorAll<HTMLElement>('[data-action]') ?? [];
    this.pendingRemovalFocus = {
      targetId: target?.id,
      action,
      actionIndex: action ? [...rowActions].findIndex((candidate) => candidate === focusedControl) : -1,
      origin: focusedControl,
    };
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const pending = this.pendingRemovalFocus;
    if (!pending) return;
    this.pendingRemovalFocus = undefined;
    const internalActive = activeElementIn(this.shadowRoot);
    const documentActive = activeElementIn(this.ownerDocument);
    if (
      (internalActive !== null && internalActive !== pending.origin) ||
      (documentActive !== null && documentActive !== this && documentActive !== this.ownerDocument.body)
    ) return;
    if (!pending.targetId) {
      this.shadowRoot?.querySelector<HTMLElement>('[part="base"]')?.focus();
      return;
    }
    const targetItem = [...(this.shadowRoot?.querySelectorAll<HTMLElement>('[data-id]') ?? [])]
      .find((item) => item.dataset['id'] === pending.targetId);
    const actions = [...(targetItem?.querySelectorAll<HTMLElement>('[data-action]') ?? [])];
    const isEnabled = (candidate: HTMLElement): boolean =>
      (candidate as HTMLElement & { disabled?: boolean }).disabled !== true &&
      candidate.getAttribute('aria-disabled') !== 'true';
    const equivalentAction = pending.action
      ? actions.find(
          (candidate) => candidate.dataset['action'] === pending.action && isEnabled(candidate),
        )
      : undefined;
    if (equivalentAction) {
      equivalentAction.focus();
      return;
    }
    const preferredIndex = pending.actionIndex >= 0 ? pending.actionIndex : 0;
    for (let distance = 0; distance < actions.length; distance++) {
      const before = actions[preferredIndex - distance];
      if (before && isEnabled(before)) {
        before.focus();
        return;
      }
      const after = actions[preferredIndex + distance];
      if (after && isEnabled(after)) {
        after.focus();
        return;
      }
    }
    this.shadowRoot?.querySelector<HTMLElement>('[part="base"]')?.focus();
  }

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
    const formattedIndex = getNumberFormat(this.effectiveLocale).format(index + 1);
    const editorLabel = this.localize('promptQueueItemLabel', undefined, {
      index: formattedIndex,
    });
    const actionLabel = (action: string): string =>
      this.localize('promptQueueActionLabel', undefined, { action, index: formattedIndex });
    return html`<li part="item" data-id=${item.id}>
      ${this.editable
        ? html`<lr-textarea
            part="editor"
            .value=${item.value}
            .disabled=${this.disabled}
            .label=${editorLabel}
            resize="auto"
            @lr-input=${(event: CustomEvent<{ value: string }>) => {
              event.stopPropagation();
              this.edit(item, event.detail.value);
            }}
          ></lr-textarea>`
        : html`<span part="value">${item.value}</span>`}
      <div part="actions">
        <lr-button
          part="action"
          data-action="up"
          size="xs"
          appearance="plain"
          aria-label=${actionLabel(this.localize('moveUp'))}
          .disabled=${this.disabled || index === 0}
          @click=${() => this.move(item, -1)}
        >${this.localize('moveUp')}</lr-button>
        <lr-button
          part="action"
          data-action="down"
          size="xs"
          appearance="plain"
          aria-label=${actionLabel(this.localize('moveDown'))}
          .disabled=${this.disabled || index === this.items.length - 1}
          @click=${() => this.move(item, 1)}
        >${this.localize('moveDown')}</lr-button>
        <lr-button
          part="action"
          data-action="send"
          size="xs"
          appearance="plain"
          aria-label=${actionLabel(this.localize('promptQueueSendNow'))}
          .disabled=${this.disabled}
          @click=${() => this.emit('lr-send-now', { item })}
        >${this.localize('promptQueueSendNow')}</lr-button>
        <lr-button
          part="action"
          data-action="remove"
          size="xs"
          appearance="plain"
          variant="danger"
          aria-label=${actionLabel(this.localize('remove'))}
          .disabled=${this.disabled}
          @click=${() => this.removeItem(item)}
        >${this.localize('remove')}</lr-button>
      </div>
    </li>`;
  }

  override render(): TemplateResult {
    const label = this.accessibleLabel || this.label || this.localize('promptQueueLabel');
    return html`<section part="base" aria-label=${label} tabindex="-1">
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
