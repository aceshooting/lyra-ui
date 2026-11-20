import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { sinkTexts } from '../../../../test/announcements.js';
import { setForcedColors } from '../../../../test/wtr-media.js';
import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-context-meter.js';
import type { LyraContextMeter } from '../../lr-context-meter.js';

const segments = [{ label: 'Docs', value: 40 }, { label: 'Chat', value: 0.01 }];

describe('context-meter remediation', () => {
  it('does not cancel modified Enter on a ring arc and still activates on plain Enter', async () => {
    const el = await fixture<LyraContextMeter>(html`<lr-context-meter interactive shape="ring" total="100" .segments=${segments}></lr-context-meter>`);
    const arc = el.shadowRoot!.querySelector<SVGElement>('[part~="segment"][role="button"]')!;
    const ctrl = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true });
    arc.dispatchEvent(ctrl);
    expect(ctrl.defaultPrevented).to.equal(false);
    const plain = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    arc.dispatchEvent(plain);
    expect(plain.defaultPrevented).to.equal(true);
  });

  it('names the meter from its summary when the label is whitespace', async () => {
    const el = await fixture<LyraContextMeter>(html`<lr-context-meter total="100" label="   " .segments=${segments}></lr-context-meter>`);
    const name = el.shadowRoot!.querySelector('[part="semantic"]')!.getAttribute('aria-label') ?? '';
    expect(name.trim().length > 0).to.equal(true);
  });

  it('prints a sub-0.1% share as a floor, not 0%', async () => {
    const el = await fixture<LyraContextMeter>(html`<lr-context-meter total="1000000" with-legend legend-display="label-percent" .segments=${[{ label: 'Tiny', value: 1 }]}></lr-context-meter>`);
    const text = el.shadowRoot!.querySelector('[part="legend-percent"]')?.textContent ?? '';
    expect(text.includes('<')).to.equal(true);
  });
});

it('emits a noncancelable event after a segment toggle and respects a synchronous owner write', async () => {
  const el = await fixture<LyraContextMeter>(html`<lr-context-meter interactive total="100"
    .segments=${[{ label: 'First', value: 30 }, { label: 'Second', value: 40 }]}></lr-context-meter>`);
  const first = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="segment"]')!;
  const observed: { cancelable: boolean; detail: unknown; selected: readonly number[] }[] = [];
  el.addEventListener('lr-segment-selection-change', (event) => {
    observed.push({ cancelable: event.cancelable, detail: (event as CustomEvent).detail, selected: el.selectedIndices });
  });
  first.click();
  expect(observed).to.deep.equal([{ cancelable: false, detail: { selectedIndices: [0] }, selected: [0] }]);
  el.addEventListener('lr-segment-activate-request', () => { el.selectedIndices = [1]; }, { once: true });
  first.click();
  expect(el.selectedIndices).to.deep.equal([1]);
  el.addEventListener('lr-segment-activate-request', () => { el.selectedIndices = el.selectedIndices; }, { once: true });
  first.click();
  expect(el.selectedIndices).to.deep.equal([1]);
  expect(observed.length).to.equal(1);
});

it('shows and clears the number of admitted segments', async () => {
  expectDevWarning('lyra-collection-truncated:lr-context-meter:segments');
  const el = await fixture<LyraContextMeter>(html`<lr-context-meter interactive></lr-context-meter>`);
  const entries: LyraContextMeter['segments'][number][] = [];
  entries[0] = { label: 'First', value: 1 };
  entries[10_000] = { label: 'Past the limit', value: 1 };
  el.segments = entries;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.contain('10,000 of 10,001');
  expect(sinkTexts().some(text => text.includes('10,000 of 10,001'))).to.equal(true);
  el.strings = { contextMeterInputLimit: 'Segments: {count}/{total}' };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal('Segments: 10,000/10,001');
  el.segments = entries.slice(0, 1);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="limit"]') === null).to.equal(true);
});

it('distinguishes the selected segment and tone patterns in forced colors', async () => {
  await setForcedColors('active');
  try {
    if (!matchMedia('(forced-colors: active)').matches) return;
    const el = await fixture<LyraContextMeter>(html`<lr-context-meter interactive with-legend total="100"
      .selectedIndices=${[0]} .segments=${[
        { label: 'Docs', value: 40, tone: 'success' },
        { label: 'Chat', value: 20, tone: 'warning' },
      ]}></lr-context-meter>`);
    const bands = [...el.shadowRoot!.querySelectorAll('[part~="segment"]')].map((band) => getComputedStyle(band));
    expect(bands.map((band) => band.borderTopStyle)).to.deep.equal(['dashed', 'dotted']);
    expect(bands[0]!.boxShadow).to.contain('inset');
    expect(bands[1]!.boxShadow).to.equal('none');
    expect(getComputedStyle(el.shadowRoot!.querySelector('[part~="legend-item-selected"]')!).outlineStyle).to.equal('solid');
  } finally {
    await setForcedColors('none');
  }
});
