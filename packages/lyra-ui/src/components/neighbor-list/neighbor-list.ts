export * from './neighbor-list.class.js';
import { LyraNeighborList } from './neighbor-list.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../virtual-list/virtual-list.js';
import '../empty/empty.js';
defineElement('neighbor-list', LyraNeighborList);
