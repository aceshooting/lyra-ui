import { expect, fixture, html } from '@open-wc/testing';
import './terminal.js';
import type { LyraTerminal } from './terminal.class.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

it('stores a 20,000-character line as text and one style run', () => {
  const el = document.createElement('lr-terminal') as LyraTerminal;
  el.write('x'.repeat(20000));
  const line = (el as unknown as { buffer: { text: string; runs: unknown[] }[] }).buffer[0]!;
  expect(line.text?.length).to.equal(20000);
  expect(line.runs.length).to.equal(1);
  recordScaleMeasurement('lr-terminal', 'plain-line@20000', { styleRuns: line.runs.length });
});

it('keeps 250,000 ordinary output characters within the raised retention ceiling', () => {
  const el = document.createElement('lr-terminal') as LyraTerminal;
  el.write(Array(2500).fill('x'.repeat(100)).join('\n'));
  const text = el.getPlainText();
  expect(text.split('\n').length).to.equal(2500);
  recordScaleMeasurement('lr-terminal', 'retention@250000', { retainedLines: text.split('\n').length });
});

it('preserves the virtual row renderer across unrelated updates', async () => {
  const el = await fixture<LyraTerminal>(html`<lr-terminal .content=${Array(1000).fill('line').join('\n')}></lr-terminal>`);
  const list = el.shadowRoot!.querySelector('lr-virtual-list') as unknown as { renderItem: unknown };
  const render = list.renderItem;
  el.downloadable = true;
  await el.updateComplete;
  expect(list.renderItem === render).to.equal(true);
});

it('signals truncation of write and content input', async () => {
  const el = await fixture<LyraTerminal>(html`<lr-terminal></lr-terminal>`);
  const notices: unknown[] = [];
  el.addEventListener('lr-overflow', event => notices.push((event as CustomEvent).detail));
  el.write('x'.repeat(20001));
  expect(notices.length).to.equal(1);
  el.content = 'y'.repeat(1000001);
  await el.updateComplete;
  expect(notices.length).to.equal(2);
});

it('keeps scalar cursor positions and style runs aligned through overwrite, tabs and erasure', () => {
  const el = document.createElement('lr-terminal') as LyraTerminal;
  el.write('\u001b[31m😀ab\u001b[0m\rX');
  expect(el.getPlainText()).to.equal('Xab');
  el.write('\b😀\tY');
  expect(el.getPlainText()).to.equal('😀ab     Y');
  el.write('\r\u001b[1K');
  expect(el.getPlainText()).to.equal(' ab     Y');
  el.write('\u001b[2KZ');
  expect(el.getPlainText()).to.equal('Z');
  const line = (el as unknown as {buffer: {text: string; runs: {start: number; end: number}[]}[]}).buffer[0]!;
  expect(line.runs.map(run => line.text.slice(run.start, run.end)).join('')).to.equal('Z');
});

it('enforces the 2,000,000-character total while reporting dropped lines', () => {
  const el = document.createElement('lr-terminal') as LyraTerminal;
  el.maxScrollback = 10000;
  let dropped = 0;
  el.addEventListener('lr-overflow', event => { dropped += (event as CustomEvent<{linesDropped: number}>).detail.linesDropped; });
  for (let i = 0; i < 3; i++) el.write(`${'x'.repeat(20000)}\n`.repeat(40));
  const retained = (el as unknown as {retainedCellCount: number}).retainedCellCount;
  expect(retained).to.equal(2000000);
  expect(dropped).to.equal(20);
});

it('reuses the 10,000-match line set on unrelated renders', () => {
  const el = document.createElement('lr-terminal') as LyraTerminal;
  const probe = el as unknown as {searchMatches: {lineNumber: number}[]; matchedLineNumbers(): Set<number>};
  probe.searchMatches = Array.from({length:10000}, (_, i) => ({lineNumber:i+1}));
  const first = probe.matchedLineNumbers();
  let replacements = 0;
  for (let i = 0; i < 100; i++) if (probe.matchedLineNumbers() !== first) replacements++;
  expect(replacements).to.equal(0);
  recordScaleMeasurement('lr-terminal', 'match-set@10000', {replacements});
});

it('paints and clears search markers when explicit refresh coalesces with named changes', async () => {
  const el = await fixture<LyraTerminal>(html`<lr-terminal content="match"></lr-terminal>`);
  const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & {updateComplete: Promise<boolean>};
  const seam = el as unknown as {scrollTargetLineNumber: number};
  seam.scrollTargetLineNumber = 1;
  el.follow = true;
  await el.updateComplete;
  await list.updateComplete;
  await el.search('match');
  await list.updateComplete;
  expect(list.shadowRoot!.querySelectorAll('[data-match]').length).to.equal(1);
  el.downloadable = true;
  el.clearSearch();
  await el.updateComplete;
  await list.updateComplete;
  expect(list.shadowRoot!.querySelectorAll('[data-match]').length).to.equal(0);
});
