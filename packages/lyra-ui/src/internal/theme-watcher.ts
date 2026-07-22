import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * Notifies a host when the effective color theme may have changed, so canvas-rendered components
 * (which can't read CSS `var()` and must re-resolve colors through `getComputedStyle` on every
 * draw) can redraw. Two signals are watched:
 *
 * - `prefers-color-scheme: dark` via `matchMedia`, and
 * - `class`/`style`/`data-theme`/`data-color-scheme` attribute mutations on the host **and every
 *   ancestor** — the usual levers an app flips to switch themes.
 *
 * Callbacks are coalesced to a single microtask, so a burst of attribute writes triggers one
 * `onChange`. Teardown rides on `hostDisconnected()`. This is the shared extraction of the
 * `watchTheme`/`queueThemeRefresh`/`onColorSchemeChange` trio that `lr-heatmap`, `lr-qr-code`, and
 * `lr-audio-visualizer` each hand-rolled; SVG/DOM components (e.g. `lr-lite-chart`) read `var()`
 * natively and need none of this, so it is adopted per-component, not on a base class.
 */
export class ThemeWatcher implements ReactiveController {
  private colorSchemeQuery?: MediaQueryList;
  private observer?: MutationObserver;
  private queued = false;

  constructor(
    private readonly host: ReactiveControllerHost & Element,
    /** Invoked (coalesced to one microtask) when the effective theme may have changed. */
    private readonly onChange: () => void,
  ) {
    host.addController(this);
  }

  hostConnected(): void {
    const view = this.host.ownerDocument.defaultView;
    if (!view) return;
    this.colorSchemeQuery = view.matchMedia?.('(prefers-color-scheme: dark)');
    this.colorSchemeQuery?.addEventListener('change', this.onColorSchemeChange);

    if (typeof MutationObserver === 'undefined') return;
    const targets: Element[] = [this.host];
    let parent = this.host.parentElement;
    while (parent) {
      targets.push(parent);
      parent = parent.parentElement;
    }
    this.observer = new MutationObserver(this.queueChange);
    for (const target of targets) {
      this.observer.observe(target, {
        attributes: true,
        attributeFilter: ['class', 'style', 'data-theme', 'data-color-scheme'],
      });
    }
  }

  hostDisconnected(): void {
    this.colorSchemeQuery?.removeEventListener('change', this.onColorSchemeChange);
    this.colorSchemeQuery = undefined;
    this.observer?.disconnect();
    this.observer = undefined;
  }

  private onColorSchemeChange = (): void => {
    this.onChange();
  };

  private queueChange = (): void => {
    if (this.queued) return;
    this.queued = true;
    queueMicrotask(() => {
      this.queued = false;
      if (this.host.isConnected) this.onChange();
    });
  };
}
