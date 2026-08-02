import { LyraVideoPlaylist } from '../src/components/media/video-playlist/video-playlist.class.js';

const playlist = document.querySelector('lr-video-playlist');
const typedPlaylist: LyraVideoPlaylist | null = playlist;
playlist?.goTo(0);

type PlaylistElement = HTMLElementTagNameMap['lr-video-playlist'];
const mappedPlaylist: PlaylistElement | null = playlist;
void [typedPlaylist, mappedPlaylist];
