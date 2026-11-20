export type { LyraSpanKind, LyraSpanStatus } from './agent-tools/trace-tree/span-shared.js';
export * from './agent-tools/span-waterfall/span-waterfall.class.js';
import { LyraSpanWaterfall } from './agent-tools/span-waterfall/span-waterfall.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-empty.js';

defineElement('span-waterfall', LyraSpanWaterfall);
