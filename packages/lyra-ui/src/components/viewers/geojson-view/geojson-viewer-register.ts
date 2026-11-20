import { html } from 'lit';
import { tag } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile } from '../../../internal/document-renderer-registry.js';

export const GEOJSON_VIEWER_TAG = tag('geojson-viewer');

registerDocumentRenderer('application/geo+json', {
  matches: (file: LyraDocumentFile) => file.name.toLowerCase().endsWith('.geojson'),
  capabilities: { anchors: ['text-quote', 'fragment'], search: true, textSelect: true },
  load: () => import('../../lr-geojson-viewer.js').then(() => ({
    render: (file: LyraDocumentFile) => html`<lr-geojson-viewer
      .src=${file.src}
      .name=${file.name}
      .anchor=${file.anchor ?? null}
      .highlights=${file.highlights ?? []}
    ></lr-geojson-viewer>`,
  })),
});
