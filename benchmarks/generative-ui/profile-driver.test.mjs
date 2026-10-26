import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { fixtureModuleFor, validateNativeAction, requestAllowed, validateControlProbe, definitionDigest, parseDriverOptions, checkFreshQuietReceipt, quietEvidenceFromBytes, profileHarnessIdentity, requireFixtureModules, createProfileDriver, profileInputKey, prepareBrowserFixture, beginProfileObservation } from './profile-driver.mjs';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { reviewedQuietFixture, sharedHostQuietFixture } from './profile-reviewed.test-fixture.mjs';
import { validateQuietEvidence } from './profile-admission.mjs';

test('workloads have closed module routes and cannot select arbitrary modules', () => {
  assert.equal(fixtureModuleFor('T'), 'workloads/text.js');
  assert.equal(fixtureModuleFor('L'), 'workloads/chat.js');
  assert.equal(fixtureModuleFor('R'), 'workloads/views.js');
  assert.equal(fixtureModuleFor('K'), 'workloads/ai-sdk.js');
  assert.throws(() => fixtureModuleFor('../outside'));
});

test('native activation requires an explicit bounded actual control selector/action', () => {
  assert.doesNotThrow(() => validateNativeAction({ action: 'fill', selector: '#host input[name="note"]', value: 'Changed' }));
  assert.doesNotThrow(() => validateNativeAction({ action: 'fill', selector: '#host input[name="filter"]', value: '' }));
  for (const value of [{ action: 'evaluate', selector: 'input' }, { action: 'fill', selector: 'input' }, { action: 'click', selector: '' }, { action: 'click', selector: 'button', value: 'ignored' }, { action: 'click', selector: 'button', value: '' }, { action: 'press', selector: 'input', value: '' }, { action: 'fill', selector: 'input', value: 'x'.repeat(4097) }]) assert.throws(() => validateNativeAction(value));
});

test('network policy admits only same-origin static reads and individually declared host operations', () => {
  const origin = 'http://127.0.0.1:1234'; const routes = [{ path: '/host/query', methods: ['POST'] }];
  assert.equal(requestAllowed({ url: `${origin}/main.js`, method: 'GET', origin, assets: ['/main.js'], routes }), true);
  assert.equal(requestAllowed({ url: `${origin}/host/query`, method: 'POST', origin, assets: [], routes }), true);
  for (const [url, method] of [['https://example.org/main.js', 'GET'], [`${origin}/unknown`, 'GET'], [`${origin}/host/query`, 'DELETE'], [`${origin}/main.js?hidden=1`, 'GET'], [`${origin}/host/query/extra`, 'POST']]) {
    assert.equal(requestAllowed({ url, method, origin, assets: ['/main.js'], routes }), false);
  }
});

test('positive-control capability cannot be inferred from missing observations or a zero', () => {
  const supported = { longtask: { supported: true, durations: [75] }, layoutShift: { supported: true, values: [.02] } };
  assert.doesNotThrow(() => validateControlProbe(supported));
  assert.throws(() => validateControlProbe({ ...supported, longtask: { supported: true, durations: [] } }));
  assert.throws(() => validateControlProbe({ ...supported, layoutShift: { supported: true, values: [0] } }));
  assert.throws(() => validateControlProbe({ ...supported, longtask: { supported: false, durations: [] } }));
  assert.doesNotThrow(() => validateControlProbe({ longtask: { supported: false, durations: null }, layoutShift: { supported: false, values: null } }));
});

test('definition digest is canonical but distinguishes semantic inventories', () => {
  assert.equal(definitionDigest({ b: 2, a: 1 }), definitionDigest({ a: 1, b: 2 }));
  assert.notEqual(definitionDigest({ sizes: { rows: 100 } }), definitionDigest({ sizes: { rows: 200 } }));
});

test('current timing harness identity binds the admission helper bytes', async () => {
  const identity = await profileHarnessIdentity();
  const helper = await readFile(new URL('./profile-admission.mjs', import.meta.url));
  assert.equal(identity.admissionSha256, createHash('sha256').update(helper).digest('hex'));
  assert.deepEqual(Object.keys(identity).sort(), ['admissionSha256', 'driverSha256', 'measurementSha256', 'resultsSha256', 'runnerSha256']);
});

test('collection CLI requires all explicit artifact/authorization receipts and rejects duplicate flags', () => {
  const flags = ['manifest', 'quiet', 'controls', 'archive', 'build-manifest', 'output'].map(key => `--${key}=fixture-${key}`);
  assert.equal(parseDriverOptions(flags).manifest, 'fixture-manifest');
  assert.throws(() => parseDriverOptions(flags.slice(1)));
  assert.throws(() => parseDriverOptions([...flags, '--manifest=other']));
  assert.throws(() => parseDriverOptions([...flags, '--samples=1']));
});

test('quiet receipt is collection-bound and must be refreshed, never reused indefinitely', () => {
  const receipt = { inspected: true, seconds: 60, meanCpuBusyFraction: 0, normalizedOneMinuteLoad: 0, maxUnrelatedProcessCpuFractionOfOneCore: 0,
    swapActivity: false, concurrentTaskWorkloads: false, sha256: 'a'.repeat(64), collectionId: 'case', observedAt: 1000 };
  assert.doesNotThrow(() => checkFreshQuietReceipt(receipt, 'case', 2000));
  assert.throws(() => checkFreshQuietReceipt(receipt, 'other', 2000));
  assert.throws(() => checkFreshQuietReceipt(receipt, 'case', 7000));
  assert.throws(() => checkFreshQuietReceipt(receipt, 'case', 999));
  assert.throws(() => checkFreshQuietReceipt({ ...receipt, admission: { profile: 'reviewed-idle-service-v1', accepted: true } }, 'case', 2000));
  assert.throws(() => checkFreshQuietReceipt({ ...receipt, kind: 'reviewed-idle-service-live-receipt' }, 'case', 2000));
  for (const kind of ['shared-host-observed-live-receipt', 'unknown-live-receipt']) assert.throws(() => checkFreshQuietReceipt({ ...receipt, kind }, 'case', 2000));
  assert.throws(() => checkFreshQuietReceipt({ ...receipt, contaminated: true }, 'case', 2000));
});

test('reviewed live bytes retain actual strict failure, exact digest and explicit fresh collection scope', () => {
  const { observer, receipt } = reviewedQuietFixture(), source = ` \n${JSON.stringify(receipt, null, 2)}\n\t`, bytes = Buffer.from(source);
  const options = { now: 120001, quietObserver: observer, admissionSha256: receipt.admissionSha256 };
  const evidence = quietEvidenceFromBytes(bytes, receipt.collectionId, options);
  assert.equal(evidence.receiptSha256, createHash('sha256').update(bytes).digest('hex'));
  assert.equal(evidence.receiptSource, source);
  assert.equal(evidence.contaminated, true); assert.deepEqual(evidence.receipt.failures, ['unrelated-workload', 'process-observation-incomplete']);
  assert.equal(evidence.receipt.observationComplete, false); assert.equal(evidence.receipt.admission.accepted, true);
  for (const invalid of [{ now: 125001, quietObserver: observer }, { now: 119999, quietObserver: observer },
    { now: 120001 }, { ...options, admissionSha256: '8'.repeat(64) }, { now: 120001, quietObserver: { ...observer, configSha256: 'f'.repeat(64) } }]) {
    assert.throws(() => quietEvidenceFromBytes(bytes, receipt.collectionId, invalid));
  }
  assert.throws(() => quietEvidenceFromBytes(bytes, 'different-collection', { now: 120001, quietObserver: observer }));
  const changed = structuredClone(receipt); changed.admission.services[0].lastCpuTicks = '26';
  const refusedBytes = Buffer.from(`${JSON.stringify(changed)}\n`);
  assert.throws(() => quietEvidenceFromBytes(refusedBytes, receipt.collectionId, { now: 120001, quietObserver: observer }), error => {
    assert.equal(error.quietEvidence.receiptSha256, createHash('sha256').update(refusedBytes).digest('hex'));
    assert.equal(error.quietEvidence.receiptSource, refusedBytes.toString('utf8'));
    assert.equal(error.quietEvidence.contaminated, true); assert.deepEqual(error.quietEvidence.receipt, changed); return true;
  });
  assert.throws(() => quietEvidenceFromBytes(Buffer.from('{'), receipt.collectionId, { now: 120001, quietObserver: observer }), error => error.quietEvidence === undefined);
  const lossy = Buffer.concat([Buffer.from('{"value":"'), Buffer.from([255]), Buffer.from('"}')]);
  assert.throws(() => quietEvidenceFromBytes(lossy, receipt.collectionId, options), /lossless UTF8/u);
  const edited = structuredClone(evidence); edited.receipt.meanCpuBusyFraction = .02;
  assert.throws(() => validateQuietEvidence(edited, observer, { collectionId: receipt.collectionId, admissionSha256: receipt.admissionSha256 }), /source bytes/u);
  assert.throws(() => validateQuietEvidence({ ...evidence, receiptSource: evidence.receiptSource.trim() }, observer), /source bytes/u);
  assert.doesNotThrow(() => checkFreshQuietReceipt(receipt, receipt.collectionId, 120001, observer, receipt.admissionSha256));
  assert.throws(() => checkFreshQuietReceipt(receipt, receipt.collectionId, 120001, observer, '8'.repeat(64)), /helper identity/u);
});

test('shared-host timing admission retains 0.35875 background CPU while strict and reviewed-idle refuse it', () => {
  const { observer, receipt, receiptSource } = sharedHostQuietFixture();
  const options = { now: 120001, quietObserver: observer, admissionSha256: receipt.admissionSha256 };
  const evidence = quietEvidenceFromBytes(Buffer.from(receiptSource), receipt.collectionId, options);
  assert.equal(evidence.contaminated, true); assert.equal(evidence.receipt.admission.accepted, true);
  assert.equal(evidence.receipt.maxUnrelatedProcessCpuFractionOfOneCore, .35875);
  assert.equal(evidence.receipt.admission.metrics.maxUnrelatedUserspaceProcessCpuFractionOfOneCore, .35875);
  assert.ok(evidence.receipt.failures.includes('unrelated-process-cpu'));
  assert.throws(() => quietEvidenceFromBytes(Buffer.from(receiptSource), receipt.collectionId, { ...options, quietObserver: undefined }));
  const reviewed = reviewedQuietFixture();
  assert.throws(() => quietEvidenceFromBytes(Buffer.from(receiptSource), receipt.collectionId, { ...options, quietObserver: reviewed.observer }));
  assert.throws(() => quietEvidenceFromBytes(Buffer.from(reviewed.receiptSource), receipt.collectionId, options));
  reviewed.receipt.maxUnrelatedProcessCpuFractionOfOneCore = .35875;
  reviewed.receipt.admission.metrics.maxUnrelatedUserspaceProcessCpuFractionOfOneCore = .35875;
  reviewed.receipt.failures.unshift('unrelated-process-cpu');
  assert.throws(() => quietEvidenceFromBytes(Buffer.from(JSON.stringify(reviewed.receipt)), receipt.collectionId, { ...options, quietObserver: reviewed.observer }), /fixed gates/u);
});

test('missing fixture modules fail before resolving build dependencies or starting a browser', async () => {
  await assert.rejects(requireFixtureModules(new URL('./missing-profile-fixture/', import.meta.url)), /fixture module/iu);
});

// Synthetic policy tests are not browser observations or campaign evidence.
test('driver construction is inert and no page can open before artifact verification', async () => {
  const driver = createProfileDriver({});
  await assert.rejects(driver.openSample({}), /unverified/u);
  await assert.rejects(driver.verify({}), /manifest|identity/u);
  await driver.close();
});

test('bundle guard identifies a rejected source input without weakening dist or dependency admission', () => {
  assert.equal(profileInputKey('../../packages/lyra-ui/dist/internal/dev-warning.production.js', '/repository/benchmarks/generative-ui', '/repository'), 'packages/lyra-ui/dist/internal/dev-warning.production.js');
  assert.equal(profileInputKey('../../node_modules/lit/index.js', '/repository/benchmarks/generative-ui', '/repository'), 'node_modules/lit/index.js');
  assert.throws(() => profileInputKey('../../packages/lyra-ui/src/internal/dev-warning.production.ts', '/repository/benchmarks/generative-ui', '/repository'), /rejected packages\/lyra-ui\/src\/internal\/dev-warning\.production\.ts/u);
  assert.throws(() => profileInputKey('../../../outside.js', '/repository/benchmarks/generative-ui', '/repository'), /outside the repository/u);
});

test('resources arriving during prepare survive in a distinct segment before the observation clock starts', async () => {
  const resource = name => ({ name: `http://localhost/${name}`, encodedBodySize: 10, decodedBodySize: 20, duration: 3 });
  let resources = [resource('entry.js')]; const order = [];
  const environment = { URL, performance: { getEntriesByType(type) { assert.equal(type, 'resource'); return resources; }, clearResourceTimings() { resources = []; order.push('clear'); } },
    window: { __genProfile: { async prepare(value) { order.push('prepare'); resources.push(resource('dynamic-role.js')); return { generation: value.generation }; },
      startObservation() { order.push('observation'); assert.equal(resources.length, 0); return { longtask: true, layoutShift: true }; } } } };
  const page = { async evaluate(callback, argument) { return runInNewContext(`(${callback.toString()})(argument)`, { ...environment, argument }); } };
  const initial = resources.map(value => value.name);
  const prepared = await prepareBrowserFixture(page, { generation: 'g1' });
  assert.equal(prepared.generation, 'g1');
  const observed = await beginProfileObservation(page);
  assert.equal(initial[0], 'http://localhost/entry.js');
  assert.equal(observed.preparation.length, 1);
  assert.equal(observed.preparation[0].path, '/dynamic-role.js');
  assert.equal(observed.preparation[0].encodedBytes, 10);
  assert.deepEqual(order, ['clear', 'prepare', 'clear', 'observation']);
  resources.push(resource('mounted-view.js'));
  assert.equal(observed.preparation.length, 1);
  assert.equal(observed.preparation[0].path, '/dynamic-role.js');
});

test('functional preparation does not collect or reset a delivery timeline', async () => {
  const page = { async evaluate(callback, argument) { return runInNewContext(`(${callback.toString()})(argument)`, { argument,
    performance: { clearResourceTimings() { throw new Error('Functional smoke must not collect delivery metrics.'); } },
    window: { __genProfile: { prepare() { return 'prepared'; } } } }); } };
  assert.equal(await prepareBrowserFixture(page, { functionalSmoke: true }), 'prepared');
});
