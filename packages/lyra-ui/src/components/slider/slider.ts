export * from './slider.class.js';
import { LyraSlider } from './slider.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('slider', LyraSlider);
