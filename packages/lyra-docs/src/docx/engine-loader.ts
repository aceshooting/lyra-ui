import type { DocxEditorInstance, DocxEditorConfig } from '@docx-editor.dev/core';

export interface DocxEngineModule {
  createDocxEditor(config: DocxEditorConfig): DocxEditorInstance;
}

/** Importing the companion does not evaluate or initialize the optional engine. */
export async function loadDocxEngine(): Promise<DocxEngineModule> {
  const module = await import('@docx-editor.dev/core');
  if (typeof module.createDocxEditor !== 'function') throw new Error('Engine unavailable');
  return module;
}
