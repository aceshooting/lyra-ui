export * from './forms/toggle/toggle.class.js';
import { LyraToggle } from './forms/toggle/toggle.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('toggle', LyraToggle);
