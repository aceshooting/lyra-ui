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
  @property() icon = '';
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @property() label = '';
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() type: 'button' | 'submit' | 'reset' = 'button';
  @query('button') private buttonEl?: HTMLButtonElement;
  override focus(options?: FocusOptions): void { this.buttonEl?.focus(options); }
  override blur(): void { this.buttonEl?.blur(); }
  render(): TemplateResult {
    const label = this.accessibleLabel || this.label || this.localize('iconButtonLabel');
    return html`<button part="button" type=${this.type} ?disabled=${this.disabled} aria-label=${label}>${this.icon ? html`<lr-icon name=${this.icon}></lr-icon>` : nothing}<slot></slot></button>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-icon-button': LyraIconButton; } }
