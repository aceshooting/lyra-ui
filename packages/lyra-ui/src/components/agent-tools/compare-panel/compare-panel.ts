export * from './compare-panel.class.js';
import { LyraComparePanel } from './compare-panel.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../utility/live-region/live-region.js';

defineElement('compare-panel', LyraComparePanel);
