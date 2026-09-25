export * from './navigation-menu.class.js';
import { LyraNavigationMenu } from './navigation-menu.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../navigation-menu-item/navigation-menu-item.js';
defineElement('navigation-menu', LyraNavigationMenu);
