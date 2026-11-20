export * from './utility/format/format-date.class.js';
import { LyraFormatDate } from './utility/format/format-date.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('format-date', LyraFormatDate);
