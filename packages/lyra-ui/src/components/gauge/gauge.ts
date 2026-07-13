export * from './gauge.class.js';
import { LyraGauge } from './gauge.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('gauge', LyraGauge);
