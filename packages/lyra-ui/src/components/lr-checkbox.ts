export * from './forms/checkbox/checkbox.class.js';
import { LyraCheckbox } from './forms/checkbox/checkbox.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('checkbox', LyraCheckbox);
