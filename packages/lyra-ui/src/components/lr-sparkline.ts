export * from './data/sparkline/sparkline.class.js';
import { LyraSparkline } from './data/sparkline/sparkline.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('sparkline', LyraSparkline);
