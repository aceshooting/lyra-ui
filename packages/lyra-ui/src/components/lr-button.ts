export * from './forms/button/button.class.js';
import { LyraButton } from './forms/button/button.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('button', LyraButton);
