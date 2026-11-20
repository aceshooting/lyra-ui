export * from './media/animated-image/animated-image.class.js';
import { LyraAnimatedImage } from './media/animated-image/animated-image.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('animated-image', LyraAnimatedImage);
