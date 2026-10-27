import { createHash } from 'node:crypto';
import { readFile, readdir, stat, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { cpus, totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectQuietReceipt, validateCollectionManifest, validatePrepared, runProfile, writeProfileRecord } from './profile.mjs';
import { PROFILE_ENGINES, PROFILE_WORKLOADS, PROFILE_METHOD, validateOperation } from './profile-results.mjs';
import { prepareProfileHost, createOwnedPage, activateNative, validateNativeAction } from './profile-host.mjs';
import { validateQuietObserver, inspectReviewedQuietReceipt, makeReviewedQuietEvidence, validateQuietEvidence } from './profile-admission.mjs';
export { profileBrowserResolution, profileInputKey, validateNativeAction, requestAllowed } from './profile-host.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const fixtureDirectory = new URL('./profile-fixture/', import.meta.url);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const stable = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);
const require = (condition, message) => { if (!condition) throw new TypeError(message); };
const hashesEqual = (actual, expected, message) => require(stable(actual) === stable(expected), message);
const moduleRoutes = Object.freeze({ T: 'text', C: 'chat', L: 'chat', V: 'views', X: 'views', R: 'views', D: 'dashboards', S: 'dashboards', A: 'a2ui', K: 'ai-sdk' });
export function fixtureModuleFor(workload) {
  require(Object.hasOwn(moduleRoutes, workload), 'Unknown profile workload.');
  return `workloads/${moduleRoutes[workload]}.js`;
}
export const definitionDigest = definition => digest(stable(definition));
/** Preparation has its own delivery segment and remains outside the operation clock. */
export function prepareBrowserFixture(page, context) {
  return page.evaluate(value => {
    if (!value.functionalSmoke) performance.clearResourceTimings();
    return window.__genProfile.prepare(value);
  }, context);
}
export async function runBrowserOperation(page, context) {
  try { return await page.evaluate(args => window.__genProfile.runOperation(args), context); }
  catch (error) {
    let diagnostic = { unavailable: 'page-diagnostic-failed' };
    try { diagnostic = JSON.parse(JSON.stringify(await page.evaluate(args => window.__genProfile.diagnose(args), context))); }
    catch { /* The original operation failure remains authoritative. */ }
    try { error.diagnostic = diagnostic; }
    catch { /* A nonextensible thrown value still retains its original identity. */ }
    throw error;
  }
}
export function beginProfileObservation(page) {
  return page.evaluate(() => {
    const preparation = performance.getEntriesByType('resource').map(item => ({ path: new URL(item.name).pathname,
      encodedBytes: item.encodedBodySize, decodedBytes: item.decodedBodySize, durationMs: item.duration }));
    performance.clearResourceTimings();
    return { preparation, supported: window.__genProfile.startObservation() };
  });
}
export function validateControlProbe(probe) {
  for (const [key, metric, threshold] of [['longtask', 'durations', 50], ['layoutShift', 'values', Number.MIN_VALUE]]) {
    const value = probe?.[key];
    require(typeof value?.supported === 'boolean', 'Missing observer capability.');
    require(value.supported ? Array.isArray(value[metric]) && value[metric].every(item => Number.isFinite(item) && item >= 0) && value[metric].some(item => item >= threshold) : value[metric] === null, `Observer ${key} lacks a positive control or honest unsupported value.`);
  }
  return probe;
}
export function parseDriverOptions(args) {
  const names = ['manifest', 'quiet', 'controls', 'archive', 'build-manifest', 'output']; const options = {};
  for (const arg of args) {
    const match = /^--([a-z-]+)=(.+)$/u.exec(arg);
    require(match && names.includes(match[1]) && !Object.hasOwn(options, match[1]), 'Unknown, duplicate or empty driver option.'); options[match[1]] = match[2];
  }
  require(names.every(key => options[key]), 'Supply manifest, quiet, controls, archive, build-manifest and output.');
  return options;
}
export function checkFreshQuietReceipt(receipt, collectionId, now = Date.now(), quietObserver, admissionSha256) {
  validateQuietObserver(quietObserver);
  if (quietObserver) { inspectReviewedQuietReceipt(receipt, quietObserver, { collectionId, now, admissionSha256 }); return receipt; }
  require(receipt?.admission === undefined && (receipt?.kind === undefined || receipt.kind === 'quiet-live-receipt') && receipt?.contaminated !== true
    && receipt?.observationComplete !== false && (receipt?.failures === undefined || Array.isArray(receipt.failures) && receipt.failures.length === 0), 'Strict quiet receipt is contaminated or uses a different observer.');
  inspectQuietReceipt(receipt);
  require(receipt.collectionId === collectionId && Number.isFinite(receipt.observedAt) && receipt.observedAt <= now && now - receipt.observedAt <= 5000, 'Quiet monitor receipt is stale or belongs to another collection.');
  return receipt;
}
export function quietEvidenceFromBytes(bytes, collectionId, { now = Date.now(), quietObserver, admissionSha256 } = {}) {
  require(bytes instanceof Uint8Array, 'Quiet evidence requires exact UTF8 receipt bytes.');
  const receiptSource = Buffer.from(bytes).toString('utf8');
  require(Buffer.from(receiptSource, 'utf8').equals(Buffer.from(bytes)), 'Quiet receipt is not lossless UTF8.');
  const receipt = JSON.parse(receiptSource), receiptSha256 = digest(bytes);
  try {
    checkFreshQuietReceipt(receipt, collectionId, now, quietObserver, admissionSha256);
    const evidence = quietObserver ? makeReviewedQuietEvidence(receipt, receiptSha256, quietObserver, { collectionId, now, admissionSha256, receiptSource })
      : { contaminated: receipt.contaminated ?? false, receiptSha256, receiptSource, receipt };
    validateQuietEvidence(evidence, quietObserver, { collectionId, now, admissionSha256 }); return evidence;
  } catch (error) {
    throw Object.assign(error, { quietEvidence: { receiptSha256, receiptSource, receipt, contaminated: receipt?.contaminated } });
  }
}
export async function requireFixtureModules(directory = fixtureDirectory) {
  const files = [...new Set(PROFILE_WORKLOADS.map(fixtureModuleFor)), 'workloads/views-host.mjs', 'workloads/dashboards-host.mjs'];
  for (const file of files) {
    let exists = false; try { exists = (await stat(new URL(file, directory))).isFile(); } catch { /* Missing modules fail before dependency resolution. */ }
    require(exists, `Required fixture module is unavailable: ${file}.`);
  }
}
async function filesUnder(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    require(!entry.isSymbolicLink(), 'Built artifact inventory cannot contain symbolic links.');
    if (entry.isDirectory()) result.push(...await filesUnder(join(directory, entry.name), `${name}/`));
    else if (entry.isFile()) result.push(name);
  }
  return result.sort();
}
async function fileDigest(path) { return digest(await readFile(path)); }
export async function profileBuildInventory() {
  const files = {};
  for (const name of ['lyra-ui', 'lyra-gen']) {
    const paths = [`packages/${name}/package.json`, ...(await filesUnder(join(root, `packages/${name}/dist`))).map(file => `packages/${name}/dist/${file}`)];
    for (const file of paths) files[file] = await fileDigest(join(root, file));
  }
  return { schemaVersion: 1, files };
}
async function verifyBuiltFiles(manifestPath) {
  const bytes = await readFile(manifestPath), manifest = JSON.parse(bytes);
  hashesEqual(manifest, await profileBuildInventory(), 'Built inventory must match every published build file and package manifest.');
  return digest(bytes);
}
export async function profileSourceIdentity() {
  const files = ['profile.mjs', 'profile-results.mjs', 'profile-driver.mjs', 'profile-host.mjs', 'profile-smoke.mjs', 'profile-admission.mjs',
    ...(await filesUnder(fileURLToPath(fixtureDirectory))).filter(file => !file.includes('.test.')).map(file => `profile-fixture/${file}`)];
  const inventory = Object.fromEntries(await Promise.all(files.map(async file => [`benchmarks/generative-ui/${file}`, await fileDigest(join(here, file))])));
  for (const file of ['packages/lyra-gen/scripts/measure-bundles.mjs', 'packages/lyra-gen/examples/chat.ts', 'packages/lyra-gen/examples/dashboard.ts', 'packages/lyra-gen/examples/recordings/chat-review.v1.json']) inventory[file] = await fileDigest(join(root, file));
  return definitionDigest(inventory);
}
export async function profileHarnessIdentity() {
  return Object.fromEntries(await Promise.all([['runner', 'profile.mjs'], ['results', 'profile-results.mjs'], ['measurement', 'profile-fixture/measurement.js'],
    ['driver', 'profile-driver.mjs'], ['admission', 'profile-admission.mjs']].map(async ([key, file]) => [`${key}Sha256`, await fileDigest(join(here, file))])));
}
export function validateSmokeAuthorization(value) {
  const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
  require(value?.schemaVersion === 1 && value.kind === 'functional-smoke' && value.authorized === true && hash(value.sourceSha256), 'Explicit functional-smoke authorization and source identity are required.');
  require(['archiveSha256', 'lockfileSha256', 'buildSha256'].every(key => hash(value.candidate?.[key])), 'Exact smoke candidate identities are required.');
  require(PROFILE_ENGINES.includes(value.browser?.engine) && hash(value.browser.executableSha256), 'Exact smoke browser identity is required.');
  require(Array.isArray(value.workloads) && value.workloads.length > 0 && new Set(value.workloads).size === value.workloads.length && value.workloads.every(id => PROFILE_WORKLOADS.includes(id)), 'Explicit unique smoke workload inventory is required.');
  if (value.viewport !== undefined) {
    require(value.viewport && [320, 1280].includes(value.viewport.width) && value.viewport.height === 900
      && Object.keys(value.viewport).every(key => ['width', 'height'].includes(key)), 'Unsupported functional smoke viewport.');
    require(value.viewport.width !== 320 || value.workloads.every(id => ['L', 'D', 'R'].includes(id)), 'Narrow smoke is limited to the declared responsive workloads.');
  }
  require(value.collection === undefined && value.samples === undefined && value.budgets === undefined, 'A functional smoke cannot authorize performance collection.');
  return value;
}
/** Inert input inventory; the caller must explicitly authorize the returned draft. */
export async function smokeAuthorizationDraft({ archive, buildManifest, engine = 'chromium', workloads = [...PROFILE_WORKLOADS], viewport }) {
  require(PROFILE_ENGINES.includes(engine), 'Unknown smoke browser.');
  const browserTypes = await import('playwright');
  return { schemaVersion: 1, kind: 'functional-smoke', authorized: false, sourceSha256: await profileSourceIdentity(),
    candidate: { archiveSha256: await fileDigest(archive), lockfileSha256: await fileDigest(join(root, 'pnpm-lock.yaml')), buildSha256: await verifyBuiltFiles(buildManifest) },
    browser: { engine, executableSha256: await fileDigest(browserTypes[engine].executablePath()) }, workloads,
    ...(viewport === undefined ? {} : { viewport: { ...viewport } }) };
}
/** Read-only draft: no bundle build, server, browser or capability probe is started. */
export async function preflightAuthorizationDraft({ archive, buildManifest }) {
  const smoke = await smokeAuthorizationDraft({ archive, buildManifest });
  const browserTypes = await import('playwright');
  const browsers = { chromium: { executableSha256: smoke.browser.executableSha256 } };
  for (const engine of PROFILE_ENGINES.slice(1)) browsers[engine] = { executableSha256: await fileDigest(browserTypes[engine].executablePath()) };
  return { schemaVersion: 1, kind: 'profile-capability-preflight', authorized: false, sourceSha256: smoke.sourceSha256,
    candidate: smoke.candidate, browsers, workloads: [...PROFILE_WORKLOADS] };
}
export function validatePreflightAuthorization(value) {
  require(value?.schemaVersion === 1 && value.kind === 'profile-capability-preflight' && value.authorized === true,
    'Explicit capability-preflight authorization is required.');
  hashesEqual(value.workloads, [...PROFILE_WORKLOADS], 'Preflight must preserve the complete fixture inventory.');
  require(value.browsers && Object.keys(value.browsers).length === PROFILE_ENGINES.length, 'Preflight requires all browser artifacts.');
  for (const engine of PROFILE_ENGINES) {
    require(value.browsers[engine] && Object.keys(value.browsers[engine]).every(key => key === 'executableSha256'), 'Unexpected preflight browser identity field.');
    validateSmokeAuthorization({ schemaVersion: 1, kind: 'functional-smoke', authorized: value.authorized,
      sourceSha256: value.sourceSha256, candidate: value.candidate, browser: { engine, ...value.browsers[engine] }, workloads: value.workloads });
  }
  require(Object.keys(value).every(key => ['schemaVersion', 'kind', 'authorized', 'sourceSha256', 'candidate', 'browsers', 'workloads'].includes(key)), 'Preflight cannot authorize samples, GC or quiet monitoring.');
  return value;
}
/** Exact retained bytes are compatible with writeProfileRecord and collection verification. */
export function positiveControlReceipt({ engine, browserVersion, measurementSha256, probe }) {
  require(PROFILE_ENGINES.includes(engine) && typeof browserVersion === 'string' && browserVersion.length > 0
    && /^[a-f0-9]{64}$/u.test(measurementSha256), 'Positive control artifact identity is required.');
  validateControlProbe(probe);
  const receipt = { schemaVersion: 1, engine, browserVersion, measurementSha256, probe: JSON.parse(JSON.stringify(probe)) };
  const sha256 = digest(`${JSON.stringify(receipt, null, 2)}\n`);
  const capabilities = Object.fromEntries(['longtask', 'layoutShift'].map(key => [key, probe[key].supported
    ? { supported: true, positiveControl: true, receipt: sha256 }
    : { supported: false, positiveControl: false, reason: `PerformanceObserver does not support ${key === 'longtask' ? 'longtask' : 'layout-shift'} in this browser.` }]));
  return { receipt, sha256, capabilities };
}
export function preflightFixtureRecord(definition, prepared, cell) {
  require(definition?.workload === cell.workload, 'Preflight fixture identity changed.');
  validatePrepared(prepared, cell);
  const sha256 = definitionDigest(definition);
  hashesEqual(prepared.operations, definition.operations, 'Preflight prepared operation inventory changed.');
  require(prepared.manifest.sha256 === sha256, 'Preflight prepared fixture changed.');
  for (const operation of definition.operations) if (operation.trigger === 'event') validateNativeAction(operation.native);
  return { sha256, operations: definition.operations, ...(prepared.inputs ? { inputs: prepared.inputs } : {}) };
}
export function preflightManifestDraft({ candidate, harness, fixtureBuild, environment, fixtures, controls }) {
  return JSON.parse(JSON.stringify({ schemaVersion: 1, method: PROFILE_METHOD,
    collection: { authorized: false, id: null, designSha256: null }, candidate, harness, fixtureBuild, environment, fixtures, controls, quietReceipt: null }));
}
export function semanticSmokeOutcome(record, operation, generation, oracle) {
  validateOperation(record, operation, generation);
  require(oracle?.generation === generation && oracle.status === 'committed' && oracle.fingerprint === operation.expectedFingerprint && oracle.connected === true && oracle.visible === true, 'Functional smoke semantic oracle did not commit.');
  return { id: operation.id, status: 'committed', trigger: operation.trigger, fingerprint: oracle.fingerprint };
}

/** Runs only when an authorized driver explicitly invokes it, never on import. */
export async function probeBrowserCapabilities(page) {
  const probe = await page.evaluate(async () => {
    const supported = type => PerformanceObserver.supportedEntryTypes.includes(type);
    const durations = supported('longtask') ? [] : null, values = supported('layout-shift') ? [] : null;
    const observers = [];
    const observe = (type, accept) => { const observer = new PerformanceObserver(list => list.getEntries().forEach(accept)); observer.observe({ type }); observers.push([observer, accept]); };
    if (durations) observe('longtask', entry => durations.push(entry.duration));
    if (values) observe('layout-shift', entry => { if (!entry.hadRecentInput) values.push(entry.value); });
    const box = document.createElement('div'); box.textContent = 'Observer positive control'; box.style.cssText = 'display:block;width:200px;height:100px'; document.body.append(box);
    try {
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      await new Promise(done => setTimeout(done, 600));
      const end = performance.now() + 80; while (performance.now() < end) { /* Intentional long-task positive control. */ }
      box.style.marginTop = '180px';
      await new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done)));
      await new Promise(done => setTimeout(done, 200));
      for (const [observer, accept] of observers) observer.takeRecords().forEach(accept);
      return { longtask: { supported: durations !== null, durations }, layoutShift: { supported: values !== null, values } };
    } finally { observers.forEach(([observer]) => observer.disconnect()); box.remove(); }
  });
  return validateControlProbe(probe);
}

/** Production browser driver. Construction is inert; verify requires full authorization. */
export function createProfileDriver(options) {
  let owned, scratch, artifacts, host, browser, engine, paired, playwright, verificationMode, admissionSha256;
  const definitions = {}, probes = {};
  let serviceValues = {};
  async function ensureBrowser(next) {
    if (engine !== next) {
      require(!paired, 'A paired context cannot cross browser engines.');
      await browser?.close(); browser = undefined;
      browser = await playwright[next].launch({ headless: true }); engine = next;
    }
    return browser;
  }
  async function checkQuiet() {
    require(owned, 'Driver has not verified authorization.');
    return quietEvidenceFromBytes(await readFile(options.quiet), owned.collection.id, { quietObserver: owned.quietObserver, admissionSha256 });
  }
  async function createPage(cell, { diagnostic = false } = {}) {
    const active = await ensureBrowser(cell.engine);
    const archive = new Map(); let serial = 0, state;
    state = await createOwnedPage({ browser: active, host, viewport: { width: cell.width, height: cell.height },
      globalName: '__genProfile', collectDelivery: !diagnostic, cdp: !diagnostic && cell.engine === 'chromium',
      bindings: {
        __genProfileArmed: async (_source, notice) => {
          require(typeof state?.onArmed === 'function', 'Native listener armed outside an operation.');
          await state.onArmed(notice);
        },
        __genProfileArchive: (_source, request) => {
          if (request.action === 'save') {
            const encoded = JSON.stringify(request.value);
            require(encoded.length <= 2 * 1024 * 1024 && archive.size < 2, 'Chat archive exceeds its scoped limit.');
            const token = `archive-${++serial}`; archive.set(token, encoded); return token;
          }
          require(archive.has(request.token), 'Chat archive token is unavailable.');
          if (request.action === 'load') return JSON.parse(archive.get(request.token));
          require(request.action === 'release', 'Unknown chat archive action.'); archive.delete(request.token); return null;
        },
      } });
    state.archive = archive; state.onArmed = undefined;
    try { if (state.cdp) await state.cdp.send('Performance.enable'); return state; }
    catch (error) { await state.context.close(); throw error; }
  }
  const activate = (state, operation) => activateNative(state.page, operation.native);
  async function prepare(state, context) {
    const workload = context.cell.workload;
    return prepareBrowserFixture(state.page, { ...context, signal: undefined,
      definition: definitions[workload], manifest: { workload, sha256: owned.fixtures[workload].sha256 }, services: serviceValues });
  }
  async function dispose(state) {
    const result = await state.page.evaluate(() => window.__genProfile.dispose());
    require(!state.blocked && !state.errors && state.archive.size === 0, 'Fixture disposal left errors, blocked requests or retained archives.');
    require(['connectedNodes', 'connectedElements', 'retainedSources', 'pendingOperations'].every(key => result[key] === 0), 'Fixture disposal left application state.');
    return result;
  }
  async function prime(state, task) {
    const prepared = await prepare(state, { cell: task.cell, ...task.position, priming: true });
    for (const operation of prepared.operations) {
      let armed = false;
      state.onArmed = async notice => {
        require(operation.trigger === 'event' && !armed && notice.id === operation.id && notice.generation === prepared.generation, 'Priming input bridge identity changed.');
        armed = true; await activate(state, operation);
      };
      try {
        const result = await state.page.evaluate(args => window.__genProfile.runOperation(args), { operation, generation: prepared.generation });
        validateOperation(result, operation, prepared.generation);
        require(operation.trigger !== 'event' || armed, 'Priming did not use native activation.');
      } finally { state.onArmed = undefined; }
    }
    await dispose(state);
  }
  async function counters(state) {
    if (!state.cdp) return null;
    const { metrics } = await state.cdp.send('Performance.getMetrics');
    return Object.fromEntries(metrics.map(metric => [metric.name, metric.value]));
  }
  async function initializeArtifacts(manifest, { functional = false, preflight = false } = {}) {
      require(!owned && !scratch, 'Driver verification may run only once.');
      if (preflight) validatePreflightAuthorization(manifest);
      else if (functional) validateSmokeAuthorization(manifest); else validateCollectionManifest(manifest);
      require(process.versions.node === '22.23.2', 'Use the pinned Node version.');
      owned = JSON.parse(JSON.stringify(manifest));
      const harness = await profileHarnessIdentity();
      if (!functional) hashesEqual(harness, owned.harness, 'Harness differs from the authorized manifest.');
      admissionSha256 = harness.admissionSha256;
      if (!functional) await checkQuiet();
      await requireFixtureModules();
      const candidate = { archiveSha256: await fileDigest(options.archive), lockfileSha256: await fileDigest(join(root, 'pnpm-lock.yaml')),
        buildSha256: await verifyBuiltFiles(options['build-manifest']) };
      hashesEqual(candidate, owned.candidate, 'Candidate artifacts differ from the authorized manifest.');
      if (functional) require(await profileSourceIdentity() === owned.sourceSha256, 'Functional smoke source differs from the authorization.');
      artifacts = await prepareProfileHost({ fixtureDirectory }); scratch = artifacts.scratchDirectory;
      playwright = await import('playwright');
      const { fixtureBuild } = artifacts;
      if (!functional) hashesEqual(fixtureBuild, owned.fixtureBuild, 'Fixture bundle, input graph, host or recording differs from the authorized manifest.');
      host = await artifacts.createProcessHost(); serviceValues = host.services;
      const environment = { colorScheme: 'light', fontBarrier: 'before-action-and-ready-commit', node: process.versions.node, os: process.platform, arch: process.arch, cpuModel: cpus()[0]?.model,
        logicalCpus: cpus().length, memoryBytes: totalmem(), playwright: JSON.parse(await readFile(createRequire(import.meta.url).resolve('playwright/package.json'), 'utf8')).version,
        esbuild: artifacts.esbuildVersion, browsers: {} };
      if (!functional) hashesEqual({ ...environment, browsers: undefined }, { ...owned.environment, browsers: undefined }, 'Actual runtime differs from the authorized manifest.');
      return { candidate, harness, fixtureBuild, environment };
  }
  return {
    kind: 'playwright-profile-v1',
    async verify(manifest) {
      const { candidate, harness, fixtureBuild, environment } = await initializeArtifacts(manifest);
      for (const name of PROFILE_ENGINES) {
        await checkQuiet(); const active = await ensureBrowser(name);
        environment.browsers[name] = { version: active.version(), executableSha256: await fileDigest(playwright[name].executablePath()) };
        hashesEqual(environment.browsers[name], owned.environment.browsers[name], 'Actual browser artifact differs from the authorized manifest.');
        const state = await createPage({ engine: name, width: 1280, height: 900 });
        try {
          const probe = await probeBrowserCapabilities(state.page); probes[name] = probe;
          for (const key of ['longtask', 'layoutShift']) {
            const capability = owned.controls[name][key]; require(capability.supported === probe[key].supported, 'Actual observer capability changed.');
            if (capability.supported) {
              const bytes = await readFile(join(options.controls, `${capability.receipt}.json`));
              require(digest(bytes) === capability.receipt, 'Positive-control receipt hash changed.');
              const receipt = JSON.parse(bytes); validateControlProbe(receipt.probe);
              require(receipt.engine === name && receipt.browserVersion === active.version() && receipt.measurementSha256 === harness.measurementSha256
                && receipt.probe[key].supported, 'Positive-control receipt describes another browser or instrument.');
            }
          }
          for (const workload of PROFILE_WORKLOADS) {
            const definition = await state.page.evaluate(id => window.__genProfile.describe(id), workload);
            require(definition?.workload === workload && definitionDigest(definition) === owned.fixtures[workload].sha256, 'Actual fixture definition changed.');
            hashesEqual(definition.operations, owned.fixtures[workload].operations, 'Actual fixture operation inventory changed.');
            for (const operation of definition.operations) if (operation.trigger === 'event') validateNativeAction(operation.native);
            definitions[workload] = definition;
          }
          require(!state.blocked && !state.errors, 'Verification requested an undeclared resource or raised an error.');
        } finally { await state.context.close(); }
      }
      hashesEqual(environment, owned.environment, 'Actual runtime or browser differs from the authorized manifest.');
      verificationMode = 'collection';
      return { kind: 'browser-artifact-verification', actual: { candidate, harness, environment, fixtures: owned.fixtures, controls: owned.controls, fixtureBuild }, positiveControlObservations: probes };
    },
    async preflight(authorization, { signal, retain } = {}) {
      require(typeof retain === 'function', 'Preflight artifact retention is required.');
      const checkAbort = () => { if (signal?.aborted) throw new Error('Preflight aborted.'); };
      checkAbort();
      const actual = await initializeArtifacts(authorization, { functional: true, preflight: true });
      verificationMode = 'preflight'; owned.fixtures = {};
      const controls = {}, fixtureDefinitions = {};
      for (const name of PROFILE_ENGINES) {
        checkAbort();
        require(await fileDigest(playwright[name].executablePath()) === owned.browsers[name].executableSha256, 'Preflight browser artifact changed.');
        const active = await ensureBrowser(name);
        actual.environment.browsers[name] = { version: active.version(), executableSha256: owned.browsers[name].executableSha256 };
        const state = await createPage({ engine: name, width: 1280, height: 900 }, { diagnostic: true });
        const stop = () => { void state.context.close().catch(() => {}); };
        signal?.addEventListener('abort', stop, { once: true });
        try {
          checkAbort();
          const retained = positiveControlReceipt({ engine: name, browserVersion: active.version(), measurementSha256: actual.harness.measurementSha256,
            probe: await probeBrowserCapabilities(state.page) });
          await retain({ kind: 'positive-control', sha256: retained.sha256, value: retained.receipt });
          controls[name] = retained.capabilities;
          for (const workload of PROFILE_WORKLOADS) {
            checkAbort();
            const definition = await state.page.evaluate(id => window.__genProfile.describe(id), workload);
            require(definition?.workload === workload, 'Preflight fixture identity changed.');
            for (const operation of definition.operations) if (operation.trigger === 'event') validateNativeAction(operation.native);
            if (name !== PROFILE_ENGINES[0]) { hashesEqual(definition, fixtureDefinitions[workload], 'Fixture definition differs across engines.'); continue; }
            fixtureDefinitions[workload] = definition; definitions[workload] = definition;
            owned.fixtures[workload] = { sha256: definitionDigest(definition), operations: definition.operations };
            const cell = { id: `${workload}/preflight`, workload, engine: name, temperature: 'cold', width: 1280, height: 900 };
            const prepared = await prepare(state, { cell, batchIndex: 0, sampleIndex: 0, warmup: false, functionalSmoke: true });
            owned.fixtures[workload] = preflightFixtureRecord(definition, prepared, cell);
            await dispose(state);
          }
          require(!state.blocked && !state.errors, 'Preflight requested an undeclared resource or raised an error.');
        } finally { signal?.removeEventListener('abort', stop); await state.context.close(); }
      }
      checkAbort();
      const report = { schemaVersion: 1, kind: 'profile-capability-preflight', status: 'captured-needs-review', qualification: 'not-assessed',
        sourceSha256: owned.sourceSha256, workloadOperationsExecuted: 0, timingSamples: 0, gcInvocations: 0,
        fixtureDefinitions, manifestDraft: preflightManifestDraft({ ...actual, fixtures: owned.fixtures, controls }) };
      await retain({ kind: 'preflight', value: report }); return report;
    },
    async smoke(authorization, { signal, retain } = {}) {
      require(typeof retain === 'function', 'Functional outcome retention is required.');
      const artifacts = await initializeArtifacts(authorization, { functional: true });
      require(await fileDigest(playwright[owned.browser.engine].executablePath()) === owned.browser.executableSha256, 'Functional smoke browser changed.');
      verificationMode = 'functional'; owned.fixtures = {};
      const report = { schemaVersion: 1, kind: 'functional-smoke', status: 'completed', qualification: 'not-assessed', timings: 'discarded',
        sourceSha256: owned.sourceSha256, artifacts, browser: { ...owned.browser }, viewport: owned.viewport ?? { width: 1280, height: 900 }, outcomes: [] };
      for (const workload of owned.workloads) {
        if (signal?.aborted) throw new Error('Functional smoke aborted.');
        const cell = { id: `${workload}/functional-smoke`, workload, engine: owned.browser.engine, temperature: 'cold', ...report.viewport };
        const outcome = { workload, status: 'completed', operations: [] };
        let state, disposed = false, operationId = 'prepare', activeOperation, preparedGeneration;
        const stop = () => { if (state) void state.context.close().catch(() => {}); };
        signal?.addEventListener('abort', stop, { once: true });
        try {
          state = await createPage(cell, { diagnostic: true });
          if (signal?.aborted) throw new Error('Functional smoke aborted.');
          report.browser.version = browser.version();
          const definition = await state.page.evaluate(id => window.__genProfile.describe(id), workload);
          require(definition?.workload === workload, 'Functional fixture identity changed.'); definitions[workload] = definition;
          owned.fixtures[workload] = { sha256: definitionDigest(definition), operations: definition.operations };
          outcome.fixture = owned.fixtures[workload];
          const prepared = await prepare(state, { cell, batchIndex: 0, sampleIndex: 0, warmup: false, functionalSmoke: true });
          validatePrepared(prepared, cell); preparedGeneration = prepared.generation;
          hashesEqual(prepared.operations, definition.operations, 'Functional operation inventory changed.');
          require(prepared.manifest.sha256 === owned.fixtures[workload].sha256, 'Prepared functional fixture identity changed.');
          if (prepared.inputs) outcome.inputs = prepared.inputs;
          for (const operation of prepared.operations) {
            operationId = operation.id; activeOperation = operation; let armed = false;
            state.onArmed = async notice => {
              require(operation.trigger === 'event' && !armed && notice.id === operation.id && notice.generation === prepared.generation, 'Functional native-input bridge identity changed.');
              armed = true; await activate(state, operation);
            };
            try {
              const record = await state.page.evaluate(args => window.__genProfile.runOperation(args), { operation, generation: prepared.generation });
              require(operation.trigger !== 'event' || armed, 'Functional event never armed native input.');
              const oracle = await state.page.evaluate(args => window.__genProfile.readOracle(args), { operation, generation: prepared.generation });
              outcome.operations.push(semanticSmokeOutcome(record, operation, prepared.generation, oracle));
            } finally { state.onArmed = undefined; }
          }
          operationId = 'dispose'; outcome.disposal = await dispose(state); disposed = true;
        } catch (error) {
          outcome.status = 'failed'; report.status = 'failed';
          const message = String(error.message ?? error).replaceAll(root, '<repository>').replaceAll(scratch ?? '<unused>', '<scratch>').replaceAll(host.origin, '<loopback>');
          outcome.failure = { operation: operationId, name: error.name ?? 'Error', message };
          if (state && !disposed) {
            try { outcome.failure.diagnostic = await state.page.evaluate(args => window.__genProfile.diagnose(args), { operation: activeOperation, generation: preparedGeneration }); }
            catch { outcome.failure.diagnostic = { unavailable: 'page-diagnostic-failed' }; }
          }
        } finally {
          signal?.removeEventListener('abort', stop);
          if (state) {
            try { if (!disposed) { outcome.disposal = await dispose(state); disposed = true; } }
            catch { outcome.cleanup = 'application-disposal-failed'; report.status = 'failed'; outcome.status = 'failed'; }
            finally { await state.context.close(); state.archive.clear(); }
          }
        }
        report.outcomes.push(outcome); await retain({ kind: 'functional-outcome', value: outcome });
      }
      await retain({ kind: 'functional-report', value: report }); return report;
    },
    checkQuiet,
    async openSample(task) {
      require(host && owned && verificationMode === 'collection', 'Driver is unverified.');
      if (task.signal?.aborted) throw new Error('Sample aborted.');
      let state;
      if (task.cell.temperature === 'warm' && !task.primeCold) {
        require(paired?.pairId === task.pairId && paired.disposed === true, 'Warm sample has no fully disposed paired cold context.'); state = paired; paired = undefined; state.hostRequestStart = host.receipts.length;
      } else { require(!paired, 'Previous paired context was not consumed.'); state = await createPage(task.cell); }
      state.pairId = task.pairId; state.disposed = false;
      const stop = () => { void state.context.close().catch(() => {}); };
      task.signal?.addEventListener('abort', stop, { once: true });
      if (task.signal?.aborted) { task.signal.removeEventListener('abort', stop); await state.context.close(); throw new Error('Sample aborted.'); }
      try { if (task.primeCold) { await prime(state, task); state.hostRequestStart = host.receipts.length; } }
      catch (error) { task.signal?.removeEventListener('abort', stop); await state.context.close(); throw error; }
      let before;
      return {
        temperatureEvidence: { freshContext: task.cell.temperature === 'cold' || task.primeCold, primedMounts: task.cell.temperature === 'warm' ? 1 : 0, fullyDisposedBeforeSample: true },
        prepare: context => prepare(state, context),
        async runOperation({ operation, generation, onArmed }) {
          state.onArmed = onArmed;
          try { return await runBrowserOperation(state.page, { operation, generation }); }
          finally { state.onArmed = undefined; }
        },
        readOracle: args => state.page.evaluate(value => window.__genProfile.readOracle(value), args),
        activate: operation => activate(state, operation),
        async startObservation() {
          before = await counters(state);
          const { supported, preparation } = await beginProfileObservation(state.page);
          state.preparationDelivery = preparation;
          for (const key of ['longtask', 'layoutShift']) require(supported[key] === owned.controls[task.cell.engine][key].supported, 'Sample observer capability differs from its positive control.');
        },
        phase: name => state.page.evaluate(value => window.__genProfile.phase(value), name),
        async finishObservation({ quietTailMs }) {
          require(quietTailMs === 1000, 'Quiet observation tail is frozen.');
          await state.page.waitForTimeout(quietTailMs);
          const observed = await state.page.evaluate(() => window.__genProfile.finishObservation());
          const after = await counters(state);
          const renderer = { supported: Boolean(state.cdp), ...(state.cdp ? {} : { reason: 'Renderer counters are available only through Chromium CDP.' }) };
          for (const [key, metric] of [['taskMs', 'TaskDuration'], ['scriptMs', 'ScriptDuration'], ['layoutMs', 'LayoutDuration'], ['styleMs', 'RecalcStyleDuration']]) {
            renderer[key] = state.cdp ? (after[metric] - before[metric]) * 1000 : null;
            require(!state.cdp || Number.isFinite(renderer[key]) && renderer[key] >= 0, 'Renderer counter is missing or reset.');
          }
          const resources = await state.page.evaluate(() => performance.getEntriesByType('resource').map(item => ({ path: new URL(item.name).pathname, encodedBytes: item.encodedBodySize, decodedBytes: item.decodedBodySize, durationMs: item.duration })));
          return { delivery: { initial: task.cell.temperature === 'cold' ? state.initialDelivery : null, preparation: state.preparationDelivery, resources }, hostRequests: host.receipts.slice(state.hostRequestStart), capabilities: owned.controls[task.cell.engine], window: observed.window, observers: { longTasks: observed.longTasks, layoutShifts: observed.layoutShifts }, renderer };
        },
        async dispose() { const result = await dispose(state); state.disposed = true; return result; },
        async close({ keepContext }) {
          task.signal?.removeEventListener('abort', stop);
          if (keepContext) { require(state.disposed && !paired, 'Only fully disposed cold context may be retained.'); paired = state; }
          else { await state.context.close(); state.archive.clear(); }
        },
      };
    },
    async close() {
      const cleanup = await Promise.allSettled([
        ...(paired ? [paired.context.close()] : []), ...(browser ? [browser.close()] : []), ...(artifacts ? [artifacts.close()] : []),
      ]);
      paired = undefined; browser = undefined; host = undefined; artifacts = undefined; scratch = undefined;
      const failure = cleanup.find(result => result.status === 'rejected'); if (failure) throw failure.reason;
    },
  };
}

export async function runProfileCli(args) {
  const options = parseDriverOptions(args);
  const manifest = JSON.parse(await readFile(options.manifest, 'utf8'));
  validateCollectionManifest(manifest);
  const harness = await profileHarnessIdentity(); hashesEqual(harness, manifest.harness, 'Harness differs from the authorized manifest.');
  quietEvidenceFromBytes(await readFile(options.quiet), manifest.collection.id, { quietObserver: manifest.quietObserver, admissionSha256: harness.admissionSha256 });
  await requireFixtureModules();
  await mkdir(options.output, { recursive: false });
  const controller = new AbortController(); const stop = () => controller.abort();
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  let sequence = 0;
  try {
    return await runProfile({ driver: createProfileDriver(options), manifest, signal: controller.signal,
      retain: record => writeProfileRecord(join(options.output, `${String(++sequence).padStart(5, '0')}-${record.kind}.json`), record) });
  } finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
}

/** Explicitly authorized one-shot capture. The output directory must not exist. */
export async function runProfilePreflight({ authorization, archive, buildManifest, output, signal }) {
  validatePreflightAuthorization(authorization);
  await mkdir(output, { recursive: false });
  const controls = join(output, 'controls'); await mkdir(controls);
  const driver = createProfileDriver({ archive, 'build-manifest': buildManifest });
  try {
    return await driver.preflight(authorization, { signal, retain: record => record.kind === 'positive-control'
      ? writeProfileRecord(join(controls, `${record.sha256}.json`), record.value)
      : writeProfileRecord(join(output, 'preflight.json'), record.value) });
  } finally { await driver.close(); }
}
