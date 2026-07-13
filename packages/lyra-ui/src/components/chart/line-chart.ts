export * from './line-chart.class.js';
import { LyraLineChart } from './line-chart.class.js';
import { defineElement } from '../../internal/prefix.js';
import "./chart.js";
defineElement('line-chart', LyraLineChart);
