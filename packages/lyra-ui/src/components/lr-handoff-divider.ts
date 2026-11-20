export * from './conversation/handoff-divider/handoff-divider.class.js';
import { LyraHandoffDivider } from './conversation/handoff-divider/handoff-divider.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('handoff-divider', LyraHandoffDivider);
