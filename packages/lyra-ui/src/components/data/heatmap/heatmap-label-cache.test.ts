import { expect } from '@open-wc/testing';
import { HeatmapLabelCache } from './heatmap-label-cache.js';

/** A complete stand-in for the canvas state the cache keys on, counting every real measurement. */
function recordingContext(font = '12px sans-serif') {
  const measured: string[] = [];
  const ctx = {
    font, direction: 'ltr', fontKerning: 'auto', fontStretch: 'normal', fontVariantCaps: 'normal',
    letterSpacing: '0px', wordSpacing: '0px', textRendering: 'auto',
    measureText: (text: string) => { measured.push(text); return { width: text.length * 6 }; },
  } as unknown as CanvasRenderingContext2D;
  return { ctx, measured };
}

describe('heatmap label cache', () => {
  it('measures a label once per font state and clips once per available width', () => {
    const cache = new HeatmapLabelCache();
    const { ctx, measured } = recordingContext();
    expect(cache.width(ctx, 'Monday')).to.equal(36);
    expect(cache.width(ctx, 'Monday')).to.equal(36);
    expect(measured).to.deep.equal(['Monday']);
    ctx.font = '14px serif';
    expect(cache.width(ctx, 'Monday')).to.equal(36);
    expect(measured).to.deep.equal(['Monday', 'Monday']);
    let clips = 0;
    const clip = (width: number) => cache.clip(ctx, 'Wednesday', width, () => { clips++; return `Wed@${width}`; });
    expect([clip(40), clip(40), clip(24)]).to.deep.equal(['Wed@40', 'Wed@40', 'Wed@24']);
    expect(clips).to.equal(2);
  });

  it('computes an oversized label directly every time instead of retaining it', () => {
    const cache = new HeatmapLabelCache();
    const { ctx, measured } = recordingContext();
    const huge = 'x'.repeat(65_530);
    expect(cache.width(ctx, huge)).to.equal(huge.length * 6);
    expect(cache.width(ctx, huge)).to.equal(huge.length * 6);
    expect(measured.length).to.equal(2);
    let clips = 0;
    const clip = () => cache.clip(ctx, huge, 40, () => { clips++; return 'x'; });
    expect([clip(), clip()]).to.deep.equal(['x', 'x']);
    expect(clips).to.equal(2);
    const beyond = 'y'.repeat(70_000);
    expect(cache.width(ctx, beyond)).to.equal(beyond.length * 6);
    expect(cache.width(ctx, beyond)).to.equal(beyond.length * 6);
    expect(measured.length).to.equal(4);
  });

  it('stops retaining new labels once its budget is spent but keeps answering correctly', () => {
    const cache = new HeatmapLabelCache();
    const { ctx, measured } = recordingContext();
    const labels = Array.from({ length: 1_200 }, (_, index) => `label ${index}`);
    for (const label of labels) cache.width(ctx, label);
    expect(measured.length).to.equal(labels.length);
    measured.length = 0;
    cache.width(ctx, labels[0]!);
    expect(measured, 'an early label stays retained').to.deep.equal([]);
    cache.width(ctx, labels.at(-1)!);
    expect(measured, 'a late label arrived after the budget was spent').to.deep.equal([labels.at(-1)]);
    for (const label of labels) expect(cache.width(ctx, label)).to.equal(label.length * 6);
  });
});
