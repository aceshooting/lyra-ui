export * from './layout/menu/menu.class.js';
import { LyraMenu } from './layout/menu/menu.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-menu-item.js';
defineElement('menu', LyraMenu);
