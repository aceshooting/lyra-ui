/** @deprecated Import @aceshooting/lyra-ui/components/lr-data-grid.js to register this component. */
export * from './data-grid.class.js';
import { LyraDataGrid } from './data-grid.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../pagination/pagination.js';
// The shared loading/error/empty renderer composes <lr-empty> for the built-in error state.
import '../../overlays/empty/empty.js';

defineElement('data-grid', LyraDataGrid);
