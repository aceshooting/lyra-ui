/** @deprecated Import @aceshooting/lyra-ui/components/lr-node-palette.js to register this component. */
export * from './node-palette.class.js';
import { LyraNodePalette } from './node-palette.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('node-palette', LyraNodePalette);
