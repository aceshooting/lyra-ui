/** @deprecated Import @aceshooting/lyra-ui/components/lr-scatter-chart.js to register this component. */
export * from './scatter-chart.class.js';
import { LyraScatterChart } from './scatter-chart.class.js';
import { defineElement } from '../../../internal/prefix.js';
import './chart.js';
defineElement('scatter-chart', LyraScatterChart);
