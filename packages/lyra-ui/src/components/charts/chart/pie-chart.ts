/** @deprecated Import @aceshooting/lyra-ui/components/lr-pie-chart.js to register this component. */
export * from './pie-chart.class.js';
import { LyraPieChart } from './pie-chart.class.js';
import { defineElement } from '../../../internal/prefix.js';
import './chart.js';
defineElement('pie-chart', LyraPieChart);
