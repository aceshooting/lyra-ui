import {
  LyraVideoPlaylist,
  type LyraVideoPlaylistItem,
} from '../src/components/media/video-playlist/video-playlist.class.js';
import type { LyraVideoPlaylistItem as RootVideoPlaylistItem } from '../src/lyra.js';

const playlist = document.querySelector('lr-video-playlist');
const typedPlaylist: LyraVideoPlaylist | null = playlist;
playlist?.goTo(0);
const initialItems: readonly LyraVideoPlaylistItem[] = [
  { title: 'Introduction', poster: '/poster.jpg', duration: 65, unavailable: false },
];
const rootInitialItems: readonly RootVideoPlaylistItem[] = initialItems;
if (playlist) playlist.items = initialItems;

type PlaylistElement = HTMLElementTagNameMap['lr-video-playlist'];
const mappedPlaylist: PlaylistElement | null = playlist;
void [typedPlaylist, mappedPlaylist, rootInitialItems];
