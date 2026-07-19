export * from './span-waterfall.class.js';
import { LyraSpanWaterfall } from './span-waterfall.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../utility/live-region/live-region.js';
import '../../overlays/empty/empty.js';

defineElement('span-waterfall', LyraSpanWaterfall);
