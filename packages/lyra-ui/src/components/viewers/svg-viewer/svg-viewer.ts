export * from './svg-viewer.class.js';
import { LyraSvgViewer } from './svg-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../media/zoomable-frame/zoomable-frame.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

defineElement('svg-viewer', LyraSvgViewer);

registerDocumentRenderer('image/svg+xml', {
  matches: (file: DocumentFile) => file.name.toLowerCase().endsWith('.svg'),
  render: (file) => {
    const element = document.createElement('lr-svg-viewer');
    element.src = file.src;
    element.name = file.name;
    return element;
  },
  capabilities: { anchors: ['region'], search: false, textSelect: false },
});
