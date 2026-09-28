/** @deprecated Import @aceshooting/lyra-ui/components/lr-line-chart.js to register this component. */
export * from './line-chart.class.js';
import { LyraLineChart } from './line-chart.class.js';
import { defineElement } from '../../../internal/prefix.js';
import './chart.js';
defineElement('line-chart', LyraLineChart);
