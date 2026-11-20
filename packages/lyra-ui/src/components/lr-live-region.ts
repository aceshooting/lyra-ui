export type { AnnounceOptions } from '../internal/announcer.js';
export * from './utility/live-region/live-region.class.js';
import { LyraLiveRegion } from './utility/live-region/live-region.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('live-region', LyraLiveRegion);
