export * from './charts/chart/histogram.class.js';
import { LyraHistogram } from './charts/chart/histogram.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-chart.js';
defineElement('histogram', LyraHistogram);
