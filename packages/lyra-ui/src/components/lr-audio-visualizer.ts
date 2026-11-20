export * from './conversation/audio-visualizer/audio-visualizer.class.js';
import { LyraAudioVisualizer } from './conversation/audio-visualizer/audio-visualizer.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('audio-visualizer', LyraAudioVisualizer);
