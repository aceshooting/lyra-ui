export * from './agent-tools/activity-feed/activity-feed.class.js';
import './lr-live-region.js';
import './lr-virtual-list.js';
import { LyraActivityFeed } from './agent-tools/activity-feed/activity-feed.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('activity-feed', LyraActivityFeed);
