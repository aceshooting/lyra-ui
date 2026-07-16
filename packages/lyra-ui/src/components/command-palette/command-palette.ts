export * from './command-palette.class.js';
import '../icon/icon.js';
import { LyraCommandPalette } from './command-palette.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('command-palette', LyraCommandPalette);
