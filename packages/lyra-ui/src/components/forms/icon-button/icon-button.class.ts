import { html, nothing, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './icon-button.styles.js';

/** `<lr-icon-button>` — an accessible icon-only action button.
 *
 * Set `icon` for one of `<lr-icon>`'s named glyphs, or slot your own content instead. Slotted
 * content is a **sibling** of the built-in glyph rather than being piped through `<lr-icon>`, so
 * any complete element — an `<svg>`, an `<img>`, an `<lr-flag>` — renders at its own natural
 * aspect ratio instead of being forced into a 1:1 box. Bare SVG geometry (`<path>`, `<circle>`)
 * has no SVG parent here and must be wrapped in an `<lr-icon>` or a complete `<svg>` of your own.
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

  render(): TemplateResult {
    const label = this.accessibleLabel || this.label || this.localize('iconButtonLabel');
    return html`<button part="button" type="button" ?disabled=${this.disabled} aria-label=${label} @click=${this.onClick}>${this.icon ? html`<lr-icon name=${this.icon}></lr-icon>` : nothing}<slot></slot></button>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-icon-button': LyraIconButton; } }
