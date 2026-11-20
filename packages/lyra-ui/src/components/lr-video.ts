export type { Engine3dFallbackDetail, Engine3dPreference } from '../internal/engine-3d.js';
export * from './media/video/video.class.js';
import './lr-icon.js';
import { LyraVideo } from './media/video/video.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('video', LyraVideo);
