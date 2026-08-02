export * from './video.class.js';
import '../../utility/icon/icon.js';
import { LyraVideo } from './video.class.js';
import { defineElement } from '../../../internal/prefix.js';

defineElement('video', LyraVideo);
