export type { LyraDateRangePreset } from './forms/date-picker/date-picker.class.js';
export type { LyraInputType } from './forms/input/input-shared.js';
export * from './layout/filter-bar/filter-bar.class.js';
import { LyraFilterBar } from './layout/filter-bar/filter-bar.class.js';
import { defineElement } from '../internal/prefix.js';
import { defineLazyChildren } from '../internal/lazy-children.js';
import './lr-chip.js';
import './lr-chip-group.js';
import './lr-button.js';

// Each filter type's control registers the first time a bar renders it.
defineLazyChildren('filter-bar', {
  select: () => import('./lr-select.js'),
  combobox: () => import('./lr-combobox.js'),
  option: () => import('./lr-option.js'),
  'date-input': () => import('./lr-date-input.js'),
  input: () => import('./lr-input.js'),
  dropdown: () => import('./lr-dropdown.js'),
  'dropdown-item': () => import('./lr-dropdown-item.js'),
  spinner: () => import('./lr-spinner.js'),
});
defineElement('filter-bar', LyraFilterBar);
