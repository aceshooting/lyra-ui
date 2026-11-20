export * from './media/animation/animation.class.js';
import { LyraAnimation } from './media/animation/animation.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('animation', LyraAnimation);
