/** @deprecated Import @aceshooting/lyra-ui/components/lr-document-compare.js to register this component. */
export * from './document-compare.class.js';
import { LyraDocumentCompare } from './document-compare.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { defineLazyChildren } from '../../../internal/lazy-children.js';
import '../../utility/diff-view/diff-view.js';
// The side-by-side panes register the first time that view renders them.
defineLazyChildren('document-compare', {
  'document-preview': () => import('../document-preview/document-preview.js'),
});
defineElement('document-compare', LyraDocumentCompare);
