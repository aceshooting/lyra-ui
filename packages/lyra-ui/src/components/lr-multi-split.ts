export * from './layout/multi-split/multi-split.class.js';
import { LyraMultiSplit } from './layout/multi-split/multi-split.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('multi-split', LyraMultiSplit);
