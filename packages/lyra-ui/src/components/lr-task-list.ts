export * from './agent-tools/task-list/task-list.class.js';
import './lr-live-region.js';
import { LyraTaskList } from './agent-tools/task-list/task-list.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('task-list', LyraTaskList);
