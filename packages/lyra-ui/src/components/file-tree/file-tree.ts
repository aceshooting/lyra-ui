export * from './file-tree.class.js';
import { LyraFileTree } from './file-tree.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('file-tree', LyraFileTree);
