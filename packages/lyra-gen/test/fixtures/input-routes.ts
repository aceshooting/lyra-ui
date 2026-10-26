import { initialCatalog } from '../../src/catalog.js';
import type { LyraGenSnapshot, LyraGenSurfaceState } from '../../src/runtime.js';
import type { JsonValue, LyraGenCatalog, LyraGenDiagnostic, LyraGenLimits, LyraGenView } from '../../src/types.js';

export type RouteId = 'json-object' | 'json-batch' | 'markup-batch' | 'json-stream' | 'markup-stream';
export const routeIds: readonly RouteId[] = ['json-object', 'json-batch', 'markup-batch', 'json-stream', 'markup-stream'];
export interface RouteFixture {
  readonly id: string;
  readonly catalog: LyraGenCatalog;
  readonly surfaceId: string;
  readonly revision: number;
  readonly jsonSource: string;
  readonly markupSource: string;
  readonly limits?: Partial<LyraGenLimits>;
}
export interface PositiveRouteFixture extends RouteFixture {
  readonly expectedView: LyraGenView;
  readonly initialValues: JsonValue;
  readonly edits: readonly { readonly pointer: string; readonly value: JsonValue }[];
  readonly expectedInitialState: LyraGenSurfaceState;
  readonly expectedSnapshot: LyraGenSnapshot;
}
export interface RefusalRouteFixture extends RouteFixture {
  readonly code: string;
  readonly markupCode?: string;
  readonly diagnosticPath?: string;
  readonly forgedSnapshot: unknown;
}
export interface RouteOutcome {
  readonly ok: boolean;
  readonly view?: LyraGenView;
  readonly diagnostics: readonly LyraGenDiagnostic[];
}

const roles = (names: readonly string[]) => Object.fromEntries(names.map(name => [name, initialCatalog.components[name]!]));
export const formCatalog: LyraGenCatalog = { id: 'route-forms', version: '1', components: roles(['form', 'text', 'input', 'checkbox', 'button', 'stack']), actions: {
  'save-review': { payload: { type: 'object', properties: { source: { type: 'string', enum: ['review'] }, count: { type: 'number' } }, required: ['source', 'count'], additionalProperties: false } },
  dismiss: { payload: { type: 'null' } },
} };
export const slotCatalog: LyraGenCatalog = { id: 'route-slots', version: '1', components: {
  stack: { tag: 'div', children: true, slots: ['', 'label'], properties: {} },
  row: { tag: 'div', children: true, slots: ['', 'label'], properties: {} },
  text: { tag: 'p', text: true, properties: {} },
  input: initialCatalog.components['input']!,
  typed: { tag: 'div', properties: {
    enabled: { type: 'boolean' }, count: { type: 'number' }, note: { type: 'null' },
    data: { type: 'array', items: { type: 'object', properties: {
      label: { type: 'string' }, values: { type: 'array', items: { anyOf: [{ type: 'number' }, { type: 'boolean' }, { type: 'null' }] } },
    }, required: ['label', 'values'], additionalProperties: false } },
  } },
} };
const reportCatalog: LyraGenCatalog = { id: 'route-report', version: '1', components: roles(['stack', 'heading', 'text', 'input', 'table', 'chart']) };

function sources(catalog: LyraGenCatalog, surfaceId: string, revision: number, jsonRoot: string, markupSource: string) {
  return { catalog, surfaceId, revision, markupSource,
    jsonSource: `{"version":"1","catalog":{"id":"${catalog.id}","version":"${catalog.version}"},"surfaceId":"${surfaceId}","revision":${revision},"root":${jsonRoot}}` };
}

const formView: LyraGenView = { version: '1', catalog: { id: 'route-forms', version: '1' }, surfaceId: 'route-form', revision: 7, root: {
  id: 'review', type: 'form', props: { ariaLabel: 'Review' }, children: [
    { id: 'intro', type: 'text', text: 'Review <A> & "B"' },
    { id: 'name', type: 'input', props: { label: 'Name', value: 'Original' }, bindings: { value: '/form/name' } },
    { id: 'notify', type: 'checkbox', props: { checked: false }, text: 'Notify me', bindings: { checked: '/form/notify' } },
    { id: 'save', type: 'button', text: 'Save', action: { name: 'save-review', payload: { source: 'review', count: 0 } } },
    { id: 'dismiss', type: 'button', text: 'Dismiss', action: { name: 'dismiss', payload: null } },
  ],
} };
const formOwners = {
  '/form/name': { nodeId: 'name', property: 'value', type: 'input' },
  '/form/notify': { nodeId: 'notify', property: 'checked', type: 'checkbox' },
};
const formFixture: PositiveRouteFixture = {
  id: 'form-action-state', ...sources(formCatalog, 'route-form', 7,
    '{"id":"review","type":"form","props":{"ariaLabel":"Review"},"children":[{"id":"intro","type":"text","text":"Review <A> & \\"B\\""},{"id":"name","type":"input","props":{"label":"Name","value":"Original"},"bindings":{"value":"/form/name"}},{"id":"notify","type":"checkbox","props":{"checked":false},"text":"Notify me","bindings":{"checked":"/form/notify"}},{"id":"save","type":"button","text":"Save","action":{"name":"save-review","payload":{"source":"review","count":0}}},{"id":"dismiss","type":"button","text":"Dismiss","action":{"name":"dismiss","payload":null}}]}',
    '<form id="review" ariaLabel="Review"><text id="intro">Review &lt;A&gt; &amp; &quot;B&quot;</text><input id="name" label="Name" value="Original" bindings={{"value":"/form/name"}}/><checkbox id="notify" checked={false} bindings={{"checked":"/form/notify"}}>Notify me</checkbox><button id="save" action={{"name":"save-review","payload":{"source":"review","count":0}}}>Save</button><button id="dismiss" action={{"name":"dismiss","payload":null}}>Dismiss</button></form>'),
  expectedView: formView,
  initialValues: { form: { name: 'Host', notify: false }, ignored: 'must disappear' },
  edits: [{ pointer: '/form/name', value: 'Edited & retained' }, { pointer: '/form/notify', value: true }, { pointer: '/form/name', value: 'Edited & retained' }],
  expectedInitialState: { surfaceId: 'route-form', revision: 7, values: { form: { name: 'Host', notify: false } }, dirty: [], owners: formOwners },
  expectedSnapshot: { version: '1', view: formView, state: { surfaceId: 'route-form', revision: 7,
    values: { form: { name: 'Edited & retained', notify: true } }, dirty: ['/form/name', '/form/notify'], owners: formOwners } },
};

const slotView: LyraGenView = { version: '1', catalog: { id: 'route-slots', version: '1' }, surfaceId: 'route-slots', revision: 3, root: {
  id: 'layout', type: 'stack', children: [{ id: 'line', type: 'row', children: [
    { id: 'empty', type: 'text', text: '', slot: '' },
    { id: 'label', type: 'text', text: 'A & B', slot: 'label' },
    { id: 'typed', type: 'typed', props: { enabled: false, count: 0, note: null, data: [{ label: 'A', values: [0, false, null] }] } },
    { id: 'escaped-field', type: 'input', props: { label: 'Escaped field', value: '' }, bindings: { value: '/a~1b/~0key' } },
  ] }],
} };
const slotOwners = { '/a~1b/~0key': { nodeId: 'escaped-field', property: 'value', type: 'input' } };
const slotFixture: PositiveRouteFixture = {
  id: 'slots-typed-pointer', ...sources(slotCatalog, 'route-slots', 3,
    '{"id":"layout","type":"stack","children":[{"id":"line","type":"row","children":[{"id":"empty","type":"text","text":"","slot":""},{"id":"label","type":"text","text":"A & B","slot":"label"},{"id":"typed","type":"typed","props":{"enabled":false,"count":0,"note":null,"data":[{"label":"A","values":[0,false,null]}]}},{"id":"escaped-field","type":"input","props":{"label":"Escaped field","value":""},"bindings":{"value":"/a~1b/~0key"}}]}]}',
    "<stack id='layout'>\n<row id='line'><text id='empty' text='' slot=''/><text id='label' slot='label'>A &amp; B</text><typed id='typed' enabled={false} count={0} note={null} data={[{\"label\":\"A\",\"values\":[0,false,null]}]}/><input id='escaped-field' label='Escaped field' value='' bindings={{\"value\":\"/a~1b/~0key\"}}/></row>\n</stack>"),
  expectedView: slotView, initialValues: { 'a/b': { '~key': 'Host value' }, extra: false },
  edits: [{ pointer: '/a~1b/~0key', value: 'Edited 🚀 café مرحبا' }],
  expectedInitialState: { surfaceId: 'route-slots', revision: 3, values: { 'a/b': { '~key': 'Host value' } }, dirty: [], owners: slotOwners },
  expectedSnapshot: { version: '1', view: slotView, state: { surfaceId: 'route-slots', revision: 3,
    values: { 'a/b': { '~key': 'Edited 🚀 café مرحبا' } }, dirty: ['/a~1b/~0key'], owners: slotOwners } },
};

const reportView: LyraGenView = { version: '1', catalog: { id: 'route-report', version: '1' }, surfaceId: 'route-report', revision: 11, root: {
  id: 'report', type: 'stack', children: [
    { id: 'heading', type: 'heading', text: 'Stock overview' },
    { id: 'filter', type: 'input', props: { label: 'Filter', value: '' }, bindings: { value: '/filter' } },
    { id: 'table', type: 'table', props: { caption: 'Stock', columns: [{ key: 'c0', label: 'Item' }, { key: 'c1', label: 'Count' }], rows: [{ c0: 'Café 🚀', c1: 0 }, { c0: 'قلم', c1: 12 }] } },
    { id: 'chart', type: 'chart', props: { label: 'Counts', labels: ['Café 🚀', 'قلم'], datasets: [{ label: 'Units', data: [0, 12] }], withDataTable: true } },
    { id: 'explanation', type: 'text', text: 'Literal &lt; <tag> "quoted"\ne\u0301 🚀' },
  ],
} };
const reportOwners = { '/filter': { nodeId: 'filter', property: 'value', type: 'input' } };
const reportFixture: PositiveRouteFixture = {
  id: 'structured-report', ...sources(reportCatalog, 'route-report', 11,
    '{"id":"report","type":"stack","children":[{"id":"heading","type":"heading","text":"Stock overview"},{"id":"filter","type":"input","props":{"label":"Filter","value":""},"bindings":{"value":"/filter"}},{"id":"table","type":"table","props":{"caption":"Stock","columns":[{"key":"c0","label":"Item"},{"key":"c1","label":"Count"}],"rows":[{"c0":"Café 🚀","c1":0},{"c0":"قلم","c1":12}]}},{"id":"chart","type":"chart","props":{"label":"Counts","labels":["Café 🚀","قلم"],"datasets":[{"label":"Units","data":[0,12]}],"withDataTable":true}},{"id":"explanation","type":"text","text":"Literal &lt; <tag> \\"quoted\\"\\né 🚀"}]}',
    '<stack id="report"><heading id="heading">Stock overview</heading><input id="filter" label="Filter" value="" bindings={{"value":"/filter"}}/><table id="table" caption="Stock" columns={[{"key":"c0","label":"Item"},{"key":"c1","label":"Count"}]} rows={[{"c0":"Café 🚀","c1":0},{"c0":"قلم","c1":12}]}/><chart id="chart" label="Counts" labels={["Café 🚀","قلم"]} datasets={[{"label":"Units","data":[0,12]}]} withDataTable={true}/><text id="explanation">Literal &amp;lt; &lt;tag&gt; &quot;quoted&quot;\né 🚀</text></stack>'),
  expectedView: reportView, initialValues: { filter: 'all', hidden: 'discard' }, edits: [{ pointer: '/filter', value: 'Café 🚀' }],
  expectedInitialState: { surfaceId: 'route-report', revision: 11, values: { filter: 'all' }, dirty: [], owners: reportOwners },
  expectedSnapshot: { version: '1', view: reportView, state: { surfaceId: 'route-report', revision: 11,
    values: { filter: 'Café 🚀' }, dirty: ['/filter'], owners: reportOwners } },
};
export const positiveRouteFixtures: readonly PositiveRouteFixture[] = [formFixture, slotFixture, reportFixture];

const refusalCatalog: LyraGenCatalog = { ...formCatalog, id: 'route-refusals', components: {
  ...formCatalog.components,
  media: { tag: 'img', properties: { src: { type: 'string' } }, urlSinks: { src: { kind: 'media', origins: ['https://media.example'] } } },
  secret: { tag: 'input', properties: { label: { type: 'string' } }, fieldPurpose: 'one-time-code' },
} };
function refusal(id: string, jsonNode: string, markupNode: string, code: string, options: {
  markupCode?: string; diagnosticPath?: string; limits?: Partial<LyraGenLimits>;
} = {}): RefusalRouteFixture {
  const scene = sources(refusalCatalog, 'refused', 0,
    `{"id":"boundary","type":"stack","children":[{"id":"before","type":"text","text":"Safe before"},${jsonNode},{"id":"after","type":"text","text":"Safe after"}]}`,
    `<stack id="boundary"><text id="before">Safe before</text>${markupNode}<text id="after">Safe after</text></stack>`);
  return { id, ...scene, code, ...options, forgedSnapshot: { version: '1', view: JSON.parse(scene.jsonSource),
    state: { surfaceId: 'refused', revision: 0, values: {}, dirty: [], owners: {} } } };
}
export const refusalRouteFixtures: readonly RefusalRouteFixture[] = [
  refusal('duplicate-node-id', '{"id":"before","type":"text","text":"Ambiguous"}', '<text id="before">Ambiguous</text>', 'identity.duplicate', { markupCode: 'duplicate-id' }),
  refusal('generated-html-property', '{"id":"bad","type":"text","props":{"innerHTML":"fake"}}', '<text id="bad" innerHTML="fake"/>', 'props.unknown', { markupCode: 'forbidden-attribute' }),
  refusal('undeclared-action', '{"id":"bad","type":"button","text":"Erase","action":{"name":"erase"}}', '<button id="bad" action={{"name":"erase"}}>Erase</button>', 'action.unknown'),
  refusal('invalid-action-payload', '{"id":"bad","type":"button","text":"Save","action":{"name":"save-review","payload":{"source":"review","count":"wrong"}}}', '<button id="bad" action={{"name":"save-review","payload":{"source":"review","count":"wrong"}}}>Save</button>', 'schema.type', { diagnosticPath: '/root/children/1/action/payload/count' }),
  refusal('overlapping-state-owners', '{"id":"bad","type":"stack","children":[{"id":"parent","type":"input","props":{"label":"Parent"},"bindings":{"value":"/form"}},{"id":"child","type":"input","props":{"label":"Child"},"bindings":{"value":"/form/name"}}]}', '<stack id="bad"><input id="parent" label="Parent" bindings={{"value":"/form"}}/><input id="child" label="Child" bindings={{"value":"/form/name"}}/></stack>', 'identity.binding'),
  refusal('unapproved-media-origin', '{"id":"bad","type":"media","props":{"src":"https://unapproved.example/image.png"}}', '<media id="bad" src="https://unapproved.example/image.png"/>', 'content.url'),
  refusal('unapproved-sensitive-field', '{"id":"bad","type":"secret","props":{"label":"Code"}}', '<secret id="bad" label="Code"/>', 'content.field'),
  refusal('oversized-semantic-string', `{"id":"bad","type":"text","text":"${'x'.repeat(97)}"}`, `<text id="bad">${'x'.repeat(97)}</text>`, 'limit.string', { limits: { maxStringLength: 96 } }),
  refusal('oversized-tree', `{"id":"bad","type":"stack","children":[${Array.from({ length: 20 }, (_, index) => `{"id":"n${index}","type":"text","text":"x"}`).join(',')}]}`, `<stack id="bad">${Array.from({ length: 20 }, (_, index) => `<text id="n${index}">x</text>`).join('')}</stack>`, 'limit.nodes', { limits: { maxNodes: 40 } }),
];
