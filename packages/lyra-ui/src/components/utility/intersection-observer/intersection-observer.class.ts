import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './intersection-observer.styles.js';

export interface LyraIntersectionObserverEventMap {
  'lr-intersection': CustomEvent<{ entries: IntersectionObserverEntry[] }>;
}

/**
 * `<lr-intersection-observer>` — observes slotted targets entering or
 * leaving a viewport and emits the native intersection entries without adding
 * layout or requiring consumers to manage observer lifecycle.
 *
 * @customElement lr-intersection-observer
 * @slot - Elements to observe.
 * @event lr-intersection - Intersection state changed.
 * @csspart base - The non-layout wrapper around the observed slot.
 */
export class LyraIntersectionObserver extends LyraElement<LyraIntersectionObserverEventMap> {
  static styles = [LyraElement.styles, styles];

  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ attribute: 'root-margin' }) rootMargin = '0px';
  @property({ attribute: false }) threshold: number | number[] = 0;
  @property({ attribute: false }) root: Element | null = null;

  private observer?: IntersectionObserver;

  connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-and-drop reparent, a tab/panel re-hosting its
    // children, a virtualized list moving this same element instance) fires
    // disconnectedCallback then connectedCallback synchronously with no
    // update and no slotchange in between (the assigned-node set is
    // unchanged by a pure reparent) -- so neither updated()'s
    // property-change gate nor a fresh slotchange ever fires to re-arm
    // observation. disconnectedCallback already tore the previous
    // IntersectionObserver down, so resume it here on every reconnect after
    // the very first (that initial case is already covered by the first
    // render's own slotchange).
    if (this.hasUpdated) this.scheduleAfterUpdate(this.observeTargets);
  }

  disconnectedCallback(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    super.disconnectedCallback();
  }

  protected updated(changed: PropertyValues): void {
    // Routed through the base class's connection-aware scheduler rather than
    // a bare queueMicrotask: Lit still runs a scheduled update (and this
    // method) even for an element that disconnects before that update's own
    // microtask fires, and a plain queueMicrotask has no way to notice that
    // and would still spin up a new, now-unreachable IntersectionObserver that
    // disconnectedCallback has already run and won't run again to clean up.
    if (changed.has('disabled') || changed.has('rootMargin') || changed.has('threshold') || changed.has('root')) this.scheduleAfterUpdate(this.observeTargets);
  }

  private onSlotChange = (): void => this.observeTargets();

  private observeTargets = (): void => {
    this.observer?.disconnect();
    this.observer = undefined;
    if (this.disabled || typeof IntersectionObserver === 'undefined') return;
    const slot = this.renderRoot.querySelector('slot');
    const targets = slot?.assignedElements({ flatten: true }).filter((element): element is Element => element instanceof Element) ?? [];
    if (targets.length === 0) return;
    this.observer = new IntersectionObserver((entries) => this.emit('lr-intersection', { entries: [...entries] }), {
      root: this.root instanceof Element ? this.root : null,
      rootMargin: this.rootMargin,
      threshold: this.threshold,
    });
    targets.forEach((target) => this.observer!.observe(target));
  };

  render(): TemplateResult {
    return html`<span part="base"><slot @slotchange=${this.onSlotChange}></slot></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-intersection-observer': LyraIntersectionObserver;
  }
}
