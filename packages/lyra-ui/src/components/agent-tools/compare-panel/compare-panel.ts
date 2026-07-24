export * from './compare-panel.class.js';
import '../../utility/live-region/live-region.js';
import { LyraComparePanel } from './compare-panel.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('compare-panel', LyraComparePanel);
