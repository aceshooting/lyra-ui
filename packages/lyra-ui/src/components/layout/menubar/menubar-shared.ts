/** @internal Private ownership bridge between an item and its current menubar. */
export const menubarItemOwner = Symbol('lyra-menubar-item-owner');

/** @internal */
export interface MenubarItemOwner {
  menuStateChanged(item: HTMLElement, open: boolean): void;
  itemStateChanged(item: HTMLElement): void;
}

/** @internal */
interface MenubarItemOwned {
  [menubarItemOwner](owner: MenubarItemOwner | null, expectedOwner?: MenubarItemOwner): void;
}
