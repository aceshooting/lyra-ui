import { fixture, expect, html } from '@open-wc/testing';
import './context-meter.js';
import type { LyraContextMeter, ContextMeterSegment } from './context-meter.js';

const SEGMENTS: ContextMeterSegment[] = [
  { label: 'System prompt', value: 2000, tone: 'neutral' },
  { label: 'History', value: 5000, tone: 'brand' },
  { label: 'Tools', value: 1000, tone: 'warning' },
];

it('renders a fully-unfilled track with no segment parts when segments is empty', async () => {
  const el = (await fixture(html`<lr-context-meter total="100"></lr-context-meter>`)) as LyraContextMeter;
  expect(el.shadowRoot!.querySelectorAll('[part="segment"]').length).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="track"]')).to.exist;
});

it('omits malformed and accessor-backed segments while retaining later descriptor-safe segments', async () => {
  let accessorReads = 0;
  const accessorBacked: Record<string, unknown> = { label: 'Accessor backed' };
  Object.defineProperty(accessorBacked, 'value', {
    enumerable: true,
    get(): never {
      accessorReads += 1;
      throw new Error('do not invoke segment accessors');
    },
  });
  const el = (await fixture(html`<lr-context-meter total="100"></lr-context-meter>`)) as LyraContextMeter;
  el.segments = [
    { label: 'Malformed', value: '25' as unknown as number },
    accessorBacked as unknown as ContextMeterSegment,
    { label: 'Safe', value: 25, tone: 'success' },
  ];
  await el.updateComplete;

  expect(accessorReads).to.equal(0);
  expect([...el.shadowRoot!.querySelectorAll('[part="segment-item"]')].map((item) => item.textContent?.trim()))
    .to.deep.equal(['Safe: 25']);
});

it('renders a fully-unfilled track with no segment parts when total is 0', async () => {
  const el = (await fixture(html`<lr-context-meter></lr-context-meter>`)) as LyraContextMeter;
  el.segments = SEGMENTS;
  await el.updateComplete;
  expect(el.total).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('[part="segment"]').length).to.equal(0);
});

it('renders one segment part per entry, each sized proportionally to value/total', async () => {
  const el = (await fixture(html`<lr-context-meter total="10000"></lr-context-meter>`)) as LyraContextMeter;
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
  const el = (await fixture(html`<lr-context-meter total="100"></lr-context-meter>`)) as LyraContextMeter;
  el.segments = [
    { label: 'a', value: 10 },
    { label: 'b', value: 10, tone: 'danger' },
  ];
  await el.updateComplete;

  const segments = el.shadowRoot!.querySelectorAll('[part="segment"]');
  expect(segments[0]!.getAttribute('data-tone')).to.equal('neutral');
  expect(segments[1]!.getAttribute('data-tone')).to.equal('danger');
});

it('accepts an arbitrary safe color per segment without changing semantic tone behavior', async () => {
  const el = (await fixture(html`<lr-context-meter total="100"></lr-context-meter>`)) as LyraContextMeter;
  el.segments = [
    { label: 'features', value: 25, tone: 'brand', color: '#123456' },
    { label: 'bugs', value: 25, tone: 'danger', color: 'oklch(60% 0.2 30)' },
  ];
  await el.updateComplete;

  const segments = el.shadowRoot!.querySelectorAll('[part="segment"]');
  expect((segments[0] as HTMLElement).style.getPropertyValue('--lr-context-meter-segment-color')).to.equal('#123456');
  expect((segments[1] as HTMLElement).style.getPropertyValue('--lr-context-meter-segment-color')).to.equal('oklch(60% 0.2 30)');
  expect(segments[0]!.getAttribute('data-tone')).to.equal('brand');
});

it('rejects unsafe arbitrary segment colors', async () => {
  const el = (await fixture(html`<lr-context-meter total="100"></lr-context-meter>`)) as LyraContextMeter;
  el.segments = [{ label: 'bad', value: 10, color: 'url(https://example.test/x)' }];
  await el.updateComplete;

  expect((el.shadowRoot!.querySelector('[part="segment"]') as HTMLElement).style.getPropertyValue('--lr-context-meter-segment-color')).to.equal('');
});

it('clamps a segments array that sums to more than total instead of overflowing past 100%', async () => {
  const el = (await fixture(html`<lr-context-meter total="100"></lr-context-meter>`)) as LyraContextMeter;
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
  const el = (await fixture(html`<lr-context-meter total="100"></lr-context-meter>`)) as LyraContextMeter;
  el.segments = [
    { label: 'a', value: 80 },
    { label: 'b', value: 80 },
  ];
  await el.updateComplete;

  // Raw sum is 160, but the accessible summary must report the same clamped
  // 100 the visual fill is capped to, not an impossible "160 of 100 used".
  expect(el.shadowRoot!.querySelector('[part="semantic"]')!.getAttribute('aria-label')).to.equal('100 of 100 used');
});

it('normalizes a negative or NaN segment value once for geometry and semantic text', async () => {
  const el = (await fixture(html`<lr-context-meter total="100"></lr-context-meter>`)) as LyraContextMeter;
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
  expect([...segments].map((segment) => segment.getAttribute('title'))).to.deep.equal(['a: 0', 'b: 0']);
  expect(
    [...el.shadowRoot!.querySelectorAll('[part="segment-item"]')].map((item) => item.textContent?.trim()),
  ).to.deep.equal(['a: 0', 'b: 0']);
});

it('computes a "used of total" aria-label summary from the segment sum, ignoring negative entries', async () => {
  const el = (await fixture(html`<lr-context-meter total="10000"></lr-context-meter>`)) as LyraContextMeter;
  el.segments = SEGMENTS;
  await el.updateComplete;

  const semantic = el.shadowRoot!.querySelector('[part="semantic"]')!;
  expect(semantic.getAttribute('role')).to.equal('meter');
  expect(semantic.getAttribute('aria-label')).to.equal('8,000 of 10,000 used');
  expect(semantic.getAttribute('aria-valuenow')).to.equal('8000');
  expect(semantic.getAttribute('aria-valuemin')).to.equal('0');
  expect(semantic.getAttribute('aria-valuemax')).to.equal('10000');
});

it('prefixes the aria-label summary with the label when provided', async () => {
  const el = (await fixture(
    html`<lr-context-meter total="10000" label="128K context window"></lr-context-meter>`,
  )) as LyraContextMeter;
  el.segments = SEGMENTS;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="semantic"]')!.getAttribute('aria-label')).to.equal(
    '128K context window: 8,000 of 10,000 used',
  );
});

it('keeps an explicit host name on the host without duplicating it on the meter owner', async () => {
  const el = (await fixture(html`
    <lr-context-meter aria-label="Context window occupancy" total="10000"></lr-context-meter>
  `)) as LyraContextMeter;
  el.segments = SEGMENTS;
  await el.updateComplete;

  const semantic = el.shadowRoot!.querySelector('[part="semantic"]')!;
  expect(el.getAttribute('aria-label')).to.equal('Context window occupancy');
  expect(semantic.getAttribute('aria-label')).to.equal('8,000 of 10,000 used');
  expect(semantic.getAttribute('role')).to.equal('meter');
});

it('does not copy late host aria-label changes onto the meter semantic owner', async () => {
  const el = (await fixture(html`<lr-context-meter total="100"></lr-context-meter>`)) as LyraContextMeter;
  el.segments = [{ label: 'Prompt', value: 25 }];
  await el.updateComplete;

  const semantic = () => el.shadowRoot!.querySelector('[part="semantic"]')!;
  expect(semantic().getAttribute('aria-label')).to.equal('25 of 100 used');

  el.setAttribute('aria-label', 'Custom occupancy');
  await el.updateComplete;
  expect(semantic().getAttribute('aria-label')).to.equal('25 of 100 used');

  el.setAttribute('aria-label', 'Replacement occupancy');
  await el.updateComplete;
  expect(semantic().getAttribute('aria-label')).to.equal('25 of 100 used');

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(semantic().getAttribute('aria-label')).to.equal('25 of 100 used');
});

it('exposes each segment label and locale-formatted count in an accessible breakdown', async () => {
  const el = (await fixture(html`<lr-context-meter locale="de-DE" total="10000"></lr-context-meter>`)) as LyraContextMeter;
  el.segments = SEGMENTS;
  await el.updateComplete;

  const items = Array.from(el.shadowRoot!.querySelectorAll('[part="segment-item"]')).map((item) =>
    item.textContent?.trim(),
  );
  expect(items).to.deep.equal(['System prompt: 2.000', 'History: 5.000', 'Tools: 1.000']);
});

it('uses non-range semantics when total is unknown instead of exposing an implicit meter maximum', async () => {
  const el = (await fixture(html`<lr-context-meter></lr-context-meter>`)) as LyraContextMeter;
  el.segments = [{ label: 'Prompt', value: 5 }];
  await el.updateComplete;

  const semantic = el.shadowRoot!.querySelector('[part="semantic"]')!;
  expect(semantic.getAttribute('role')).to.equal('group');
  expect(semantic.getAttribute('aria-label')).to.equal('5 used');
  expect(semantic.hasAttribute('aria-valuenow')).to.equal(false);
  expect(semantic.hasAttribute('aria-valuemin')).to.equal(false);
  expect(semantic.hasAttribute('aria-valuemax')).to.equal(false);
});

it('keeps accumulated segment totals finite when individually finite values overflow', async () => {
  const el = (await fixture(html`<lr-context-meter></lr-context-meter>`)) as LyraContextMeter;
  el.segments = [
    { label: 'A', value: Number.MAX_VALUE },
    { label: 'B', value: Number.MAX_VALUE },
  ];
  await el.updateComplete;

  const semantic = el.shadowRoot!.querySelector('[part="semantic"]')!;
  expect(Number.isFinite(Number(semantic.getAttribute('aria-label')!.replaceAll(/[^\d.-]/g, '')))).to.equal(true);
  expect(semantic.getAttribute('aria-label')).to.not.contain('Infinity');
});

it('formats its generated summary with the effective locale', async () => {
  const el = (await fixture(html`
    <lr-context-meter locale="de-DE" total="10000"></lr-context-meter>
  `)) as LyraContextMeter;
  el.segments = SEGMENTS;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="semantic"]')!.getAttribute('aria-label')).to.equal(
    '8.000 of 10.000 used',
  );
});

it('falls back to a used-only summary when total is 0 or unset', async () => {
  const el = (await fixture(html`<lr-context-meter></lr-context-meter>`)) as LyraContextMeter;
  el.segments = [{ label: 'a', value: 5 }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="semantic"]')!.getAttribute('aria-label')).to.equal('5 used');
});

describe('summary localization', () => {
  it('localizes the "used of total" summary via this.localize() when .strings overrides contextMeterUsedOfTotal', async () => {
    const el = (await fixture(html`
      <lr-context-meter total="10000" .strings=${{ contextMeterUsedOfTotal: '{used} sur {total} utilisés' }}
      ></lr-context-meter>
    `)) as LyraContextMeter;
    el.segments = SEGMENTS;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="semantic"]')!.getAttribute('aria-label')).to.equal(
      '8,000 sur 10,000 utilisés',
    );
  });

  it('localizes the used-only summary via this.localize() when .strings overrides contextMeterUsed', async () => {
    const el = (await fixture(html`
      <lr-context-meter .strings=${{ contextMeterUsed: '{used} utilisés' }}></lr-context-meter>
    `)) as LyraContextMeter;
    el.segments = [{ label: 'a', value: 5 }];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="semantic"]')!.getAttribute('aria-label')).to.equal('5 utilisés');
  });

  it('lets a locale reorder the visible label and aggregate summary as one message', async () => {
    const el = (await fixture(html`
      <lr-context-meter
        total="10000"
        label="Budget"
        .strings=${{ contextMeterLabeledSummary: '{summary} — {label}' }}
      ></lr-context-meter>
    `)) as LyraContextMeter;
    el.segments = SEGMENTS;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="semantic"]')!.getAttribute('aria-label')).to.equal(
      '8,000 of 10,000 used — Budget',
    );
  });

  it('builds segment titles from the contextMeterSegmentLabel template, so a locale controls label/count order', async () => {
    const el = (await fixture(html`<lr-context-meter total="10000"></lr-context-meter>`)) as LyraContextMeter;
    el.segments = SEGMENTS;
    await el.updateComplete;
    const segments = el.shadowRoot!.querySelectorAll('[part="segment"]');
    expect(segments[0]!.getAttribute('title')).to.equal('System prompt: 2,000');

    // reorder the placeholders to prove the title is interpolated, not the
    // label concatenated with the formatted count
    el.strings = { contextMeterSegmentLabel: '{count} — {label}' };
    await el.updateComplete;
    const reordered = el.shadowRoot!.querySelectorAll('[part="segment"]');
    expect(reordered[0]!.getAttribute('title')).to.equal('2,000 — System prompt');
  });
});

it('renders the label part visibly, hidden from the accessibility tree since the host aria-label already carries it', async () => {
  const el = (await fixture(
    html`<lr-context-meter total="100" label="Token budget"></lr-context-meter>`,
  )) as LyraContextMeter;
  const label = el.shadowRoot!.querySelector('[part="label"]')!;
  expect(label.textContent).to.equal('Token budget');
  expect(label.getAttribute('aria-hidden')).to.equal('true');
});

it('omits the label part entirely when label is unset', async () => {
  const el = (await fixture(html`<lr-context-meter total="100"></lr-context-meter>`)) as LyraContextMeter;
  expect((el.shadowRoot!.querySelector('[part="label"]')) == null).to.be.true;
});

it('defaults to and reflects the bar shape, rendering a div base', async () => {
  const el = (await fixture(html`<lr-context-meter total="100"></lr-context-meter>`)) as LyraContextMeter;
  expect(el.shape).to.equal('bar');
  expect(el.getAttribute('shape')).to.equal('bar');
  expect(el.shadowRoot!.querySelector('div[part="base"]')).to.exist;
});

it('normalizes and reflects a foreign shape token to bar', async () => {
  const el = (await fixture(
    html`<lr-context-meter shape="triangle" total="100"></lr-context-meter>`,
  )) as LyraContextMeter;
  await el.updateComplete;
  expect(el.shape).to.equal('bar');
  expect(el.getAttribute('shape')).to.equal('bar');
  expect(el.shadowRoot!.querySelector('div[part="base"]')).to.exist;
});

it('renders an svg base with circle segments in ring mode, using stroke-dasharray/-dashoffset geometry', async () => {
  const el = (await fixture(
    html`<lr-context-meter shape="ring" total="100"></lr-context-meter>`,
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
  expect(Number(circles[0]!.getAttribute('stroke-dashoffset'))).to.equal(-0);
  const [len0] = circles[0]!.getAttribute('stroke-dasharray')!.split(' ').map(Number);
  expect(len0).to.be.closeTo(circumference * 0.25, 0.01);

  // Second segment picks up exactly where the first left off.
  expect(Number(circles[1]!.getAttribute('stroke-dashoffset'))).to.be.closeTo(-circumference * 0.25, 0.01);
});

it('is accessible with an empty/default meter', async () => {
  const el = (await fixture(html`<lr-context-meter total="100"></lr-context-meter>`)) as LyraContextMeter;
  await expect(el).to.be.accessible();
});

it('is accessible with a populated bar meter', async () => {
  const el = (await fixture(
    html`<lr-context-meter total="10000" label="128K context window"></lr-context-meter>`,
  )) as LyraContextMeter;
  el.segments = SEGMENTS;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible with a populated ring meter', async () => {
  const el = (await fixture(
    html`<lr-context-meter shape="ring" total="10000" label="Context"></lr-context-meter>`,
  )) as LyraContextMeter;
  el.segments = SEGMENTS;
  await el.updateComplete;
  // The ring's segments are stroke-only circles (RADIUS 40, STROKE 12 -> inner edge at radius 34),
  // so the centered `aria-hidden` label sits well inside the untouched hole, never overlapping a
  // colored stroke. On WebKit specifically, axe still misattributes a segment's stroke color as
  // the label's background (reproducibly: contrast 1.26 against a segment tone that isn't actually
  // behind the text) -- a known axe/SVG false positive, not a real contrast defect. The sibling
  // "populated bar meter" test above still exercises color-contrast for the real, non-decorative
  // label of that variant.
  await expect(el).to.be.accessible({ ignoredRules: ['color-contrast'] });
});

it('can shrink to a 320px allocation with a long visible label', async () => {
  const wrapper = await fixture(html`
    <div style="display: flex; inline-size: 320px;">
      <lr-context-meter
        total="100"
        label="A deliberately long translated context-window occupancy label"
      ></lr-context-meter>
    </div>
  `);
  const el = wrapper.querySelector('lr-context-meter') as LyraContextMeter;

  expect(getComputedStyle(el).minInlineSize).to.equal('0px');
  expect(el.getBoundingClientRect().width).to.be.at.most(320);
});

it('bounds a long ring caption inside the ring in LTR and RTL while keeping the full semantic label', async () => {
  const label = 'A deliberately long translated context-window occupancy label without truncating semantics';
  for (const direction of ['ltr', 'rtl'] as const) {
    const el = (await fixture(html`
      <lr-context-meter dir=${direction} shape="ring" total="100" .label=${label}></lr-context-meter>
    `)) as LyraContextMeter;
    const svg = el.shadowRoot!.querySelector('svg[part="base"]') as SVGElement;
    const caption = el.shadowRoot!.querySelector('[part="label"]') as SVGForeignObjectElement;
    const svgRect = svg.getBoundingClientRect();
    const captionRect = caption.getBoundingClientRect();
    expect(captionRect.left).to.be.at.least(svgRect.left - 1);
    expect(captionRect.right).to.be.at.most(svgRect.right + 1);
    expect(captionRect.top).to.be.at.least(svgRect.top - 1);
    expect(captionRect.bottom).to.be.at.most(svgRect.bottom + 1);
    expect(el.shadowRoot!.querySelector('[part="semantic"]')!.getAttribute('aria-label')).to.contain(label);
  }
});

describe('showLegend', () => {
  const legend = (el: LyraContextMeter) =>
    el.shadowRoot!.querySelector('[part="legend"]') as HTMLElement | null;

  it('renders no legend by default', async () => {
    const el = (await fixture(
      html`<lr-context-meter total="10000"></lr-context-meter>`,
    )) as LyraContextMeter;
    el.segments = SEGMENTS;
    await el.updateComplete;
    expect(legend(el) === null).to.equal(true);
    expect(el.showLegend).to.equal(false);
  });

  it('renders one swatch/label pair per segment when show-legend is set', async () => {
    const el = (await fixture(
      html`<lr-context-meter show-legend total="10000"></lr-context-meter>`,
    )) as LyraContextMeter;
    el.segments = SEGMENTS;
    await el.updateComplete;
    const items = el.shadowRoot!.querySelectorAll('[part="legend-item"]');
    expect(items.length).to.equal(3);
    expect(
      [...el.shadowRoot!.querySelectorAll('[part="legend-label"]')].map((n) =>
        n.textContent!.trim(),
      ),
    ).to.deep.equal(['System prompt', 'History', 'Tools']);
    expect(el.shadowRoot!.querySelectorAll('[part="legend-swatch"]').length).to.equal(3);
  });

  it('paints each swatch with the same resolved tone or color the segment uses', async () => {
    const el = (await fixture(
      html`<lr-context-meter show-legend total="10000"></lr-context-meter>`,
    )) as LyraContextMeter;
    el.segments = [
      { label: 'Brand', value: 1000, tone: 'brand' },
      { label: 'Custom', value: 1000, color: 'rgb(1, 2, 3)' },
    ];
    await el.updateComplete;
    const swatches = [...el.shadowRoot!.querySelectorAll('[part="legend-swatch"]')] as HTMLElement[];
    const segments = [...el.shadowRoot!.querySelectorAll('[part="segment"]')] as HTMLElement[];
    expect(getComputedStyle(swatches[0]!).backgroundColor).to.equal(
      getComputedStyle(segments[0]!).backgroundColor,
    );
    expect(getComputedStyle(swatches[1]!).backgroundColor).to.equal('rgb(1, 2, 3)');
  });

  it('rejects an unsafe segment color in the legend swatch, exactly as the segment does', async () => {
    const el = (await fixture(
      html`<lr-context-meter show-legend total="10000"></lr-context-meter>`,
    )) as LyraContextMeter;
    el.segments = [{ label: 'Unsafe', value: 1000, color: 'url("data:image/svg+xml,<svg/>")' }];
    await el.updateComplete;
    const swatch = el.shadowRoot!.querySelector('[part="legend-swatch"]') as HTMLElement;
    expect(swatch.style.getPropertyValue('--lr-context-meter-segment-color')).to.equal('');
  });

  it('keeps the legend out of the accessibility tree, since the sr-only list already names it', async () => {
    const el = (await fixture(
      html`<lr-context-meter show-legend total="10000" label="Context"></lr-context-meter>`,
    )) as LyraContextMeter;
    el.segments = SEGMENTS;
    await el.updateComplete;
    expect(legend(el)!.getAttribute('aria-hidden')).to.equal('true');
    await expect(el).to.be.accessible();
  });

  it('renders the legend below the ring variant without clipping it', async () => {
    const el = (await fixture(
      html`<lr-context-meter show-legend shape="ring" total="10000"></lr-context-meter>`,
    )) as LyraContextMeter;
    el.segments = SEGMENTS;
    await el.updateComplete;
    const legendBox = legend(el)!.getBoundingClientRect();
    const svgBox = (el.shadowRoot!.querySelector('svg[part="base"]') as SVGElement)
      .getBoundingClientRect();
    expect(legendBox.height).to.be.greaterThan(0);
    expect(legendBox.top).to.be.at.least(svgBox.bottom - 1);
    expect(el.getBoundingClientRect().bottom).to.be.at.least(legendBox.bottom - 1);
  });

  it('reflects show-legend both ways', async () => {
    const el = (await fixture(
      html`<lr-context-meter total="10000"></lr-context-meter>`,
    )) as LyraContextMeter;
    el.showLegend = true;
    await el.updateComplete;
    expect(el.hasAttribute('show-legend')).to.equal(true);
    el.showLegend = false;
    await el.updateComplete;
    expect(legend(el) === null).to.equal(true);
  });
});

it('preserves literal native ring tooltip text and segment updates', async () => {
  const text = 'Literal </title><script>throw 42</script> &amp; < > \r\n العربية 😀';
  const el = (await fixture(html`<lr-context-meter shape="ring" total="100"
    .segments=${[{ label: text, value: 25 }]}
  ></lr-context-meter>`)) as LyraContextMeter;

  const assertTitle = (expected: string) => {
    const title = el.shadowRoot!.querySelector('title')!;
    expect(title.textContent).to.equal(expected);
    expect(title.namespaceURI).to.equal('http://www.w3.org/2000/svg');
    expect(title.childElementCount).to.equal(0);
    expect(el.shadowRoot!.querySelectorAll('script').length).to.equal(0);
  };
  assertTitle(`${text}: 25`);
  el.segments = [{ label: `Updated ${text}`, value: 50 }];
  await el.updateComplete;
  assertTitle(`Updated ${text}: 50`);
});
