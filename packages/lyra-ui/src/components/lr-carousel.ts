import { defineElement } from '../internal/prefix.js';
import { LyraCarousel } from './layout/carousel/carousel.class.js';

defineElement('carousel', LyraCarousel);
export { LyraCarousel } from './layout/carousel/carousel.class.js';
export type {
  LyraCarouselEventMap,
  LyraCarouselOrientation,
} from './layout/carousel/carousel.class.js';
