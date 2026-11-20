export * from './layout/tab-group/tab.class.js';
import { LyraTab } from './layout/tab-group/tab.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('tab', LyraTab);
