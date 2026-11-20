import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { sinkTexts } from '../../../../test/announcements.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import { expect, fixture, html } from '@open-wc/testing';
import { focusAfterPointer, focusByKeyboard } from '../../../../test/wtr-focus.js';
import '../../lr-stat.js';
import type { LyraStat } from '../../lr-stat.js';

it('delivers exactly one click to a host listener for a click on linked content', async () => {
  const el = await fixture<LyraStat>(html`<lr-stat href="#stat-target" label="Revenue" value="12"></lr-stat>`);
  let clicks = 0;
  el.addEventListener('click', (event) => { event.preventDefault(); clicks += 1; });
  el.shadowRoot!.querySelector<HTMLElement>('[part="value"]')!.click();
  expect(clicks).to.equal(1);
});

it('themes the exact-value hover color with a scoped token', async () => {
  const el = await fixture<LyraStat>(html`<lr-stat value="12K" exact-value="12,345"
    style="--lr-stat-value-hover-color:rgb(111, 22, 33)"></lr-stat>`);
  const value = el.shadowRoot!.querySelector<HTMLElement>('[part="value"]')!;
  await hoverUntilMatched(value, 'exact value did not receive hover');
  try {
    expect(getComputedStyle(value).color).to.equal('rgb(111, 22, 33)');
  } finally {
    await resetMouse();
  }
});

it('shows and clears the number of admitted breakdown rows', async () => {
  expectDevWarning('lyra-collection-truncated:lr-stat:rows');
  const el = await fixture<LyraStat>(html`<lr-stat value="42"></lr-stat>`);
  const rows = Array.from({ length: 10_001 }, (_, index) => ({ label: String(index), value: '1' }));
  el.rows = rows;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.contain('10,000 of 10,001');
  expect(sinkTexts().some(text => text.includes('10,000 of 10,001'))).to.equal(true);
  el.strings = { statRowsInputLimit: 'Breakdown: {count}/{total}' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal('Breakdown: 10,000/10,001');
  el.rows = rows.slice(0, 1);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(true);
});

it('reveals the exact value visibly while the value or a linked card has keyboard focus', async () => {
  const el = await fixture<LyraStat>(html`<lr-stat label="Revenue" value="1.2M" exact-value="1,234,567.89"></lr-stat>`);
  el.rows = [{ label: 'Tokens', value: '1.2K', exactValue: '1,204' }];
  await el.updateComplete;
  const root = el.shadowRoot!;
  const shown = (selector: string): boolean => {
    const node = root.querySelector<HTMLElement>(selector)!;
    return getComputedStyle(node).display !== 'none' && node.getBoundingClientRect().height > 0;
  };
  const value = root.querySelector<HTMLElement>('[part="value"]')!;
  const rowValue = root.querySelector<HTMLElement>('[part="row-value"]')!;
  const states: Record<string, boolean> = { rest: shown('[part="value-row"] > .exact-reveal') };
  await focusAfterPointer(value);
  states['pointerFocus'] = shown('[part="value-row"] > .exact-reveal');
  await focusByKeyboard(value);
  states['keyboard'] = shown('[part="value-row"] > .exact-reveal');
  states['keyboardText'] = root.querySelector('[part="value-row"] > .exact-reveal')!.textContent === '1,234,567.89';
  await focusByKeyboard(rowValue);
  states['row'] = shown('[part="row"] > .exact-reveal');
  states['headlineAfterRow'] = shown('[part="value-row"] > .exact-reveal');

  const linked = await fixture<LyraStat>(html`<lr-stat href="#stat" label="Revenue" value="1.2M" exact-value="1,234,567.89"></lr-stat>`);
  const anchor = linked.shadowRoot!.querySelector<HTMLElement>('a[part="base"]')!;
  await focusByKeyboard(anchor);
  const linkedReveal = linked.shadowRoot!.querySelector<HTMLElement>('.exact-reveal')!;
  states['linked'] = getComputedStyle(linkedReveal).display !== 'none';
  expect(states).to.deep.equal({
    rest: false, pointerFocus: false, keyboard: true, keyboardText: true, row: true, headlineAfterRow: false, linked: true,
  });
});
