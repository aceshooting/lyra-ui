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
  async registerLocale(locale: string, strings: Record<string, string>) {
    (await import('./editor-entry.js')).registerLyraLocale(locale, strings);
  },
  async imageBytes(kind: 'png' | 'jpeg' | 'gif') {
    return (await import('./corpus.js')).imageInsertionBytes(kind);
  },
  async fixture(kind: `image-${string}` | `table-${string}` | 'accepted' | 'external' | 'malformed' | 'representative' | 'basic-editing' | 'mixed-formatting' | 'search-limit' | 'chart') {
    if (kind === 'chart') return (await import('./corpus.js')).chartFixture();
    if (kind.startsWith('image-')) return (await import('./corpus.js')).imageFixture(kind);
    if (kind.startsWith('table-')) return (await import('./corpus.js')).tableFixture(kind);
    if (kind === 'representative' || kind === 'basic-editing' || kind === 'mixed-formatting' || kind === 'search-limit') {
      const corpus = await import('./corpus.js');
      if (kind === 'representative') return corpus.representativeFixture();
      if (kind === 'basic-editing') return corpus.basicEditingFixture();
      if (kind === 'mixed-formatting') return corpus.mixedFormattingFixture();
      return corpus.searchLimitFixture();
    }
    const { docxFixture, relationship } = await import('./admission-fixtures.js');
    if (kind === 'accepted') return docxFixture();
    if (kind === 'external') return docxFixture({ 'word/_rels/document.xml.rels': relationship('https://example.test/frame.html', 'frame') });
    return docxFixture({ 'word/document.xml': '<w:document><w:body><w:p></w:document>' });
  }
};

declare global {
  interface Window { __docxTest: typeof test }
}
window.__docxTest = test;
