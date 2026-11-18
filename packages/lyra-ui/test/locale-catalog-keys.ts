import { expect } from '@open-wc/testing';
import { getRegisteredLyraLocaleKeys, LYRA_DEFAULT_STRINGS } from '../src/localization.js';

/** Compare full catalogs with the core defaults and an independently loaded editor-only catalog. */
export async function completeLocaleKeys(): Promise<string[]> {
  await import('../src/translations/it/docx-editor.js');
  const editorKeys = getRegisteredLyraLocaleKeys('it');
  expect(editorKeys).to.have.length(276);
  expect(editorKeys.every(key => key.startsWith('docxEditor') && !Object.hasOwn(LYRA_DEFAULT_STRINGS, key))).to.equal(true);
  return [...Object.keys(LYRA_DEFAULT_STRINGS), ...editorKeys].sort();
}
