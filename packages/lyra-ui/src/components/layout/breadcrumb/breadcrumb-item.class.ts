import { html, nothing, type TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { safeLinkHref } from "../../../internal/safe-url.js";
import { SlotPresenceController } from "../../../internal/slot-presence-controller.js";
import { styles } from "./breadcrumb-item.styles.js";

export type BreadcrumbItemTarget = '_blank' | '_parent' | '_self' | '_top';

/**
 * `<lr-breadcrumb-item>` — one link, button, or current-page label in a breadcrumb.
 *
 * @customElement lr-breadcrumb-item
 * @slot - Item label.
 * @slot start - Content before the label.
 * @slot prefix - Shoelace-compatible alias for `start`.
 * @slot end - Content after the label.
 * @slot suffix - Shoelace-compatible alias for `end`.
 * @slot separator - Separator shown before non-first items; defaults to `/`.
 * @csspart separator - Decorative separator shown before non-first items.
 * @csspart base - The link, button, or current-page label.
 * @csspart label - Wrapper around the default label slot.
 * @csspart start - Wrapper around the `start` and `prefix` slots.
 * @csspart prefix - Shoelace-compatible alias for `start`.
 * @csspart end - Wrapper around the `end` and `suffix` slots.
 * @csspart suffix - Shoelace-compatible alias for `end`.
 * @cssprop [--lr-breadcrumb-current-color=var(--lr-color-text-quiet)] - Text color of the
 *   current-page item (`current`/`aria-current="page"`). Declared as an inline `var()` fallback
 *   (never on `:host`), so setting it on the element or an ancestor recolors only the current item
 *   without hijacking the library-wide `--lr-color-text-quiet` token.
 * @status stable
 * @since 4.0.0
 */
export class LyraBreadcrumbItem extends LyraElement {
  static override styles = [LyraElement.styles, styles];
  private _href = '';
  /** Optional URL. A safe URL renders a native anchor; an unset URL renders a native button for
   * non-current items. Assigning the upstream `undefined` spelling clears back to the canonical
   * empty-string read value. */
  @property()
  get href(): string {
    return this._href;
  }
  set href(value: string | undefined) {
    const old = this._href;
    this._href = value ?? '';
    this.requestUpdate('href', old);
  }
  /** Native link target. When present, the rendered anchor always derives
   * `rel="noopener noreferrer"`; `rel` is intentionally not independently settable. */
  @property() target?: BreadcrumbItemTarget;
  @property({ type: Boolean, reflect: true }) current = false;
  private readonly slots = new SlotPresenceController(this);
  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("role", "listitem");
  }
  override render(): TemplateResult {
    const href = safeLinkHref(this.href);
    const separator = html`<span part="separator" aria-hidden="true"><slot name="separator">/</slot></span>`;
    const label = html`
      <span part="start prefix" ?hidden=${!this.slots.has('start') && !this.slots.has('prefix')}>
        <slot name="start"></slot><slot name="prefix"></slot>
      </span>
      <span part="label"><slot></slot></span>
      <span part="end suffix" ?hidden=${!this.slots.has('end') && !this.slots.has('suffix')}>
        <slot name="end"></slot><slot name="suffix"></slot>
      </span>
    `;
    const base =
      href && !this.current
        ? html`<a
            part="base"
            href=${href}
            target=${this.target || nothing}
            rel=${this.target ? 'noopener noreferrer' : nothing}
            aria-current="false"
          >${label}</a>`
        : this.current
          ? html`<span part="base" aria-current="page">${label}</span>`
          : html`<button part="base" type="button" aria-current="false">${label}</button>`;
    return html`${separator}${base}`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "lr-breadcrumb-item": LyraBreadcrumbItem;
  }
}
