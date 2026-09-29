import { expect } from '@open-wc/testing';
import {
  accessibleMatrixCellRect,
  calendarCellAt,
  calendarCellRect,
  firstInteractiveCalendarCell,
  firstInteractiveMatrixCell,
  hitTestCalendar,
  hitTestMatrix,
  matrixCellRect,
  nextInteractiveCalendarCell,
  nextInteractiveMatrixCell,
  type MatrixNavigationGeometry,
} from './heatmap-grid-navigation.js';

const matrixGeometry: MatrixNavigationGeometry = {
  rows: 2,
  cols: 2,
  padLeft: 40,
  padTop: 20,
  cellSize: 10,
  cellWidth: 8,
  cellHeight: 7,
  customShape: true,
};

it('hit-tests matrix edges and ignores the gaps left by a custom cell shape', () => {
  const interactive: { row: number; col: number }[] = [];
  expect(hitTestMatrix(40, 20, matrixGeometry, (pos) => (interactive.push(pos), true))).to.deep.equal({ row: 0, col: 0 });
  expect(hitTestMatrix(48, 20, matrixGeometry, () => true)).to.equal(null);
  expect(hitTestMatrix(40, 27, matrixGeometry, () => true)).to.equal(null);
  expect(hitTestMatrix(60, 20, matrixGeometry, () => true)).to.equal(null);
  expect(hitTestMatrix(40, 40, matrixGeometry, () => true)).to.equal(null);
  expect(interactive).to.have.length(1);
});

it('keeps matrix navigation bounded and skips excluded cells', () => {
  const isInteractive = ({ row, col }: { row: number; col: number }) => col !== 1 || row === 1;
  expect(firstInteractiveMatrixCell(2, 2, isInteractive)).to.deep.equal({ row: 0, col: 0 });
  expect(nextInteractiveMatrixCell(0, 0, 0, 1, 2, 2, isInteractive)).to.deep.equal({ row: 0, col: 0 });
  expect(nextInteractiveMatrixCell(1, 1, 0, 1, 2, 2, isInteractive)).to.deep.equal({ row: 1, col: 1 });
  expect(nextInteractiveMatrixCell(
    0,
    0,
    1,
    1,
    3,
    3,
    ({ row, col }) => row === 2 && col === 2,
  )).to.deep.equal({ row: 2, col: 2 });
  expect(firstInteractiveMatrixCell(0, 2, isInteractive)).to.equal(null);
});

it('honors calendar week and weekday gaps and excludes the final geometry edge', () => {
  const dateAt = (week: number, weekday: number) => ({
    week,
    weekday,
    date: `2026-01-${String(week * 7 + weekday + 1).padStart(2, '0')}`,
  });
  const geometry = {
    weekCount: 2,
    columnPositions: [31, 45, 59],
    rowPositions: [17, 31, 45, 59, 73, 87, 101, 115],
    cellSize: () => 10,
    rowPositionsForHitTest: () => geometry.rowPositions,
    padLeft: 31,
    padTop: 17,
  };
  const isInteractive = () => true;
  const hitTest = (x: number, y: number) => hitTestCalendar(
    x,
    y,
    geometry.weekCount,
    geometry.columnPositions,
    geometry.cellSize,
    geometry.rowPositionsForHitTest,
    dateAt,
    isInteractive,
  );
  expect(hitTest(31, 17)).to.deep.equal(dateAt(0, 0));
  expect(hitTest(45, 31)).to.deep.equal(dateAt(1, 1));
  expect(hitTest(41, 17)).to.equal(null);
  expect(hitTest(31, 27)).to.equal(null);
  expect(hitTest(59, 17)).to.equal(null);
  expect(hitTest(31, 115)).to.equal(null);
});

it('keeps calendar geometry getters lazy and in their existing order during hit tests', () => {
  const calls: string[] = [];
  const cellSize = () => (calls.push('cell-size'), 10);
  const rowPositions = () => (calls.push('row-positions'), [17, 27, 37, 47, 57, 67, 77]);
  const positionAt = (week: number, weekday: number) => (calls.push('position'), { week, weekday, date: '2026-01-01' });
  const isInteractive = () => (calls.push('interactive'), true);

  expect(hitTestCalendar(42, 17, 1, [31, 41], cellSize, rowPositions, positionAt, isInteractive)).to.equal(null);
  expect(calls).to.deep.equal(['cell-size']);
  calls.length = 0;

  expect(hitTestCalendar(31, 17, 1, [31, 41], cellSize, rowPositions, positionAt, isInteractive)).to.deep.equal({
    week: 0,
    weekday: 0,
    date: '2026-01-01',
  });
  expect(calls).to.deep.equal(['cell-size', 'row-positions', 'cell-size', 'position', 'interactive']);
  calls.length = 0;
  expect(hitTestCalendar(31, 17, 0, [], cellSize, rowPositions, positionAt, isInteractive)).to.equal(null);
  expect(calls).to.deep.equal([]);
});

it('bounds calendar navigation and resolves sparse positions to their real dates', () => {
  const positionAt = (week: number, weekday: number) => ({
    week,
    weekday,
    date: `2026-01-${String(week * 7 + weekday + 1).padStart(2, '0')}`,
  });
  expect(firstInteractiveCalendarCell(2, positionAt, (pos) => pos.weekday === 2)).to.deep.equal(positionAt(0, 2));
  expect(nextInteractiveCalendarCell(0, 0, 0, 1, 2, positionAt, (pos) => pos.weekday === 2)).to.deep.equal(positionAt(0, 2));
  expect(nextInteractiveCalendarCell(1, 6, 0, 1, 2, positionAt, () => true)).to.deep.equal(positionAt(1, 6));

  const firstWeekStart = new Date('2026-01-04T00:00:00.000Z');
  const cachedCell = { date: '2026-01-05', value: 9, week: 0, weekday: 1 };
  expect(calendarCellAt(0, 1, new Map([['0:1', cachedCell]]), [], firstWeekStart, false)).to.deep.equal({ date: '2026-01-05', value: 9 });
  expect(calendarCellAt(1, 6, new Map(), [], firstWeekStart, true)).to.deep.equal({ date: '2026-01-17', value: Number.NaN });
});

it('preserves frozen-axis offsets in canvas and last-painted accessibility rectangles', () => {
  expect(matrixCellRect({ row: 1, col: 1 }, matrixGeometry)).to.deep.equal({ x: 50, y: 30, w: 8, h: 7 });
  expect(accessibleMatrixCellRect({ row: 1, col: 1 }, { padLeft: 33, padTop: 11, cellSize: 12 })).to.deep.equal({ x: 45, y: 23, w: 11, h: 11 });
  expect(calendarCellRect(1, 2, {
    weekCount: 1,
    cellSize: 8,
    columnPositions: [28],
    rowPositions: [18, 28, 38],
    padLeft: 28,
    padTop: 18,
  })).to.deep.equal({ x: 28, y: 38, w: 8, h: 8 });
});
