import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compatibilityKey,
  assembleCompatibilityContext,
  resolveCompatibilityRecord,
  compatibilityExposure,
} from './published-compatibility.mjs';

const record = {
  tag: 'lr-alpha', kind: 'property', name: 'oldValue', attribute: 'old-value',
  since: '21.1.0', removalNotBefore: '23.0.0',
  replacement: { kind: 'property', name: 'value', usage: '.value = value' },
  rationale: 'The canonical property has the same supported behavior.',
};
const key = { scope: 'member', tag: 'lr-alpha', kind: 'property', name: 'oldValue' };
function component({ old = true, notices = true } = {}) {
  return {
    tag: 'lr-alpha', maturity: { deprecations: notices ? [structuredClone(record)] : [] },
    surface: {
      properties: [{ name: 'value', type: 'boolean', attribute: 'value', default: false },
        ...(old ? [{ name: 'oldValue', type: 'boolean', attribute: 'old-value', default: true, deprecated: true }] : [])],
      attributes: [{ name: 'value', type: 'boolean', default: false },
        ...(old ? [{ name: 'old-value', type: 'boolean', default: true, deprecated: true }] : [])],
      events: [{ name: 'lr-change' }], slots: [{ name: '' }],
    },
  };
}
function options(version = '23.0.0') {
  return {
    packageVersion: version,
    currentInventory: { components: [component({ old: false, notices: false })], mappings: [], upstreams: {} },
    currentExportDeprecations: [],
    captures: [{
      sourceRelease: 'lyra-ui@22.0.0', sourceVersion: '22.0.0',
      records: [{ key: structuredClone(key), policy: structuredClone(record) }],
      components: [component()], exports: [], mirrors: [],
      exposure: { event: { 'lr-change': ['lr-alpha', 'lr-keeper'] }, part: {}, 'css-property': {} },
    }],
    retirementIndex: [{ key, removedIn: '23.0.0', sourceRelease: 'lyra-ui@22.0.0' }],
  };
}

test('structured keys preserve empty slots, export modules and case without collisions', () => {
  assert.notEqual(compatibilityKey({ scope: 'member', tag: 'lr-alpha', kind: 'slot', name: '' }), compatibilityKey(key));
  assert.equal(compatibilityKey({ scope: 'export', kind: 'type', name: 'Thing' }), compatibilityKey({ scope: 'export', kind: 'type', module: null, name: 'Thing' }));
  assert.notEqual(compatibilityKey({ scope: 'export', kind: 'type', name: 'Thing' }), compatibilityKey({ scope: 'export', kind: 'type', name: 'thing' }));
  assert.throws(() => compatibilityKey({ ...key, name: 'bad\u0000name' }), /identity/u);
});

test('eligible historical policy preserves original property and paired attribute source facts', () => {
  const input = options();
  const context = assembleCompatibilityContext(input);
  const resolved = resolveCompatibilityRecord(context, key);
  assert.equal(resolved.state, 'retired');
  assert.deepEqual(resolved.policy, record);
  assert.equal(resolved.sourceMember.default, true);
  assert.equal(resolved.replacementMember.default, false);
  assert.equal(resolveCompatibilityRecord(context, { ...key, kind: 'attribute', name: 'old-value' }).policy.name, 'oldValue');
  input.captures[0].records[0].policy.rationale = 'changed';
  assert.equal(resolved.policy.rationale, record.rationale);
  assert.ok(Object.isFrozen(resolved.policy.replacement));
});

test('historical evidence never permits early removal or drifting a surviving notice', () => {
  assert.throws(() => assembleCompatibilityContext(options('22.0.0')), /before.*23/u);
  const current = options('22.0.0');
  current.currentInventory.components = [component()];
  assert.equal(resolveCompatibilityRecord(assembleCompatibilityContext(current), key).state, 'current');
  current.currentInventory.components[0].maturity.deprecations[0].since = '22.0.0';
  assert.throws(() => assembleCompatibilityContext(current), /published policy.*changed/u);
  current.currentInventory.components = [component({ notices: false })];
  assert.throws(() => assembleCompatibilityContext(current), /notice.*missing/u);
});

test('rejects later floors, unpublished policy, missing retirement, duplicates and missing replacement', () => {
  for (const mutate of [
    x => { x.captures[0].records[0].policy = { ...record, removalNotBefore: '24.0.0' }; },
    x => { x.captures[0].records[0].policy = { ...record, since: 'unreleased' }; },
    x => { x.retirementIndex = []; },
    x => { x.retirementIndex.push(structuredClone(x.retirementIndex[0])); },
    x => { x.currentInventory.components[0].surface.properties = []; },
    x => { x.captures[0].mirrors = [{ tag: 'lr-alpha', kind: 'property', name: 'oldValue', upstreamTag: 'wa-alpha' }]; },
  ]) {
    const input = options(); mutate(input);
    assert.throws(() => assembleCompatibilityContext(input));
  }
});

test('conservative exposure retains retired source owners and newly conflicting current owners', () => {
  const input = options();
  input.currentInventory.components.push({ tag: 'lr-new', surface: { events: [{ name: 'lr-change' }] } });
  const context = assembleCompatibilityContext(input);
  assert.deepEqual(compatibilityExposure(context, 'event', 'lr-change'), ['lr-alpha', 'lr-keeper', 'lr-new']);
  assert.equal(context.sourceComponents['lr-alpha'].surface.properties[1].name, 'oldValue');
});

test('removed owner needs its exact component policy and a current supported replacement', () => {
  const input = options();
  const tagKey = { scope: 'member', tag: 'lr-alpha', kind: 'component', name: 'lr-alpha' };
  const tagPolicy = { ...record, tag: 'lr-alpha', kind: 'component', name: 'lr-alpha', replacement: { kind: 'component', name: 'lr-beta' } };
  delete tagPolicy.attribute;
  input.currentInventory.components = [{ ...component({ old: false, notices: false }), tag: 'lr-beta' }];
  assert.throws(() => assembleCompatibilityContext(input), /owner/u);
  input.captures[0].components.push({ ...component({ old: false, notices: false }), tag: 'lr-beta' });
  input.captures[0].records.push({ key: tagKey, policy: tagPolicy });
  input.retirementIndex.push({ key: tagKey, removedIn: '23.0.0', sourceRelease: 'lyra-ui@22.0.0' });
  const context = assembleCompatibilityContext(input);
  assert.equal(resolveCompatibilityRecord(context, key).replacementOwner, 'lr-beta');
  assert.deepEqual(compatibilityExposure(context, 'event', 'lr-change'), ['lr-alpha', 'lr-beta', 'lr-keeper']);
});

test('retirement rejects new-only replacements, mirrored paired attributes and deleted slot-content hosts', () => {
  const novel = options();
  novel.captures[0].components[0].surface.properties = novel.captures[0].components[0].surface.properties.filter(member => member.name !== 'value');
  assert.throws(() => assembleCompatibilityContext(novel), /published compatibility window/u);
  const tooEarly = options(); tooEarly.captures[0].sourceVersion = '21.2.0'; tooEarly.captures[0].sourceRelease = 'lyra-ui@21.2.0'; tooEarly.retirementIndex[0].sourceRelease = 'lyra-ui@21.2.0';
  assert.throws(() => assembleCompatibilityContext(tooEarly), /published compatibility window/u);
  const mirrored = options(); mirrored.captures[0].mirrors.push({ tag: 'lr-alpha', kind: 'attribute', name: 'old-value', upstreamTag: 'wa-alpha' });
  assert.throws(() => assembleCompatibilityContext(mirrored), /mirrored/u);
  const slot = options();
  const slotPolicy = { ...record, kind: 'slot-content', name: '', replacement: { kind: 'slot', name: 'content' } }; delete slotPolicy.attribute;
  const slotKey = { ...key, kind: 'slot-content', name: '' };
  slot.captures[0].records = [{ key: slotKey, policy: slotPolicy }];
  slot.captures[0].components[0].surface.slots.push({ name: 'content' });
  slot.currentInventory.components[0].surface.slots = [{ name: 'content' }];
  slot.retirementIndex = [{ key: slotKey, removedIn: '23.0.0', sourceRelease: slot.captures[0].sourceRelease }];
  assert.throws(() => assembleCompatibilityContext(slot), /surviving public slot/u);
});

test('planned retirement metadata cannot forge a release or bypass a floor while alias survives', () => {
  for (const mutate of [entry => { entry.sourceRelease = 'lyra-ui@21.0.0'; }, entry => { entry.removedIn = '22.0.0'; }]) {
    const input = options('22.0.0'); input.currentInventory.components = [component()]; mutate(input.retirementIndex[0]);
    assert.throws(() => assembleCompatibilityContext(input));
  }
});

test('surviving export policy cannot hide a missing implementation across retirement cohorts', () => {
  const policy = { kind: 'class', module: '.', name: 'LyraGeojsonView', since: '22.0.0', removalNotBefore: '24.0.0',
    replacement: { kind: 'class', module: './components/viewers/geojson-view/geojson-viewer.class.js', name: 'LyraGeoJsonViewer', usage: 'Use the canonical granular class.' }, rationale: 'Root compatibility remains supported.' };
  const exportKey = { scope: 'export', kind: policy.kind, module: policy.module, name: policy.name };
  const input = { packageVersion: '23.0.0', currentInventory: { components: [] }, currentExportDeprecations: [policy], currentExportSurface: [],
    captures: [{ sourceRelease: 'lyra-ui@22.0.0', sourceVersion: '22.0.0', components: [], records: [{ key: exportKey, policy }], mirrors: [], exposure: { event: {}, part: {}, 'css-property': {} } }] };
  assert.throws(() => assembleCompatibilityContext(input), /missing source member or export/u);
  input.currentExportSurface.push({ key: exportKey, deprecated: true });
  assert.equal(resolveCompatibilityRecord(assembleCompatibilityContext(input), exportKey).state, 'current');
});
