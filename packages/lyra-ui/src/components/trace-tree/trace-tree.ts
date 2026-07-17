export * from './trace-tree.class.js';
export * from './span.js';
import { LyraTraceTree } from './trace-tree.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../live-region/live-region.class.js';
import '../empty/empty.class.js';

defineElement('trace-tree', LyraTraceTree);
