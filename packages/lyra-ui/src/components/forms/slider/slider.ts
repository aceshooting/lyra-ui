/** @deprecated Import @aceshooting/lyra-ui/components/lr-slider.js to register this component. */
export * from './slider.class.js';
import { LyraSlider } from './slider.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('slider', LyraSlider);
