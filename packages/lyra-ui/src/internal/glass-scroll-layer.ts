import type { ReactiveController, ReactiveControllerHost } from 'lit';

/** Keeps a decorative sticky layer aligned with its public scrollport without measuring on scroll. */
export class GlassScrollLayer implements ReactiveController {
  private observer?: ResizeObserver;
  private surface?: HTMLElement;
  private layer?: HTMLElement;

  private readonly handleScroll = (): void => {
    if (!this.surface || !this.layer) return;
    // Native vertical stickiness is stable across directions. Compensating only the horizontal
    // offset also keeps the layer stationary in engines whose RTL sticky inline constraint drifts.
    const offset = `${this.surface.scrollLeft}px`;
    if (this.layer.style.getPropertyValue('--_lr-glass-scroll-offset') !== offset) {
      this.layer.style.setProperty('--_lr-glass-scroll-offset', offset);
    }
  };

  constructor(private readonly host: ReactiveControllerHost & HTMLElement, private readonly selector: string) {
    host.addController(this);
  }

  hostUpdated(): void {
    const surface = this.host.shadowRoot?.querySelector<HTMLElement>(this.selector) ?? undefined;
    if (surface === this.surface) {
      this.scheduleMeasure();
      return;
    }
    this.observer?.disconnect();
    this.surface?.removeEventListener('scroll', this.handleScroll);
    this.surface = surface;
    this.layer = undefined;
    if (!surface) return;
    surface.addEventListener('scroll', this.handleScroll, { passive: true });
    const Observer = this.host.ownerDocument.defaultView?.ResizeObserver;
    if (Observer) {
      this.observer = new Observer(() => this.measure());
      this.observer.observe(surface);
    }
    this.scheduleMeasure();
  }

  hostDisconnected(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    this.surface?.removeEventListener('scroll', this.handleScroll);
    this.surface = undefined;
    this.layer = undefined;
  }

  hostConnected(): void {
    // Reconnection need not schedule another Lit update.
    if (this.host.shadowRoot) this.hostUpdated();
  }

  private scheduleMeasure(): void {
    const surface = this.surface;
    // Lit calls controllers before updated(); defer the first layout read until reflected state
    // and component-owned layout work have settled, avoiding an unintended initial transition.
    queueMicrotask(() => {
      if (this.host.isConnected && this.surface === surface) this.measure();
    });
  }

  private measure(): void {
    const surface = this.surface;
    const view = surface?.ownerDocument.defaultView;
    if (!surface || !view) return;
    const layer = surface.querySelector<HTMLElement>(':scope > .glass-scroll-layer');
    if (!layer) return;
    this.layer = layer;
    this.handleScroll();
    const styles = view.getComputedStyle(surface);
    const values = {
      '--_lr-glass-viewport-width': `${surface.clientWidth}px`,
      '--_lr-glass-viewport-height': `${surface.clientHeight}px`,
      '--_lr-glass-padding-inline-start': styles.paddingInlineStart,
      '--_lr-glass-padding-top': styles.paddingTop,
    };
    for (const [name, value] of Object.entries(values)) {
      if (layer.style.getPropertyValue(name) !== value) layer.style.setProperty(name, value);
    }
  }
}
