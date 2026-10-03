import type { TableReaders } from './eigenpal-tables.js';
import type { DocxEditorInstance, DocxEditorConfig } from '@docx-editor.dev/core';

export interface DocxEngineModule {
  readonly tableReaders?: TableReaders;
  createDocxEditor(config: DocxEditorConfig): DocxEditorInstance;
}

/** Importing the companion does not evaluate or initialize the optional engine. */
export async function loadDocxEngine(): Promise<DocxEngineModule> {
  const [module, store] = await Promise.all([import('@docx-editor.dev/core'), import('@docx-editor.dev/core/store')]);
  if (typeof module.createDocxEditor !== 'function') throw new Error('Engine unavailable');
  if (typeof store.findNode !== 'function' || typeof store.parentNodeOf !== 'function') throw new Error('Engine unavailable');
  return { createDocxEditor: module.createDocxEditor, tableReaders: { findNode: store.findNode, parentNodeOf: store.parentNodeOf } };
}
