import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-timeline.js';
import '../../lr-timeline-item.js';
import type { LyraTimeline } from '../../lr-timeline.js';
import type { LyraTimelineItem } from '../../lr-timeline-item.js';
import { twoFrames } from '../../../../test/frames.js';

function parts(el: Element, selector: string): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>(selector)!;
}
const rect = (el: Element) => el.getBoundingClientRect();

async function build(attrs: string, width = 700, dir = 'ltr'): Promise<LyraTimeline> {
  const host = await fixture<HTMLElement>(html`<div dir=${dir} style=${`inline-size:${width}px`}></div>`);
  host.innerHTML = `<lr-timeline ${attrs} style="font-size:16px">
    <lr-timeline-item><span slot="opposite">Mon</span>First</lr-timeline-item>
    <lr-timeline-item><span slot="opposite">Tue</span>Second item with a bit more text</lr-timeline-item>
    <lr-timeline-item><span slot="opposite">Wed</span>Third</lr-timeline-item>
  </lr-timeline>`;
  const el = host.firstElementChild as LyraTimeline;
  await el.updateComplete;
  for (const item of el.children) await (item as LyraTimelineItem).updateComplete;
  await twoFrames();
  return el;
}
const items = (el: LyraTimeline) => [...el.children] as LyraTimelineItem[];
const marker = (item: LyraTimelineItem) => parts(item, '[part~="marker"]');
const content = (item: LyraTimelineItem) => parts(item, '[part~="content"]');
const opposite = (item: LyraTimelineItem) => parts(item, '[part~="opposite"]');

describe('lr-timeline wa-timeline mirror: container', () => {
  it('defaults the new members without changing the existing defaults', async () => {
    const el = await fixture<LyraTimeline>(html`<lr-timeline><lr-timeline-item>A</lr-timeline-item></lr-timeline>`);
    expect(el.markerPlacement).to.equal('start');
    expect(el.markerAlignment).to.equal('start');
    expect(el.label).to.equal('');
    expect(el.orientation).to.equal('vertical');
    expect(el.scale).to.equal('flow');
    expect(el.collision).to.equal('overlap');
  });

  it('reflects and normalizes marker-placement and marker-alignment, and accepts orientation=auto', async () => {
    const el = await fixture<LyraTimeline>(html`<lr-timeline marker-placement="alternate" marker-alignment="center" orientation="auto"></lr-timeline>`);
    expect(el.markerPlacement).to.equal('alternate');
    expect(el.markerAlignment).to.equal('center');
    expect(el.orientation).to.equal('auto');
    el.markerPlacement = 'end';
    await el.updateComplete;
    expect(el.getAttribute('marker-placement')).to.equal('end');
    el.setAttribute('marker-placement', 'bogus');
    await el.updateComplete;
    expect(el.markerPlacement).to.equal('start');
    el.setAttribute('orientation', 'diagonal');
    await el.updateComplete;
    expect(el.orientation).to.equal('vertical');
  });

  it('names the list from label, with a host aria-label winning and the localized default last', async () => {
    const labelled = await fixture<LyraTimeline>(html`<lr-timeline label="Order history"></lr-timeline>`);
    expect(parts(labelled, '[role="list"]').getAttribute('aria-label')).to.equal('Order history');
    const both = await fixture<LyraTimeline>(html`<lr-timeline label="Order history" aria-label="Host wins"></lr-timeline>`);
    expect(parts(both, '[role="list"]').getAttribute('aria-label')).to.equal('Host wins');
    const none = await fixture<LyraTimeline>(html`<lr-timeline></lr-timeline>`);
    expect(parts(none, '[role="list"]').getAttribute('aria-label')).to.equal('Timeline');
  });

  it('exposes the list as both the base and timeline parts', async () => {
    const el = await fixture<LyraTimeline>(html`<lr-timeline></lr-timeline>`);
    const list = parts(el, '[part~="timeline"]');
    expect(list === parts(el, '[part~="base"]')).to.equal(true);
    expect(list.getAttribute('role')).to.equal('list');
  });

  it('end placement puts the marker after the content (and swaps under RTL)', async () => {
    const ltr = await build('marker-placement="end"');
    const [a] = items(ltr);
    expect(rect(marker(a!)).left).to.be.greaterThan(rect(content(a!)).left);
    const rtl = await build('marker-placement="end"', 700, 'rtl');
    const [b] = items(rtl);
    expect(rect(marker(b!)).left).to.be.lessThan(rect(content(b!)).left);
  });

  it('alternate placement centers the rail and flips content sides', async () => {
    const el = await build('marker-placement="alternate"');
    const [a, b, c] = items(el);
    const mid = rect(el).left + rect(el).width / 2;
    for (const item of [a!, b!, c!]) {
      const m = rect(marker(item));
      expect(Math.abs(m.left + m.width / 2 - mid)).to.be.lessThan(2);
    }
    expect(rect(content(a!)).left).to.be.greaterThan(mid);
    expect(rect(content(b!)).right).to.be.lessThan(mid);
    expect(rect(content(c!)).left).to.be.greaterThan(mid);
    // opposite content takes the other column
    expect(rect(opposite(a!)).right).to.be.lessThan(mid);
    expect(rect(opposite(b!)).left).to.be.greaterThan(mid);
  });

  it('alternate placement mirrors under RTL', async () => {
    const el = await build('marker-placement="alternate"', 700, 'rtl');
    const [a, b] = items(el);
    const mid = rect(el).left + rect(el).width / 2;
    expect(rect(content(a!)).right).to.be.lessThan(mid);
    expect(rect(content(b!)).left).to.be.greaterThan(mid);
  });

  it('alternate placement falls back to the start layout under 30em', async () => {
    const el = await build('marker-placement="alternate"', 320);
    const [a, b] = items(el);
    expect(rect(marker(a!)).left).to.be.lessThan(rect(content(a!)).left);
    expect(rect(marker(b!)).left).to.be.lessThan(rect(content(b!)).left);
    expect(el.scrollWidth).to.be.at.most(320);
  });

  it('center alignment centers the marker on the item and keeps both rail halves', async () => {
    const el = await build('marker-alignment="center"');
    const [, b] = items(el);
    b!.querySelector('span')!.insertAdjacentHTML('afterend', '<div slot="description">A long description<br>over<br>several<br>lines</div>');
    await b!.updateComplete;
    await twoFrames();
    const m = rect(marker(b!));
    const c = rect(content(b!));
    const probe = document.createElement('div');
    probe.style.paddingBlockStart = 'var(--lr-space-l)';
    el.append(probe);
    const gap = parseFloat(getComputedStyle(probe).paddingBlockStart);
    probe.remove();
    const usableHeight = c.height - gap;
    expect(Math.abs(m.top + m.height / 2 - (c.top + usableHeight / 2))).to.be.lessThan(3);
    const rail = parts(b!, '[part~="rail"]');
    expect(getComputedStyle(rail).position).to.equal('absolute');
    expect(getComputedStyle(rail, '::before').content).to.not.equal('none');
    // first item draws no half above its marker; last draws none below
    expect(getComputedStyle(parts(items(el)[0]!, '[part~="rail"]'), '::before').display).to.equal('none');
    expect(getComputedStyle(parts(items(el)[2]!, '[part~="rail"]'), '::after').display).to.equal('none');
    expect(getComputedStyle(parts(items(el)[2]!, '[part~="rail"]'), '::before').display).to.not.equal('none');
  });

  it('start alignment keeps the rail a normal flex segment (no halves)', async () => {
    const el = await build('');
    const rail = parts(items(el)[0]!, '[part~="rail"]');
    expect(getComputedStyle(rail).position).to.equal('static');
    expect(getComputedStyle(rail, '::before').content).to.equal('none');
  });
});

describe('lr-timeline wa-timeline mirror: custom properties', () => {
  it('sizes markers from --lr-timeline-marker-size and --lr-timeline-icon-marker-size', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    host.innerHTML = `<lr-timeline style="--lr-timeline-marker-size:10px;--lr-timeline-icon-marker-size:30px">
      <lr-timeline-item>Plain</lr-timeline-item>
      <lr-timeline-item><span slot="icon">*</span>Icon</lr-timeline-item>
    </lr-timeline>`;
    const el = host.firstElementChild as LyraTimeline;
    for (const item of el.children) await (item as LyraTimelineItem).updateComplete;
    await twoFrames();
    const [plain, icon] = items(el);
    expect(rect(marker(plain!)).width).to.be.closeTo(10, 0.5);
    expect(rect(marker(icon!)).width).to.be.closeTo(30, 0.5);
  });

  it('keeps the marker size unchanged when no icon size is set', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    host.innerHTML = `<lr-timeline style="--lr-timeline-marker-size:14px"><lr-timeline-item><span slot="marker-icon">*</span>Icon</lr-timeline-item></lr-timeline>`;
    const el = host.firstElementChild as LyraTimeline;
    await (el.firstElementChild as LyraTimelineItem).updateComplete;
    await twoFrames();
    expect(rect(marker(items(el)[0]!)).width).to.be.closeTo(14, 0.5);
  });

  it('paints the connector from the connector aliases, which win over the rail properties', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    host.innerHTML = `<lr-timeline style="--lr-timeline-rail-width:2px;--lr-timeline-connector-width:5px;--lr-timeline-connector-color:rgb(255, 0, 0)">
      <lr-timeline-item>A</lr-timeline-item><lr-timeline-item>B</lr-timeline-item></lr-timeline>`;
    const el = host.firstElementChild as LyraTimeline;
    for (const item of el.children) await (item as LyraTimelineItem).updateComplete;
    await twoFrames();
    const rail = parts(items(el)[0]!, '[part~="rail"]');
    expect(rect(rail).width).to.be.closeTo(5, 0.5);
    expect(getComputedStyle(rail).backgroundColor).to.equal('rgb(255, 0, 0)');
  });

  it('opens a gap between the marker and the connector from --lr-timeline-connector-gap', async () => {
    const host = await fixture<HTMLElement>(html`<div></div>`);
    host.innerHTML = `<lr-timeline style="--lr-timeline-connector-gap:6px"><lr-timeline-item>A</lr-timeline-item><lr-timeline-item>B</lr-timeline-item></lr-timeline>`;
    const el = host.firstElementChild as LyraTimeline;
    for (const item of el.children) await (item as LyraTimelineItem).updateComplete;
    await twoFrames();
    const first = items(el)[0]!;
    expect(rect(parts(first, '[part~="rail"]')).top - rect(marker(first)).bottom).to.be.closeTo(6, 0.5);
  });
});

describe('lr-timeline-item wa-timeline-item mirror', () => {
  it('has with-opposite / with-icon false by default', async () => {
    const item = await fixture<LyraTimelineItem>(html`<lr-timeline-item>A</lr-timeline-item>`);
    expect(item.withOpposite).to.equal(false);
    expect(item.withIcon).to.equal(false);
    expect(opposite(item).hidden).to.equal(true);
  });

  it('renders the opposite part when the slot has content and hides it otherwise', async () => {
    const item = await fixture<LyraTimelineItem>(html`<lr-timeline-item><span slot="opposite">Mon</span>A</lr-timeline-item>`);
    await twoFrames();
    expect(opposite(item).hidden).to.equal(false);
    expect((parts(item, 'slot[name="opposite"]') as HTMLSlotElement).assignedNodes().length).to.equal(1);
  });

  it('with-opposite renders the opposite column before slot content exists', async () => {
    const item = await fixture<LyraTimelineItem>(html`<lr-timeline-item with-opposite>A</lr-timeline-item>`);
    expect(item.withOpposite).to.equal(true);
    expect(opposite(item).hidden).to.equal(false);
  });

  it('places the opposite content before the rail, at a fixed share so rails line up', async () => {
    const el = await build('');
    const [a, b] = items(el);
    expect(rect(opposite(a!)).right).to.be.at.most(rect(marker(a!)).left);
    expect(rect(marker(a!)).left).to.be.closeTo(rect(marker(b!)).left, 1);
  });

  it('puts the opposite content above the marker in a horizontal timeline', async () => {
    const el = await build('orientation="horizontal"');
    const a = items(el)[0]!;
    expect(rect(opposite(a)).bottom).to.be.at.most(rect(marker(a)).top + 1);
  });

  it('treats the icon slot as an alias of marker-icon', async () => {
    const item = await fixture<LyraTimelineItem>(html`<lr-timeline-item><span slot="icon">*</span>A</lr-timeline-item>`);
    await twoFrames();
    expect(marker(item).hasAttribute('data-has-icon')).to.equal(true);
    expect((parts(item, 'slot[name="icon"]') as HTMLSlotElement).assignedNodes().length).to.equal(1);
    const legacy = await fixture<LyraTimelineItem>(html`<lr-timeline-item><span slot="marker-icon">*</span>A</lr-timeline-item>`);
    await twoFrames();
    expect(marker(legacy).hasAttribute('data-has-icon')).to.equal(true);
  });

  it('with-icon draws the icon marker before slot content exists', async () => {
    const item = await fixture<LyraTimelineItem>(html`<lr-timeline-item with-icon>A</lr-timeline-item>`);
    expect(marker(item).hasAttribute('data-has-icon')).to.equal(true);
    const plain = await fixture<LyraTimelineItem>(html`<lr-timeline-item>A</lr-timeline-item>`);
    expect(marker(plain).hasAttribute('data-has-icon')).to.equal(false);
  });

  it('exposes the connector and timeline-item parts as aliases', async () => {
    const item = await fixture<LyraTimelineItem>(html`<lr-timeline-item>A</lr-timeline-item>`);
    expect(parts(item, '[part~="connector"]') === parts(item, '[part~="rail"]')).to.equal(true);
    expect(parts(item, '[part~="timeline-item"]') === parts(item, '[part~="base"]')).to.equal(true);
  });
});

describe('lr-timeline scale and collision regression', () => {
  it('keeps scale="time" items absolutely positioned at their proportion with the new members unset', async () => {
    const el = await fixture<LyraTimeline>(html`<lr-timeline scale="time" style="--lr-timeline-time-extent:200px">
      <lr-timeline-item .timestamp=${'2024-01-01'}>A</lr-timeline-item>
      <lr-timeline-item .timestamp=${'2024-01-03'}>B</lr-timeline-item>
      <lr-timeline-item .timestamp=${'2024-01-05'}>C</lr-timeline-item>
    </lr-timeline>`);
    for (const item of el.children) await (item as LyraTimelineItem).updateComplete;
    await twoFrames();
    const [a, b, c] = items(el);
    expect(getComputedStyle(b!).position).to.equal('absolute');
    const top = (i: Element) => rect(i).top - rect(el).top;
    expect(top(a!)).to.be.closeTo(0, 2);
    expect(top(b!)).to.be.closeTo(100, 14);
    expect(top(c!)).to.be.closeTo(200, 40);
  });

  it('keeps collision="stack" lanes indenting coincident items', async () => {
    const el = await fixture<LyraTimeline>(html`<lr-timeline scale="time" collision="stack" style="--lr-timeline-time-extent:200px">
      <lr-timeline-item .timestamp=${'2024-01-01'}>A</lr-timeline-item>
      <lr-timeline-item .timestamp=${'2024-01-01'}>B</lr-timeline-item>
      <lr-timeline-item .timestamp=${'2024-02-01'}>C</lr-timeline-item>
    </lr-timeline>`);
    for (const item of el.children) await (item as LyraTimelineItem).updateComplete;
    await twoFrames();
    const [a, b] = items(el);
    expect(rect(b!).left).to.be.greaterThan(rect(a!).left + 4);
  });
});
