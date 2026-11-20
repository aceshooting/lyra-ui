export * from './agent-tools/compare-panel/compare-panel.class.js';
import './lr-live-region.js';
import { LyraComparePanel } from './agent-tools/compare-panel/compare-panel.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('compare-panel', LyraComparePanel);
