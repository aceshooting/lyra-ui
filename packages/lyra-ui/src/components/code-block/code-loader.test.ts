import { expect } from '@open-wc/testing';
import { loadShikiHighlighter, loadShikiLanguage } from './code-loader.js';

it('resolves a highlighter seeded with the light+dark themes and zero language grammars', async () => {
  const hl = await loadShikiHighlighter();
  expect(hl).to.not.be.null;
  expect(hl!.getLoadedThemes()).to.include.members(['github-light', 'github-dark']);
  expect(hl!.getLoadedLanguages()).to.deep.equal([]);
});

it('caches the highlighter — a second call returns the same promise result', async () => {
  const a = await loadShikiHighlighter();
  const b = await loadShikiHighlighter();
  expect(a).to.equal(b);
});

describe('loadShikiLanguage', () => {
  it('loads a recognized language on demand and reports it as loaded afterward', async () => {
    const hl = await loadShikiHighlighter();
    expect(hl!.getLoadedLanguages()).to.not.include('python');

    const ok = await loadShikiLanguage(hl!, 'python');
    expect(ok).to.be.true;
    expect(hl!.getLoadedLanguages()).to.include('python');
  });

  it('resolves true immediately (no reload) for a language already loaded', async () => {
    const hl = await loadShikiHighlighter();
    await loadShikiLanguage(hl!, 'json');
    expect(hl!.getLoadedLanguages()).to.include('json');

    const ok = await loadShikiLanguage(hl!, 'json');
    expect(ok).to.be.true;
  });

  it('resolves an alias (e.g. "js" for javascript) as loaded, since shiki registers aliases alongside the canonical id', async () => {
    const hl = await loadShikiHighlighter();
    await loadShikiLanguage(hl!, 'javascript');
    expect(hl!.getLoadedLanguages()).to.include('js');
  });

  it('resolves false for an unrecognized language id and does not throw', async () => {
    const hl = await loadShikiHighlighter();
    const ok = await loadShikiLanguage(hl!, 'not-a-real-language-xyz');
    expect(ok).to.be.false;
  });

  it('remembers an unrecognized language and resolves false again on a second call without hanging', async () => {
    const hl = await loadShikiHighlighter();
    const first = await loadShikiLanguage(hl!, 'also-not-a-real-language');
    const second = await loadShikiLanguage(hl!, 'also-not-a-real-language');
    expect(first).to.be.false;
    expect(second).to.be.false;
  });
});
