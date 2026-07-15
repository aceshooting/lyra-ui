export * from './carousel-item.class.js';
import { LyraCarouselItem } from './carousel-item.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('carousel-item', LyraCarouselItem);
