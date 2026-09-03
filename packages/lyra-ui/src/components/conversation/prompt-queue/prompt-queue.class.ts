import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import type { DocumentRef } from '../../../ai/types.js';
import { activeElementIn } from '../../../internal/active-element.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { getNumberFormat } from '../../../internal/intl-cache.js';
import { styles } from './prompt-queue.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_attachmentUntitledFile, LYRA_DEFAULT_moveDown, LYRA_DEFAULT_moveUp, LYRA_DEFAULT_promptInputAttachments, LYRA_DEFAULT_promptQueueActionLabel, LYRA_DEFAULT_promptQueueEmpty, LYRA_DEFAULT_promptQueueItemLabel, LYRA_DEFAULT_promptQueueLabel, LYRA_DEFAULT_promptQueueSendNow, LYRA_DEFAULT_remove } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface PromptQueueItem {
  id: string;
  value: string;
  attachments?: readonly DocumentRef[];
  createdAt?: number;
  /** Opaque caller metadata preserved in proposed queue and send-now payloads. */
  metadata?: Record<string, unknown>;
}

export type PromptQueueChangeReason = 'edit' | 'remove' | 'reorder';

export interface PromptQueueChangeDetail {
  items: PromptQueueItem[];
  reason: PromptQueueChangeReason;
  itemId: string;
}

export interface LyraPromptQueueEventMap {
  'lr-queue-change': CustomEvent<LyraEventDetailSnapshot<PromptQueueChangeDetail>>;
  'lr-send-now': CustomEvent<LyraEventDetailSnapshot<{ item: PromptQueueItem }>>;
}

const MAX_PROJECTED_QUEUE_ITEMS = 10_000;
const MAX_PROJECTED_QUEUE_ATTACHMENTS = 10_000;

interface CanonicalPromptQueueAttachment {
  readonly id: string;
  readonly name: string;
  readonly mimeType?: string;
  readonly uri?: string;
  readonly version?: string;
}

/** An admitted row keeps its source only as an opaque identity. All later reads use copied data. */
interface CanonicalPromptQueueItem {
  readonly source: PromptQueueItem;
  readonly id: string;
  readonly value: string;
  readonly attachments?: readonly CanonicalPromptQueueAttachment[];
  readonly createdAt?: number;
  readonly metadata?: unknown;
}

const EMPTY_CANONICAL_PROMPT_QUEUE_ITEMS: readonly CanonicalPromptQueueItem[] = Object.freeze([]);

function descriptorValue(value: object, property: PropertyKey): ReturnType<typeof getOwnDataDescriptor> {
  return getOwnDataDescriptor(value, property);
}

function valueOfDescriptor(descriptor: ReturnType<typeof getOwnDataDescriptor>): unknown | undefined {
  return descriptor === MISSING_OWN_DATA_DESCRIPTOR || descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
    ? undefined
    : descriptor.value;
}

function projectPromptQueueAttachment(value: unknown): CanonicalPromptQueueAttachment | undefined {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const idDescriptor = descriptorValue(value, 'id');
    const nameDescriptor = descriptorValue(value, 'name');
    const mimeTypeDescriptor = descriptorValue(value, 'mimeType');
    const uriDescriptor = descriptorValue(value, 'uri');
    const versionDescriptor = descriptorValue(value, 'version');
    if (
      [idDescriptor, nameDescriptor, mimeTypeDescriptor, uriDescriptor, versionDescriptor]
        .some((descriptor) => descriptor === UNSAFE_OWN_DATA_DESCRIPTOR)
    ) return undefined;

    const id = valueOfDescriptor(idDescriptor);
    const name = valueOfDescriptor(nameDescriptor);
    if (typeof id !== 'string' || id.trim().length === 0 || typeof name !== 'string') return undefined;

    const mimeType = valueOfDescriptor(mimeTypeDescriptor);
    const uri = valueOfDescriptor(uriDescriptor);
    const version = valueOfDescriptor(versionDescriptor);
    return Object.freeze({
      id,
      name,
      ...(typeof mimeType === 'string' ? { mimeType } : {}),
      ...(typeof uri === 'string' ? { uri } : {}),
      ...(typeof version === 'string' ? { version } : {}),
    });
  } catch {
    return undefined;
  }
}

function projectPromptQueueAttachments(value: unknown): readonly CanonicalPromptQueueAttachment[] | undefined {
  try {
    if (!Array.isArray(value)) return undefined;
    const lengthDescriptor = descriptorValue(value, 'length');
    if (
      lengthDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      lengthDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof lengthDescriptor.value !== 'number' ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    ) return undefined;

    const attachments: CanonicalPromptQueueAttachment[] = [];
    const length = Math.min(lengthDescriptor.value, MAX_PROJECTED_QUEUE_ATTACHMENTS);
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptorValue(value, String(index));
      if (
        descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
      ) continue;
      const attachment = projectPromptQueueAttachment(descriptor.value);
      if (attachment) attachments.push(attachment);
    }
    return Object.freeze(attachments);
  } catch {
    return undefined;
  }
}

function projectPromptQueueItem(value: unknown): CanonicalPromptQueueItem | undefined {
  try {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const idDescriptor = descriptorValue(value, 'id');
    const valueDescriptor = descriptorValue(value, 'value');
    const attachmentsDescriptor = descriptorValue(value, 'attachments');
    const createdAtDescriptor = descriptorValue(value, 'createdAt');
    const metadataDescriptor = descriptorValue(value, 'metadata');
    if (
      [idDescriptor, valueDescriptor, attachmentsDescriptor, createdAtDescriptor, metadataDescriptor]
        .some((descriptor) => descriptor === UNSAFE_OWN_DATA_DESCRIPTOR)
    ) return undefined;

    const id = valueOfDescriptor(idDescriptor);
    const prompt = valueOfDescriptor(valueDescriptor);
    if (typeof id !== 'string' || id.trim().length === 0 || typeof prompt !== 'string') return undefined;

    const attachmentsValue = valueOfDescriptor(attachmentsDescriptor);
    const attachments = attachmentsDescriptor === MISSING_OWN_DATA_DESCRIPTOR || attachmentsValue === undefined
      ? undefined
      : projectPromptQueueAttachments(attachmentsValue);
    const createdAt = valueOfDescriptor(createdAtDescriptor);
    const metadata = valueOfDescriptor(metadataDescriptor);
    return Object.freeze({
      source: value as PromptQueueItem,
      id,
      value: prompt,
      ...(attachments === undefined ? {} : { attachments }),
      ...(typeof createdAt === 'number' && Number.isFinite(createdAt) ? { createdAt } : {}),
      ...(metadata !== undefined ? { metadata } : {}),
    });
  } catch {
    return undefined;
  }
}

function projectPromptQueueItems(value: unknown): readonly CanonicalPromptQueueItem[] {
  try {
    if (!Array.isArray(value)) return EMPTY_CANONICAL_PROMPT_QUEUE_ITEMS;
    const lengthDescriptor = descriptorValue(value, 'length');
    if (
      lengthDescriptor === MISSING_OWN_DATA_DESCRIPTOR ||
      lengthDescriptor === UNSAFE_OWN_DATA_DESCRIPTOR ||
      typeof lengthDescriptor.value !== 'number' ||
      !Number.isSafeInteger(lengthDescriptor.value) ||
      lengthDescriptor.value < 0
    ) return EMPTY_CANONICAL_PROMPT_QUEUE_ITEMS;

    const items: CanonicalPromptQueueItem[] = [];
    const seen = new Set<string>();
    const length = Math.min(lengthDescriptor.value, MAX_PROJECTED_QUEUE_ITEMS);
    for (let index = 0; index < length; index += 1) {
      const descriptor = descriptorValue(value, String(index));
      if (
        descriptor === MISSING_OWN_DATA_DESCRIPTOR ||
        descriptor === UNSAFE_OWN_DATA_DESCRIPTOR
      ) continue;
      const item = projectPromptQueueItem(descriptor.value);
      // Validation deliberately precedes identity reservation, so an invalid duplicate cannot
      // hide a later valid row with the same public id.
      if (!item || seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
    return Object.freeze(items);
  } catch {
    return EMPTY_CANONICAL_PROMPT_QUEUE_ITEMS;
  }
}

function toDocumentRef(attachment: CanonicalPromptQueueAttachment): DocumentRef {
  return Object.freeze({
    id: attachment.id,
    name: attachment.name,
    ...(attachment.mimeType === undefined ? {} : { mimeType: attachment.mimeType }),
    ...(attachment.uri === undefined ? {} : { uri: attachment.uri }),
    ...(attachment.version === undefined ? {} : { version: attachment.version }),
  });
}

function toPromptQueueItem(item: CanonicalPromptQueueItem, value = item.value): PromptQueueItem {
  return Object.freeze({
    id: item.id,
    value,
    ...(item.attachments === undefined ? {} : {
      attachments: Object.freeze(item.attachments.map(toDocumentRef)),
    }),
    ...(item.createdAt === undefined ? {} : { createdAt: item.createdAt }),
    ...(item.metadata === undefined ? {} : { metadata: item.metadata as Record<string, unknown> }),
  });
}

/**
 * `<lr-prompt-queue>` — a controlled queue of follow-up prompts that can be edited, reordered,
 * removed, or sent immediately while another agent turn is active.
 * Item ids are unique occurrence identities. Empty ids and later duplicate occurrences are
 * ignored before rendering or proposing a mutation, so every `itemId` remains unambiguous.
 * When the host accepts a removal while that row's action owns focus, the equivalent action on
 * the nearest surviving row receives focus; an emptied queue focuses its stable region instead.
 * Controlled updates never steal focus when the removed row did not own it.
 *
 * Public item sequences are bounded, frozen snapshots. Admitted item identities remain opaque only
 * while a descriptor-safe projection copies the queue's display and proposal fields once; later
 * rendering and events never reread the source row or its opaque metadata. Create a new collection
 * and reassign it after changes; mutating an assigned array does not update the view.
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
 * @csspart attachments - The visible attachment-name list for one prompt.
 * @csspart attachment - One attachment name.
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
    attachmentUntitledFile: LYRA_DEFAULT_attachmentUntitledFile,
    moveDown: LYRA_DEFAULT_moveDown,
    moveUp: LYRA_DEFAULT_moveUp,
    promptInputAttachments: LYRA_DEFAULT_promptInputAttachments,
    promptQueueActionLabel: LYRA_DEFAULT_promptQueueActionLabel,
    promptQueueEmpty: LYRA_DEFAULT_promptQueueEmpty,
    promptQueueItemLabel: LYRA_DEFAULT_promptQueueItemLabel,
    promptQueueLabel: LYRA_DEFAULT_promptQueueLabel,
    promptQueueSendNow: LYRA_DEFAULT_promptQueueSendNow,
    remove: LYRA_DEFAULT_remove,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze(['items']);
  /** Queue items may carry opaque host metadata. Keep each admitted source identity only while the
   * canonical projection copies its closed row schema once, rather than deep-cloning unknown data. */
  protected static override readonly identityCollectionProperties = Object.freeze(['items']);

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-queue-change',
    'lr-send-now',
  ]);
  /** Queue metadata is opaque caller state. Preserve it through the frozen event envelope instead
   * of recursively reflecting it after the canonical row projection has admitted it. */
  protected static override readonly identityEventDetailProperties = Object.freeze({
    'lr-send-now': Object.freeze(['item']),
  });
  protected static override readonly identityEventDetailCollectionItems = Object.freeze({
    'lr-queue-change': Object.freeze(['items']),
  });

  /** Controlled queued prompts. Accessor-backed or malformed rows and attachments are omitted;
   * duplicate nonblank item ids normalize first-wins after full row validation. */
  @property({ attribute: false }) items: readonly PromptQueueItem[] = [];
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

  private readonly canonicalItemsBySource = new WeakMap<
    object,
    readonly CanonicalPromptQueueItem[]
  >();

  private canonicalItemsFor(source: unknown): readonly CanonicalPromptQueueItem[] {
    if (
      source === null ||
      (typeof source !== 'object' && typeof source !== 'function')
    )
      return EMPTY_CANONICAL_PROMPT_QUEUE_ITEMS;
    const cached = this.canonicalItemsBySource.get(source);
    if (cached) return cached;
    const result = projectPromptQueueItems(source);
    this.canonicalItemsBySource.set(source, result);
    return result;
  }

  /** Never reproject a prior retained collection: a caller may have made its opaque rows hostile
   * after admission, while focused controlled-update recovery needs only its recorded identities. */
  private cachedCanonicalItemsFor(
    source: unknown
  ): readonly CanonicalPromptQueueItem[] {
    return source !== null &&
      (typeof source === 'object' || typeof source === 'function')
      ? this.canonicalItemsBySource.get(source) ?? EMPTY_CANONICAL_PROMPT_QUEUE_ITEMS
      : EMPTY_CANONICAL_PROMPT_QUEUE_ITEMS;
  }

  private get effectiveItems(): readonly CanonicalPromptQueueItem[] {
    return this.canonicalItemsFor(this.items);
  }

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

    const previousItems = changed.has('items')
      ? this.cachedCanonicalItemsFor(changed.get('items'))
      : EMPTY_CANONICAL_PROMPT_QUEUE_ITEMS;
    const items = this.effectiveItems;
    const rowRemoved = changed.has('items') && !items.some((item) => item.id === focusedId);
    const editorRemoved = editorFocused && changed.has('editable') && !this.editable;
    const controlDisabled = changed.has('disabled') && this.disabled;
    if (!rowRemoved && !editorRemoved && !controlDisabled) return;
    const previousIndex = previousItems.findIndex((item) => item.id === focusedId);
    const target = rowRemoved
      ? items[Math.min(Math.max(previousIndex, 0), items.length - 1)]
      : items.find((item) => item.id === focusedId);
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
    if (this.disabled) return;
    this.emit('lr-queue-change', { items, reason, itemId });
  }

  private edit(item: CanonicalPromptQueueItem, value: string): void {
    if (this.disabled || !this.editable) return;
    this.emitChange(
      this.effectiveItems.map((candidate) => toPromptQueueItem(
        candidate,
        candidate.id === item.id ? value : candidate.value,
      )),
      'edit',
      item.id,
    );
  }

  private removeItem(item: CanonicalPromptQueueItem): void {
    if (this.disabled) return;
    this.emitChange(
      this.effectiveItems
        .filter((candidate) => candidate.id !== item.id)
        .map((candidate) => toPromptQueueItem(candidate)),
      'remove',
      item.id,
    );
  }

  private move(item: CanonicalPromptQueueItem, offset: -1 | 1): void {
    if (this.disabled) return;
    const items = this.effectiveItems;
    const index = items.findIndex((candidate) => candidate.id === item.id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    this.emitChange(next.map((candidate) => toPromptQueueItem(candidate)), 'reorder', item.id);
  }

  private sendNow(item: CanonicalPromptQueueItem): void {
    if (this.disabled) return;
    this.emit('lr-send-now', { item: toPromptQueueItem(item) });
  }

  private containNativeEvent = (event: Event): void => {
    event.stopPropagation();
  };

  private renderItem(item: CanonicalPromptQueueItem, index: number, itemCount: number): TemplateResult {
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
              if (this.disabled || !this.editable) return;
              this.edit(item, event.detail.value);
            }}
          ></lr-textarea>`
        : html`<span part="value">${item.value}</span>`}
      ${item.attachments?.length
        ? html`<ul part="attachments" aria-label=${this.localize('promptInputAttachments')}>
            ${item.attachments.map((attachment) => html`
              <li part="attachment">${attachment.name || this.localize('attachmentUntitledFile')}</li>
            `)}
          </ul>`
        : nothing}
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
          .disabled=${this.disabled || index === itemCount - 1}
          @click=${() => this.move(item, 1)}
        >${this.localize('moveDown')}</lr-button>
        <lr-button
          part="action"
          data-action="send"
          size="xs"
          appearance="plain"
          aria-label=${actionLabel(this.localize('promptQueueSendNow'))}
          .disabled=${this.disabled}
          @click=${() => this.sendNow(item)}
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
    const visibleLabel = this.label || this.localize('promptQueueLabel');
    const accessibleLabel = this.accessibleLabel ?? visibleLabel;
    const items = this.effectiveItems;
    return html`<section
      part="base"
      aria-label=${accessibleLabel}
      tabindex="-1"
      @input=${this.containNativeEvent}
      @change=${this.containNativeEvent}
      @focus=${this.containNativeEvent}
      @blur=${this.containNativeEvent}
    >
      <h3 part="heading">${visibleLabel}</h3>
      ${items.length
        ? html`<ol part="list" role="list">
            ${repeat(items, (item) => item.id, (item, index) => this.renderItem(item, index, items.length))}
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
