import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './mutation-observer.styles.js';

export interface LyraMutationObserverEventMap {
  'lyra-mutation': CustomEvent<{ records: MutationRecord[] }>;
}

/**
 * `<lyra-mutation-observer>` — observes element children in the default slot
 * and forwards native mutation records as a composed event. It is useful for
 * integrating third-party renderers while keeping observer cleanup declarative.
 *
 * @customElement lyra-mutation-observer
 * @slot - Elements to observe.
 * @event lyra-mutation - Observed DOM mutations.
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

  private observers: MutationObserver[] = [];

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('slotchange', this.onSlotChange);
  }

  disconnectedCallback(): void {
    this.removeEventListener('slotchange', this.onSlotChange);
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
    this.observers.forEach((observer) => observer.disconnect());
    this.observers = [];
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
    for (const target of targets) {
      const observer = new MutationObserver((records) => this.emit('lyra-mutation', { records: [...records] }));
      observer.observe(target, options);
      this.observers.push(observer);
    }
  };

  render(): TemplateResult {
    return html`<span part="base"><slot @slotchange=${this.onSlotChange}></slot></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-mutation-observer': LyraMutationObserver;
  }
}
