export type { LyraModelCatalogEntry } from './conversation/model-select/model-select.class.js';
export type { LyraCatalog } from '../internal/catalog-picker.js';
export * from './conversation/model-settings-panel/model-settings-panel.class.js';
import { LyraModelSettingsPanel } from './conversation/model-settings-panel/model-settings-panel.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-model-select.js';
import './lr-slider.js';
defineElement('model-settings-panel', LyraModelSettingsPanel);
