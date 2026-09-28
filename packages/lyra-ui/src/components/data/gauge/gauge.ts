/** @deprecated Import @aceshooting/lyra-ui/components/lr-gauge.js to register this component. */
export * from './gauge.class.js';
import { LyraGauge } from './gauge.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('gauge', LyraGauge);
