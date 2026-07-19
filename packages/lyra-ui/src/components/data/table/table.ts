export * from './table.class.js';
import { LyraTable } from './table.class.js';
import { defineElement } from '../../../internal/prefix.js';
import "../../overlays/empty/empty.js";
defineElement('table', LyraTable);
