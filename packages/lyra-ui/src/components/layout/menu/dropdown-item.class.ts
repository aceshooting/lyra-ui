import type { PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraMenuItem, type LyraMenuItemEventMap } from './menu-item.class.js';
import type { MenuFocusTarget } from './menu-shared.js';

export interface LyraDropdownItemEventMap extends LyraMenuItemEventMap {
  focus: FocusEvent;
  blur: FocusEvent;
}

/**
 * `<lr-dropdown-item>` — the Web Awesome-compatible name for a menu item.
 * It is intentionally a subclass of `<lr-menu-item>`, so it participates in
 * the same roving focus, checkbox, selection, and menu event contracts — and
 * in the same `size` ladder, including the `small`/`medium`/`large` spellings.
 *
 * @customElement lr-dropdown-item
 * @slot - The item's visual label content. Its flattened subtree is inert and hidden from assistive
 *   technology; its accessible text names the host menu item.
 * @slot icon - Optional decorative leading icon. Its flattened subtree is inert and hidden from
 *   assistive technology.
 * @slot prefix - Shoelace-compatible decorative alias for leading content. Its flattened subtree is
 *   inert and hidden from assistive technology.
 * @slot details - Decorative WA-compatible secondary detail text. Its flattened subtree is inert and
 *   hidden from assistive technology.
 * @slot suffix - Shoelace-compatible decorative trailing content. Its flattened subtree is inert and
 *   hidden from assistive technology.
 * @slot submenu - A nested `<lr-menu>` or direct mapped dropdown items that open beside this row.
 * @event focus - Native, non-bubbling, composed, non-cancelable `FocusEvent` emitted by the
 * focusable host when it gains focus.
 * @event blur - Native, non-bubbling, composed, non-cancelable `FocusEvent` emitted by the
 * focusable host when it loses focus.
 * @attr {boolean} submenuopen - Normalized Web Awesome compatibility alias for `submenu-open`;
 *   both spellings reflect the live submenu state and changing either spelling controls it.
 * @csspart base - The visual item row.
 * @csspart checkmark - WA-compatible checkbox glyph.
 * @csspart checked-icon - Shoelace-compatible checkbox-glyph wrapper.
 * @csspart icon - Leading icon wrapper.
 * @csspart prefix - Shoelace-compatible leading-content wrapper.
 * @csspart label - Label wrapper.
 * @csspart details - WA-compatible detail wrapper.
 * @csspart suffix - Shoelace-compatible trailing-content wrapper.
 * @csspart spinner - Loading spinner.
 * @csspart spinner__base - Shoelace-compatible spinner alias.
 * @csspart submenu-icon - Submenu chevron wrapper.
 * @csspart submenu - Submenu panel/wrapper.
 * @method openSubmenu - Opens the submenu and resolves after its open state settles.
 * @method closeSubmenu - Closes the submenu and resolves after its closed state settles.
 * @status stable
 * @since 4.0.0
 */
export class LyraDropdownItem extends LyraMenuItem {
  static override get observedAttributes(): string[] {
    // Web Awesome publishes the mixed-case `submenuOpen` spelling. HTML lowercases authored
    // attribute names before custom-element observation, while Lyra keeps kebab-case canonical.
    return [...new Set([...super.observedAttributes, 'submenuopen'])];
  }

  private pendingAuthoredOpen = false;
  private authoredOpenRequestPending = false;
  private syncingSubmenuAttributes = false;

  private syncSubmenuAttributes(open: boolean): void {
    if (this.syncingSubmenuAttributes) return;
    this.syncingSubmenuAttributes = true;
    try {
      this.toggleAttribute('submenu-open', open);
      this.toggleAttribute('submenuopen', open);
    } finally {
      this.syncingSubmenuAttributes = false;
    }
  }

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void {
    if (name === 'submenuopen') {
      if (this.syncingSubmenuAttributes || oldValue === newValue) return;
      const requestedOpen = newValue !== null;
      this.authoredOpenRequestPending = requestedOpen;
      this.submenuOpen = requestedOpen;
      this.syncSubmenuAttributes(requestedOpen);
      if (requestedOpen && this.submenuOpen)
        this.authoredOpenRequestPending = false;
      return;
    }
    if (name === 'submenu-open') {
      if (this.syncingSubmenuAttributes || oldValue === newValue) return;
      const requestedOpen = newValue !== null;
      this.authoredOpenRequestPending = requestedOpen;
      super.attributeChangedCallback(name, oldValue, newValue);
      this.syncSubmenuAttributes(requestedOpen);
      if (requestedOpen && this.submenuOpen)
        this.authoredOpenRequestPending = false;
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
  }

  /** Whether the submenu is currently open. Assigning it, or changing the reflected
   * `submenu-open` attribute, drives the same panel as `openSubmenu()` / `closeSubmenu()` without
   * moving focus. The normalized upstream `submenuopen` attribute is a permanent, bidirectionally
   * synchronized compatibility alias: changing either spelling controls the state, while every
   * internal dismissal clears both so a stale alias cannot reopen the panel. Like those methods, an
   * authored open request waits until submenu content is connected.
   * @default false */
  @property({ type: Boolean, reflect: true, attribute: 'submenu-open' })
  override get submenuOpen(): boolean {
    return super.submenuOpen;
  }
  override set submenuOpen(next: boolean) {
    const normalized = Boolean(next);
    if (normalized === super.submenuOpen) {
      if (!normalized) {
        this.authoredOpenRequestPending = false;
        this.syncSubmenuAttributes(false);
      }
      return;
    }
    if (normalized) void super.openSubmenu('none');
    else {
      this.authoredOpenRequestPending = false;
      void super.closeSubmenu();
    }
  }

  protected override willUpdate(changed: PropertyValues): void {
    // The superclass owns the canonical reflection. Fence its attribute write so it cannot be
    // mistaken for a fresh authored request, then mirror the requested/actual state to both names.
    this.syncingSubmenuAttributes = true;
    try {
      super.willUpdate(changed);
    } finally {
      this.syncingSubmenuAttributes = false;
    }
    if (this.submenuOpen) this.authoredOpenRequestPending = false;
    this.syncSubmenuAttributes(
      this.submenuOpen || this.authoredOpenRequestPending
    );
  }

  protected override update(changed: PropertyValues): void {
    // Lit performs `reflect: true` writes inside update(), after willUpdate(). Keep that second
    // internal canonical write behind the same fence, then restore a not-yet-applied authored open
    // request or mirror the live panel state before updated() decides whether to queue it.
    this.syncingSubmenuAttributes = true;
    try {
      super.update(changed);
    } finally {
      this.syncingSubmenuAttributes = false;
    }
    this.syncSubmenuAttributes(
      this.submenuOpen || this.authoredOpenRequestPending
    );
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // Attribute callbacks can run before slotted submenu content has connected. Retain either
    // authored spelling as the requested state and apply it once the panel exists.
    if (
      this.hasSubmenu &&
      !this.submenuOpen &&
      !this.pendingAuthoredOpen &&
      (this.hasAttribute('submenu-open') || this.hasAttribute('submenuopen'))
    ) {
      this.pendingAuthoredOpen = true;
      queueMicrotask(() => {
        this.pendingAuthoredOpen = false;
        if (
          this.isConnected &&
          this.hasSubmenu &&
          !this.submenuOpen &&
          (this.hasAttribute('submenu-open') ||
            this.hasAttribute('submenuopen'))
        ) {
          void this.openSubmenu('none');
        }
      });
    }
  }

  override disconnectedCallback(): void {
    this.authoredOpenRequestPending = false;
    super.disconnectedCallback();
    // Open submenu state is transient. Clear both reflections now so even a synchronous reparent
    // cannot present the normalized alias as a fresh request on reconnect.
    this.syncSubmenuAttributes(false);
  }

  /** Opens the submenu and resolves after the panel state and render settle. The optional focus
   * target preserves Lyra's existing menu-controller vocabulary while the no-argument call is the
   * mapped Web Awesome contract. */
  override async openSubmenu(focus: MenuFocusTarget = 'first'): Promise<void> {
    await super.openSubmenu(focus);
  }

  /** Closes the submenu and resolves after the panel state and render settle. */
  override async closeSubmenu(): Promise<void> {
    this.authoredOpenRequestPending = false;
    await super.closeSubmenu();
    this.syncSubmenuAttributes(this.submenuOpen);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-dropdown-item': LyraDropdownItem;
  }
}
