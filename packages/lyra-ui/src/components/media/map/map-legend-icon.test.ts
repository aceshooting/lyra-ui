import { expect, fixture, html } from '@open-wc/testing';
import { setForcedColors } from '../../../../test/wtr-media.js';
import './map.js';
import type { LyraMap, LyraMapPointIcon } from './map.js';

/** A closed triangle, valid under the point-icon path grammar the legend reuses. */
const TRIANGLE_PATH = 'M12 3 L21 20 L3 20 Z';
/** A second distinguishable glyph, so a reassignment can be told apart from a stale render. */
const BAR_PATH = 'M4 10 H20 V14 H4 Z';

function swatches(el: LyraMap): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="legend-swatch"]')];
}

function glyphPath(swatch: HTMLElement): string | null {
  return swatch.querySelector('path')?.getAttribute('d') ?? null;
}

async function mapWithLegend(
  legend: LyraMap['legend'],
  direction?: string,
): Promise<LyraMap> {
  const el = (await fixture(
    direction === undefined ? html`<lr-map></lr-map>` : html`<lr-map dir=${direction}></lr-map>`,
  )) as LyraMap;
  el.legend = legend;
  await el.updateComplete;
  return el;
}

it('renders a legend entry glyph inside the legend swatch part', async () => {
  const el = await mapWithLegend([
    { color: 'rgb(255, 0, 0)', label: 'Depot', pattern: 'solid', icon: { path: TRIANGLE_PATH } },
  ]);
  const swatch = swatches(el)[0]!;
  expect(swatch.dataset['icon'], 'the swatch reports that it carries a glyph').to.equal('true');
  expect(glyphPath(swatch), 'the authored path reaches the rendered glyph').to.equal(TRIANGLE_PATH);
  expect(swatch.querySelector('svg')?.getAttribute('viewBox')).to.equal('0 0 24 24');
  expect(swatch.getAttribute('aria-hidden'), 'the glyph stays decorative').to.equal('true');
  expect(swatch.inert).to.be.true;
  // The glyph itself carries the entry color, so the solid block that would hide it is dropped.
  expect(swatch.style.backgroundColor).to.equal('');
  expect(swatch.style.color).to.equal('rgb(255, 0, 0)');
  expect(swatch.dataset['pattern'], 'the required pattern cue is still reported').to.equal('solid');
});

it('paints a legend glyph with the point-icon paint vocabulary', async () => {
  const el = await mapWithLegend([
    {
      color: '#00f',
      label: 'Route',
      pattern: 'solid',
      icon: {
        path: TRIANGLE_PATH,
        viewBox: [0, 0, 32, 32],
        mode: 'stroke',
        strokeWidth: 3,
        lineCap: 'butt',
        lineJoin: 'miter',
      },
    },
    {
      color: '#0f0',
      label: 'Site',
      pattern: 'solid',
      icon: { path: BAR_PATH, mode: 'fill-stroke' },
    },
  ]);
  const [stroked, both] = swatches(el);
  expect(stroked!.querySelector('svg')?.getAttribute('viewBox')).to.equal('0 0 32 32');
  const strokedGlyph = stroked!.querySelector('path');
  expect(strokedGlyph?.getAttribute('fill'), 'a stroke-only glyph paints no fill').to.equal('none');
  expect(strokedGlyph?.getAttribute('stroke')).to.equal('currentColor');
  expect(strokedGlyph?.getAttribute('stroke-width')).to.equal('3');
  expect(strokedGlyph?.getAttribute('stroke-linecap')).to.equal('butt');
  expect(strokedGlyph?.getAttribute('stroke-linejoin')).to.equal('miter');
  const bothGlyph = both!.querySelector('path');
  expect(bothGlyph?.getAttribute('fill')).to.equal('currentColor');
  expect(bothGlyph?.getAttribute('stroke')).to.equal('currentColor');
  expect(bothGlyph?.getAttribute('stroke-width'), 'the point-icon stroke default').to.equal('2');
  expect(bothGlyph?.getAttribute('stroke-linecap')).to.equal('round');
});

it('accepts the very icon record a point layer already renders', async () => {
  const icon: LyraMapPointIcon = {
    value: 'depot',
    path: TRIANGLE_PATH,
    mode: 'fill-stroke',
    strokeWidth: 1,
  };
  const el = await mapWithLegend([{ color: '#f00', label: 'Depot', pattern: 'solid', icon }]);
  expect(glyphPath(swatches(el)[0]!)).to.equal(TRIANGLE_PATH);
  const readback = el.legend[0]!.icon!;
  expect(Object.isFrozen(readback), 'the readback is immutable like the rest of the entry').to.be
    .true;
  expect(
    Object.hasOwn(readback, 'value'),
    'the point layer category key is meaningless in a legend and is not carried',
  ).to.be.false;
  expect(readback.mode).to.equal('fill-stroke');
  expect(readback.strokeWidth).to.equal(1);
  expect(readback.lineCap, 'the canonical readback fills the point-icon defaults').to.equal('round');
  expect(readback.viewBox?.join(' ')).to.equal('0 0 24 24');
});

it('drops an unusable glyph without dropping its legend row or its valid siblings', async () => {
  const el = await mapWithLegend([
    { color: '#f00', label: 'Markup', pattern: 'solid', icon: { path: '<svg onload="x()"/>' } },
    {
      color: '#0f0',
      label: 'Degenerate box',
      pattern: 'solid',
      icon: { path: TRIANGLE_PATH, viewBox: [0, 0, 0, 24] },
    },
    { color: '#00f', label: 'Valid', pattern: 'solid', icon: { path: TRIANGLE_PATH } },
  ]);
  const rendered = swatches(el);
  expect(rendered.length, 'every row still renders').to.equal(3);
  expect(rendered.map((swatch) => glyphPath(swatch) !== null)).to.deep.equal([false, false, true]);
  // A rejected glyph falls back to the color swatch rather than to an empty box.
  expect(rendered.map((swatch) => swatch.style.backgroundColor)).to.deep.equal([
    'rgb(255, 0, 0)',
    'rgb(0, 255, 0)',
    '',
  ]);
  expect(el.legend.map((entry) => entry.icon !== undefined)).to.deep.equal([false, false, true]);
});

it('leaves an entry with no glyph rendering exactly the color swatch it renders today', async () => {
  const el = await mapWithLegend([{ color: '#f00', label: 'High', pattern: 'diagonal' }]);
  const swatch = swatches(el)[0]!;
  expect(swatch.innerHTML, 'no marker node is introduced into a color-only swatch').to.equal('');
  expect(swatch.getAttributeNames().sort().join(' ')).to.equal(
    'aria-hidden data-pattern inert part style',
  );
  expect(swatch.style.backgroundColor).to.equal('rgb(255, 0, 0)');
  expect(swatch.style.color).to.equal('');
  expect(
    Object.hasOwn(el.legend[0]!, 'icon'),
    'an entry with no authored glyph carries no icon key at all',
  ).to.be.false;
});

it('clears a rendered glyph when the legend shrinks to color-only entries', async () => {
  const el = await mapWithLegend([
    { color: '#f00', label: 'Depot', pattern: 'solid', icon: { path: TRIANGLE_PATH } },
    { color: '#0f0', label: 'Route', pattern: 'solid', icon: { path: BAR_PATH } },
  ]);
  expect(swatches(el).map((swatch) => glyphPath(swatch))).to.deep.equal([
    TRIANGLE_PATH,
    BAR_PATH,
  ]);
  el.legend = [{ color: '#00f', label: 'Only', pattern: 'solid' }];
  await el.updateComplete;
  const remaining = swatches(el);
  expect(remaining.length).to.equal(1);
  expect(remaining[0]!.innerHTML, 'no stale glyph survives the shorter assignment').to.equal('');
  expect(remaining[0]!.hasAttribute('data-icon')).to.be.false;
  expect(remaining[0]!.style.backgroundColor).to.equal('rgb(0, 0, 255)');
});

it('re-renders the glyph after a disconnect and reconnect', async () => {
  const el = await mapWithLegend([
    { color: '#f00', label: 'Depot', pattern: 'solid', icon: { path: TRIANGLE_PATH } },
  ]);
  const parent = el.parentNode!;
  el.remove();
  parent.appendChild(el);
  await el.updateComplete;
  expect(glyphPath(swatches(el)[0]!)).to.equal(TRIANGLE_PATH);
});

it('keeps the glyph unmirrored and inline-start of its label under dir="rtl"', async () => {
  const el = await mapWithLegend(
    [{ color: '#f00', label: 'Depot', pattern: 'solid', icon: { path: TRIANGLE_PATH } }],
    'rtl',
  );
  const swatch = swatches(el)[0]!;
  expect(glyphPath(swatch)).to.equal(TRIANGLE_PATH);
  const glyph = swatch.querySelector('svg');
  expect(glyph === null, 'the rtl row still renders its glyph element').to.be.false;
  expect(
    getComputedStyle(glyph!).transform,
    'a consumer glyph is not a directional affordance, so it never mirrors',
  ).to.equal('none');
  const label = swatch.parentElement!.querySelector('span:last-child')!;
  expect(
    swatch.getBoundingClientRect().left,
    'the swatch stays at the inline start, which is physically right in rtl',
  ).to.be.greaterThan(label.getBoundingClientRect().left);
});

it('never points aria-controls at a map container that is not in the tree', async () => {
  const el = await mapWithLegend([
    { color: '#f00', label: 'Depot', pattern: 'solid', icon: { path: TRIANGLE_PATH } },
  ]);
  const legend = el.shadowRoot!.querySelector('[part="legend"]') as HTMLElement;
  expect(
    el.shadowRoot!.getElementById('map-container') === null,
    'the peer has not settled, so no container is rendered yet',
  ).to.be.true;
  expect(
    legend.hasAttribute('aria-controls'),
    'a dangling idref is a critical ARIA violation, so the attribute is dropped instead',
  ).to.be.false;
  expect(legend.getAttribute('role'), 'the legend is still a named group').to.equal('group');
  expect(legend.getAttribute('aria-label')).to.equal('Map legend');
});

it('stays axe-clean with a populated glyph legend', async () => {
  const el = await mapWithLegend([
    { color: '#f00', label: 'Depot', pattern: 'solid', icon: { path: TRIANGLE_PATH } },
    { color: '#0f0', label: 'Route', pattern: 'dots', icon: { path: BAR_PATH } },
    { color: '#00f', label: 'Plain', pattern: 'crosshatch' },
  ]);
  await expect(el).to.be.accessible();
});

it('keeps a forced-colors glyph off its own fill and inside its pattern border', async () => {
  await setForcedColors('active');
  try {
    const el = await mapWithLegend([
      { color: '#f00', label: 'Plain solid', pattern: 'solid' },
      { color: '#0f0', label: 'Plain dots', pattern: 'dots' },
      // Same pattern as the first row, so the only thing that can separate their fills is the
      // glyph rule. Source order alone used to decide that; the selector now outranks it.
      { color: '#00f', label: 'Glyph solid', pattern: 'solid', icon: { path: TRIANGLE_PATH } },
      { color: '#ff0', label: 'Glyph dashed', pattern: 'diagonal', icon: { path: BAR_PATH } },
    ]);
    const rendered = swatches(el);
    const fills = rendered.map((swatch) => getComputedStyle(swatch).backgroundColor);
    expect(
      fills[0],
      'a solid-pattern row is the filled block, so the two system fills are distinguishable here',
    ).to.not.equal(fills[1]);
    expect(
      fills[2],
      'a solid-pattern glyph row takes the unfilled system background, not the text color its own glyph is painted in',
    ).to.equal(fills[1]);
    expect(fills[3], 'every glyph row takes that same unfilled background').to.equal(fills[1]);
    expect(glyphPath(rendered[2]!), 'the glyph itself still renders').to.equal(TRIANGLE_PATH);
    const borders = rendered.map((swatch) => getComputedStyle(swatch).borderStyle);
    expect(
      borders.slice(2),
      'a glyph row keeps the pattern border, its only surviving non-color cue',
    ).to.deep.equal(['solid', 'dashed']);
    const widths = rendered.map((swatch) => getComputedStyle(swatch).borderTopWidth);
    expect(widths[2], 'and that border is actually drawn').to.equal(widths[0]);
    expect(widths[3]).to.equal(widths[0]);
  } finally {
    await setForcedColors('none');
  }
});

// A glyph row nested inside an interactive legend toggle keeps every decorative guarantee the
// inert row gives it: the swatch must not become part of the button's accessible name, and the
// SVG must not become a second focus target inside an already-focusable control.
it('keeps a glyph decorative and unfocusable inside an interactive legend toggle', async () => {
  const el = (await fixture(html`<lr-map legend-interactive></lr-map>`)) as LyraMap;
  el.legend = [
    { color: 'rgb(255, 0, 0)', label: 'Depot', pattern: 'solid', value: 'depot',
      icon: { path: TRIANGLE_PATH } },
  ];
  await el.updateComplete;

  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('button[part~="legend-toggle"]')!;
  const swatch = button.querySelector<HTMLElement>('[part="legend-swatch"]')!;
  expect(swatch.dataset['icon']).to.equal('true');
  expect(swatch.getAttribute('aria-hidden')).to.equal('true');
  expect(swatch.inert).to.be.true;
  expect(swatch.style.color, 'the glyph still paints in the entry color through currentColor').to.equal(
    'rgb(255, 0, 0)',
  );
  expect(glyphPath(swatch)).to.equal(TRIANGLE_PATH);

  const svg = swatch.querySelector('svg')!;
  expect(svg.getAttribute('focusable'), 'the glyph is never its own focus target').to.equal('false');
  expect(button.querySelectorAll('[tabindex]').length).to.equal(0);
  expect(button.textContent).to.contain('Depot');
});
