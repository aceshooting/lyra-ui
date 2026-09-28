/** @deprecated Import @aceshooting/lyra-ui/components/lr-virtual-list.js to register this component. */
export * from './virtual-list.class.js';
import { LyraVirtualList } from './virtual-list.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('virtual-list', LyraVirtualList);
