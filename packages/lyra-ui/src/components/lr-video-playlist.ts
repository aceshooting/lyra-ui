export * from './media/video-playlist/video-playlist.class.js';
import './lr-video.js';
import { defineElement } from '../internal/prefix.js';
import { LyraVideoPlaylist } from './media/video-playlist/video-playlist.class.js';

defineElement('video-playlist', LyraVideoPlaylist);
