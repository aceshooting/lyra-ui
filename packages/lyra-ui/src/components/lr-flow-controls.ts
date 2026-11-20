export * from './data/flow-controls/flow-controls.class.js';
import { LyraFlowControls } from './data/flow-controls/flow-controls.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('flow-controls', LyraFlowControls);
