/** @deprecated Import @aceshooting/lyra-ui/components/lr-document-library.js to register this component. */
export * from './document-library.class.js';
import { LyraDocumentLibrary } from './document-library.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { defineLazyChildren } from '../../../internal/lazy-children.js';
import '../table/table.js';
import '../../forms/checkbox/checkbox.js';
import '../../overlays/chip/chip.js';
import '../../overlays/chip/chip-group.js';
import '../../media/file-icon/file-icon.js';
import '../../forms/input/input.js';
// The tag facet's combobox registers the first time a library shows a tag.
defineLazyChildren('document-library', {
  combobox: () => import('../../forms/combobox/combobox.js'),
});
defineElement('document-library', LyraDocumentLibrary);
