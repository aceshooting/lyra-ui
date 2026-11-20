export * from './layout/tab-group/tab-panel.class.js';
import { LyraTabPanel } from './layout/tab-group/tab-panel.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('tab-panel', LyraTabPanel);
