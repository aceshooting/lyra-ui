/** @deprecated Import @aceshooting/lyra-ui/components/lr-bubble-chart.js to register this component. */
export * from './bubble-chart.class.js';
import { LyraBubbleChart } from './bubble-chart.class.js';
import { defineElement } from '../../../internal/prefix.js';
import './chart.js';
defineElement('bubble-chart', LyraBubbleChart);
