export * from './charts/chart/doughnut-chart.class.js';
import { LyraDoughnutChart } from './charts/chart/doughnut-chart.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-chart.js';
defineElement('doughnut-chart', LyraDoughnutChart);
