export type { MenuItemSelectDetail } from './layout/menu/menu.class.js';
export * from './overlays/context-menu/context-menu.class.js';
import { LyraContextMenu } from './overlays/context-menu/context-menu.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-dropdown.js';

defineElement('context-menu', LyraContextMenu);
