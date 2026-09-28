/** @deprecated Import @aceshooting/lyra-ui/components/lr-audio-visualizer.js to register this component. */
export * from './audio-visualizer.class.js';
import { LyraAudioVisualizer } from './audio-visualizer.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('audio-visualizer', LyraAudioVisualizer);
