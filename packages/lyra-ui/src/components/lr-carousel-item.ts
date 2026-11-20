export * from './layout/carousel/carousel-item.class.js';
import { LyraCarouselItem } from './layout/carousel/carousel-item.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('carousel-item', LyraCarouselItem);
