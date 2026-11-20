/** Visible by default when requested; a disclosure can override that initial choice. */
export function chartDataTableVisible(
  withDataTable: boolean,
  dataTableToggle: boolean,
  expandedOverride: boolean | null,
): boolean {
  return dataTableToggle ? expandedOverride ?? withDataTable : withDataTable;
}
