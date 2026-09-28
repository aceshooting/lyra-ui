/** @deprecated Import @aceshooting/lyra-ui/components/lr-scroller.js to register this component. */
export * from './scroller.class.js';
import { LyraScroller } from './scroller.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('scroller', LyraScroller);
