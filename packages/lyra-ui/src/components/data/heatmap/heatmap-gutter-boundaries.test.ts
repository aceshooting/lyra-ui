import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './heatmap.js';
import type { LyraHeatmap } from './heatmap.js';

/** The painted canvas width of a one-day calendar whose weekday gutter is pinned to `weekdayLabelWidth`. */
async function canvasWidth(weekdayLabelWidth?: unknown): Promise<number> {
  const el = await fixture<LyraHeatmap>(html`<lr-heatmap cell-size="20"></lr-heatmap>`);
  el.data = {
    kind: 'calendar',
    days: [{ date: '2026-01-05', value: 3 }],
    ...(weekdayLabelWidth === undefined ? {} : { weekdayLabelWidth }),
  } as unknown as LyraHeatmap['data'];
  await el.updateComplete;
  await waitUntil(() => el.exportData('png') !== '', 'the calendar did not complete a paint');
  const canvas = el.shadowRoot!.querySelector('canvas');
  if (!canvas) throw new Error('The calendar did not render its canvas');
  return canvas.width;
}

describe('lr-heatmap calendar weekday gutter', () => {
  it('widens the gutter to a pinned width and falls back to the built-in one for a negative width', async () => {
    const builtIn = await canvasWidth();
    expect(await canvasWidth(120)).to.be.greaterThan(builtIn);
    expect(await canvasWidth(-12)).to.equal(builtIn);
    expect(await canvasWidth(Number.NaN)).to.equal(builtIn);
    expect(await canvasWidth('narrow')).to.equal(builtIn);
  });
});
