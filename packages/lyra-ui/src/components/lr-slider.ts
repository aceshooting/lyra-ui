export * from './forms/slider/slider.class.js';
import { LyraSlider } from './forms/slider/slider.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('slider', LyraSlider);
