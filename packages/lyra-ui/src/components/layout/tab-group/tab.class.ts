import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { closeIcon } from '../../../internal/icons.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { styles } from './tab.styles.js';

export interface LyraTabEventMap {
  'lr-close': CustomEvent<undefined>;
}

/**
 * `<lr-tab>` — one tab in a `<lr-tab-group>`'s strip. Mirrors `wa-tab` / `sl-tab`.
 *
 * A declarative descriptor, not the interactive control: `<lr-tab-group>` renders the real
 * `role="tab"` button and projects this element's content into it, so the whole ARIA and
 * roving-tabindex contract stays in one place. That means the content may be rich (an icon plus a
 * label, a badge) while the button's accessible name is still exactly that content's text.
 *
 * Pair it with a `<lr-tab-panel>` whose `name` matches this element's `panel`.
 * `closable` adds a localized visual close affordance. It shares the owning tab's single APG focus
 * stop rather than nesting another interactive control inside the group's real tab button: click
 * the affordance, or press Delete while the real tab button is focused. Either path emits the
 * noncancelable `lr-close` notification without selecting or removing the tab; the owning
 * application decides whether and when to remove the matching tab and panel.
 *
 * @customElement lr-tab
 * @slot - The tab's visible content.
 * @event lr-close - Emitted when the close affordance is clicked or Delete is pressed on its
 *   focused owning tab. Bubbles, is composed, and is not cancelable; the component does not remove
 *   itself.
 * @csspart base - Compatibility name for the tab content wrapper; use `tab`.
 * @csspart tab - The tab content wrapper. It is the same node as `base`.
 * @csspart close-button - The non-focusable visual close affordance shown when `closable` is true.
 * @csspart close-button__base - Compatibility alias on the same close affordance as `close-button`.
 * @status stable
 * @since 8.0.0
 */
export class LyraTab extends LyraElement<LyraTabEventMap> {
  static override styles = [LyraElement.styles, styles];

  /** The `name` of the `<lr-tab-panel>` this tab reveals. */
  @property({ reflect: true }) panel = '';

  /** Removes the tab from keyboard navigation and prevents activation. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Whether this tab is the active tab. The owning group keeps this synchronized for hydrated
   * markup; setting it explicitly supplies the matching SSR hint. */
  @property({ type: Boolean, reflect: true }) active = false;

  /** Shows a localized close affordance. Clicking it or pressing Delete on the focused owning tab
   * emits `lr-close`; it never removes the tab. The visual affordance is non-focusable because the
   * group projects it into the real tab button. */
  @property({ type: Boolean, reflect: true }) closable = false;

  override connectedCallback(): void {
    super.connectedCallback();
    // Both upstreams place tab descriptors in the group's `nav` slot automatically. The Lyra
    // group may replace it with an opaque projection slot after hydration, but pre-hydration and
    // standalone markup still expose the public slot contract.
    if (!this.hasAttribute('slot')) this.slot = 'nav';
  }

  private onClosePointerDown = (event: PointerEvent): void => {
    // The descriptor is projected into the group's real tab button. Keep pressing its nested close
    // action from moving focus to or activating that outer selection control.
    event.preventDefault();
    event.stopPropagation();
  };

  private onCloseClick = (event: MouseEvent): void => {
    event.stopPropagation();
    this.requestCloseFromOwner();
  };

  /** @internal Owning-group seam for the focused tab's `Delete` shortcut. */
  requestCloseFromOwner(): void {
    if (!this.closable || this.disabled) return;
    this.emit<undefined>('lr-close', undefined);
  }

  override render(): TemplateResult {
    return html`
      <slot part="base tab"></slot>
      ${this.closable
        ? html`
            <span
              part="close-button close-button__base"
              aria-hidden="true"
              title=${this.localize('close')}
              @pointerdown=${this.onClosePointerDown}
              @click=${this.onCloseClick}
            >${closeIcon()}</span>
          `
        : nothing}
    `;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-tab': LyraTab; } }
