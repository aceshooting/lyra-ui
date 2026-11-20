export * from './layout/details/details.class.js';
import { LyraDetails } from './layout/details/details.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('details', LyraDetails);
