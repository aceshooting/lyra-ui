export * from './kbd.class.js';
import { LyraKbd } from './kbd.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('kbd', LyraKbd);
