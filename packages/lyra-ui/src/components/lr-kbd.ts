export * from './overlays/kbd/kbd.class.js';
import { LyraKbd } from './overlays/kbd/kbd.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('kbd', LyraKbd);
