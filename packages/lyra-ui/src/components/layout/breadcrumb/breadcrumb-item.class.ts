import { html, nothing, type TemplateResult } from "lit";
import { property } from "lit/decorators.js";
import { hostAriaLabel } from "../../../internal/a11y.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { safeLinkHref } from "../../../internal/safe-url.js";
import { SlotPresenceController } from "../../../internal/slot-presence-controller.js";
import { styles } from "./breadcrumb-item.styles.js";

export type BreadcrumbItemTarget = '_blank' | '_parent' | '_self' | '_top';

/**
 * `<lr-breadcrumb-item>` — one link, button, or current-page label in a breadcrumb.
 * A host `aria-label` is forwarded by attribute presence to the non-current
 * native link or button, including an explicitly empty value.
 *
 * @customElement lr-breadcrumb-item
 * @slot - Item label.
 * @slot start - Content before the label.
 * @slot prefix - Shoelace-compatible alias for `start`.
 * @slot end - Content after the label.
 * @slot suffix - Shoelace-compatible alias for `end`.
 * @slot separator - Decorative visual separator shown before non-first items; defaults to `/`.
 *   Content is always inert and aria-hidden, so it must not supply interactive behavior, a focus
 *   target, or form state.
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
 * @cssprop --lr-breadcrumb-item-active-bg - Link/button pressed background; defaults to the
 *   former transparent active mix.
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
  /** Native link target. When present, the rendered anchor always contributes
   * `noopener noreferrer` to `rel` — author tokens are merged, not ignored (see `rel`). */
  @property() target?: BreadcrumbItemTarget;
  /** Author-settable link relationship, merged with a non-negotiable security floor: `opener` is
   *  always stripped, and `noopener noreferrer` is force-added whenever `target` is set.
   *
   *  Defaults to `'noreferrer noopener'`, which is what BOTH `wa-breadcrumb-item` and
   *  `sl-breadcrumb-item` declare — unlike `lr-button`, where the two upstreams disagree and Lyra
   *  therefore keeps no default. */
  @property() rel = 'noreferrer noopener';

  /** Author tokens minus `opener`, plus the guard whenever `target` is set. `undefined` when
   *  nothing remains, so the attribute is omitted rather than rendered empty. */
  private get resolvedRel(): string | undefined {
    const authored = (this.rel ?? '')
      .split(/\s+/)
      .filter((token) => token !== '' && token.toLowerCase() !== 'opener');
    const tokens = new Set(authored);
    if (this.target) {
      tokens.add('noopener');
      tokens.add('noreferrer');
    }
    return tokens.size > 0 ? [...tokens].join(' ') : undefined;
  }
  @property({ type: Boolean, reflect: true }) current = false;
  private readonly slots = new SlotPresenceController(this);
  override connectedCallback(): void {
    super.connectedCallback();
    this.setAttribute("role", "listitem");
  }

  /** Activates the internal link or button. Current-page labels remain inert. */
  override click(): void {
    if (this.current) return;
    this.renderRoot
      .querySelector<HTMLAnchorElement | HTMLButtonElement>('[part~="base"]')
      ?.click();
  }

  override render(): TemplateResult {
    const href = safeLinkHref(this.href);
    const ariaLabel = hostAriaLabel(this);
    const separator = html`<span part="separator" aria-hidden="true" inert><slot name="separator">/</slot></span>`;
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
            rel=${this.resolvedRel ?? nothing}
            aria-label=${ariaLabel ?? nothing}
            aria-current="false"
          >${label}</a>`
        : this.current
          ? html`<span part="base" aria-current="page">${label}</span>`
          : html`<button part="base" type="button" aria-label=${ariaLabel ?? nothing} aria-current="false">${label}</button>`;
    return html`${separator}${base}`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "lr-breadcrumb-item": LyraBreadcrumbItem;
  }
}
