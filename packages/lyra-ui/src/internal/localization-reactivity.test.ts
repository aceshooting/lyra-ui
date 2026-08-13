import { fixture, expect, html } from '@open-wc/testing';
import {
  getLyraLocale,
  registerLyraLocale,
  resolveLyraDirection,
  resolveLyraLocale,
  setLyraLocale,
} from './localization.js';
import '../components/data/sparkline/sparkline.js';
import type { LyraSparkline } from '../components/data/sparkline/sparkline.js';

function uniqueLocale(label: string): string {
  return `${label}${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

function renderedLabel(el: LyraSparkline): string | null {
  return el.shadowRoot!.querySelector('svg')!.getAttribute('aria-label');
}

it('re-renders a connected component when its document locale is registered after mount', async () => {
  const root = document.documentElement;
  const previousLang = root.getAttribute('lang');
  const locale = uniqueLocale('latedocument');
  root.setAttribute('lang', locale);
  try {
    const el = (await fixture(html`<lr-sparkline .values=${[]}></lr-sparkline>`)) as LyraSparkline;
    expect(renderedLabel(el)).to.equal('No data');

    registerLyraLocale(locale, { noData: 'Document locale loaded' });
    await el.updateComplete;

    expect(renderedLabel(el)).to.equal('Document locale loaded');
  } finally {
    if (previousLang === null) root.removeAttribute('lang');
    else root.setAttribute('lang', previousLang);
  }
});

it('re-renders through a composed ancestor when its locale is registered after mount', async () => {
  const locale = uniqueLocale('latecomposed');
  const host = await fixture<HTMLDivElement>(html`<div lang=${locale}></div>`);
  const shadow = host.attachShadow({ mode: 'open' });
  const el = document.createElement('lr-sparkline') as LyraSparkline;
  el.values = [];
  shadow.append(el);
  await el.updateComplete;
  expect(renderedLabel(el)).to.equal('No data');

  registerLyraLocale(locale, { noData: 'Composed locale loaded' });
  await el.updateComplete;

  expect(renderedLabel(el)).to.equal('Composed locale loaded');
});

it('re-renders a host locale override when its catalog is registered after mount', async () => {
  const locale = uniqueLocale('latehost');
  const el = (await fixture(
    html`<lr-sparkline locale=${locale} .values=${[]}></lr-sparkline>`,
  )) as LyraSparkline;
  expect(renderedLabel(el)).to.equal('No data');

  registerLyraLocale(locale, { noData: 'Host locale loaded' });
  await el.updateComplete;

  expect(renderedLabel(el)).to.equal('Host locale loaded');
});

it('re-renders a regional locale when its base catalog is registered after mount', async () => {
  const base = uniqueLocale('latebase');
  const locale = `${base}-region`;
  const el = (await fixture(
    html`<lr-sparkline locale=${locale} .values=${[]}></lr-sparkline>`,
  )) as LyraSparkline;
  expect(renderedLabel(el)).to.equal('No data');

  registerLyraLocale(base, { noData: 'Base locale loaded' });
  await el.updateComplete;

  expect(renderedLabel(el)).to.equal('Base locale loaded');
});

it('resolves locale and direction through a shadow root in the host owner document', () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const foreignDocument = frame.contentDocument!;
  foreignDocument.documentElement.lang = 'lt';
  const context = foreignDocument.createElement('div');
  context.lang = 'tr';
  context.dir = 'rtl';
  const shadow = context.attachShadow({ mode: 'open' });
  const target = foreignDocument.createElement('span');
  shadow.append(target);
  foreignDocument.body.append(context);
  try {
    expect(resolveLyraLocale(target)).to.equal('tr');
    expect(resolveLyraDirection(target)).to.equal('rtl');

    context.removeAttribute('lang');
    expect(resolveLyraLocale(target)).to.equal('lt');
  } finally {
    frame.remove();
  }
});

// `setLyraLocale()` used to be inert on any well-formed page: `<html lang>` was consulted before
// the explicitly set locale (and, being an ancestor, was also picked up by the ancestor walk), so
// `setLyraLocale('fr')` changed nothing whenever `<html lang="en">` was present -- i.e. almost
// everywhere. An explicit call now outranks the document default, while a per-subtree `lang` or
// `locale` attribute still outranks both.
describe('setLyraLocale() versus the document lang', () => {
  /** Runs `body` against a throwaway iframe document, so `<html lang>` never leaks into the shared
   *  test document, and always restores the module-global active locale. */
  function inFrame(body: (doc: Document) => void): void {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const previousActive = getLyraLocale();
    try {
      body(frame.contentDocument!);
    } finally {
      setLyraLocale(previousActive);
      frame.remove();
    }
  }

  it('falls back to <html lang> when nothing called setLyraLocale()', () => {
    inFrame((doc) => {
      setLyraLocale('');
      doc.documentElement.lang = 'x-doc-default';
      const host = doc.createElement('div');
      doc.body.append(host);

      expect(resolveLyraLocale(host)).to.equal('x-doc-default');
    });
  });

  it('lets an explicit setLyraLocale() beat <html lang>', () => {
    inFrame((doc) => {
      doc.documentElement.lang = 'x-doc-default';
      const host = doc.createElement('div');
      doc.body.append(host);
      setLyraLocale('x-explicit');

      expect(resolveLyraLocale(host)).to.equal('x-explicit');
    });
  });

  it('keeps an element lang/locale ahead of the explicit locale', () => {
    inFrame((doc) => {
      doc.documentElement.lang = 'x-doc-default';
      setLyraLocale('x-explicit');
      const host = doc.createElement('div');
      host.lang = 'x-element';
      doc.body.append(host);

      expect(resolveLyraLocale(host)).to.equal('x-element');
      host.removeAttribute('lang');
      host.setAttribute('locale', 'x-element-locale');
      expect(resolveLyraLocale(host)).to.equal('x-element-locale');
    });
  });

  it('keeps an ancestor lang ahead of the explicit locale', () => {
    inFrame((doc) => {
      doc.documentElement.lang = 'x-doc-default';
      setLyraLocale('x-explicit');
      const ancestor = doc.createElement('section');
      ancestor.lang = 'x-ancestor';
      const host = doc.createElement('div');
      ancestor.append(host);
      doc.body.append(ancestor);

      expect(resolveLyraLocale(host)).to.equal('x-ancestor');
    });
  });

  it('still honors an explicit locale attribute on the document element', () => {
    inFrame((doc) => {
      // `lang` on <html> is generic page metadata; `locale` there is a deliberate Lyra opt-in, so
      // only the former is demoted below setLyraLocale().
      doc.documentElement.lang = 'x-doc-default';
      doc.documentElement.setAttribute('locale', 'x-doc-opt-in');
      setLyraLocale('x-explicit');
      const host = doc.createElement('div');
      doc.body.append(host);

      expect(resolveLyraLocale(host)).to.equal('x-doc-opt-in');
    });
  });

  it('falls back to en with neither an explicit locale nor a document lang', () => {
    inFrame((doc) => {
      setLyraLocale('');
      const host = doc.createElement('div');
      doc.body.append(host);

      expect(resolveLyraLocale(host)).to.equal('en');
    });
  });
});
