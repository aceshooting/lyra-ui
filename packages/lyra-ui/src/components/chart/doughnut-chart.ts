export * from './doughnut-chart.class.js';
import { LyraDoughnutChart } from './doughnut-chart.class.js';
import { defineElement } from '../../internal/prefix.js';
import "./chart.js";
defineElement('doughnut-chart', LyraDoughnutChart);
