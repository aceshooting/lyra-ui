export * from './data/data-grid/data-grid.class.js';
import { LyraDataGrid } from './data/data-grid/data-grid.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-pagination.js';
// The shared loading/error/empty renderer composes <lr-empty> for the built-in error state.
import './lr-empty.js';

defineElement('data-grid', LyraDataGrid);
