export * from './push-to-talk.class.js';
import { LyraPushToTalk } from './push-to-talk.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../live-region/live-region.js';
defineElement('push-to-talk', LyraPushToTalk);
