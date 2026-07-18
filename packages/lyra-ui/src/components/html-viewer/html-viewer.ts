export * from './html-viewer.class.js';
import { LyraHtmlViewer } from './html-viewer.class.js';
import { defineElement } from '../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

defineElement('html-viewer', LyraHtmlViewer);
registerDocumentRenderer('text/html', {
  matches: (file: DocumentFile) => /\.html?$/i.test(file.name),
  render: (file) => {
    const element = document.createElement('lr-html-viewer');
    element.src = file.src;
    element.name = file.name;
    return element;
  },
});
