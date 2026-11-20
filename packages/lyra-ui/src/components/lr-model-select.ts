export * from './conversation/model-select/model-select.class.js';
import { LyraModelSelect } from './conversation/model-select/model-select.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('model-select', LyraModelSelect);
