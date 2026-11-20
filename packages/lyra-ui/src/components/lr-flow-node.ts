export type { FlowHandle } from './data/flow-canvas/flow-types.js';
export * from './data/flow-node/flow-node.class.js';
import { LyraFlowNode } from './data/flow-node/flow-node.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('flow-node', LyraFlowNode);
