export * from './activity-feed.class.js';
import { LyraActivityFeed } from './activity-feed.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('activity-feed', LyraActivityFeed);
