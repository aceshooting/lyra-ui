import type { JsonObject } from '../../../../src/types.js';

/**
 * Authored candidate-processor cohort. The wire shapes follow the published v1.0 specification
 * page (`"version": "1.0"`, `@catalogId` and `@accessibility` component mixins, explicit-null
 * deletion); they are not copies of upstream examples and never count as stable conformance.
 */
export const v1Specification = 'https://a2ui.org/specification/v1.0-a2ui/';
export const layoutCatalogId = 'https://example.com/lyra-fixture/layout/v1';
export const dataCatalogId = 'https://example.com/lyra-fixture/data/v1';
export const unregisteredCatalogId = 'https://example.com/lyra-fixture/unregistered/v1';
export const salesSurface = 'sales';

/** View roles admitted by the fixture's lyra-gen catalog. */
export const fixtureRoles = ['stack', 'text', 'heading', 'alert', 'button', 'stat', 'table'] as const;
/** Wire roles per registered candidate catalog; the data catalog also carries the shared text role. */
export const layoutRoles = ['stack', 'text', 'heading', 'alert', 'button'] as const;
export const dataRoles = ['stat', 'table', 'text'] as const;
/** Host-declared nesting: the stack only at the surface root, headings only inside a stack. */
export const fixtureAllowedParents = { stack: ['Surface'], heading: ['stack'] } as const;

export const salesCreate: JsonObject = { version: '1.0', createSurface: {
  surfaceId: salesSurface, catalogId: layoutCatalogId,
  dataModel: { title: 'Quarterly sales', total: '1,204', rows: [{ c0: 'North', c1: 700 }, { c0: 'South', c1: 504 }] },
  components: [
    { id: 'root', component: 'stack', children: ['title', 'summary', 'total', 'regions'] },
    { id: 'title', component: 'heading', text: { '@path': '/title' } },
    { id: 'summary', component: 'text', text: 'Revenue by region for the quarter.' },
    { id: 'total', component: 'stat', '@catalogId': dataCatalogId, label: 'Total revenue', value: { '@path': '/total' } },
    { id: 'regions', component: 'table', '@catalogId': dataCatalogId, '@accessibility': { label: 'Revenue by region' },
      columns: [{ key: 'c0', label: 'Region' }, { key: 'c1', label: 'Revenue' }], rows: { '@path': '/rows' } },
  ],
} };
export const salesDataUpdate: JsonObject = { version: '1.0', updateDataModel: { surfaceId: salesSurface, path: '/total', value: '1,377' } };
export const salesComponentUpdate: JsonObject = { version: '1.0', updateComponents: { surfaceId: salesSurface, components: [
  { id: 'summary', component: 'text', text: 'Revenue by region, revised.' },
  { id: 'notice', component: 'alert', open: true, children: ['noticeText', 'review'] },
  { id: 'noticeText', component: 'text', text: 'South figures are provisional.' },
  { id: 'review', component: 'button', text: 'Review figures', action: { event: { name: 'review-figures', context: { total: { '@path': '/total' }, scope: 'quarter' } } } },
  { id: 'root', component: 'stack', children: ['title', 'summary', 'notice', 'total', 'regions'] },
] } };

export interface V1ErrorCase {
  readonly name: string;
  /** Messages applied before the case, all accepted. */
  readonly prior: readonly JsonObject[];
  readonly message: JsonObject;
  readonly code: 'VALIDATION_FAILED' | 'UNALLOWED_PARENT' | 'UNALLOWED_CHILD' | 'INTEGRITY_ERROR' | 'INVALID_FUNCTION_CALL';
  readonly path?: string;
  readonly surfaceId?: string;
  readonly functionCallId?: string;
}

const bare = (surfaceId: string, extra: JsonObject = {}): JsonObject => ({ version: '1.0', createSurface: { surfaceId, catalogId: layoutCatalogId, ...extra } });
const components = (surfaceId: string, list: readonly JsonObject[]): JsonObject => ({ version: '1.0', updateComponents: { surfaceId, components: [...list] } });

export const v1ErrorCases: readonly V1ErrorCase[] = [
  { name: 'pinned-revision wire version', prior: [], message: { version: 'v1.0', createSurface: { surfaceId: 's1' } }, code: 'VALIDATION_FAILED', path: '/version', surfaceId: 's1' },
  { name: 'stable wire version', prior: [], message: { version: 'v0.9.1', createSurface: { surfaceId: 's1' } }, code: 'VALIDATION_FAILED', path: '/version', surfaceId: 's1' },
  { name: 'two operations', prior: [], message: { version: '1.0', createSurface: { surfaceId: 's1' }, deleteSurface: { surfaceId: 's1' } }, code: 'VALIDATION_FAILED', path: '' },
  { name: 'theme on creation', prior: [], message: bare('s1', { theme: { primaryColor: '#000000' } }), code: 'VALIDATION_FAILED', path: '/createSurface/theme', surfaceId: 's1' },
  { name: 'unregistered surface catalog', prior: [], message: { version: '1.0', createSurface: { surfaceId: 's1', catalogId: unregisteredCatalogId } }, code: 'VALIDATION_FAILED', path: '/createSurface/catalogId', surfaceId: 's1' },
  { name: 'duplicate creation', prior: [bare('s1')], message: bare('s1'), code: 'INTEGRITY_ERROR', surfaceId: 's1' },
  { name: 'reuse after deletion', prior: [bare('s1'), { version: '1.0', deleteSurface: { surfaceId: 's1' } }], message: bare('s1'), code: 'INTEGRITY_ERROR', surfaceId: 's1' },
  { name: 'update before creation', prior: [], message: components('s1', [{ id: 'root', component: 'text', text: 'Hi' }]), code: 'INTEGRITY_ERROR', surfaceId: 's1' },
  { name: 'unregistered component catalog', prior: [bare('s1')], message: components('s1', [{ id: 'root', component: 'text', '@catalogId': unregisteredCatalogId, text: 'Hi' }]), code: 'VALIDATION_FAILED', path: '/updateComponents/components/0/@catalogId', surfaceId: 's1' },
  { name: 'no catalog for component', prior: [{ version: '1.0', createSurface: { surfaceId: 's1' } }], message: components('s1', [{ id: 'root', component: 'text', text: 'Hi' }]), code: 'VALIDATION_FAILED', path: '/updateComponents/components/0', surfaceId: 's1' },
  { name: 'component outside its catalog', prior: [bare('s1')], message: components('s1', [{ id: 'root', component: 'table', text: 'Hi' }]), code: 'VALIDATION_FAILED', path: '/updateComponents/components/0/component', surfaceId: 's1' },
  { name: 'reserved Surface component', prior: [bare('s1')], message: components('s1', [{ id: 'root', component: 'Surface' }]), code: 'VALIDATION_FAILED', path: '/updateComponents/components/0/component', surfaceId: 's1' },
  { name: 'invalid component identifier', prior: [bare('s1')], message: components('s1', [{ id: 'user-card', component: 'text', text: 'Hi' }]), code: 'VALIDATION_FAILED', path: '/updateComponents/components/0/id', surfaceId: 's1' },
  { name: 'duplicate component in one message', prior: [bare('s1')], message: components('s1', [{ id: 'a', component: 'text', text: 'A' }, { id: 'a', component: 'text', text: 'B' }]), code: 'VALIDATION_FAILED', path: '/updateComponents/components/1/id', surfaceId: 's1' },
  { name: 'undeclared member', prior: [bare('s1')], message: components('s1', [{ id: 'root', component: 'text', text: 'Hi', color: 'red' }]), code: 'VALIDATION_FAILED', path: '/updateComponents/components/0/color', surfaceId: 's1' },
  { name: 'checks outside profile', prior: [bare('s1')], message: components('s1', [{ id: 'root', component: 'text', text: 'Hi', '@checks': [] }]), code: 'VALIDATION_FAILED', path: '/updateComponents/components/0/@checks', surfaceId: 's1' },
  { name: 'function call value', prior: [bare('s1')], message: components('s1', [{ id: 'root', component: 'text', text: { '@call': 'formatString', args: { value: 'x' } } }]), code: 'VALIDATION_FAILED', path: '/updateComponents/components/0/text', surfaceId: 's1' },
  { name: 'literal violates schema', prior: [bare('s1')], message: components('s1', [{ id: 'root', component: 'text', text: 42 }]), code: 'VALIDATION_FAILED', path: '/updateComponents/components/0/text', surfaceId: 's1' },
  { name: 'local function action', prior: [bare('s1')], message: components('s1', [{ id: 'root', component: 'button', text: 'Go', action: { functionCall: { '@call': 'openUrl' } } }]), code: 'VALIDATION_FAILED', path: '/updateComponents/components/0/action', surfaceId: 's1' },
  { name: 'accessibility label without a name property', prior: [bare('s1')], message: components('s1', [{ id: 'root', component: 'text', text: 'Hi', '@accessibility': { label: 'Greeting' } }]), code: 'VALIDATION_FAILED', path: '/updateComponents/components/0/@accessibility/label', surfaceId: 's1' },
  { name: 'accessibility label conflicts with the name property', prior: [bare('s1')], message: components('s1', [{ id: 'root', component: 'button', text: 'Go', accessibleLabel: 'Go now', '@accessibility': { label: 'Proceed' } }]), code: 'VALIDATION_FAILED', path: '/updateComponents/components/0/@accessibility/label', surfaceId: 's1' },
  { name: 'accessibility hidden outside profile', prior: [bare('s1')], message: components('s1', [{ id: 'root', component: 'text', text: 'Hi', '@accessibility': { hidden: true } }]), code: 'VALIDATION_FAILED', path: '/updateComponents/components/0/@accessibility/hidden', surfaceId: 's1' },
  { name: 'unallowed child', prior: [bare('s1')], message: components('s1', [{ id: 'root', component: 'alert', children: ['metric'] }, { id: 'metric', component: 'stat', '@catalogId': dataCatalogId, label: 'Total', value: '1' }]), code: 'UNALLOWED_CHILD', path: '/updateComponents/components/0/children/0', surfaceId: 's1' },
  { name: 'unallowed parent', prior: [bare('s1')], message: components('s1', [{ id: 'root', component: 'stack', children: ['inner'] }, { id: 'inner', component: 'stack', children: [] }]), code: 'UNALLOWED_PARENT', path: '/updateComponents/components/0/children/0', surfaceId: 's1' },
  { name: 'root restricted away from Surface', prior: [bare('s1')], message: components('s1', [{ id: 'root', component: 'heading', text: 'Title' }]), code: 'UNALLOWED_PARENT', path: '/updateComponents/components/0/component', surfaceId: 's1' },
  { name: 'cycle', prior: [bare('s1')], message: components('s1', [{ id: 'a', component: 'stack', children: ['b'] }, { id: 'b', component: 'stack', children: ['a'] }]), code: 'VALIDATION_FAILED', surfaceId: 's1' },
  { name: 'root referenced as a child', prior: [bare('s1')], message: components('s1', [{ id: 'a', component: 'stack', children: ['root'] }]), code: 'VALIDATION_FAILED', path: '/updateComponents/components/0/children/0', surfaceId: 's1' },
  { name: 'data update without value', prior: [bare('s1')], message: { version: '1.0', updateDataModel: { surfaceId: 's1', path: '/a' } }, code: 'VALIDATION_FAILED', path: '/updateDataModel/value', surfaceId: 's1' },
  { name: 'non-object root data model', prior: [bare('s1')], message: { version: '1.0', updateDataModel: { surfaceId: 's1', value: [1, 2] } }, code: 'VALIDATION_FAILED', path: '/updateDataModel/value', surfaceId: 's1' },
  { name: 'null array element deletion', prior: [bare('s1', { dataModel: { list: [1, 2] } })], message: { version: '1.0', updateDataModel: { surfaceId: 's1', path: '/list/0', value: null } }, code: 'VALIDATION_FAILED', path: '/updateDataModel/path', surfaceId: 's1' },
  { name: 'bound data violates the property schema', prior: [bare('s1'), components('s1', [{ id: 'root', component: 'text', text: { '@path': '/message' } }])], message: { version: '1.0', updateDataModel: { surfaceId: 's1', path: '/message', value: { nested: true } } }, code: 'VALIDATION_FAILED', path: '/updateDataModel/value', surfaceId: 's1' },
  { name: 'renderer function call', prior: [], message: { version: '1.0', callRendererFunction: { functionCallId: 'call_1', callFunction: { '@call': 'getScreenResolution', catalogId: layoutCatalogId } } }, code: 'INVALID_FUNCTION_CALL', functionCallId: 'call_1' },
  { name: 'unsolicited agent function response', prior: [], message: { version: '1.0', agentFunctionResponse: { functionCallId: 'call_2', value: 1 } }, code: 'INTEGRITY_ERROR', functionCallId: 'call_2' },
];
