export * from './data/bar-list/bar-list.class.js';
import { LyraBarList } from './data/bar-list/bar-list.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('bar-list', LyraBarList);
