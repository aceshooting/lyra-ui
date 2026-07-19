export * from './neighbor-list.class.js';
import { LyraNeighborList } from './neighbor-list.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../layout/virtual-list/virtual-list.js';
import '../../overlays/empty/empty.js';
defineElement('neighbor-list', LyraNeighborList);
