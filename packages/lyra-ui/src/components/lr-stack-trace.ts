export * from './agent-tools/stack-trace/stack-trace.class.js';
export * from './agent-tools/stack-trace/stack-trace-parse.js';
import { LyraStackTrace } from './agent-tools/stack-trace/stack-trace.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('stack-trace', LyraStackTrace);
