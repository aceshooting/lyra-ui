export { chartDataTableVisible } from '../../../internal/chart-data-table.js';

export function hasSlottedChartDataTable(element: Element): boolean {
  return Array.from(element.children).some((child) => child.getAttribute('slot') === 'data-table');
}

export function hasArraySeriesData(value: unknown): boolean {
  try {
    return typeof value === 'object' && value !== null && !Array.isArray(value) &&
      Array.isArray((value as { data?: unknown }).data);
  } catch {
    return false;
  }
}
