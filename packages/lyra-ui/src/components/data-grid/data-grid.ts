export * from './data-grid.class.js';
import { LyraDataGrid } from './data-grid.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('data-grid', LyraDataGrid);
