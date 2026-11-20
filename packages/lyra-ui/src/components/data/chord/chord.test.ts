import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
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
    const rows = [...el.shadowRoot!.querySelectorAll('tbody tr')].map((row) =>
      row.textContent?.replace(/\s+/g, ' ').trim(),
    );
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
    expect(toggle.getAttribute('aria-controls')).to.equal(table.id);
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');

    await focusByKeyboard(toggle);
    await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
    expect(table.getBoundingClientRect().height).to.be.greaterThan(1);
    await expect(el).to.be.accessible();
  });

  it('navigates logical entity order and returns from an incident ribbon to its originating entity', async () => {
    const el = await fixture<LyraChord>(html`<lr-chord .entities=${ENTITIES} .matrix=${MATRIX}></lr-chord>`);
    await focusByKeyboard(entity(el, 'Sales'));
    await sendKeys({ press: 'ArrowRight' });
    expect(focusLabel(el)).to.include('Support');
    await sendKeys({ press: 'ArrowDown' });
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('ribbon');
    expect(focusLabel(el)).to.include('Sales / Support');
    await sendKeys({ press: 'ArrowRight' });
    expect(focusLabel(el)).to.include('Support / Product');
    await sendKeys({ press: 'Home' });
    expect(focusLabel(el)).to.include('Sales / Support');
    await sendKeys({ press: 'End' });
    expect(focusLabel(el)).to.include('Support / Product');
    await sendKeys({ press: 'ArrowLeft' });
    expect(focusLabel(el)).to.include('Sales / Support');
    await sendKeys({ press: 'ArrowUp' });
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('entity');
    expect(focusLabel(el)).to.include('Support');

    await sendKeys({ press: 'End' });
    expect(focusLabel(el)).to.include('Design');
    await sendKeys({ press: 'Home' });
    expect(focusLabel(el)).to.include('Sales');
    await sendKeys({ press: 'ArrowDown' });
    expect(focusLabel(el)).to.include('Sales / Sales');
    await sendKeys({ press: 'End' });
    expect(focusLabel(el)).to.include('Sales / Support');
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
      <lr-chord .entities=${ENTITIES.slice(0, 2)} .matrix=${[[0, 1], [1, Number.MIN_VALUE]]}
        .strings=${{ chartInputLimit: 'A pair is too small to draw' }}
      ></lr-chord>
    `);
    expect(marks(el, 'entity').length).to.equal(2);
    expect(marks(el, 'ribbon').map((mark) => mark.getAttribute('aria-label'))).to.deep.equal([
      'Sales / Support: 1',
    ]);
    expect(el.shadowRoot!.querySelectorAll('tbody tr').length).to.equal(1);
    expect(partText(el, 'limit')).to.equal('A pair is too small to draw');
    expect(partText(el, 'error')).to.equal('');
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
});
