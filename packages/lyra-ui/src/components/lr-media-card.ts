export * from './media/media-card/media-card.class.js';
import { LyraMediaCard } from './media/media-card/media-card.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('media-card', LyraMediaCard);
