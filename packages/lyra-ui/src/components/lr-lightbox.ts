export * from './media/lightbox/lightbox.class.js';
import { LyraLightbox } from './media/lightbox/lightbox.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-pan-zoom.js';
defineElement('lightbox', LyraLightbox);
