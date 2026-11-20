export * from './utility/known-date/known-date.class.js';
import { LyraKnownDate } from './utility/known-date/known-date.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('known-date', LyraKnownDate);
