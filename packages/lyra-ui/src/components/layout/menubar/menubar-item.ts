/** @deprecated Import @aceshooting/lyra-ui/components/lr-menubar-item.js to register this component. */
export * from './menubar-item.class.js';
import { LyraMenubarItem } from './menubar-item.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../menu/menu.js';
defineElement('menubar-item', LyraMenubarItem);
