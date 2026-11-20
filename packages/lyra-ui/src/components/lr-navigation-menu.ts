export * from './layout/navigation-menu/navigation-menu.class.js';
import { LyraNavigationMenu } from './layout/navigation-menu/navigation-menu.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-navigation-menu-item.js';
defineElement('navigation-menu', LyraNavigationMenu);
