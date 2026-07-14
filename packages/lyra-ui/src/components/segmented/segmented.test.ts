import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import { html as litHtml } from 'lit';
import './segmented.js';
import type { LyraSegmented } from './segmented.js';

const items = () => [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

function segmentButtons(el: LyraSegmented): HTMLButtonElement[] {
  return [...el.shadowRoot!.querySelectorAll('[part="segment"]')] as HTMLButtonElement[];
}

describe('lyra-segmented', () => {
  it('renders role=radiogroup with one role=radio per item, aria-checked on the selected one', async () => {
    const el = (await fixture(html`<lyra-segmented .items=${items()} value="week"></lyra-segmented>`)) as LyraSegmented;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.equal('radiogroup');
    const buttons = segmentButtons(el);
    expect(buttons.map((b) => b.getAttribute('role'))).to.deep.equal(['radio', 'radio', 'radio']);
    expect(buttons[1]!.getAttribute('aria-checked')).to.equal('true');
    expect(buttons[0]!.getAttribute('aria-checked')).to.equal('false');
  });

  it('uses roving tabindex -- only the selected item is tabbable', async () => {
    const el = (await fixture(html`<lyra-segmented .items=${items()} value="week"></lyra-segmented>`)) as LyraSegmented;
    const buttons = segmentButtons(el);
    expect(buttons.map((b) => b.getAttribute('tabindex'))).to.deep.equal(['-1', '0', '-1']);
  });

  it('selects on click and emits lyra-change', async () => {
    const el = (await fixture(html`<lyra-segmented .items=${items()} value="day"></lyra-segmented>`)) as LyraSegmented;
    const buttons = segmentButtons(el);
    setTimeout(() => buttons[2]!.click());
    const ev = await oneEvent(el, 'lyra-change');
    expect(ev.detail).to.deep.equal({ value: 'month' });
    expect(el.value).to.equal('month');
  });

  it('selects on ArrowRight (automatic activation) and wraps cyclically at the end', async () => {
    const el = (await fixture(html`<lyra-segmented .items=${items()} value="month"></lyra-segmented>`)) as LyraSegmented;
    const buttons = segmentButtons(el);
    buttons[2]!.focus();
    buttons[2]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('day'); // wrapped from the last item back to the first
  });

  it('skips disabled items during keyboard navigation', async () => {
    const withDisabled = [items()[0]!, { ...items()[1]!, disabled: true }, items()[2]!];
    const el = (await fixture(html`<lyra-segmented .items=${withDisabled} value="day"></lyra-segmented>`)) as LyraSegmented;
    const buttons = segmentButtons(el);
    buttons[0]!.focus();
    buttons[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('month'); // 'week' is disabled, skipped
  });

  it('sets aria-label on the radiogroup from the label prop, falling back to a forwarded host aria-label', async () => {
    const labeled = (await fixture(
      html`<lyra-segmented label="View" .items=${items()}></lyra-segmented>`,
    )) as LyraSegmented;
    const base1 = labeled.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base1.getAttribute('aria-label')).to.equal('View');

    const forwarded = (await fixture(
      html`<lyra-segmented aria-label="Forwarded label" .items=${items()}></lyra-segmented>`,
    )) as LyraSegmented;
    const base2 = forwarded.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base2.getAttribute('aria-label')).to.equal('Forwarded label');
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lyra-segmented .items=${items()} value="day"></lyra-segmented>`)) as LyraSegmented;
    await expect(el).to.be.accessible();
  });

  it('is accessible when labeled via the label prop', async () => {
    const el = (await fixture(
      html`<lyra-segmented label="View" .items=${items()} value="day"></lyra-segmented>`,
    )) as LyraSegmented;
    await expect(el).to.be.accessible();
  });
});

describe('item icon', () => {
  it('renders no [part=segment-icon] when items have no icon', async () => {
    const items = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ];
    const el = (await fixture(html`<lyra-segmented .items=${items} value="a"></lyra-segmented>`)) as LyraSegmented;
    expect(el.shadowRoot!.querySelector('[part="segment-icon"]')).to.not.exist;
  });

  it('renders item.icon before the label when set', async () => {
    const items = [
      { value: 'a', label: 'A', icon: litHtml`<span class="dot"></span>` },
      { value: 'b', label: 'B' },
    ];
    const el = (await fixture(html`<lyra-segmented .items=${items} value="a"></lyra-segmented>`)) as LyraSegmented;
    const button = el.shadowRoot!.querySelector('[part="segment"]')!;
    const icon = button.querySelector('[part="segment-icon"]');
    expect(icon).to.exist;
    expect(icon!.querySelector('.dot')).to.exist;
    const children = Array.from(button.children);
    const labelIndex = children.findIndex((c) => c.getAttribute('part') === 'segment-label');
    expect(children.indexOf(icon as Element)).to.be.lessThan(labelIndex);
  });
});
