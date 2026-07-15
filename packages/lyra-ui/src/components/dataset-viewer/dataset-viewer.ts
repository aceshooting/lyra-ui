export * from './dataset-viewer.class.js';
export * from './dataset-loader.js';
import { LyraDatasetViewer } from './dataset-viewer.class.js';
import { defineElement } from '../../internal/prefix.js';
import { registerDocumentRenderer, type DocumentFile } from '../document-viewer/registry.js';

defineElement('dataset-viewer', LyraDatasetViewer);
registerDocumentRenderer('lyra:dataset', { matches: (file: DocumentFile) => /\.(tsv|psv|dat)$/i.test(file.name), render: (file) => {
  const element = document.createElement('lyra-dataset-viewer');
  element.src = file.src;
  element.name = file.name;
  return element;
} });
