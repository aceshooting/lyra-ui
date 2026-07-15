export * from './spinner.class.js';
import { LyraSpinner } from './spinner.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('spinner', LyraSpinner);
