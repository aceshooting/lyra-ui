export * from './forms/textarea/textarea.class.js';
import { LyraTextarea } from './forms/textarea/textarea.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('textarea', LyraTextarea);
