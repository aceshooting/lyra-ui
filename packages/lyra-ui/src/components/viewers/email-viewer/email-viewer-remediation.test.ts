import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import '../../lr-email-viewer.js';
import type { LyraEmailViewer } from '../../lr-email-viewer.js';
import { TEXT_QUOTE_LIMITS } from '../../../internal/text-quote.js';

const originalFetch = window.fetch;
afterEach(() => { window.fetch = originalFetch; });

async function message(kind: 'plain' | 'html', fold = true) {
  const body = kind === 'plain'
    ? 'New reply.\n\n> Target café word   next fi\u00adnal ος.\n> Older line two.\n> Older line three.'
    : '<p>New reply.</p><blockquote type="cite">Target café word   next fi\u00adnal ος.</blockquote>';
  const source = ['Subject: Reply', `Content-Type: text/${kind}; charset=utf-8`, 'Content-Transfer-Encoding: 8bit', '', body].join('\r\n');
  window.fetch = (() => Promise.resolve(new Response(source))) as typeof fetch;
  const el = await fixture<LyraEmailViewer>(html`<lr-email-viewer .foldQuotes=${fold}></lr-email-viewer>`);
  const loaded = oneEvent(el, 'lr-load');
  el.src = 'https://example.test/normalized.eml';
  await loaded;
  return el;
}

for (const kind of ['plain', 'html'] as const) {
  for (const query of ['  Target  ', 'cafe\u0301', 'word \n next', 'final', 'ΟΣ']) {
    it(`reveals folded ${kind} quotes for the shared normalized query ${JSON.stringify(query)}`, async () => {
      const el = await message(kind);
      const quoted = () => el.shadowRoot!.querySelector<HTMLElement>('[part="quoted"]')!;
      expect(quoted().hidden).to.equal(true);
      expect(await el.search(query)).to.equal(1);
      expect(quoted().hidden).to.equal(false);
      expect(el.shadowRoot!.querySelector('[part="quote-toggle"]')?.getAttribute('aria-expanded')).to.equal('true');
      expect(quoted().getBoundingClientRect().height).to.be.greaterThan(0);
      expect(await el.searchNext()).to.equal(true);
      expect(await el.searchPrevious()).to.equal(true);
      el.shadowRoot!.querySelector<HTMLButtonElement>('[part="quote-toggle"]')!.click();
      await el.updateComplete;
      expect(quoted().hidden).to.equal(true);
      expect(await el.search('Target')).to.equal(1);
      expect(quoted().hidden).to.equal(false);
    });
  }

  it(`retains ${kind} fold defaults and query bounds`, async () => {
    const el = await message(kind);
    expect(await el.search(' '.repeat(TEXT_QUOTE_LIMITS.maxQueryCodeUnits) + 'Target')).to.equal(0);
    expect(el.shadowRoot!.querySelector<HTMLElement>('[part="quoted"]')!.hidden).to.equal(true);
    expect(await el.search(' \u00ad ')).to.equal(0);
    expect(el.shadowRoot!.querySelector<HTMLElement>('[part="quoted"]')!.hidden).to.equal(true);
    const unfolded = await message(kind, false);
    expect(unfolded.shadowRoot!.querySelectorAll('[part="quote-toggle"]').length).to.equal(0);
    expect(await unfolded.search('Target')).to.equal(1);
  });
}

it('wraps the expanded plain-text quote like the visible body, without the pre UA margin', async () => {
  const el = await message('plain');
  el.style.inlineSize = '12rem';
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="quote-toggle"]')!.click();
  await el.updateComplete;
  const quoted = el.shadowRoot!.querySelector<HTMLElement>('[part="quoted"]')!;
  const body = el.shadowRoot!.querySelector<HTMLElement>('[part="body-text"]')!;
  const style = getComputedStyle(quoted);
  expect(style.whiteSpace).to.equal(getComputedStyle(body).whiteSpace);
  expect(style.fontFamily).to.equal(getComputedStyle(body).fontFamily);
  expect(style.marginBlockEnd).to.equal('0px');
  expect(quoted.scrollWidth).to.be.at.most(quoted.clientWidth);
});
