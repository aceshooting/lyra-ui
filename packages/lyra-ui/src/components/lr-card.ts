export * from './layout/card/card.class.js';
import { LyraCard } from './layout/card/card.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('card', LyraCard);
