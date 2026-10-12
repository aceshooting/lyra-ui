import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import './terminal.js';
import type { LyraTerminal } from './terminal.js';

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
