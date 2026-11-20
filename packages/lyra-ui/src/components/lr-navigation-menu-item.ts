export * from './layout/navigation-menu-item/navigation-menu-item.class.js';
import { LyraNavigationMenuItem } from './layout/navigation-menu-item/navigation-menu-item.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('navigation-menu-item', LyraNavigationMenuItem);
