/** @deprecated Import @aceshooting/lyra-ui/components/lr-xml-viewer.js to register this component. */
export * from './xml-viewer.class.js';
import { html } from 'lit';
import { LyraXmlViewer } from './xml-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile, type LyraDocumentRendererDefinition } from '../document-viewer/registry.js';

defineElement('xml-viewer', LyraXmlViewer);

const XML_EXTENSIONS = ['.xml', '.xsd', '.xsl', '.xslt', '.rss', '.atom'];

const xmlRendererDef: LyraDocumentRendererDefinition = {
  matches: (file: LyraDocumentFile) => file.mimeType.split(';', 1)[0]!.trim().toLowerCase().endsWith('+xml') || XML_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext)),
  capabilities: { anchors: ['node-path'], search: true },
  render: (file: LyraDocumentFile) => html`<lr-xml-viewer
    src=${file.src}
    name=${file.name}
    .anchor=${file.anchor ?? null}
    .highlights=${file.highlights ?? []}
  ></lr-xml-viewer>`,
};

registerDocumentRenderer('application/xml', xmlRendererDef);
registerDocumentRenderer('text/xml', xmlRendererDef);
