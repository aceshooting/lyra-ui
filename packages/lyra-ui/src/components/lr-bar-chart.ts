export * from './charts/chart/bar-chart.class.js';
import { LyraBarChart } from './charts/chart/bar-chart.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-chart.js';
defineElement('bar-chart', LyraBarChart);
