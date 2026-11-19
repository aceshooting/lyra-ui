import { setForcedColors } from '../../../../test/wtr-media.js';
import { expect, fixture, html } from '@open-wc/testing';
import './sparkline.js';
import type { LyraSparkline } from './sparkline.js';

it('does not clip the first and last points of its own plot', async () => {
  const el = await fixture<LyraSparkline>(html`<lr-sparkline mark="bar" .values=${[1, 5, 2]}></lr-sparkline>`);
  expect(getComputedStyle(el.shadowRoot!.querySelector('svg')!).overflow).to.equal('visible');
});

it('keeps small chart extremes readable in the prepared summary', async () => {
  const data = { kind: 'series', revision: 'one', getPoint: () => { throw new Error('Unexpected source read'); }, series: [{
    id: 's', label: 'Signal', counts: { sourceCount: 1000, validCount: 999, invalidCount: 1 },
    xDomain: { min: 0, max: 100 }, yDomain: { min: 0.0004, max: 0.0009 },
    samples: [0, 10, 90, 100].map((x, i) => ({ x, y: 0.0004 + i * 0.0001, sourceIndex: [0, 100, 900, 999][i]!, breakBefore: i === 0 || i === 2 })),
  }] };
  const el = await fixture<LyraSparkline>(html`<lr-sparkline .preparedData=${data as never}></lr-sparkline>`);
  const name = el.shadowRoot!.querySelector('svg')?.getAttribute('aria-label') ?? '';
  expect(name.includes('0.0004'), name).to.equal(true);
});

it('keeps data paint visible in forced colors', async () => {
  await setForcedColors('active');
  try {
    if (!matchMedia('(forced-colors: active)').matches) return;
    const wrapper = await fixture<HTMLDivElement>(html`<div><lr-sparkline appearance="gradient" .values=${[2, 4, 1]}></lr-sparkline><svg style="forced-color-adjust:none;stroke:Highlight"></svg></div>`);
    const el = wrapper.firstElementChild!;
    const probe = getComputedStyle(wrapper.lastElementChild!);
    const line = getComputedStyle(el.shadowRoot!.querySelector('[part~="line"]')!);
    expect(line.stroke).to.equal(probe.stroke);
  } finally {
    await setForcedColors('none');
  }
});

it('prefers scoped sparkline tokens while preserving the mirrored tokens', async () => {
  const el = await fixture<LyraSparkline>(html`<lr-sparkline appearance="solid" .values=${[1, 5, 2]}
    style="--line-color:red; --fill-color:green; --line-width:6px; --lr-sparkline-line-color:purple;
      --lr-sparkline-fill-color:orange; --lr-sparkline-line-width:4px"></lr-sparkline>`);
  const line = getComputedStyle(el.shadowRoot!.querySelector('[part~="line"]')!);
  const fill = getComputedStyle(el.shadowRoot!.querySelector('[part~="fill"]')!);
  expect([line.stroke, line.strokeWidth, fill.fill]).to.deep.equal(['rgb(128, 0, 128)', '4px', 'rgb(255, 165, 0)']);
  for (const suffix of ['line-color', 'line-width', 'fill-color']) el.style.removeProperty(`--lr-sparkline-${suffix}`);
  expect([line.stroke, line.strokeWidth, fill.fill]).to.deep.equal(['rgb(255, 0, 0)', '6px', 'rgb(0, 128, 0)']);
});
