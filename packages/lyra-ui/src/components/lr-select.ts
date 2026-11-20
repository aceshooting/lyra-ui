export * from './forms/select/select.class.js';
import { LyraSelect } from './forms/select/select.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-option.js';
defineElement('select', LyraSelect);
