export * from './retrieval/citation-badge/citation-badge.class.js';
import { LyraCitationBadge } from './retrieval/citation-badge/citation-badge.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('citation-badge', LyraCitationBadge);
