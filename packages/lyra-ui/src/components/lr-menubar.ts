export type { MenuItemSelectDetail } from './layout/menu/menu.class.js';
export * from './layout/menubar/menubar.class.js';
import { LyraMenubar } from './layout/menubar/menubar.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-menubar-item.js';
defineElement('menubar', LyraMenubar);
