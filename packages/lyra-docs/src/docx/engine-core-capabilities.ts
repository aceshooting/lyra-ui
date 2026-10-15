import * as source from '@docx-editor.dev/core';

/** Loaded behind the editor's dynamic import; getters retain the engine's live bindings. */
export const capabilities = Object.freeze({
  get createDocxEditor() { return source.createDocxEditor; },
  get blankDocumentBytes() { return source.blankDocumentBytes; },
});
