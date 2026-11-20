export * from './layout/split-panel/split-panel.class.js';
import { LyraSplitPanel } from './layout/split-panel/split-panel.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('split-panel', LyraSplitPanel);
