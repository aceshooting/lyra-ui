export * from './file-tree.class.js';
import '../tree/tree.js';
import '../../media/file-icon/file-icon.js';
import { LyraFileTree } from './file-tree.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('file-tree', LyraFileTree);
