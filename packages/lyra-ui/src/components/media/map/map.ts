/** @deprecated Import @aceshooting/lyra-ui/components/lr-map.js to register this component. */
export * from './map.class.js';
import { LyraMap } from './map.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../overlays/skeleton/skeleton.js';
defineElement('map', LyraMap);
