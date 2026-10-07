import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { TypeAheadBuffer } from '../../../internal/type-ahead-buffer.js';
import { isRovingTargetAvailable, resolveListMove } from '../../../internal/list-navigation.js';
import { collectInitialSlotAssignment } from '../../../internal/initial-slot-collection.js';
import {
  activateNonmodalOverlay, composedContains, deepActiveElement, type OverlayHandle,
} from '../../../internal/nonmodal-overlay-manager.js';
import { isHtmlElement } from '../../../internal/dom-guards.js';
import { keyEventOwnedByInnerControl } from '../../../internal/hotkey.js';
import { sizes } from '../../../internal/sizes.styles.js';
import { tag } from '../../../internal/prefix.js';
import type { LyraFrame, LyraSize } from '../../../internal/variants.js';
import type { MenuItemSelectDetail } from '../menu/menu.class.js';
import type { MenuFocusTarget } from '../menu/menu-shared.js';
import type { LyraMenubarItem } from './menubar-item.class.js';
import { menubarItemOwner, type MenubarItemOwner } from './menubar-shared.js';
import { styles } from './menubar.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_menuLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export interface LyraMenubarEventMap {
  'lr-select': CustomEvent<MenuItemSelectDetail>;
}

/**
 * Horizontal application menubar with roving focus, RTL-aware arrow navigation, typeahead and
 * hover switching. An expanded menu follows the focused title; action items close it. Titles
 * wrap at narrow widths. Each title supplies its own lr-menu with all existing menu behaviors.
 *
 * @customElement lr-menubar
 * @slot - lr-menubar-item elements only; other content is invalid inside the menubar role.
 * @csspart base - The horizontal, wrapping menubar container.
 * @event {CustomEvent<MenuItemSelectDetail>} lr-select - Cancelable selection bubbling from the owning menu. Prevent default to keep it open.
 * @cssprop --lr-menu-min-inline-size - Inherited minimum width of every slotted menu.
 * @cssprop --lr-menu-max-inline-size - Inherited maximum width of every slotted menu.
 * @status experimental
 * @since 21.0.0
 */
export class LyraMenubar extends LyraElement<LyraMenubarEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    menuLabel: LYRA_DEFAULT_menuLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END
  static override styles = [LyraElement.styles, sizes, styles];

  /** Accessible name; a host aria-label takes precedence, including an explicit empty value. A
   *  supplied string, including an empty one, is literal; only absence uses the localized "Menu". */
  @property() label?: string;
  /**
   * Shows every menu this bar opens, nested submenus included, in the browser top layer wherever
   * the native Popover API exists, so it paints above every page layer whatever the stacking
   * contexts around it. Use it inside a fixed or sticky header with its own `z-index` that a
   * higher sibling surface would otherwise cover. Menus are placed with the `fixed` strategy
   * while set; no DOM node moves. Applies the next time a menu opens. Same contract as
   * `<lr-navigation-menu>`'s `top-layer`.
   * @default false
   */
  @property({ type: Boolean, attribute: 'top-layer', reflect: true }) topLayer = false;
  /** Shared control size inherited by every title. */
  @property({ reflect: true }) size: LyraSize = 'm';
  /** Card chrome or a transparent frame with identical geometry. */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  private items: LyraMenubarItem[] = [];
  private activeIndex = -1;
  private expandedItem: LyraMenubarItem | null = null;
  private overlayHandle?: OverlayHandle;
  private itemObserver?: MutationObserver;
  private readonly typeBuffer = new TypeAheadBuffer(this);
  private focusedItem: LyraMenubarItem | null = null;
  private readonly owner: MenubarItemOwner = {
    menuStateChanged: (item, open) => this.menuStateChanged(item as LyraMenubarItem, open),
    itemStateChanged: () => this.syncItemState(),
  };

  constructor() {
    super();
    this.addEventListener('keydown', this.onKeyDown);
    this.addEventListener('click', this.onClick);
    this.addEventListener('pointerover', this.onPointerOver);
    this.addEventListener('focusin', event => {
      const item = this.items.find(candidate => candidate === event.target);
      if (item && this.isNavigable(item)) { this.focusedItem = item; this.setActive(item); }
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) {
      for (const item of this.items) item[menubarItemOwner](this.owner);
      this.observeItems();
      queueMicrotask(() => { if (this.isConnected) { this.syncItems(); this.syncItemState(); } });
    }
  }

  override disconnectedCallback(): void {
    this.collapse();
    this.typeBuffer.clear();
    this.itemObserver?.disconnect(); this.itemObserver = undefined;
    this.ownerDocument.removeEventListener('focusin', this.onDocumentFocus, true);
    for (const item of this.items) item[menubarItemOwner](null, this.owner);
    this.focusedItem = null;
    super.disconnectedCallback();
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    queueMicrotask(() => {
      if (this.isConnected) collectInitialSlotAssignment(this.renderRoot.querySelector<HTMLSlotElement>('slot'), this.syncItems);
    });
  }

  private isNavigable(item: LyraMenubarItem): boolean {
    return isRovingTargetAvailable(item);
  }

  private observeItems(): void {
    this.itemObserver?.disconnect();
    const Observer = this.ownerDocument.defaultView?.MutationObserver;
    if (!Observer) return;
    this.itemObserver = new Observer(() => this.syncItemState());
    for (const item of this.items) this.itemObserver.observe(item, {
      attributes: true, attributeFilter: ['disabled', 'hidden', 'aria-hidden', 'inert'],
    });
  }

  private syncItems = (): void => {
    const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot');
    const assigned = (slot?.assignedElements({ flatten: true }) ?? []).filter(
      (element): element is LyraMenubarItem => element.localName === tag('menubar-item'),
    );
    if (assigned.length === this.items.length && assigned.every((item, index) => item === this.items[index])) return;
    const previous = this.items[this.activeIndex];
    const oldIndex = this.activeIndex;
    const active = deepActiveElement(this.ownerDocument);
    const heldFocus = !!previous && (active === previous || (!!active && composedContains(previous, active)) ||
      (this.focusedItem === previous && (!active || active === this.ownerDocument.body)));
    for (const item of this.items) if (!assigned.includes(item)) item[menubarItemOwner](null, this.owner);
    this.items = assigned;
    for (const item of this.items) item[menubarItemOwner](this.owner);
    this.observeItems();
    if (previous && assigned.includes(previous) && this.isNavigable(previous)) this.setActive(previous);
    else this.rehome(oldIndex, heldFocus);
    if (this.expandedItem && !assigned.includes(this.expandedItem)) this.collapse();
  };

  private rehome(index: number, focus: boolean): void {
    const successor = this.items.find((item, current) => current >= Math.max(0, index) && this.isNavigable(item)) ??
      this.items.slice(0, Math.max(0, index)).reverse().find(item => this.isNavigable(item));
    if (successor) this.setActive(successor, focus);
    else { this.activeIndex = -1; for (const item of this.items) item.tabIndex = -1; }
  }

  private syncItemState(): void {
    const active = this.items[this.activeIndex];
    if (!active || !this.isNavigable(active)) {
      const focused = deepActiveElement(this.ownerDocument);
      this.rehome(this.activeIndex, !!active && (focused === active || (!!focused && composedContains(active, focused))));
    }
    if (this.expandedItem && (!this.isNavigable(this.expandedItem) || !this.expandedItem.hasMenu)) this.collapse();
  }

  private setActive(item: LyraMenubarItem, focus = false): void {
    if (!this.isNavigable(item)) return;
    this.activeIndex = this.items.indexOf(item);
    for (const candidate of this.items) candidate.tabIndex = candidate === item ? 0 : -1;
    if (focus) { this.focusedItem = item; item.focus({ preventScroll: true }); }
  }

  private registerOverlay(): void {
    if (this.overlayHandle) return;
    this.overlayHandle = activateNonmodalOverlay({
      host: this, panel: () => this, preferredInitialFocus: () => this.expandedItem,
      onEscape: () => this.collapse(), onTab: () => this.collapse(),
      restoreFocusTo: () => {
        const active = deepActiveElement(this.ownerDocument);
        return isHtmlElement(active) && active !== this.ownerDocument.body && active !== this.ownerDocument.documentElement ? active : null;
      },
    });
    this.ownerDocument.addEventListener('focusin', this.onDocumentFocus, true);
  }

  private open(item: LyraMenubarItem, focus: MenuFocusTarget): void {
    const previous = this.expandedItem;
    // Publish the successor before closing the previous menu so its callback cannot collapse it.
    this.expandedItem = item;
    if (previous && previous !== item) void previous.closeMenu();
    this.registerOverlay();
    void item.openMenu(focus);
  }

  private carry(item: LyraMenubarItem): void {
    const previous = this.expandedItem;
    this.setActive(item, true);
    if (item.hasMenu && this.isNavigable(item)) {
      this.expandedItem = item;
      if (previous && previous !== item) void previous.closeMenu();
      void item.openMenu('none');
    } else this.collapse();
  }

  private collapse(): void {
    const item = this.expandedItem;
    this.expandedItem = null;
    this.ownerDocument.removeEventListener('focusin', this.onDocumentFocus, true);
    const handle = this.overlayHandle; this.overlayHandle = undefined;
    handle?.deactivate();
    if (item) void item.closeMenu();
  }

  private menuStateChanged(item: LyraMenubarItem, open: boolean): void {
    if (!this.items.includes(item)) return;
    if (open && item !== this.expandedItem) {
      const previous = this.expandedItem; this.expandedItem = item;
      if (previous) void previous.closeMenu();
      this.registerOverlay();
    } else if (!open && item === this.expandedItem) this.collapse();
  }

  private onDocumentFocus = (): void => {
    const active = deepActiveElement(this.ownerDocument);
    if (!active || !composedContains(this, active)) { this.focusedItem = null; this.collapse(); }
  };

  private eventItem(event: Event): { item: LyraMenubarItem; path: EventTarget[]; inMenu: boolean } | undefined {
    const path = event.composedPath();
    const item = path.find(target => this.items.includes(target as LyraMenubarItem)) as LyraMenubarItem | undefined;
    if (!item || !this.isNavigable(item)) return;
    const preceding = path.slice(0, path.indexOf(item));
    return { item, path: preceding, inMenu: preceding.some(node => isHtmlElement(node) && node.localName === tag('menu')) };
  }

  private onClick = (event: MouseEvent): void => {
    const found = this.eventItem(event); if (!found || found.inMenu) return;
    const { item } = found; this.setActive(item, true);
    if (!item.hasMenu) { if (this.expandedItem) this.collapse(); return; }
    if (this.expandedItem === item) this.collapse();
    else if (this.expandedItem) this.carry(item);
    else this.open(item, 'none');
  };

  private onPointerOver = (event: PointerEvent): void => {
    if (!this.expandedItem || event.pointerType === 'touch') return;
    const found = this.eventItem(event);
    if (found && !found.inMenu && found.item.hasMenu && found.item !== this.expandedItem) this.carry(found.item);
  };

  private move(item: LyraMenubarItem): void {
    if (this.expandedItem) this.carry(item); else this.setActive(item, true);
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey) return;
    const found = this.eventItem(event); if (!found) return;
    const { item, inMenu } = found;
    if (keyEventOwnedByInnerControl(event, { container: item })) return;
    if (inMenu) {
      if (!isHtmlElement(event.target) || ![tag('menu-item'), tag('dropdown-item')].includes(event.target.localName)) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    } else if (event.target !== item) return;
    const navigable = this.items.filter(candidate => this.isNavigable(candidate));
    if (!navigable.length) return;
    const index = navigable.indexOf(item);
    let next: LyraMenubarItem | undefined;
    const nextIndex = resolveListMove(event, {
      count: navigable.length,
      current: index,
      orientation: 'horizontal',
      direction: this.effectiveDirection,
    });
    if (nextIndex !== null) next = navigable[nextIndex];
    else if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
      if (item.hasMenu) { event.preventDefault(); this.open(item, event.key === 'ArrowUp' ? 'last' : 'first'); }
      else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); item.click(); }
      return;
    } else if (this.typeBuffer.accepts(event)) {
      this.typeBuffer.add(event.key, this.effectiveLocale);
      const match = this.typeBuffer.match(navigable, index, item => item.textLabel, this.effectiveLocale);
      if (match !== null) next = navigable[match];
    }
    if (next) { event.preventDefault(); this.move(next); }
  };

  override render(): TemplateResult {
    return html`<div part="base" role="menubar" aria-label=${this.getAttribute('aria-label') ?? this.label ?? this.localize('menuLabel')}><slot @slotchange=${this.syncItems}></slot></div>`;
  }
}
