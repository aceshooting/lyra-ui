export * from './lightbox.class.js';
import { LyraLightbox } from './lightbox.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../zoomable-frame/zoomable-frame.js';
defineElement('lightbox', LyraLightbox);
