import * as source from '#lyra-docx-engine/core';

/** Loaded behind the editor's dynamic import; getters retain the engine's live bindings. */
export const capabilities = Object.freeze({
  get createDocxEditor() { return source.createDocxEditor; },
  get prepareCommandFeatures() { return source.prepareCommandFeatures; },
  get prepareFeatures() { return source.prepareFeatures; },
  get blankDocumentBytes() { return source.blankDocumentBytes; },
});
