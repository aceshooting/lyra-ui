import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './mutation-observer.styles.js';

export interface LyraMutationObserverEventMap {
  'lr-mutation': CustomEvent<{ records: MutationRecord[] }>;
}

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
  static styles = [LyraElement.styles, styles];

  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, attribute: 'child-list' }) childList = true;
  @property({ type: Boolean, attribute: 'attributes' }) observeAttributes = false;
  @property({ type: Boolean, attribute: 'character-data' }) characterData = false;
  @property({ type: Boolean }) subtree = true;
  @property({ attribute: false }) attributeFilter: string[] = [];

  private observer?: MutationObserver;

  connectedCallback(): void {
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

  disconnectedCallback(): void {
    this.disconnect();
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues): void {
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

  render(): TemplateResult {
    return html`<span part="base"><slot @slotchange=${this.onSlotChange}></slot></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-mutation-observer': LyraMutationObserver;
  }
}
