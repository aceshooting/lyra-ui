/** @deprecated Import @aceshooting/lyra-ui/components/lr-lightbox.js to register this component. */
export * from './lightbox.class.js';
import { LyraLightbox } from './lightbox.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../pan-zoom/pan-zoom.js';
defineElement('lightbox', LyraLightbox);
