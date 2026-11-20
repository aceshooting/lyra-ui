export * from './layout/dock-panel/dock-panel.class.js';
import { LyraDockPanel } from './layout/dock-panel/dock-panel.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('dock-panel', LyraDockPanel);
