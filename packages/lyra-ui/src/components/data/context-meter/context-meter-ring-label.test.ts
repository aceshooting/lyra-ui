// The ring's centre caption must sit inside the hole, over no arc, in every engine.
import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-context-meter.js';
import type { ContextMeterSegment, LyraContextMeter } from '../../lr-context-meter.js';

// Ring geometry in viewBox units: radius 40, stroke 12, so the hole's edge is at radius 34.
const VIEWBOX = 100;
const HOLE_RADIUS = 34;
const WARNING: ContextMeterSegment[] = [
  { label: 'Used', value: 60, tone: 'warning' },
  { label: 'Spare', value: 30, tone: 'danger' },
];

async function ring(label: string): Promise<LyraContextMeter> {
  const el = await fixture<LyraContextMeter>(
    html`<lr-context-meter shape="ring" total="100" .label=${label} .segments=${WARNING}></lr-context-meter>`,
  );
  await el.updateComplete;
  return el;
}

/** Largest distance, in viewBox units, from the ring centre to any corner of the given rects. */
function farthestCorner(el: LyraContextMeter, rects: Iterable<DOMRect>): number {
  const svg = el.shadowRoot!.querySelector('svg[part="base"]')!.getBoundingClientRect();
  const scale = svg.width / VIEWBOX;
  const cx = svg.left + svg.width / 2;
  const cy = svg.top + svg.height / 2;
  let farthest = 0;
  for (const rect of rects) {
    for (const x of [rect.left, rect.right]) {
      for (const y of [rect.top, rect.bottom]) {
        farthest = Math.max(farthest, Math.hypot(x - cx, y - cy) / scale);
      }
    }
  }
  return farthest;
}

describe('lr-context-meter ring caption', () => {
  it('keeps the caption box and its glyphs inside the ring hole', async () => {
    for (const label of ['Context', 'A deliberately long translated context-window occupancy label']) {
      const el = await ring(label);
      const box = el.shadowRoot!.querySelector('[part="label"]')!.getBoundingClientRect();
      expect(farthestCorner(el, [box]), `caption box for "${label}"`).to.be.at.most(HOLE_RADIUS);
      // The caption clips its own overflow, so only the part of each glyph box inside it paints.
      const range = document.createRange();
      range.selectNodeContents(el.shadowRoot!.querySelector('.ring-label')!);
      const painted = [...range.getClientRects()].flatMap((glyphs) => {
        const left = Math.max(glyphs.left, box.left);
        const top = Math.max(glyphs.top, box.top);
        const width = Math.min(glyphs.right, box.right) - left;
        const height = Math.min(glyphs.bottom, box.bottom) - top;
        return width > 0 && height > 0 ? [new DOMRect(left, top, width, height)] : [];
      });
      expect(painted.length, `glyphs for "${label}"`).to.be.greaterThan(0);
      expect(farthestCorner(el, painted), `glyphs for "${label}"`).to.be.at.most(HOLE_RADIUS);
    }
  });

  it('gives no ring circle a computed background a contrast check could mistake for the backdrop', async () => {
    const el = await ring('Context');
    const backgrounds = [...el.shadowRoot!.querySelectorAll('circle')].map(
      (circle) => getComputedStyle(circle).backgroundColor,
    );
    expect(backgrounds.length).to.equal(3);
    expect(backgrounds.every((color) => color === 'rgba(0, 0, 0, 0)' || color === 'transparent'), backgrounds.join()).to.be.true;
  });

  it('passes axe color-contrast with a warning arc behind the caption', async () => {
    const el = await ring('Context');
    await expect(el).to.be.accessible();
  });
});
