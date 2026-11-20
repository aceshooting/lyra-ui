export * from './layout/menubar/menubar-item.class.js';
import { LyraMenubarItem } from './layout/menubar/menubar-item.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-menu.js';
defineElement('menubar-item', LyraMenubarItem);
