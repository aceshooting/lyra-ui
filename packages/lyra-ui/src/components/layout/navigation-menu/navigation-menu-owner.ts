/**
 * Private coordination between `<lr-navigation-menu>` and its direct `<lr-navigation-menu-item>`
 * children. Nothing here is exported from a barrel or a package entry point: the two elements talk
 * through these WeakMaps so the pair can share interaction state without either one publishing a
 * member that would become permanent public API.
 */

/** How the owning menu currently lays its items out. */
export type NavigationMenuLayout = 'bar' | 'stacked';

/** How an open item was opened. Only meaningful while open in bar layout. */
export type NavigationMenuItemMode = 'hover' | 'pinned' | 'programmatic';

/** Mirrors the public `lr-toggle` source vocabulary. */
export type NavigationMenuToggleSource = 'user' | 'programmatic' | 'peer';

/** Size origin and travel direction for the shared-region resize when one panel replaces another. */
export interface NavigationMenuMorph {
  readonly from: DOMRect;
  readonly direction: 'start' | 'end';
}

export interface NavigationMenuCloseOptions {
  /** Move focus off the panel before it hides, when the panel holds focus. Defaults to `true`. */
  repairFocus?: boolean;
  /** Where repaired focus goes; defaults to the item's own base. */
  focusTarget?: HTMLElement | null;
  /** Restore focus through the overlay stack (Escape with focus inside the item). */
  restoreFocus?: boolean;
  /** Hide in the same update without the exit animation (a peer close). */
  instant?: boolean;
}

/** What the owning menu offers each bound item. */
export interface NavigationMenuOwnerContext {
  readonly owner: HTMLElement;
  layout(): NavigationMenuLayout;
  /** The element the item's panel is positioned against. */
  anchor(item: HTMLElement): HTMLElement | null;
  distance(): number;
  /** The item's base button was activated (click, or the native Enter/Space click). */
  activate(item: HTMLElement): void;
  /** Called before an accepted open commits. Closes the open sibling and returns the morph origin. */
  willOpen(item: HTMLElement): NavigationMenuMorph | undefined;
  /** Called after an accepted open or close commits. */
  changed(item: HTMLElement, open: boolean, source: NavigationMenuToggleSource | null): void;
  /** Escape routed to this item by the shared overlay stack. */
  escape(item: HTMLElement): void;
}

/** What each item offers the menu that owns it. */
export interface NavigationMenuItemController {
  isTrigger(): boolean;
  isLink(): boolean;
  isOpen(): boolean;
  mode(): NavigationMenuItemMode | undefined;
  pin(): void;
  base(): HTMLElement | null;
  panel(): HTMLElement | null;
  /** Opens the panel. Returns `false` when the item cannot disclose. */
  open(mode: NavigationMenuItemMode, source: NavigationMenuToggleSource | null): boolean;
  close(source: NavigationMenuToggleSource | null, options?: NavigationMenuCloseOptions): void;
  /** Whether this item's overlay entry currently owns Escape and light dismiss. */
  isTopmost(): boolean;
  /** Resolves once the open panel has its first placement (immediately when not floating). */
  placementReady(): Promise<boolean>;
  /** Re-reads the anchor, distance and direction on the next update. */
  reposition(): void;
}

const owners = new WeakMap<HTMLElement, NavigationMenuOwnerContext>();
const controllers = new WeakMap<HTMLElement, NavigationMenuItemController>();

export function registerNavigationMenuItemController(
  item: HTMLElement,
  controller: NavigationMenuItemController,
): void {
  controllers.set(item, controller);
}

export function navigationMenuItemController(
  item: HTMLElement,
): NavigationMenuItemController | undefined {
  return controllers.get(item);
}

function requestItemUpdate(item: HTMLElement): void {
  (item as HTMLElement & { requestUpdate?: () => void }).requestUpdate?.();
}

export function bindNavigationMenuItem(item: HTMLElement, context: NavigationMenuOwnerContext): void {
  if (owners.get(item) === context) return;
  owners.set(item, context);
  requestItemUpdate(item);
}

export function releaseNavigationMenuItem(item: HTMLElement, owner: HTMLElement): void {
  if (owners.get(item)?.owner !== owner) return;
  owners.delete(item);
  requestItemUpdate(item);
}

export function navigationMenuOwner(item: HTMLElement): NavigationMenuOwnerContext | undefined {
  return owners.get(item);
}
