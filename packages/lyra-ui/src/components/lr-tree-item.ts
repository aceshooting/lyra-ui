export type { LyraTreeNodeData } from './data/tree/tree-types.js';
export * from './data/tree/tree-item.class.js';
import { LyraTreeItem } from './data/tree/tree-item.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('tree-item', LyraTreeItem);
