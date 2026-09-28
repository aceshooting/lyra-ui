/** @deprecated Import @aceshooting/lyra-ui/components/lr-trace-tree.js to register this component. */
export * from './trace-tree.class.js';
export * from './span.js';
import { LyraTraceTree } from './trace-tree.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../utility/live-region/live-region.js';
import '../../overlays/empty/empty.js';

defineElement('trace-tree', LyraTraceTree);
