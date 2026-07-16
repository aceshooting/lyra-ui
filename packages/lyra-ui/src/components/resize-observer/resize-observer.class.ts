import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './resize-observer.styles.js';

export type ResizeObserverBox = 'content-box' | 'border-box' | 'device-pixel-content-box';

export interface LyraResizeObserverEventMap {
  'lyra-resize': CustomEvent<{ entries: ResizeObserverEntry[] }>;
}

/**
 * `<lyra-resize-observer>` — observes the first-party or consumer-owned
 * elements in its default slot and emits typed resize entries. The wrapper has
 * no visual layout of its own (`display: contents`).
 *
 * @customElement lyra-resize-observer
 * @slot - Elements to observe.
 * @event lyra-resize - Observed elements changed size.
 * @csspart base - The non-layout wrapper around the observed slot.
 */
export class LyraResizeObserver extends LyraElement<LyraResizeObserverEventMap> {
  static styles = [LyraElement.styles, styles];

  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ reflect: true }) box: ResizeObserverBox = 'content-box';

  private observer?: ResizeObserver;

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
    // Routed through the base class's connection-aware scheduler rather than
    // a bare queueMicrotask: Lit still runs a scheduled update (and this
    // method) even for an element that disconnects before that update's own
    // microtask fires, and a plain queueMicrotask has no way to notice that
    // and would still spin up a new, now-unreachable ResizeObserver that
    // disconnectedCallback has already run and won't run again to clean up.
    if (changed.has('disabled') || changed.has('box')) this.scheduleAfterUpdate(this.observeTargets);
  }

  private onSlotChange = (): void => this.observeTargets();

  private disconnect(): void {
    this.observer?.disconnect();
    this.observer = undefined;
  }

  private observeTargets = (): void => {
    this.disconnect();
    if (this.disabled) return;
    const slot = this.renderRoot.querySelector('slot');
    const targets = slot?.assignedElements({ flatten: true }) ?? [];
    if (targets.length === 0 || typeof ResizeObserver === 'undefined') return;
    this.observer = new ResizeObserver((entries) => this.emit('lyra-resize', { entries: [...entries] }));
    for (const target of targets) {
      try {
        this.observer.observe(target, { box: this.box });
      } catch {
        this.observer.observe(target);
      }
    }
  };

  render(): TemplateResult {
    return html`<span part="base"><slot @slotchange=${this.onSlotChange}></slot></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-resize-observer': LyraResizeObserver;
  }
}
