import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { sinkTexts } from '../../../../test/announcements.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import { expect, fixture, html } from '@open-wc/testing';
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
