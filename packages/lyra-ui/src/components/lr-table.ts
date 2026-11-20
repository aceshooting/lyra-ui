export * from './data/table/table.class.js';
import { LyraTable } from './data/table/table.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-empty.js';
import './lr-pagination.js';
import './lr-spinner.js';
import './lr-skeleton.js';
defineElement('table', LyraTable);
