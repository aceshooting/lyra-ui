export type { AnchorResultDetail, HighlightActivateDetail, LyraAnchor, LyraAnchorKind } from './viewers/document-viewer/anchors.js';
export type { Engine3dFallbackDetail, Engine3dPreference } from '../internal/engine-3d.js';
export * from './media/image-viewer/image-viewer.class.js';
import { html } from 'lit';
import { LyraImageViewer } from './media/image-viewer/image-viewer.class.js';
import { defineElement } from '../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile, type LyraDocumentRendererDefinition } from './viewers/document-viewer/registry.js';
import './lr-pan-zoom.js';
import './lr-live-region.js';

defineElement('image-viewer', LyraImageViewer);

const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.bmp'];

const imageRendererDef: LyraDocumentRendererDefinition = {
  matches: (file: LyraDocumentFile) =>
    (file.mimeType.startsWith('image/') && file.mimeType !== 'image/svg+xml') ||
    IMAGE_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)),
  capabilities: { anchors: ['region'] },
  render: (file: LyraDocumentFile) => html`<lr-image-viewer
    src=${file.src}
    name=${file.name}
    alt=${file.alt ?? file.name}
    .anchor=${file.anchor ?? null}
    .highlights=${file.highlights ?? []}
  ></lr-image-viewer>`,
};

for (const mime of IMAGE_MIME_TYPES) registerDocumentRenderer(mime, imageRendererDef);
