import { collectionSupport } from '../../../internal/collection-snapshot.js';
import type { PropertyValues, TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './mutation-observer.styles.js';
import { ownerObserverConstructor, SlottedObserverController } from '../../../internal/slotted-observer.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
  readOwnArrayLength,
} from '../../../internal/data-descriptors.js';

const MAX_OBSERVER_ATTRIBUTE_FILTERS = 10_000;

function normalizedAttributeFilter(value: unknown): readonly string[] {
  try {
    if (!Array.isArray(value)) return Object.freeze([]);
    const length = readOwnArrayLength(value);
    if (length === undefined) return Object.freeze([]);
    const values: string[] = [];
    for (let index = 0; index < Math.min(length, MAX_OBSERVER_ATTRIBUTE_FILTERS); index += 1) {
      const entry = getOwnDataDescriptor(value, String(index));
      if (
        entry === MISSING_OWN_DATA_DESCRIPTOR ||
        entry === UNSAFE_OWN_DATA_DESCRIPTOR ||
        typeof entry.value !== 'string'
      )
        continue;
      values.push(entry.value);
    }
    return Object.freeze(values);
  } catch {
    return Object.freeze([]);
  }
}

export interface LyraMutationObserverEventMap {
  'lr-mutation': CustomEvent<
    Readonly<{
      records: readonly MutationRecord[];
      mutationList: readonly MutationRecord[];
    }>
  >;
}

/**
 * `<lr-mutation-observer>` — observes element children in the default slot
 * and forwards native mutation records as a composed event. It is useful for
 * integrating third-party renderers while keeping observer cleanup declarative.
 *
 * @customElement lr-mutation-observer
 * @slot - Elements to observe.
 * @event lr-mutation - Observed DOM mutations; `detail.records` and
 * `detail.mutationList` reference the same frozen readonly batch, whose native records retain
 * identity.
 * @csspart base - The non-layout wrapper around the observed slot.
 * @status stable
 * @since 4.0.0
 */
export class LyraMutationObserver extends LyraElement<LyraMutationObserverEventMap> {
  static override styles = [LyraElement.styles, styles];
  protected static override collectionSupport = collectionSupport;

  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-mutation',
  ]);

  protected static override readonly identityEventDetailCollectionItems =
    Object.freeze({
      'lr-mutation': Object.freeze(['records', 'mutationList']),
    });

  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, attribute: 'child-list', reflect: true }) childList = false;
  /** Mapped attribute selector: `*` observes all attributes; otherwise use space-separated names. */
  @property({ reflect: true }) attr: string | null = null;
  @property({ type: Boolean, attribute: 'attr-old-value', reflect: true }) attrOldValue = false;
  @property({ type: Boolean, attribute: 'char-data', reflect: true }) charData = false;
  @property({ type: Boolean, attribute: 'char-data-old-value', reflect: true }) charDataOldValue = false;
  /** Observes only the slotted elements themselves, not their descendants (the native
   *  `subtree: false` option). */
  @property({ type: Boolean, attribute: 'without-subtree' }) withoutSubtree = false;
  @property({
    attribute: false,
    hasChanged: (value, old) => normalizedAttributeFilter(value).join() !== normalizedAttributeFilter(old).join(),
  })
  attributeFilter: string[] = [];

  private readonly slotted = new SlottedObserverController<MutationObserver>(this, {
    schedule: (rebuild) => this.scheduleAfterUpdate(rebuild),
    // Records queued before a reconfiguration belong to the old options; deliver them first.
    flush: (observer) => {
      const pending = Object.freeze(observer.takeRecords());
      return pending.length > 0 ? () => this.emit('lr-mutation', { records: pending, mutationList: pending }) : undefined;
    },
    configure: (ownerDocument) => {
      const MutationObserverCtor = ownerObserverConstructor(ownerDocument, 'MutationObserver');
      const disabled = this.disabled === true;
      const childList = this.childList === true;
      const attrValue = this.attr;
      const attr = typeof attrValue === 'string' ? attrValue.trim() : null;
      const attrTokens = (attr ?? '').split(/\s+/).filter(Boolean);
      const mappedAttributes = attr === '*' || attrTokens.length > 0;
      const attrOldValue = this.attrOldValue === true;
      const charData = this.charData === true;
      const charDataOldValue = this.charDataOldValue === true;
      const subtree = this.withoutSubtree !== true;
      const attributeFilter = attr === null ? normalizedAttributeFilter(this.attributeFilter) : Object.freeze([]);
      const observesAttributes = mappedAttributes || attrOldValue || attributeFilter.length > 0;
      const observesCharacterData = charData || charDataOldValue;
      if (disabled || !MutationObserverCtor || (!childList && !observesAttributes && !observesCharacterData)) return undefined;
      const options: MutationObserverInit = { childList, attributes: observesAttributes, characterData: observesCharacterData, subtree };
      const mappedFilter = attr === '*' ? Object.freeze([]) : Object.freeze(attrTokens);
      const effectiveFilter = attr === null ? attributeFilter : mappedFilter;
      if (effectiveFilter.length > 0) options.attributeFilter = [...effectiveFilter];
      if (attrOldValue && observesAttributes) options.attributeOldValue = true;
      if (charDataOldValue && observesCharacterData) options.characterDataOldValue = true;
      return {
        create: (session) => new MutationObserverCtor((records) => {
          if (!session.current()) return;
          let mutationList: readonly MutationRecord[];
          try {
            mutationList = Object.freeze([...records]);
          } catch {
            return;
          }
          this.emit('lr-mutation', { records: mutationList, mutationList });
        }),
        observe: (observer, target) => observer.observe(target, options),
      };
    },
  });

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.slotted.retire();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (
      [
        'disabled',
        'childList',
        'attr',
        'attrOldValue',
        'charData',
        'charDataOldValue',
        'withoutSubtree',
        'attributeFilter',
      ].some((key) => changed.has(key))
    ) {
      this.slotted.schedule();
    }
  }

  override render(): TemplateResult {
    return this.slotted.renderSlot();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-mutation-observer': LyraMutationObserver;
  }
}
