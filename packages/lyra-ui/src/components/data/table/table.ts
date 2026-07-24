export * from './table.class.js';
import { LyraTable } from './table.class.js';
import { defineElement } from '../../../internal/prefix.js';
import "../../overlays/empty/empty.js";
import '../pagination/pagination.js';
import '../../overlays/spinner/spinner.js';
import '../../overlays/skeleton/skeleton.js';
defineElement('table', LyraTable);
