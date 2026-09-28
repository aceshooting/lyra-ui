/** @deprecated Import @aceshooting/lyra-ui/components/lr-bar-chart.js to register this component. */
export * from './bar-chart.class.js';
import { LyraBarChart } from './bar-chart.class.js';
import { defineElement } from '../../../internal/prefix.js';
import './chart.js';
defineElement('bar-chart', LyraBarChart);
