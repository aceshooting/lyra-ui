/** @deprecated Import @aceshooting/lyra-ui/components/lr-doughnut-chart.js to register this component. */
export * from './doughnut-chart.class.js';
import { LyraDoughnutChart } from './doughnut-chart.class.js';
import { defineElement } from '../../../internal/prefix.js';
import './chart.js';
defineElement('doughnut-chart', LyraDoughnutChart);
