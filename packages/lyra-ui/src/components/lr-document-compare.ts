export type { LyraDiffViewLayout } from './utility/diff-view/diff-view.class.js';
export type { HighlightActivateDetail, LyraAnchor, LyraHighlight } from '../internal/document-anchors.js';
export type { LyraAnchorTargetEventMap } from '../internal/anchor-target-base.js';
export type { LyraClipboardWriteFailure, LyraClipboardWriteSuccess } from '../internal/clipboard.js';
export type { ShikiLanguageInput } from '../internal/shiki/core.js';
export type { LyraSearchChangeDetail } from '../internal/text-viewer-target.js';
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
