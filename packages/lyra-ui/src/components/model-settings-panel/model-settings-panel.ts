export * from './model-settings-panel.class.js';
import { LyraModelSettingsPanel } from './model-settings-panel.class.js';
import { defineElement } from '../../internal/prefix.js';
import "../model-select/model-select.js";
import "../slider/slider.js";
defineElement('model-settings-panel', LyraModelSettingsPanel);
