import type { TableReaders } from './eigenpal-tables.js';
import type { EditorCommand } from '@docx-editor.dev/core/contracts/editor';
import type { DocxEditorInstance, DocxEditorConfig } from '@docx-editor.dev/core';
import { deriveImageInsertionEngine } from './engine-image-insertion-loader.js';
import type { ImageInsertionEngine } from './engine-image-insertion-loader.js';
import type { EigenpalReviewDependencies } from './eigenpal-review-model.js';

const insertionCache = new WeakMap<object, { core: object; value: ImageInsertionEngine | undefined }>();

type EditorFeature = 'layout' | 'paint' | 'surface' | 'tables' | 'notes' | 'controls' | 'drawings' | 'comments' | 'toc' | 'clipboard-html';

export interface DocxEngineModule {
  readonly tableReaders?: TableReaders;
  readonly imageInsertion?: ImageInsertionEngine;
  readonly review?: EigenpalReviewDependencies;
  createDocxEditor(config: DocxEditorConfig): DocxEditorInstance;
  prepareCommandFeatures(command: EditorCommand): Promise<void>;
  prepareFeatures(features: readonly EditorFeature[]): Promise<void>;
}

/** Importing the companion does not evaluate or initialize the internal engine. */
export async function loadDocxEngine(): Promise<DocxEngineModule> {
  const [{ capabilities: module }, { capabilities: store }] = await Promise.all([
    import('./engine-core-capabilities.js'), import('./engine-store-capabilities.js'),
  ]);
  if (typeof module.createDocxEditor !== 'function' || typeof module.prepareFeatures !== 'function' || typeof module.prepareCommandFeatures !== 'function') throw new Error('Engine unavailable');
  if (typeof store.findNode !== 'function' || typeof store.parentNodeOf !== 'function') throw new Error('Engine unavailable');
  const reviewNames = ['collectReviewItems', 'collectRevisionSites', 'commentsOfPart', 'commentAnchorsOfStory',
    'threadStateOfPart', 'commentBodyText', 'reviewItemKey', 'commentPartNameOf', 'commentsExtendedPartNameOf', 'stylesPartOf'] as const;
  const review = reviewNames.every(name => typeof store[name] === 'function') ?
    Object.fromEntries(reviewNames.map(name => [name, store[name]])) as EigenpalReviewDependencies : undefined;
  let cached = insertionCache.get(store);
  if (!cached || cached.core !== module) {
    cached = { core: module, value: deriveImageInsertionEngine(module.blankDocumentBytes, store) };
    insertionCache.set(store, cached);
  }
  return { createDocxEditor: module.createDocxEditor, prepareFeatures: module.prepareFeatures, prepareCommandFeatures: module.prepareCommandFeatures, tableReaders: { findNode: store.findNode, parentNodeOf: store.parentNodeOf },
    ...(cached.value ? { imageInsertion: cached.value } : {}), ...(review ? { review } : {}) };
}
