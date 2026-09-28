/** @deprecated Import @aceshooting/lyra-ui/components/lr-carousel.js to register this component. */
import { defineElement } from '../../../internal/prefix.js';
import { LyraCarousel } from './carousel.class.js';

defineElement('carousel', LyraCarousel);
export { LyraCarousel } from './carousel.class.js';
export type {
  LyraCarouselEventMap,
  LyraCarouselOrientation,
} from './carousel.class.js';
