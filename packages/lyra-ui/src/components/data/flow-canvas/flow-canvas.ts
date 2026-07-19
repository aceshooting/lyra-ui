export * from './flow-canvas.class.js';
import { LyraFlowCanvas } from './flow-canvas.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../overlays/empty/empty.js';
import '../flow-node/flow-node.js';
defineElement('flow-canvas', LyraFlowCanvas);
