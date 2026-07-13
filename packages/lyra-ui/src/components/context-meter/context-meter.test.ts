import { fixture, expect, html } from '@open-wc/testing';
import './context-meter.js';
import type { LyraContextMeter, ContextMeterSegment } from './context-meter.js';

const SEGMENTS: ContextMeterSegment[] = [
  { label: 'System prompt', value: 2000, tone: 'neutral' },
  { label: 'History', value: 5000, tone: 'brand' },
  { label: 'Tools', value: 1000, tone: 'warning' },
];

it('renders a fully-unfilled track with no segment parts when segments is empty', async () => {
  const el = (await fixture(html`<lyra-context-meter total="100"></lyra-context-meter>`)) as LyraContextMeter;
  expect(el.shadowRoot!.querySelectorAll('[part="segment"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="track"]')).to.exist;
});

it('renders a fully-unfilled track with no segment parts when total is 0', async () => {
  const el = (await fixture(html`<lyra-context-meter></lyra-context-meter>`)) as LyraContextMeter;
  el.segments = SEGMENTS;
  await el.updateComplete;
  expect(el.total).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('[part="segment"]').length).to.equal(0);
});

it('renders one segment part per entry, each sized proportionally to value/total', async () => {
  const el = (await fixture(html`<lyra-context-meter total="10000"></lyra-context-meter>`)) as LyraContextMeter;
  el.segments = SEGMENTS;
  await el.updateComplete;

  const segments = el.shadowRoot!.querySelectorAll('[part="segment"]');
  expect(segments.length).to.equal(3);
  // The browser re-serializes the percentage (dropping the fixed-point trailing
  // zeros this component writes), so compare the parsed number, not the raw string.
  expect(parseFloat((segments[0] as HTMLElement).style.flexBasis)).to.be.closeTo(20, 0.01);
  expect(parseFloat((segments[1] as HTMLElement).style.flexBasis)).to.be.closeTo(50, 0.01);
  expect(parseFloat((segments[2] as HTMLElement).style.flexBasis)).to.be.closeTo(10, 0.01);
});

it('defaults an unspecified segment tone to neutral and carries the given tone through as data-tone', async () => {
  const el = (await fixture(html`<lyra-context-meter total="100"></lyra-context-meter>`)) as LyraContextMeter;
  el.segments = [
    { label: 'a', value: 10 },
    { label: 'b', value: 10, tone: 'danger' },
  ];
  await el.updateComplete;

  const segments = el.shadowRoot!.querySelectorAll('[part="segment"]');
  expect(segments[0].getAttribute('data-tone')).to.equal('neutral');
  expect(segments[1].getAttribute('data-tone')).to.equal('danger');
});

it('clamps a segments array that sums to more than total instead of overflowing past 100%', async () => {
  const el = (await fixture(html`<lyra-context-meter total="100"></lyra-context-meter>`)) as LyraContextMeter;
  el.segments = [
    { label: 'a', value: 80 },
    { label: 'b', value: 80 },
  ];
  await el.updateComplete;

  const segments = el.shadowRoot!.querySelectorAll('[part="segment"]');
  const totalBasis = Array.from(segments).reduce(
    (sum, s) => sum + parseFloat((s as HTMLElement).style.flexBasis),
    0,
  );
  expect(totalBasis).to.be.closeTo(100, 0.01);
  // the second, overflowing segment is clamped to whatever's left (20%), not its own 80%
  expect(parseFloat((segments[1] as HTMLElement).style.flexBasis)).to.be.closeTo(20, 0.01);
});

it('clamps the aria-label summary to total, not the raw segment sum, when segments overflow past capacity', async () => {
  const el = (await fixture(html`<lyra-context-meter total="100"></lyra-context-meter>`)) as LyraContextMeter;
  el.segments = [
    { label: 'a', value: 80 },
    { label: 'b', value: 80 },
  ];
  await el.updateComplete;

  // Raw sum is 160, but the accessible summary must report the same clamped
  // 100 the visual fill is capped to, not an impossible "160 of 100 used".
  expect(el.getAttribute('aria-label')).to.equal('100 of 100 used');
});

it('treats a negative or NaN segment value as 0 instead of producing a negative width', async () => {
  const el = (await fixture(html`<lyra-context-meter total="100"></lyra-context-meter>`)) as LyraContextMeter;
  el.segments = [
    { label: 'a', value: -10 },
    { label: 'b', value: NaN },
  ];
  await el.updateComplete;

  const segments = el.shadowRoot!.querySelectorAll('[part="segment"]');
  segments.forEach((s) => {
    const basis = parseFloat((s as HTMLElement).style.flexBasis);
    expect(basis).to.equal(0);
  });
});

it('computes a "used of total" aria-label summary from the segment sum, ignoring negative entries', async () => {
  const el = (await fixture(html`<lyra-context-meter total="10000"></lyra-context-meter>`)) as LyraContextMeter;
  el.segments = SEGMENTS;
  await el.updateComplete;

  expect(el.getAttribute('role')).to.equal('img');
  expect(el.getAttribute('aria-label')).to.equal('8,000 of 10,000 used');
});

it('prefixes the aria-label summary with the label when provided', async () => {
  const el = (await fixture(
    html`<lyra-context-meter total="10000" label="128K context window"></lyra-context-meter>`,
  )) as LyraContextMeter;
  el.segments = SEGMENTS;
  await el.updateComplete;

  expect(el.getAttribute('aria-label')).to.equal('128K context window — 8,000 of 10,000 used');
});

it('falls back to a used-only summary when total is 0 or unset', async () => {
  const el = (await fixture(html`<lyra-context-meter></lyra-context-meter>`)) as LyraContextMeter;
  el.segments = [{ label: 'a', value: 5 }];
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('5 used');
});

describe('summary localization', () => {
  it('localizes the "used of total" summary via this.localize() when .strings overrides contextMeterUsedOfTotal', async () => {
    const el = (await fixture(html`
      <lyra-context-meter total="10000" .strings=${{ contextMeterUsedOfTotal: '{used} sur {total} utilisés' }}
      ></lyra-context-meter>
    `)) as LyraContextMeter;
    el.segments = SEGMENTS;
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.equal('8,000 sur 10,000 utilisés');
  });

  it('localizes the used-only summary via this.localize() when .strings overrides contextMeterUsed', async () => {
    const el = (await fixture(html`
      <lyra-context-meter .strings=${{ contextMeterUsed: '{used} utilisés' }}></lyra-context-meter>
    `)) as LyraContextMeter;
    el.segments = [{ label: 'a', value: 5 }];
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.equal('5 utilisés');
  });
});

it('renders the label part visibly, hidden from the accessibility tree since the host aria-label already carries it', async () => {
  const el = (await fixture(
    html`<lyra-context-meter total="100" label="Token budget"></lyra-context-meter>`,
  )) as LyraContextMeter;
  const label = el.shadowRoot!.querySelector('[part="label"]')!;
  expect(label.textContent).to.equal('Token budget');
  expect(label.getAttribute('aria-hidden')).to.equal('true');
});

it('omits the label part entirely when label is unset', async () => {
  const el = (await fixture(html`<lyra-context-meter total="100"></lyra-context-meter>`)) as LyraContextMeter;
  expect(el.shadowRoot!.querySelector('[part="label"]')).to.not.exist;
});

it('defaults to and reflects the bar variant, rendering a div base', async () => {
  const el = (await fixture(html`<lyra-context-meter total="100"></lyra-context-meter>`)) as LyraContextMeter;
  expect(el.variant).to.equal('bar');
  expect(el.getAttribute('variant')).to.equal('bar');
  expect(el.shadowRoot!.querySelector('div[part="base"]')).to.exist;
});

it('renders an svg base with circle segments in ring mode, using stroke-dasharray/-dashoffset geometry', async () => {
  const el = (await fixture(
    html`<lyra-context-meter variant="ring" total="100"></lyra-context-meter>`,
  )) as LyraContextMeter;
  el.segments = [
    { label: 'a', value: 25 },
    { label: 'b', value: 25 },
  ];
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('svg[part="base"]')).to.exist;
  const circles = el.shadowRoot!.querySelectorAll('[part="segment"]');
  expect(circles.length).to.equal(2);

  const circumference = 2 * Math.PI * 40;
  // First segment starts at offset 0 (the top of the ring, via the -90deg rotation).
  expect(Number(circles[0].getAttribute('stroke-dashoffset'))).to.equal(-0);
  const [len0] = circles[0].getAttribute('stroke-dasharray')!.split(' ').map(Number);
  expect(len0).to.be.closeTo(circumference * 0.25, 0.01);

  // Second segment picks up exactly where the first left off.
  expect(Number(circles[1].getAttribute('stroke-dashoffset'))).to.be.closeTo(-circumference * 0.25, 0.01);
});

it('is accessible with an empty/default meter', async () => {
  const el = (await fixture(html`<lyra-context-meter total="100"></lyra-context-meter>`)) as LyraContextMeter;
  await expect(el).to.be.accessible();
});

it('is accessible with a populated bar meter', async () => {
  const el = (await fixture(
    html`<lyra-context-meter total="10000" label="128K context window"></lyra-context-meter>`,
  )) as LyraContextMeter;
  el.segments = SEGMENTS;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible with a populated ring meter', async () => {
  const el = (await fixture(
    html`<lyra-context-meter variant="ring" total="10000" label="Context"></lyra-context-meter>`,
  )) as LyraContextMeter;
  el.segments = SEGMENTS;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
