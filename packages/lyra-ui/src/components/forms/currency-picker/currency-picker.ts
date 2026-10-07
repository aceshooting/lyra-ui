export * from './currency-picker.class.js';
import { LyraCurrencyPicker } from './currency-picker.class.js';
import { defineElement } from '../../../internal/prefix.js';

import '../select/select.js';
import '../combobox/option.js';

defineElement('currency-picker', LyraCurrencyPicker);
