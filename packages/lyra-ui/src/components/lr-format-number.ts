export * from './utility/format/format-number.class.js';
import { LyraFormatNumber } from './utility/format/format-number.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('format-number', LyraFormatNumber);
