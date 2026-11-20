export * from './forms/time-range/time-range.class.js';
import { LyraTimeRange } from './forms/time-range/time-range.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('time-range', LyraTimeRange);
