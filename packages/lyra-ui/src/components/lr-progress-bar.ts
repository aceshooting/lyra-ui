export * from './overlays/progress/progress-bar.class.js';
import { LyraProgressBar } from './overlays/progress/progress-bar.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('progress-bar', LyraProgressBar);
