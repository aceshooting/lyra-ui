import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './resize-observer.styles.js';
import { disconnectObserver, slottedElementTargets } from '../../../internal/slotted-observer.js';

export type ResizeObserverBox = 'content-box' | 'border-box' | 'device-pixel-content-box';

export interface LyraResizeObserverEventMap {
  'lr-resize': CustomEvent<{ entries: ResizeObserverEntry[] }>;
}

/**
 * `<lr-resize-observer>` — observes the first-party or consumer-owned
 * elements in its default slot and emits typed resize entries. The wrapper has
 * no visual layout of its own (`display: contents`).
 *
 * @customElement lr-resize-observer
 * @slot - Elements to observe.
 * @event lr-resize - Observed elements changed size.
 * @csspart base - The non-layout wrapper around the observed slot.
 * @status stable
 * @since 4.0.0
 */
export class LyraResizeObserver extends LyraElement<LyraResizeObserverEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ reflect: true }) box: ResizeObserverBox = 'content-box';

  private observer?: ResizeObserver;
  private observerDocument?: Document;
  private observerGeneration = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    // No host-level `slotchange` listener here, matching <lr-mutation-observer> and
    // <lr-intersection-observer>: the internal `<slot>`'s own `@slotchange` binding is the single
    // driver of re-observation. It covers the nested slot-forwarding composition too (a wrapper
    // whose shadow root places a `<slot>` directly inside this element) -- verified in Chromium,
    // Firefox and WebKit, the internal slot fires its own slotchange there as well. A host-level
    // listener additionally catches the forwarding slot's own bubbling slotchange, which only ever
    // tore the ResizeObserver down and rebuilt it a second time for the same change.
    // A reconnect (e.g. a drag-and-drop reparent, a tab/panel re-hosting its
    // children, a virtualized list moving this same element instance) fires
    // disconnectedCallback then connectedCallback synchronously with no
    // update and no slotchange in between (the assigned-node set is
    // unchanged by a pure reparent) -- so neither updated()'s
    // `changed.has('disabled') || changed.has('box')` gate nor a fresh
    // slotchange ever fires to re-arm observation. disconnectedCallback
    // already tore the previous ResizeObserver down, so resume it here on
    // every reconnect after the very first (that initial case is already
    // covered by the first render's own slotchange).
    if (this.hasUpdated) this.scheduleAfterUpdate(this.observeTargets);
  }

  override disconnectedCallback(): void {
    this.disconnect();
    super.disconnectedCallback();
  }

  adoptedCallback(): void {
    this.disconnect();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
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
    this.observerGeneration += 1;
    this.observer = disconnectObserver(this.observer);
    this.observerDocument = undefined;
  }

  private observeTargets = (): void => {
    this.disconnect();
    const ownerDocument = this.ownerDocument;
    const ResizeObserverCtor = ownerDocument.defaultView?.ResizeObserver;
    if (this.disabled || !this.isConnected || !ResizeObserverCtor) return;
    const targets = slottedElementTargets(this.renderRoot);
    if (targets.length === 0) return;
    const generation = this.observerGeneration;
    const observer = new ResizeObserverCtor((entries) => {
      if (
        this.observer !== observer ||
        this.observerDocument !== ownerDocument ||
        this.observerGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.emit('lr-resize', { entries: [...entries] });
    });
    this.observer = observer;
    this.observerDocument = ownerDocument;
    for (const target of targets) {
      try {
        observer.observe(target, { box: this.box });
      } catch {
        observer.observe(target);
      }
    }
  };

  override render(): TemplateResult {
    return html`<span part="base"><slot @slotchange=${this.onSlotChange}></slot></span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-resize-observer': LyraResizeObserver;
  }
}
