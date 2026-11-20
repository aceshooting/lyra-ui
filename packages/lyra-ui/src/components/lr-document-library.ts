export * from './data/document-library/document-library.class.js';
import { LyraDocumentLibrary } from './data/document-library/document-library.class.js';
import { defineElement } from '../internal/prefix.js';
import { defineLazyChildren } from '../internal/lazy-children.js';
import './lr-table.js';
import './lr-checkbox.js';
import './lr-chip.js';
import './lr-chip-group.js';
import './lr-file-icon.js';
import './lr-input.js';
// The tag facet's combobox registers the first time a library shows a tag.
defineLazyChildren('document-library', {
  combobox: () => import('./lr-combobox.js'),
});
defineElement('document-library', LyraDocumentLibrary);
