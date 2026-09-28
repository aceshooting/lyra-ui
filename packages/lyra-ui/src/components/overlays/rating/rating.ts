/** @deprecated Import @aceshooting/lyra-ui/components/lr-rating.js to register this component. */
export * from './rating.class.js';
import { LyraRating } from './rating.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('rating', LyraRating);
