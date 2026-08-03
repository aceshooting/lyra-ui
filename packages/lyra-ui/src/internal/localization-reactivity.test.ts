import { fixture, expect, html } from '@open-wc/testing';
import {
  registerLyraLocale,
  resolveLyraDirection,
  resolveLyraLocale,
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
