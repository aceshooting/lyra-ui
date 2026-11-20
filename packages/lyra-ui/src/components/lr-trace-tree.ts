export * from './agent-tools/trace-tree/trace-tree.class.js';
export * from './agent-tools/trace-tree/span.js';
import { LyraTraceTree } from './agent-tools/trace-tree/trace-tree.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-live-region.js';
import './lr-empty.js';

defineElement('trace-tree', LyraTraceTree);
