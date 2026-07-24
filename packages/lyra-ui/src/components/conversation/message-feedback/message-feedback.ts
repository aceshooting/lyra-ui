export * from './message-feedback.class.js';
import '../../overlays/chip/chip.js';
import '../../utility/live-region/live-region.js';
import { LyraMessageFeedback } from './message-feedback.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('message-feedback', LyraMessageFeedback);
