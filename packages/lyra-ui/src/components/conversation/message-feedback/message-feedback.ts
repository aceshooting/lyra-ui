/** @deprecated Import @aceshooting/lyra-ui/components/lr-message-feedback.js to register this component. */
export * from './message-feedback.class.js';
import '../../overlays/chip/chip.js';
import { LyraMessageFeedback } from './message-feedback.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('message-feedback', LyraMessageFeedback);
