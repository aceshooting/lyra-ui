import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, realpath, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, createLogger, createServer, preview } from 'vite';
import * as playwright from 'playwright';
import {
  assertBundleRoots, assertCompositionOwnership, assertConsoleContract, assertDevelopmentGraph, assertInstalledTopology, assertRuntimeIdentity,
  captureFailureDevelopmentGraph, runtimeDiagnosticCarriers,
  optimizerFacadeImports, optimizerSourceFiles, PUBLIC_PROBES, UI_PACKAGE, withRuntimePhase,
} from './contract.mjs';

const fixture = dirname(fileURLToPath(import.meta.url));
const [selection = 'all', browserNames = 'chromium'] = process.argv.slice(2);
assert.ok(['all', 'raw', 'canonical'].includes(selection));
const engines = browserNames.split(',');
assert.ok(engines.length > 0 && engines.every(name => ['chromium', 'firefox', 'webkit'].includes(name)));
const input = JSON.parse(await readFile(join(fixture, 'input.json'), 'utf8'));
const archive = join(fixture, input.archive);
const archiveBytes = await readFile(archive);
assert.equal(createHash('sha256').update(archiveBytes).digest('hex'), input.sha256);
assert.equal(`sha512-${createHash('sha512').update(archiveBytes).digest('base64')}`, input.integrity);
const report = { input, topology: [], cases: [], configurations: [] };
const reportPath = join(fixture, 'report.json');
const save = () => writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

async function packageOwner(entry, name) {
  let directory = dirname(entry);
  for (;;) {
    try {
      const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
      if (manifest.name === name) return { directory, manifest };
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
    }
    const parent = dirname(directory);
    assert.notEqual(parent, directory, `Cannot find package metadata for ${name}`);
    directory = parent;
  }
}

const verifiedRuntimeSources = [];
for (const owner of ['app', 'feature-a', 'feature-b']) {
  const require = createRequire(join(fixture, owner, 'package.json'));
  const packageFile = await realpath(require.resolve(`${UI_PACKAGE}/package.json`));
  const packageRoot = dirname(packageFile);
  const manifest = JSON.parse(await readFile(packageFile, 'utf8'));
  const utilityEntry = await realpath(require.resolve(`${UI_PACKAGE}/utilities/overlay-manager.js`));
  const packedPath = relative(packageRoot, utilityEntry);
  assert.ok(!packedPath.startsWith('..') && !isAbsolute(packedPath), 'The public export must belong to its installed package');
  const packedUtility = execFileSync('tar', ['-xzOf', archive, `package/${packedPath.split(sep).join('/')}`], { maxBuffer: 16 * 1024 * 1024 });
  const runtimeFile = await realpath(join(packageRoot, 'dist/internal/runtime-diagnostics.js'));
  const runtimeContent = await readFile(runtimeFile, 'utf8');
  const packedRuntime = execFileSync('tar', ['-xzOf', archive, 'package/dist/internal/runtime-diagnostics.js'], { maxBuffer: 16 * 1024 * 1024 });
  assert.equal(hash(runtimeContent), hash(packedRuntime), 'Installed runtime diagnostic must match the archive');
  if (!verifiedRuntimeSources.some(source => source.file === runtimeFile)) {
    verifiedRuntimeSources.push({ file: runtimeFile, packageRoot, content: runtimeContent,
      sha256: hash(runtimeContent), packedSha256: hash(packedRuntime) });
  }
  const uiRequire = createRequire(packageFile);
  const peer = await packageOwner(await realpath(uiRequire.resolve('katex')), 'katex');
  report.topology.push({
    owner, name: manifest.name, version: manifest.version, packageRoot, utilityEntry,
    peerVersion: peer.manifest.version, integrity: input.integrity,
    utilityHash: hash(await readFile(utilityEntry)), packedUtilityHash: hash(packedUtility),
  });
}
assertInstalledTopology(report.topology, input.version, input.integrity,
  await readFile(join(fixture, 'pnpm-lock.yaml'), 'utf8'));
assert.equal(report.topology.find(row => row.owner === 'feature-a').peerVersion, input.peers.current);
assert.equal(report.topology.find(row => row.owner === 'feature-b').peerVersion, input.peers.floor);
const roots = [...new Set(report.topology.map(row => row.packageRoot))];
const applicationRequire = createRequire(join(fixture, 'app', 'package.json'));
const appRoot = report.topology[0].packageRoot;
for (const specifier of PUBLIC_PROBES) {
  const resolved = await realpath(applicationRequire.resolve(specifier));
  assert.ok(resolved === appRoot || resolved.startsWith(`${appRoot}${sep}`), `Application public resolver: ${specifier}`);
}
assert.equal(JSON.parse(await readFile(join(fixture, 'package.json'), 'utf8')).dependencies?.[UI_PACKAGE], undefined);
assert.equal(JSON.parse(await readFile(join(fixture, 'shared/package.json'), 'utf8')).dependencies?.[UI_PACKAGE], undefined);
await save();

const variants = selection === 'raw' ? ['raw'] : selection === 'canonical' ? ['app', 'shared'] : ['raw', 'app', 'shared'];
const failures = [];

const sourceOwnerCache = new Map();
async function uiRootForSource(source) {
  if (!isAbsolute(source)) return undefined;
  let directory = dirname(source);
  const visited = [];
  for (;;) {
    if (sourceOwnerCache.has(directory)) {
      const owner = sourceOwnerCache.get(directory);
      for (const entry of visited) sourceOwnerCache.set(entry, owner);
      return owner;
    }
    visited.push(directory);
    try {
      const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
      const owner = manifest.name === UI_PACKAGE ? await realpath(directory) : undefined;
      for (const entry of visited) sourceOwnerCache.set(entry, owner);
      return owner;
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
    }
    const parent = dirname(directory);
    if (parent === directory) {
      for (const entry of visited) sourceOwnerCache.set(entry, undefined);
      return undefined;
    }
    directory = parent;
  }
}

async function inspectDevelopmentGraph(server, servedScripts) {
  const environment = server.environments.client;
  const optimizer = environment.depsOptimizer;
  const modules = [];
  for (const address of [...servedScripts].sort()) {
    const url = new URL(address);
    // These two framework helpers cannot contain an application package runtime.
    if (url.pathname === '/@vite/client' || url.pathname === '/@vite/env') continue;
    const module = await environment.moduleGraph.getModuleByUrl(`${url.pathname}${url.search}`);
    assert.ok(module?.file, `Served script is missing from the development module graph: ${url.pathname}`);
    const file = await realpath(module.file);
    const optimized = optimizer?.isOptimizedDepFile(file) ?? false;
    let sources = [file], optimizerId, facadeChildren, optimizerSource;
    let generatedCode, generatedMap, mapFile;
    if (optimized) {
      let info = optimizer.metadata.depInfoList.find(entry => resolve(entry.file) === file);
      assert.ok(info, 'A served optimizer file must match its actual dependency/chunk metadata');
      await info.processing;
      info = optimizer.metadata.depInfoList.find(entry => resolve(entry.file) === file);
      assert.ok(info, 'A served optimizer dependency must remain present after processing');
      const servedHash = url.searchParams.get('v');
      if (servedHash) assert.equal(servedHash, info.browserHash ?? optimizer.metadata.browserHash,
        'Do not attribute an earlier served optimizer generation to a later source graph');
      optimizerId = info.id;
      mapFile = `${file}.map`;
      optimizerSource = info.src;
      try {
        generatedMap = JSON.parse(await readFile(mapFile, 'utf8'));
        sources = optimizerSourceFiles(generatedMap, mapFile);
        generatedCode = await readFile(file, 'utf8');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        const imports = optimizerFacadeImports(await readFile(file, 'utf8'));
        facadeChildren = await Promise.all(imports.map(specifier => realpath(resolve(dirname(file), specifier))));
        sources = []; // Actual served children, not a guessed map or metadata alone, prove this facade's graph.
      }
    }
    const uiRoots = [...new Set((await Promise.all(sources.map(uiRootForSource))).filter(Boolean))];
    const runtimeCarriers = runtimeDiagnosticCarriers({ url: address, file,
      code: generatedCode ?? await readFile(file, 'utf8'), map: generatedMap, mapFile,
      verifiedSources: verifiedRuntimeSources });
    modules.push({ url: address, file, optimized, optimizerId, optimizerSource, facadeChildren,
      sources: [...new Set(sources)], uiRoots, runtimeCarriers });
  }
  // Validate all source/facade edges even when retaining evidence for an already failed case.
  assertDevelopmentGraph(modules, { mode: 'observed', expectedRoots: [...new Set(modules.flatMap(module => module.uiRoots))] });
  return modules;
}

function configuration(mode, environment, phaseMode) {
  const observedRoots = new Set(), buildWarnings = [];
  const logger = createLogger('silent');
  logger.warn = logger.warnOnce = message => buildWarnings.push(message);
  const applicationResolver = () => ({
    name: 'fixture-application-ui-resolution',
    resolveId(source) {
      return /^@aceshooting\/lyra-ui(?:\/.*)?$/u.test(source) ? applicationRequire.resolve(source) : null;
    },
  });
  // Vite documents explicit include for linked workspace dependencies. The same entries
  // and discovery policy apply to raw and canonical profiles; only UI ownership differs.
  const optimizeDeps = {
    ...(environment === 'linked-development' ? { include: ['feature-a', 'feature-b'], noDiscovery: true } : {}),
    ...(mode === 'shared' ? { rolldownOptions: { plugins: [applicationResolver()] } } : {}),
  };
  const config = {
    configFile: false, mode: phaseMode, root: join(fixture, mode === 'shared' ? 'shared' : 'app'),
    cacheDir: join(fixture, `.vite-${mode}-${environment}`), customLogger: logger,
    resolve: { dedupe: mode === 'raw' ? [] : [UI_PACKAGE] },
    optimizeDeps,
    // Playwright captures and validates browser diagnostics per page. Keep Vite's logger
    // dedicated to server diagnostics even in environments that forward the browser console.
    server: { host: '127.0.0.1', port: 0, fs: { allow: [fixture] }, forwardConsole: false },
    preview: { host: '127.0.0.1', port: 0 },
    build: { outDir: join(fixture, `output-${mode}`), emptyOutDir: true, target: 'es2022' },
    plugins: [...(mode === 'shared' ? [{ ...applicationResolver(), enforce: 'pre' }] : []), {
      name: 'fixture-package-provenance',
      transform(_code, id) {
        for (const root of roots) if (id.startsWith(`${root}${sep}`)) observedRoots.add(root);
      },
      generateBundle() {
        for (const id of this.getModuleIds()) {
          for (const root of roots) if (id.startsWith(`${root}${sep}`)) observedRoots.add(root);
        }
      },
    }],
  };
  // One real build per mode supplies both provenance and the production preview.
  return { config, observedRoots, buildWarnings };
}

async function closeServer(server) {
  if (typeof server.close === 'function') await server.close();
  else await new Promise((accept, reject) => server.httpServer.close(error => error ? reject(error) : accept()));
}

async function runCase(browser, base, metadata, name, action, owner = 'a', auditDevelopment) {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const messages = [], errors = [], responses = [];
  const servedScripts = new Set();
  page.on('console', message => messages.push({ type: message.type(), text: message.text() }));
  page.on('pageerror', error => errors.push(String(error)));
  page.on('response', response => {
    if (response.status() >= 400) responses.push({ url: response.url(), status: response.status() });
    if (response.status() >= 200 && response.status() < 400 && response.request().resourceType() === 'script' &&
      new URL(response.url()).origin === new URL(base).origin) servedScripts.add(response.url());
  });
  const row = { ...metadata, name, owner, status: 'running', phase: 'navigation' };
  report.cases.push(row);
  try {
    const url = new URL(base);
    url.searchParams.set('owner', owner);
    await page.goto(url.href);
    await page.waitForFunction(() => Boolean(window.runtimeFixture));
    row.phase = 'runtime-identity';
    row.sameUtility = await page.evaluate(() => window.runtimeFixture.sameUtility);
    row.runtimeTopology = assertRuntimeIdentity(row.sameUtility, metadata.mode, metadata.environment);
    assertCompositionOwnership(await page.evaluate(() => window.runtimeFixture.ownership), owner);
    if (auditDevelopment) {
      row.phase = 'development-graph-before-behavior';
      row.developmentGraph = await auditDevelopment(servedScripts);
      row.runtimeTopology = assertRuntimeIdentity(row.sameUtility, metadata.mode, metadata.environment, {
        carriers: row.developmentGraph.flatMap(module => module.runtimeCarriers), applicationRoot: appRoot,
        actualRoots: row.developmentGraph.flatMap(module => module.uiRoots),
      });
    }
    row.phase = 'passive-diagnostics';
    assertConsoleContract(messages, { mode: metadata.mode, development: metadata.environment !== 'production', active: false, topology: row.runtimeTopology });
    row.phase = 'behavior';
    await action(page, row);
    row.phase = 'strict-errors';
    assert.deepEqual(errors, [], 'Uncaught browser exceptions');
    assert.deepEqual(responses, [], 'Failed browser requests');
    if (auditDevelopment) {
      row.phase = 'development-graph';
      row.developmentGraph = await auditDevelopment(servedScripts);
      assert.equal(assertRuntimeIdentity(row.sameUtility, metadata.mode, metadata.environment, {
        carriers: row.developmentGraph.flatMap(module => module.runtimeCarriers), applicationRoot: appRoot,
        actualRoots: row.developmentGraph.flatMap(module => module.uiRoots),
      }), row.runtimeTopology, 'Active use must preserve the independently observed runtime ownership');
    }
    row.phase = 'active-diagnostics';
    assertConsoleContract(messages, { mode: metadata.mode, development: metadata.environment !== 'production', topology: row.runtimeTopology });
    row.status = 'passed';
    row.phase = 'complete';
  } catch (error) {
    row.status = 'failed';
    row.error = error.stack ?? String(error);
    failures.push(`${metadata.mode}/${metadata.environment}/${metadata.browser}/${name}/${owner}: ${error.message}`);
  } finally {
    if (row.status === 'failed' && auditDevelopment) {
      await captureFailureDevelopmentGraph(row, () => auditDevelopment(servedScripts, true));
    }
    row.console = messages;
    row.pageErrors = errors;
    row.failedRequests = responses;
    await context.close();
    await save();
  }
}

async function openPair(page) {
  await page.locator('#open-lower').click();
  await page.locator('#open-upper').click();
  await page.waitForFunction(() => document.querySelector('#upper')?.open === true);
  await page.evaluate(() => document.querySelector('#upper').updateComplete);
}

async function escapeCase(page, row, veto) {
  await openPair(page);
  await page.locator('#upper-action').click();
  if (veto) {
    await page.evaluate(() => window.runtimeFixture.preventNextEscape());
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => window.runtimeFixture.snapshot().counts), { lower: 0, upper: 0 });
    assert.equal(await page.evaluate(() => window.runtimeFixture.snapshot().upperOpen), true);
    await page.evaluate(() => window.runtimeFixture.vetoNextHide());
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.querySelector('#upper').updateComplete);
    assert.deepEqual(await page.evaluate(() => window.runtimeFixture.snapshot().counts), { lower: 0, upper: 0 });
    assert.equal(await page.evaluate(() => window.runtimeFixture.snapshot().upperOpen), true);
  }
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.runtimeFixture.snapshot().counts.upper === 1);
  row.firstEscape = await page.evaluate(() => window.runtimeFixture.snapshot());
  assert.deepEqual(row.firstEscape.counts, { lower: 0, upper: 1 });
  assert.equal(row.firstEscape.lowerOpen, true);
  assert.equal(row.firstEscape.upperOpen, false);
  assert.equal(row.firstEscape.focused, 'open-upper');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.runtimeFixture.snapshot().counts.lower === 1);
  assert.equal(await page.evaluate(() => window.runtimeFixture.snapshot().focused), 'open-lower');
  await openPair(page);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.runtimeFixture.snapshot().counts.upper === 2);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.runtimeFixture.snapshot().counts.lower === 2);
  await page.evaluate(() => window.runtimeFixture.exerciseBothOwners());
}

async function modalCase(page) {
  await page.evaluate(() => {
    document.documentElement.style.setProperty('overflow', 'scroll', 'important');
    window.runtimeFixture.openModal('a', 'modal-a');
    window.runtimeFixture.openModal('b', 'modal-b');
  });
  await page.waitForFunction(() => window.runtimeFixture.modalState().backgroundInert && window.runtimeFixture.modalState().overflow === 'hidden');
  assert.equal(await page.evaluate(() => window.runtimeFixture.modalState().authoredInert), true);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => window.runtimeFixture.modalState().focused), 'modal-b-last');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => window.runtimeFixture.modalState().focused), 'modal-b-first');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.runtimeFixture.modalState().active.join() === 'modal-a');
  assert.equal(await page.evaluate(() => window.runtimeFixture.modalState().backgroundInert), true);
  assert.equal(await page.evaluate(() => window.runtimeFixture.modalState().overflow), 'hidden');
  assert.equal(await page.evaluate(() => window.runtimeFixture.modalState().focused), 'modal-a-first');
  await page.evaluate(() => {
    document.querySelector('#authored-inert').inert = false;
    document.documentElement.style.setProperty('overflow', 'auto', 'important');
  });
  await page.waitForFunction(() => window.runtimeFixture.modalState().overflow === 'hidden');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.runtimeFixture.modalState().active.length === 0);
  const final = await page.evaluate(() => window.runtimeFixture.modalState());
  assert.equal(final.backgroundInert, false);
  assert.equal(final.authoredInert, false);
  assert.equal(final.overflow, 'auto');
  assert.equal(final.priority, 'important');
  assert.deepEqual(final.closes, { 'modal-a': 1, 'modal-b': 1 });
}

async function externalCase(page) {
  await page.evaluate(() => {
    window.runtimeFixture.openModal('a', 'modal-a');
    window.runtimeFixture.startExternal();
  });
  await page.locator('#external-action').click();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#external').open);
  assert.deepEqual(await page.evaluate(() => window.runtimeFixture.modalState().closes), { 'modal-a': 0 });
  await page.evaluate(() => window.runtimeFixture.finishExternal());
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.runtimeFixture.modalState().active.length === 0);
  assert.equal(await page.evaluate(() => window.runtimeFixture.modalState().backgroundInert), false);
}

async function nativeCase(page, shadow) {
  await page.evaluate(shadowRoot => window.runtimeFixture.startNative(shadowRoot), shadow);
  await page.locator('#native-opener').click();
  await page.waitForFunction(() => window.runtimeFixture.nativeState().childOpen);
  await page.locator('#details-action').click();
  assert.equal(await page.evaluate(() => window.runtimeFixture.nativeState().clicks), 1);
  await page.evaluate(() => window.runtimeFixture.openNativePopup());
  await page.locator('#native-popup-action').click();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#native-popup'));
  assert.equal(await page.evaluate(() => window.runtimeFixture.nativeState().childOpen), true);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.runtimeFixture.nativeState().childOpen);
  assert.equal(await page.evaluate(() => window.runtimeFixture.nativeState().parentOpen), true);
  await page.waitForFunction(() => window.runtimeFixture.nativeState().focused === 'native-opener');
}

try {
  for (const mode of variants) {
    for (const environment of ['development', 'linked-development', 'production']) {
      await withRuntimePhase(environment, async phaseMode => {
        const state = configuration(mode, environment, phaseMode);
        const expectedRoots = mode === 'raw' ? roots : [appRoot];
        const record = { mode, environment, roots: [], expectedRoots, warnings: state.buildWarnings };
        report.configurations.push(record);
        let server;
        try {
          if (environment === 'production') {
            await build(state.config);
            assertBundleRoots([...state.observedRoots], mode, expectedRoots);
            assert.deepEqual(state.buildWarnings, [], 'Unexpected build warnings');
            server = await preview(state.config);
          } else {
            server = await createServer(state.config);
            await server.listen();
          }
          const base = server.resolvedUrls.local[0];
          const auditDevelopment = environment !== 'production' ? async (scripts, evidenceOnly = false) => {
            const modules = await inspectDevelopmentGraph(server, scripts);
            if (evidenceOnly) return modules; // This path can retain evidence, never qualify a failed case.
            const actualRoots = [...new Set(modules.flatMap(module => module.uiRoots))];
            if (mode === 'raw' && environment === 'development') {
              assert.ok(actualRoots.length > 0 && actualRoots.every(root => expectedRoots.includes(root)),
                'Observed raw dependencies must belong to the supplied installed archive contexts');
            } else assertBundleRoots(actualRoots, mode, expectedRoots);
            return modules;
          } : undefined;
          for (const browserName of engines) {
            const browser = await playwright[browserName].launch({ headless: true });
            try {
              const metadata = { mode, environment, browser: browserName };
              const caseRunner = (name, action, owner = 'a') =>
                runCase(browser, base, metadata, name, action, owner, auditDevelopment);
              for (const owner of ['a', 'b']) {
                if (mode === 'raw') {
                  await caseRunner(environment === 'development' ? 'default optimizer runtime control' : 'unsupported split runtime diagnostic', async (page, row) => {
                    if (row.runtimeTopology === 'single') return escapeCase(page, row, false);
                    await openPair(page);
                    await page.locator('#upper-action').click();
                    await page.keyboard.press('Escape');
                    // Supporting observation only: unsupported behavior is not a permanent contract.
                    row.firstEscape = await page.evaluate(() => window.runtimeFixture.snapshot());
                    await page.evaluate(() => window.runtimeFixture.exerciseBothOwners());
                  }, owner);
                } else {
                  await caseRunner('topmost Escape and reconnect', (page, row) => escapeCase(page, row, false), owner);
                  await caseRunner('prevented Escape and close veto', (page, row) => escapeCase(page, row, true), owner);
                }
              }
              if (mode !== 'raw') {
                await caseRunner('modal inert scroll and Tab ownership', modalCase);
                await caseRunner('external modal suspension and idempotent release', externalCase);
                for (const shadow of [false, true]) {
                  await caseRunner(`native modal ${shadow ? 'shadow' : 'light'} context`, page => nativeCase(page, shadow));
                }
              }
            } finally { await browser.close(); }
          }
          assert.deepEqual(state.buildWarnings, [], 'Unexpected Vite warnings');
          if (environment !== 'production') {
            record.roots = [...new Set(report.cases.filter(row => row.mode === mode && row.environment === environment)
              .flatMap(row => row.developmentGraph?.flatMap(module => module.uiRoots) ?? []))];
            if (mode === 'raw' && environment === 'development') {
              assert.ok(record.roots.length > 0, 'The default optimizer control needs actual per-page graph evidence');
              record.observedTopologies = report.cases.filter(row => row.mode === mode && row.environment === environment).map(row => row.runtimeTopology);
            } else assertBundleRoots(record.roots, mode, expectedRoots);
          }
          record.status = 'completed';
        } catch (error) {
          record.status = 'failed';
          record.error = error.stack ?? String(error);
          failures.push(`${mode}/${environment}: ${error.message}`);
        } finally {
          if (environment === 'production') record.roots = [...state.observedRoots];
          if (server) await closeServer(server);
          await save();
        }
      });
    }
  }
} finally { await save(); }
console.log(JSON.stringify({ cases: report.cases.length, passed: report.cases.filter(row => row.status === 'passed').length, failed: failures.length, report: 'report.json' }));
assert.deepEqual(failures, [], 'Packed runtime singleton qualification failed; inspect the retained report');
