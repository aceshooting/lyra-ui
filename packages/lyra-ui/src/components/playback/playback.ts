export * from './playback.class.js';
import { LyraPlayback } from './playback.class.js';
import { defineElement } from '../../internal/prefix.js';
defineElement('playback', LyraPlayback);
