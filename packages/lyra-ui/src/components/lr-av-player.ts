export type { AnchorResultDetail, HighlightActivateDetail, LyraAnchorKind } from '../internal/document-anchors.js';
export type { LyraSearchChangeDetail } from '../internal/text-viewer-target.js';
export * from './media/av-player/av-player.class.js';
import { html } from 'lit';
import { LyraAvPlayer } from './media/av-player/av-player.class.js';
import { defineElement } from '../internal/prefix.js';
import {
  createDocumentRendererAdapter,
  registerDocumentRenderer,
  type LyraDocumentFile,
  type LyraDocumentRendererDefinition,
} from './viewers/document-viewer/registry.js';
import { hasSearchableLyraAvCues } from './media/av-player/av-metadata.js';

import { defineLazyChildren } from '../internal/lazy-children.js';
// The transcript list registers the first time the player has cues.
defineLazyChildren('av-player', {
  'virtual-list': () => import('./lr-virtual-list.js'),
});
defineElement('av-player', LyraAvPlayer);

const AV_EXTENSIONS = ['.mp3', '.m4a', '.wav', '.ogg', '.oga', '.flac', '.aac', '.mp4', '.m4v', '.webm', '.mov'];
const AV_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  'audio/aac',
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
];

const avRendererAdapter = createDocumentRendererAdapter({
  kind: 'av',
  adapt: (file, supplied) => supplied?.kind === 'av'
    ? supplied
    : { kind: 'av', file, cues: [], tracks: [] },
  capabilities: (payload) => ({
    anchors: ['time-range'],
    search: hasSearchableLyraAvCues(payload.cues),
  }),
  render: (payload) => html`<lr-av-player
    src=${payload.file.src}
    name=${payload.file.name}
    mime-type=${payload.file.mimeType}
    .anchor=${payload.file.anchor ?? null}
    .highlights=${payload.file.highlights ?? []}
    .cues=${payload.cues}
    .tracks=${payload.tracks}
  ></lr-av-player>`,
});

const avRendererDef: LyraDocumentRendererDefinition = {
  matches: (file: LyraDocumentFile) =>
    file.mimeType.startsWith('audio/') ||
    file.mimeType.startsWith('video/') ||
    AV_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)),
  adapter: avRendererAdapter,
};

for (const mime of AV_MIME_TYPES) registerDocumentRenderer(mime, avRendererDef);
