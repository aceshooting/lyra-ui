import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import type { Placement } from '@floating-ui/dom';
import type { PlaceStrategy, PlaceSync } from '../../../internal/positioner.js';
import { tag } from '../../../internal/prefix.js';
import type { LyraSize } from '../../../internal/variants.js';
import type { MenuFocusTarget } from '../../layout/menu/menu-shared.js';
import type { LyraMenu, MenuItemSelectDetail } from '../../layout/menu/menu.class.js';
import {
  LyraPopover,
  type LyraPopoverEventMap,
  type LyraPopupRole,
} from './popover.class.js';
import { styles } from './dropdown.styles.js';

export type { PlaceSync };

const menuTag = unsafeStatic(tag('menu'));

export interface LyraDropdownEventMap extends LyraPopoverEventMap {
  'lr-select': CustomEvent<MenuItemSelectDetail>;
}

interface ConsumerMenuSnapshot {
  dropdownOwner: LyraMenu['dropdownOwner'];
  dropdownContained: boolean;
  dropdownRendersMenuRole: boolean;
  dropdownStayOpenOnSelect: boolean;
  dropdownSize: LyraMenu['dropdownSize'];
  dropdownLabel: LyraMenu['dropdownLabel'];
  dropdownOpen: boolean;
}

/**
 * `<lr-dropdown>` — a trigger-owned action menu. The public host remains the Popover-style
 * trigger/positioning shell, but that shell is semantic-neutral: a contained `<lr-menu>` is the
 * sole role/name owner and supplies roving focus, type-ahead, nested submenu intent, selection,
 * and focus return for mapped dropdown items. A consumer-supplied `<lr-menu>` in the default slot
 * becomes that contained engine instead of being wrapped in a second menu, preserving its own
 * header/list/footer regions and naming precedence. Motion resolves through
 * `dropdown.show`/`dropdown.hide` in the public animation registry without changing the inherited
 * Popover lifecycle. ArrowDown and ArrowUp open the menu and focus its first or last enabled item
 * whether the trigger is slotted or resolved through `for`.
 *
 * @customElement lr-dropdown
 * @slot trigger - The interactive element that toggles the dropdown.
 * @slot - `<lr-dropdown-item>`/`<lr-menu-item>` rows, or one consumer-supplied `<lr-menu>`.
 * @event lr-show - The dropdown is about to open. Cancelable.
 * @event lr-after-show - The dropdown is open and its transition has finished.
 * @event lr-hide - The dropdown is about to close. Cancelable.
 * @event lr-after-hide - The dropdown is closed and its transition has finished.
 * @event lr-select - A menu item was activated. `detail: { item }`. Cancelable; preventing the
 *   event keeps the dropdown and any selected submenu open.
 * @method show - `show(): Promise<void>` — opens unless disabled and resolves after
 *   `lr-after-show`.
 * @method hide - `hide(options?): Promise<void>` — closes, returns focus by default, and resolves
 *   after `lr-after-hide`.
 * @method reposition - Immediately recomputes the popup position.
 * @method focusOnTrigger - Focuses the consumer-supplied trigger.
 * @method getMenu - Returns the currently contained menu engine.
 * @csspart trigger - The trigger wrapper.
 * @csspart base - Web Awesome compatibility name on the positioned popup.
 * @csspart base__popup - Shoelace compatibility name on the positioned popup.
 * @csspart panel - Shoelace compatibility name on the positioned popup.
 * @csspart menu - The contained menu engine.
 * @cssprop [--show-duration=var(--lr-transition-fast)] - Opening transition duration.
 * @cssprop [--hide-duration=var(--lr-transition-fast)] - Closing transition duration.
 * @cssprop [--max-width=var(--lr-overlay-max-inline-size,var(--lr-size-20rem))] - Maximum inline
 *   size inherited from the popover surface.
 * @cssprop [--arrow-size=var(--lr-overlay-arrow-size,var(--lr-size-0-375rem))] - Arrow half-width
 *   inherited from the popover surface.
 * @cssprop --lr-overlay-max-inline-size - Maximum inline size of the popup.
 * @cssprop --lr-overlay-arrow-size - Retained Lyra arrow-size fallback.
 * @status stable
 * @since 4.0.0
 */
export class LyraDropdown extends LyraPopover<LyraDropdownEventMap> {
  static override styles = [LyraPopover.styles, styles];

  /** Dropdowns sit flush against their trigger by default; generic popovers retain eight pixels. */
  override distance = 0;

  /** Action menus retain their mapped below-trigger placement. */
  override placement: Placement = 'bottom-start';

  /** Dropdowns do not render a pointer unless a consumer explicitly enables it. */
  override arrow = false;

  /** Density propagated to directly owned mapped items. */
  @property({ reflect: true }) size: LyraSize = 'm';

  /** Keeps the menu open after a selection unless the selected branch closes independently. */
  @property({ type: Boolean, attribute: 'stay-open-on-select', reflect: true })
  stayOpenOnSelect = false;

  /** Uses viewport-fixed positioning instead of the default containing-block strategy. */
  @property({ type: Boolean, reflect: true }) hoist = false;

  /** Copies the trigger's width, height, or both onto the popup. */
  @property({ reflect: true }) sync?: PlaceSync;

  /** Optional element that counts as inside for light-dismiss handling. Property-only. */
  @property({ attribute: false }) containingElement?: HTMLElement;

  @state() private consumerMenu?: LyraMenu;
  private consumerMenuSnapshot?: ConsumerMenuSnapshot;

  constructor() {
    super();
    this.popupRole = 'menu';
  }

  /** Dropdown semantics are invariant: the trigger announces a menu and the contained menu owns
   * that role/name. The inherited Popover write surface is narrowed to `menu`; any other runtime
   * or authored value normalizes back to `menu` instead of changing the outer positioning shell.
   * @default 'menu' */
  @property({ attribute: 'popup-role' })
  override get popupRole(): 'menu' {
    return 'menu';
  }
  override set popupRole(_next: LyraPopupRole) {
    if (super.popupRole !== 'menu') super.popupRole = 'menu';
  }

  override attributeChangedCallback(
    name: string,
    oldValue: string | null,
    newValue: string | null,
  ): void {
    if (name === 'popup-role' && newValue !== null && newValue !== 'menu') {
      this.setAttribute('popup-role', 'menu');
      return;
    }
    super.attributeChangedCallback(name, oldValue, newValue);
  }

  protected override get defaultDistance(): number {
    return 0;
  }

  protected override get positioningStrategy(): PlaceStrategy {
    return this.hoist ? 'fixed' : 'absolute';
  }

  protected override get positioningSync(): PlaceSync | undefined {
    return this.sync;
  }

  protected override get animationNamespace(): string {
    return 'dropdown';
  }

  /** The positioned wrapper is presentation-only; the contained menu owns role and name. */
  protected override get popupSurfaceRole(): undefined {
    return undefined;
  }

  protected override animationDurationProperties(showing: boolean): readonly string[] {
    return [showing ? '--show-duration' : '--hide-duration', '--lr-transition-fast'];
  }

  protected override get popupPartNames(): string {
    const parts = ['popup', 'dialog', 'popup__popup', 'base', 'base__popup', 'panel'];
    return parts.join(' ');
  }

  protected override isInsideLightDismissBoundary(path: EventTarget[]): boolean {
    return super.isInsideLightDismissBoundary(path) || Boolean(this.containingElement && path.includes(this.containingElement));
  }

  protected override onPopupPositioned(): void {
    super.onPopupPositioned();
    const menu = this.menuEngine;
    if (!menu?.dropdownOpen) return;
    // The contained engine establishes the correct roving tabindex synchronously while the outer
    // popup is still waiting for Floating UI. Firefox and WebKit reject focus in that hidden
    // interval, so retry the one item the engine already selected once the popup is focusable.
    const slot = menu.shadowRoot?.querySelector<HTMLSlotElement>('slot:not([name])');
    const activeItem = slot
      ?.assignedElements({ flatten: true })
      .find((element) => (element as HTMLElement).tabIndex === 0) as HTMLElement | undefined;
    activeItem?.focus();
  }

  private get menuEngine(): LyraMenu | undefined {
    return this.consumerMenu ??
      (this.renderRoot.querySelector('[part~="menu"]') as LyraMenu | null) ??
      undefined;
  }

  private configureMenu(menu: LyraMenu | undefined): void {
    if (!menu) return;
    if (menu === this.consumerMenu && !this.consumerMenuSnapshot) {
      this.consumerMenuSnapshot = {
        dropdownOwner: menu.dropdownOwner,
        dropdownContained: menu.dropdownContained,
        dropdownRendersMenuRole: menu.dropdownRendersMenuRole,
        dropdownStayOpenOnSelect: menu.dropdownStayOpenOnSelect,
        dropdownSize: menu.dropdownSize,
        dropdownLabel: menu.dropdownLabel,
        dropdownOpen: menu.dropdownOpen,
      };
    }
    menu.dropdownOwner = this;
    menu.dropdownContained = true;
    menu.dropdownRendersMenuRole = true;
    menu.dropdownStayOpenOnSelect = this.stayOpenOnSelect;
    menu.dropdownSize = this.size;
    menu.dropdownLabel = this.effectivePopupLabel;
    menu.dropdownOpen = this.open;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Both menu shapes reset transient open state while detached. Popover deliberately preserves
    // its own `open` value across a drag/drop reparent, so rejoin the contained controller to that
    // state even when reconnecting did not schedule a Lit update of its own.
    void this.updateComplete.then(() => {
      if (this.isConnected) this.configureMenu(this.menuEngine);
    });
  }

  private releaseConsumerMenu(menu: LyraMenu | undefined): void {
    if (!menu) return;
    // Close while the engine is still structurally contained. Releasing containment first would
    // reinterpret this owner teardown as a standalone, cancelable menu dismissal.
    const snapshot = menu === this.consumerMenu ? this.consumerMenuSnapshot : undefined;
    menu.dropdownOpen = false;
    menu.dropdownOwner = snapshot?.dropdownOwner ?? null;
    menu.dropdownContained = snapshot?.dropdownContained ?? false;
    menu.dropdownRendersMenuRole = snapshot?.dropdownRendersMenuRole ?? false;
    menu.dropdownStayOpenOnSelect = snapshot?.dropdownStayOpenOnSelect ?? false;
    menu.dropdownSize = snapshot?.dropdownSize;
    menu.dropdownLabel = snapshot?.dropdownLabel;
    if (snapshot) menu.dropdownOpen = snapshot.dropdownOpen;
    if (menu === this.consumerMenu) this.consumerMenuSnapshot = undefined;
  }

  private onContentSlotChange = (event: Event): void => {
    const next = (event.target as HTMLSlotElement)
      .assignedElements({ flatten: true })
      .find((element) => element.localName === tag('menu')) as LyraMenu | undefined;
    if (next !== this.consumerMenu) {
      this.releaseConsumerMenu(this.consumerMenu);
      this.consumerMenu = next;
    }
    this.configureMenu(next ?? this.menuEngine);
  };

  protected override onTriggerKeyDown(event: KeyboardEvent): void {
    if (this.disabled || this.open) return;
    let focus: MenuFocusTarget | undefined;
    if (event.key === 'ArrowDown') focus = 'first';
    else if (event.key === 'ArrowUp') focus = 'last';
    if (!focus) return;
    event.preventDefault();
    const menu = this.menuEngine;
    this.configureMenu(menu);
    if (menu) menu.focusContained(focus);
    else this.show();
  }

  /** Re-run positioning after an imperative anchor/layout change. */
  reposition(): void {
    this.positionPopup();
  }

  /** Focus the assigned trigger, when one is present. */
  focusOnTrigger(options?: FocusOptions): void {
    const trigger = this.renderRoot
      .querySelector<HTMLSlotElement>('slot[name="trigger"]')
      ?.assignedElements({ flatten: true })[0] as HTMLElement | undefined;
    trigger?.focus(options);
  }

  /** Return the active generated or consumer-supplied menu engine. */
  getMenu(): LyraMenu | null {
    return this.menuEngine ?? null;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // Re-resolve every update so inherited locale/.strings and host aria-label changes reach a
    // consumer-supplied menu even when no dropdown-owned property changed in that cycle.
    this.configureMenu(this.menuEngine);
    if (this.open && (changed.has('hoist') || changed.has('sync'))) this.reposition();
  }

  override disconnectedCallback(): void {
    this.releaseConsumerMenu(this.consumerMenu);
    super.disconnectedCallback();
  }

  protected override renderPopupContent(): TemplateResult {
    if (this.consumerMenu) {
      return html`<slot @slotchange=${this.onContentSlotChange}></slot>`;
    }
    return staticHtml`
      <${menuTag}
        part="menu"
        .dropdownOwner=${this}
        .dropdownContained=${true}
        .dropdownRendersMenuRole=${true}
        .dropdownStayOpenOnSelect=${this.stayOpenOnSelect}
        .dropdownSize=${this.size}
        .dropdownLabel=${this.effectivePopupLabel}
        .dropdownOpen=${this.open}
      >
        <slot @slotchange=${this.onContentSlotChange}></slot>
      </${menuTag}>
    `;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-dropdown': LyraDropdown; } }
