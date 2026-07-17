export * from './span-waterfall.class.js';
import { LyraSpanWaterfall } from './span-waterfall.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../live-region/live-region.js';
import '../empty/empty.js';

defineElement('span-waterfall', LyraSpanWaterfall);
