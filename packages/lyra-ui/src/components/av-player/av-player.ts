export * from './av-player.class.js';
import { html } from 'lit';
import { LyraAvPlayer } from './av-player.class.js';
import { defineElement } from '../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile, type DocumentRendererDefinition } from '../document-viewer/registry.js';

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

const avRendererDef: DocumentRendererDefinition = {
  matches: (file: DocumentFile) =>
    file.mimeType.startsWith('audio/') ||
    file.mimeType.startsWith('video/') ||
    AV_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)),
  capabilities: { anchors: ['time-range'], search: true },
  render: (file: DocumentFile) => html`<lr-av-player
    src=${file.src}
    name=${file.name}
    mime-type=${file.mimeType}
    .anchor=${file.anchor ?? null}
    .highlights=${file.highlights ?? []}
  ></lr-av-player>`,
};

for (const mime of AV_MIME_TYPES) registerDocumentRenderer(mime, avRendererDef);
