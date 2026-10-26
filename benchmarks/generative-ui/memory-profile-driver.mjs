import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { cpus, totalmem, release, tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { validateMemoryObservation } from './memory-profile-results.mjs';
import { validateNativeAction, profileBuildInventory, profileSourceIdentity, quietEvidenceFromBytes, definitionDigest } from './profile-driver.mjs';
import { memoryProfilePlan, validateMemoryManifest, runMemoryProfile } from './memory-profile.mjs';
import { writeProfileRecord } from './profile.mjs';
import { validateQuietObserver } from './profile-admission.mjs';

const require = (condition, message) => { if (!condition) throw new TypeError(message); };
const invoke = (owner, method, value) => owner.page.evaluate(({ method, value }) => window.__memoryProfile[method](value), { method, value });
const here = dirname(fileURLToPath(import.meta.url)), repository = resolve(here, '../..');
const fixtureDirectory = new URL('./memory-profile-fixture/', import.meta.url);
const hash = value => createHash('sha256').update(value).digest('hex');
const validHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/u.test(value);
const same = (left, right) => definitionDigest(left) === definitionDigest(right);
const hostModules = [
  { name: 'views', url: new URL('./profile-fixture/workloads/views-host.mjs', import.meta.url) },
  { name: 'dashboard', url: new URL('./memory-profile-fixture/dashboard-host.mjs', import.meta.url) },
];

export async function memoryProfileSourceIdentity() {
  const files = ['memory-profile.mjs', 'memory-profile-results.mjs', 'memory-profile-driver.mjs', 'memory-profile-smoke.mjs', 'profile-host.mjs'];
  for (const entry of await readdir(fixtureDirectory, { withFileTypes: true })) {
    require(entry.isFile() && !entry.isSymbolicLink(), 'Memory fixture inventory must contain only authored files.');
    if (!entry.name.includes('.test.')) files.push(`memory-profile-fixture/${entry.name}`);
  }
  const inputs = Object.fromEntries(await Promise.all(files.map(async file => [file, hash(await readFile(join(here, file)))])));
  return definitionDigest({ profileDependencies: await profileSourceIdentity(), inputs });
}
export function validateMemorySmokeManifest(value) {
  require(value?.schemaVersion === 1 && value.kind === 'memory-functional-smoke' && value.authorized === true
    && validHash(value.sourceSha256) && validHash(value.compositionSha256), 'Explicit memory correctness-only authorization is required.');
  require(['archiveSha256', 'lockfileSha256', 'buildSha256'].every(key => validHash(value.candidate?.[key]))
    && value.browser?.engine === 'chromium' && validHash(value.browser.executableSha256), 'Exact memory smoke candidate/browser identities are required.');
  require(Array.isArray(value.lifecycles) && value.lifecycles.length > 0 && new Set(value.lifecycles).size === value.lifecycles.length
    && value.lifecycles.every(item => ['full-chat', 'full-dashboard'].includes(item)), 'Explicit unique memory lifecycle inventory is required.');
  require(Array.isArray(value.admissions) && value.admissions.length > 0 && new Set(value.admissions).size === value.admissions.length
    && value.admissions.every(item => ['direct', 'adapters'].includes(item)) && typeof value.includeX === 'boolean', 'Explicit unique admission inventory and X choice are required.');
  require(value.configuration === undefined && value.collectionId === undefined && value.samples === undefined && value.quietObserver === undefined, 'Correctness smoke cannot authorize a memory campaign.');
}
export function parseMemoryOptions(args, { functional = false } = {}) {
  const names = ['manifest', 'archive', 'build-manifest', 'output', ...(functional ? [] : ['quiet'])], options = {};
  for (const arg of args) {
    const match = /^--([a-z-]+)=(.+)$/u.exec(arg);
    require(match && names.includes(match[1]) && !Object.hasOwn(options, match[1]), 'Unknown, duplicate or empty memory driver option.'); options[match[1]] = match[2];
  }
  require(names.every(name => options[name]), 'Missing explicit memory driver input.'); return options;
}
async function candidateIdentity(options) {
  const bytes = await readFile(options['build-manifest']);
  require(same(JSON.parse(bytes), await profileBuildInventory()), 'Memory built files differ from the frozen inventory.');
  return { archiveSha256: hash(await readFile(options.archive)), lockfileSha256: hash(await readFile(join(repository, 'pnpm-lock.yaml'))), buildSha256: hash(bytes) };
}
async function runtimeIdentity(esbuildVersion) {
  return { node: process.versions.node, os: process.platform, kernel: release(), arch: process.arch, cpuModel: cpus()[0]?.model,
    logicalCpus: cpus().length, memoryBytes: totalmem(), esbuild: esbuildVersion,
    playwright: JSON.parse(await readFile(createRequire(import.meta.url).resolve('playwright/package.json'), 'utf8')).version,
    viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce', locale: 'en-US', timezoneId: 'UTC' };
}

/** Preflight bundles authored fixtures without launching a browser or authorizing collection. */
export async function memoryAuthorizationDraft(options, { functional = false } = {}) {
  validateQuietObserver(options.quietObserver);
  require(!functional || options.quietObserver === undefined, 'Correctness smoke has no quiet observer admission.');
  const quietObserver = options.quietObserver === undefined ? undefined : structuredClone(options.quietObserver);
  const { prepareProfileHost } = await import('./profile-host.mjs'), { chromium } = await import('playwright');
  const prepared = await prepareProfileHost({ fixtureDirectory, hostModules });
  try {
    return { schemaVersion: 1, kind: functional ? 'memory-functional-smoke' : 'memory-profile', authorized: false,
      sourceSha256: await memoryProfileSourceIdentity(), compositionSha256: options.compositionSha256,
      candidate: await candidateIdentity(options), browser: { engine: 'chromium', executableSha256: hash(await readFile(chromium.executablePath())) },
      fixtureBuild: prepared.fixtureBuild, environment: await runtimeIdentity(prepared.esbuildVersion),
      ...(functional ? { lifecycles: ['full-chat', 'full-dashboard'], admissions: ['direct', 'adapters'], includeX: true }
        : { collectionId: options.collectionId, designSha256: options.designSha256, configuration: memoryProfilePlan(), ...(quietObserver ? { quietObserver } : {}) }) };
  } finally { await prepared.close(); }
}

export function createMemoryDriver(options, { functional = false } = {}) {
  let owned, prepared, chromium, helpers, admissionSha256;
  const processes = new Set();
  return {
    async verify(manifest) {
      require(!owned && !prepared, 'Memory driver can verify once.');
      if (functional) validateMemorySmokeManifest(manifest); else validateMemoryManifest(manifest);
      require(process.versions.node === '22.23.2', 'Use the pinned Node version.');
      require(same(await candidateIdentity(options), manifest.candidate) && await memoryProfileSourceIdentity() === manifest.sourceSha256, 'Memory source or candidate differs from authorization.');
      owned = structuredClone(manifest);
      if (owned.quietObserver) admissionSha256 = hash(await readFile(join(here, 'profile-admission.mjs')));
      helpers = await import('./profile-host.mjs'); ({ chromium } = await import('playwright'));
      require(hash(await readFile(chromium.executablePath())) === owned.browser.executableSha256, 'Memory browser executable changed.');
      prepared = await helpers.prepareProfileHost({ fixtureDirectory, hostModules });
      const environment = await runtimeIdentity(prepared.esbuildVersion);
      require(same(prepared.fixtureBuild, owned.fixtureBuild) && same(environment, owned.environment), 'Memory fixture build or environment differs from authorization.');
      return { candidate: owned.candidate, sourceSha256: owned.sourceSha256, fixtureBuild: prepared.fixtureBuild, environment,
        ...(owned.quietObserver ? { quietObserver: owned.quietObserver, admissionSha256 } : {}) };
    },
    async checkQuiet() {
      require(owned && !functional, 'Quiet evidence belongs to an authorized memory campaign.');
      return quietEvidenceFromBytes(await readFile(options.quiet), owned.collectionId, { quietObserver: owned.quietObserver, admissionSha256 });
    },
    async openProcess(identity) {
      require(prepared && owned && !identity.signal?.aborted, 'Memory process needs verified artifacts and active ownership.');
      const host = await prepared.createProcessHost();
      let browser, state, archive, archiveDirectory, closed = false, closing;
      const close = () => {
        if (closing) return closing;
        closed = true;
        closing = (async () => {
          try { await state?.context.close(); } finally { try { await browser?.close(); } finally {
            try { await host.close(); } finally { if (archiveDirectory) await rm(archiveDirectory, { recursive: true, force: true }); archive = undefined; }
          } }
        })();
        return closing;
      };
      try {
        archiveDirectory = await mkdtemp(join(tmpdir(), 'lyra-memory-archive-'));
        const archiveFile = join(archiveDirectory, 'presentation.json');
        const binding = async (source, request) => {
          require(!closed && source.frame === source.page.mainFrame(), 'Archive requests must come from the owned main page.');
          if (request?.action === 'save') {
            require(!archive && typeof request.text === 'string', 'Memory archive has exactly one slot.');
            const bytes = Buffer.byteLength(request.text); require(bytes > 0 && bytes <= 524288, 'Memory archive exceeds512KiB.');
            await writeFile(archiveFile, request.text); archive = { bytes, sha256: hash(request.text) }; return archive;
          }
          require(archive && ['load', 'release'].includes(request?.action), 'Memory archive is absent or request is invalid.');
          if (request.action === 'release') { await rm(archiveFile); archive = undefined; return null; }
          const text = await readFile(archiveFile, 'utf8'); require(Buffer.byteLength(text) === archive.bytes && hash(text) === archive.sha256, 'Memory archive bytes changed.'); return text;
        };
        browser = await chromium.launch({ headless: true });
        state = await helpers.createOwnedPage({ browser, host, viewport: { width: 1280, height: 900 }, globalName: '__memoryProfile',
          bindings: { __memoryArchive: binding }, cdp: !functional });
        const owner = { ...state, services: host.services, activate: descriptor => helpers.activateNative(state.page, descriptor),
          hostCounts: () => host.serviceInstances.dashboard.counts() };
        const check = () => require(!state.blocked && !state.errors, 'Memory page requested an undeclared resource or raised an error.');
        const bounded = async work => {
          let timer, stop;
          const stopped = new Promise((_, reject) => {
            stop = () => { void close().then(() => reject(new Error('Memory process aborted or exceeded its bounded operation deadline.')), reject); };
            timer = setTimeout(stop, 120000); identity.signal?.addEventListener('abort', stop, { once: true });
            if (identity.signal?.aborted) stop();
          });
          try { const result = await Promise.race([Promise.resolve().then(work), stopped]); check(); return result; }
          catch (error) { if (owner.currentAttempt) error.attempt = owner.currentAttempt; throw error; }
          finally { clearTimeout(timer); identity.signal?.removeEventListener('abort', stop); }
        };
        const process = {
          browserVersion: browser.version(),
          baseline: () => { require(!functional, 'Correctness smoke cannot request GC baselines.'); return bounded(() => observeMemoryProcess(owner, 'baseline')); },
          cycle: task => bounded(() => runMemoryCycle(owner, task, { collect: !functional })),
          largeX: () => bounded(() => runMemoryX(owner, { collect: !functional, fixtureSha256: owned.sourceSha256 })),
          async close() { try { await close(); } finally { processes.delete(process); } },
        };
        processes.add(process); return process;
      } catch (error) { await close(); throw error; }
    },
    async close() {
      try { const results = await Promise.allSettled([...processes].map(process => process.close())); const failed = results.find(result => result.status === 'rejected'); if (failed) throw failed.reason; }
      finally { await prepared?.close(); }
    },
  };
}

export async function withMemoryProfileSignals(work, signalSource = process) {
  const controller = new AbortController(), stop = () => controller.abort();
  signalSource.once('SIGINT', stop); signalSource.once('SIGTERM', stop);
  try { return await work(controller.signal); }
  finally { signalSource.removeListener('SIGINT', stop); signalSource.removeListener('SIGTERM', stop); }
}

export async function runMemoryProfileCli(args) {
  const options = parseMemoryOptions(args), manifest = JSON.parse(await readFile(options.manifest, 'utf8'));
  validateMemoryManifest(manifest); await mkdir(options.output, { recursive: true });
  let serial = 0;
  return withMemoryProfileSignals(signal => runMemoryProfile(manifest, createMemoryDriver(options), { signal,
    retain: record => writeProfileRecord(join(options.output, `${String(serial++).padStart(4, '0')}-${record.kind}.json`), record) }));
}

/** Scalar return values only; no JSHandle or element handle survives an observation. */
export async function observeMemoryProcess(owner, phase) {
  await invoke(owner, 'settle');
  const metrics = await invoke(owner, 'metrics');
  require(metrics && Object.values(metrics).every(value => Number.isFinite(value) && value >= 0), 'Memory fixture metrics must be nonnegative scalars.');
  await owner.cdp.send('Runtime.releaseObjectGroup', { objectGroup: 'memory-profile' });
  await owner.cdp.send('HeapProfiler.collectGarbage');
  await owner.page.evaluate(() => new Promise(resolve => setTimeout(resolve, 0)));
  await owner.cdp.send('HeapProfiler.collectGarbage');
  const heap = await owner.cdp.send('Runtime.getHeapUsage');
  const rendererDom = await owner.cdp.send('Memory.getDOMCounters');
  return { phase, ...metrics, gcPasses: 2, taskBetweenGcPasses: true,
    heap: { usedSize: heap.usedSize, totalSize: heap.totalSize, embedderHeapUsedSize: heap.embedderHeapUsedSize ?? null,
      backingStorageSize: heap.backingStorageSize ?? null }, rendererDom };
}

/** X reuses the full view fixture through a semantic-only mount executor. */
export async function runMemoryX(owner, { collect = true, fixtureSha256 } = {}) {
  const attempt = { kind: 'large-X', semanticAssertionsPassed: false, lastCommand: 'mountX' }; owner.currentAttempt = attempt;
  try {
    const semantic = await invoke(owner, 'mountX', { services: owner.services, fixtureSha256 });
    require(semantic?.semanticAssertionsPassed === true && typeof semantic.fingerprint === 'string' && semantic.fingerprint.length > 0, 'X mount semantics did not pass.');
    attempt.fingerprint = semantic.fingerprint; attempt.lastCommand = 'observeX';
    if (collect) attempt.observation = await observeMemoryProcess(owner, 'mounted');
    else { await invoke(owner, 'settle'); attempt.observation = { phase: 'mounted', ...await invoke(owner, 'metrics') }; }
    attempt.lastCommand = 'readXOracle';
    const after = await invoke(owner, 'readXOracle');
    require(after.semanticAssertionsPassed === true && after.fingerprint === semantic.fingerprint, 'X changed during observation.');
    attempt.lastCommand = 'disposeX'; attempt.disposal = await invoke(owner, 'disposeX'); await invoke(owner, 'close');
    require(['connectedFixtureNodes', 'connectedFixtureElements', 'sourceCharacters', 'controllerParts', 'controllerIslands', 'pendingOperations', 'externalArchiveBytes'].every(key => attempt.disposal[key] === 0), 'X retained application state.');
    attempt.semanticAssertionsPassed = true; delete attempt.lastCommand; delete owner.currentAttempt; return attempt;
  } catch (error) { throw Object.assign(error, { attempt }); }
}

export async function runMemoryCycle(owner, task, { collect = true } = {}) {
  const row = { method: collect ? 'two-gc-memory-profile' : 'memory-semantic-smoke', ...Object.fromEntries(['lifecycle', 'runIndex', 'cycle', 'regime', 'admission'].map(key => [key, task[key]])), observations: [] };
  owner.currentAttempt = row;
  const call = async (method, value) => { row.lastCommand = method; return invoke(owner, method, value); };
  const nativeStage = async stage => {
    const actions = await call('nativeActions', stage);
    require(Array.isArray(actions) && actions.length <= 10 && new Set(actions.map(item => item.id)).size === actions.length, 'Memory native stage is invalid.');
    for (const action of actions) {
      require(typeof action.id === 'string' && action.id.length > 0, 'Memory native action has no identity.'); validateNativeAction(action.native);
      await call('armNative', action.id); await owner.activate(action.native); await call('completeNative', action.id);
    }
  };
  const observe = async phase => {
    const before = await call('readOracle', phase);
    require(before.semanticAssertionsPassed === true && typeof before.fingerprint === 'string' && before.fingerprint.length > 0, 'Memory semantic oracle did not pass.');
    row.lastCommand = `observe:${phase}`;
    let observation;
    if (collect) observation = await observeMemoryProcess(owner, phase);
    else { await invoke(owner, 'settle'); observation = { phase, ...await invoke(owner, 'metrics') }; }
    row.observations.push({ ...observation, fingerprint: before.fingerprint });
    if (collect) validateMemoryObservation(observation);
    else {
      require(observation.pendingOperations === 0 && observation.actions === (phase === 'restored-disposed' ? 2 : 1), 'Semantic smoke has pending work or replayed actions.');
      if (phase.includes('disposed')) require(['connectedFixtureNodes', 'connectedFixtureElements', 'sourceCharacters', 'controllerParts', 'controllerIslands', 'protocolOwners', 'protocolSurfaces'].every(key => observation[key] === 0), 'Semantic smoke retained disposed application state.');
      else require(observation.connectedFixtureElements > 0 && observation.protocolSurfaces === 3 && observation.protocolOwners === (task.admission === 'adapters' ? 2 : 0), 'Semantic smoke matched shape/ownership failed.');
      require(observation.externalArchiveBytes === (['released', 'disposed', 'restored'].includes(phase) ? row.savedBytes : 0), 'Semantic archive lifetime changed.');
      if (phase === 'released') require(observation.sourceCharacters === 0, 'Semantic source release failed.');
    }
    const after = await call('readOracle', phase);
    require(after.semanticAssertionsPassed === true && after.fingerprint === before.fingerprint, 'Memory semantics changed during collection.');
  };
  try {
    row.hostBefore = await owner.hostCounts();
    await call('prepare', { lifecycle: task.lifecycle, cycle: task.cycle, admission: task.admission, services: owner.services });
    await call('mount'); await nativeStage('initial'); await call('completeMount'); await nativeStage('presentation');
    await observe('mounted');
    const archive = await call('save'); row.savedBytes = archive.bytes; row.archiveSha256 = archive.sha256;
    await call('releaseSources'); await observe('released');
    await call('disposePresentation'); await observe('disposed');
    await call('restore'); await call('applyHigherRevision'); await observe('restored');
    await nativeStage('second'); await call('disposePresentation'); await call('releaseArchive'); await observe('restored-disposed');
    await call('close'); row.hostAfter = await owner.hostCounts(); row.semanticAssertionsPassed = true; delete row.lastCommand;
    delete owner.currentAttempt; return row;
  } catch (error) { row.semanticAssertionsPassed = false; throw Object.assign(error, { attempt: row }); }
}
