export * from './data/flow-canvas/flow-canvas.class.js';
import { LyraFlowCanvas } from './data/flow-canvas/flow-canvas.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-empty.js';
import './lr-flow-node.js';
defineElement('flow-canvas', LyraFlowCanvas);
