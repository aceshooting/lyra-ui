import { expect, fixture, html, aTimeout } from '@open-wc/testing';
import './timeline.js';
import type { LyraTimeline } from './timeline.js';
import type { LyraTimelineItem } from './timeline-item.js';
import { twoFrames } from '../../../../test/frames.js';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';

type Probe = { timelineItems(): LyraTimelineItem[]; applyTimeScale(): void; timeRange(values: (number | null)[]): [number, number] | null; scrollOverflow: { observeExtra(items: Iterable<Element>): void } };
it('does no per-item style reset for a 10000-item flow projection', () => {
  const el = document.createElement('lr-timeline') as LyraTimeline;
  const probe = el as unknown as Probe;
  const items = Array.from({ length: 10_000 }, () => document.createElement('div'));
  probe.timelineItems = () => items as unknown as LyraTimelineItem[];
  let resets = 0;
  items.forEach(item => { item.style.removeProperty = () => { resets++; return ''; }; });
  probe.applyTimeScale();
  expect(resets).to.equal(0);
  recordScaleMeasurement('lr-timeline', '10000 flow items reconciliation', { styleResets: resets });
});
it('does not re-observe every item on an unrelated update', async () => {
  const el = await fixture<LyraTimeline>(html`<lr-timeline><lr-timeline-item></lr-timeline-item></lr-timeline>`);
  await twoFrames();
  const probe = el as unknown as Probe;
  const original = probe.scrollOverflow.observeExtra;
  let observations = 0;
  probe.scrollOverflow.observeExtra = items => { observations += [...items].length; };
  try { el.accessibleLabel = 'Changed'; await el.updateComplete; expect(observations).to.equal(0); }
  finally { probe.scrollOverflow.observeExtra = original; }
});
it('reduces large timestamp ranges without spreading argument lists', () => {
  const el = document.createElement('lr-timeline') as LyraTimeline;
  const probe = el as unknown as Probe;
  const min = Math.min, max = Math.max;
  let largest = 0;
  Math.min = (...values: number[]) => { largest = Math.max(largest, values.length); return min(...values); };
  Math.max = (...values: number[]) => { largest = max(largest, values.length); return max(...values); };
  try {
    expect(probe.timeRange(Array.from({ length: 10_000 }, (_, index) => index))).to.deep.equal([0, 9999]);
    expect(largest).to.be.at.most(2);
  } finally { Math.min = min; Math.max = max; }
});
it('measures only the invalidated time item after a stable extent pass', async () => {
  const el = await fixture<LyraTimeline>(html`<lr-timeline scale="time" orientation="horizontal"><lr-timeline-item></lr-timeline-item><lr-timeline-item></lr-timeline-item></lr-timeline>`);
  await twoFrames(); await el.updateComplete; await aTimeout(60);
  const items = [...el.children] as LyraTimelineItem[];
  const probe = el as unknown as { scheduleTimeExtentMeasurement(): void; invalidateTimeGeometry?(item?: Element): void };
  let reads = 0;
  const originals = items.map(item => item.getClientRects);
  items.forEach(item => { const original = item.getClientRects; item.getClientRects = function () { reads++; return original.call(this); }; });
  try {
    probe.invalidateTimeGeometry?.(items[0]);
    probe.scheduleTimeExtentMeasurement(); await twoFrames();
    expect(reads).to.equal(1);
    recordScaleMeasurement('lr-timeline', '2 time items resize extent', { itemMeasurements: reads });
  } finally { items.forEach((item, index) => { item.getClientRects = originals[index]!; }); }
});
it('recomputes horizontal content height when an item and the allocation grow', async () => {
  const el = await fixture<LyraTimeline>(html`<lr-timeline scale="time" orientation="horizontal"><lr-timeline-item style="height:40px"></lr-timeline-item><lr-timeline-item style="height:60px"></lr-timeline-item></lr-timeline>`);
  await twoFrames(); await aTimeout(60);
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const before = Number.parseFloat(base.style.getPropertyValue('--_lr-timeline-content-height'));
  (el.children[0] as HTMLElement).style.height = '180px';
  await twoFrames(); await aTimeout(60);
  const after = Number.parseFloat(base.style.getPropertyValue('--_lr-timeline-content-height'));
  expect(after).to.be.greaterThan(before);
  el.orientation = 'vertical'; await el.updateComplete; await twoFrames(); await aTimeout(60);
  expect(base.style.getPropertyValue('--_lr-timeline-content-height')).to.equal('');
  expect(Number.parseFloat(base.style.getPropertyValue('--_lr-timeline-trailing-extent'))).to.be.at.least(0);
});
it('updates resize targets for a same-count slot replacement without a host-property update', async () => {
  const el = await fixture<LyraTimeline>(html`<lr-timeline scale="time"><lr-timeline-item></lr-timeline-item></lr-timeline>`);
  await twoFrames(); await aTimeout(60);
  const replacement = document.createElement('lr-timeline-item');
  el.children[0]!.replaceWith(replacement);
  await twoFrames();
  const probe = el as unknown as { geometryObservedItems: Set<Element> };
  expect(probe.geometryObservedItems.has(replacement)).to.equal(true);
});
it('bounds geometry reads to one changed entry in a 10000-item time projection', async () => {
  const el = await fixture<LyraTimeline>(html`<lr-timeline scale="time" orientation="horizontal"></lr-timeline>`);
  await twoFrames(); await aTimeout(60);
  const items = Array.from({ length: 10_000 }, () => document.createElement('div'));
  const probe = el as unknown as Probe & { invalidateTimeGeometry(item?: Element): void; scheduleTimeExtentMeasurement(): void };
  const original = probe.timelineItems;
  probe.timelineItems = () => items as unknown as LyraTimelineItem[];
  try {
    probe.scheduleTimeExtentMeasurement(); await twoFrames(); await aTimeout(60);
    let reads = 0;
    items.forEach(item => { const originalRead = item.getClientRects; item.getClientRects = function () { reads++; return originalRead.call(this); }; });
    probe.invalidateTimeGeometry(items[0]);
    probe.scheduleTimeExtentMeasurement(); await twoFrames();
    expect(reads).to.equal(1);
    recordScaleMeasurement('lr-timeline', '10000 time items one invalidation', { itemMeasurements: reads });
  } finally { probe.timelineItems = original; el.remove(); }
});
it('updates horizontal overflow and tab reachability after width-only item growth and shrink', async () => {
  const el = await fixture<LyraTimeline>(html`<lr-timeline scale="time" orientation="horizontal" style="--lr-timeline-time-extent:320px;height:100px"><lr-timeline-item style="width:80px;height:40px"></lr-timeline-item></lr-timeline>`);
  await twoFrames(); await aTimeout(60);
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  base.style.height = '100px';
  await twoFrames(); await aTimeout(60);
  const item = el.children[0] as HTMLElement;
  expect(base.hasAttribute('data-scroll-overflow')).to.equal(false);
  expect(base.tabIndex).to.equal(-1);
  item.style.width = '900px';
  await twoFrames(); await aTimeout(60);
  expect(base.scrollWidth).to.be.greaterThan(base.clientWidth);
  expect(base.hasAttribute('data-scroll-overflow')).to.equal(true);
  expect(base.tabIndex).to.equal(0);
  item.style.width = '80px';
  await twoFrames(); await aTimeout(60);
  expect(base.hasAttribute('data-scroll-overflow')).to.equal(false);
  expect(base.tabIndex).to.equal(-1);
});
