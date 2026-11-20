export * from './charts/chart/scatter-chart.class.js';
import { LyraScatterChart } from './charts/chart/scatter-chart.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-chart.js';
defineElement('scatter-chart', LyraScatterChart);
