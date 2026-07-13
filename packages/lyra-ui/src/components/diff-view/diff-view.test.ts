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

  it('localizes the copy-button aria-label via this.localize(), not a hardcoded "diff" suffix', async () => {
    const el = (await fixture(
      html`<lyra-diff-view copyable .oldText=${'a'} .newText=${'b'} .strings=${{ copyDiff: 'Copier la diff' }}></lyra-diff-view>`,
    )) as LyraDiffView;
    const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).to.equal('Copier la diff');
  });

  it('defaults to English "Copy diff" when no strings override is set', async () => {
    const el = (await fixture(
      html`<lyra-diff-view copyable .oldText=${'a'} .newText=${'b'}></lyra-diff-view>`,
    )) as LyraDiffView;
    const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).to.equal('Copy diff');
  });
});
