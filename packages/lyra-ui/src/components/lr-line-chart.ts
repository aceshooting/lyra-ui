export * from './charts/chart/line-chart.class.js';
import { LyraLineChart } from './charts/chart/line-chart.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-chart.js';
defineElement('line-chart', LyraLineChart);
