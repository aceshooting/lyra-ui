/** @deprecated Import @aceshooting/lyra-ui/components/lr-context-menu.js to register this component. */
export * from './context-menu.class.js';
import { LyraContextMenu } from './context-menu.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../overlay/dropdown.js';

defineElement('context-menu', LyraContextMenu);
