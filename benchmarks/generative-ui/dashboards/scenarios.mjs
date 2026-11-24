/**
 * Authored dashboard scenarios. Each is a plain `LyraGenView` against the dashboard catalog overlay
 * (`dashboardCatalog()`); the harness derives every other encoding from it. The root id is always
 * `root` so the statement-language encoding can use its conventional `root = ...` first line.
 * Values are synthetic; nothing here was produced by a model.
 */
export const CATALOG_NOTE = 'dashboardCatalog() overlay over the reviewed built-in catalog';

const n = (id, type, props, rest = {}) => ({ id, type, ...(props && Object.keys(props).length ? { props } : {}), ...rest });
const box = (type, id, children, props) => n(id, type, props, { children });
const stack = (children, id = 'root') => box('stack', id, children);
const heading = (id, text) => n(id, 'heading', undefined, { text });
const text = (id, value) => n(id, 'text', undefined, { text: value });
const stat = (id, label, value, extra = {}) => n(id, 'stat', { label, value, ...extra });
const cols = (...labels) => labels.map((label, index) => ({ key: `c${index}`, label, sortable: index > 0 }));
const rowsOf = (matrix) => matrix.map(row => Object.fromEntries(row.map((value, index) => [`c${index}`, value])));
const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];

export const scenarios = [
  {
    id: 'kpi-overview', title: 'KPI overview',
    root: stack([
      heading('title', 'Business overview'),
      box('row', 'kpis', [
        stat('kpi-revenue', 'Revenue', '1.25M', { unit: 'EUR', deltaPercent: 4.2, goodDirection: 'up', variant: 'success' }),
        stat('kpi-orders', 'Orders', '18,402', { deltaPercent: -1.3, goodDirection: 'up', variant: 'warning' }),
        stat('kpi-churn', 'Churn', '2.1', { unit: '%', deltaPercent: -0.4, goodDirection: 'down', variant: 'success' }),
        stat('kpi-nps', 'NPS', '54', { caption: 'Quarter to date' })
      ]),
      n('trend', 'chart', { label: 'Revenue by month', type: 'line', labels: months, datasets: [{ label: 'Revenue', data: [820, 910, 880, 1010, 1120, 1250] }] })
    ])
  },
  {
    id: 'ops-latency', title: 'Ops and latency',
    root: stack([
      heading('title', 'Service latency'),
      box('row', 'gauges', [
        n('p50', 'gauge', { label: 'p50 latency', value: 42, min: 0, max: 200, valueText: '42 ms', thresholds: [{ at: 0, variant: 'success' }, { at: 120, variant: 'danger' }] }),
        n('p99', 'gauge', { label: 'p99 latency', value: 168, min: 0, max: 400, valueText: '168 ms', thresholds: [{ at: 0, variant: 'success' }, { at: 250, variant: 'warning' }, { at: 350, variant: 'danger' }] })
      ]),
      n('latency-trend', 'chart', { label: 'p99 over the last 12 intervals', type: 'line', labels: Array.from({ length: 12 }, (_, i) => `t${i}`), datasets: [{ label: 'p99 ms', data: [150, 162, 158, 171, 190, 184, 176, 168, 160, 166, 170, 168] }, { label: 'p50 ms', data: [40, 41, 43, 44, 47, 46, 45, 43, 42, 41, 42, 42] }] }),
      n('errors-spark', 'sparkline', { label: 'Error count', values: [3, 2, 4, 9, 6, 5, 3, 2], trend: 'negative' }),
      n('hosts', 'table', { caption: 'Slowest hosts', columns: cols('Host', 'p99 ms', 'Errors'), rows: rowsOf([['web-1', 210, 4], ['web-4', 188, 2], ['api-2', 176, 7], ['api-3', 151, 0]]) })
    ])
  },
  {
    id: 'funnel', title: 'Conversion funnel',
    root: stack([
      heading('title', 'Acquisition funnel'),
      n('signup-funnel', 'funnel', { label: 'Sign-up funnel', stages: [{ label: 'Visited', value: 12000 }, { label: 'Viewed pricing', value: 5200 }, { label: 'Started trial', value: 1900 }, { label: 'Converted', value: 640 }], comparison: [{ label: 'Visited', value: 11000 }, { label: 'Viewed pricing', value: 4600 }, { label: 'Started trial', value: 1500 }, { label: 'Converted', value: 480 }], comparisonLabel: 'Previous period' }),
      box('row', 'summary', [stat('conv', 'Conversion', '5.3', { unit: '%', deltaPercent: 1.0, goodDirection: 'up' }), stat('trial', 'Trial rate', '36.5', { unit: '%' })])
    ])
  },
  {
    id: 'sales-no-geo', title: 'Sales without geography',
    root: stack([
      heading('title', 'Sales by channel and segment'),
      n('channels', 'series-chart', { label: 'Revenue by channel', type: 'bar', stacked: true, labels: months, datasets: [{ label: 'Search', data: [40, 52, 48, 61, 66, 70] }, { label: 'Direct', data: [22, 18, 25, 27, 24, 30] }, { label: 'Partners', data: [9, 11, 14, 12, 18, 21] }] }),
      n('segments', 'treemap', { label: 'Revenue by segment', nodes: [{ id: 'smb', label: 'SMB', value: 410 }, { id: 'mid', label: 'Mid-market', value: 520 }, { id: 'ent', label: 'Enterprise', value: 780 }] }),
      n('top-accounts', 'table', { caption: 'Top accounts', columns: cols('Account', 'Revenue', 'Segment'), rows: rowsOf([['Northwind', 180, 'Enterprise'], ['Contoso', 140, 'Enterprise'], ['Fabrikam', 96, 'Mid-market']]) })
    ])
  },
  {
    id: 'incident-timeline', title: 'Incident timeline',
    root: stack([
      heading('title', 'Incident review'),
      n('banner', 'alert', { variant: 'success', open: true }, { text: 'Resolved after 92 minutes.' }),
      box('timeline', 'events', [
        n('e1', 'timeline-item', { timestamp: '2026-11-20T08:00:00Z', variant: 'danger' }, { text: 'Error rate rises above 5 percent' }),
        n('e2', 'timeline-item', { timestamp: '2026-11-20T08:12:00Z', variant: 'warning' }, { text: 'On-call acknowledges the page' }),
        n('e3', 'timeline-item', { timestamp: '2026-11-20T08:40:00Z' }, { text: 'Bad deployment identified' }),
        n('e4', 'timeline-item', { timestamp: '2026-11-20T09:05:00Z' }, { text: 'Rollback started' }),
        n('e5', 'timeline-item', { timestamp: '2026-11-20T09:32:00Z', variant: 'success' }, { text: 'Service restored' })
      ], { label: 'Incident timeline', ordered: true }),
      n('impact', 'chart', { label: 'Failed requests per five minutes', type: 'bar', labels: ['08:00', '08:15', '08:30', '08:45', '09:00', '09:15', '09:30'], datasets: [{ label: 'Failures', data: [120, 640, 910, 880, 450, 160, 12] }] })
    ])
  },
  {
    id: 'whatif-slider-gauge', title: 'What-if slider to gauge with reads',
    root: stack([
      heading('title', 'Capacity what-if'),
      n('load-input', 'slider', { label: 'Expected traffic (requests per second)', min: 0, max: 1000, step: 10, value: 400 }, { bindings: { value: '/whatif/traffic' } }),
      n('load-gauge', 'gauge', { label: 'Projected CPU utilisation', value: 40, min: 0, max: 100, valueText: '40%', thresholds: [{ at: 0, variant: 'success' }, { at: 70, variant: 'warning' }, { at: 90, variant: 'danger' }] }, { reads: { value: '/whatif/traffic' } }),
      n('note', 'text', undefined, { text: 'Utilisation is a linear estimate of traffic divided by ten.' })
    ])
  },
  {
    id: 'live-metrics', title: 'Live metrics with liveReads',
    root: stack([
      heading('title', 'Live platform metrics'),
      n('freshness', 'poll-status', { active: true, nextInMs: 5000 }),
      box('row', 'live-row', [
        n('live-cpu', 'gauge', { label: 'CPU', value: 0, min: 0, max: 100, valueText: 'waiting' }, { liveReads: { value: '/metrics/cpu' } }),
        n('live-mem', 'gauge', { label: 'Memory', value: 0, min: 0, max: 100, valueText: 'waiting' }, { liveReads: { value: '/metrics/memory' } }),
        n('live-disk', 'progress-bar', { label: 'Disk', value: 0, max: 100, withValue: true }, { liveReads: { value: '/metrics/disk' } })
      ]),
      n('live-trend', 'sparkline', { label: 'Requests', values: [1, 1] }, { liveReads: { values: '/metrics/requests' } }),
      n('live-count', 'number-ticker', { value: 0 }, { liveReads: { value: '/metrics/total' } })
    ])
  },
  {
    id: 'filters-data-grid', title: 'Filters and data grid',
    root: stack([
      heading('title', 'Order explorer'),
      n('filters', 'filter-bar', { label: 'Order filters', filters: [{ filterId: 'region', label: 'Region', type: 'select', options: [{ value: 'eu', label: 'Europe' }, { value: 'us', label: 'Americas' }, { value: 'apac', label: 'Asia-Pacific' }], clearable: true }, { filterId: 'status', label: 'Status', type: 'select', options: [{ value: 'open', label: 'Open' }, { value: 'shipped', label: 'Shipped' }, { value: 'returned', label: 'Returned' }] }] }, { bindings: { value: '/filters' } }),
      n('orders', 'data-grid', { label: 'Orders', paginate: true, pageSize: 5, columns: [{ field: 'c0', label: 'Order', sortable: true }, { field: 'c1', label: 'Region', sortable: true }, { field: 'c2', label: 'Total', sortable: true, align: 'end' }, { field: 'c3', label: 'Status' }], data: rowsOf([['A-1001', 'Europe', 120.5, 'Open'], ['A-1002', 'Americas', 89, 'Shipped'], ['A-1003', 'Asia-Pacific', 410, 'Shipped'], ['A-1004', 'Europe', 35.2, 'Returned'], ['A-1005', 'Americas', 219.9, 'Open'], ['A-1006', 'Europe', 64, 'Shipped'], ['A-1007', 'Asia-Pacific', 18.75, 'Open']]) })
    ])
  },
  {
    id: 'heatmap', title: 'Load heatmap',
    root: stack([
      heading('title', 'Traffic by weekday and hour block'),
      n('load-map', 'heatmap', { label: 'Requests by weekday and time block', valueLabel: 'Requests (thousands)', data: { kind: 'matrix', rowLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], colLabels: ['00-06', '06-12', '12-18', '18-24'], values: [[4, 22, 31, 18], [5, 25, 34, 19], [5, 24, 33, 21], [6, 27, 36, 22], [6, 26, 30, 25], [8, 12, 15, 20], [7, 9, 13, 14]] } }),
      n('busiest', 'callout', { heading: 'Busiest block', variant: 'brand' }, { text: 'Thursday 12-18 carries the highest load.' })
    ])
  },
  {
    id: 'sankey-flows', title: 'Sankey visitor flow',
    root: stack([
      heading('title', 'Where visitors go'),
      n('flows', 'sankey', { label: 'Visitor flow', nodes: [{ id: 'search', label: 'Search' }, { id: 'social', label: 'Social' }, { id: 'direct', label: 'Direct' }, { id: 'landing', label: 'Landing page' }, { id: 'signup', label: 'Sign-up' }, { id: 'bounce', label: 'Bounce' }], links: [{ source: 'search', target: 'landing', value: 600 }, { source: 'social', target: 'landing', value: 240 }, { source: 'direct', target: 'landing', value: 160 }, { source: 'landing', target: 'signup', value: 310 }, { source: 'landing', target: 'bounce', value: 690 }] }),
      box('row', 'flow-stats', [stat('f-in', 'Visitors', '1,000'), stat('f-out', 'Signed up', '310', { variant: 'success' })])
    ])
  },
  {
    id: 'tabs-with-charts', title: 'Tabs with charts',
    root: stack([
      heading('title', 'Product analytics'),
      n('sections', 'tabs', { label: 'Analytics sections' }, { children: [
        n('usage-tab', 'tab', { panel: 'usage' }, { slot: 'nav', text: 'Usage' }),
        n('cost-tab', 'tab', { panel: 'cost' }, { slot: 'nav', text: 'Cost' }),
        n('usage-panel', 'tab-panel', { name: 'usage' }, { children: [n('usage-chart', 'chart', { label: 'Weekly active users', type: 'line', labels: ['W1', 'W2', 'W3', 'W4', 'W5'], datasets: [{ label: 'WAU', data: [1200, 1260, 1310, 1290, 1400] }] })] }),
        n('cost-panel', 'tab-panel', { name: 'cost' }, { children: [n('cost-chart', 'series-chart', { label: 'Spend by service', type: 'bar', labels: ['Compute', 'Storage', 'Network'], datasets: [{ label: 'This month', data: [620, 240, 90] }, { label: 'Last month', data: [580, 235, 110] }] })] })
      ] })
    ])
  },
  {
    id: 'budget-quota', title: 'Quota and budget meters',
    root: stack([
      heading('title', 'Resource budgets'),
      n('storage-budget', 'budget-meter', { label: 'Storage', used: 42, limit: 100, unit: 'GB' }),
      n('seats-budget', 'budget-meter', { label: 'Seats', used: 87, limit: 100, unit: 'seats' }),
      n('sync', 'progress-ring', { label: 'Sync progress', value: 3, max: 4 }),
      n('how', 'details', { summary: 'How budgets are measured' }, { children: [text('how-text', 'Usage is sampled hourly and averaged over the billing period.')] })
    ])
  },
  {
    id: 'refinement-patch', title: 'Refinement: add a panel to an existing dashboard',
    root: stack([
      heading('title', 'Support queue'),
      box('row', 'kpis', [stat('open', 'Open tickets', '132'), stat('sla', 'SLA met', '96', { unit: '%', variant: 'success' })]),
      n('volume', 'chart', { label: 'Tickets per day', type: 'bar', labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], datasets: [{ label: 'Tickets', data: [88, 95, 120, 101, 76] }] }),
      box('card', 'backlog-panel', [heading('backlog-title', 'Oldest tickets'), n('backlog-table', 'table', { caption: 'Oldest open tickets', columns: cols('Ticket', 'Age days'), rows: rowsOf([['T-481', 14], ['T-502', 11], ['T-517', 9]]) })])
    ]),
    /** The refinement request "add an escalation panel after the volume chart" as parent, position and node. */
    refinement: {
      parentId: 'root', afterId: 'volume',
      node: box('card', 'escalation-panel', [heading('escalation-title', 'Escalations'), n('escalation-gauge', 'gauge', { label: 'Escalation rate', value: 7, min: 0, max: 25, valueText: '7%', thresholds: [{ at: 0, variant: 'success' }, { at: 15, variant: 'danger' }] })])
    }
  }
];
