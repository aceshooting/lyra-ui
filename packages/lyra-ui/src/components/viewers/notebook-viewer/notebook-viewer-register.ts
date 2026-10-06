import { html } from 'lit';
import { tag } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile } from '../document-viewer/registry.js';

/** The stable tag `<lr-document-viewer>` upgrades a matched file to once `load` below settles --
 *  importing this register-only entry alone never registers the element itself. */
export const NOTEBOOK_VIEWER_TAG = tag('notebook-viewer');

registerDocumentRenderer('application/x-ipynb+json', {
  matches: (file: LyraDocumentFile) => file.name.toLowerCase().endsWith('.ipynb'),
  capabilities: { anchors: ['node-path', 'fragment'], search: true },
  load: () => import('./notebook-viewer.js').then(() => ({
    render: (file: LyraDocumentFile) => html`<lr-notebook-viewer
      src=${file.src}
      name=${file.name}
      .anchor=${file.anchor ?? null}
      .highlights=${file.highlights ?? []}
    ></lr-notebook-viewer>`,
  })),
});
