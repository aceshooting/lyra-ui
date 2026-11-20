export type { SourceCardOpenDetail } from './retrieval/source-card/source-card.class.js';
export * from './retrieval/rag-answer/rag-answer.class.js';
import './lr-markdown.js';
import './lr-citation-badge.js';
import './lr-source-list.js';
import './lr-source-card.js';
import './lr-spinner.js';
import './lr-button.js';
import { LyraRagAnswer } from './retrieval/rag-answer/rag-answer.class.js';
import { defineElement } from '../internal/prefix.js';
import { defineLazyChildren } from '../internal/lazy-children.js';
// The grounding summary registers the first time an answer carries an assessment.
defineLazyChildren('rag-answer', {
  'grounding-summary': () => import('./lr-grounding-summary.js'),
});
defineElement('rag-answer', LyraRagAnswer);
