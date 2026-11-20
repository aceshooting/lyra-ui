export type { AnchorResultDetail, HighlightActivateDetail, LyraAnchorKind } from './viewers/document-viewer/anchors.js';
export type { LyraViewerSource } from './viewers/viewer-source.js';
export type { LyraClipboardWriteFailure, LyraClipboardWriteSuccess } from '../internal/clipboard.js';
export type { LyraSearchChangeDetail } from '../internal/text-viewer-target.js';
export * from './viewers/xml-viewer/xml-viewer.class.js';
import './lr-virtual-list.js';
import { html } from 'lit';
import { LyraXmlViewer } from './viewers/xml-viewer/xml-viewer.class.js';
import { defineElement } from '../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile, type LyraDocumentRendererDefinition } from './viewers/document-viewer/registry.js';

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
