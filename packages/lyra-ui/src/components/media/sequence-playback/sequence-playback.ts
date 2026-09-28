/** @deprecated Import @aceshooting/lyra-ui/components/lr-sequence-playback.js to register this component. */
export * from './sequence-playback.class.js';
import { LyraSequencePlayback } from './sequence-playback.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('sequence-playback', LyraSequencePlayback);
