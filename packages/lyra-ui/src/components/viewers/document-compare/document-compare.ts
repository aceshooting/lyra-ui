export * from './document-compare.class.js';
import { LyraDocumentCompare } from './document-compare.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../document-preview/document-preview.js';
import '../../utility/diff-view/diff-view.js';
defineElement('document-compare', LyraDocumentCompare);
