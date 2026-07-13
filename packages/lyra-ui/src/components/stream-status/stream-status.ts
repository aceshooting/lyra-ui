export * from './stream-status.class.js';
import { LyraStreamStatus } from './stream-status.class.js';
import { defineElement } from '../../internal/prefix.js';
import "../live-region/live-region.js";
defineElement('stream-status', LyraStreamStatus);
