export * from './overlays/progress/progress-ring.class.js';
import { LyraProgressRing } from './overlays/progress/progress-ring.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('progress-ring', LyraProgressRing);
