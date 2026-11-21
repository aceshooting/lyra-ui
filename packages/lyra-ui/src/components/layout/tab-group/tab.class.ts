import { html, nothing, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { closeIcon } from '../../../internal/icons.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import { styles } from './tab.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_close } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


interface TabFocusOwner extends Element {
  readonly updateComplete: Promise<boolean>;
  focusTabElement(element: Element, options?: FocusOptions): boolean;
  blurTabElement(element: Element): void;
}

export interface LyraTabEventMap {
  'lr-close': CustomEvent<null>;
}

/**
 * `<lr-tab>` — one tab in a `<lr-tab-group>`'s strip. Mirrors `wa-tab` / `sl-tab`.
 *
 * A declarative descriptor, not the interactive control: `<lr-tab-group>` renders the real
 * `role="tab"` button and projects this element's content into it, so the whole ARIA and
 * roving-tabindex contract stays in one place. That means the content may be rich (an icon plus a
 * label, a badge), but its direct element roots are inert while projected so the button remains the
 * sole action. The group's real button gets only the default slot's accessibility-exposed flattened
 * text as its accessible name; author-hidden, inert, or CSS-hidden branches do not contribute.
 *
 * Pair it with a `<lr-tab-panel>` whose `name` matches this element's `panel`.
 * `closable` adds a localized visual close affordance. It shares the owning tab's single APG focus
 * stop rather than nesting another interactive control inside the group's real tab button: click
 * the affordance, or press Delete while the real tab button is focused. Either path emits the
 * noncancelable `lr-close` notification without selecting or removing the tab; the owning
 * application decides whether and when to remove the matching tab and panel.
 *
 * @customElement lr-tab
 * @slot - The tab's visual label content. Its direct default-slot element roots are inert while the
 *   owning group projects them; their accessibility-exposed flattened text names the real tab button.
 * @event lr-close - Emitted when the close affordance is clicked or Delete is pressed on its
 *   focused owning tab. Bubbles, is composed, and is not cancelable; the component does not remove
 *   itself. The name is not dialog-scoped in this library: a tab strip nested inside a consumer's
 *   own `<lr-dialog>` has this event observed by that dialog's own `lr-close` listener too. See
 *   `<lr-dialog>`'s own `lr-close` docs for the full list of emitters and the
 *   `event.target !== event.currentTarget` guard.
 * @csspart base - Compatibility name for the tab content wrapper; use `tab`.
 * @csspart tab - The tab content wrapper. It is the same node as `base`.
 * @csspart close-button - The non-focusable visual close affordance shown when `closable` is true.
 * @csspart close-button__base - Compatibility alias on the same close affordance as `close-button`.
 * @cssprop [--lr-tab-close-hover-bg] - Close hover background override.
 * @cssprop [--lr-tab-close-active-bg] - Close active background override.
 * @status stable
 * @since 8.0.0
 */
export class LyraTab extends LyraElement<LyraTabEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    close: LYRA_DEFAULT_close,
  };
  // GENERATED DEFAULT-STRING SLICE: END

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

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.focusAwaitsOwner = false;
  }

  /** A `focus()` queued before this descriptor rendered also waits for the group's projection. */
  private focusAwaitsOwner = false;

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

  /** The owning `<lr-tab-group>` when it is upgraded, or `undefined`. */
  private get owner(): TabFocusOwner | undefined {
    const parent = this.parentElement as (Element & Partial<TabFocusOwner>) | null;
    return parent && parent.localName === tag('tab-group') && typeof parent.focusTabElement === 'function'
      ? parent as TabFocusOwner
      : undefined;
  }

  /** Focuses the real `role="tab"` button the owning group renders for this descriptor, exactly
   *  as the group's `focusTab(panel)` does (under `activation="auto"` that also selects it). A
   *  disabled or inert tab, or one outside an upgraded group, is not focusable and is left alone. */
  override focus(options?: FocusOptions): void {
    if (this.deferFocusUntilRendered(options)) {
      this.focusAwaitsOwner = true;
      return;
    }
    const owner = this.owner;
    if (owner && this.focusAwaitsOwner) {
      // The group projects its real tab buttons only once its own update settles.
      this.focusAwaitsOwner = false;
      void owner.updateComplete.then(() => {
        if (this.owner === owner) owner.focusTabElement(this, options);
      });
      return;
    }
    if (!owner?.focusTabElement(this, options)) super.focus(options);
  }

  /** Removes focus from the owning group's real tab button when it is focused. */
  override blur(): void {
    const owner = this.owner;
    if (owner) owner.blurTabElement(this);
    else super.blur();
  }

  /** @internal Owning-group seam for the focused tab's `Delete` shortcut. */
  requestCloseFromOwner(): void {
    if (!this.closable || this.disabled) return;
    this.emit('lr-close', null);
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
