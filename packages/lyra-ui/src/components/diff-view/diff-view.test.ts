import { fixture, expect, html } from '@open-wc/testing';
import './diff-view.js';
import type { LyraDiffView } from './diff-view.js';

describe('lyra-diff-view', () => {
  it('renders interleaved add/remove/equal lines, not all-removed-then-all-added', async () => {
    const el = (await fixture(html`
      <lyra-diff-view .oldText=${'a\nb\nc\nd\ne'} .newText=${'a\nb\nX\nd\ne'}></lyra-diff-view>
    `)) as LyraDiffView;
    const lines = [...el.shadowRoot!.querySelectorAll('[part="line"]')];
    const types = lines.map((l) => l.getAttribute('data-type'));
    expect(types).to.deep.equal(['equal', 'equal', 'remove', 'add', 'equal', 'equal']);
  });

  it('renders no copy button by default, one when copyable is set', async () => {
    const plain = (await fixture(html`<lyra-diff-view .oldText=${'a'} .newText=${'b'}></lyra-diff-view>`)) as LyraDiffView;
    expect(plain.shadowRoot!.querySelector('[part="copy-button"]')).to.not.exist;
    const withCopy = (await fixture(html`<lyra-diff-view copyable .oldText=${'a'} .newText=${'b'}></lyra-diff-view>`)) as LyraDiffView;
    expect(withCopy.shadowRoot!.querySelector('[part="copy-button"]')).to.exist;
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lyra-diff-view .oldText=${'a'} .newText=${'b'}></lyra-diff-view>`)) as LyraDiffView;
    await expect(el).to.be.accessible();
  });
});
