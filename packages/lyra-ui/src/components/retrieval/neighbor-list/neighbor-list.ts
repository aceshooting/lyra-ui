/** @deprecated Import @aceshooting/lyra-ui/components/lr-neighbor-list.js to register this component. */
export * from './neighbor-list.class.js';
import { LyraNeighborList } from './neighbor-list.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../overlays/empty/empty.js';
defineElement('neighbor-list', LyraNeighborList);
