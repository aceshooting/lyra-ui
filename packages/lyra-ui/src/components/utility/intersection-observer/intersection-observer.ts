/** @deprecated Import @aceshooting/lyra-ui/components/lr-intersection-observer.js to register this component. */
export * from './intersection-observer.class.js';
import { LyraIntersectionObserver } from './intersection-observer.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('intersection-observer', LyraIntersectionObserver);
