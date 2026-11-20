export * from './viewers/document-compare/document-compare.class.js';
import { LyraDocumentCompare } from './viewers/document-compare/document-compare.class.js';
import { defineElement } from '../internal/prefix.js';
import { defineLazyChildren } from '../internal/lazy-children.js';
import './lr-diff-view.js';
// The side-by-side panes register the first time that view renders them.
defineLazyChildren('document-compare', {
  'document-preview': () => import('./lr-document-preview.js'),
});
defineElement('document-compare', LyraDocumentCompare);
