/** @deprecated Import @aceshooting/lyra-ui/components/lr-progress-bar.js to register this component. */
export * from './progress-bar.class.js';
import { LyraProgressBar } from './progress-bar.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('progress-bar', LyraProgressBar);
