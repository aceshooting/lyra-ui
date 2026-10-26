import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalog, initialCatalog, subsetCatalog } from './catalog.js';
import { validateContentProperties, validateNavigationDestination } from './content-policy.js';
import { validateView } from './runtime.js';
import type { JsonValue, LyraGenCatalog, LyraGenFieldPolicy, LyraGenNode } from './types.js';

const field: LyraGenNode = { id: 'secret', type: 'input', props: { label: 'Verification code', value: '' }, bindings: { value: '/code' } };
const view = (catalog: LyraGenCatalog, root = field, surfaceId = 'checkout') => ({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId, revision: 0, root });
const sensitiveCatalog = (fieldPolicy?: LyraGenFieldPolicy) => createCatalog({ id: 'policy', version: '1', components: { input: { ...initialCatalog.components['input']!, fieldPurpose: 'one-time-code' } }, ...(fieldPolicy ? { fieldPolicy } : {}) } as LyraGenCatalog);

test('sensitive collecting roles require an exact scoped trusted approval', () => {
  assert.equal(validateView(view(sensitiveCatalog()), sensitiveCatalog()).ok, false);
  const approval = { surfaceId: 'checkout', node: field, purpose: 'one-time-code' as const, allowSensitive: true };
  const catalog = sensitiveCatalog({ approvedFields: [approval] });
  assert.equal(validateView(view(catalog), catalog).ok, true);
  for (const candidate of [view(catalog, field, 'other'), view(catalog, { ...field, id: 'other' }), view(catalog, { ...field, props: { ...field.props, label: 'Another request' } }), view(catalog, { ...field, bindings: { value: '/other' } })]) assert.equal(validateView(candidate, catalog).ok, false);
  const denied = sensitiveCatalog({ approvedFields: [{ ...approval, allowSensitive: false }] });
  assert.equal(validateView(view(denied), denied).ok, false);
});

test('general fields remain compatible; strict approval prevents unreviewed collection', () => {
  assert.equal(validateView(view(initialCatalog), initialCatalog).ok, true);
  const catalog = createCatalog({ ...initialCatalog, fieldPolicy: { requireApprovedFields: true, approvedFields: [{ surfaceId: 'checkout', node: field, purpose: 'general' }] } } as LyraGenCatalog);
  assert.equal(validateView(view(catalog), catalog).ok, true);
  assert.equal(validateView(view(catalog, { ...field, props: { label: 'Unreviewed' } }), catalog).ok, false);
  const narrowed = subsetCatalog(catalog, ['input']);
  assert.equal(narrowed.ok, true);
  if (narrowed.ok) assert.equal(validateView(view(narrowed.value, { ...field, id: 'unreviewed' }), narrowed.value).ok, false);
});

test('a model cannot add purpose, approvals or URL permissions to its document', () => {
  const catalog = sensitiveCatalog();
  assert.equal(validateView({ ...view(catalog), fieldPolicy: { allowSensitive: true } }, catalog).ok, false);
  assert.equal(validateView(view(catalog, { ...field, fieldPurpose: 'general' } as LyraGenNode), catalog).ok, false);
});

test('custom URL properties require explicit media origin policy and navigation stays action-only', () => {
  const definition = { id: 'media', version: '1', components: { image: { tag: 'img', properties: { src: { type: 'string' as const } } } } };
  assert.throws(() => createCatalog(definition), /sink/i);
  const catalog = createCatalog({ ...definition, components: { image: { ...definition.components.image, urlSinks: { src: { kind: 'media', origins: ['https://media.example'] } } } } } as LyraGenCatalog);
  const image = (src: string): LyraGenNode => ({ id: 'image', type: 'image', props: { src } });
  assert.equal(validateView(view(catalog, image('https://media.example/photo.png')), catalog).ok, true);
  for (const src of ['https://other.example/photo.png', 'https://media.example.evil.test/a', '//media.example/a', 'data:image/png;base64,AAAA', 'javascript:alert(1)', 'https://user:pass@media.example/a', 'https://media.example/a\n', 'https://media.example/a\u202e']) assert.equal(validateView(view(catalog, image(src)), catalog).ok, false, src);
  assert.throws(() => createCatalog({ id: 'link', version: '1', components: { link: { tag: 'a', properties: { href: { type: 'string' } } } } }), /navigation|sink/i);
});


test('machine-readable secret hints require purpose approval even on a general custom role', () => {
  const catalog = createCatalog({ id: 'hints', version: '1', components: { input: { tag: 'input', properties: { type: { type: 'string' }, autocomplete: { type: 'string' } }, fieldPurpose: 'general' } } });
  const cases: Readonly<Record<string, JsonValue>>[] = [{ type: 'password' }, { type: 'PASSWORD' }, { autocomplete: 'section-checkout one-time-code' }, { autocomplete: 'cc-number' }, { autocomplete: 'new-password' }];
  for (const props of cases) assert.equal(validateView(view(catalog, { id: 'secret', type: 'input', props }), catalog).ok, false);
  const native = createCatalog({ ...catalog, fieldPolicy: { requireApprovedFields: true }, components: { input: { tag: 'input', properties: {} } } });
  assert.equal(validateView(view(native, { id: 'plain', type: 'input' }), native).ok, false);
});

test('all declared sensitive purposes require their own matching scoped opt-in', () => {
  for (const purpose of ['password', 'one-time-code', 'payment-card', 'secret'] as const) {
    const catalog = createCatalog({ id: 'sensitive', version: '1', components: { input: { ...initialCatalog.components['input']!, fieldPurpose: purpose } } });
    assert.equal(validateView(view(catalog), catalog).ok, false);
    const approved = createCatalog({ ...catalog, fieldPolicy: { approvedFields: [{ surfaceId: 'checkout', node: field, purpose, allowSensitive: true }] } });
    assert.equal(validateView(view(approved), approved).ok, true);
    const wrong = createCatalog({ ...catalog, fieldPolicy: { approvedFields: [{ surfaceId: 'checkout', node: field, purpose: 'general', allowSensitive: true }] } });
    assert.equal(validateView(view(wrong), wrong).ok, false);
  }
});

test('sink declarations reject wildcards, insecure origins, URL lists and state bindings', () => {
  const component = { tag: 'img', properties: { src: { type: 'string' as const } } };
  const definition = (origins: readonly string[]): LyraGenCatalog => ({ id: 'media', version: '1', components: { image: { ...component, urlSinks: { src: { kind: 'media', origins } } } } });
  for (const origins of [[], ['*'], ['https://*.example'], ['http://media.example'], ['https://media.example/path'], ['https://media.example/']]) assert.throws(() => createCatalog(definition(origins)));
  const catalog = createCatalog(definition(['https://media.example']));
  assert.equal(validateContentProperties({ src: 'https://other.example/stolen' }, catalog.components['image']!).length, 1);
  const bound = { ...catalog, components: { image: { ...catalog.components['image']!, bindings: { src: { event: 'change', property: 'src' } } } } };
  assert.throws(() => createCatalog(bound), /binding/);
  assert.equal(validateView(view(bound, { id: 'image', type: 'image', bindings: { src: '/url' } }), bound).ok, false);
  assert.throws(() => createCatalog({ id: 'nested', version: '1', components: { image: { tag: 'example-image', properties: { images: { type: 'array', items: { type: 'object', properties: { src: { type: 'string' } } } } } } } }), /Nested/);
});

test('navigation helper returns a canonical visible destination without granting navigation', () => {
  const policy = { origins: ['https://docs.example'] };
  const result = validateNavigationDestination('https://docs.example:443/a/../guide', policy);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value, 'https://docs.example/guide');
  assert.equal(validateNavigationDestination('https://other.example/guide', policy).ok, false);
  assert.equal(validateContentProperties({ href: 'https://docs.example/guide' }, { tag: 'a', properties: {} }).length, 1);
});

test('host approvals are immutable and ambiguous duplicate scopes are refused', () => {
  const approval = { surfaceId: 'checkout', node: field, purpose: 'one-time-code' as const, allowSensitive: true };
  const catalog = sensitiveCatalog({ approvedFields: [approval] });
  assert.equal(Object.isFrozen(catalog.fieldPolicy?.approvedFields?.[0]?.node.props), true);
  assert.throws(() => sensitiveCatalog({ approvedFields: [approval, approval] }), /scope/);
});


test('adapted sensitive control hints cannot turn a general role into a secret collector', () => {
  const component = { tag: 'input', properties: {}, fieldPurpose: 'general' as const };
  for (const props of [{ type: 'PASSWORD' }, { autocomplete: 'one-time-code' }, { autoComplete: 'cc-number' }]) assert.ok(validateContentProperties(props, component).some(issue => issue.code === 'content.field'));
  assert.equal(validateContentProperties({ type: 'password' }, { ...component, fieldPurpose: 'password' }).length, 0);
});


test('shallow-frozen host registries cannot retain mutable approval references', () => {
  const mutable = { id: 'field', type: 'input', props: { label: 'Reviewed' } };
  const catalog = createCatalog({ ...initialCatalog, fieldPolicy: Object.freeze({ requireApprovedFields: true, approvedFields: [{ surfaceId: 'checkout', node: mutable, purpose: 'general' as const }] }) });
  mutable.props.label = 'Changed';
  assert.equal(catalog.fieldPolicy?.approvedFields?.[0]?.node.props?.['label'], 'Reviewed');
  assert.equal(validateView(view(catalog, mutable), catalog).ok, false);
});
