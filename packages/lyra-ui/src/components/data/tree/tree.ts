/** @deprecated Import @aceshooting/lyra-ui/components/lr-tree.js to register this component. */
export * from './tree.class.js';
import { LyraTree } from './tree.class.js';
import { defineElement } from '../../../internal/prefix.js';
import './tree-item.js';
import '../../overlays/empty/empty.js';
import '../../utility/live-region/live-region.js';
defineElement('tree', LyraTree);
