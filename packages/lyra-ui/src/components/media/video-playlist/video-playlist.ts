/** @deprecated Import @aceshooting/lyra-ui/components/lr-video-playlist.js to register this component. */
export * from './video-playlist.class.js';
import '../video/video.js';
import { defineElement } from '../../../internal/prefix.js';
import { LyraVideoPlaylist } from './video-playlist.class.js';

defineElement('video-playlist', LyraVideoPlaylist);
