export * from './utility/poll-status/poll-status.class.js';
import { LyraPollStatus } from './utility/poll-status/poll-status.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-live-region.js';
defineElement('poll-status', LyraPollStatus);
