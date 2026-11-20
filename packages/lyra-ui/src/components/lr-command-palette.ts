export * from './layout/command-palette/command-palette.class.js';
import { LyraCommandPalette } from './layout/command-palette/command-palette.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('command-palette', LyraCommandPalette);
