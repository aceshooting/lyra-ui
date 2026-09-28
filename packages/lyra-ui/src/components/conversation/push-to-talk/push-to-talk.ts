/** @deprecated Import @aceshooting/lyra-ui/components/lr-push-to-talk.js to register this component. */
export * from './push-to-talk.class.js';
import { LyraPushToTalk } from './push-to-talk.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../utility/live-region/live-region.js';
defineElement('push-to-talk', LyraPushToTalk);
