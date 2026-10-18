export const METRICS = Object.freeze(Object.fromEntries(
  ['assignmentMs', 'updateMs', 'settleMs', 'paintMs', 'totalMs',
    'noopAssignmentMs', 'noopUpdateMs', 'noopSettleMs', 'noopPaintMs', 'noopTotalMs']
    .map((key) => [key, { unit: 'ms', kind: key.toLowerCase().includes('assignment') ? 'synchronous' : 'elapsed' }]),
));

export const COUNT_KEYS = Object.freeze([
  'sourceCount', 'retainedCount', 'renderedRowCount', 'plottedRecordCount', 'tableCellCount',
  'formatterTableCalls', 'noopFormatterTableCalls', 'checkedLabels', 'shadowElementCount',
  'page', 'totalItems', 'viewRowCount', 'selectedCount', 'progressValue',
]);

export const ERROR_CODES = Object.freeze([
  'UNKNOWN_SCENARIO', 'INVALID_SAMPLE', 'BUSY', 'SETUP_FAILED', 'OPERATION_FAILED', 'TIMEOUT',
  'SEMANTIC_CHECK_FAILED', 'PEER_UNAVAILABLE', 'PAGE_NOT_VISIBLE',
]);

export const CHECK_IDS = Object.freeze([
  'control-connected', 'table-retained-count', 'table-truncation-state', 'table-page-bound',
  'table-rendered-values', 'table-total-items', 'table-controlled-page', 'table-view-values',
  'chart-peer-ready', 'chart-retained-count', 'chart-plot-bound', 'chart-table-bound',
  'chart-sample-endpoints', 'chart-plot-values', 'chart-table-values', 'chart-accessible-label',
  'option-catalog-count', 'option-labels-current', 'option-selected-label', 'option-stays-closed',
  'list-retained-count', 'list-render-bound', 'list-visible-values', 'list-selection-event', 'list-selection-state', 'list-progress-value',
]);

const both = ['quick', 'stress'];
const tableChecks = ['table-retained-count', 'table-truncation-state', 'table-page-bound', 'table-rendered-values'];
const chartChecks = ['chart-peer-ready', 'chart-retained-count', 'chart-plot-bound', 'chart-table-bound',
  'chart-sample-endpoints', 'chart-plot-values', 'chart-table-values', 'chart-accessible-label'];
const optionChecks = ['option-catalog-count', 'option-labels-current', 'option-selected-label', 'option-stays-closed'];

export const SCENARIOS = Object.freeze([
  ...[
    ['document-library-filter-10000', 10000, ['list-retained-count', 'list-render-bound', 'list-visible-values']],
    ['eval-dataset-select-10000', 10000, ['list-retained-count', 'list-render-bound', 'list-selection-event', 'list-selection-state']],
    ['retrieval-results-select-10000', 10000, ['list-retained-count', 'list-render-bound', 'list-selection-event', 'list-selection-state']],
    ['ingestion-queue-progress-5000', 5000, ['list-retained-count', 'list-render-bound', 'list-visible-values', 'list-progress-value']],
  ].map(([id, size, assertionIds]) => ({ id, family: 'list', size, profiles: both,
    parameters: { inputCount: size, renderBound: id.startsWith('document') || id.startsWith('eval') ? 100 : 40,
      ...(id.startsWith('retrieval') ? { retainedMin: 9999, retainedMax: 10000 } : {}) }, assertionIds })),
  { id: 'noop-control', family: 'control', size: 0, profiles: both,
    parameters: { inputCount: 0 }, assertionIds: ['control-connected'] },
  ...[1000, 10000].map((size) => ({ id: `table-assign-${size}`, family: 'table', size, profiles: both,
    parameters: { inputCount: size, pageSize: 100 }, assertionIds: tableChecks })),
  { id: 'table-sort-10000', family: 'table', size: 10000, profiles: both,
    parameters: { inputCount: 10000, pageSize: 100, numericSort: true },
    assertionIds: [...tableChecks, 'table-view-values'] },
  { id: 'table-filter-10000', family: 'table', size: 10000, profiles: both,
    parameters: { inputCount: 10000, pageSize: 100, matchingCount: 1000, textFilter: true },
    assertionIds: [...tableChecks, 'table-view-values'] },
  { id: 'table-million-boundary', family: 'table', size: 1000000, profiles: ['stress'],
    parameters: { inputCount: 1000000, pageSize: 100 }, assertionIds: tableChecks },
  { id: 'table-million-page', family: 'table', size: 1000000, profiles: ['stress'],
    parameters: { inputCount: 1000000, pageSize: 100, serverPagination: true },
    assertionIds: [...tableChecks, 'table-total-items', 'table-controlled-page'] },
  ...[1000, 10000].map((size) => ({ id: `chart-assign-${size}`, family: 'chart', size,
    profiles: size === 1000 ? both : ['stress'], parameters: { inputCount: size, plotBudget: 1000 },
    assertionIds: chartChecks })),
  { id: 'chart-label-only-1000', family: 'chart', size: 1000, profiles: both,
    parameters: { inputCount: 1000, plotBudget: 1000, labelOnly: true }, assertionIds: chartChecks },
  ...['select', 'combobox'].flatMap((tag) => [100, 1000, 5000].map((size) => ({
    id: `option-${tag}-metadata-${size}`, family: 'option', size,
    profiles: size === 5000 ? ['stress'] : both,
    parameters: { inputCount: size, closed: true }, assertionIds: optionChecks,
  }))),
]);
