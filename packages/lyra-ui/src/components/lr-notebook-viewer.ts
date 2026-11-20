// policy-allow(component-dependency: lr-icon): the composed <lr-icon-button> reaches this graph
// through its LEAN registration entry, which deliberately registers only that tag. <lr-icon> is
// reachable from lr-icon-button's class module only when its `icon`/`src` attribute is set, and
// nothing here sets either -- every composed icon button slots its own SVG. Registering <lr-icon>
// here would put the icon implementation plus its unreachable sanitizer chunk back into every
// consumer's graph, which is exactly what the lean entry exists to avoid -- see
// icon-button-register.ts's own header comment for the full trade.
export type { LyraAnchorKind } from '../internal/document-anchors.js';
export type { LyraViewerDiagnosticEventDetail } from './viewers/viewer-diagnostics.js';
export type { LyraViewerSource } from './viewers/viewer-source.js';
export type { LyraAnchorTargetEventMap } from '../internal/anchor-target-base.js';
export type { LyraSearchChangeDetail } from '../internal/text-viewer-target.js';
export * from './viewers/notebook-viewer/notebook-viewer.class.js';
import { html } from 'lit';
import { LyraNotebookViewer } from './viewers/notebook-viewer/notebook-viewer.class.js';
import { defineElement } from '../internal/prefix.js';
import { registerDocumentRenderer, type LyraDocumentFile } from './viewers/document-viewer/registry.js';
import './lr-virtual-list.js';
import './lr-markdown.js';
import './lr-code-block.js';
import './lr-json-viewer.js';

defineElement('notebook-viewer', LyraNotebookViewer);

registerDocumentRenderer('application/x-ipynb+json', {
  matches: (file: LyraDocumentFile) => file.name.toLowerCase().endsWith('.ipynb'),
  capabilities: { anchors: ['node-path', 'fragment'], search: true },
  render: (file: LyraDocumentFile) => html`<lr-notebook-viewer
    src=${file.src}
    name=${file.name}
    .anchor=${file.anchor ?? null}
    .highlights=${file.highlights ?? []}
  ></lr-notebook-viewer>`,
});
