import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { setForcedColors, setReducedMotion } from '../../../../test/wtr-media.js';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import type { LyraTreemap, LyraTreemapNode } from './treemap.class.js';
import '../../lr-treemap.js';

const NODES: readonly LyraTreemapNode[] = [
  {
    id: 'compute',
    label: 'Compute',
    children: [
      { id: 'batch', label: 'Batch processing', value: 60 },
      { id: 'web', label: 'Web servers', value: 30 },
    ],
  },
  { id: 'storage', label: 'Storage', value: 10 },
  { id: 'network', label: 'Network', value: 5 },
];

const formatValue = (value: number) => `${value} credits`;

function tiles(el: LyraTreemap): SVGGElement[] {
  return [...el.shadowRoot!.querySelectorAll<SVGGElement>('[part~="tile"][role="button"]')];
}

function tile(el: LyraTreemap, name: string): SVGGElement {
  const match = tiles(el).find((mark) => mark.getAttribute('aria-label')?.includes(name));
  if (!match) throw new Error(`Expected a tile for ${name}`);
  return match;
}

function focusName(el: LyraTreemap): string | null | undefined {
  return el.shadowRoot!.activeElement?.getAttribute('aria-label');
}

function partText(el: LyraTreemap, name: string): string {
  return el.shadowRoot!.querySelector(`[part~="${name}"]`)?.textContent?.trim() ?? '';
}

expectLocaleFallback('de-DE', [
  'accessibleLabelSeparator',
  'chart',
  'chart3dName',
  'chartData',
  'chartLegend',
  'chartInputLimit',
  'chartTableName',
  'chartTableValue',
  'chartValueLabel',
  'loading',
  'noData',
  'queryBuilderValueLabel',
  'treemapTileLabel',
]);

function plot(el: LyraTreemap): SVGSVGElement {
  return el.shadowRoot!.querySelector<SVGSVGElement>('svg[part~="plot"]')!;
}

/** Waits until the viewBox matches the plot's rendered box, so one user unit is one CSS pixel. */
async function settledPlot(el: LyraTreemap): Promise<SVGSVGElement> {
  const svg = plot(el);
  await waitUntil(() => {
    const box = svg.viewBox.baseVal;
    return Math.abs(box.width - svg.clientWidth) < 1 && Math.abs(box.height - svg.clientHeight) < 1;
  }, 'The viewBox did not follow the plot size');
  return svg;
}

function shapeBox(el: LyraTreemap, name: string): DOMRect {
  return tile(el, name).querySelector('.tile-shape')!.getBoundingClientRect();
}

function resolvedColor(el: LyraTreemap, color: string): string {
  const probe = document.createElement('span');
  probe.style.color = color;
  el.shadowRoot!.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

describe('<lr-treemap>', () => {
  it('renders nested tiles and a top-level legend with an accessible name and description', async () => {
    const el = await fixture<LyraTreemap>(html`
      <lr-treemap
        locale="de-DE"
        label="Resource allocation"
        description="Relative usage across three services"
        .nodes=${NODES}
        .valueFormatter=${formatValue}
      ></lr-treemap>
    `);

    const chart = el.shadowRoot!.querySelector('svg[role="group"]')!;
    expect(chart.getAttribute('aria-label')).to.equal('Resource allocation');
    expect(el.shadowRoot!.getElementById(chart.getAttribute('aria-describedby') ?? '')?.textContent?.trim())
      .to.equal('Relative usage across three services');
    expect(tiles(el).length).to.equal(5);
    expect(tiles(el).filter((mark) => mark.getAttribute('tabindex') === '0').length).to.equal(1);
    expect(tile(el, 'Compute').getAttribute('aria-label')).to.include('90 credits');
    expect(tile(el, 'Batch processing').getAttribute('aria-label')).to.include('60 credits');
    const labels = [...el.shadowRoot!.querySelectorAll('[part~="tile-label"]')].map((label) => label.textContent);
    expect(labels).to.include('Batch processing');

    const legend = partText(el, 'legend');
    expect(legend).to.include('Compute').and.include('Storage').and.include('Network');
    expect(legend).not.to.include('Batch processing');
    expect(el.shadowRoot!.querySelector('[part~="data-table-toggle"]') === null).to.be.true;
    expect(el.shadowRoot!.querySelector('table tbody')?.textContent).to.include('Batch processing');
    await expect(el).to.be.accessible();

    el.setAttribute('aria-label', 'Quarterly resource allocation');
    await el.updateComplete;
    expect(chart.getAttribute('aria-label')).to.equal('Quarterly resource allocation');
  });

  it('reveals formatted hierarchy data through a native disclosure', async () => {
    const el = await fixture<LyraTreemap>(html`
      <lr-treemap data-table-toggle .nodes=${NODES} .valueFormatter=${formatValue}></lr-treemap>
    `);
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="data-table-toggle"]')!;
    const table = el.shadowRoot!.querySelector('table')!;
    const target = el.shadowRoot!.getElementById(button.getAttribute('aria-controls') ?? '');
    expect(target?.contains(table)).to.equal(true);
    expect(button.getAttribute('aria-expanded')).to.equal('false');

    await focusByKeyboard(button);
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(button.getAttribute('aria-expanded')).to.equal('true');
    expect(table.getBoundingClientRect().height).to.be.greaterThan(1);
    expect(table.tBodies[0]?.textContent).to.include('Batch processing').and.include('60 credits');
    await expect(el).to.be.accessible();

    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(button.getAttribute('aria-expanded')).to.equal('false');
    expect(el.shadowRoot!.querySelector('table') === table).to.equal(true);
  });

  it('starts expanded when with-data-table is set', async () => {
    const el = await fixture<LyraTreemap>(html`
      <lr-treemap with-data-table data-table-toggle .nodes=${NODES}></lr-treemap>
    `);
    const toggle = () => el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="data-table-toggle"]');
    expect(toggle()?.getAttribute('aria-expanded')).to.equal('true');
    toggle()?.click();
    await el.updateComplete;
    expect(toggle()?.getAttribute('aria-expanded')).to.equal('false');

    el.dataTableToggle = false;
    await el.updateComplete;
    expect(toggle() === null).to.equal(true);
    expect(el.shadowRoot!.querySelector('table')!.getBoundingClientRect().height).to.be.greaterThan(1);
    el.dataTableToggle = true;
    await el.updateComplete;
    expect(toggle()?.getAttribute('aria-expanded')).to.equal('true');
  });

  it('removes the disclosure transition under reduced motion', async () => {
    const el = await fixture<LyraTreemap>(html`
      <lr-treemap data-table-toggle .nodes=${NODES}></lr-treemap>
    `);
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="data-table-toggle"]')!;
    try {
      await setReducedMotion('no-preference');
      expect(getComputedStyle(button).transitionProperty).to.include('background-color');

      await setReducedMotion('reduce');
      expect(getComputedStyle(button).transitionProperty).to.equal('none');
    } finally {
      await setReducedMotion('no-preference');
    }
  });

  it('moves through the hierarchy with real keys and emits an activation from the focused tile', async () => {
    const el = await fixture<LyraTreemap>(html`<lr-treemap .nodes=${NODES}></lr-treemap>`);
    await focusByKeyboard(tile(el, 'Compute'));
    await sendKeys({ press: 'ArrowUp' });
    await sendKeys({ press: 'ArrowLeft' });
    expect(focusName(el)).to.include('Compute');
    await sendKeys({ press: 'ArrowDown' });
    expect(focusName(el)).to.include('Batch processing');
    await sendKeys({ press: 'ArrowRight' });
    expect(focusName(el)).to.include('Web servers');
    await sendKeys({ press: 'ArrowDown' });
    await sendKeys({ press: 'ArrowRight' });
    expect(focusName(el)).to.include('Web servers');

    const activated: { detail: unknown; bubbles: boolean; composed: boolean }[] = [];
    el.addEventListener('lr-datum-activate', (event) => {
      const { detail, bubbles, composed } = event as CustomEvent<unknown>;
      activated.push({ detail, bubbles, composed });
    });
    await sendKeys({ press: 'Enter' });
    expect(activated).to.deep.equal([
      { detail: { id: 'web', label: 'Web servers', value: 30 }, bubbles: true, composed: true },
    ]);

    await sendKeys({ press: 'ArrowUp' });
    expect(focusName(el)).to.include('Compute');
    await sendKeys({ press: 'End' });
    expect(focusName(el)).to.include('Network');
    await sendKeys({ press: 'Home' });
    expect(focusName(el)).to.include('Compute');
    expect(tiles(el).filter((mark) => mark.getAttribute('tabindex') === '0').length).to.equal(1);
  });

  it('moves along RTL siblings in a 320px panel with long labels', async () => {
    const longLabel = 'Regional object storage and policy-managed archival retention';
    const nodes = [NODES[0]!, { ...NODES[1]!, label: longLabel }, NODES[2]!];
    const el = await fixture<LyraTreemap>(html`
      <lr-treemap dir="rtl" style="inline-size: 320px" .nodes=${nodes}></lr-treemap>
    `);
    expect(el.clientWidth).to.equal(320);
    expect(el.scrollWidth).to.be.at.most(321);
    expect(tile(el, longLabel).getBoundingClientRect().width).to.be.greaterThan(0);

    await focusByKeyboard(tile(el, 'Compute'));
    await sendKeys({ press: 'ArrowLeft' });
    expect(focusName(el)).to.include(longLabel);
    await sendKeys({ press: 'ArrowRight' });
    expect(focusName(el)).to.include('Compute');
  });

  it('opens a formatted tooltip on keyboard focus and dismisses it with Escape', async () => {
    const el = await fixture<LyraTreemap>(html`
      <lr-treemap .nodes=${NODES} .valueFormatter=${formatValue}></lr-treemap>
    `);
    await focusByKeyboard(tile(el, 'Batch processing'));
    await waitUntil(() => partText(el, 'tooltip').includes('60 credits'));
    expect(partText(el, 'tooltip')).to.include('Batch processing');
    await expect(el).to.be.accessible();

    await sendKeys({ press: 'Escape' });
    await waitUntil(() => partText(el, 'tooltip') === '');
    expect(focusName(el)).to.include('Batch processing');
  });

  it('dismisses a hovered tooltip on Escape and when the pointer leaves', async () => {
    const el = await fixture<LyraTreemap>(html`
      <lr-treemap .nodes=${NODES} .valueFormatter=${formatValue}></lr-treemap>
    `);
    try {
      await hoverUntilMatched(tile(el, 'Batch processing'), 'The batch tile did not receive hover');
      await waitUntil(() => partText(el, 'tooltip').includes('60 credits'));
      expect(partText(el, 'tooltip')).to.include('Batch processing');
      await sendKeys({ press: 'Escape' });
      await waitUntil(() => partText(el, 'tooltip') === '');

      await hoverUntilMatched(tile(el, 'Web servers'), 'The web tile did not receive hover');
      await waitUntil(() => partText(el, 'tooltip').includes('30 credits'));
    } finally {
      await resetMouse();
    }
    await waitUntil(() => partText(el, 'tooltip') === '');
  });

  it('retains one tab stop when the focused node disappears from a replacement tree', async () => {
    const el = await fixture<LyraTreemap>(html`<lr-treemap .nodes=${NODES}></lr-treemap>`);
    await focusByKeyboard(tile(el, 'Batch processing'));
    el.nodes = [NODES[1]!];
    await el.updateComplete;
    expect(tiles(el).length).to.equal(1);
    expect(tile(el, 'Storage').getAttribute('tabindex')).to.equal('0');
    expect(partText(el, 'tooltip')).not.to.include('Batch processing');
  });

  it('owns assigned nodes and omits invalid weights and repeated IDs from both data surfaces', async () => {
    const child = { id: 'valid', label: 'Valid', value: 1250 };
    const children = [
      child,
      { id: 'negative', label: 'Negative', value: -1 },
      { id: 'invalid', label: 'Nonfinite', value: Infinity },
      { id: child.id, label: 'Duplicate', value: 9000 },
    ];
    const nodes = [{ id: 'group', label: 'Group', children }];
    const el = await fixture<LyraTreemap>(html`
      <lr-treemap locale="de-DE" .nodes=${nodes}></lr-treemap>
    `);
    child.value = 4000;
    children.push({ id: 'added', label: 'Added', value: 10 });
    el.description = 'Usage split';
    await el.updateComplete;

    expect(tiles(el).map((mark) => mark.getAttribute('aria-label'))).to.deep.equal([
      'Group: 1.250',
      'Valid, level 2 in Group: 1.250',
    ]);
    const rows = [...el.shadowRoot!.querySelectorAll('tbody tr')];
    expect(rows.map((row) => row.querySelector('th')?.textContent)).to.deep.equal([
      'Group',
      'Valid, level 2 in Group',
    ]);
  });

  it('caps the visible projection and data table and shows a localized limit notice', async () => {
    const nodes = [{
      id: 'group',
      label: 'Group',
      children: Array.from({ length: 1000 }, (_, index) => ({
        id: String(index),
        label: `Category ${index + 1}`,
        value: 1,
      })),
    }];
    const el = await fixture<LyraTreemap>(html`
      <lr-treemap .nodes=${nodes} .strings=${{ chartInputLimit: 'This chart shows part of the dataset' }}></lr-treemap>
    `);

    expect(tiles(el).length).to.equal(1000);
    expect(el.shadowRoot!.querySelectorAll('tbody tr').length).to.equal(1000);
    expect(tile(el, 'Group').getAttribute('aria-label')).to.equal('Group: 1,000');
    expect(partText(el, 'limit')).to.equal('This chart shows part of the dataset');
  });

  it('shows localized loading and empty states with a per-instance string override', async () => {
    const el = await fixture<LyraTreemap>(html`<lr-treemap locale="de-DE" loading></lr-treemap>`);
    expect(partText(el, 'loading')).to.equal('Loading…');
    expect(tiles(el).length).to.equal(0);

    el.loading = false;
    await el.updateComplete;
    expect(partText(el, 'empty')).to.equal('No data');
    el.strings = { noData: 'Keine Daten' };
    await el.updateComplete;
    expect(partText(el, 'empty')).to.equal('Keine Daten');
  });

  for (const width of [960, 320]) {
    it(`renders tile labels at the token font size in a ${width}px host`, async () => {
      const el = await fixture<LyraTreemap>(html`
        <lr-treemap style=${`inline-size: ${width}px`} .nodes=${NODES}></lr-treemap>
      `);
      const svg = await settledPlot(el);
      expect(svg.clientWidth).to.equal(width);
      expect(svg.clientHeight).to.be.within(150, width);
      const label = el.shadowRoot!.querySelector<HTMLElement>('[part~="tile-label"]')!;
      const probe = document.createElement('span');
      probe.style.fontSize = 'var(--lr-font-size-xs)';
      el.shadowRoot!.append(probe);
      const token = parseFloat(getComputedStyle(probe).fontSize);
      probe.remove();
      const scale = svg.getScreenCTM()!.a;
      expect(parseFloat(getComputedStyle(label).fontSize) * scale).to.be.closeTo(token, 0.01);
      expect(label.getBoundingClientRect().height).to.be.closeTo(label.offsetHeight, 0.5);
    });
  }

  it('keeps every top-level category when more than 1,000 descendants are capped', async () => {
    const leaves = (prefix: string, count: number, value: number) =>
      Array.from({ length: count }, (_, index) => ({ id: `${prefix}-${index}`, label: `${prefix} ${index}`, value }));
    const nodes = [
      { id: 'alpha', label: 'Alpha', children: leaves('alpha', 1200, 1) },
      { id: 'beta', label: 'Beta', children: leaves('beta', 50, 10) },
      { id: 'gamma', label: 'Gamma', value: 1 },
    ];
    const el = await fixture<LyraTreemap>(html`<lr-treemap .nodes=${nodes}></lr-treemap>`);
    expect(tiles(el).length).to.equal(1000);
    expect(el.shadowRoot!.querySelectorAll('tbody tr').length).to.equal(1000);
    const legend = partText(el, 'legend');
    expect(legend).to.include('Alpha').and.include('Beta').and.include('Gamma');
    const names = tiles(el).map((mark) => mark.getAttribute('aria-label') ?? '');
    expect(names.filter((name) => name.startsWith('beta ')).length).to.equal(50);
    expect(names.filter((name) => name === 'Gamma: 1').length).to.equal(1);
    expect(partText(el, 'limit')).to.equal(
      'Some chart data was omitted because an input limit was reached. Provide a smaller or pre-aggregated dataset to represent the omitted values.',
    );
  });

  it('distinguishes the too-small notice from the input-limit notice and lists the hidden value', async () => {
    const nodes = [
      { id: 'large', label: 'Large', value: 1 },
      { id: 'tiny', label: 'Tiny', value: 1e-300 },
    ];
    const el = await fixture<LyraTreemap>(html`<lr-treemap .nodes=${nodes}></lr-treemap>`);
    expect(tiles(el).map((mark) => mark.getAttribute('aria-label'))).to.deep.equal(['Large: 1']);
    const rows = [...el.shadowRoot!.querySelectorAll('tbody th')].map((cell) => cell.textContent);
    expect(rows).to.deep.equal(['Large', 'Tiny']);
    expect(partText(el, 'limit')).to.equal('Some values are too small to draw. The data table lists every value.');

    el.nodes = [{ id: 'deep', label: 'Deep', children: Array.from({ length: 1000 }, (_, i) => ({ id: `n${i}`, label: '', value: 1 })) }];
    await el.updateComplete;
    expect(partText(el, 'limit')).to.include('an input limit was reached');
  });

  it('lets a later valid node use an ID an invalid node carried', async () => {
    const nodes = [
      { id: 'a', label: 'Negative', value: -1 },
      { id: 'a', label: 'Kept A', value: 5 },
      { id: 'b', label: 'Childless', children: [] },
      { id: 'b', label: 'Kept B', value: 3 },
      { id: 'c', label: 'Hollow', children: [{ id: 'x', label: 'Bad', value: Number.NaN }] },
      { id: 'c', label: 'Kept C', value: 2 },
      { id: 'x', label: 'Kept X', value: 1 },
    ];
    const el = await fixture<LyraTreemap>(html`<lr-treemap .nodes=${nodes}></lr-treemap>`);
    expect(tiles(el).map((mark) => mark.getAttribute('aria-label'))).to.deep.equal([
      'Kept A: 5', 'Kept B: 3', 'Kept C: 2', 'Kept X: 1',
    ]);
  });

  it('falls back to locale formatting when the value formatter throws and coerces its result', async () => {
    const formatter = (value: number) => {
      if (value === 60) throw new Error('formatter failed');
      return value as unknown as string;
    };
    const el = await fixture<LyraTreemap>(html`
      <lr-treemap .nodes=${[{ id: 'big', label: 'Big', value: 6000 }, { id: 'odd', label: 'Odd', value: 60 }]}
        .valueFormatter=${formatter}></lr-treemap>
    `);
    expect(tiles(el).map((mark) => mark.getAttribute('aria-label'))).to.deep.equal(['Big: 6000', 'Odd: 60']);
    const values = [...el.shadowRoot!.querySelectorAll('tbody td')].map((cell) => cell.textContent);
    expect(values).to.deep.equal(['6000', '60']);
  });

  it('names nested tiles with their level and parent path and honors a strings override', async () => {
    const nodes = [{ id: 'top', label: 'Top', children: [{ id: 'mid', label: 'Mid', children: [{ id: 'leaf', label: 'Leaf', value: 4 }] }] }];
    const el = await fixture<LyraTreemap>(html`<lr-treemap .nodes=${nodes}></lr-treemap>`);
    expect(tiles(el).map((mark) => mark.getAttribute('aria-label'))).to.deep.equal([
      'Top: 4', 'Mid, level 2 in Top: 4', 'Leaf, level 3 in Top — Mid: 4',
    ]);
    el.strings = { treemapTileLabel: '{parent} > {label} ({level})' };
    await el.updateComplete;
    expect(tiles(el).map((mark) => mark.getAttribute('aria-label'))).to.deep.equal([
      'Top: 4', 'Top > Mid (2): 4', 'Top — Mid > Leaf (3): 4',
    ]);
    expect(el.shadowRoot!.querySelectorAll('tbody th')[2]?.textContent).to.equal('Top — Mid > Leaf (3)');
  });

  it('mirrors tile placement under RTL', async () => {
    const ltr = await fixture<LyraTreemap>(html`<lr-treemap style="inline-size: 320px" .nodes=${NODES}></lr-treemap>`);
    const rtl = await fixture<LyraTreemap>(html`<lr-treemap dir="rtl" style="inline-size: 320px" .nodes=${NODES}></lr-treemap>`);
    const ltrPlot = (await settledPlot(ltr)).getBoundingClientRect();
    const rtlPlot = (await settledPlot(rtl)).getBoundingClientRect();
    const ltrBox = shapeBox(ltr, 'Compute');
    const rtlBox = shapeBox(rtl, 'Compute');
    expect(ltrBox.left - ltrPlot.left).to.be.closeTo(0, 1);
    expect(rtlPlot.right - rtlBox.right).to.be.closeTo(0, 1);
    expect(rtlBox.width).to.be.closeTo(ltrBox.width, 0.5);
    expect(rtlBox.width).to.be.lessThan(rtlPlot.width - 1);
  });

  it('emits an activation for a pointer click on a tile', async () => {
    const el = await fixture<LyraTreemap>(html`<lr-treemap style="inline-size: 320px" .nodes=${NODES}></lr-treemap>`);
    await settledPlot(el);
    const box = shapeBox(el, 'Storage');
    const activated = oneEvent(el, 'lr-datum-activate');
    try {
      await sendMouse({ type: 'click', position: [Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2)] });
      const { detail } = await activated;
      expect(detail).to.deep.equal({ id: 'storage', label: 'Storage', value: 10 });
    } finally {
      await resetMouse();
    }
  });

  it('outlines tiles with system colors under forced colors', async function () {
    const el = await fixture<LyraTreemap>(html`<lr-treemap .nodes=${NODES}></lr-treemap>`);
    try {
      await setForcedColors('active');
    } catch {
      this.skip();
    }
    try {
      if (!matchMedia('(forced-colors: active)').matches) this.skip();
      const shape = tile(el, 'Storage').querySelector('.tile-shape')!;
      const style = getComputedStyle(shape);
      expect(style.stroke).to.equal(resolvedColor(el, 'CanvasText'));
      expect(style.fill).to.equal(resolvedColor(el, 'Canvas'));
      expect(parseFloat(style.strokeWidth)).to.be.greaterThan(0);
    } finally {
      await setForcedColors('none');
    }
  });
});
