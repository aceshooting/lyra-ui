/** @deprecated Import @aceshooting/lyra-ui/components/lr-flag.js to register this component. */
export * from './flag.class.js';
import { LyraFlag } from './flag.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../overlays/skeleton/skeleton.js';
defineElement('flag', LyraFlag);
