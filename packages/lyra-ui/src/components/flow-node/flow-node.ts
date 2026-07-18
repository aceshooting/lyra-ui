export * from './flow-node.class.js';
import { LyraFlowNode } from './flow-node.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('flow-node', LyraFlowNode);
