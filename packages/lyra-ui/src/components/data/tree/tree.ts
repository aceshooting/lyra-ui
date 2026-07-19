export * from './tree.class.js';
import { LyraTree } from './tree.class.js';
import { defineElement } from '../../../internal/prefix.js';
import "./tree-node.js";
defineElement('tree', LyraTree);
