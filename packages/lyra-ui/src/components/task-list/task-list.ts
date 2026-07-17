export * from './task-list.class.js';
import { LyraTaskList } from './task-list.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('task-list', LyraTaskList);
