/** @deprecated Import @aceshooting/lyra-ui/components/lr-poll-status.js to register this component. */
export * from './poll-status.class.js';
import { LyraPollStatus } from './poll-status.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../live-region/live-region.js';
import '../icon/icon.js';
defineElement('poll-status', LyraPollStatus);
