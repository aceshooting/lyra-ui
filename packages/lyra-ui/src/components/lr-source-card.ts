export * from './retrieval/source-card/source-card.class.js';
import { LyraSourceCard } from './retrieval/source-card/source-card.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('source-card', LyraSourceCard);
