/** @deprecated Import @aceshooting/lyra-ui/components/lr-mind-map.js to register this component. */
export * from './mind-map.class.js';
import { LyraMindMap } from './mind-map.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('mind-map', LyraMindMap);
