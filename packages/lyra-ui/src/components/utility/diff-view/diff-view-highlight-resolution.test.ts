import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-diff-view.js';
import type { LyraDiffView } from '../../lr-diff-view.js';

const text = ['a', 'b', 'c', 'd'].join('\n');

async function renderDiff(oldText = text, newText = text): Promise<LyraDiffView> {
  const el = await fixture<LyraDiffView>(html`<lr-diff-view .oldText=${oldText} .newText=${newText}></lr-diff-view>`);
  await el.updateComplete;
  return el;
}

function highlightOf(el: LyraDiffView, index: number): string | null {
  return el.shadowRoot!.querySelector(`[data-op-index="${index}"]`)!.getAttribute('data-highlight');
}

describe('lr-diff-view highlight resolution', () => {
  it('keeps the first highlight where ranges overlap', async () => {
    const el = await renderDiff();
    el.highlights = [
      { id: 'first', anchor: { kind: 'line-range', start: 0, end: 1 }, tone: 'danger' },
      { id: 'first', anchor: { kind: 'line-range', start: 3 }, tone: 'warning' },
      { id: 'second', anchor: { kind: 'line-range', start: 1, end: 2 }, tone: 'success' },
    ];
    await el.updateComplete;
    expect([0, 1, 2, 3].map((index) => highlightOf(el, index))).to.deep.equal([
      'danger',
      'danger',
      'success',
      null,
    ]);
    expect(el.shadowRoot!.querySelectorAll('[part="line-highlight-action"]').length).to.equal(2);
  });

  it('paints no highlight for an anchor whose start lies outside the diff', async () => {
    const el = await renderDiff();
    el.highlights = [
      { id: 'beyond', anchor: { kind: 'line-range', start: 40 } },
      { id: 'negative', anchor: { kind: 'line-range', start: -1, end: 1 } },
      { id: 'inside', anchor: { kind: 'line-range', start: 2, end: 99 }, tone: 'warning' },
    ];
    await el.updateComplete;
    expect([0, 1, 2, 3].map((index) => highlightOf(el, index))).to.deep.equal([null, null, 'warning', 'warning']);
    expect(el.shadowRoot!.querySelectorAll('[part="line-highlight-action"]').length).to.equal(1);
    expect(await el.scrollToAnchor({ kind: 'line-range', start: 40 })).to.equal(false);
  });

  it('names a labelled highlight action after its label', async () => {
    const el = await renderDiff();
    el.highlights = [{ id: 'named', label: 'Risky change', anchor: { kind: 'line-range', start: 2 } }];
    await el.updateComplete;
    const action = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="line-highlight-action"]')!;
    expect(action.getAttribute('aria-label') ?? action.textContent ?? '').to.include('Risky change');
  });

  it('paints at most one hundred highlights', async () => {
    const lines = Array.from({ length: 120 }, (_, index) => `line ${index}`).join('\n');
    const el = await renderDiff(lines, lines);
    el.highlights = Array.from({ length: 120 }, (_, index) => ({
      id: `h${index}`,
      anchor: { kind: 'line-range' as const, start: index },
    }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="line-highlight-action"]').length).to.equal(100);
    expect(highlightOf(el, 99)).to.not.equal(null);
    expect(el.shadowRoot!.querySelector('[data-op-index="100"]')!.hasAttribute('data-highlight')).to.equal(false);
  });
});

describe('lr-diff-view input normalization', () => {
  it('treats a non-string newText as empty, reporting every old line as removed', async () => {
    const el = await renderDiff('x\ny', 'x\ny');
    el.newText = null as unknown as string;
    await el.updateComplete;
    const types = [...el.shadowRoot!.querySelectorAll('[part="line"][data-op-index]')].map((line) =>
      line.getAttribute('data-type'),
    );
    expect(types).to.deep.equal(['remove', 'remove']);
  });

  it('leaves the new side empty for a pure deletion in split layout', async () => {
    const el = await fixture<LyraDiffView>(
      html`<lr-diff-view layout="split" .oldText=${'keep\ngone'} .newText=${'keep'}></lr-diff-view>`,
    );
    await el.updateComplete;
    const side = (name: string) =>
      [...el.shadowRoot!.querySelectorAll(`[part="side"][data-side="${name}"] [part="line"]`)].map((line) =>
        line.getAttribute('data-type'),
      );
    expect(side('old')).to.deep.equal(['equal', 'remove']);
    expect(side('new')).to.deep.equal(['equal', 'empty']);
  });
});
