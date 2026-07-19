export * from './button.class.js';
import { LyraButton } from './button.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('button', LyraButton);
