/** @deprecated Import @aceshooting/lyra-ui/components/lr-flow-node.js to register this component. */
export * from './flow-node.class.js';
import { LyraFlowNode } from './flow-node.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('flow-node', LyraFlowNode);
