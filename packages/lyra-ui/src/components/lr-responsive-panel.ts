export * from './layout/responsive-panel/responsive-panel.class.js';
import { LyraResponsivePanel } from './layout/responsive-panel/responsive-panel.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('responsive-panel', LyraResponsivePanel);
