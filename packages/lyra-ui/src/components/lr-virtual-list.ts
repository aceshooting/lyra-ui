export * from './layout/virtual-list/virtual-list.class.js';
import { LyraVirtualList } from './layout/virtual-list/virtual-list.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('virtual-list', LyraVirtualList);
