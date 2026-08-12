import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  syncAriaControlsElements,
  syncAriaDescribedByElements,
} from '../../../internal/aria-controls.js';
import { styles } from './icon-button.styles.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import {
  attachInternalsSafely,
  getFormOwner,
  setFormOwner,
  type FormOwnerValue,
} from '../../../internal/form-associated.js';
import { safeDownloadHref, safeLinkHref } from '../../../internal/safe-url.js';
import { isUnsafeSvgCloneAttribute } from '../../../internal/safe-svg.js';
import {
  EXTERNAL_LABEL_ACTIVATION,
  type ExternalLabelActivation,
} from '../../../internal/form-control-labels.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_iconButtonLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface LyraIconButtonEventMap {
  focus: FocusEvent;
  blur: FocusEvent;
  'lr-focus': CustomEvent<undefined>;
  'lr-blur': CustomEvent<undefined>;
}

/** Raw SVG geometry primitives that render nothing when parsed as top-level light-DOM children
 *  with no enclosing `<svg>` of their own (the HTML parser only switches to foreign/SVG content on
 *  a literal `<svg>` or `<math>` start tag). A complete `<svg>`, `<img>`, or custom element is
 *  never in this set and is left completely alone by `needsSvgNamespaceFallback`. */
const BARE_SVG_GEOMETRY_TAGS = new Set([
  'path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'ellipse', 'g', 'use',
]);
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** True only for an element that needs the SVG-namespace clone fallback: a whitelisted geometry
 *  tag that was never actually parsed in SVG context (the namespace check works even when the
 *  slotted node was created by another browsing context). */
function needsSvgNamespaceFallback(node: Element): boolean {
  return BARE_SVG_GEOMETRY_TAGS.has(node.localName) && node.namespaceURI !== SVG_NAMESPACE;
}

/** Clones `node` into the real SVG namespace, recursively. Never called on (and never recurses
 *  into) a custom element -- `localName.includes('-')` -- since namespace-creating a custom
 *  element yields an inert, never-upgrading node -- the exact bug this function's caller exists
 *  to avoid reintroducing for slotted content like `<lr-flag>`. */
function cloneToSvgNamespace(node: Element): SVGElement | null {
  if (node.localName.includes('-')) return null;
  const copy = node.ownerDocument.createElementNS(SVG_NAMESPACE, node.localName);
  for (const attribute of node.attributes) {
    if (isUnsafeSvgCloneAttribute(attribute.name)) continue;
    copy.setAttribute(attribute.name, attribute.value);
  }
  for (const child of node.childNodes) {
    if (child.nodeType === 3) {
      copy.append(child.cloneNode(true));
    } else if (child.nodeType === 1) {
      const childCopy = cloneToSvgNamespace(child as Element);
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
 * Host `aria-haspopup` and `aria-expanded` values are forwarded reactively to the shadow-internal
 * native button. Host `aria-describedby` IDREFs are resolved through `ariaDescribedByElements`.
 * When host `aria-controls` names elements in the host's own root, the controls relationship is
 * resolved onto that focused control through the reflected element-reference API so it remains
 * valid across this component's shadow boundary. Assigning that relationship intentionally clears
 * the serialized `aria-controls` value; read `ariaControlsElements` in a supporting browser.
 * Browsers without that API retain the forwarded string attribute as a best-effort fallback.
 *
 * Form-associated (mirroring `<lr-button>`'s identical shape): discoverable through
 * `form.elements`, and `type="submit"`/`type="reset"` are handled by this component itself via
 * the host's associated form — a shadow-internal native `<button type="submit">` does not
 * participate in an ancestor light-DOM form's submission on its own, since form-submitter
 * semantics don't cross the shadow boundary.
 *
 * A safe `href` switches the interactive root to a native anchor. `target` derives
 * `rel="noopener noreferrer"`; `download` narrows URL validation to downloadable schemes. A
 * disabled link keeps the anchor anatomy but removes `href`, so it cannot navigate.
 *
 * Component-scoped theme inputs remain undeclared on the host, so values inherited from an
 * ancestor theme wrapper override the built-in fallback. A value set directly on the icon button
 * still wins through normal custom-property inheritance.
 *
 * @customElement lr-icon-button
 * @event focus - Native focus relayed once from the internal button.
 * @event blur - Native blur relayed once from the internal button.
 * @event lr-focus - Prefixed compatibility alias for `focus`.
 * @event lr-blur - Prefixed compatibility alias for `blur`.
 * @slot - Optional custom icon content, rendered beside (not inside) the `icon` glyph.
 * @csspart base - Shoelace compatibility name for the interactive native control; use `button`.
 * @csspart button - Native button, or the native anchor in safe link mode. The same node also
 *   carries `base`.
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
 * @cssprop [--lr-icon-button-radius=var(--lr-radius)] - Corner radius of the native button.
 * @cssprop [--lr-icon-button-background=transparent] - Background fill of the native button.
 * @cssprop [--lr-icon-button-background-hover=color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-hover))] -
 *   Background fill on hover. Before 8.0.0 this fell back to `var(--lr-color-surface)` — the page
 *   background — so on a default page a hovered icon button painted itself the colour it was
 *   already sitting on and showed no hover at all.
 * @cssprop [--lr-icon-button-background-active=color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active))] -
 *   Background fill while pressed: the same mix at the stronger `--lr-color-mix-active` share, so
 *   the pressed state is visibly more than the hover.
 * @cssprop [--lr-icon-button-color=inherit] - Icon/text color of the native button.
 * @cssprop [--lr-icon-button-color-hover=var(--lr-icon-button-color, inherit)] - Icon/text color
 *   on hover.
 * @cssprop [--lr-icon-button-color-active=var(--lr-icon-button-color-hover, var(--lr-icon-button-color, inherit))] -
 *   Icon/text color while pressed; falls through to the hover colour when only that is set.
 * @cssprop [--lr-icon-button-border=0] - Complete border shorthand of the native button.
 * @cssprop [--lr-icon-button-border-hover=var(--lr-icon-button-border, 0)] - Complete border
 *   shorthand on hover.
 * @cssprop [--lr-icon-button-border-active=var(--lr-icon-button-border-hover, var(--lr-icon-button-border, 0))] -
 *   Complete border shorthand while pressed; falls through to the hover border when only that is set.
 * @status stable
 * @since 4.0.0
 */
export class LyraIconButton extends LyraElement<LyraIconButtonEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    iconButtonLabel: LYRA_DEFAULT_iconButtonLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  // A button is form-associated so it is discoverable through form.elements, mirroring
  // <lr-button>'s identical rationale -- see the class doc above.
  static formAssociated = true;

  static override properties = {
    disabled: { type: Boolean, reflect: true, noAccessor: true },
  };

  private _disabled = false;
  private _fieldsetDisabled = false;
  private hasSyncedDescribedByElements = false;
  private internals: ElementInternals;

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

  /** Whether the control is disabled directly or by an ancestor fieldset. */
  get effectiveDisabled(): boolean {
    return this._disabled || this._fieldsetDisabled;
  }

  /** Canonical Lyra glyph name. Shoelace's `name` alias delegates to the same state. */
  @property() icon = '';
  /** Shoelace alias for `icon`. Reads and writes remain synchronized in both directions; an
   * upstream `undefined` write clears both to the canonical empty-string read value. */
  @property()
  get name(): string { return this.icon; }
  set name(next: string | undefined) { this.icon = next ?? ''; }
  /** Icon-library name forwarded to the nested `<lr-icon>`. */
  @property() library?: string;
  /** Remote SVG URL forwarded to the nested `<lr-icon>` and handled by its guarded loader. */
  @property() src?: string;
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @property({ attribute: 'aria-haspopup' }) private triggerHasPopup: string | null = null;
  @property({ attribute: 'aria-expanded' }) private triggerExpanded: string | null = null;
  @property({ attribute: 'aria-controls' }) private triggerControls: string | null = null;
  @property({ attribute: 'aria-describedby' }) private triggerDescribedBy: string | null = null;
  @property() label = '';
  /** Safe link URL. When valid, the native root is an anchor rather than a button. */
  @property() href?: string;
  /** Native anchor target. A non-empty target always derives a safe `rel`. */
  @property() target?: string;
  /** Native anchor download filename; also selects the stricter download URL allowlist. */
  @property() download?: string;
  /** Forwarded to this component's own submit/reset handling (`onClick` below) — see the class
   *  doc comment for why this component (not the shadow-internal `<button>`) owns that behavior. */
  @property() type: 'button' | 'submit' | 'reset' = 'button';
  @query('[part~="button"]') private baseEl?: HTMLButtonElement | HTMLAnchorElement;
  @query('slot') private slotEl?: HTMLSlotElement;
  @query('[part="fallback"]') private fallbackSvgEl?: SVGSVGElement;
  /** Only ever true when `icon` is unset and at least one top-level slotted element is bare SVG
   *  geometry with no SVG parent of its own -- see `needsSvgNamespaceFallback`. Mounts the internal
   *  `[part="fallback"]` SVG, which `updated()` then populates via `syncFallbackGeometry()`. */
  @state() private hasBareGeometry = false;

  constructor() {
    super();
    this.internals = attachInternalsSafely(this);
  }

  get form(): HTMLFormElement | null { return getFormOwner(this.internals); }
  set form(owner: FormOwnerValue) { setFormOwner(this, owner); }
  getForm(): HTMLFormElement | null { return getFormOwner(this.internals); }
  get labels(): NodeList { return this.internals.labels; }

  /** Activates the internal native button, including submit/reset behavior. */
  override click(): void {
    if (this.effectiveDisabled) return;
    this.baseEl?.click();
  }

  override focus(options?: FocusOptions): void {
    if (!this.effectiveDisabled) this.baseEl?.focus(options);
  }
  override blur(): void { this.baseEl?.blur(); }

  /** A native `<button>`'s label activates it rather than merely focusing it, so an external
   *  `<label for>` runs this button's submit/reset behavior once. See `<lr-button>` for why the
   *  internal element's role cannot be used to infer this.
   *  @internal */
  [EXTERNAL_LABEL_ACTIVATION](): ExternalLabelActivation {
    return 'activate';
  }

  private onClick = (): void => {
    if (this.effectiveDisabled) return;
    if (this.type === 'submit') {
      this.getForm()?.requestSubmit();
    } else if (this.type === 'reset') {
      this.getForm()?.reset();
    }
  };

  private onFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
    this.emit('lr-focus');
  };

  private onBlur = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
    this.emit('lr-blur');
  };

  formDisabledCallback(disabled: boolean): void {
    this._fieldsetDisabled = disabled;
    this.requestUpdate();
  }

  private onSlotChange = (): void => {
    const assigned = this.slotEl?.assignedElements({ flatten: true }) ?? [];
    this.hasBareGeometry = assigned.some((el) => needsSvgNamespaceFallback(el));
  };

  protected override updated(changed: PropertyValues): void {
    super.updated(changed); // no-op in LyraElement/ReactiveElement today, but a future mixin's
    // updated() layered under this class must still run.
    this.syncFallbackGeometry();
    syncAriaControlsElements(this, this.baseEl, this.triggerControls);
    this.syncDescribedByElements();
  }

  private syncDescribedByElements(): void {
    if (!this.triggerDescribedBy && !this.hasSyncedDescribedByElements) return;
    this.hasSyncedDescribedByElements = syncAriaDescribedByElements(
      this,
      this.baseEl,
      this.triggerDescribedBy,
    );
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

  override render(): TemplateResult {
    const label = this.accessibleLabel || this.label || this.localize('iconButtonLabel');
    const content = html`${this.icon || this.src
      ? html`<lr-icon
          name=${this.icon || nothing}
          library=${this.library || nothing}
          src=${this.src || nothing}
        ></lr-icon>`
      : nothing}${this.hasBareGeometry
      ? html`<svg part="fallback" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"></svg>`
      : nothing}<slot @slotchange=${this.onSlotChange}></slot>`;
    const href = this.download ? safeDownloadHref(this.href) : safeLinkHref(this.href);

    if (href) {
      const disabled = this.effectiveDisabled;
      return html`<a
        part="base button"
        href=${disabled ? nothing : href}
        target=${this.target || nothing}
        rel=${this.target ? 'noopener noreferrer' : nothing}
        download=${this.download || nothing}
        aria-label=${label}
        aria-haspopup=${this.triggerHasPopup ?? nothing}
        aria-expanded=${this.triggerExpanded ?? nothing}
        aria-controls=${this.triggerControls || nothing}
        aria-describedby=${this.triggerDescribedBy || nothing}
        aria-disabled=${disabled ? 'true' : nothing}
        tabindex=${disabled ? '-1' : nothing}
        @focus=${this.onFocus}
        @blur=${this.onBlur}
      >${content}</a>`;
    }

    return html`<button
      part="base button"
      type="button"
      ?disabled=${this.effectiveDisabled}
      aria-label=${label}
      aria-haspopup=${this.triggerHasPopup ?? nothing}
      aria-expanded=${this.triggerExpanded ?? nothing}
      aria-controls=${this.triggerControls || nothing}
      aria-describedby=${this.triggerDescribedBy || nothing}
      @click=${this.onClick}
      @focus=${this.onFocus}
      @blur=${this.onBlur}
    >${content}</button>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-icon-button': LyraIconButton; } }
