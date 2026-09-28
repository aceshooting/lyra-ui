/** @deprecated Import @aceshooting/lyra-ui/components/lr-resize-observer.js to register this component. */
export * from './resize-observer.class.js';
import { LyraResizeObserver } from './resize-observer.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('resize-observer', LyraResizeObserver);
