/** @deprecated Import @aceshooting/lyra-ui/components/lr-eval-dataset.js to register this component. */
export * from './eval-dataset.class.js';
import '../../data/table/table.js';
import '../../overlays/chip/chip.js';
import '../../overlays/chip/chip-group.js';
import '../../media/file-input/file-input.js';
import '../../utility/export-button/export-button.js';
import { LyraEvalDataset } from './eval-dataset.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { defineLazyChildren } from '../../../internal/lazy-children.js';
// The search field registers the first time the dataset is searchable.
defineLazyChildren('eval-dataset', {
  input: () => import('../../forms/input/input.js'),
});
defineElement('eval-dataset', LyraEvalDataset);
