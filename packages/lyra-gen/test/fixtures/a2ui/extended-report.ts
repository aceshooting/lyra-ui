import type { JsonObject } from '../../../src/types.js';

/** Authored stable-profile fixture; the official pinned schemas remain unmodified. */
export const reportSurface = 'extended-report';
export const reportCatalogId = 'https://github.com/aceshooting/lyra-ui/a2ui/v0.9.1/lyra-report-fixture/1';
export const reportMessages: readonly JsonObject[] = [
  { version: 'v0.9.1', createSurface: { surfaceId: reportSurface, catalogId: reportCatalogId, sendDataModel: true } },
  { version: 'v0.9.1', updateDataModel: { surfaceId: reportSurface, value: {
    total: '24', source: 'quarterly-report',
    rows: [{ c0: 'Q1', c1: 8 }, { c0: 'Q2', c1: 16 }],
    series: [{ label: 'Orders', data: [8, 16] }],
  } } },
  { version: 'v0.9.1', updateComponents: { surfaceId: reportSurface, components: [
    { id: 'root', component: 'stack', children: ['chart', 'table', 'total', 'source'] },
    { id: 'chart', component: 'chart', type: 'bar', label: 'Orders by quarter', labels: ['Q1', 'Q2'], datasets: { path: '/series' }, withDataTable: true },
    { id: 'table', component: 'table', caption: 'Quarterly totals', columns: [{ key: 'c0', label: 'Quarter' }, { key: 'c1', label: 'Orders' }], rows: { path: '/rows' } },
    { id: 'total', component: 'stat', label: 'Reviewed orders', value: { path: '/total' } },
    { id: 'source', component: 'citation', sourceId: { path: '/source' }, label: 'Untrusted generated source label', index: 1,
      action: { event: { name: 'inspect-source', context: { sourceId: { path: '/source' } } } } },
  ] } },
];
export const reportUpdate: JsonObject = { version: 'v0.9.1', updateDataModel: { surfaceId: reportSurface, value: {
  total: '32', source: 'quarterly-report', rows: [{ c0: 'Q1', c1: 8 }, { c0: 'Q2', c1: 24 }],
  series: [{ label: 'Orders', data: [8, 24] }],
} } };
