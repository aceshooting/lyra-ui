// Keep the editor behind an explicit test action. This entry is also the
// production-bundle check that the ordinary package root does not load it.
import '../src/index.js';
import '@aceshooting/lyra-ui/theme.css';

const test = {
  ready: true,
  async loadEditor() {
    const entry = await import('./editor-entry.js');
    if (typeof entry.LyraDocxEditor !== 'function') throw new Error('Editor class export unavailable');
    await customElements.whenDefined('lr-docx-editor');
  },
  async sessionFactory() {
    return (await import('../src/docx/create-session.js')).createDocxSession;
  },
  async fixture(kind: 'accepted' | 'external' | 'malformed' | 'representative' | 'large') {
    if (kind === 'representative' || kind === 'large') {
      const corpus = await import('./corpus.js');
      return kind === 'representative' ? corpus.representativeFixture() : corpus.largeFixture();
    }
    const { docxFixture, relationship } = await import('../src/docx/admission-fixtures.js');
    if (kind === 'accepted') return docxFixture();
    if (kind === 'external') return docxFixture({ 'word/_rels/document.xml.rels': relationship('https://example.test/image.png') });
    return docxFixture({ 'word/document.xml': '<w:document><w:body><w:p></w:document>' });
  }
};

declare global {
  interface Window { __docxTest: typeof test }
}
window.__docxTest = test;
