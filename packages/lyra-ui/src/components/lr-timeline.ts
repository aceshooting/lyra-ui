export * from './data/timeline/timeline.class.js';
import { LyraTimeline } from './data/timeline/timeline.class.js';
import { defineElement } from '../internal/prefix.js';
// Registers the item implementation needed for author-order collision representatives. The class
// module remains side-effect free; only this registration entry composes its child dependency.
import './lr-timeline-item.js';
defineElement('timeline', LyraTimeline);
