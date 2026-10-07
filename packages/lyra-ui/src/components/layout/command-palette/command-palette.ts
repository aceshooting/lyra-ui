/** @deprecated Import @aceshooting/lyra-ui/components/lr-command-palette.js to register this component. */
export * from './command-palette.class.js';
import { LyraCommandPalette } from './command-palette.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('command-palette', LyraCommandPalette);
