export * from './timeline.class.js';
import { LyraTimeline } from './timeline.class.js';
import { defineElement } from '../../../internal/prefix.js';
// Registers the item implementation needed for author-order collision representatives. The class
// module remains side-effect free; only this registration entry composes its child dependency.
import './timeline-item.js';
defineElement('timeline', LyraTimeline);
