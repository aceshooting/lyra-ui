export * from './overlays/spinner/spinner.class.js';
import { LyraSpinner } from './overlays/spinner/spinner.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('spinner', LyraSpinner);
