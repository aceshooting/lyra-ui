export * from './sparkline.class.js';
import { LyraSparkline } from './sparkline.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('sparkline', LyraSparkline);
