export * from './utility/format/format-bytes.class.js';
import { LyraFormatBytes } from './utility/format/format-bytes.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('format-bytes', LyraFormatBytes);
