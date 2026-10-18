/** @deprecated Import @aceshooting/lyra-ui/components/lr-task-list.js to register this component. */
export * from './task-list.class.js';
import '../../utility/live-region/live-region.js';
import '../../layout/virtual-list/virtual-list.js';
import { LyraTaskList } from './task-list.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('task-list', LyraTaskList);
