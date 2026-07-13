export * from './poll-status.class.js';
import { LyraPollStatus } from './poll-status.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../live-region/live-region.js';
defineElement('poll-status', LyraPollStatus);
