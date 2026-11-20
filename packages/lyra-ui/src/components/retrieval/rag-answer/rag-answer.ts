/** @deprecated Import @aceshooting/lyra-ui/components/lr-rag-answer.js to register this component. */
export * from './rag-answer.class.js';
import '../../conversation/markdown/markdown.js';
import '../citation-badge/citation-badge.js';
import '../source-list/source-list.js';
import '../source-card/source-card.js';
import '../../overlays/spinner/spinner.js';
import '../../forms/button/button.js';
import { LyraRagAnswer } from './rag-answer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { defineLazyChildren } from '../../../internal/lazy-children.js';
// The grounding summary registers the first time an answer carries an assessment.
defineLazyChildren('rag-answer', {
  'grounding-summary': () => import('../grounding-summary/grounding-summary.js'),
});
defineElement('rag-answer', LyraRagAnswer);
