import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { svgChartColor } from '../../../internal/svg-chart.js';
import { sinkTexts } from '../../../../test/announcements.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { hoverUntilMatched, resetMouse } from '../../../../test/wtr-mouse.js';
import type { LyraChord, LyraChordEntity } from './chord.class.js';
import '../../lr-chord.js';

const ENTITIES: readonly LyraChordEntity[] = [
  { id: 'sales', label: 'Sales' },
  { id: 'support', label: 'Support' },
  { id: 'product', label: 'Product' },
  { id: 'design', label: 'Design' },
];

const MATRIX = [
  [3, 5, 0, 0],
  [5, 0, 2, 0],
  [0, 2, 0, 4],
  [0, 0, 4, 0],
] as const;

const formatValue = (value: number) => `${value} requests`;

function marks(el: LyraChord, part: 'entity' | 'ribbon'): SVGGElement[] {
  return [...el.shadowRoot!.querySelectorAll<SVGGElement>(`[part~="${part}"][role="button"]`)];
}

function entity(el: LyraChord, label: string): SVGGElement {
  const match = marks(el, 'entity').find((item) => item.getAttribute('aria-label')?.includes(label));
  if (!match) throw new Error(`Missing entity mark for ${label}`);
  return match;
}

function partText(el: LyraChord, part: string): string {
  return el.shadowRoot!.querySelector(`[part~="${part}"]`)?.textContent?.trim() ?? '';
}

function tableRows(el: LyraChord, id: string): string[] {
  return [...el.shadowRoot!.querySelectorAll(`#${id} tbody tr`)].map((row) =>
    [...row.children].map((cell) => cell.textContent?.trim()).join('|'),
  );
}

function tableHeaders(el: LyraChord, id: string): string[] {
  return [...el.shadowRoot!.querySelectorAll(`#${id} thead th`)].map((cell) => cell.textContent?.trim() ?? '');
}

function focusLabel(el: LyraChord): string | null | undefined {
  return el.shadowRoot!.activeElement?.getAttribute('aria-label');
}

describe('<lr-chord>', () => {
  it('renders each entity and unordered pair once and names the chart and its data table', async () => {
    const el = await fixture<LyraChord>(html`
      <lr-chord label="Team requests" description="Requests shared between teams"
        .entities=${ENTITIES} .matrix=${MATRIX} .valueFormatter=${formatValue}
      ></lr-chord>
    `);
    const svg = el.shadowRoot!.querySelector('svg[role="group"]')!;
    expect(svg.getAttribute('aria-label')).to.equal('Team requests');
    expect(el.shadowRoot!.getElementById(svg.getAttribute('aria-describedby') ?? '')?.textContent?.trim())
      .to.equal('Requests shared between teams');
    expect(marks(el, 'entity').length).to.equal(4);
    expect(marks(el, 'ribbon').length).to.equal(4);
    expect(svg.querySelectorAll('[tabindex="0"]').length).to.equal(1);
    expect(entity(el, 'Sales').getAttribute('aria-label')).to.include('8 requests');
    expect([...el.shadowRoot!.querySelectorAll('[part~="entity-label"]')].map((label) => label.textContent?.trim()))
      .to.include('Sales');
    expect(el.shadowRoot!.querySelector('table caption')?.textContent?.trim()).to.equal('Team requests');
    expect(el.shadowRoot!.querySelector('[part~="data-table-toggle"]') === null).to.equal(true);
    const rows = tableRows(el, 'chart-data');
    expect(rows.length).to.equal(4);
    expect(rows.join(' ')).to.include('5 requests').and.include('3 requests');
    await expect(el).to.be.accessible();

    el.setAttribute('aria-label', 'Quarterly team requests');
    await el.updateComplete;
    expect(svg.getAttribute('aria-label')).to.equal('Quarterly team requests');
  });

  it('discloses the pair table using a keyboard-accessible toggle', async () => {
    const el = await fixture<LyraChord>(html`
      <lr-chord data-table-toggle .entities=${ENTITIES} .matrix=${MATRIX}></lr-chord>
    `);
    const table = el.shadowRoot!.querySelector('table')!;
    const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="data-table-toggle"]')!;
    expect(toggle.getAttribute('aria-controls')).to.equal('chart-data chart-data-totals');
    expect(table.id).to.equal('chart-data');
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');

    await focusByKeyboard(toggle);
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
    expect(table.getBoundingClientRect().height).to.be.greaterThan(1);
    expect(el.shadowRoot!.getElementById('chart-data-totals')!.getBoundingClientRect().height).to.be.greaterThan(1);
    await expect(el).to.be.accessible();
  });

  it('navigates logical entity order and returns from an incident ribbon to its originating entity', async () => {
    const el = await fixture<LyraChord>(html`<lr-chord .entities=${ENTITIES} .matrix=${MATRIX}></lr-chord>`);
    await focusByKeyboard(entity(el, 'Sales'));
    await sendKeys({ press: 'ArrowRight' });
    expect(focusLabel(el)).to.include('Support');
    await sendKeys({ press: 'ArrowDown' });
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('ribbon');
    expect(focusLabel(el)).to.include('Sales and Support');
    await sendKeys({ press: 'ArrowRight' });
    expect(focusLabel(el)).to.include('Support and Product');
    await sendKeys({ press: 'Home' });
    expect(focusLabel(el)).to.include('Sales and Support');
    await sendKeys({ press: 'End' });
    expect(focusLabel(el)).to.include('Support and Product');
    await sendKeys({ press: 'ArrowLeft' });
    expect(focusLabel(el)).to.include('Sales and Support');
    await sendKeys({ press: 'ArrowUp' });
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('entity');
    expect(focusLabel(el)).to.include('Support');

    await sendKeys({ press: 'End' });
    expect(focusLabel(el)).to.include('Design');
    await sendKeys({ press: 'Home' });
    expect(focusLabel(el)).to.include('Sales');
    await sendKeys({ press: 'ArrowDown' });
    expect(focusLabel(el)).to.include('Sales and Sales');
    await sendKeys({ press: 'End' });
    expect(focusLabel(el)).to.include('Sales and Support');
    await sendKeys({ press: 'ArrowUp' });
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('entity');
    expect(focusLabel(el)).to.include('Sales');
  });

  it('emits the entity total and the weight of an activated unordered pair', async () => {
    const el = await fixture<LyraChord>(html`<lr-chord .entities=${ENTITIES} .matrix=${MATRIX}></lr-chord>`);
    const activated: { detail: unknown; bubbles: boolean; composed: boolean }[] = [];
    el.addEventListener('lr-datum-activate', (event) => {
      const { detail, bubbles, composed } = event as CustomEvent<unknown>;
      activated.push({ detail, bubbles, composed });
    });
    await focusByKeyboard(entity(el, 'Sales'));
    await sendKeys({ press: 'Enter' });
    const sharedPair = marks(el, 'ribbon').find((mark) => {
      const label = mark.getAttribute('aria-label') ?? '';
      return label.includes('Sales') && label.includes('Support');
    });
    if (!sharedPair) throw new Error('Expected a pair for Sales and Support');
    await focusByKeyboard(sharedPair);
    await sendKeys({ press: 'Enter' });

    expect(activated).to.deep.equal([
      { detail: { kind: 'entity', id: 'sales', label: 'Sales', value: 8 }, bubbles: true, composed: true },
      { detail: { kind: 'ribbon', source: 'sales', target: 'support', value: 5 }, bubbles: true, composed: true },
    ]);
  });

  it('highlights incident ribbons on keyboard focus and clears the highlight on Escape', async () => {
    const el = await fixture<LyraChord>(html`
      <lr-chord .entities=${ENTITIES} .matrix=${MATRIX} .valueFormatter=${formatValue}></lr-chord>
    `);
    await focusByKeyboard(entity(el, 'Sales'));
    const highlighted = () => marks(el, 'ribbon').filter((mark) => !mark.hasAttribute('data-muted'));
    await waitUntil(() => highlighted().length === 2);
    expect(highlighted().every((mark) => mark.getAttribute('aria-label')?.includes('Sales'))).to.equal(true);
    const muted = marks(el, 'ribbon').find((mark) => mark.hasAttribute('data-muted'))!;
    expect(Number(getComputedStyle(muted).opacity)).to.be.lessThan(1);
    expect(partText(el, 'tooltip')).to.include('Sales').and.include('8 requests');
    await expect(el).to.be.accessible();

    await sendKeys({ press: 'Escape' });
    await waitUntil(() => partText(el, 'tooltip') === '');
    expect(highlighted().length).to.equal(4);
    expect(focusLabel(el)).to.include('Sales');
  });

  it('reveals an entity tooltip on pointer hover and clears it on exit', async () => {
    const el = await fixture<LyraChord>(html`
      <lr-chord .entities=${ENTITIES} .matrix=${MATRIX} .valueFormatter=${formatValue}></lr-chord>
    `);
    const arc = entity(el, 'Design').querySelector<SVGPathElement>('path')!;
    try {
      await hoverUntilMatched(arc, 'The Design arc did not receive hover', (bounds) => {
        const transform = arc.getScreenCTM()?.inverse();
        if (!transform) throw new Error('Missing arc coordinate transform');
        for (let y = bounds.top + 2; y < bounds.bottom; y += 2) {
          for (let x = bounds.left + 2; x < bounds.right; x += 2) {
            const point = new DOMPoint(Math.round(x), Math.round(y));
            if (arc.isPointInFill(point.matrixTransform(transform))) return [point.x, point.y];
          }
        }
        throw new Error('No hit point inside the Design arc');
      });
      await waitUntil(() => partText(el, 'tooltip').includes('4 requests'));
      expect(partText(el, 'tooltip')).to.include('Design');
    } finally {
      await resetMouse();
    }
    await waitUntil(() => partText(el, 'tooltip') === '');
  });

  it('keeps labels inside a narrow RTL allocation and moves through mirrored entity order', async () => {
    const el = await fixture<LyraChord>(html`
      <lr-chord dir="rtl" style="inline-size: 320px"
        .entities=${[{ ...ENTITIES[0]!, label: 'Sales for the northern territories and major accounts' }, ...ENTITIES.slice(1)]}
        .matrix=${MATRIX}
      ></lr-chord>
    `);
    expect(el.clientWidth).to.equal(320);
    expect(el.scrollWidth).to.be.at.most(321);
    const panel = el.getBoundingClientRect();
    const labels = [...el.shadowRoot!.querySelectorAll('[part~="entity-label"]')];
    expect(labels.length).to.be.greaterThan(0);
    for (const label of labels) {
      const bounds = label.getBoundingClientRect();
      expect(bounds.left).to.be.at.least(panel.left - 1);
      expect(bounds.right).to.be.at.most(panel.right + 1);
    }
    await focusByKeyboard(entity(el, 'Sales for the northern territories'));
    await sendKeys({ press: 'ArrowLeft' });
    expect(focusLabel(el)).to.include('Support');
    await sendKeys({ press: 'ArrowRight' });
    expect(focusLabel(el)).to.include('Sales for the northern territories');
  });

  it('shows a localized error for asymmetric data and recovers on assignment', async () => {
    const el = await fixture<LyraChord>(html`
      <lr-chord .entities=${ENTITIES} .matrix=${[[1, 5, 0, 0], [4, 0, 2, 0], [0, 2, 0, 4], [0, 0, 4, 0]]}
        .strings=${{ valueInvalid: 'These pair weights are invalid' }}
      ></lr-chord>
    `);
    expect(marks(el, 'ribbon').length).to.equal(0);
    expect(partText(el, 'error')).to.equal('These pair weights are invalid');

    el.matrix = MATRIX;
    await el.updateComplete;
    expect(marks(el, 'ribbon').length).to.equal(4);
    expect(partText(el, 'error')).to.equal('');
  });

  it('leaves initial invalid data silent and announces a later invalid matrix', async () => {
    const message = 'These pair weights are invalid';
    const asymmetric = [[1, 5, 0, 0], [4, 0, 2, 0], [0, 2, 0, 4], [0, 0, 4, 0]];
    const el = await fixture<LyraChord>(html`
      <lr-chord .entities=${ENTITIES} .matrix=${asymmetric} .strings=${{ valueInvalid: message }}></lr-chord>
    `);
    const errors = () => sinkTexts('assertive').filter((entry) => entry === message);
    expect(errors()).to.deep.equal([]);
    el.matrix = MATRIX;
    await el.updateComplete;
    el.matrix = asymmetric;
    await el.updateComplete;
    await waitUntil(() => errors().length === 1, 'The invalid matrix was not announced');
  });

  it('falls back to locale formatting when the value formatter throws and coerces its result', async () => {
    const formatter = (value: number) => {
      if (value === 4) throw new Error('formatter failed');
      return value as unknown as string;
    };
    const el = await fixture<LyraChord>(html`
      <lr-chord .entities=${ENTITIES} .matrix=${MATRIX} .valueFormatter=${formatter}></lr-chord>
    `);
    expect(entity(el, 'Design').getAttribute('aria-label')).to.equal('Design: 4');
    expect(tableRows(el, 'chart-data')).to.include('Product|Design|4');
    expect(tableRows(el, 'chart-data-totals')).to.include('Design|4');
  });

  it('lays out in CSS pixels in a wide allocation and bounds the plot height', async () => {
    const el = await fixture<LyraChord>(html`
      <lr-chord style="inline-size: 1200px" .entities=${ENTITIES} .matrix=${MATRIX}></lr-chord>
    `);
    const svg = el.shadowRoot!.querySelector<SVGSVGElement>('svg[part~="plot"]')!;
    await waitUntil(() => Math.abs(svg.viewBox.baseVal.width - svg.clientWidth) < 1 &&
      Math.abs(svg.viewBox.baseVal.height - svg.clientHeight) < 1, 'The viewBox did not follow the plot size');
    expect(svg.clientWidth).to.equal(1200);
    expect(svg.clientHeight).to.be.within(256, 480);
    expect(svg.getScreenCTM()!.a).to.be.closeTo(1, 0.01);
    expect(el.shadowRoot!.querySelectorAll('[part~="entity-label"]').length).to.be.greaterThan(0);
  });

  it('reports the entity limit without drawing a clipped matrix', async () => {
    const entities = Array.from({ length: 33 }, (_, index) => ({ id: String(index), label: `Team ${index}` }));
    const matrix = entities.map((_, row) => entities.map((_, column) => (row === column ? 1 : 0)));
    const el = await fixture<LyraChord>(html`
      <lr-chord .entities=${entities} .matrix=${matrix}
        .strings=${{ chartInputLimit: 'Too many teams for this chart' }}
      ></lr-chord>
    `);
    expect(partText(el, 'error')).to.equal('Too many teams for this chart');
    expect(marks(el, 'entity').length).to.equal(0);
    expect(marks(el, 'ribbon').length).to.equal(0);
  });

  it('keeps representable ribbons and shows a notice when a weight falls below angular precision', async () => {
    const el = await fixture<LyraChord>(html`
      <lr-chord .entities=${ENTITIES.slice(0, 2)} .matrix=${[[0, 1], [1, Number.MIN_VALUE]]}></lr-chord>
    `);
    expect(marks(el, 'entity').length).to.equal(2);
    expect(marks(el, 'ribbon').map((mark) => mark.getAttribute('aria-label'))).to.deep.equal([
      'Sales and Support: 1',
    ]);
    expect(tableRows(el, 'chart-data').length).to.equal(1);
    expect(partText(el, 'limit')).to.equal('Some values are too small to draw. The data table lists every value.');
    expect(partText(el, 'error')).to.equal('');

    el.strings = { chartValuesTooSmall: 'A pair is too small to draw', chartInputLimit: 'Too many entities' };
    await el.updateComplete;
    expect(partText(el, 'limit')).to.equal('A pair is too small to draw');
  });

  it('renders loading and localized empty states when no positive pairs remain', async () => {
    const el = await fixture<LyraChord>(html`
      <lr-chord loading .entities=${ENTITIES} .matrix=${MATRIX} .strings=${{ noData: 'No pairs yet' }}></lr-chord>
    `);
    expect(partText(el, 'loading')).to.equal('Loading…');
    expect(marks(el, 'entity').length).to.equal(0);

    el.loading = false;
    el.matrix = MATRIX.map((row) => row.map(() => 0));
    await el.updateComplete;
    expect(partText(el, 'empty')).to.equal('No pairs yet');
    expect(marks(el, 'ribbon').length).to.equal(0);
  });

  it('is accessible in its default state without data', async () => {
    const el = await fixture<LyraChord>(html`<lr-chord></lr-chord>`);
    expect(partText(el, 'empty')).to.equal('No data');
    await expect(el).to.be.accessible();
  });

  it('lists every entity total, including zero totals, beside the Source, Target and Value table', async () => {
    const el = await fixture<LyraChord>(html`
      <lr-chord label="Team requests" with-data-table .entities=${ENTITIES.slice(0, 3)}
        .matrix=${[[1, 0, 2], [0, 0, 0], [2, 0, 0]]}
      ></lr-chord>
    `);
    expect(tableHeaders(el, 'chart-data')).to.deep.equal(['Source', 'Target', 'Value']);
    expect(tableRows(el, 'chart-data')).to.deep.equal(['Sales|Sales|1', 'Sales|Product|2']);
    expect(el.shadowRoot!.querySelector('#chart-data-totals caption')?.textContent?.trim())
      .to.equal('Totals for Team requests');
    expect(tableHeaders(el, 'chart-data-totals')).to.deep.equal(['Name', 'Total']);
    expect(tableRows(el, 'chart-data-totals')).to.deep.equal(['Sales|3', 'Support|0', 'Product|2']);
    await expect(el).to.be.accessible();
  });

  it('keeps the matrix index color for an entity after a zero-total entity', async () => {
    const el = await fixture<LyraChord>(html`
      <lr-chord .entities=${ENTITIES.slice(0, 3)} .matrix=${[[0, 0, 2], [0, 0, 0], [2, 0, 0]]}></lr-chord>
    `);
    const color = (label: string) =>
      entity(el, label).querySelector<SVGPathElement>('path.arc-shape')!.style.getPropertyValue('--_lr-chord-mark-color');
    expect(marks(el, 'entity').length).to.equal(2);
    expect(color('Sales')).to.equal(svgChartColor(0));
    expect(color('Product')).to.equal(svgChartColor(2));
    const swatches = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="legend-swatch"]')];
    expect(swatches.map((swatch) => getComputedStyle(swatch).backgroundColor)).to.deep.equal(
      ['Sales', 'Product'].map((label) =>
        getComputedStyle(entity(el, label).querySelector('path.arc-shape')!).fill),
    );
  });

  it('draws a single entity with its self-ribbon', async () => {
    const el = await fixture<LyraChord>(html`
      <lr-chord .entities=${ENTITIES.slice(0, 1)} .matrix=${[[3]]}></lr-chord>
    `);
    expect(marks(el, 'entity').length).to.equal(1);
    expect(marks(el, 'ribbon').map((mark) => mark.getAttribute('aria-label'))).to.deep.equal(['Sales and Sales: 3']);
    expect(tableRows(el, 'chart-data-totals')).to.deep.equal(['Sales|3']);
  });

  it('rejects a non-square matrix with the default invalid-value message', async () => {
    const el = await fixture<LyraChord>(html`
      <lr-chord .entities=${ENTITIES.slice(0, 2)} .matrix=${[[0, 1], [1]]}></lr-chord>
    `);
    expect(partText(el, 'error')).to.equal('The value is invalid.');
    expect(marks(el, 'entity').length).to.equal(0);
  });

  it('accepts pair weights that differ only by floating-point rounding', async () => {
    const el = await fixture<LyraChord>(html`
      <lr-chord .entities=${ENTITIES.slice(0, 2)} .matrix=${[[0, 0.1 + 0.2], [0.3, 0]]}></lr-chord>
    `);
    expect(partText(el, 'error')).to.equal('');
    expect(marks(el, 'ribbon').length).to.equal(1);
    expect(tableRows(el, 'chart-data-totals')).to.deep.equal(['Sales|0.3', 'Support|0.3']);
  });

  it('names pairs through a localizable template', async () => {
    const el = await fixture<LyraChord>(html`
      <lr-chord .entities=${ENTITIES.slice(0, 2)} .matrix=${[[0, 4], [4, 0]]}
        .strings=${{ chordPairLabel: '{target} with {source}' }}
      ></lr-chord>
    `);
    expect(marks(el, 'ribbon')[0]!.getAttribute('aria-label')).to.equal('Support with Sales: 4');
  });

  it('emphasizes a focused ribbon and mutes the others', async () => {
    const el = await fixture<LyraChord>(html`
      <lr-chord .entities=${ENTITIES} .matrix=${MATRIX} .valueFormatter=${formatValue}></lr-chord>
    `);
    const pair = marks(el, 'ribbon').find((mark) => mark.getAttribute('aria-label')?.startsWith('Product and Design'))!;
    await focusByKeyboard(pair);
    const emphasized = () => marks(el, 'ribbon')
      .filter((mark) => !mark.hasAttribute('data-muted'))
      .map((mark) => mark.getAttribute('aria-label'));
    await waitUntil(() => emphasized().length === 1);
    expect(emphasized()).to.deep.equal(['Product and Design: 4 requests']);
    const shape = (mark: SVGGElement) => mark.querySelector('path.ribbon-shape')!;
    expect(shape(pair).hasAttribute('data-highlighted')).to.equal(true);
    const other = marks(el, 'ribbon').find((mark) => mark.hasAttribute('data-muted'))!;
    expect(Number(getComputedStyle(other).opacity)).to.be.lessThan(1);
    expect(getComputedStyle(shape(pair)).fill).to.not.equal(getComputedStyle(shape(other)).fill);
    expect(partText(el, 'tooltip')).to.equal('Product and Design: 4 requests');
    await expect(el).to.be.accessible();
  });

  it('keeps entity labels at a legible size in a 320px allocation', async () => {
    const el = await fixture<LyraChord>(html`
      <lr-chord style="inline-size: 320px" .entities=${ENTITIES} .matrix=${MATRIX}></lr-chord>
    `);
    const probe = document.createElement('span');
    probe.style.fontSize = 'var(--lr-font-size-xs)';
    el.shadowRoot!.append(probe);
    const token = parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    const label = el.shadowRoot!.querySelector<HTMLElement>('[part~="entity-label"]')!;
    const box = label.closest('foreignObject')!;
    const scale = box.getBoundingClientRect().height / box.height.baseVal.value;
    expect(parseFloat(getComputedStyle(label).fontSize)).to.equal(token);
    expect(parseFloat(getComputedStyle(label).fontSize) * scale).to.be.at.least(token * 0.95);
  });
});
