import type { TableReaders } from './eigenpal-tables.js';
import type { DocxEditorInstance, DocxEditorConfig } from '@docx-editor.dev/core';
import { deriveImageInsertionEngine } from './engine-image-insertion-loader.js';
import type { ImageInsertionEngine } from './engine-image-insertion-loader.js';

const insertionCache = new WeakMap<object, { core: object; value: ImageInsertionEngine | undefined }>();

export interface DocxEngineModule {
  readonly tableReaders?: TableReaders;
  readonly imageInsertion?: ImageInsertionEngine;
  createDocxEditor(config: DocxEditorConfig): DocxEditorInstance;
}

/** Importing the companion does not evaluate or initialize the optional engine. */
export async function loadDocxEngine(): Promise<DocxEngineModule> {
  const [module, store] = await Promise.all([import('@docx-editor.dev/core'), import('@docx-editor.dev/core/store')]);
  if (typeof module.createDocxEditor !== 'function') throw new Error('Engine unavailable');
  if (typeof store.findNode !== 'function' || typeof store.parentNodeOf !== 'function') throw new Error('Engine unavailable');
  let cached = insertionCache.get(store);
  if (!cached || cached.core !== module) {
    cached = { core: module, value: deriveImageInsertionEngine(module.blankDocumentBytes, store) };
    insertionCache.set(store, cached);
  }
  return { createDocxEditor: module.createDocxEditor, tableReaders: { findNode: store.findNode, parentNodeOf: store.parentNodeOf },
    ...(cached.value ? { imageInsertion: cached.value } : {}) };
}
