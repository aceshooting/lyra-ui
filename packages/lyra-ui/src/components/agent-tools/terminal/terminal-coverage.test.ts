import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import '../../lr-terminal.js';
import type { LyraTerminal } from '../../lr-terminal.js';

expectLocaleFallback('de-DE', ['terminalHighlightLine', 'terminalLabel', 'copy']);

it('gives a blank highlighted output line a localized accessible name', async () => {
  const terminal = await fixture<LyraTerminal>(html`<lr-terminal lang="de-DE"></lr-terminal>`);
  terminal.write('before\n\nafter');
  terminal.highlights = [{
    id: 'blank-output',
    anchor: { kind: 'line-range', start: 2, end: 2 },
    tone: 'warning',
  }];
  await terminal.updateComplete;
  const list = terminal.shadowRoot!.querySelector('lr-virtual-list')!;
  await waitUntil(() => list.shadowRoot!.querySelector('[data-line-number="2"]') !== null, 'the highlighted blank line rendered');

  const line = list.shadowRoot!.querySelector<HTMLElement>('[data-line-number="2"]')!;
  expect(line.getAttribute('role')).to.equal('button');
  expect(line.getAttribute('aria-label')).to.equal('Line 2');
  await expect(terminal).to.be.accessible();

  terminal.strings = { terminalHighlightLine: 'Blank output at line {line}' };
  await terminal.updateComplete;
  expect(line.getAttribute('aria-label')).to.equal('Blank output at line 2');
});

it('rescans a capped search from the start when more output arrives and keeps the lower bound', async () => {
  const terminal = await fixture<LyraTerminal>(html`<lr-terminal></lr-terminal>`);
  terminal.write('a'.repeat(12_000));
  expect(await terminal.search('a')).to.equal(10_000);
  const changes: { matchCount: number; matchCountExact: boolean }[] = [];
  terminal.addEventListener('lr-search-change', (event) => changes.push((event as CustomEvent).detail));
  terminal.write('\nb a');
  await terminal.updateComplete;
  expect(changes, 'a still-capped count is not a search change').to.deep.equal([]);
  terminal.replace('a\nb a');
  await terminal.updateComplete;
  expect(changes.at(-1), 'replacement resets the search').to.include({ matchCount: 0, matchCountExact: true });
  expect(await terminal.search('a')).to.equal(2);
  terminal.write('\na');
  expect(changes.at(-1)).to.include({ matchCount: 3, matchCountExact: true });
});

it('prunes scrollback while one long write is still appending lines', async () => {
  const terminal = await fixture<LyraTerminal>(html`<lr-terminal max-scrollback="10"></lr-terminal>`);
  terminal.write(Array.from({ length: 400 }, (_, index) => `line ${index}`).join('\n'));
  const lines = terminal.getPlainText().split('\n');
  expect(lines.length).to.equal(10);
  expect(lines.at(-1)).to.equal('line 399');
  expect(lines[0]).to.equal('line 390');
});

it('keeps an erased blank line empty and drops text past a full line', async () => {
  const terminal = await fixture<LyraTerminal>(html`<lr-terminal></lr-terminal>`);
  terminal.write('\x1b[2K');
  expect(terminal.getPlainText()).to.equal('');
  terminal.write('x'.repeat(20_000));
  const overflow = new Promise<CustomEvent>((resolve) => terminal.addEventListener('lr-overflow', (event) => resolve(event as CustomEvent), { once: true }));
  terminal.write('yz');
  expect((await overflow).detail.lineCharactersDropped).to.equal(2);
  expect(terminal.getPlainText()).to.equal('x'.repeat(20_000));
});

it('declines to scroll to an unknown highlight or a non-line anchor', async () => {
  const terminal = await fixture<LyraTerminal>(html`<lr-terminal></lr-terminal>`);
  terminal.write('one\ntwo');
  terminal.highlights = [{ id: 'quote', anchor: { kind: 'text-quote', exact: 'two' } } as never];
  await terminal.updateComplete;
  expect(await terminal.scrollToAnchor('missing')).to.equal(false);
  expect(await terminal.scrollToAnchor('quote')).to.equal(false);
  expect(await terminal.scrollToAnchor({ kind: 'text-quote', exact: 'two' } as never)).to.equal(false);
  expect(terminal.shadowRoot!.querySelectorAll('[data-highlight-tone]').length).to.equal(0);
  expect(await terminal.scrollToAnchor({ kind: 'line-range', start: 2 })).to.equal(true);
});
