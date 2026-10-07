import { tag } from './prefix.js';

/**
 * Whether `element` paints nothing while staying in the accessibility tree (or is hidden
 * outright), so it must not count as visible label content.
 *
 * Three shapes, in cost order. `<lr-visually-hidden>` is recognised by tag, since its own `:host`
 * rules are `!important` and cannot be overridden into visibility. `hidden`/`display: none`/
 * `visibility: hidden` are hidden outright. The third is the standard clip-path algorithm every
 * `.sr-only` copy in this library (and `styles/utilities.css`) uses: an absolutely positioned
 * hairline box clipped with `inset(50%)`. Computed style is read rather than class names, so a
 * consumer's own utility class -- whatever it is called -- is recognised too.
 *
 * Returns `false` with no window (SSR): nothing is painted there, so the client's first update is
 * the authority and guessing would make the server and client disagree.
 */
function isVisuallyHidden(element: Element): boolean {
  if (element.localName === tag('visually-hidden')) return true;
  const view = element.ownerDocument.defaultView;
  if (!view) return false;
  const style = view.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return true;
  return style.position === 'absolute' && style.clipPath.startsWith('inset(50%');
}

/**
 * Whether the host's default slot carries exactly one visible element and no text, i.e. an
 * icon-only label. Visually hidden siblings (an `.sr-only` name) do not count as content.
 * Reads light DOM defensively so server-only adapters without `children` answer `false`.
 */
export function hasIconOnlyDefaultContent(host: Element): boolean {
  const childElements = (host as unknown as { children?: HTMLCollection }).children;
  const elements = (childElements ? Array.from(childElements) : [])
    .filter((element) => !element.getAttribute('slot'))
    // A visually hidden label names the action for assistive technology and paints nothing, so
    // counting it as content made an icon+`.sr-only` control render as a wide labelled one with a
    // blank second column. It is invisible content; the icon-only treatment applies.
    .filter((element) => !isVisuallyHidden(element));
  if (elements.length !== 1) return false;
  const childNodes = (host as unknown as { childNodes?: NodeListOf<ChildNode> }).childNodes;
  const directText = (childNodes ? Array.from(childNodes) : [])
    .filter((node) => node.nodeType === 3)
    .map((node) => node.textContent ?? '')
    .join('')
    .trim();
  return directText === '' && (elements[0]?.textContent ?? '').trim() === '';
}

/**
 * Watches a host's default-slot label wrapper so a CSS-only rule (a container/media query hiding
 * or revealing a slotted label, with no DOM mutation and therefore no `slotchange`) still
 * re-evaluates the icon-only state. A resize of the wrapper is the mechanism-agnostic signal a
 * vanishing/returning label produces.
 *
 * Watch the label wrapper, never the host or the control base: once icon-only, the base (and the
 * content-sized host) gets a definite size that no longer depends on the label, so watching those
 * would report the resize on the way in and never again on the way out. The wrapper's own box is
 * never touched by the icon-only treatment, so it tracks the label in both directions.
 *
 * The recompute is deferred to an animation frame, past the observer delivery: a microtask still
 * resolves inside the same delivery, so committing there trips Chromium's "ResizeObserver loop
 * completed with undelivered notifications" once the flip changes the control's own geometry.
 * `onChange` receives the freshly computed value and is called only when it differs from
 * `current()`.
 *
 * `arm()` is idempotent and follows a replaced label (call from every `updated()` and from a
 * reconnect); it no-ops until the label exists or when the realm has no `ResizeObserver` (SSR).
 * `disarm()` on disconnect.
 */
export class IconOnlyLabelObserver {
  private observer?: ResizeObserver;
  private watched?: Element;
  private raf?: number;
  private rafOwner?: Window;

  constructor(
    private readonly host: HTMLElement,
    private readonly label: () => Element | null | undefined,
    private readonly current: () => boolean,
    private readonly onChange: (next: boolean) => void
  ) {}

  arm(): void {
    const label = this.label();
    if (!label || label === this.watched) return;
    const view = this.host.ownerDocument.defaultView;
    const Ctor = view?.ResizeObserver;
    if (!view || !Ctor) return;
    if (this.watched) this.observer?.unobserve(this.watched);
    this.observer ??= new Ctor(() => {
      if (!this.host.isConnected || this.host.ownerDocument.defaultView !== view) return;
      this.cancelFrame();
      this.rafOwner = view;
      this.raf = view.requestAnimationFrame(() => {
        this.raf = undefined;
        this.rafOwner = undefined;
        if (!this.host.isConnected || this.host.ownerDocument.defaultView !== view) return;
        const next = hasIconOnlyDefaultContent(this.host);
        if (next !== this.current()) this.onChange(next);
      });
    });
    this.observer.observe((this.watched = label));
  }

  disarm(): void {
    this.observer?.disconnect();
    this.observer = this.watched = undefined;
    this.cancelFrame();
  }

  private cancelFrame(): void {
    if (this.raf !== undefined) this.rafOwner?.cancelAnimationFrame(this.raf);
    this.raf = undefined;
    this.rafOwner = undefined;
  }
}
