export type { LyraMenuItemEventMap } from './layout/menu/menu-item.class.js';
export type { MenuFocusTarget } from './layout/menu/menu-shared.js';
export * from './layout/menu/dropdown-item.class.js';
import { LyraDropdownItem } from './layout/menu/dropdown-item.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-menu.js';
defineElement('dropdown-item', LyraDropdownItem);
