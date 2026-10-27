#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROFILE_METHOD, PROFILE_WORKLOADS, PROFILE_ENGINES, profileCells, cellSchedule, validateCapabilities, validateDescriptor, validateOperation, validateSample, summarizeCell, sampleBudgetViolations } from './profile-results.mjs';
import { validateQuietObserver, inspectReviewedQuietReceipt, validateQuietEvidence } from './profile-admission.mjs';

const require = (condition, message) => { if (!condition) throw new TypeError(message); };
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const text = value => typeof value === 'string' && value.length > 0;
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);

export function profilePlan() {
  const cells = profileCells();
  return { schemaVersion: 1, status: 'not-collected', method: PROFILE_METHOD, cells, measuredSamples: cells.length * 60, warmupSamples: cells.length * 6,
    qualification: 'Not assessed. This plan contains no browser observations.' };
}
export function inspectQuietReceipt(receipt) {
  require(receipt?.inspected === true && hash(receipt.sha256) && finite(receipt.seconds) && receipt.seconds >= 60, 'An inspected sixty-second quiet precheck receipt is required.');
  for (const [key, ceiling] of [['meanCpuBusyFraction', .05], ['normalizedOneMinuteLoad', .1], ['maxUnrelatedProcessCpuFractionOfOneCore', .1]]) require(finite(receipt[key]) && receipt[key] < ceiling, `Quiet precheck failed: ${key}.`);
  require(receipt.swapActivity === false && receipt.concurrentTaskWorkloads === false, 'Quiet precheck found swap or concurrent work.');
}
export function validateFixture(fixture) {
  for (const name of ['prepare', 'runOperation', 'readOracle', 'dispose']) require(typeof fixture?.[name] === 'function', `Fixture method ${name} is required.`);
}
function validateInventory(operations) {
  require(Array.isArray(operations) && operations.length > 0 && operations.length <= 100 && new Set(operations.map(item => item.id)).size === operations.length, 'Operation inventory is missing or duplicated.');
  operations.forEach(validateDescriptor);
}
export function validateInputInventory(inputs) {
  require(inputs && typeof inputs === 'object' && !Array.isArray(inputs) && Object.keys(inputs).length > 0, 'Input byte inventory is required.');
  for (const [key, value] of Object.entries(inputs)) {
    require(/^[a-zA-Z][a-zA-Z0-9]*$/u.test(key) && hash(value?.sha256) && Number.isSafeInteger(value.utf8Bytes) && value.utf8Bytes >= 0
      && Number.isSafeInteger(value.utf16Units) && value.utf16Units >= 0 && Object.keys(value).every(name => ['sha256', 'utf8Bytes', 'utf16Units'].includes(name)), 'Invalid input identity or byte count.');
  }
}
export function validatePrepared(prepared, cell) {
  require(text(prepared?.generation) && hash(prepared.manifest?.sha256) && prepared.manifest.workload === cell.workload, 'Fixture identity is missing or mismatched.');
  validateInventory(prepared.operations);
  if (prepared.inputs !== undefined) validateInputInventory(prepared.inputs);
}
export function validateCollectionManifest(manifest) {
  require(manifest?.schemaVersion === 1 && manifest.method === PROFILE_METHOD && manifest.collection?.authorized === true
    && text(manifest.collection.id) && hash(manifest.collection.designSha256), 'Explicit collection manifest and design identity are required.');
  for (const key of ['archiveSha256', 'lockfileSha256', 'buildSha256']) require(hash(manifest.candidate?.[key]), `Missing actual candidate ${key}.`);
  for (const key of ['runnerSha256', 'resultsSha256', 'measurementSha256', 'driverSha256', 'admissionSha256']) require(hash(manifest.harness?.[key]), `Missing actual harness ${key}.`);
  for (const key of ['bundleSha256', 'inputsSha256', 'hostSha256', 'recordingSha256']) require(hash(manifest.fixtureBuild?.[key]), `Missing actual fixture build ${key}.`);
  const environment = manifest.environment;
  require(environment?.node === '22.23.2' && text(environment.os) && text(environment.arch) && text(environment.cpuModel)
    && Number.isSafeInteger(environment.logicalCpus) && environment.logicalCpus > 0 && finite(environment.memoryBytes) && environment.memoryBytes > 0
    && text(environment.playwright) && text(environment.esbuild), 'Actual environment identity is required.');
  for (const engine of PROFILE_ENGINES) {
    require(text(environment.browsers?.[engine]?.version) && hash(environment.browsers[engine].executableSha256), `Actual ${engine} artifact identity is required.`);
    validateCapabilities(manifest.controls?.[engine]);
    for (const capability of Object.values(manifest.controls[engine])) if (capability.supported) require(hash(capability.receipt), 'Positive-control receipt must identify its retained artifact.');
  }
  for (const workload of PROFILE_WORKLOADS) {
    require(hash(manifest.fixtures?.[workload]?.sha256), `Fixture ${workload} hash is required.`);
    validateInventory(manifest.fixtures[workload].operations);
    if (manifest.fixtures[workload].inputs !== undefined) validateInputInventory(manifest.fixtures[workload].inputs);
  }
  validateQuietObserver(manifest.quietObserver);
  if (manifest.quietObserver) inspectReviewedQuietReceipt(manifest.quietReceipt, manifest.quietObserver, { collectionId: manifest.collection.id, admissionSha256: manifest.harness.admissionSha256 });
  else {
    require(manifest.quietReceipt?.admission === undefined && (manifest.quietReceipt?.kind === undefined || manifest.quietReceipt.kind === 'quiet-live-receipt')
      && manifest.quietReceipt?.contaminated !== true && manifest.quietReceipt?.observationComplete !== false
      && (manifest.quietReceipt?.failures === undefined || Array.isArray(manifest.quietReceipt.failures) && manifest.quietReceipt.failures.length === 0), 'Strict collection cannot use a different observer or contaminated receipt.');
    inspectQuietReceipt(manifest.quietReceipt);
  }
  return manifest;
}

/** Adjacent cold/warm observations share a driver-owned context; narrow warm cells prime once. */
export function collectionSchedule() {
  const groups = new Map();
  for (const cell of profileCells()) {
    const key = `${cell.workload}/${cell.engine}/${cell.width}x${cell.height}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(cell);
  }
  return [...groups.entries()].flatMap(([group, cells]) => cellSchedule(cells[0]).flatMap(position => cells.map((cell, index) => ({
    cell, position: { ...position, cellId: cell.id }, pairId: `${group}/${position.batchIndex}/${position.sampleIndex}/${position.warmup ? 'warmup' : 'sample'}`,
    keepContext: index < cells.length - 1, primeCold: cells.length === 1 && cell.temperature === 'warm',
  }))));
}

/**
 * The browser driver verifies real artifacts, positive-control receipts and fixture
 * inventories before opening a sample page.
 * Even a complete collection is returned as unqualified, requiring independent review.
 */
export async function runProfile({ driver, manifest, signal, retain } = {}) {
  require(driver?.kind === 'playwright-profile-v1' && ['verify', 'openSample', 'checkQuiet', 'close'].every(name => typeof driver[name] === 'function'), 'A verified real-browser driver is required; synthetic drivers cannot collect.');
  validateCollectionManifest(manifest);
  require(typeof retain === 'function', 'An immutable raw-result retention callback is required.');
  const owned = freeze(JSON.parse(JSON.stringify(manifest)));
  const expected = { candidate: owned.candidate, harness: owned.harness, environment: owned.environment, fixtures: owned.fixtures, controls: owned.controls, fixtureBuild: owned.fixtureBuild };
  const report = { schemaVersion: 1, method: PROFILE_METHOD, status: 'collecting', qualification: 'not-assessed', manifest: owned,
    ...(owned.quietObserver ? { quietObserver: owned.quietObserver, admissionSha256: owned.harness.admissionSha256 } : {}), samples: [], warmups: [], summaries: [], failures: [] };
  const admission = { quietObserver: owned.quietObserver, collectionId: owned.collection.id, admissionSha256: owned.harness.admissionSha256 };
  let session, quietPhase;
  try {
    const verified = await driver.verify(owned);
    require(verified?.kind === 'browser-artifact-verification' && stable(verified.actual) === stable(expected), 'Browser driver artifact or positive-control verification mismatch.');
    report.verification = verified;
    await retain({ kind: 'verification', value: verified });
    for (const task of collectionSchedule()) {
      if (signal?.aborted) throw new Error('Collection aborted.');
      quietPhase = 'before'; report.lastAttempt = { cellId: task.cell.id, position: task.position, quietEvidence: {} };
      const quiet = await driver.checkQuiet(task);
      report.lastAttempt.quietEvidence.before = quiet;
      validateQuietEvidence(quiet, owned.quietObserver, admission);
      session = await driver.openSample({ ...task, manifest: owned, signal });
      validateFixture(session);
      for (const name of ['startObservation', 'phase', 'finishObservation', 'close', 'activate']) require(typeof session[name] === 'function', `Browser driver session lacks ${name}.`);
      const temperature = session.temperatureEvidence;
      require(temperature?.freshContext === (task.cell.temperature === 'cold' || task.primeCold)
        && temperature.primedMounts === (task.cell.temperature === 'warm' ? 1 : 0)
        && temperature.fullyDisposedBeforeSample === true, 'Driver did not establish the declared module temperature.');
      const prepared = await session.prepare({ cell: task.cell, ...task.position, signal });
      validatePrepared(prepared, task.cell);
      const fixture = owned.fixtures[task.cell.workload];
      require(prepared.manifest.sha256 === fixture.sha256 && stable(prepared.operations) === stable(fixture.operations), 'Prepared fixture differs from the frozen inventory.');
      require(stable(prepared.inputs) === stable(fixture.inputs), 'Prepared input bytes differ from the frozen inventory.');
      await session.startObservation();
      const operations = [];
      Object.assign(report.lastAttempt, { generation: prepared.generation, operations, ...(prepared.inputs ? { inputs: prepared.inputs } : {}) });
      for (const operation of prepared.operations) {
        await session.phase(operation.id);
        let armed = false;
        const value = await session.runOperation({ operation, generation: prepared.generation, signal, onArmed: async notice => {
          require(operation.trigger === 'event' && !armed && notice?.id === operation.id && notice.generation === prepared.generation, 'Invalid or duplicate native-input bridge notification.');
          armed = true;
          await session.activate(operation, { generation: prepared.generation, signal });
        } });
        require(operation.trigger !== 'event' || armed, 'Native operation never armed its input listener.');
        operations.push(value);
        validateOperation(value, operation, prepared.generation);
        require(operations.length === 1 ? value.firstMount !== undefined : value.firstMount === undefined, 'Shared first-mount evidence must occur exactly once on the first operation.');
        const oracle = await session.readOracle({ operation, generation: prepared.generation });
        require(oracle?.generation === prepared.generation && oracle.status === 'committed' && oracle.fingerprint === operation.expectedFingerprint && oracle.visible === true && oracle.connected === true, 'Driver visible oracle did not match the measured generation.');
      }
      const observed = await session.finishObservation({ quietTailMs: 1000, signal });
      report.lastAttempt.observed = observed;
      require(stable(observed.capabilities) === stable(owned.controls[task.cell.engine]), 'Observed capability receipt changed.');
      const disposal = await session.dispose();
      report.lastAttempt.disposal = disposal;
      quietPhase = 'after'; const postQuiet = await driver.checkQuiet(task);
      report.lastAttempt.quietEvidence.after = postQuiet;
      validateQuietEvidence(postQuiet, owned.quietObserver, admission);
      const sample = { schemaVersion: 1, ...task.position, operations, capabilities: observed.capabilities, observers: observed.observers, renderer: observed.renderer, window: observed.window, disposal,
        contaminated: quiet.contaminated || postQuiet.contaminated, quietEvidence: { before: quiet, after: postQuiet },
        ...(owned.quietObserver ? { quietObserver: owned.quietObserver, collectionId: owned.collection.id, admissionSha256: owned.harness.admissionSha256 } : {}),
        ...(prepared.inputs ? { inputs: prepared.inputs } : {}), fixtureSha256: fixture.sha256, quietReceiptSha256: postQuiet.receiptSha256,
        ...(observed.delivery ? { delivery: observed.delivery } : {}), ...(observed.hostRequests ? { hostRequests: observed.hostRequests } : {}) };
      validateSample(sample, task.cell, prepared.operations, { ...admission, warmup: task.position.warmup });
      (task.position.warmup ? report.warmups : report.samples).push(sample);
      await retain({ kind: task.position.warmup ? 'warmup' : 'sample', value: sample });
      if (!task.position.warmup) require(sampleBudgetViolations(sample, task.cell, prepared.operations, admission).length === 0, 'A sample exceeded its frozen budget.');
      await session.close({ keepContext: task.keepContext }); session = undefined;
      delete report.lastAttempt;
    }
    for (const cell of profileCells()) report.summaries.push(summarizeCell(cell, report.samples.filter(item => item.cellId === cell.id), owned.fixtures[cell.workload].operations, admission));
    report.status = report.summaries.every(item => item.status === 'within-scoped-budgets') ? 'collected-needs-review' : 'budget-exceeded';
  } catch (error) {
    if (error.diagnostic !== undefined && report.lastAttempt) {
      try { report.lastAttempt.diagnostic = JSON.parse(JSON.stringify(error.diagnostic)); }
      catch { report.lastAttempt.diagnostic = { unavailable: 'page-diagnostic-failed' }; }
    }
    if (error.quietEvidence) {
      report.refusedQuietEvidence = error.quietEvidence;
      if (report.lastAttempt && quietPhase) report.lastAttempt.quietEvidence[quietPhase] = error.quietEvidence;
    }
    report.status = 'incomplete'; report.failures.push({ category: signal?.aborted ? 'aborted' : 'collection-failed', message: 'Collection stopped; retain driver diagnostics separately.' });
    await retain({ kind: 'failure', value: report });
    throw Object.assign(new Error('Profile collection stopped without qualification.', { cause: error }), { report });
  } finally {
    try { if (session) { try { await session.dispose(); } finally { await session.close({ keepContext: false }); } } }
    finally { await driver.close(); }
  }
  await retain({ kind: 'report', value: report });
  return report;
}

/** Explicit caller-supplied destination; existing reports are never overwritten. */
export async function writeProfileRecord(filename, record) {
  await writeFile(filename, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
}
/** Lazy reuse; importing this module neither builds assets nor starts a server/browser. */
export async function profileBuildTools() {
  const [{ buildContext }, { serve }] = await Promise.all([import('../../packages/lyra-gen/scripts/measure-bundles.mjs'), import('./run.mjs')]);
  return { buildContext, serve };
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length === 3 && process.argv[2] === '--plan') process.stdout.write(`${JSON.stringify(profilePlan(), null, 2)}\n`);
  else {
    void import('./profile-driver.mjs').then(({ runProfileCli }) => runProfileCli(process.argv.slice(2)))
      .catch(() => { process.stderr.write('Profile collection stopped without qualification. Inspect retained failure evidence and explicit authorization receipts.\n'); process.exitCode = 1; });
  }
}
