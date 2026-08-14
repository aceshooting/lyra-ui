import { fixture, expect, html } from '@open-wc/testing';
import {
  getLyraLocale,
  registerLyraLocale,
  resolveLyraDirection,
  resolveLyraLocale,
  setLyraLocale,
  subscribeLyraLocale,
} from './localization.js';
import { registerLyraExactLocale } from './localization-runtime.js';
import { LyraElement } from './lyra-element.js';
import '../components/data/sparkline/sparkline.js';
import type { LyraSparkline } from '../components/data/sparkline/sparkline.js';

class LocalizationRenderProbe extends LyraElement {
  protected static override readonly defaultStrings = Object.freeze({ noData: 'No data' });
  renderCalls = 0;

  protected override render() {
    this.renderCalls += 1;
    return html`<span>${this.localize('noData')}</span>`;
  }
}

if (!customElements.get('x-localization-render-probe')) {
  customElements.define('x-localization-render-probe', LocalizationRenderProbe);
}

function probeText(probe: LocalizationRenderProbe): string {
  return probe.shadowRoot?.textContent?.trim() ?? '';
}

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

it('does not re-render connected localized hosts for an unrelated catalog registration', async () => {
  const locale = uniqueLocale('usedscope');
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      ${Array.from({ length: 2_000 }, () => html`
        <x-localization-render-probe locale=${locale}></x-localization-render-probe>
      `)}
    </div>
  `);
  const probes = [...wrapper.querySelectorAll('x-localization-render-probe')] as LocalizationRenderProbe[];
  await Promise.all(probes.map((probe) => probe.updateComplete));
  const before = probes.map((probe) => probe.renderCalls);

  registerLyraLocale(uniqueLocale('unusedscope'), { noData: 'Unused locale' });
  await Promise.resolve();
  await Promise.all(probes.map((probe) => probe.updateComplete));

  expect(probes.map((probe) => probe.renderCalls)).to.deep.equal(before);
});

it('filters lazy catalog delivery by each host ancestor locale candidate chain', async () => {
  const base = uniqueLocale('ancestorbase');
  const unrelated = uniqueLocale('ancestorother');
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <section lang=${base}-region>
        <x-localization-render-probe></x-localization-render-probe>
      </section>
      <section lang=${unrelated}>
        <x-localization-render-probe></x-localization-render-probe>
      </section>
    </div>
  `);
  const probes = [...wrapper.querySelectorAll('x-localization-render-probe')] as LocalizationRenderProbe[];
  await Promise.all(probes.map((probe) => probe.updateComplete));
  const before = probes.map((probe) => probe.renderCalls);

  registerLyraLocale(base, { noData: 'Matching ancestor loaded' });
  await probes[0].updateComplete;
  await Promise.resolve();

  expect(probeText(probes[0])).to.equal('Matching ancestor loaded');
  expect(probes[0].renderCalls).to.equal(before[0]! + 1);
  expect(probes[1].renderCalls).to.equal(before[1]);
});

it('keeps exact-only pseudo catalog delivery isolated from its bare base language', async () => {
  const base = 'qps';
  const exact = 'qps-XA';
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <x-localization-render-probe locale=${base}></x-localization-render-probe>
      <x-localization-render-probe locale=${exact}></x-localization-render-probe>
    </div>
  `);
  const probes = [...wrapper.querySelectorAll('x-localization-render-probe')] as LocalizationRenderProbe[];
  await Promise.all(probes.map((probe) => probe.updateComplete));
  const before = probes.map((probe) => probe.renderCalls);

  registerLyraExactLocale(exact, { noData: 'Exact pseudo loaded' });
  await probes[1].updateComplete;
  await Promise.resolve();

  expect(probeText(probes[0])).to.equal('No data');
  expect(probeText(probes[1])).to.equal('Exact pseudo loaded');
  expect(probes[0].renderCalls).to.equal(before[0]);
  expect(probes[1].renderCalls).to.equal(before[1]! + 1);
});

it('updates a bare language host when a newly registered regional catalog becomes its fallback', async () => {
  const base = 'qrx';
  const probe = await fixture<LocalizationRenderProbe>(html`
    <x-localization-render-probe locale=${base}></x-localization-render-probe>
  `);
  const before = probe.renderCalls;

  registerLyraLocale(`${base}-ZZ`, { noData: 'Regional fallback loaded' });
  await probe.updateComplete;

  expect(probeText(probe)).to.equal('Regional fallback loaded');
  expect(probe.renderCalls).to.equal(before + 1);
});

it('updates a component after a public active subscriber fails', async () => {
  const previous = getLyraLocale();
  const locale = uniqueLocale('isolation');
  registerLyraLocale(locale, { noData: 'Component still updated' });
  const probe = await fixture<LocalizationRenderProbe>(html`
    <x-localization-render-probe></x-localization-render-probe>
  `);
  const stop = subscribeLyraLocale(() => {
    throw new Error('public subscriber failure');
  });
  let thrown: unknown;
  try {
    try {
      setLyraLocale(locale);
    } catch (error) {
      thrown = error;
    }
    await probe.updateComplete;
    expect(thrown).to.be.instanceOf(AggregateError);
    expect(probeText(probe)).to.equal('Component still updated');
  } finally {
    stop();
    setLyraLocale(previous);
  }
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
