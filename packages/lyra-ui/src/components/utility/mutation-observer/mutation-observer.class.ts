import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './mutation-observer.styles.js';
import { trueDefaultBooleanConverter } from '../../../internal/converters.js';
import { disconnectObserver, slottedElementTargets } from '../../../internal/slotted-observer.js';

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
  /**
   * Lyra compatibility alias for `attr` (its unfiltered boolean form, equivalent to `attr: '*'`
   * -- observes every attribute with no name filtering). Reflects like every other mapped
   * observer attribute on this element so DOM introspection (`outerHTML`, attribute selectors,
   * SSR re-serialization) stays consistent with a property assignment, not just a declarative one.
   */
  @property({ type: Boolean, attribute: 'attributes', reflect: true }) observeAttributes = false;
  /**
   * Lyra compatibility alias for `charData`. Reflects like every other mapped observer attribute
   * on this element so DOM introspection stays consistent with a property assignment, not just a
   * declarative one.
   */
  @property({ type: Boolean, attribute: 'character-data', reflect: true }) characterData = false;
  @property({ type: Boolean, converter: trueDefaultBooleanConverter }) subtree = true;
  @property({ attribute: false }) attributeFilter: string[] = [];

  private observer?: MutationObserver;
  private observerDocument?: Document;
  private observerGeneration = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-and-drop reparent, a tab/panel re-hosting its
    // children, a virtualized list moving this same element instance) fires
    // disconnectedCallback then connectedCallback synchronously with no
    // update and no slotchange in between (the assigned-node set is
    // unchanged by a pure reparent) -- so neither updated()'s
    // property-change gate nor a fresh slotchange ever fires to re-arm
    // observation. disconnectedCallback already tore the previous
    // MutationObserver down, so resume it here on every reconnect after the
    // very first (that initial case is already covered by the first
    // render's own slotchange).
    if (this.hasUpdated) this.scheduleAfterUpdate(this.observeTargets);
  }

  override disconnectedCallback(): void {
    this.disconnect();
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.disconnect();
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
        'observeAttributes',
        'characterData',
        'subtree',
        'attributeFilter',
      ].some((key) => changed.has(key))
    ) {
      this.scheduleAfterUpdate(this.observeTargets);
    }
  }

  private onSlotChange = (): void => this.observeTargets();

  private disconnect(): void {
    this.observerGeneration += 1;
    this.observer = disconnectObserver(this.observer);
    this.observerDocument = undefined;
  }

  private observeTargets = (): void => {
    this.disconnect();
    const ownerDocument = this.ownerDocument;
    const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
    if (this.disabled || !this.isConnected || !MutationObserverCtor) return;
    const targets = slottedElementTargets(this.renderRoot);
    const attr = this.attr?.trim() ?? null;
    const attrTokens = (attr ?? '').split(/\s+/).filter(Boolean);
    const mappedAttributes = attr === '*' || attrTokens.length > 0;
    const observesAttributes =
      mappedAttributes || this.attrOldValue || this.observeAttributes || this.attributeFilter.length > 0;
    const observesCharacterData = this.charData || this.charDataOldValue || this.characterData;
    if (targets.length === 0 || (!this.childList && !observesAttributes && !observesCharacterData)) return;
    const options: MutationObserverInit = {
      childList: this.childList,
      attributes: observesAttributes,
      characterData: observesCharacterData,
      subtree: this.subtree,
    };
    const attributeFilter = attr === null ? this.attributeFilter : attr === '*' ? [] : attrTokens;
    if (attributeFilter.length > 0) options.attributeFilter = attributeFilter;
    if (this.attrOldValue && observesAttributes) options.attributeOldValue = true;
    if (this.charDataOldValue && observesCharacterData) options.characterDataOldValue = true;
    // One shared observer across every slotted target (mirrors <lr-intersection-observer>'s and
    // <lr-resize-observer>'s identical single-instance pattern) rather than one instance per
    // target -- MutationObserver natively supports observing multiple nodes and batches every
    // mutation queued in the same microtask into a single callback invocation, so two targets
    // mutated synchronously in the same script produce one coalesced `lr-mutation` event instead
    // of one per target.
    const generation = this.observerGeneration;
    const observer = new MutationObserverCtor((records) => {
      if (
        this.observer !== observer ||
        this.observerDocument !== ownerDocument ||
        this.observerGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      const mutationList = Object.freeze([...records]);
      this.emit('lr-mutation', { records: mutationList, mutationList });
    });
    this.observer = observer;
    this.observerDocument = ownerDocument;
    for (const target of targets) observer.observe(target, options);
  };

  override render(): TemplateResult {
    return html`<span part="base"><slot @slotchange=${this.onSlotChange}></slot></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-mutation-observer': LyraMutationObserver;
  }
}
