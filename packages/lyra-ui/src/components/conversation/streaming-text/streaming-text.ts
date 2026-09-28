/** @deprecated Import @aceshooting/lyra-ui/components/lr-streaming-text.js to register this component. */
export * from './streaming-text.class.js';
import { LyraStreamingText } from './streaming-text.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../markdown/markdown.js';
defineElement('streaming-text', LyraStreamingText);
