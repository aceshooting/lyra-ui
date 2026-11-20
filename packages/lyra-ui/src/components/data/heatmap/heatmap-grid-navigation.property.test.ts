import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import {
  firstInteractiveMatrixCell,
  hitTestMatrix,
  isoDateAtOffset,
  nextInteractiveCalendarCell,
  nextInteractiveMatrixCell,
  type CalendarGridPosition,
  type MatrixGridPosition,
} from './heatmap-grid-navigation.js';

const dims = fc.record({ rows: fc.integer({ min: 1, max: 12 }), cols: fc.integer({ min: 1, max: 12 }) });
const blocked = fc.array(fc.boolean(), { minLength: 144, maxLength: 144 });
const step = fc.constantFrom(-1, 0, 1);

describe('heatmap grid navigation properties', () => {
  it('moves to an interactive in-bounds cell or stays on the origin', () => {
    fc.assert(fc.property(dims, blocked, fc.nat(), fc.nat(), step, step, ({ rows, cols }, mask, r, c, dRow, dCol) => {
      const row = r % rows;
      const col = c % cols;
      const interactive = (p: MatrixGridPosition): boolean => !mask[p.row * 12 + p.col];
      const next = nextInteractiveMatrixCell(row, col, dRow, dCol, rows, cols, interactive);
      const stayed = next.row === row && next.col === col;
      const inBounds = next.row >= 0 && next.row < rows && next.col >= 0 && next.col < cols;
      expect(inBounds, 'in bounds').to.equal(true);
      expect(stayed || interactive(next), 'lands on an interactive cell').to.equal(true);
      if (!stayed) {
        const dr = Math.sign(next.row - row);
        const dc = Math.sign(next.col - col);
        expect((dRow === 0 ? dr === 0 : dr === dRow || dr === 0) && (dCol === 0 ? dc === 0 : dc === dCol || dc === 0), 'only moves along the requested direction').to.equal(true);
      }
    }), propertyRuns());
  });

  it('finds the first interactive cell in row-major order, or none', () => {
    fc.assert(fc.property(dims, blocked, ({ rows, cols }, mask) => {
      const interactive = (p: MatrixGridPosition): boolean => !mask[p.row * 12 + p.col];
      const first = firstInteractiveMatrixCell(rows, cols, interactive);
      const all: MatrixGridPosition[] = [];
      for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) if (interactive({ row, col })) all.push({ row, col });
      expect(first, 'first in row-major order').to.deep.equal(all[0] ?? null);
    }), propertyRuns());
  });

  it('hit-tests the cell whose rectangle contains the point and nothing outside the grid', () => {
    fc.assert(fc.property(
      dims,
      fc.integer({ min: 0, max: 20 }),
      fc.integer({ min: 0, max: 20 }),
      fc.integer({ min: 4, max: 30 }),
      fc.double({ min: -50, max: 500, noNaN: true }),
      fc.double({ min: -50, max: 500, noNaN: true }),
      ({ rows, cols }, padLeft, padTop, cellSize, x, y) => {
        const geometry = { rows, cols, padLeft, padTop, cellSize, cellWidth: cellSize, cellHeight: cellSize, customShape: false };
        const hit = hitTestMatrix(x, y, geometry, () => true);
        const inside = x >= padLeft && y >= padTop && x < padLeft + cols * cellSize && y < padTop + rows * cellSize;
        expect(hit !== null, 'hit exactly inside the grid').to.equal(inside);
        if (hit) {
          expect(x >= padLeft + hit.col * cellSize && x < padLeft + (hit.col + 1) * cellSize, 'column contains x').to.equal(true);
          expect(y >= padTop + hit.row * cellSize && y < padTop + (hit.row + 1) * cellSize, 'row contains y').to.equal(true);
        }
      }), propertyRuns());
  });

  it('keeps calendar navigation inside the week/weekday grid', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 30 }), fc.nat(), fc.nat(), step, step, blocked, (weekCount, w, d, dWeek, dDay, mask) => {
      const week = w % weekCount;
      const weekday = d % 7;
      const positionAt = (wk: number, wd: number): CalendarGridPosition => ({ week: wk, weekday: wd, date: `${wk}:${wd}` });
      const interactive = (p: CalendarGridPosition): boolean => !mask[(p.week * 7 + p.weekday) % 144];
      const next = nextInteractiveCalendarCell(week, weekday, dWeek, dDay, weekCount, positionAt, interactive);
      expect(next.week >= 0 && next.week < weekCount && next.weekday >= 0 && next.weekday <= 6, 'in bounds').to.equal(true);
      expect((next.week === week && next.weekday === weekday) || interactive(next), 'interactive or unmoved').to.equal(true);
    }), propertyRuns());
  });

  it('formats a day offset as the ISO date that many days after the week start', () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 20000 }), fc.integer({ min: -400, max: 4000 }), (start, offset) => {
      const origin = new Date(start * 86_400_000);
      const iso = isoDateAtOffset(origin, offset);
      expect(iso).to.match(/^\d{4}-\d{2}-\d{2}$/);
      expect(Date.parse(`${iso}T00:00:00Z`) - origin.getTime(), 'exactly offset days later').to.equal(offset * 86_400_000);
    }), propertyRuns());
  });
});
