import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { setForcedColors } from '../../../../test/wtr-media.js';
import '../../lr-timeline.js';
import '../../lr-timeline-item.js';
import '../../lr-tree.js';
import '../../lr-tree-item.js';
import type { LyraTimelineItem } from '../../lr-timeline-item.js';
import type { LyraTreeItem } from '../../lr-tree-item.js';

describe('forced colors', () => {
  afterEach(async () => {
    await setForcedColors('none');
  });

  it('keeps the timeline marker and rail visible', async () => {
    const el = await fixture<HTMLElement>(html`
      <lr-timeline aria-label="Events">
        <lr-timeline-item variant="success">One</lr-timeline-item>
        <lr-timeline-item>Two</lr-timeline-item>
      </lr-timeline>
    `);
    const item = el.querySelector('lr-timeline-item') as LyraTimelineItem;
    await item.updateComplete;
    await setForcedColors('active');
    await twoFrames();
    expect(matchMedia('(forced-colors: active)').matches).to.equal(true);
    const marker = getComputedStyle(item.shadowRoot!.querySelector('[part="marker"]')!);
    const rail = getComputedStyle(item.shadowRoot!.querySelector('[part="rail"]')!);
    const probe = document.createElement('div');
    probe.style.backgroundColor = 'Canvas';
    el.append(probe);
    const canvas = getComputedStyle(probe).backgroundColor;
    expect(marker.backgroundColor === canvas).to.equal(false);
    expect(rail.backgroundColor === canvas).to.equal(false);
    probe.style.backgroundColor = 'CanvasText';
    expect(marker.backgroundColor).to.equal(getComputedStyle(probe).backgroundColor);
    expect(rail.backgroundColor).to.equal(getComputedStyle(probe).backgroundColor);
  });

  it('marks the selected tree row with a system fill', async () => {
    const el = await fixture<HTMLElement>(html`
      <lr-tree label="Files"><lr-tree-item id="a" selected>A</lr-tree-item><lr-tree-item id="b">B</lr-tree-item></lr-tree>
    `);
    const items = [...el.querySelectorAll<LyraTreeItem>('lr-tree-item')];
    for (const item of items) await item.updateComplete;
    await setForcedColors('active');
    await twoFrames();
    expect(matchMedia('(forced-colors: active)').matches).to.equal(true);
    const row = (item: LyraTreeItem) => getComputedStyle(item.shadowRoot!.querySelector('[part~="item"]')!);
    const reference = document.createElement('div');
    reference.style.backgroundColor = 'Highlight';
    el.after(reference);
    await waitUntil(() => row(items[0]!).backgroundColor === getComputedStyle(reference).backgroundColor, 'selected row did not reach Highlight');
    expect(row(items[0]!).backgroundColor === row(items[1]!).backgroundColor).to.equal(false);
  });
});

describe('focus and active rings inside overflow containers', () => {
  it('keeps the active marker ring inside the horizontal strip', async () => {
    const el = await fixture<HTMLElement>(html`
      <lr-timeline orientation="horizontal" aria-label="Events" style="inline-size: 24rem">
        <lr-timeline-item active>One</lr-timeline-item>
        <lr-timeline-item>Two</lr-timeline-item>
      </lr-timeline>
    `);
    const item = el.querySelector('lr-timeline-item') as LyraTimelineItem;
    await item.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]')!.getBoundingClientRect();
    const marker = item.shadowRoot!.querySelector('[part="marker"]') as HTMLElement;
    const ring = parseFloat(getComputedStyle(marker).outlineOffset) + parseFloat(getComputedStyle(marker).outlineWidth);
    const box = marker.getBoundingClientRect();
    expect(box.top - ring >= base.top - 0.5 && box.left - ring >= base.left - 0.5 && box.bottom + ring <= base.bottom + 0.5).to.equal(true);
  });

  it('draws the tree row focus ring inside the clipping base', async () => {
    const el = await fixture<HTMLElement>(html`<lr-tree label="Files"><lr-tree-item id="a">A</lr-tree-item></lr-tree>`);
    const item = el.querySelector('lr-tree-item') as LyraTreeItem;
    await item.updateComplete;
    await focusByKeyboard(item);
    const row = item.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
    const style = getComputedStyle(row);
    expect(style.outlineStyle).to.equal('solid');
    expect(parseFloat(style.outlineOffset) < 0).to.equal(true);
  });
});
