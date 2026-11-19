import { sendKeys } from '@web/test-runner-commands';
import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './sequence-strip.js';
import type { LyraSequenceStrip } from './sequence-strip.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { setForcedColors } from '../../../../test/wtr-media.js';

const categories = [
  { id: 'a', color: '#4f46e5', label: 'A considerably long category label for the tooltip' },
  { id: 'b', color: '#16a34a', label: 'B' },
];
const manyItems = Array.from({ length: 12 }, (_, i) => ({ id: String(i), categoryId: i % 2 ? 'b' : 'a' }));

const cellAt = (el: LyraSequenceStrip, index: number) =>
  el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')[index]!;
const press = (target: HTMLElement, init: KeyboardEventInit) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, composed: true, ...init });
  target.dispatchEvent(event);
  return event;
};

describe('sequence-strip keyboard guards', () => {
  it('ignores modified and composing keys without cancelling them', async () => {
    const el = await fixture<LyraSequenceStrip>(
      html`<lr-sequence-strip .items=${manyItems} .categories=${categories}></lr-sequence-strip>`,
    );
    let activations = 0;
    el.addEventListener('lr-item-activate', () => { activations += 1; });
    const cell = cellAt(el, 0);
    await focusByKeyboard(cell);
    const modified: KeyboardEventInit[] = [
      { key: 'Enter', ctrlKey: true },
      { key: ' ', metaKey: true },
      { key: 'ArrowRight', altKey: true },
      { key: 'ArrowRight', isComposing: true },
      { key: 'End', ctrlKey: true },
    ];
    const prevented = modified.map((init) => press(cell, init).defaultPrevented);
    expect(prevented.every((value) => value === false)).to.equal(true);
    expect(activations).to.equal(0);
    expect(press(cell, { key: 'Enter' }).defaultPrevented).to.equal(true);
    expect(activations).to.equal(1);
  });

  it('dismisses the tooltip on Escape and keeps focus', async () => {
    const el = await fixture<LyraSequenceStrip>(
      html`<lr-sequence-strip .items=${manyItems} .categories=${categories}></lr-sequence-strip>`,
    );
    const cell = cellAt(el, 1);
    await focusByKeyboard(cell);
    cell.dispatchEvent(new PointerEvent('pointerenter'));
    await waitUntil(() => el.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')?.hidden === false);
    press(cell, { key: 'Escape' });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')!.hidden).to.equal(true);
    expect(el.shadowRoot!.activeElement === cell).to.equal(true);
  });
});

describe('sequence-strip tooltip placement', () => {
  it('keeps a wide tooltip inside the host box at the first cell', async () => {
    const el = await fixture<LyraSequenceStrip>(
      html`<lr-sequence-strip style="inline-size: 320px" .items=${manyItems} .categories=${categories}></lr-sequence-strip>`,
    );
    cellAt(el, 0).dispatchEvent(new PointerEvent('pointerenter'));
    await waitUntil(() => el.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')?.hidden === false);
    const tip = el.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')!.getBoundingClientRect();
    const host = el.getBoundingClientRect();
    expect(tip.left >= host.left - 0.5).to.equal(true);
    expect(tip.right <= host.right + 0.5).to.equal(true);
  });
});

describe('sequence-strip bidi and forced colors', () => {
  it('isolates the bounded legend count', async () => {
    const cats = Array.from({ length: 250 }, (_, i) => ({ id: `c${i}`, color: '#123456', label: `C${i}` }));
    const el = await fixture<LyraSequenceStrip>(
      html`<lr-sequence-strip dir="rtl" with-legend .items=${manyItems} .categories=${cats}></lr-sequence-strip>`,
    );
    const limit = el.shadowRoot!.querySelector<HTMLElement>('[part="legend-limit"]');
    expect(limit === null).to.equal(false);
    const style = getComputedStyle(limit!);
    expect(style.unicodeBidi).to.equal('isolate');
    expect(style.direction).to.equal('ltr');
  });

  it('keeps category, selection and marker paint under forced colors', async () => {
    const el = await fixture<LyraSequenceStrip>(
      html`<lr-sequence-strip with-legend marker-label="Milestone" selected-index="0"
        style="--lr-sequence-strip-marker-color: rgb(12, 34, 56)"
        .items=${[{ ...manyItems[0]!, marker: true }, ...manyItems.slice(1)]}
        .categories=${categories}></lr-sequence-strip>`,
    );
    try {
      await setForcedColors('active');
    } catch {
      return;
    }
    try {
      if (!matchMedia('(forced-colors: active)').matches) return;
      const cell = getComputedStyle(cellAt(el, 0));
      const partStyle = (part: string) => getComputedStyle(el.shadowRoot!.querySelector(`[part="${part}"]`)!);
      expect(cell.borderTopStyle).to.equal('solid');
      expect(cell.outlineStyle).to.equal('solid');
      expect(cell.backgroundColor).to.equal('rgb(79, 70, 229)');
      expect(partStyle('legend-swatch').backgroundColor).to.equal(cell.backgroundColor);
      expect(partStyle('marker').backgroundColor).to.equal('rgb(12, 34, 56)');
      expect(partStyle('legend-marker-swatch').boxShadow).to.contain('rgb(12, 34, 56)');
    } finally {
      await setForcedColors('none');
    }
  });
});

it('keeps the disabled-cell tooltip opaque and contained in a narrow strip', async () => {
  const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip style="inline-size:90px"
    .items=${[{ id: 'disabled', categoryId: 'a', disabled: true, label: categories[0]!.label }, ...manyItems]}
    .categories=${categories}></lr-sequence-strip>`);
  cellAt(el, 0).dispatchEvent(new PointerEvent('pointerenter'));
  await waitUntil(() => el.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')?.hidden === false);
  const tip = el.shadowRoot!.querySelector<HTMLElement>('[part="tooltip"]')!;
  let opacity = 1;
  for (let ancestor: HTMLElement | null = tip; ancestor; ancestor = ancestor.parentElement) {
    opacity *= Number(getComputedStyle(ancestor).opacity);
  }
  expect(opacity).to.equal(1);
  const host = el.getBoundingClientRect();
  const box = tip.getBoundingClientRect();
  expect(box.left).to.be.at.least(host.left - 0.5);
  expect(box.right).to.be.at.most(host.right + 0.5);
});

it('describes keyboard activation on enabled cells only', async () => {
  const el = await fixture<LyraSequenceStrip>(html`<lr-sequence-strip
    .items=${[{ id: 'disabled', categoryId: 'a', disabled: true }, ...manyItems]}
    .categories=${categories}></lr-sequence-strip>`);
  const enabled = cellAt(el, 1);
  const id = enabled.getAttribute('aria-describedby') ?? '';
  expect(el.shadowRoot!.getElementById(id)?.textContent?.trim() ?? '').to.equal('Press Enter or Space to activate this item.');
  expect(cellAt(el, 0).hasAttribute('aria-describedby')).to.equal(false);
  el.strings = { sequenceStripCellKeyboardHelp: 'Activate the current item.' };
  await el.updateComplete;
  expect(el.shadowRoot!.getElementById(id)?.textContent?.trim() ?? '').to.equal('Activate the current item.');
});

it('retains the roving stop when focus moves to a cell created in another realm', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <lr-sequence-strip .items=${manyItems} .categories=${categories}></lr-sequence-strip>
    <iframe title="Empty frame" hidden></iframe>
  </div>`);
  const strip = wrapper.querySelector('lr-sequence-strip')!;
  const foreign = wrapper.querySelector('iframe')!.contentDocument!.createElement('span');
  foreign.setAttribute('part', 'cell');
  foreign.tabIndex = 0;
  strip.shadowRoot!.querySelector('[part="base"]')!.append(foreign);

  const second = cellAt(strip, 1);
  await focusByKeyboard(second);
  expect(second.tabIndex).to.equal(0);
  await sendKeys({ press: 'Tab' });
  await strip.updateComplete;
  expect(strip.shadowRoot!.activeElement === foreign).to.equal(true);
  expect(second.tabIndex).to.equal(0);
});
