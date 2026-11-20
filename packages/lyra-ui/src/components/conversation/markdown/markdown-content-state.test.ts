import { expect, fixture, waitUntil } from '@open-wc/testing';
import jsonGrammar from 'shiki/langs/json.mjs';
import { supportsCustomHighlights } from '../../../internal/text-highlights.js';
import '../../lr-markdown.js';
import '../../lr-markdown-core.js';
import type { LyraMarkdown } from '../../lr-markdown.js';

for (const name of ['lr-markdown', 'lr-markdown-core']) {
  it(`${name} restores text highlights after a move and after a detached update`, async () => {
    const el = await fixture<LyraMarkdown>(`<${name}></${name}>`);
    el.content = 'Find the annotation';
    el.highlights = [{ id: 'note', anchor: { kind: 'text-quote', quote: 'annotation' } }];
    const painted = () => supportsCustomHighlights()
      ? (CSS.highlights.get('lr-highlight-accent')?.size ?? 0) > 0
      : Boolean(el.shadowRoot!.querySelector('mark[data-lr-highlight-tone]'));
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('p')) && painted());
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    expect(painted()).to.equal(true);
    el.remove();
    await Promise.resolve();
    parent.append(el);
    await el.updateComplete;
    expect(painted()).to.equal(true);
  });

  it(`${name} dispatches a render error after displaying fallback and accepts changes from its listener`, async () => {
    const el = await fixture<LyraMarkdown>(`<${name}></${name}>`);
    el.content = '# Before';
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('h1')));
    let fail = true;
    el.marked!.use({ hooks: { postprocess(markup: string) { return fail ? null : markup; } } });
    let seen: string | null | undefined;
    el.addEventListener('lr-render-error', () => {
      seen = el.shadowRoot!.querySelector('[data-fallback]')?.textContent;
      fail = false;
      el.content = '# Recovered';
    }, { once: true });
    el.content = '# Fallback';
    await el.updateComplete;
    expect(seen).to.equal('# Fallback');
    await waitUntil(() => el.shadowRoot!.querySelector('h1')?.textContent === 'Recovered');
  });

  for (const dark of [false, true]) {
    it(`${name} honors inline and fenced code backgrounds independently in dark=${dark}`, async () => {
      const wrapper = await fixture<HTMLElement>(`<div data-lr-theme-scope style="--lr-theme-color-text-normal:${dark ? 'white' : 'black'};--lr-theme-color-surface-default:${dark ? 'black' : 'white'};--lr-markdown-code-bg:rgb(12, 30, 50)"><${name} without-syntax-highlighting></${name}></div>`);
      const el = wrapper.firstElementChild as LyraMarkdown;
      el.content = '\x60inline\x60\n\n\x60\x60\x60\nfenced\n\x60\x60\x60';
      await waitUntil(() => Boolean(el.shadowRoot!.querySelector('pre')));
      const pre = el.shadowRoot!.querySelector('pre')!;
      const inline = el.shadowRoot!.querySelector('p code')!;
      expect(el.shadowRoot!.querySelector('[part="content"]')!.hasAttribute('data-dark-theme')).to.equal(dark);
      expect(getComputedStyle(pre).backgroundColor).to.equal('rgb(12, 30, 50)');
      wrapper.style.setProperty('--lr-markdown-code-block-bg', 'rgb(50, 30, 12)');
      expect(getComputedStyle(pre).backgroundColor).to.equal('rgb(50, 30, 12)');
      expect(getComputedStyle(inline).backgroundColor).to.equal('rgb(12, 30, 50)');
    });
  }

  it(`${name} honors icon-button chrome on fenced copy actions without adding source text`, async () => {
    const el = await fixture<LyraMarkdown>(`<${name} code-block-header without-syntax-highlighting></${name}>`);
    el.style.setProperty('--lr-icon-button-border', '3px solid blue');
    el.content = '\x60\x60\x60\nvalue\n\x60\x60\x60';
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('button')));
    const copy = el.shadowRoot!.querySelector('button')!;
    expect(copy.querySelector('svg')?.getAttribute('stroke-width')).to.equal('1.75');
    expect(getComputedStyle(copy).borderTopWidth).to.equal('3px');
    expect(copy.textContent).to.equal('');
  });
}

it('adopts a direct script appended before the first update and preserves later content on moves', async () => {
  const host = await fixture<HTMLElement>('<div></div>');
  const el = document.createElement('lr-markdown');
  host.append(el);
  const script = document.createElement('script');
  script.type = 'text/markdown';
  script.textContent = '# Authored';
  el.append(script);
  await el.updateComplete;
  expect(el.content).to.equal('# Authored');
  el.content = '';
  el.remove();
  host.append(el);
  await el.updateComplete;
  expect(el.content).to.equal('');
});

it('preserves cleared content after reconnecting a script-authored document', async () => {
  const el = await fixture<LyraMarkdown>('<lr-markdown><script type="text/markdown">source</script></lr-markdown>');
  expect(el.content).to.equal('source');
  el.content = '';
  const parent = el.parentElement!;
  el.remove();
  parent.append(el);
  await el.updateComplete;
  expect(el.content).to.equal('');
});

for (const name of ['lr-markdown', 'lr-markdown-core']) {
  it(`${name} keeps fence line spacing independent of prose`, async () => {
    const el = await fixture<LyraMarkdown>(`<${name} without-syntax-highlighting></${name}>`);
    el.style.cssText = '--lr-line-height-loose:3;--lr-line-height-normal:1.25;--lr-markdown-font-mono:monospace';
    el.content = 'Prose\n\n\x60\x60\x60\none\ntwo\n\x60\x60\x60';
    await waitUntil(() => Boolean(el.shadowRoot!.querySelector('pre')));
    const style = getComputedStyle(el.shadowRoot!.querySelector('pre')!);
    expect(parseFloat(style.lineHeight)).to.be.closeTo(1.25 * parseFloat(style.fontSize), 0.1);
    expect(style.fontFamily).to.equal('monospace');
  });
}

it('accepts a missing core grammar map before a later assignment', async function () {
  this.timeout(12000);
  const el = document.createElement('lr-markdown-core');
  Reflect.set(el, 'languages', null);
  el.content = '\x60\x60\x60json\n42\n\x60\x60\x60';
  const host = await fixture<HTMLElement>('<div></div>');
  host.append(el);
  await waitUntil(() => el.shadowRoot!.querySelector('pre')?.textContent?.trim() === '42');
  el.languages = { json: jsonGrammar };
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('pre span')), 'syntax after assigning grammars', { timeout: 10000 });
});

it('keeps an explicitly empty initial property ahead of a direct script', async () => {
  const el = document.createElement('lr-markdown');
  const script = document.createElement('script');
  script.type = 'text/markdown';
  script.textContent = 'initial';
  el.append(script);
  el.content = '';
  const host = await fixture<HTMLElement>('<div></div>');
  host.append(el);
  await el.updateComplete;
  expect(el.content).to.equal('');
});

it('continues progressive rendering across a move between blocks', async () => {
  const el = await fixture<LyraMarkdown>('<lr-markdown streaming streaming-render="progressive"></lr-markdown>');
  el.content = '# First\n\nBody';
  await waitUntil(() => el.shadowRoot!.querySelector('h1')?.textContent === 'First');
  const host = el.parentElement!;
  el.remove();
  host.append(el);
  el.content += '\n\n# Second\n\nTail';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('h1').length === 2);
  expect(el.shadowRoot!.querySelector('p')?.textContent).to.equal('Body');
});

it('keeps literal code punctuation and prose character references distinct', async () => {
  const el = await fixture<LyraMarkdown>('<lr-markdown></lr-markdown>');
  el.content = '\x60<&amp;"\'>\x60 and &copy; &#169; &#xA9; &amp;lt;';
  await waitUntil(() => Boolean(el.shadowRoot!.querySelector('p code')));
  expect(el.shadowRoot!.querySelector('code')?.textContent).to.equal('<&amp;"\'>');
  expect(el.shadowRoot!.querySelector('p')?.textContent).to.equal('<&amp;"\'> and © © © &lt;');
});
