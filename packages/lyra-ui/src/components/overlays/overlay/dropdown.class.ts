import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import type { Placement } from '@floating-ui/dom';
import type { PlaceStrategy, PlaceSync } from '../../../internal/positioner.js';
import { tag } from '../../../internal/prefix.js';
import type { LyraSize } from '../../../internal/variants.js';
import type { MenuFocusTarget } from '../../layout/menu/menu-shared.js';
import type { LyraMenu, MenuItemSelectDetail } from '../../layout/menu/menu.class.js';
import { LyraPopover, type LyraPopoverEventMap } from './popover.class.js';
import { styles } from './dropdown.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_collapse, LYRA_DEFAULT_details, LYRA_DEFAULT_open } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


const menuTag = unsafeStatic(tag('menu'));

export interface LyraDropdownEventMap extends LyraPopoverEventMap {
  'lr-select': CustomEvent<MenuItemSelectDetail>;
}

/**
 * `<lr-dropdown>` — a trigger-owned action menu. The public host remains the Popover-style
 * trigger/popup shell while a contained `<lr-menu>` supplies roving focus, type-ahead, nested
 * submenu intent, selection, and focus return for mapped dropdown items. A consumer-supplied
 * `<lr-menu>` in the default slot becomes that contained engine instead of being wrapped in a
 * second menu. Motion resolves through `dropdown.show`/`dropdown.hide` in the public animation
 * registry without changing the inherited Popover lifecycle.
 *
 * @customElement lr-dropdown
 * @slot trigger - The interactive element that toggles the dropdown.
 * @slot - `<lr-dropdown-item>`/`<lr-menu-item>` rows, or one consumer-supplied `<lr-menu>`.
 * @event lr-show - The dropdown is about to open. Cancelable.
 * @event lr-after-show - The dropdown is open and its transition has finished.
 * @event lr-hide - The dropdown is about to close. Cancelable.
 * @event lr-after-hide - The dropdown is closed and its transition has finished.
 * @event lr-select - A menu item was activated. `detail: { item }`. Cancelable; preventing the
 *   event keeps the dropdown and any selected submenu open. The contained menu's standalone
 *   `lr-menu-select` compatibility alias does not escape this wrapper.
 * @method show - `show(): Promise<void>` — opens unless disabled and resolves after
 *   `lr-after-show`.
 * @method hide - `hide(options?): Promise<void>` — closes, returns focus by default, and resolves
 *   after `lr-after-hide`.
 * @method reposition - Immediately recomputes the popup position.
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
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    collapse: LYRA_DEFAULT_collapse,
    details: LYRA_DEFAULT_details,
    open: LYRA_DEFAULT_open,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraPopover.styles, styles];

  /** Dropdowns sit flush against their trigger by default; generic popovers retain eight pixels. */
  override distance = 0;

  /** Action menus retain their mapped below-trigger placement. */
  override placement: Placement = 'bottom-start';

  /** Dropdowns do not render a pointer unless a consumer explicitly enables it. */
  override arrow = false;

  /** Density propagated to directly owned mapped items. */
  @property({ reflect: true }) size: LyraSize = 'm';

  /** Prevents the dropdown from opening. Becoming disabled also dismisses an open dropdown;
   * initial `disabled` plus `open` markup/property state normalizes closed in either order. */
  private _disabled = false;
  @property({ type: Boolean, reflect: true })
  get disabled(): boolean {
    return this._disabled;
  }
  set disabled(next: boolean) {
    const normalized = Boolean(next);
    if (normalized === this._disabled) return;
    const old = this._disabled;
    this._disabled = normalized;
    this.requestUpdate('disabled', old);
    if (normalized && this.open) {
      if (this.hasUpdated) void this.hide();
      else this.open = false;
    }
  }

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

  constructor() {
    super();
    this.popupRole = 'menu';
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

  protected override get canOpen(): boolean {
    return !this.disabled;
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

  private get menuEngine(): LyraMenu | undefined {
    return this.consumerMenu ??
      (this.renderRoot.querySelector('[part~="menu"]') as LyraMenu | null) ??
      undefined;
  }

  private configureMenu(menu: LyraMenu | undefined): void {
    if (!menu) return;
    menu.dropdownOwner = this;
    menu.dropdownContained = true;
    menu.dropdownStayOpenOnSelect = this.stayOpenOnSelect;
    menu.dropdownSize = this.size;
    menu.open = this.open;
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
    menu.dropdownOwner = null;
    menu.dropdownContained = false;
    menu.dropdownStayOpenOnSelect = false;
    menu.dropdownSize = undefined;
    menu.open = false;
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

  /** `lr-menu-select` remains part of standalone `lr-menu`, but dropdown consumers have one
   * documented selection event with the complete item and veto contract. Catch the alias before
   * it crosses this wrapper's shadow boundary for both generated and consumer-supplied menus. */
  private onMenuSelectAlias = (event: Event): void => {
    event.stopPropagation();
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
    if (menu) menu.show(focus);
    else this.show();
  }

  /** Re-run positioning after an imperative anchor/layout change. */
  reposition(): void {
    this.positionPopup();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (
      changed.has('open') ||
      changed.has('size') ||
      changed.has('stayOpenOnSelect') ||
      changed.has('consumerMenu')
    ) {
      this.configureMenu(this.menuEngine);
    }
    if (this.open && (changed.has('hoist') || changed.has('sync'))) this.reposition();
  }

  override disconnectedCallback(): void {
    this.releaseConsumerMenu(this.consumerMenu);
    super.disconnectedCallback();
  }

  protected override renderPopupContent(): TemplateResult {
    if (this.consumerMenu) {
      return html`<slot
        @slotchange=${this.onContentSlotChange}
        @lr-menu-select=${this.onMenuSelectAlias}
      ></slot>`;
    }
    return staticHtml`
      <${menuTag}
        part="menu"
        .dropdownOwner=${this}
        .dropdownContained=${true}
        .dropdownStayOpenOnSelect=${this.stayOpenOnSelect}
        .dropdownSize=${this.size}
        .open=${this.open}
        @lr-menu-select=${this.onMenuSelectAlias}
      >
        <slot @slotchange=${this.onContentSlotChange}></slot>
      </${menuTag}>
    `;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-dropdown': LyraDropdown; } }
