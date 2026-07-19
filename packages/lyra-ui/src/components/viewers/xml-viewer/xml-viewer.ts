export * from './xml-viewer.class.js';
import { html } from 'lit';
import { LyraXmlViewer } from './xml-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile, type DocumentRendererDefinition } from '../document-viewer/registry.js';

defineElement('xml-viewer', LyraXmlViewer);

const XML_EXTENSIONS = ['.xml', '.xsd', '.xsl', '.xslt', '.rss', '.atom'];

const xmlRendererDef: DocumentRendererDefinition = {
  matches: (file: DocumentFile) => file.mimeType.toLowerCase().endsWith('+xml') || XML_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)),
  capabilities: { anchors: ['node-path'], search: true },
  render: (file: DocumentFile) => html`<lr-xml-viewer
    src=${file.src}
    name=${file.name}
    .anchor=${file.anchor ?? null}
    .highlights=${file.highlights ?? []}
  ></lr-xml-viewer>`,
};

registerDocumentRenderer('application/xml', xmlRendererDef);
registerDocumentRenderer('text/xml', xmlRendererDef);
