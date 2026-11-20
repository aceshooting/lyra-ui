export * from './data/condition-builder/condition-builder.class.js';
import { LyraConditionBuilder } from './data/condition-builder/condition-builder.class.js';
import { defineElement } from '../internal/prefix.js';
import { defineLazyChildren } from '../internal/lazy-children.js';
import './lr-select.js';
import './lr-button.js';
import './lr-icon-button.js';

defineLazyChildren('condition-builder', {
  input: () => import('./lr-input.js'),
  'date-input': () => import('./lr-date-input.js'),
  combobox: () => import('./lr-combobox.js'),
});

defineElement('condition-builder', LyraConditionBuilder);
