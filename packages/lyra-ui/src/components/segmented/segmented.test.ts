import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import { html as litHtml } from 'lit';
import './segmented.js';
import type { LyraSegmented } from './segmented.js';
import { styles } from './segmented.styles.js';

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

  it('makes the first item tabbable when no item is selected, so the radiogroup stays keyboard-reachable', async () => {
    const el = (await fixture(html`<lyra-segmented .items=${items()}></lyra-segmented>`)) as LyraSegmented;
    const buttons = segmentButtons(el);
    expect(el.value).to.equal('');
    expect(buttons.map((b) => b.getAttribute('tabindex'))).to.deep.equal(['0', '-1', '-1']);
  });

  it('falls back to the first non-disabled item when nothing is selected', async () => {
    const withDisabled = [{ ...items()[0]!, disabled: true }, items()[1]!, items()[2]!];
    const el = (await fixture(html`<lyra-segmented .items=${withDisabled}></lyra-segmented>`)) as LyraSegmented;
    const buttons = segmentButtons(el);
    expect(buttons.map((b) => b.getAttribute('tabindex'))).to.deep.equal(['-1', '0', '-1']);
  });

  it('ArrowRight from the unselected, first-tabbable state selects the first item', async () => {
    const el = (await fixture(html`<lyra-segmented .items=${items()}></lyra-segmented>`)) as LyraSegmented;
    const buttons = segmentButtons(el);
    buttons[0]!.focus();
    buttons[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('day');
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

  it('moves focus to the target item when its value contains a double-quote character', async () => {
    const withQuote = [{ value: 'a', label: 'A' }, { value: 'b"c', label: 'B' }, { value: 'd', label: 'D' }];
    const el = (await fixture(html`<lyra-segmented .items=${withQuote} value="a"></lyra-segmented>`)) as LyraSegmented;
    const buttons = segmentButtons(el);
    buttons[0]!.focus();
    buttons[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).to.equal('b"c');
    // Without escaping the value in the attribute-selector lookup, `focusItem()` throws before
    // reaching `.focus()`, so the target button never receives focus even though `value` updated.
    expect(el.shadowRoot!.activeElement).to.equal(buttons[1]);
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

  it('gives a non-disabled, non-checked segment a :hover treatment', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(
      /\[part='segment'\]:hover:not\(\[aria-disabled='true'\]\):not\(\[aria-checked='true'\]\)\s*\{[^}]+\}/,
    );
  });

  it('adds a static, themeable edge fade to the scroll container', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.include('-webkit-mask-image: linear-gradient');
    expect(css).to.include('mask-image: linear-gradient');
    expect(css).to.include('var(--lyra-scroll-fade-size)');
  });
});

describe('narrow allocation', () => {
  it('keeps a long button row horizontally scrollable inside a 320px container', async () => {
    // `parentNode` is an open-wc fixture option -- the fixture wrapper appends it under
    // `document.body` itself and the global afterEach fixtureCleanup removes it, so this
    // test must not append/remove it manually (that would double-remove the node).
    const container = document.createElement('div');
    container.style.inlineSize = '320px';
    const el = (await fixture(
      html`<lyra-segmented
        .items=${[
          { value: 'all', label: 'Alle Elemente' },
          { value: 'active', label: 'Aktive Elemente' },
          { value: 'pending', label: 'Ausstehende Elemente' },
          { value: 'archived', label: 'Archivierte Elemente' },
          { value: 'deleted', label: 'Gelöschte Elemente' },
        ]}
        value="active"
      ></lyra-segmented>`,
      { parentNode: container },
    )) as LyraSegmented;
    await el.updateComplete;

    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).flexWrap).to.equal('nowrap');
    expect(getComputedStyle(base).overflowX).to.equal('auto');
    // The host's own box must not overflow the 320px allocation; the row itself
    // owns horizontal scrolling for long translated labels.
    expect((el as HTMLElement).getBoundingClientRect().width).to.be.at.most(320);
  });
});
