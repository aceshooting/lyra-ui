export * from './utility/format/relative-time.class.js';
import { LyraRelativeTime } from './utility/format/relative-time.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('relative-time', LyraRelativeTime);
