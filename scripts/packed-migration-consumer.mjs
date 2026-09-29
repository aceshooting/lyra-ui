import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { basename, join, resolve, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { compatibilityKey } from '../packages/lyra-ui/scripts/published-compatibility.mjs';
import { createMemberMigrationCases, assertMemberMigrationReport, selectMemberMigrationStage } from './packed-migration-consumer-cases.mjs';
import { X_CASES, RETAINED_ROOT } from '../packages/lyra-ui/scripts/fixtures/lyra-renames/consumer/x-cases.mjs';

const fixtures = fileURLToPath(new URL('../packages/lyra-ui/scripts/fixtures/lyra-renames/consumer/', import.meta.url));
const packageName = '@aceshooting/lyra-ui';
const binName = name => process.platform === 'win32' ? `${name}.cmd` : name;
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const targetOf = record => String(record.policy.replacement.usage || record.policy.replacement.name);

/** Keep the exact normal-pack artifact and its inventory after temporary consumers are removed. */
export async function preservePackedTarball({ tarballPath, artifactsDir }) {
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const original = await readFile(tarballPath);
  const sha256 = hash(original);
  const fileName = basename(tarballPath);
  const destination = join(artifactsDir, fileName);
  await mkdir(artifactsDir, { recursive: true });
  try {
    await copyFile(tarballPath, destination, constants.COPYFILE_EXCL);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  assert.equal(hash(await readFile(destination)), sha256, `Preserved ${fileName} has different bytes`);
  const execute = promisify(execFile);
  const options = { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, LC_ALL: 'C', TZ: 'UTC' } };
  const { stdout: listing } = await execute('tar', [
    '--list', '--verbose', '--numeric-owner', '--full-time', '--quoting-style=literal', '--gzip', '--file', destination,
  ], options);
  const files = [];
  const paths = new Set();
  for (const line of listing.trimEnd().split('\n')) {
    const match = /^([-d][rwxstST-]{9})\s+\d+\/\d+\s+(\d+)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?\s+(.+)$/u.exec(line);
    assert.ok(match, `Unsupported packed inventory entry: ${line}`);
    const [, mode, bytes, path] = match;
    assert.ok(path.startsWith('package/') && !path.split('/').includes('..'), `Invalid packed inventory path: ${path}`);
    assert.ok(!paths.has(path), `Duplicate packed inventory path: ${path}`);
    paths.add(path);
    if (mode.startsWith('d')) continue;
    const size = Number(bytes);
    assert.ok(Number.isSafeInteger(size) && size >= 0, `Invalid packed inventory size: ${path}`);
    files.push({ path, size });
  }
  files.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  assert.ok(files.some(file => file.path === 'package/package.json'), 'Packed inventory lacks package.json');
  const { stdout: manifest } = await execute('tar', ['-xOf', destination, 'package/package.json'], options);
  const { name, version } = JSON.parse(manifest);
  assert.ok(typeof name === 'string' && name.length > 0 && typeof version === 'string' && version.length > 0, 'Packed package identity is missing');
  const receipt = { name, version, fileName, sha256, packedBytes: original.length,
    unpackedBytes: files.reduce((total, file) => total + file.size, 0), fileCount: files.length, files };
  const receiptPath = `${destination}.json`;
  try {
    await writeFile(receiptPath, json(receipt), { flag: 'wx' });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    assert.deepEqual(JSON.parse(await readFile(receiptPath, 'utf8')), receipt, `Preserved ${fileName} receipt differs`);
  }
  console.log(`Preserved ${name}@${version}: SHA256 ${sha256}; ${receipt.fileCount} files; ${receipt.packedBytes} packed bytes; ${receipt.unpackedBytes} unpacked bytes`);
  return receipt;
}

/** Bind authored examples to the checked historical authority, without copying policy records. */
export function selectMigrationCases(context, installedVersion, cases = X_CASES) {
  assert.equal(installedVersion, context.packageVersion, 'Installed package version differs from verified context version');
  assert.match(installedVersion, /^23\.\d+\.\d+$/u, 'This consumer cohort requires an actual 23 release candidate');
  const keys = cases.map(item => compatibilityKey(item.key));
  assert.equal(new Set(keys).size, keys.length, 'duplicate consumer case key');
  const expected = Object.values(context.records).filter(record =>
    record.policy.removalNotBefore === '23.0.0' && (record.key.scope === 'export' ||
      (record.key.kind === 'component' && record.key.tag === 'lr-geojson-view'))).map(record => compatibilityKey(record.key)).sort();
  assert.deepEqual([...keys].sort(), expected, 'Consumer cases do not exactly cover the structural retirement cohort');
  assert.equal(keys.length, 9, 'Structural cohort must contain exactly nine reviewed cases');
  const retained = context.records[compatibilityKey(RETAINED_ROOT.key)];
  assert.equal(retained?.state, 'current', 'Retained root class policy is missing');
  assert.equal(retained.policy.removalNotBefore, '24.0.0', 'Retained root class floor changed');
  return cases.map((item, index) => {
    const record = context.records[keys[index]];
    assert.equal(record?.state, 'retired', `Source retirement is not ready: ${keys[index]}`);
    assert.equal(record.removedIn, '23.0.0', `Unexpected retirement version: ${keys[index]}`);
    return { ...item, record, additionalReviews: (item.additionalReviews ?? []).map(site => ({ ...site, record: context.records[compatibilityKey(site.key)] })) };
  });
}

/** A successful process is not sufficient: every manual decision has an exact report witness. */
export function assertMigrationReport(report, cases, origin, acknowledged = 0) {
  const sites = cases.flatMap(item => [item, ...(item.additionalReviews ?? []).map(site => ({ ...site, file: item.file }))]);
  assert.equal(report.schemaVersion, 1, 'Unexpected public migration report schema');
  assert.equal(report.origin, origin);
  assert.deepEqual(report.changes, [], 'Manual migration cases must not be silently rewritten');
  assert.equal(report.filesChanged, 0);
  assert.equal(report.summary.rewrites, 0);
  assert.equal(report.summary.warnings, sites.length);
  assert.equal(report.summary.acknowledged, acknowledged);
  assert.equal(report.warnings.length, sites.length, 'Missing or orphan migration diagnostics');
  const remaining = [...report.warnings];
  for (const item of sites) {
    const index = remaining.findIndex(warning => warning.file === item.file && warning.line === 1 && warning.column === item.column);
    assert.notEqual(index, -1, `Missing diagnostic at ${item.file}:1:${item.column}`);
    const [warning] = remaining.splice(index, 1);
    assert.equal(warning.origin, origin);
    assert.equal(warning.upstreamTag, item.key.tag ?? null);
    assert.equal(warning.upstreamMember, item.key.name);
    assert.equal(warning.action, 'manual-review');
    assert.equal(warning.warningCode, item.key.scope === 'member' ? 'DEPRECATED_MEMBER_REVIEW' : 'DEPRECATED_MODULE_REVIEW');
    assert.equal(warning.target, targetOf(item.record));
    const phrase = item.record.state === 'retired' ? 'was removed in 23.0.0' : 'is deprecated and scheduled for removal in 24.0.0';
    assert.ok(warning.message.includes(phrase), `Wrong policy tense: ${warning.message}`);
  }
}

export function runMigrationProcess(command, args, cwd, expectedStatus = 0) {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, CI: 'true' }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (status, signal) => {
      if (status !== expectedStatus) reject(new Error(`${command} exited ${status ?? signal}; expected ${expectedStatus}\n${stdout}\n${stderr}`));
      else accept({ stdout, stderr });
    });
  });
}

export async function verifyPackedMigrationConsumers({ fixtureDir, compatibilityContext, tarballPath, artifactsDir = join(fixtureDir, 'migration-x-reports') }) {
  const installedRoot = join(fixtureDir, 'node_modules', '@aceshooting', 'lyra-ui');
  const installed = JSON.parse(await readFile(join(installedRoot, 'package.json'), 'utf8'));
  assert.equal(installed.name, packageName);
  const cases = selectMigrationCases(compatibilityContext, installed.version);
  const tarballSha256 = createHash('sha256').update(await readFile(tarballPath)).digest('hex');
  const scratch = join(fixtureDir, 'migration-x');
  const inputDir = join(scratch, 'input'); const resolvedDir = join(scratch, 'resolved');
  await Promise.all([mkdir(inputDir, { recursive: true }), mkdir(resolvedDir, { recursive: true }), mkdir(artifactsDir, { recursive: true })]);
  const relativeFile = file => relative(fixtureDir, file).split(sep).join('/');
  const bound = cases.map(item => ({ ...item, file: relativeFile(join(inputDir, `${item.id}.${item.key.scope === 'member' ? 'html' : 'ts'}`)) }));
  for (const item of bound) {
    await writeFile(join(fixtureDir, item.file), item.input);
    await writeFile(join(resolvedDir, `${item.id}.${item.key.scope === 'member' ? 'html' : 'ts'}`), item.resolved);
  }
  const rootFile = join(inputDir, 'retained-root.ts');
  await writeFile(rootFile, RETAINED_ROOT.input);
  const rootCase = { ...RETAINED_ROOT, file: relativeFile(rootFile), record: compatibilityContext.records[compatibilityKey(RETAINED_ROOT.key)] };
  const executable = join(fixtureDir, 'node_modules', '.bin', binName('lyra-ui-migrate'));
  const reportPaths = [];
  for (const origin of ['lyra-v21', 'lyra-v22']) {
    const expected = origin === 'lyra-v21' ? bound : [rootCase];
    for (const [mode, flags, status] of [['preview', ['--dry-run'], 0], ['check', ['--check'], 1], ['apply', [], 0], ['rerun', ['--check'], 1]]) {
      const reportPath = join(artifactsDir, `${origin}-${mode}.json`); reportPaths.push(reportPath);
      const result = await runMigrationProcess(executable, [`--origin=${origin}`, ...flags, `--report=${reportPath}`, inputDir], fixtureDir, status);
      assert.match(result.stdout + result.stderr, new RegExp(`Applying entries available in @aceshooting/lyra-ui ${installed.version.replaceAll('.', '\\.')}`, 'u'), 'CLI must discover the actual installed version');
      assertMigrationReport(JSON.parse(await readFile(reportPath, 'utf8')), expected, origin);
      for (const item of bound) assert.equal(await readFile(join(fixtureDir, item.file), 'utf8'), item.input, 'Automatic output must remain the authored manual-review input');
      assert.equal(await readFile(rootFile, 'utf8'), RETAINED_ROOT.input);
    }
    const reportPath = join(artifactsDir, `${origin}-resolved.json`); reportPaths.push(reportPath);
    await runMigrationProcess(executable, [`--origin=${origin}`, '--check', `--report=${reportPath}`, resolvedDir], fixtureDir);
    assertMigrationReport(JSON.parse(await readFile(reportPath, 'utf8')), [], origin);
  }
  // This acknowledgement belongs to the retained p22 canary, not the common resolved fixture.
  const retainedResolved = join(scratch, 'retained-root.ts');
  await writeFile(retainedResolved, RETAINED_ROOT.resolved);
  const retainedReport = join(artifactsDir, 'retained-root-resolved.json');
  await runMigrationProcess(executable, ['--origin=lyra-v22', '--check', `--report=${retainedReport}`, retainedResolved], fixtureDir);
  assertMigrationReport(JSON.parse(await readFile(retainedReport, 'utf8')), [], 'lyra-v22', 1);

  const routes = cases.filter(item => item.key.kind === 'entry-point').map(item => `${packageName}${item.key.name.slice(1)}`);
  const routeProbe = join(scratch, 'routes.mjs');
  await writeFile(routeProbe, `import assert from 'node:assert/strict';\nfor (const specifier of ${JSON.stringify(routes)}) {\n  assert.throws(() => import.meta.resolve(specifier), error => error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED', specifier);\n}\n`);
  await runMigrationProcess(process.execPath, [routeProbe], fixtureDir);
  await copyFile(join(fixtures, 'x-positive.ts'), join(scratch, 'positive.ts'));
  const negative = cases.filter(item => item.key.kind === 'type').map(item => `// @ts-expect-error retired named type\n${item.input}`).join('\n');
  // Each directive tests a single name. The GeoJSON root case independently checks type removal,
  // while the route probe already proves its old module cannot resolve.
  await writeFile(join(scratch, 'negative.ts'), negative);
  await writeFile(join(scratch, 'tsconfig.json'), json({ extends: '../tsconfig.json', include: ['positive.ts', 'negative.ts'] }));
  await runMigrationProcess(join(fixtureDir, 'node_modules', '.bin', binName('tsc')), ['--noEmit', '--skipLibCheck', 'false', '-p', join(scratch, 'tsconfig.json')], fixtureDir);
  const members = await verifyPackedMemberConsumers({ fixtureDir, compatibilityContext, executable, artifactsDir });
  const proof = { packageVersion: installed.version, tarballSha256, stage: members.stage, coveredKeys: [...bound.map(item => item.key), ...members.coveredKeys], reports: [...reportPaths, retainedReport, ...members.reports] };
  await writeFile(join(artifactsDir, 'coverage.json'), json(proof));
  console.log(`Packed migration ${proof.stage} proof: ${proof.coveredKeys.length}/${proof.stage === 'all-retirements' ? 399 : 9} exact keys; both origins, routes and declarations passed.`);
  return proof;
}

export async function writeResolvedMigrationEntry({ fixtureDir, proof, entry = 'migratedX' }) {
  assertBrowserProof(proof);
  const installed = JSON.parse(await readFile(join(fixtureDir, 'node_modules', '@aceshooting', 'lyra-ui', 'package.json'), 'utf8'));
  assert.equal(installed.version, proof.packageVersion, 'Browser fixture and CLI fixture package versions differ');
  const browserSource = await readFile(join(fixtures, 'x-browser.ts'), 'utf8');
  if (proof.stage === 'all-retirements') {
    await copyFile(join(fixtures, 'family-browser.ts'), join(fixtureDir, 'src', 'migration-families.ts'));
    await copyFile(join(fixtures, 'family-negative.ts'), join(fixtureDir, 'src', 'migration-family-types.ts'));
  }
  await writeFile(join(fixtureDir, 'src', `bundle-${entry}.ts`), browserSource + (proof.stage === 'all-retirements' ? "\nawait import('./migration-families.js');\n" : ''));
  if (proof.stage === 'all-retirements') {
    const config = join(fixtureDir, 'migration-browser-tsconfig.json');
    await writeFile(config, json({ extends: './tsconfig.json', include: [`src/bundle-${entry}.ts`, 'src/migration-families.ts', 'src/migration-family-types.ts'] }));
    await runMigrationProcess(join(fixtureDir, 'node_modules', '.bin', binName('tsc')), ['--noEmit', '--skipLibCheck', 'false', '-p', config], fixtureDir);
  }
}

/** Serve only the emitted consumer graph; browsers never resolve repository source modules. */
export async function verifyResolvedMigrationBrowser({ bundleDir, proof, artifactsDir = join(bundleDir, 'evidence') }) {
  assertBrowserProof(proof);
  const { chromium, firefox, webkit } = await import('playwright');
  const root = resolve(bundleDir);
  const features = { type: 'FeatureCollection', features: [0, 1].map(index => ({ type: 'Feature', properties: { name: `Consumer feature ${index + 1}` }, geometry: { type: 'Point', coordinates: [6.1 + index / 100, 49.6] } })) };
  const mime = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      if (pathname === '/') { response.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><html lang="en"><title>Migrated consumer</title><body><script type="module" src="./index.js"></script></body></html>'); return; }
      if (pathname === '/features.geojson') { response.writeHead(200, { 'Content-Type': 'application/geo+json' }).end(json(features)); return; }
      if (pathname === '/favicon.ico') { response.writeHead(204).end(); return; }
      const path = resolve(root, `.${pathname}`);
      if (!path.startsWith(`${root}${sep}`)) { response.writeHead(403).end(); return; }
      const body = await readFile(path);
      response.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream' }).end(body);
    } catch { response.writeHead(404).end(); }
  });
  // Sequential engines share one server and never exceed one browser process/page.
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(8370, '127.0.0.1', accept); });
  const origin = 'http://127.0.0.1:8370';
  await mkdir(artifactsDir, { recursive: true });
  try {
    for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
      const browser = await engine.launch({ headless: true });
      const errors = [];
      try {
        const context = await browser.newContext({ viewport: { width: 1000, height: 800 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        page.on('requestfailed', request => errors.push(`Failed request: ${request.url()}`));
        page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
        await page.route('**/*', route => {
          const url = route.request().url();
          if (url.startsWith(`${origin}/`) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
          errors.push(`Unexpected external request: ${url}`); return route.abort();
        });
        await page.goto(origin);
        await page.waitForFunction(() => document.documentElement.dataset.migrationReady === 'true', null, { timeout: 30000 });
        await page.waitForFunction(() => ['lr-geojson-viewer', 'consumer-geojson-view'].every(id => {
          const root = document.getElementById(id)?.shadowRoot;
          return root?.querySelector('[part="metadata"]')?.textContent?.includes('Consumer feature 2') && root.querySelector('[part="status"]')?.textContent?.includes('2');
        }), null, { timeout: 60000 });
        if (proof.stage === 'all-retirements') await page.waitForFunction(() => Boolean(document.documentElement.dataset.migrationFamilies), null, { timeout: 90000 });
        const familyScenarios = await page.evaluate(() => JSON.parse(document.documentElement.dataset.migrationFamilies ?? '[]'));
        assert.deepEqual(familyScenarios, proof.stage === 'all-retirements' ? FAMILY_SCENARIOS : []);
        const state = await page.evaluate(() => ({ oldTagDefined: Boolean(customElements.get('lr-geojson-view')),
          viewers: ['lr-geojson-viewer', 'consumer-geojson-view'].map(id => {
            const element = document.getElementById(id); const metadata = element.shadowRoot.querySelector('[part="metadata"]');
            return { id, features: JSON.parse(metadata.textContent).features.length, visible: metadata.getBoundingClientRect().height > 0 };
          }) }));
        assert.equal(state.oldTagDefined, false);
        assert.ok(state.viewers.every(viewer => viewer.features === 2 && viewer.visible));
        assert.deepEqual(errors, [], `${name}: unexpected console/network errors`);
        await writeFile(join(artifactsDir, `${name}.json`), json({ packageVersion: proof.packageVersion, tarballSha256: proof.tarballSha256, stage: proof.stage, familyScenarios, ...state }));
        console.log(`Packed migrated consumer ${name}: distinct retained/canonical constructors render two features; retired tag absent; ${familyScenarios.length} family scenarios passed.`);
      } catch (error) {
        throw new Error(`${name} migrated consumer failed: ${error.message}\n${errors.join('\n')}`, { cause: error });
      } finally { await browser.close(); }
    }
  } finally { await new Promise((accept, reject) => server.close(error => error ? reject(error) : accept())); }
}

async function verifyPackedMemberConsumers({ fixtureDir, compatibilityContext, executable, artifactsDir }) {
  const ledger = JSON.parse(await readFile(join(fixtures, '..', '..', 'lyra-renames.json'), 'utf8'));
  const cases = createMemberMigrationCases(compatibilityContext, ledger);
  const stage = selectMemberMigrationStage(compatibilityContext, cases);
  if (stage !== 'all-retirements') return { stage, coveredKeys: [], reports: [] };
  const scratch = join(fixtureDir, 'migration-members');
  const reportPaths = [];
  const typesDir = join(scratch, 'types'); await mkdir(typesDir, { recursive: true });
  for (const item of cases.filter(item => item.extension === 'ts')) {
    await writeFile(join(typesDir, `${item.id}.ts`), `import '@aceshooting/lyra-ui/components/${item.key.tag}.js';\nimport { html } from 'lit';\nconst handler = (event: Event) => console.log(event);\n${item.resolved}`);
  }
  const config = join(scratch, 'tsconfig.json');
  await writeFile(config, json({ extends: '../tsconfig.json', include: ['types/*.ts'] }));
  await runMigrationProcess(join(fixtureDir, 'node_modules', '.bin', binName('tsc')), ['--noEmit', '--skipLibCheck', 'false', '-p', config], fixtureDir);
  for (const origin of ['lyra-v21', 'lyra-v22']) {
    const inputDir = join(scratch, origin, 'input'); const resolvedDir = join(scratch, origin, 'resolved');
    await Promise.all([mkdir(inputDir, { recursive: true }), mkdir(resolvedDir, { recursive: true })]);
    const bound = cases.map(item => ({ ...item, file: relative(fixtureDir, join(inputDir, `${item.id}.${item.extension}`)).split(sep).join('/') }));
    for (const item of bound) {
      await writeFile(join(fixtureDir, item.file), item.input);
      await writeFile(join(resolvedDir, `${item.id}.${item.extension}`), item.resolvedByOrigin?.[origin] ?? item.resolved);
    }
    for (const [mode, flags, status] of [['preview', ['--dry-run'], 0], ['check', ['--check'], Number(origin === 'lyra-v21')], ['apply', [], 0], ['rerun', ['--check'], Number(origin === 'lyra-v21')]]) {
      const reportPath = join(artifactsDir, `${origin}-members-${mode}.json`); reportPaths.push(reportPath);
      await runMigrationProcess(executable, [`--origin=${origin}`, ...flags, `--report=${reportPath}`, inputDir], fixtureDir, status);
      const expected = mode === 'rerun' ? bound.filter(item => !item.automatic) : bound;
      assertMemberMigrationReport(JSON.parse(await readFile(reportPath, 'utf8')), expected, origin);
      for (const item of bound) {
        const migrated = origin === 'lyra-v21' && ['apply', 'rerun'].includes(mode) && item.automatic;
        assert.equal(await readFile(join(fixtureDir, item.file), 'utf8'), migrated ? item.resolved : item.input, `Unexpected automatic bytes: ${item.id}/${origin}/${mode}`);
      }
    }
    const reportPath = join(artifactsDir, `${origin}-members-resolved.json`); reportPaths.push(reportPath);
    await runMigrationProcess(executable, [`--origin=${origin}`, '--check', `--report=${reportPath}`, resolvedDir], fixtureDir);
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    assertMigrationReport(report, [], origin, origin === 'lyra-v21' ? 2 : 0);
  }
  const casesPath = join(artifactsDir, 'member-resolutions.json');
  await writeFile(casesPath, json(cases.map(item => ({ key: item.key, file: `${item.id}.${item.extension}`,
    strategy: item.automatic ? 'deterministic-rewrite' : 'manual-review', input: item.input,
    automaticOutput: item.automatic ? item.resolved : item.input,
    resolvedByOrigin: item.resolvedByOrigin ?? { 'lyra-v21': item.resolved, 'lyra-v22': item.resolved } }))));
  return { stage, coveredKeys: cases.map(item => item.key), reports: [...reportPaths, casesPath] };
}

const FAMILY_SCENARIOS = ['naming-and-inheritance', 'menu-and-stat-slots', 'polarity-and-veto', 'full-and-core', 'graph-detail-and-css', 'populated-charts', 'native-mutation-filter'];

export function assertBrowserProof(proof) {
  assert.ok(['exports-and-geojson', 'all-retirements'].includes(proof.stage), 'Unknown consumer stage');
  assert.equal(proof.coveredKeys.length, proof.stage === 'all-retirements' ? 399 : 9, 'Incomplete browser cohort');
  assert.equal(new Set(proof.coveredKeys.map(compatibilityKey)).size, proof.coveredKeys.length, 'Duplicate browser identity');
}
