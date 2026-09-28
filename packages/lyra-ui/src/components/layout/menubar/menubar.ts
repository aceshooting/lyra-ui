/** @deprecated Import @aceshooting/lyra-ui/components/lr-menubar.js to register this component. */
export * from './menubar.class.js';
import { LyraMenubar } from './menubar.class.js';
import { defineElement } from '../../../internal/prefix.js';
import './menubar-item.js';
defineElement('menubar', LyraMenubar);
