import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-segmented.js';
import type { LyraSegmented, LyraSegmentedItem } from '../../lr-segmented.js';

const items = (): LyraSegmentedItem[] => [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const checkedValues = (el: LyraSegmented): string[] =>
  [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="segment"][aria-checked="true"]')].map(
    (segment) => segment.dataset['value']!,
  );

describe('lr-segmented items replacement', () => {
  it('keeps the selection on a re-created item with the same value', async () => {
    const el = await fixture<LyraSegmented>(html`<lr-segmented .items=${items()} value="week"></lr-segmented>`);
    expect(checkedValues(el)).to.deep.equal(['week']);
    el.items = items();
    await el.updateComplete;
    expect(el.value).to.equal('week');
    expect(checkedValues(el)).to.deep.equal(['week']);
  });

  it('drops the checked state when the replacement disables the selected value', async () => {
    const el = await fixture<LyraSegmented>(html`<lr-segmented .items=${items()} value="week"></lr-segmented>`);
    el.items = items().map((item) => (item.value === 'week' ? { ...item, disabled: true } : item));
    await el.updateComplete;
    const week = el.shadowRoot!.querySelector<HTMLElement>('[part="segment"][data-value="week"]')!;
    expect(week.getAttribute('aria-disabled')).to.equal('true');
    expect(week.getAttribute('aria-checked')).to.equal('false');
  });

  it('ignores scrollToValue for a value with no segment', async () => {
    const el = await fixture<LyraSegmented>(html`<lr-segmented .items=${items()} value="week"></lr-segmented>`);
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const before = base.scrollLeft;
    el.scrollToValue('year');
    expect(base.scrollLeft).to.equal(before);
    expect(checkedValues(el)).to.deep.equal(['week']);
  });
});
