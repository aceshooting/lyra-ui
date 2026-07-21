import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './icon-button.styles.js';

/** Raw SVG geometry primitives that render nothing when parsed as top-level light-DOM children
 *  with no enclosing `<svg>` of their own (the HTML parser only switches to foreign/SVG content on
 *  a literal `<svg>` or `<math>` start tag). A complete `<svg>`, `<img>`, or custom element is
 *  never in this set and is left completely alone by `needsSvgNamespaceFallback`. */
const BARE_SVG_GEOMETRY_TAGS = new Set([
  'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'ellipse', 'g', 'use',
]);

/** True only for an element that needs the SVG-namespace clone fallback: a whitelisted geometry
 *  tag that was never actually parsed in SVG context (an `SVGElement` instance means it already
 *  has a real SVG parent -- e.g. it arrived nested inside a slotted, complete `<svg>` -- and needs
 *  no help). */
function needsSvgNamespaceFallback(node: Element): boolean {
  return BARE_SVG_GEOMETRY_TAGS.has(node.localName) && !(node instanceof SVGElement);
}

/** Clones `node` into the real SVG namespace, recursively. Never called on (and never recurses
 *  into) a custom element -- `localName.includes('-')` -- since `document.createElementNS`-ing a
 *  custom element yields an inert, never-upgrading node -- the exact bug this function's caller
 *  exists to avoid reintroducing for slotted content like `<lr-flag>`. */
function cloneToSvgNamespace(node: Element): SVGElement | null {
  if (node.localName.includes('-')) return null;
  const copy = document.createElementNS('http://www.w3.org/2000/svg', node.localName);
  for (const attribute of node.attributes) copy.setAttribute(attribute.name, attribute.value);
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      copy.append(child.cloneNode(true));
    } else if (child instanceof Element) {
      const childCopy = cloneToSvgNamespace(child);
      if (childCopy) copy.append(childCopy);
    }
  }
  return copy;
}

/** `<lr-icon-button>` — an accessible icon-only action button.
 *
 * Set `icon` for one of `<lr-icon>`'s named glyphs, or slot your own content instead. Slotted
 * content is a **sibling** of the built-in glyph rather than being piped through `<lr-icon>`, so
 * any complete element — an `<svg>`, an `<img>`, an `<lr-flag>` — renders at its own natural
 * aspect ratio instead of being forced into a 1:1 box. Bare SVG geometry (`<path>`, `<circle>`,
 * and a handful of other raw primitives) with no enclosing `<svg>` of its own is detected and
 * cloned into a real, internal SVG-namespaced element so it still paints — the same fallback
 * `<lr-icon>`'s own custom-content slot uses, but narrowly scoped so a custom element (e.g. a
 * slotted `<lr-flag>`) is never run through it.
 *
 * Form-associated (mirroring `<lr-button>`'s identical shape): discoverable through
 * `form.elements`, and `type="submit"`/`type="reset"` are handled by this component itself via
 * the host's own `closest('form')` — a shadow-internal native `<button type="submit">` does not
 * participate in an ancestor light-DOM form's submission on its own, since form-submitter
 * semantics don't cross the shadow boundary.
 *
 * @customElement lr-icon-button
 * @slot - Optional custom icon content, rendered beside (not inside) the `icon` glyph.
 * @csspart button - Native button.
 * @csspart fallback - The internal SVG-namespaced clone target for slotted bare geometry. Carries
 *   the same `fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"
 *   stroke-linejoin="round"` defaults `<lr-icon>`'s own wrapper svg does, so bare stroke-style
 *   geometry (no fill/stroke of its own) renders outlined instead of as a solid shape; an explicit
 *   `fill`/`stroke`/etc. already present on the slotted node still wins for that node. Only present
 *   in the DOM while at least one top-level slotted element needs it; a complete `<svg>`, `<img>`,
 *   or custom element never mounts it.
 * @cssprop [--lr-icon-button-size=2.5rem] - Minimum tappable inline and block size of the native
 *   button — a **floor**, not a fixed size: content larger than it grows the button and keeps its
 *   own aspect ratio, while a small glyph pads out to it. A library-wide token (declared on
 *   `:root` by `tokens.styles.ts`, and the shared minimum tappable size several other components
 *   size their icon controls against), so overriding it globally resizes all of them together.
 */
export class LyraIconButton extends LyraElement {
  static styles = [LyraElement.styles, styles];
  // A button is form-associated so it is discoverable through form.elements, mirroring
  // <lr-button>'s identical rationale -- see the class doc above.
  static formAssociated = true;

  static properties = {
    disabled: { type: Boolean, reflect: true, noAccessor: true },
  };

  private _disabled = false;

  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const old = this._disabled;
    this._disabled = Boolean(next);
    // Hand-written accessor (mirrors `<lr-button>`'s identical `disabled`, and the shared
    // `FormAssociated` mixin's own `disabled` setter): reflection must happen synchronously,
    // before any same-tick native form API (a `<fieldset>` toggle, `.checkValidity()`) runs --
    // Lit's async `reflect: true` alone would leave a property-only assignment invisible until
    // the next update cycle.
    this.toggleAttribute('disabled', this._disabled);
    this.requestUpdate('disabled', old);
  }

  @property() icon = '';
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @property() label = '';
  /** Forwarded to this component's own submit/reset handling (`onClick` below) — see the class
   *  doc comment for why this component (not the shadow-internal `<button>`) owns that behavior. */
  @property() type: 'button' | 'submit' | 'reset' = 'button';
  @query('button') private buttonEl?: HTMLButtonElement;
  @query('slot') private slotEl?: HTMLSlotElement;
  @query('[part="fallback"]') private fallbackSvgEl?: SVGSVGElement;
  /** Only ever true when `icon` is unset and at least one top-level slotted element is bare SVG
   *  geometry with no SVG parent of its own -- see `needsSvgNamespaceFallback`. Mounts the internal
   *  `[part="fallback"]` SVG, which `updated()` then populates via `syncFallbackGeometry()`. */
  @state() private hasBareGeometry = false;

  constructor() {
    super();
    this.attachInternals();
  }

  /** Activates the internal native button, including submit/reset behavior. */
  override click(): void {
    this.buttonEl?.click();
  }

  override focus(options?: FocusOptions): void { this.buttonEl?.focus(options); }
  override blur(): void { this.buttonEl?.blur(); }

  private onClick = (): void => {
    if (this.type === 'submit') {
      this.closest('form')?.requestSubmit();
    } else if (this.type === 'reset') {
      this.closest('form')?.reset();
    }
  };

  private onSlotChange = (): void => {
    const assigned = this.slotEl?.assignedElements({ flatten: true }) ?? [];
    this.hasBareGeometry = assigned.some((el) => needsSvgNamespaceFallback(el));
  };

  protected updated(changed: PropertyValues): void {
    super.updated(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // updated() layered under this class must still run.
    this.syncFallbackGeometry();
  }

  /** Mirrors `<lr-icon>`'s own `syncCustomNodes()`: repopulates `[part="fallback"]` from scratch
   *  on every update so it never drifts from the currently-assigned bare-geometry elements. */
  private syncFallbackGeometry(): void {
    const svgEl = this.fallbackSvgEl;
    if (!svgEl) return;
    svgEl.replaceChildren();
    const assigned = this.slotEl?.assignedElements({ flatten: true }) ?? [];
    for (const el of assigned) {
      if (!needsSvgNamespaceFallback(el)) continue;
      const copy = cloneToSvgNamespace(el);
      if (copy) svgEl.append(copy);
    }
  }

  render(): TemplateResult {
    const label = this.accessibleLabel || this.label || this.localize('iconButtonLabel');
    return html`<button part="button" type="button" ?disabled=${this.disabled} aria-label=${label} @click=${this.onClick}>${this.icon ? html`<lr-icon name=${this.icon}></lr-icon>` : nothing}${this.hasBareGeometry ? html`<svg part="fallback" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"></svg>` : nothing}<slot @slotchange=${this.onSlotChange}></slot></button>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-icon-button': LyraIconButton; } }
