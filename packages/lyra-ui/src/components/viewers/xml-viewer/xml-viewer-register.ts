import { html } from 'lit';
import { tag } from '../../../internal/prefix.js';
import {
  registerDocumentRenderer,
  type DocumentFile,
  type LazyDocumentRendererDefinition,
} from '../document-viewer/registry.js';

/** The stable tag `<lr-document-viewer>` upgrades a matched file to once `load` below settles --
 *  importing this register-only entry alone never registers the element itself. */
export const XML_VIEWER_TAG = tag('xml-viewer');

const XML_EXTENSIONS = ['.xml', '.xsd', '.xsl', '.xslt', '.rss', '.atom'];

const xmlRendererDef: LazyDocumentRendererDefinition = {
  matches: (file: DocumentFile) => file.mimeType.split(';', 1)[0]!.trim().toLowerCase().endsWith('+xml') || XML_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)),
  capabilities: { anchors: ['node-path'], search: true },
  load: () => import('./xml-viewer.js').then(() => ({
    render: (file: DocumentFile) => html`<lr-xml-viewer
      src=${file.src}
      name=${file.name}
      .anchor=${file.anchor ?? null}
      .highlights=${file.highlights ?? []}
    ></lr-xml-viewer>`,
  })),
};

registerDocumentRenderer('application/xml', xmlRendererDef);
registerDocumentRenderer('text/xml', xmlRendererDef);
