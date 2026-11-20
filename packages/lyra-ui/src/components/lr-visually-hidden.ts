export * from './utility/visually-hidden/visually-hidden.class.js';
import { LyraVisuallyHidden } from './utility/visually-hidden/visually-hidden.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('visually-hidden', LyraVisuallyHidden);
