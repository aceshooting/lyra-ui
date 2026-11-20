export * from './conversation/push-to-talk/push-to-talk.class.js';
import { LyraPushToTalk } from './conversation/push-to-talk/push-to-talk.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-live-region.js';
defineElement('push-to-talk', LyraPushToTalk);
