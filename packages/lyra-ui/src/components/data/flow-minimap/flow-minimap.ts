/** @deprecated Import @aceshooting/lyra-ui/components/lr-flow-minimap.js to register this component. */
export * from './flow-minimap.class.js';
import { LyraFlowMinimap } from './flow-minimap.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('flow-minimap', LyraFlowMinimap);
