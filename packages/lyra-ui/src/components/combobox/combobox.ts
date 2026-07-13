export * from './combobox.class.js';
import { LyraCombobox } from './combobox.class.js';
import { defineElement } from '../../internal/prefix.js';
import "./option.js";
defineElement('combobox', LyraCombobox);
