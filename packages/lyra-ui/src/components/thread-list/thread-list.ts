export * from './thread-list.class.js';
import { LyraThreadList } from './thread-list.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../conversation-item/conversation-item.js';
import '../virtual-list/virtual-list.js';
import '../live-region/live-region.js';
defineElement('thread-list', LyraThreadList);
