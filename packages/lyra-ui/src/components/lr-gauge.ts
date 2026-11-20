export type { LyraProgressVariant } from './overlays/progress/progress-base.js';
export * from './data/gauge/gauge.class.js';
import { LyraGauge } from './data/gauge/gauge.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('gauge', LyraGauge);
