export * from './forms/combobox/option.class.js';
import { LyraOption } from './forms/combobox/option.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('option', LyraOption);
