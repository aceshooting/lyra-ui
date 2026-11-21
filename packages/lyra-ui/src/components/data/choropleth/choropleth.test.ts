import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { sinkTexts } from '../../../../test/announcements.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import type { LyraChoropleth } from './choropleth.class.js';
import '../../lr-choropleth.js';

const OUTER = [[0, 10], [8, 10], [8, 22], [0, 22], [0, 10]] as const;
const HOLE = [[2, 13], [6, 13], [6, 19], [2, 19], [2, 13]] as const;
const WEST_ISLAND = [[12, 11], [16, 11], [16, 16], [12, 16], [12, 11]] as const;
const EAST_ISLAND = [[19, 17], [23, 17], [23, 22], [19, 22], [19, 17]] as const;
const WEST = [[-7, 10], [-2, 10], [-2, 15], [-7, 15], [-7, 10]] as const;

const PROPERTIES = [
  { name: 'Central', district: 'Central district', value: -10, spending: 125 },
  { name: 'Islands', district: 'Island district', value: 20, spending: 250 },
  { name: 'West', district: 'Western district' },
] as const;

const GEOGRAPHY = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', id: 'central', properties: PROPERTIES[0], geometry: { type: 'Polygon', coordinates: [OUTER, HOLE] } },
    { type: 'Feature', id: 'islands', properties: PROPERTIES[1], geometry: { type: 'MultiPolygon', coordinates: [[WEST_ISLAND], [EAST_ISLAND]] } },
    { type: 'Feature', id: 'west', properties: PROPERTIES[2], geometry: { type: 'Polygon', coordinates: [WEST] } },
  ],
} as const;

function deltaArc(points: readonly (readonly [number, number])[]): number[][] {
  return points.map(([x, y], i) => [x - (points[i - 1]?.[0] ?? 0), y - (points[i - 1]?.[1] ?? 0)]);
}

const TOPOLOGY = {
  type: 'Topology',
  transform: { scale: [1, 1], translate: [0, 0] },
  arcs: [OUTER, HOLE, WEST_ISLAND, [...EAST_ISLAND].reverse(), WEST].map(deltaArc),
  objects: {
    districts: {
      type: 'GeometryCollection',
      geometries: [
        { type: 'Polygon', id: 'central', properties: PROPERTIES[0], arcs: [[0], [1]] },
        { type: 'MultiPolygon', id: 'islands', properties: PROPERTIES[1], arcs: [[[2]], [[~3]]] },
        { type: 'Polygon', id: 'west', properties: PROPERTIES[2], arcs: [[4]] },
      ],
    },
  },
} as const;

const formatValue = (value: number) => `${value} credits`;

function regions(el: LyraChoropleth): SVGGElement[] {
  return [...el.shadowRoot!.querySelectorAll<SVGGElement>('[part~="region"][role="button"]')];
}

function region(el: LyraChoropleth, label: string): SVGGElement {
  const match = regions(el).find((mark) => mark.getAttribute('aria-label')?.includes(label));
  if (!match) throw new Error(`Missing region for ${label}`);
  return match;
}

function path(el: LyraChoropleth, label: string): SVGPathElement {
  const result = region(el, label).querySelector('path');
  if (!result) throw new Error(`Missing region geometry for ${label}`);
  return result;
}

function partText(el: LyraChoropleth, part: string): string {
  return el.shadowRoot!.querySelector(`[part~="${part}"]`)?.textContent?.trim() ?? '';
}

/** Waits until the viewBox matches the plot's rendered box, so one user unit is one CSS pixel. */
async function settledPlot(el: LyraChoropleth): Promise<SVGSVGElement> {
  const svg = el.shadowRoot!.querySelector<SVGSVGElement>('svg[part~="plot"]')!;
  await waitUntil(() => Math.abs(svg.viewBox.baseVal.width - svg.clientWidth) < 1 &&
    Math.abs(svg.viewBox.baseVal.height - svg.clientHeight) < 1, 'The viewBox did not follow the plot size');
  return svg;
}

function focusLabel(el: LyraChoropleth): string | null | undefined {
  return el.shadowRoot!.activeElement?.getAttribute('aria-label');
}

describe('<lr-choropleth>', () => {
  it('renders one accessible region per feature, preserving polygon holes and detached islands', async () => {
    const el = await fixture<LyraChoropleth>(html`
      <lr-choropleth label="District spending" description="Spending by district"
        .geography=${GEOGRAPHY} .valueFormatter=${formatValue}
      ></lr-choropleth>
    `);
    const svg = el.shadowRoot!.querySelector('svg[role="group"]')!;
    expect(svg.getAttribute('aria-label')).to.equal('District spending');
    expect(el.shadowRoot!.getElementById(svg.getAttribute('aria-describedby') ?? '')?.textContent?.trim())
      .to.equal('Spending by district');
    expect(regions(el).length).to.equal(3);
    expect(svg.querySelectorAll('[tabindex="0"]').length).to.equal(1);
    expect(region(el, 'Central').getAttribute('aria-label')).to.include('-10 credits');
    expect(region(el, 'Islands').getAttribute('aria-label')).to.include('20 credits');
    expect(region(el, 'West').getAttribute('aria-label')).to.include('No data');
    expect(el.shadowRoot!.querySelector('[part~="data-table-toggle"]') === null).to.equal(true);

    const central = path(el, 'Central');
    const box = central.getBBox();
    expect(central.isPointInFill(new DOMPoint(box.x + box.width / 2, box.y + box.height / 2))).to.equal(false);
    expect(central.isPointInFill(new DOMPoint(box.x + box.width / 8, box.y + box.height / 2))).to.equal(true);
    expect(path(el, 'Islands').getAttribute('d')?.match(/M/g)?.length).to.equal(2);
    await expect(el).to.be.accessible();

    el.setAttribute('aria-label', 'Quarterly district spending');
    await el.updateComplete;
    expect(svg.getAttribute('aria-label')).to.equal('Quarterly district spending');
  });

  it('decodes quantized and reversed TopoJSON arcs to the same rendered shapes and values as GeoJSON', async () => {
    const el = await fixture<LyraChoropleth>(html`<lr-choropleth .geography=${GEOGRAPHY}></lr-choropleth>`);
    await settledPlot(el);
    const shapes = () => regions(el).map((mark) => [
      mark.getAttribute('aria-label'),
      mark.querySelector('path')?.getAttribute('d'),
    ]);
    const expected = shapes();
    expect(expected.length).to.equal(3);
    el.geography = TOPOLOGY;
    await el.updateComplete;
    expect(shapes()).to.deep.equal(expected);
  });

  it('uses alternate value and label fields and exposes styled no-data regions in the disclosed table', async () => {
    const el = await fixture<LyraChoropleth>(html`
      <lr-choropleth field="spending" label-field="district" data-table-toggle
        .geography=${GEOGRAPHY} .valueFormatter=${formatValue}
        .noData=${{ color: 'rgb(12, 34, 56)', strokeColor: 'rgb(54, 32, 10)', label: 'Unreported' }}
      ></lr-choropleth>
    `);
    expect(region(el, 'Central district').getAttribute('aria-label')).to.include('125 credits');
    expect(region(el, 'Island district').getAttribute('aria-label')).to.include('250 credits');
    expect(region(el, 'Western district').getAttribute('aria-label')).to.include('Unreported');
    expect(getComputedStyle(path(el, 'Western district')).fill).to.equal('rgb(12, 34, 56)');
    expect(getComputedStyle(path(el, 'Western district')).stroke).to.equal('rgb(54, 32, 10)');

    const table = el.shadowRoot!.querySelector('table')!;
    const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="data-table-toggle"]')!;
    expect(toggle.getAttribute('aria-controls')).to.equal(table.id);
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    await focusByKeyboard(toggle);
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
    expect(table.getBoundingClientRect().height).to.be.greaterThan(1);
    expect(table.tBodies[0]?.textContent).to.include('125 credits').and.include('250 credits').and.include('Unreported');
    await expect(el).to.be.accessible();
  });

  it('keeps the decoded snapshot stable until a field change re-reads geography', async () => {
    const properties: { name: string; district: string; value: number; spending: number } = { ...PROPERTIES[0] };
    const geography = {
      ...GEOGRAPHY,
      features: [{ ...GEOGRAPHY.features[0], properties }],
    };
    const el = await fixture<LyraChoropleth>(html`
      <lr-choropleth .geography=${geography} .valueFormatter=${formatValue}></lr-choropleth>
    `);
    properties.name = 'Revised central';
    properties.value = 55;
    properties.spending = 400;
    properties.district = 'Revised central district';
    el.description = 'Updated chart description';
    await el.updateComplete;
    expect(region(el, 'Central').getAttribute('aria-label')).to.equal('Central: -10 credits');

    el.field = 'spending';
    await el.updateComplete;
    expect(region(el, 'Revised central').getAttribute('aria-label')).to.equal('Revised central: 400 credits');

    el.labelField = 'district';
    await el.updateComplete;
    expect(region(el, 'Revised central district').getAttribute('aria-label')).to.equal('Revised central district: 400 credits');
  });

  it('updates rendered geometry for Mercator and rendered fills for the diverging palette', async () => {
    const el = await fixture<LyraChoropleth>(html`<lr-choropleth .geography=${GEOGRAPHY}></lr-choropleth>`);
    expect(el.projection).to.equal('equirectangular');
    expect(el.palette).to.equal('sequential');
    const projectedHeightRatio = () => path(el, 'Central').getBBox().height / path(el, 'Islands').getBBox().height;
    const before = projectedHeightRatio();
    const regionFills = () => ['Central', 'Islands'].map((label) => getComputedStyle(path(el, label)).fill);
    const sequential = regionFills();
    expect(sequential[0]).not.to.equal(sequential[1]);
    el.projection = 'mercator';
    await el.updateComplete;
    expect(Math.abs(before - projectedHeightRatio())).to.be.greaterThan(0.001);
    el.palette = 'diverging';
    await el.updateComplete;
    expect(regionFills()).not.to.deep.equal(sequential);
    expect(partText(el, 'legend')).not.to.equal('');
  });

  it('moves across region marks and emits data and missing-data activations', async () => {
    const el = await fixture<LyraChoropleth>(html`<lr-choropleth .geography=${GEOGRAPHY}></lr-choropleth>`);
    const events: { detail: unknown; bubbles: boolean; composed: boolean }[] = [];
    el.addEventListener('lr-datum-activate', (event) => {
      const { detail, bubbles, composed } = event as CustomEvent<unknown>;
      events.push({ detail, bubbles, composed });
    });
    await focusByKeyboard(region(el, 'Central'));
    await sendKeys({ press: 'Enter' });
    await sendKeys({ press: 'ArrowRight' });
    expect(focusLabel(el)).to.include('Islands');
    await sendKeys({ press: 'End' });
    expect(focusLabel(el)).to.include('West');
    await sendKeys({ press: 'Enter' });
    expect(events).to.deep.equal([
      { detail: { id: 'central', label: 'Central', value: -10 }, bubbles: true, composed: true },
      { detail: { id: 'west', label: 'West', value: null }, bubbles: true, composed: true },
    ]);
    await sendKeys({ press: 'Home' });
    expect(focusLabel(el)).to.include('Central');
  });

  it('opens region details on keyboard focus and dismisses them with Escape', async () => {
    const el = await fixture<LyraChoropleth>(html`
      <lr-choropleth .geography=${GEOGRAPHY} .valueFormatter=${formatValue}></lr-choropleth>
    `);
    await focusByKeyboard(region(el, 'Islands'));
    await waitUntil(() => partText(el, 'tooltip').includes('20 credits'));
    expect(partText(el, 'tooltip')).to.include('Islands');
    await expect(el).to.be.accessible();
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => partText(el, 'tooltip') === '');
    expect(focusLabel(el)).to.include('Islands');
  });

  it('shows missing-data details on pointer hover and dismisses them when the pointer leaves', async () => {
    const el = await fixture<LyraChoropleth>(html`<lr-choropleth .geography=${GEOGRAPHY}></lr-choropleth>`);
    try {
      await hoverUntilMatched(path(el, 'West'), 'The western region did not receive hover');
      await waitUntil(() => partText(el, 'tooltip').includes('No data'));
      expect(partText(el, 'tooltip')).to.include('West');
    } finally {
      await resetMouse();
    }
    await waitUntil(() => partText(el, 'tooltip') === '');
  });

  it('fits a 320px RTL panel with long region labels and uses logical arrow order', async () => {
    const geography = {
      ...GEOGRAPHY,
      features: [
        { ...GEOGRAPHY.features[0], properties: { ...PROPERTIES[0], name: 'Central metropolitan investment and development district' } },
        ...GEOGRAPHY.features.slice(1),
      ],
    };
    const el = await fixture<LyraChoropleth>(html`
      <lr-choropleth dir="rtl" style="inline-size: 320px" .geography=${geography}></lr-choropleth>
    `);
    expect(el.clientWidth).to.equal(320);
    expect(el.scrollWidth).to.be.at.most(321);
    expect(path(el, 'Central metropolitan').getBBox().x).to.be.lessThan(path(el, 'Islands').getBBox().x);
    await focusByKeyboard(region(el, 'Central metropolitan'));
    await sendKeys({ press: 'ArrowLeft' });
    expect(focusLabel(el)).to.include('Islands');
    await sendKeys({ press: 'ArrowRight' });
    expect(focusLabel(el)).to.include('Central metropolitan');
    await expect(el).to.be.accessible();
  });

  it('fails closed on malformed geometry and recovers when valid data is assigned', async () => {
    const broken = {
      ...GEOGRAPHY,
      features: [
        GEOGRAPHY.features[0],
        { ...GEOGRAPHY.features[1], geometry: { type: 'Polygon', coordinates: [[[0, 0], [Infinity, 2], [3, 4]]] } },
      ],
    };
    const el = await fixture<LyraChoropleth>(html`
      <lr-choropleth .geography=${broken} .strings=${{ choroplethInvalidGeometry: 'Invalid district shapes' }}></lr-choropleth>
    `);
    expect(regions(el).length).to.equal(0);
    expect(partText(el, 'error')).to.equal('Invalid district shapes');
    el.geography = GEOGRAPHY;
    await el.updateComplete;
    expect(regions(el).length).to.equal(3);
    expect(partText(el, 'error')).to.equal('');
  });

  it('leaves the initial error silent and announces a later localized error in light DOM', async () => {
    const broken = { type: 'FeatureCollection', features: [null] };
    const message = 'The district geometry could not be loaded';
    const el = await fixture<LyraChoropleth>(html`
      <lr-choropleth .geography=${broken} .strings=${{ choroplethInvalidGeometry: message }}></lr-choropleth>
    `);
    const errors = () => sinkTexts('assertive').filter((entry) => entry === message);
    expect(partText(el, 'error')).to.equal(message);
    expect(errors()).to.deep.equal([]);

    el.geography = GEOGRAPHY;
    await el.updateComplete;
    expect(partText(el, 'error')).to.equal('');
    el.geography = broken;
    await el.updateComplete;
    await waitUntil(() => errors().length === 1);
    expect(partText(el, 'error')).to.equal(message);
  });

  it('keeps a region without drawable area in the data table with a notice', async () => {
    const flat = { type: 'Feature', id: 'flat', properties: { name: 'Flat', value: 7 },
      geometry: { type: 'Polygon', coordinates: [[[30, 0], [31, 0], [32, 0], [30, 0]]] } };
    const el = await fixture<LyraChoropleth>(html`
      <lr-choropleth .geography=${{ ...GEOGRAPHY, features: [GEOGRAPHY.features[0], flat, ...GEOGRAPHY.features.slice(1)] }}
        .valueFormatter=${formatValue}></lr-choropleth>
    `);
    expect(regions(el).length).to.equal(3);
    const rows = [...el.shadowRoot!.querySelectorAll('tbody tr')].map((row) =>
      [...row.children].map((cell) => cell.textContent?.trim()).join('|'));
    expect(rows).to.deep.equal(['Central|-10 credits', 'Flat|7 credits', 'Islands|20 credits', 'West|No data']);
    expect(partText(el, 'limit')).to.equal('Some values are too small to draw. The data table lists every value.');
  });

  it('falls back to locale formatting when the value formatter throws and coerces its result', async () => {
    const formatter = (value: number) => {
      if (value === 20) throw new Error('formatter failed');
      return value as unknown as string;
    };
    const el = await fixture<LyraChoropleth>(html`
      <lr-choropleth .geography=${GEOGRAPHY} .valueFormatter=${formatter}></lr-choropleth>
    `);
    expect(region(el, 'Islands').getAttribute('aria-label')).to.equal('Islands: 20');
    expect(region(el, 'Central').getAttribute('aria-label')).to.equal('Central: -10');
  });

  it('lays out in CSS pixels so labels keep the token size and the height stays bounded', async () => {
    const el = await fixture<LyraChoropleth>(html`
      <lr-choropleth style="inline-size: 960px" .geography=${GEOGRAPHY}></lr-choropleth>
    `);
    const svg = await settledPlot(el);
    expect(svg.clientWidth).to.equal(960);
    expect(svg.clientHeight).to.be.within(150, 480);
    expect(svg.getScreenCTM()!.a).to.be.closeTo(1, 0.01);
  });

  it('reports the feature limit before drawing any partial geography', async () => {
    const geography = {
      type: 'FeatureCollection',
      features: Array.from({ length: 1001 }, (_, index) => ({
        ...GEOGRAPHY.features[0], id: String(index),
      })),
    };
    const el = await fixture<LyraChoropleth>(html`
      <lr-choropleth .geography=${geography} .strings=${{ chartInputLimit: 'Too many districts' }}></lr-choropleth>
    `);
    expect(regions(el).length).to.equal(0);
    expect(partText(el, 'error')).to.equal('Too many districts');
  });

  it('shows loading and localized empty states', async () => {
    const el = await fixture<LyraChoropleth>(html`
      <lr-choropleth loading .geography=${GEOGRAPHY} .strings=${{ noData: 'No districts yet' }}></lr-choropleth>
    `);
    expect(partText(el, 'loading')).to.equal('Loading…');
    expect(regions(el).length).to.equal(0);
    el.loading = false;
    el.geography = { type: 'FeatureCollection', features: [] };
    await el.updateComplete;
    expect(partText(el, 'empty')).to.equal('No districts yet');
    expect(regions(el).length).to.equal(0);
  });

  it('uses the default map name, table headers and invalid-geometry notice', async () => {
    const el = await fixture<LyraChoropleth>(html`<lr-choropleth with-data-table .geography=${GEOGRAPHY}></lr-choropleth>`);
    expect(el.shadowRoot!.querySelector('svg[role="group"]')?.getAttribute('aria-label')).to.equal('Map');
    const headers = [...el.shadowRoot!.querySelectorAll('thead th')].map((cell) => cell.textContent?.trim());
    expect(headers).to.deep.equal(['Name', 'Value']);
    el.geography = { type: 'Polygon', coordinates: [[[0, 0], [1, 1]]] };
    await el.updateComplete;
    expect(partText(el, 'error')).to.equal(
      'The map cannot be drawn because its geometry is invalid. Provide polygon features with longitude and latitude coordinates.'
    );
  });

  it('skips null and non-polygon geometry, which still counts toward the feature limit', async () => {
    const skipped = [
      { type: 'Feature', id: 'none', properties: { name: 'None' }, geometry: null },
      { type: 'Feature', id: 'point', properties: { name: 'Point' }, geometry: { type: 'Point', coordinates: [1, 2] } },
      { type: 'Feature', id: 'line', properties: { name: 'Line' }, geometry: { type: 'LineString', coordinates: [[1, 2], [3, 4]] } },
    ];
    const el = await fixture<LyraChoropleth>(html`
      <lr-choropleth .valueFormatter=${formatValue}
        .geography=${{ type: 'FeatureCollection', features: [...skipped, GEOGRAPHY.features[0]] }}></lr-choropleth>
    `);
    expect(regions(el).map((mark) => mark.getAttribute('aria-label'))).to.deep.equal(['Central: -10 credits']);
    expect(partText(el, 'error')).to.equal('');

    el.geography = {
      ...TOPOLOGY,
      objects: { districts: { type: 'GeometryCollection', geometries: [
        { type: null, id: 'empty' }, { type: 'Point', coordinates: [1, 2] }, TOPOLOGY.objects.districts.geometries[2],
      ] } },
    };
    await el.updateComplete;
    expect(regions(el).length).to.equal(1);

    el.geography = {
      type: 'FeatureCollection',
      features: [...Array.from({ length: 1000 }, () => skipped[0]), GEOGRAPHY.features[0]],
    };
    await el.updateComplete;
    expect(regions(el).length).to.equal(0);
    expect(partText(el, 'error')).to.include('input limit');
  });

  it('reports collinear and degenerate geometry as invalid rather than empty', async () => {
    const el = await fixture<LyraChoropleth>(html`
      <lr-choropleth .geography=${{ type: 'Polygon', coordinates: [[[0, 0], [1, 1], [2, 2], [0, 0]]] }}></lr-choropleth>
    `);
    expect(partText(el, 'empty')).to.equal('');
    expect(partText(el, 'error')).to.include('geometry is invalid');
  });

  it('truncates over-long labels and skips features whose ID exceeds the limit', async () => {
    const name = 'L'.repeat(1500);
    const el = await fixture<LyraChoropleth>(html`
      <lr-choropleth .geography=${{
        type: 'FeatureCollection',
        features: [
          { ...GEOGRAPHY.features[0], properties: { ...PROPERTIES[0], name } },
          { ...GEOGRAPHY.features[2], id: 'w'.repeat(1025) },
        ],
      }}></lr-choropleth>
    `);
    expect(partText(el, 'error')).to.equal('');
    const labels = regions(el).map((mark) => mark.getAttribute('aria-label') ?? '');
    expect(labels.length).to.equal(1);
    expect(labels[0]!.startsWith(`${'L'.repeat(1023)}…:`)).to.equal(true);
  });

  it('draws every TopoJSON object by default and one named object when object is set', async () => {
    const geography = {
      ...TOPOLOGY,
      objects: {
        ...TOPOLOGY.objects,
        land: { type: 'Polygon', id: 'land', properties: { name: 'Land' }, arcs: [[4]] },
      },
    };
    const el = await fixture<LyraChoropleth>(html`<lr-choropleth .geography=${geography}></lr-choropleth>`);
    expect(el.object).to.equal('');
    expect(regions(el).length).to.equal(4);
    el.setAttribute('object', 'land');
    await el.updateComplete;
    expect(regions(el).map((mark) => mark.getAttribute('aria-label'))).to.deep.equal(['Land: No data']);
    el.object = 'districts';
    await el.updateComplete;
    expect(regions(el).length).to.equal(3);
    el.object = 'toString';
    await el.updateComplete;
    expect(regions(el).length).to.equal(0);
    expect(partText(el, 'empty')).to.equal('No data');
  });

  it('reads __proto__ and constructor only as own feature properties and fields', async () => {
    const own = JSON.parse('{"__proto__": 7, "constructor": "Own constructor"}') as object;
    const el = await fixture<LyraChoropleth>(html`
      <lr-choropleth field="__proto__" label-field="constructor" .valueFormatter=${formatValue} .geography=${{
        type: 'FeatureCollection',
        features: [
          { ...GEOGRAPHY.features[0], properties: own },
          { ...GEOGRAPHY.features[2], properties: { name: 'West' } },
        ],
      }}></lr-choropleth>
    `);
    expect(regions(el).map((mark) => mark.getAttribute('aria-label'))).to.deep.equal(['Own constructor: 7 credits', 'west: No data']);
    el.field = 'constructor';
    el.labelField = '__proto__';
    await el.updateComplete;
    expect(regions(el).map((mark) => mark.getAttribute('aria-label'))).to.deep.equal(['central: No data', 'west: No data']);
    expect(Object.prototype).not.to.have.property('value');
  });

  it('keeps an antimeridian-crossing region contiguous with its neighbor', async () => {
    const el = await fixture<LyraChoropleth>(html`<lr-choropleth .geography=${{
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', id: 'dateline', properties: { name: 'Dateline' },
          geometry: { type: 'Polygon', coordinates: [[[170, 0], [-170, 0], [-170, 10], [170, 10], [170, 0]]] } },
        { type: 'Feature', id: 'west', properties: { name: 'Western' },
          geometry: { type: 'Polygon', coordinates: [[[160, 0], [170, 0], [170, 10], [160, 10], [160, 0]]] } },
      ],
    }}></lr-choropleth>`);
    const dateline = path(el, 'Dateline').getBBox();
    const west = path(el, 'Western').getBBox();
    expect(dateline.width / west.width).to.be.closeTo(2, 0.01);
    expect(dateline.x).to.be.closeTo(west.x + west.width, 0.01);
  });

  it('rejects projected TopoJSON whose coordinates are not longitude and latitude', async () => {
    const meters = [[500000, 4000000], [600000, 4000000], [600000, 4100000], [500000, 4100000], [500000, 4000000]];
    const projected = (extra: object) => ({
      type: 'Topology', arcs: [meters], ...extra,
      objects: { zones: { type: 'Polygon', id: 'zone', arcs: [[0]] } },
    });
    const el = await fixture<LyraChoropleth>(html`<lr-choropleth .geography=${projected({})}></lr-choropleth>`);
    expect(regions(el).length).to.equal(0);
    expect(partText(el, 'error')).to.include('longitude and latitude');
    el.geography = { ...projected({}), arcs: [deltaArc([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]])],
      transform: { scale: [1000, 1000], translate: [400000, 4000000] } };
    await el.updateComplete;
    expect(regions(el).length).to.equal(0);
    expect(partText(el, 'error')).to.include('longitude and latitude');
  });
});
