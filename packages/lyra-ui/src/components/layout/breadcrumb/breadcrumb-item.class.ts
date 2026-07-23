import { html, nothing, type TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { safeLinkHref } from "../../../internal/safe-url.js";
import { styles } from "./breadcrumb-item.styles.js";

/**
 * `<lr-breadcrumb-item>` — one link or current-page label in a breadcrumb.
 *
 * @customElement lr-breadcrumb-item
 * @slot - Item label.
 * @csspart separator - Decorative separator shown before non-first items.
 * @csspart base - The link or current-page label.
 * @cssprop [--lr-breadcrumb-current-color=var(--lr-color-text-quiet)] - Text color of the
 *   current-page item (`current`/`aria-current="page"`). Declared as an inline `var()` fallback
 *   (never on `:host`), so setting it on the element or an ancestor recolors only the current item
 *   without hijacking the library-wide `--lr-color-text-quiet` token.
 */
export class LyraBreadcrumbItem extends LyraElement {
  static override styles = [LyraElement.styles, styles];
  @property() href = "";
  @property({ type: Boolean, reflect: true }) current = false;
  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("role", "listitem");
  }
  override render(): TemplateResult {
    const href = safeLinkHref(this.href);
    const separator = html`<span part="separator" aria-hidden="true">/</span>`;
    const base =
      href && !this.current
        ? html`<a part="base" href=${href}><slot></slot></a>`
        : html`<span part="base" aria-current=${this.current ? "page" : nothing}
            ><slot></slot
          ></span>`;
    return html`${separator}${base}`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "lr-breadcrumb-item": LyraBreadcrumbItem;
  }
}
