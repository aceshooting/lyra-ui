export * from './utility/style-panel/style-panel.class.js';
import { LyraStylePanel } from './utility/style-panel/style-panel.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-button.js';
import './lr-segmented.js';
import './lr-select.js';
import './lr-slider.js';
import './lr-swatch-picker.js';

defineElement('style-panel', LyraStylePanel);
