/** @deprecated Import @aceshooting/lyra-ui/components/lr-path-strip.js to register this component. */
export * from './path-strip.class.js';
import { LyraPathStrip } from './path-strip.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../layout/scroller/scroller.js';
defineElement('path-strip', LyraPathStrip);
