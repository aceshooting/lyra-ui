export * from './data/flow-minimap/flow-minimap.class.js';
import { LyraFlowMinimap } from './data/flow-minimap/flow-minimap.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('flow-minimap', LyraFlowMinimap);
