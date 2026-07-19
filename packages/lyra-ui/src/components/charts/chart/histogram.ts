export * from './histogram.class.js';
import { LyraHistogram } from './histogram.class.js';
import { defineElement } from '../../../internal/prefix.js';
import "./chart.js";
defineElement('histogram', LyraHistogram);
