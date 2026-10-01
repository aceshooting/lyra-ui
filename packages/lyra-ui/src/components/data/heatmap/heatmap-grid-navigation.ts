import type { CalendarCell } from './calendar-grid.js';

const MS_PER_DAY = 86_400_000;

export interface MatrixGridPosition {
  row: number;
  col: number;
}

export interface CalendarGridPosition {
  week: number;
  weekday: number;
  date: string;
}

export interface MatrixNavigationGeometry {
  readonly rows: number;
  readonly cols: number;
  readonly padLeft: number;
  readonly padTop: number;
  readonly cellSize: number;
  readonly rowHeight?: number;
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly customShape: boolean;
}

export interface CalendarNavigationGeometry {
  readonly weekCount: number;
  readonly cellSize: number;
  readonly padLeft: number;
  readonly padTop: number;
  /** Existing validated/cache-owned positions; callers must not copy these per interaction. */
  readonly columnPositions: readonly number[];
  /** Existing validated/cache-owned positions; callers must not copy these per interaction. */
  readonly rowPositions: readonly number[];
}

export interface PaintedMatrixCellGeometry {
  readonly padLeft: number;
  readonly padTop: number;
  readonly cellSize: number;
  readonly rowHeight?: number;
  readonly cellWidth?: number;
  readonly cellHeight?: number;
}

export interface CellRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Canvas-local matrix hit test against the same resolved geometry used by drawing. */
export function hitTestMatrix(
  x: number,
  y: number,
  geometry: MatrixNavigationGeometry,
  isInteractive: (position: MatrixGridPosition) => boolean,
): MatrixGridPosition | null {
  const { rows, cols, cellSize, padLeft, padTop } = geometry;
  if (rows === 0 || cols === 0) return null;
  const col = Math.floor((x - padLeft) / cellSize);
  const row = Math.floor((y - padTop) / (geometry.rowHeight ?? cellSize));
  if (row < 0 || row >= rows || col < 0 || col >= cols) return null;
  if (
    geometry.customShape &&
    (x - padLeft - col * cellSize >= geometry.cellWidth ||
      y - padTop - row * (geometry.rowHeight ?? cellSize) >= geometry.cellHeight)
  ) {
    return null;
  }
  const position = { row, col };
  return isInteractive(position) ? position : null;
}

export function firstInteractiveMatrixCell(
  rows: number,
  cols: number,
  isInteractive: (position: MatrixGridPosition) => boolean,
): MatrixGridPosition | null {
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const position = { row, col };
      if (isInteractive(position)) return position;
    }
  }
  return null;
}

export function nextInteractiveMatrixCell(
  row: number,
  col: number,
  dRow: number,
  dCol: number,
  rows: number,
  cols: number,
  isInteractive: (position: MatrixGridPosition) => boolean,
): MatrixGridPosition {
  let nextRow = row;
  let nextCol = col;
  for (;;) {
    const candidateRow = Math.min(rows - 1, Math.max(0, nextRow + dRow));
    const candidateCol = Math.min(cols - 1, Math.max(0, nextCol + dCol));
    if (candidateRow === nextRow && candidateCol === nextCol) {
      return { row, col };
    }
    nextRow = candidateRow;
    nextCol = candidateCol;
    const position = { row: nextRow, col: nextCol };
    if (isInteractive(position)) return position;
  }
}

export function hitTestCalendar(
  x: number,
  y: number,
  weekCount: number,
  columnPositions: readonly number[],
  cellSize: () => number,
  rowPositions: () => readonly number[],
  positionAt: (week: number, weekday: number) => CalendarGridPosition,
  isInteractive: (position: CalendarGridPosition) => boolean,
): CalendarGridPosition | null {
  if (weekCount === 0) return null;
  const resolvedCellSize = cellSize();
  let week: number | null = null;
  for (let index = 0; index < weekCount; index++) {
    const start = columnPositions[index]!;
    if (x >= start && x < start + resolvedCellSize) {
      week = index;
      break;
    }
  }
  if (week === null) return null;
  const resolvedRows = rowPositions();
  const resolvedRowCellSize = cellSize();
  let weekday: number | null = null;
  for (let index = 0; index < 7; index++) {
    const start = resolvedRows[index]!;
    if (y >= start && y < start + resolvedRowCellSize) {
      weekday = index;
      break;
    }
  }
  if (weekday === null) return null;
  const position = positionAt(week, weekday);
  return isInteractive(position) ? position : null;
}

export function firstInteractiveCalendarCell(
  weekCount: number,
  positionAt: (week: number, weekday: number) => CalendarGridPosition,
  isInteractive: (position: CalendarGridPosition) => boolean,
): CalendarGridPosition | null {
  for (let week = 0; week < weekCount; week++) {
    for (let weekday = 0; weekday < 7; weekday++) {
      const position = positionAt(week, weekday);
      if (isInteractive(position)) return position;
    }
  }
  return null;
}

export function nextInteractiveCalendarCell(
  week: number,
  weekday: number,
  dWeek: number,
  dWeekday: number,
  weekCount: number,
  positionAt: (week: number, weekday: number) => CalendarGridPosition,
  isInteractive: (position: CalendarGridPosition) => boolean,
): CalendarGridPosition {
  let nextWeek = week;
  let nextWeekday = weekday;
  for (;;) {
    const candidateWeek = Math.min(weekCount - 1, Math.max(0, nextWeek + dWeek));
    const candidateWeekday = Math.min(6, Math.max(0, nextWeekday + dWeekday));
    if (candidateWeek === nextWeek && candidateWeekday === nextWeekday) {
      return positionAt(week, weekday);
    }
    nextWeek = candidateWeek;
    nextWeekday = candidateWeekday;
    const position = positionAt(nextWeek, nextWeekday);
    if (isInteractive(position)) return position;
  }
}

export function calendarDateAt(
  week: number,
  weekday: number,
  datesByPosition: readonly string[],
  firstWeekStart: Date,
): string {
  const index = week * 7 + weekday;
  return (
    datesByPosition[index] ??
    new Date(firstWeekStart.getTime() + index * MS_PER_DAY)
      .toISOString()
      .slice(0, 10)
  );
}

export function calendarCellAt(
  week: number,
  weekday: number,
  cellsByPosition: ReadonlyMap<string, CalendarCell>,
  datesByPosition: readonly string[],
  firstWeekStart: Date,
  signedDomain: boolean,
): { date: string; value: number } {
  const cell = cellsByPosition.get(`${week}:${weekday}`);
  if (cell) return { date: cell.date, value: cell.value };
  return {
    date: calendarDateAt(week, weekday, datesByPosition, firstWeekStart),
    value: signedDomain ? Number.NaN : -1,
  };
}

export function calendarValueAt(
  week: number,
  weekday: number,
  cellsByPosition: ReadonlyMap<string, CalendarCell>,
  signedDomain: boolean,
): number {
  const cell = cellsByPosition.get(`${week}:${weekday}`);
  return cell ? cell.value : signedDomain ? Number.NaN : -1;
}

export function matrixCellRect(
  position: MatrixGridPosition,
  geometry: MatrixNavigationGeometry,
): CellRect {
  return {
    x: geometry.padLeft + position.col * geometry.cellSize,
    y: geometry.padTop + position.row * (geometry.rowHeight ?? geometry.cellSize),
    w: geometry.cellWidth,
    h: geometry.cellHeight,
  };
}

export function calendarCellRect(
  week: number,
  weekday: number,
  geometry: CalendarNavigationGeometry,
): CellRect {
  return {
    x: geometry.columnPositions[week] ?? geometry.padLeft,
    y: geometry.rowPositions[weekday] ?? geometry.padTop,
    w: geometry.cellSize,
    h: geometry.cellSize,
  };
}

export function accessibleMatrixCellRect(
  position: MatrixGridPosition,
  painted: PaintedMatrixCellGeometry,
): CellRect {
  return {
    x: painted.padLeft + position.col * painted.cellSize,
    y: painted.padTop + position.row * (painted.rowHeight ?? painted.cellSize),
    w: painted.cellWidth ?? painted.cellSize - 1,
    h: painted.cellHeight ?? painted.cellSize - 1,
  };
}
