export type { LyraStreamPhase } from '../internal/stream-phase.js';
export * from './agent-tools/browser-frame/browser-frame.class.js';
import { LyraBrowserFrame } from './agent-tools/browser-frame/browser-frame.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('browser-frame', LyraBrowserFrame);
