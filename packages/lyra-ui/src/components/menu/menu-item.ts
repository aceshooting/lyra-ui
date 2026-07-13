export * from './menu-item.class.js';
import { LyraMenuItem } from './menu-item.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('menu-item', LyraMenuItem);
