/** @deprecated Import @aceshooting/lyra-ui/components/lr-stack-trace.js to register this component. */
export * from './stack-trace.class.js';
export * from './stack-trace-parse.js';
import { LyraStackTrace } from './stack-trace.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('stack-trace', LyraStackTrace);
