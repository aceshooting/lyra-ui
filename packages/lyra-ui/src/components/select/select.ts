export * from './select.class.js';
import { LyraSelect } from './select.class.js';
import { defineElement } from '../../internal/prefix.js';
import "../combobox/option.js";
defineElement('select', LyraSelect);
