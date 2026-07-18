export * from './image-viewer.class.js';
import { html } from 'lit';
import { LyraImageViewer } from './image-viewer.class.js';
import { defineElement } from '../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile, type DocumentRendererDefinition } from '../document-viewer/registry.js';
import '../zoomable-frame/zoomable-frame.js';
import '../live-region/live-region.js';

defineElement('image-viewer', LyraImageViewer);

const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.bmp'];

const imageRendererDef: DocumentRendererDefinition = {
  matches: (file: DocumentFile) =>
    (file.mimeType.startsWith('image/') && file.mimeType !== 'image/svg+xml') ||
    IMAGE_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)),
  capabilities: { anchors: ['region'] },
  render: (file: DocumentFile) => html`<lr-image-viewer
    src=${file.src}
    name=${file.name}
    alt=${file.alt ?? file.name}
    .anchor=${file.anchor ?? null}
    .highlights=${file.highlights ?? []}
  ></lr-image-viewer>`,
};

for (const mime of IMAGE_MIME_TYPES) registerDocumentRenderer(mime, imageRendererDef);
