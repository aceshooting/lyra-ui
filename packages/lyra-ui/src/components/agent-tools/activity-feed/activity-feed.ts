/** @deprecated Import @aceshooting/lyra-ui/components/lr-activity-feed.js to register this component. */
export * from './activity-feed.class.js';
import '../../utility/live-region/live-region.js';
import '../../layout/virtual-list/virtual-list.js';
import { LyraActivityFeed } from './activity-feed.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('activity-feed', LyraActivityFeed);
