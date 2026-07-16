import { fixture, expect, html } from '@open-wc/testing';
import './diff-view.js';
import type { LyraDiffView } from './diff-view.js';
import type { DiffOp } from './diff-line-diff.js';
import { styles } from './diff-view.styles.js';

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

  it('gives the copy button a :hover treatment, matching every sibling copy button in the library', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='copy-button'\]:hover\s*\{[^}]+\}/);
  });

  it('does not recompute the diff when only the copy-confirmation state toggles, only when oldText/newText change', async () => {
    const el = (await fixture(html`
      <lyra-diff-view copyable .oldText=${'a\nb'} .newText=${'a\nX'}></lyra-diff-view>
    `)) as LyraDiffView;
    await el.updateComplete;
    const opsBefore = (el as unknown as { diffOps: DiffOp[] }).diffOps;

    // Clicking the copy button only flips the `justCopied` @state field -- a render triggered
    // purely by that must reuse the same cached diff array instead of a freshly recomputed one.
    (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect((el as unknown as { diffOps: DiffOp[] }).diffOps).to.equal(opsBefore);

    // Changing the actual compared text must still produce a fresh diff.
    el.newText = 'a\nY';
    await el.updateComplete;
    expect((el as unknown as { diffOps: DiffOp[] }).diffOps).to.not.equal(opsBefore);
  });
});
