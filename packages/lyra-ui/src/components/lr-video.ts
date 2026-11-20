export * from './media/video/video.class.js';
import './lr-icon.js';
import { LyraVideo } from './media/video/video.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('video', LyraVideo);
