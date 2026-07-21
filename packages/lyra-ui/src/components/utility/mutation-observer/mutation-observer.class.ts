import { html, type ComplexAttributeConverter, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './mutation-observer.styles.js';

export interface LyraMutationObserverEventMap {
  'lr-mutation': CustomEvent<{ records: MutationRecord[] }>;
}

/** `true`-defaulting boolean attribute converter -- Lit's default presence-based `type: Boolean`
 *  can never be set back to `false` from a plain-HTML attribute once a property's own default is
 *  `true` (removing an attribute that was never present fires no `attributeChangedCallback`), so
 *  `fromAttribute` checks the literal string instead. Shared by `child-list` and `subtree`, which
 *  have the identical `true`-default parsing need -- duplicated locally rather than imported,
 *  matching this exact converter's repeated per-component convention elsewhere in this library
 *  (see e.g. `<lr-task-list>`'s own `trueDefaultBooleanConverter`). */
const trueDefaultBooleanConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
  toAttribute(value): string | null {
    return value ? null : 'false';
  },
};

/**
 * `<lr-mutation-observer>` — observes element children in the default slot
 * and forwards native mutation records as a composed event. It is useful for
 * integrating third-party renderers while keeping observer cleanup declarative.
 *
 * @customElement lr-mutation-observer
 * @slot - Elements to observe.
 * @event lr-mutation - Observed DOM mutations.
 * @csspart base - The non-layout wrapper around the observed slot.
 */
export class LyraMutationObserver extends LyraElement<LyraMutationObserverEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, attribute: 'child-list', converter: trueDefaultBooleanConverter }) childList = true;
  @property({ type: Boolean, attribute: 'attributes' }) observeAttributes = false;
  @property({ type: Boolean, attribute: 'character-data' }) characterData = false;
  @property({ type: Boolean, converter: trueDefaultBooleanConverter }) subtree = true;
  @property({ attribute: false }) attributeFilter: string[] = [];

  private observer?: MutationObserver;

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

  protected override updated(changed: PropertyValues): void {
    if (['disabled', 'childList', 'observeAttributes', 'characterData', 'subtree', 'attributeFilter'].some((key) => changed.has(key))) {
      queueMicrotask(this.observeTargets);
    }
  }

  private onSlotChange = (): void => this.observeTargets();

  private disconnect(): void {
    this.observer?.disconnect();
    this.observer = undefined;
  }

  private observeTargets = (): void => {
    this.disconnect();
    if (this.disabled || typeof MutationObserver === 'undefined') return;
    const slot = this.renderRoot.querySelector('slot');
    const targets = slot?.assignedElements({ flatten: true }).filter((element): element is Element => element instanceof Element) ?? [];
    if (targets.length === 0 || (!this.childList && !this.observeAttributes && !this.characterData)) return;
    const options: MutationObserverInit = {
      childList: this.childList,
      attributes: this.observeAttributes,
      characterData: this.characterData,
      subtree: this.subtree,
    };
    if (this.attributeFilter.length > 0) options.attributeFilter = this.attributeFilter;
    // One shared observer across every slotted target (mirrors <lr-intersection-observer>'s and
    // <lr-resize-observer>'s identical single-instance pattern) rather than one instance per
    // target -- MutationObserver natively supports observing multiple nodes and batches every
    // mutation queued in the same microtask into a single callback invocation, so two targets
    // mutated synchronously in the same script produce one coalesced `lr-mutation` event instead
    // of one per target.
    this.observer = new MutationObserver((records) => this.emit('lr-mutation', { records: [...records] }));
    for (const target of targets) this.observer.observe(target, options);
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
