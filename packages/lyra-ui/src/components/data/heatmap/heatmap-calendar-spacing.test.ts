import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './heatmap.js';
import type { LyraHeatmap, LyraHeatmapCalendarGeometry } from './heatmap.js';

type Calendar = Extract<LyraHeatmap['data'], { kind: 'calendar' }>;
// 2026-01-04 is a Sunday, so the default Sunday-first grid spans exactly three weeks.
const days = Array.from({ length: 21 }, (_, index) => ({
  date: `2026-01-${String(index + 4).padStart(2, '0')}`,
  value: index + 1,
}));
const data: Calendar = { kind: 'calendar', days };

function canvas(el: LyraHeatmap): HTMLCanvasElement {
  return el.shadowRoot!.querySelector<HTMLCanvasElement>('[part="canvas"]')!;
}
function draw(el: LyraHeatmap): void {
  (el as unknown as { drawCalendar(): void }).drawCalendar();
}
function alpha(el: LyraHeatmap, x: number, y: number): number {
  const target = canvas(el);
  const dpr = target.width / Number.parseFloat(target.style.width);
  return target.getContext('2d')!.getImageData(Math.floor(x * dpr), Math.floor(y * dpr), 1, 1).data[3]!;
}
function click(el: LyraHeatmap, x: number, y: number): void {
  const target = canvas(el);
  const rect = target.getBoundingClientRect();
  target.dispatchEvent(new MouseEvent('click', { clientX: rect.left + x, clientY: rect.top + y, bubbles: true }));
}
async function calendar(template = html`<lr-heatmap .data=${data}
  .cellColor=${() => 'rgb(20, 100, 180)'}></lr-heatmap>`): Promise<LyraHeatmap> {
  const el = await fixture<LyraHeatmap>(template);
  draw(el);
  return el;
}
function canvasSize(el: LyraHeatmap): [number, number] {
  const target = canvas(el);
  return [Number.parseFloat(target.style.width), Number.parseFloat(target.style.height)];
}

const DEFAULT_GEOMETRY: LyraHeatmapCalendarGeometry = {
  padLeft: 28,
  padTop: 16,
  cellSize: 11,
  cellWidth: 11,
  cellHeight: 11,
  cellGapX: 2,
  cellGapY: 2,
  cellRadius: 0,
  weekCount: 3,
  firstDayOfWeek: 0,
};

describe('lr-heatmap calendar cell spacing', () => {
  it('keeps the original calendar geometry and pixels while the spacing controls are unset', async () => {
    const el = await calendar();
    expect([el.cellGapX, el.cellGapY, el.cellRadius]).to.deep.equal([1, 1, 0]);
    expect(el.calendarGeometry).to.deep.equal(DEFAULT_GEOMETRY);
    expect(canvasSize(el)).to.deep.equal([28 + 3 * 13, 16 + 7 * 13]);
    // Original 2px separators between columns and rows, square corners.
    expect(alpha(el, 33, 21)).to.equal(255);
    expect(alpha(el, 40, 21)).to.equal(0);
    expect(alpha(el, 33, 28)).to.equal(0);
    expect(alpha(el, 28, 16)).to.equal(255);

    const reference = await calendar();
    const original = canvas(reference).toDataURL();
    expect(canvas(el).toDataURL() === original).to.equal(true);
  });

  it('treats an explicit value equal to the matrix default as an explicit calendar request', async () => {
    const el = await calendar(html`<lr-heatmap cell-gap-x="1" cell-gap-y="1" .data=${data}
      .cellColor=${() => 'rgb(20, 100, 180)'}></lr-heatmap>`);
    expect(el.calendarGeometry).to.include({ cellGapX: 1, cellGapY: 1 });
    expect(canvasSize(el)).to.deep.equal([28 + 3 * 12, 16 + 7 * 12]);
  });

  it('returns to the original spacing when the attribute is removed', async () => {
    const el = await calendar(html`<lr-heatmap cell-gap-x="5" cell-radius="3" .data=${data}
      .cellColor=${() => 'rgb(20, 100, 180)'}></lr-heatmap>`);
    expect(el.calendarGeometry).to.include({ cellGapX: 5, cellRadius: 3 });
    el.removeAttribute('cell-gap-x');
    el.removeAttribute('cell-radius');
    await el.updateComplete;
    draw(el);
    expect(el.calendarGeometry).to.deep.equal(DEFAULT_GEOMETRY);
  });

  for (const direction of ['ltr', 'rtl']) {
    it(`paints and hit-tests explicit gaps and radius in ${direction}`, async () => {
      const el = await calendar();
      el.dir = direction;
      el.cellGapX = 4;
      el.cellGapY = 3;
      el.cellRadius = 3;
      await el.updateComplete;
      draw(el);
      const geometry = el.calendarGeometry!;
      expect(geometry).to.deep.equal({ ...DEFAULT_GEOMETRY, cellGapX: 4, cellGapY: 3, cellRadius: 3 });
      expect(Object.isFrozen(geometry)).to.equal(true);
      expect(canvasSize(el)).to.deep.equal([28 + 3 * 15, 16 + 7 * 14]);
      // Week 1 starts at 28 + 15 = 43; weekday 1 at 16 + 14 = 30.
      expect(alpha(el, 48, 35)).to.equal(255);
      expect(alpha(el, 41, 35)).to.equal(0);
      expect(alpha(el, 48, 28)).to.equal(0);
      // Rounded corner leaves the extreme corner pixel transparent or partial.
      expect(alpha(el, 43, 30)).to.be.lessThan(255);

      const clicks: unknown[] = [];
      el.addEventListener('lr-cell-click', event => clicks.push(event.detail));
      click(el, 41, 35);
      click(el, 48, 28.5);
      expect(clicks.length).to.equal(0);
      click(el, 48, 35);
      // Week 1, weekday 1 (Monday) of a grid anchored at Sunday 2026-01-04.
      expect(clicks).to.deep.equal([{ date: '2026-01-12', value: 9 }]);
    });
  }

  it('clamps explicit spacing with the matrix bounds and falls back for non-finite input', async () => {
    const el = await calendar();
    el.cellGapX = 400;
    el.cellGapY = -3;
    el.cellRadius = 99;
    await el.updateComplete;
    draw(el);
    expect(el.calendarGeometry).to.include({ cellGapX: 10, cellGapY: 0, cellRadius: 5.5 });
    el.cellGapX = Number.NaN;
    el.cellRadius = Number.POSITIVE_INFINITY;
    await el.updateComplete;
    draw(el);
    expect(el.calendarGeometry).to.include({ cellGapX: 2, cellRadius: 0 });
  });

  it('maps date selection and semantic cells through explicit gaps', async () => {
    const el = await calendar();
    el.cellGapX = 6;
    el.cellGapY = 5;
    el.accessibleCells = true;
    el.multiple = true;
    await el.updateComplete;
    draw(el);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="cell"]').length > 0);
    await el.updateComplete;
    const geometry = el.calendarGeometry!;
    expect(geometry).to.include({ cellSize: 40, cellGapX: 6, cellGapY: 5 });
    const first = el.shadowRoot!.querySelector<HTMLElement>('[part="cell"][data-cell-key="calendar-0-0"]')!;
    const cells = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="cell"]')];
    const lefts = [...new Set(cells.map(cell => Math.round(cell.getBoundingClientRect().left)))].sort((a, b) => a - b);
    const tops = [...new Set(cells.map(cell => Math.round(cell.getBoundingClientRect().top)))].sort((a, b) => a - b);
    expect(lefts[1]! - lefts[0]!).to.equal(46);
    expect(tops[1]! - tops[0]!).to.equal(45);
    expect(Math.round(first.getBoundingClientRect().width)).to.equal(40);

    const proposals: unknown[] = [];
    el.addEventListener('lr-selection-change', event => proposals.push(event.detail.selectedCells));
    // Week 2, weekday 3: x = 28 + 2 * 46 + 10, y = 16 + 3 * 45 + 10.
    click(el, 130, 161);
    expect(proposals).to.deep.equal([[{ date: '2026-01-21' }]]);
    // The gap between weeks 1 and 2 (x 114..120) selects nothing.
    click(el, 116, 161);
    expect(proposals.length).to.equal(1);
    await expect(el).to.be.accessible();
  });

  it('fits explicit gaps inside the host width', async () => {
    const el = await calendar(html`<lr-heatmap style="display:block;width:200px" fit-to-width
      cell-gap-x="4" .data=${data} .cellColor=${() => 'rgb(20, 100, 180)'}></lr-heatmap>`);
    const geometry = el.calendarGeometry!;
    expect(geometry.cellGapX).to.equal(4);
    expect(geometry.cellSize).to.be.closeTo((200 - 28) / 3 - 4, 0.001);
    expect(canvasSize(el)[0]).to.be.closeTo(200, 0.001);
  });

  it('lets caller-supplied columnX/rowY origins win over explicit gaps', async () => {
    const el = await calendar(html`<lr-heatmap cell-gap-x="4" cell-gap-y="4" .data=${{
      ...data,
      columnX: (week: number) => 100 + week * 20,
      rowY: (weekday: number) => 30 + weekday * 12,
    }} .cellColor=${() => 'rgb(20, 100, 180)'}></lr-heatmap>`);
    expect(el.calendarGeometry).to.include({ cellGapX: 4, cellGapY: 4 });
    expect(alpha(el, 105, 35)).to.equal(255);
    expect(alpha(el, 98, 35)).to.equal(0);
    const clicks: unknown[] = [];
    el.addEventListener('lr-cell-click', event => clicks.push(event.detail));
    click(el, 125, 47);
    expect(clicks).to.deep.equal([{ date: '2026-01-12', value: 9 }]);
  });

  it('reports calendarGeometry only for a painted calendar and ignores assignment', async () => {
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap></lr-heatmap>`);
    expect(el.calendarGeometry).to.equal(undefined);
    el.data = data;
    await el.updateComplete;
    draw(el);
    const painted = el.calendarGeometry;
    expect(painted).to.deep.equal(DEFAULT_GEOMETRY);
    el.calendarGeometry = { ...DEFAULT_GEOMETRY, cellSize: 99 };
    expect(el.calendarGeometry === painted).to.equal(true);
    el.data = { kind: 'matrix', rowLabels: ['a'], colLabels: ['b'], values: [[1]] };
    await el.updateComplete;
    expect(el.calendarGeometry).to.equal(undefined);
  });

  it('reports firstDayOfWeek and a changed week count in the snapshot', async () => {
    const el = await calendar(html`<lr-heatmap .data=${{ ...data, firstDayOfWeek: 1 }}></lr-heatmap>`);
    expect(el.calendarGeometry).to.include({ firstDayOfWeek: 1, weekCount: 4 });
  });
});

describe('calendarGeometry / lr-calendar-geometry-change', () => {
  it('fires once when cellGapX/cellGapY/cellRadius change the painted geometry', async () => {
    const el = await calendar();
    let count = 0;
    let detail: LyraHeatmapCalendarGeometry | undefined;
    el.addEventListener('lr-calendar-geometry-change', (event) => {
      count++;
      detail = (event as CustomEvent<LyraHeatmapCalendarGeometry>).detail;
    });
    el.cellGapX = 4;
    el.cellGapY = 3;
    el.cellRadius = 3;
    await el.updateComplete;
    draw(el);
    expect(count, 'one geometry change produces one event').to.equal(1);
    expect(detail).to.deep.equal(el.calendarGeometry);
  });

  it('does not refire on a redraw with unchanged geometry', async () => {
    const el = await calendar();
    let count = 0;
    el.addEventListener('lr-calendar-geometry-change', () => count++);
    // Same data and spacing -- a redundant redraw must not refire the event.
    draw(el);
    expect(count, 'a redraw with unchanged geometry must not refire').to.equal(0);
  });

  it('is undefined in matrix mode and never fires there', async () => {
    const el = await fixture<LyraHeatmap>(html`<lr-heatmap></lr-heatmap>`);
    let count = 0;
    el.addEventListener('lr-calendar-geometry-change', () => count++);
    el.data = { kind: 'matrix', rowLabels: ['a'], colLabels: ['x'], values: [[1]] };
    await el.updateComplete;
    (el as unknown as { draw(): void }).draw();
    expect(el.calendarGeometry).to.equal(undefined);
    expect(count).to.equal(0);
  });

  it('returns the very object the geometry event carried, so the two can never disagree', async () => {
    const el = await calendar();
    let detail: unknown;
    el.addEventListener('lr-calendar-geometry-change', (event) => {
      detail = (event as CustomEvent).detail;
    });
    el.cellGapX = 6;
    await el.updateComplete;
    draw(el);
    // A redundant redraw with identical geometry must not replace the shared frozen detail object.
    draw(el);
    expect(detail).to.equal(el.calendarGeometry);
    expect(Object.isFrozen(el.calendarGeometry), 'the shared object must not be mutable').to.be.true;
  });
});
