export * from './polar-area-chart.class.js';
import { LyraPolarAreaChart } from './polar-area-chart.class.js';
import { defineElement } from '../../internal/prefix.js';
import "./chart.js";
defineElement('polar-area-chart', LyraPolarAreaChart);
