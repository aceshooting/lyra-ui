/** @deprecated Import @aceshooting/lyra-ui/components/lr-stream-status.js to register this component. */
export * from './stream-status.class.js';
import { LyraStreamStatus } from './stream-status.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../utility/live-region/live-region.js';
defineElement('stream-status', LyraStreamStatus);
