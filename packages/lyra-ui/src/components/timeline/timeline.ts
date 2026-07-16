export * from './timeline.class.js';
import { LyraTimeline } from './timeline.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('timeline', LyraTimeline);
