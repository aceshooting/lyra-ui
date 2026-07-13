export * from './card.class.js';
import { LyraCard } from './card.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('card', LyraCard);
