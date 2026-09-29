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
import { fieldDeclarationKey, fieldExposureKey, validateFieldEvidenceIndex, verifyPublishedFieldContinuity } from '../packages/lyra-ui/scripts/published-field-compatibility.mjs';
import { jsonBytes as evidenceJsonBytes, sha256 as evidenceSha256 } from '../packages/lyra-ui/scripts/published-compatibility-io.mjs';
import { createMemberMigrationCases, createV24MemberMigrationCases, createV24ExportMigrationCases, assertMemberMigrationReport, selectMemberMigrationStage } from './packed-migration-consumer-cases.mjs';
import { X_CASES, RETAINED_ROOT } from '../packages/lyra-ui/scripts/fixtures/lyra-renames/consumer/x-cases.mjs';

const fixtures = fileURLToPath(new URL('../packages/lyra-ui/scripts/fixtures/lyra-renames/consumer/', import.meta.url));
const packageName = '@aceshooting/lyra-ui';
const binName = name => process.platform === 'win32' ? `${name}.cmd` : name;
const json = value => `${JSON.stringify(value, null, 2)}\n`;
const targetOf = record => String(record.policy.replacement.usage || record.policy.replacement.name);
const reviewCodeFor = item => item.sharedTargetReview ? 'RENAME_TARGET_SHARED_REVIEW'
  : item.rule?.polarity === 'inverted' ? 'POLARITY_REVIEW'
    : item.key.scope === 'member' ? 'DEPRECATED_MEMBER_REVIEW' : 'DEPRECATED_MODULE_REVIEW';

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
  assert.match(installedVersion, /^(?:23|24)\.\d+\.\d+$/u, 'This consumer cohort requires an actual 23 or 24 package');
  const keys = cases.map(item => compatibilityKey(item.key));
  assert.equal(new Set(keys).size, keys.length, 'duplicate consumer case key');
  const expected = Object.values(context.records).filter(record =>
    record.policy.removalNotBefore === '23.0.0' && (record.key.scope === 'export' ||
      (record.key.kind === 'component' && record.key.tag === 'lr-geojson-view'))).map(record => compatibilityKey(record.key)).sort();
  assert.deepEqual([...keys].sort(), expected, 'Consumer cases do not exactly cover the structural retirement cohort');
  assert.equal(keys.length, 9, 'Structural cohort must contain exactly nine reviewed cases');
  const retained = context.records[compatibilityKey(RETAINED_ROOT.key)];
  assert.ok(retained, 'Root GeoJSON class policy is missing');
  assert.equal(retained.policy.removalNotBefore, '24.0.0', 'Root class retirement floor changed');
  if (installedVersion.startsWith('23.')) assert.equal(retained.state, 'current', 'Root class must remain available in v23');
  else {
    assert.equal(retained.state, 'retired', 'Root class must be removed from the actual v24 package');
    assert.equal(retained.removedIn, '24.0.0');
  }
  return cases.map((item, index) => {
    const record = context.records[keys[index]];
    assert.equal(record?.state, 'retired', `Source retirement is not ready: ${keys[index]}`);
    assert.equal(record.removedIn, '23.0.0', `Unexpected retirement version: ${keys[index]}`);
    return { ...item, record, additionalReviews: (item.additionalReviews ?? []).map(site => ({ ...site, record: context.records[compatibilityKey(site.key)] })) };
  });
}

/** A successful process is not sufficient: every rewrite and manual decision has an exact witness. */
export function assertMigrationReport(report, cases, origin, acknowledged = 0) {
  const sites = cases.flatMap(item => [item, ...(item.additionalReviews ?? []).map(site => ({ ...site, file: item.file }))]);
  const rewritten = sites.filter(item => item.automatic);
  const reviewed = sites.filter(item => !item.automatic);
  assert.equal(report.schemaVersion, 1, 'Unexpected public migration report schema');
  assert.equal(report.origin, origin);
  assert.equal(report.changes.length, rewritten.length, 'Missing or orphan automatic migration rewrites');
  assert.equal(report.filesChanged, rewritten.length);
  assert.equal(report.summary.rewrites, rewritten.length);
  assert.equal(report.summary.warnings, reviewed.length);
  assert.equal(report.summary.acknowledged, acknowledged);
  assert.equal(report.warnings.length, reviewed.length, 'Missing or orphan migration diagnostics');
  for (const [items, actual] of [[rewritten, report.changes], [reviewed, report.warnings]]) {
    const remaining = [...actual];
    for (const item of items) {
      const line = item.line ?? 1;
      const index = remaining.findIndex(warning => warning.file === item.file && warning.line === line && warning.column === item.column);
      assert.notEqual(index, -1, `Missing diagnostic at ${item.file}:${line}:${item.column}`);
      const [warning] = remaining.splice(index, 1);
      assert.equal(warning.origin, origin);
      assert.equal(warning.upstreamTag, item.key.tag ?? null);
      assert.equal(warning.upstreamMember, item.key.name);
      if (item.automatic) {
        assert.equal(warning.action, `rewrite-${item.key.kind}`);
        assert.equal(warning.warningCode, null);
        assert.equal(warning.target, item.rule.to);
        continue;
      }
      assert.equal(warning.action, 'manual-review');
      assert.equal(warning.warningCode, reviewCodeFor(item));
      assert.equal(warning.target, item.rule?.to ?? targetOf(item.record));
      if (!item.rule) {
        const phrase = item.record.state === 'retired' ? `was removed in ${item.record.removedIn}` : `is deprecated and scheduled for removal in ${item.record.policy.removalNotBefore}`;
        assert.ok(warning.message.includes(phrase), `Wrong policy tense: ${warning.message}`);
      }
    }
    assert.equal(remaining.length, 0, 'Orphan migration report sites');
  }
}

/** Pin every diagnostic in the multiline semantic fixture to its authored source site. */
export function createV24SemanticMigrationCases(cases, source, file) {
  const lines = source.split('\n');
  const sites = [];
  for (const item of cases) {
    const { kind, name, module } = item.key;
    const named = ['class', 'constant', 'function', 'type'].includes(kind);
    const route = kind === 'entry-point' || kind === 'stylesheet';
    const specifier = named ? `${packageName}${module === '.' ? '' : module.slice(1)}`
      : route ? `${packageName}${name.slice(1)}` : null;
    for (const [index, text] of lines.entries()) {
      let column = -1;
      if (named) {
        const imports = /^\s*import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/u.exec(text);
        if (imports?.[2] === specifier) {
          const member = new RegExp(`(?:^|[,\\s])(?:type\\s+)?${name}(?=\\s*(?:,|$))`, 'u');
          const match = member.exec(imports[1]);
          if (match) column = text.indexOf('{') + 1 + match.index + match[0].lastIndexOf(name) + 1;
        }
      } else if (route) {
        const imports = /(?:\bfrom\s*|^\s*import\s*)['"]([^'"]+)['"]/u.exec(text);
        if (imports?.[1] === specifier) column = text.indexOf(specifier) + 1;
      } else if (kind === 'root-attribute') column = text.indexOf(`'${name}'`) < 0 ? -1 : text.indexOf(name) + 1;
      else if (kind === 'window-event') column = text.indexOf(`'${name}'`) < 0 ? -1 : text.indexOf(name) + 1;
      if (column > 0) sites.push({ ...item, file, line: index + 1, column, additionalReviews: [] });
    }
  }
  assert.ok(sites.length >= 15, 'Focused v24 semantic fixture lost a reviewed theme, route, or GeoJSON case');
  return sites;
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

export async function verifyPackedMigrationConsumers({ fixtureDir, compatibilityContext, tarballPath, fieldAuthority = null, fieldMode = 'retirement', artifactsDir = join(fixtureDir, 'migration-x-reports') }) {
  const installedRoot = join(fixtureDir, 'node_modules', '@aceshooting', 'lyra-ui');
  const installed = JSON.parse(await readFile(join(installedRoot, 'package.json'), 'utf8'));
  assert.equal(installed.name, packageName);
  const cases = selectMigrationCases(compatibilityContext, installed.version);
  if (installed.version.startsWith('24.')) return verifyActualV24MigrationConsumers({ fixtureDir, compatibilityContext, tarballPath, fieldAuthority, fieldMode, artifactsDir, installed, cases });
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

/** The v24 stage keeps the p21 witnesses and adds the next-major cohort from the installed context. */
async function verifyActualV24MigrationConsumers({ fixtureDir, compatibilityContext, tarballPath, fieldAuthority, fieldMode, artifactsDir, installed, cases }) {
  const exports = createV24ExportMigrationCases(compatibilityContext);
  const ledger = JSON.parse(await readFile(join(fixtures, '..', '..', 'lyra-renames.json'), 'utf8'));
  const members = createV24MemberMigrationCases(compatibilityContext, ledger);
  const p22 = [...exports, ...members];
  assert.equal(p22.length, 654);
  assert.equal(members.filter(item => item.automatic).length, 5, 'The exact v24 automatic member cohort changed');
  assert.equal(exports.flatMap(item => item.additionalReviews).length, 7, 'The exact v24 nested module review cohort changed');
  const published23FieldFacts = verifyPublishedFieldAuthority(fieldAuthority);
  const fieldProof = await verifyInstalledFieldDeclarations({ fixtureDir, facts: published23FieldFacts, mode: fieldMode });
  const sha = createHash('sha256').update(await readFile(tarballPath)).digest('hex');
  const scratch = join(fixtureDir, 'migration-v24');
  const p21Input = join(scratch, 'p21-input');
  const p21Resolved = join(scratch, 'p21-resolved');
  const p22Input = join(scratch, 'p22-input');
  const p22Resolved = join(scratch, 'p22-resolved');
  await Promise.all([p21Input, p21Resolved, p22Input, p22Resolved, artifactsDir].map(path => mkdir(path, { recursive: true })));
  const relativeFile = file => relative(fixtureDir, file).split(sep).join('/');
  const p21Bound = cases.map(item => ({ ...item, file: relativeFile(join(p21Input, `${item.id}.${item.key.scope === 'member' ? 'html' : 'ts'}`)) }));
  for (const item of p21Bound) {
    await writeFile(join(fixtureDir, item.file), item.input);
    await writeFile(join(p21Resolved, `${item.id}.${item.key.scope === 'member' ? 'html' : 'ts'}`), item.resolved);
  }
  const executable = join(fixtureDir, 'node_modules', '.bin', binName('lyra-ui-migrate'));
  const reports = [];
  for (const [mode, flags, status] of [['preview', ['--dry-run'], 0], ['check', ['--check'], 1], ['apply', [], 0], ['rerun', ['--check'], 1]]) {
    const reportPath = join(artifactsDir, `lyra-v21-${mode}.json`); reports.push(reportPath);
    const result = await runMigrationProcess(executable, ['--origin=lyra-v21', ...flags, `--report=${reportPath}`, p21Input], fixtureDir, status);
    assert.match(result.stdout + result.stderr, /Applying entries available in @aceshooting\/lyra-ui 24\./u);
    assertMigrationReport(JSON.parse(await readFile(reportPath, 'utf8')), p21Bound, 'lyra-v21');
    for (const item of p21Bound) assert.equal(await readFile(join(fixtureDir, item.file), 'utf8'), item.input);
  }
  const p21ResolvedReport = join(artifactsDir, 'lyra-v21-resolved.json'); reports.push(p21ResolvedReport);
  await runMigrationProcess(executable, ['--origin=lyra-v21', '--check', `--report=${p21ResolvedReport}`, p21Resolved], fixtureDir);
  assertMigrationReport(JSON.parse(await readFile(p21ResolvedReport, 'utf8')), [], 'lyra-v21');

  const boundP22 = p22.map(item => ({ ...item, file: relativeFile(join(p22Input, `${item.id}.${item.extension}`)) }));
  for (const item of boundP22) {
    await writeFile(join(fixtureDir, item.file), item.input);
    if (item.resolved) await writeFile(join(p22Resolved, `${item.id}.${item.extension}`), item.resolved);
  }
  const semanticFile = join(fixtures, 'v24-semantics.input.ts');
  const semanticText = await readFile(semanticFile, 'utf8');
  const semanticInputDir = join(scratch, 'semantic-input'); await mkdir(semanticInputDir, { recursive: true });
  const semanticPath = join(semanticInputDir, 'v24-semantics.input.ts');
  await copyFile(semanticFile, semanticPath);
  const semanticCases = createV24SemanticMigrationCases(boundP22, semanticText, relativeFile(semanticPath));
  for (const [mode, flags, status] of [['preview', ['--dry-run'], 0], ['check', ['--check'], 1], ['apply', [], 0], ['rerun', ['--check'], 1]]) {
    const reportPath = join(artifactsDir, `lyra-v22-${mode}.json`); reports.push(reportPath);
    const result = await runMigrationProcess(executable, ['--origin=lyra-v22', ...flags, `--report=${reportPath}`, p22Input], fixtureDir, status);
    assert.match(result.stdout + result.stderr, /Applying entries available in @aceshooting\/lyra-ui 24\./u);
    assertMigrationReport(JSON.parse(await readFile(reportPath, 'utf8')), mode === 'rerun' ? boundP22.filter(item => !item.automatic) : boundP22, 'lyra-v22');
    for (const item of boundP22) assert.equal(await readFile(join(fixtureDir, item.file), 'utf8'), mode === 'apply' || mode === 'rerun' ? item.applied ?? item.input : item.input, `Unexpected migration output: ${item.id}`);
  }
  const p22ResolvedReport = join(artifactsDir, 'lyra-v22-resolved.json'); reports.push(p22ResolvedReport);
  // The 44 member snippets have authored canonical resolutions. Export semantics are exercised by
  // the focused fixture below; the remaining module notices stay visible as exact report targets.
  const memberDir = join(p22Resolved, 'members'); await mkdir(memberDir, { recursive: true });
  for (const item of members) await writeFile(join(memberDir, `${item.id}.ts`), `import '@aceshooting/lyra-ui/components/${item.key.tag}.js';\nimport { html } from 'lit';\nconst handler = (event: Event) => console.log(event);\n${item.resolved}`);
  const semanticSource = await readFile(join(fixtures, 'v24-semantics.resolved.ts'), 'utf8');
  await writeFile(join(p22Resolved, 'semantics.ts'), semanticSource);
  const resolvedTypes = join(scratch, 'resolved-tsconfig.json');
  await writeFile(resolvedTypes, json({ extends: '../tsconfig.json', include: ['p22-resolved/members/*.ts', 'p22-resolved/semantics.ts'] }));
  await runMigrationProcess(join(fixtureDir, 'node_modules', '.bin', binName('tsc')), ['--noEmit', '--skipLibCheck', 'false', '-p', resolvedTypes], fixtureDir);
  const p22ResolvedInput = join(scratch, 'p22-acknowledged'); await mkdir(p22ResolvedInput, { recursive: true });
  for (const item of boundP22) {
    if (item.automatic) {
      await writeFile(join(p22ResolvedInput, `${item.id}.${item.extension}`), item.applied);
      continue;
    }
    const tokens = [item, ...(item.additionalReviews ?? [])].map(site => `${reviewCodeFor(site)}:${site.key.name}`).join(' ');
    const acknowledgement = item.extension === 'html' ? `<!-- lyra-migrate-reviewed: ${tokens} -->\n`
      : item.extension === 'css' ? `/* lyra-migrate-reviewed: ${tokens} */\n`
        : `// lyra-migrate-reviewed: ${tokens}\n`;
    await writeFile(join(p22ResolvedInput, `${item.id}.${item.extension}`), `${acknowledgement}${item.input}`);
  }
  await runMigrationProcess(executable, ['--origin=lyra-v22', '--check', `--report=${p22ResolvedReport}`, p22ResolvedInput], fixtureDir);
  assertMigrationReport(JSON.parse(await readFile(p22ResolvedReport, 'utf8')), [], 'lyra-v22', boundP22.filter(item => !item.automatic).length + 7);
  const semanticReport = join(artifactsDir, 'lyra-v22-semantics.json'); reports.push(semanticReport);
  await runMigrationProcess(executable, ['--origin=lyra-v22', '--check', `--report=${semanticReport}`, semanticInputDir], fixtureDir, 1);
  assertMigrationReport(JSON.parse(await readFile(semanticReport, 'utf8')), semanticCases, 'lyra-v22');

  const routes = [...cases, ...exports].filter(item => item.key.scope === 'export' && item.key.kind === 'entry-point')
    .map(item => `${packageName}${item.key.name.slice(1)}`);
  const routeProbe = join(scratch, 'removed-routes.mjs');
  await writeFile(routeProbe, `import assert from 'node:assert/strict';\nfor (const specifier of ${JSON.stringify(routes)}) {\n  assert.throws(() => import.meta.resolve(specifier), error => error.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED', specifier);\n}\n`);
  await runMigrationProcess(process.execPath, [routeProbe], fixtureDir);
  const canonicalRoutes = [...new Set(exports.filter(item => item.key.kind === 'entry-point')
    .map(item => item.record.policy.replacement.name).filter(name => typeof name === 'string' && name.startsWith('./'))
    .map(name => `${packageName}${name.slice(1)}`))];
  const canonicalRouteProbe = join(scratch, 'canonical-routes.mjs');
  await writeFile(canonicalRouteProbe, `import assert from 'node:assert/strict';\nfor (const specifier of ${JSON.stringify(canonicalRoutes)}) {\n  assert.doesNotThrow(() => import.meta.resolve(specifier), specifier);\n}\n`);
  await runMigrationProcess(process.execPath, [canonicalRouteProbe], fixtureDir);
  const named = exports.filter(item => ['class', 'constant', 'function', 'type'].includes(item.key.kind));
  const negative = named.map(item => `// @ts-expect-error removed v24 export must not resolve\nimport { ${item.key.name} } from '${packageName}${item.key.module === '.' ? '' : item.key.module.slice(1)}';`).join('\n');
  const canonical = [...new Map(named.map(item => {
    const target = item.record.policy.replacement;
    if (!['class', 'constant', 'function', 'type'].includes(target.kind) || !target.module || !target.name) return null;
    return [`${target.module}#${target.name}`, { ...target, sourceKind: item.key.kind }];
  }).filter(Boolean)).values()];
  const positive = canonical.map(item => `import${item.kind === 'type' ? ' type' : ''} { ${item.name} } from '${packageName}${item.module === '.' ? '' : item.module.slice(1)}';`).join('\n');
  await writeFile(join(scratch, 'negative.ts'), negative);
  await writeFile(join(scratch, 'positive.ts'), `${positive}\nimport { LyraGeoJsonViewer } from '@aceshooting/lyra-ui/components/viewers/geojson-view/geojson-viewer.class.js';\nconst canonicalViewer: typeof LyraGeoJsonViewer = LyraGeoJsonViewer;\nvoid canonicalViewer;\n`);
  const declarationConfig = join(scratch, 'tsconfig.json');
  await writeFile(declarationConfig, json({ extends: '../tsconfig.json', include: ['negative.ts', 'positive.ts'] }));
  await runMigrationProcess(join(fixtureDir, 'node_modules', '.bin', binName('tsc')), ['--noEmit', '--skipLibCheck', 'false', '-p', declarationConfig], fixtureDir);

  const p21 = await verifyPackedMemberConsumers({ fixtureDir, compatibilityContext, executable, artifactsDir });
  assert.equal(p21.stage, 'all-retirements', 'All 399 p21 migration cases must remain covered');
  const coveredKeys = [...p21Bound.map(item => item.key), ...p21.coveredKeys, ...boundP22.map(item => item.key)];
  assert.equal(coveredKeys.length, 1053);
  const proof = { packageVersion: installed.version, tarballSha256: sha, stage: 'actual24', coveredKeys,
    fieldExposureProof: fieldProof, reports: [...reports, ...p21.reports] };
  await writeFile(join(artifactsDir, 'coverage.json'), json(proof));
  console.log(`Packed migration actual24 proof: ${proof.coveredKeys.length}/1053 exact keys; both origins, removed routes and declarations passed.`);
  return proof;
}

/** Require immutable published field authority before inspecting the actual installed v24 package. */
export function verifyPublishedFieldAuthority(fieldAuthority) {
  assert.ok(fieldAuthority && Array.isArray(fieldAuthority.captures) && Array.isArray(fieldAuthority.attachments), 'Missing verified published field authority');
  assert.ok(fieldAuthority.index && Array.isArray(fieldAuthority.continuity), 'Published field authority lacks its pinned index or continuity receipt');
  assert.ok(fieldAuthority.attachments.every(item => item?.verified === true), 'Every field attachment must come from the verified attachment reader');
  for (const item of fieldAuthority.attachments) {
    assert.equal(evidenceSha256(evidenceJsonBytes(item.attachment)), item.descriptorSha256, `Field attachment descriptor bytes changed: ${item.attachment?.sourceRelease}`);
    assert.equal(evidenceSha256(evidenceJsonBytes(item.facts)), item.attachment?.factsSha256, `Field facts bytes changed: ${item.attachment?.sourceRelease}`);
  }
  validateFieldEvidenceIndex(fieldAuthority.index, fieldAuthority.attachments);
  const continuity = verifyPublishedFieldContinuity({ captures: fieldAuthority.captures, attachments: fieldAuthority.attachments });
  assert.deepEqual(fieldAuthority.continuity, continuity, 'Caller field continuity receipt differs from reverified attachments');
  const published23 = continuity.find(item => item.sourceRelease === 'lyra-ui@23.0.0');
  assert.ok(published23, 'Missing verified published v23 field facts');
  assert.equal(published23.facts.schemaVersion, 1);
  assert.equal(published23.facts.sourceVersion, '23.0.0');
  assert.equal(published23.facts.declarations.length, 10);
  assert.equal(published23.facts.exposures.length, 20);
  assert.equal(new Set(published23.facts.declarations.map(item => fieldDeclarationKey(item.key))).size, 10, 'Published v23 field declaration identities are not unique');
  assert.equal(new Set(published23.facts.exposures.map(item => fieldExposureKey(item.key))).size, 20, 'Published v23 field exposure identities are not unique');
  return published23.facts;
}

/** Check candidate package declarations and public type routes without deriving historical facts from v24. */
export async function verifyInstalledFieldDeclarations({ fixtureDir, facts, mode = 'retirement' }) {
  assert.ok(['pre-removal', 'retirement'].includes(mode), 'Unknown installed field proof mode');
  assert.equal(facts?.sourceRelease, 'lyra-ui@23.0.0', 'Candidate inspection requires published v23 authority');
  assert.equal(facts.declarations.length, 10); assert.equal(facts.exposures.length, 20);
  const installedRoot = join(fixtureDir, 'node_modules', '@aceshooting', 'lyra-ui');
  const packageJson = JSON.parse(await readFile(join(installedRoot, 'package.json'), 'utf8'));
  assert.equal(packageJson.name, packageName);
  assert.match(packageJson.version, /^24\.\d+\.\d+$/u, 'Field candidate must be the actually installed v24 package');
  const declarationByKey = new Map(facts.declarations.map(item => [fieldDeclarationKey(item.key), item]));
  const publicTypeRouteByDeclaration = new Map();
  const seenExposures = new Set();
  for (const exposure of facts.exposures) {
    const exposureKey = fieldExposureKey(exposure.key);
    assert.ok(!seenExposures.has(exposureKey), `Duplicate published field exposure ${exposureKey}`); seenExposures.add(exposureKey);
    const declaration = declarationByKey.get(fieldDeclarationKey(exposure.key.declaration));
    assert.ok(declaration, `Published exposure has no verified declaration ${exposureKey}`);
    if (!publicTypeRouteByDeclaration.has(fieldDeclarationKey(declaration.key))) {
      publicTypeRouteByDeclaration.set(fieldDeclarationKey(declaration.key), exposure.key.tag);
    }
    assert.equal(exposure.role, exposure.key.event.endsWith('-request') ? 'request' : 'settled', `Published event role drift: ${exposureKey}`);
    const typeRoute = await readInstalledPackagePath(installedRoot, exposure.publicDeclarationPath);
    const runtimeRoute = await readInstalledPackagePath(installedRoot, exposure.publicRuntimePath);
    const tagExport = packageJson.exports?.[`./components/${exposure.key.tag}.js`];
    assert.ok(tagExport && typeof tagExport === 'object', `Installed package lacks public registration export for ${exposure.key.tag}`);
    assert.equal(tagExport.types, `./${exposure.publicDeclarationPath.slice('package/'.length)}`, `Installed type route changed for ${exposure.key.tag}`);
    assert.equal(tagExport.default, `./${exposure.publicRuntimePath.slice('package/'.length)}`, `Installed runtime route changed for ${exposure.key.tag}`);
    assert.ok(runtimeRoute.length > 0, `Installed runtime route is empty: ${exposure.publicRuntimePath}`);
    const emitterDeclaration = await readInstalledPackagePath(installedRoot, exposure.emitterPackedPath.replace(/\.js$/u, '.d.ts'));
    const eventType = new RegExp(`['\"]${escapeRegExp(exposure.key.event)}['\"]\\s*:\\s*CustomEvent<${escapeRegExp(exposure.key.declaration.detailType)}>`,'u');
    assert.match(emitterDeclaration, eventType, `Installed event map lost ${exposure.key.tag}/${exposure.key.event}`);
  }
  assert.equal(seenExposures.size, 20, 'Candidate exposure set is incomplete');

  const candidateFields = [];
  for (const declaration of facts.declarations) {
    const dts = await readInstalledPackagePath(installedRoot, `package/dist/components/${declaration.key.module.replace(/\.ts$/u, '.d.ts')}`);
    const interfaceBody = findTypeScriptInterface(dts, declaration.key.detailType);
    const canonical = readBooleanField(interfaceBody, 'expanded');
    assert.equal(canonical.type, declaration.expandedField.type);
    assert.equal(canonical.optional, declaration.expandedField.optional);
    assert.equal(canonical.readonly, declaration.expandedField.readonly);
    const legacy = findBooleanField(interfaceBody, declaration.key.field);
    if (mode === 'pre-removal') {
      assertInstalledRetainedField(interfaceBody, declaration);
    } else assert.equal(legacy, null, `Retirement proof found old field ${declaration.key.detailType}.${declaration.key.field}`);
    candidateFields.push({ key: declaration.key, canonical: 'expanded', alias: legacy ? 'retained-in-pre-removal-proof' : 'absent' });
  }
  const typeFixture = join(fixtureDir, `migration-v24/field-types-${mode}.ts`);
  await mkdir(join(fixtureDir, 'migration-v24'), { recursive: true });
  const imports = facts.declarations.map(item => {
    const tag = publicTypeRouteByDeclaration.get(fieldDeclarationKey(item.key));
    assert.ok(tag, `Published field declaration has no public type route: ${fieldDeclarationKey(item.key)}`);
    return `import type { ${item.key.detailType} } from '${packageName}/components/${tag}.js';`;
  }).join('\n');
  const declarationChecks = facts.declarations.map((item, index) => {
    const canonicalType = item.expandedField.optional ? 'boolean | undefined' : 'boolean';
    const fieldRead = `const canonical${index}: ${canonicalType} = detail${index}.expanded;`;
    const absent = mode === 'retirement' ? `\n// @ts-expect-error retired event-detail alias must be absent\nvoid detail${index}.${item.key.field};` : '';
    return `declare const detail${index}: ${item.key.detailType};\n${fieldRead}${absent}`;
  }).join('\n');
  const registrationImports = [...new Set(facts.exposures.map(item => item.key.tag))].map(tag => `import '@aceshooting/lyra-ui/components/${tag}.js';`).join('\n');
  const exposureChecks = facts.exposures.map((item, index) => {
    const absent = mode === 'retirement' ? `\n// @ts-expect-error retired event-detail alias must be absent\nvoid event${index}.detail.${item.key.declaration.field};` : '';
    const declaration = declarationByKey.get(fieldDeclarationKey(item.key.declaration));
    const canonicalType = declaration.expandedField.optional ? 'boolean | undefined' : 'boolean';
    return `document.createElement('${item.key.tag}').addEventListener('${item.key.event}', (event${index}) => {\n  const canonical${facts.declarations.length + index}: ${canonicalType} = event${index}.detail.expanded;${absent}\n});`;
  }).join('\n');
  await writeFile(typeFixture, `${registrationImports}\n${imports}\n${declarationChecks}\n${exposureChecks}\n`);
  const config = join(fixtureDir, `migration-v24/field-types-${mode}-tsconfig.json`);
  await writeFile(config, json({ extends: '../tsconfig.json', include: [`field-types-${mode}.ts`] }));
  await runMigrationProcess(join(fixtureDir, 'node_modules', '.bin', binName('tsc')), ['--noEmit', '--skipLibCheck', 'false', '-p', config], fixtureDir);
  return { sourceRelease: facts.sourceRelease, mode, authority: 'verified-published-continuity', declarations: 10, exposures: 20,
    fieldExposureKeys: facts.exposures.map(item => item.key),
    exposureRows: facts.exposures.map(({ key, role, relation }) => ({
      key, role, relation,
      canonicalOptional: declarationByKey.get(fieldDeclarationKey(key.declaration)).expandedField.optional,
    })),
    candidateFields, typeFixture: relative(fixtureDir, typeFixture).split(sep).join('/') };
}

async function readInstalledPackagePath(installedRoot, packagePath) {
  assert.equal(typeof packagePath, 'string');
  assert.ok(packagePath.startsWith('package/'), `Field authority path is outside the package namespace: ${packagePath}`);
  const file = resolve(installedRoot, packagePath.slice('package/'.length));
  assert.ok(file.startsWith(`${resolve(installedRoot)}${sep}`), `Unsafe installed package path: ${packagePath}`);
  return await readFile(file, 'utf8');
}

function findTypeScriptInterface(source, name) {
  const match = new RegExp(`\\bexport\\s+interface\\s+${escapeRegExp(name)}\\b(?:\\s+extends\\s+[^\\{]+)?\\s*\\{`, 'u').exec(source);
  assert.ok(match, `Installed declaration lacks exported interface ${name}`);
  let index = match.index + match[0].length; let depth = 1;
  for (; index < source.length && depth > 0; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') depth -= 1;
  }
  assert.equal(depth, 0, `Unclosed installed interface ${name}`);
  return source.slice(match.index + match[0].length, index - 1);
}

function findBooleanField(interfaceBody, field) {
  const pattern = new RegExp(`(?<readonly>readonly\\s+)?\\b${escapeRegExp(field)}(?<optional>\\?)?\\s*:\\s*(?<type>[A-Za-z_$][\\w$]*)\\s*;`, 'gu');
  const matches = [...interfaceBody.matchAll(pattern)];
  assert.ok(matches.length <= 1, `Installed detail interface repeats ${field}`);
  if (!matches.length) return null;
  const match = matches[0];
  const previous = interfaceBody.slice(0, match.index);
  const docStart = previous.lastIndexOf('/**'); const docEnd = previous.lastIndexOf('*/');
  const notice = docStart >= 0 && docEnd > docStart && /^\s*$/u.test(previous.slice(docEnd + 2)) ? previous.slice(docStart, docEnd + 2).trim() : null;
  return { shape: { type: match.groups.type, optional: Boolean(match.groups.optional), readonly: Boolean(match.groups.readonly) }, notice };
}
function readBooleanField(interfaceBody, field) {
  const found = findBooleanField(interfaceBody, field);
  assert.ok(found, `Installed detail interface lacks canonical ${field}`);
  assert.equal(found.shape.type, 'boolean', `Installed detail field ${field} must be boolean`);
  return found.shape;
}
export function assertInstalledRetainedField(interfaceBody, declaration) {
  const legacy = findBooleanField(interfaceBody, declaration.key.field);
  assert.ok(legacy, `Pre-removal canonical proof expected the published field ${declaration.key.detailType}.${declaration.key.field}`);
  const { type, optional, readonly } = declaration.deprecatedField;
  assert.deepEqual(legacy.shape, { type, optional, readonly }, `Retained candidate field shape changed: ${declaration.key.detailType}.${declaration.key.field}`);
  assert.equal(normalizeFieldNotice(legacy.notice), declaration.notice, `Retained candidate notice changed: ${declaration.key.detailType}.${declaration.key.field}`);
  assert.ok(legacy.notice?.includes('@deprecated'), `Retained field lost its deprecation notice: ${declaration.key.detailType}.${declaration.key.field}`);
}
function normalizeFieldNotice(value) {
  return value?.replace(/^\/\*\*|\*\/$/gu, '').replace(/^\s*\*\s?/gmu, '').replace(/\s+/gu, ' ').trim() ?? null;
}
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'); }

export async function writeResolvedMigrationEntry({ fixtureDir, proof, entry = 'migratedX' }) {
  assertBrowserProof(proof);
  const installed = JSON.parse(await readFile(join(fixtureDir, 'node_modules', '@aceshooting', 'lyra-ui', 'package.json'), 'utf8'));
  assert.equal(installed.version, proof.packageVersion, 'Browser fixture and CLI fixture package versions differ');
  const browserSource = await readFile(join(fixtures, proof.stage === 'actual24' ? 'v24-browser.ts' : 'x-browser.ts'), 'utf8');
  if (proof.stage === 'all-retirements' || proof.stage === 'actual24') {
    await copyFile(join(fixtures, 'family-browser.ts'), join(fixtureDir, 'src', 'migration-families.ts'));
    await copyFile(join(fixtures, 'family-negative.ts'), join(fixtureDir, 'src', 'migration-family-types.ts'));
  }
  if (proof.stage === 'actual24') {
    assert.ok(proof.fieldExposureProof && proof.fieldExposureProof.exposures === 20, 'Actual v24 proof lacks separate field exposure evidence');
    await copyFile(join(fixtures, 'v24-field-browser.ts'), join(fixtureDir, 'src', 'v24-field-browser.ts'));
    await writeFile(join(fixtureDir, 'src', 'v24-field-config.ts'), `export const fieldProofConfig = ${JSON.stringify({ mode: proof.fieldExposureProof.mode, exposures: proof.fieldExposureProof.exposureRows })} as const;\n`);
  }
  const additionalImports = proof.stage === 'actual24'
    ? "\nawait import('./migration-families.js');\nawait import('./v24-field-browser.js');\n"
    : proof.stage === 'all-retirements' ? "\nawait import('./migration-families.js');\n" : '';
  await writeFile(join(fixtureDir, 'src', `bundle-${entry}.ts`), browserSource + additionalImports);
  if (proof.stage === 'all-retirements' || proof.stage === 'actual24') {
    const config = join(fixtureDir, 'migration-browser-tsconfig.json');
    await writeFile(config, json({ extends: './tsconfig.json', include: [`src/bundle-${entry}.ts`, 'src/migration-families.ts', 'src/migration-family-types.ts', ...(proof.stage === 'actual24' ? ['src/v24-field-browser.ts', 'src/v24-field-config.ts'] : [])] }));
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
      if (pathname === '/') {
        const legacyPreference = proof.stage === 'actual24'
          ? `<script>localStorage.setItem('lyra-theme', ${JSON.stringify(JSON.stringify({ mode: 'auto', accent: 'aquamarine', surface: 'aquamarine', tokens: { '--lr-theme-color-surface': '#fff' } }))})</script>`
          : '';
        response.writeHead(200, { 'Content-Type': 'text/html' }).end(`<!doctype html><html lang="en"><title>Migrated consumer</title><body>${legacyPreference}<script type="module" src="./index.js"></script></body></html>`); return;
      }
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
        const context = await browser.newContext({ viewport: proof.stage === 'actual24' ? { width: 390, height: 800 } : { width: 1000, height: 800 }, reducedMotion: 'reduce' });
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
        const expectedViewers = proof.stage === 'actual24' ? ['lr-geojson-viewer'] : ['lr-geojson-viewer', 'consumer-geojson-view'];
        await page.waitForFunction(ids => ids.every(id => {
          const root = document.getElementById(id)?.shadowRoot;
          return root?.querySelector('[part="metadata"]')?.textContent?.includes('Consumer feature 2') && root.querySelector('[part="status"]')?.textContent?.includes('2');
        }), expectedViewers, { timeout: 60000 });
        if (proof.stage === 'all-retirements' || proof.stage === 'actual24') await page.waitForFunction(() => Boolean(document.documentElement.dataset.migrationFamilies), null, { timeout: 90000 });
        if (proof.stage === 'actual24') await page.waitForFunction(() => Boolean(document.documentElement.dataset.migrationFieldsProof), null, { timeout: 90000 });
        const familyScenarios = await page.evaluate(() => JSON.parse(document.documentElement.dataset.migrationFamilies ?? '[]'));
        assert.deepEqual(familyScenarios, proof.stage === 'all-retirements' || proof.stage === 'actual24' ? FAMILY_SCENARIOS : []);
        const fieldBrowserProof = proof.stage === 'actual24'
          ? await page.evaluate(() => JSON.parse(document.documentElement.dataset.migrationFieldsProof ?? 'null'))
          : null;
        if (proof.stage === 'actual24') {
          assert.equal(fieldBrowserProof.mode, proof.fieldExposureProof.mode);
          assert.equal(fieldBrowserProof.exposures.length, 20);
          assert.deepEqual(fieldBrowserProof.exposures.map(item => fieldExposureKey(item)).sort(), proof.fieldExposureProof.fieldExposureKeys.map(fieldExposureKey).sort());
        }
        const state = await page.evaluate(() => ({ oldTagDefined: Boolean(customElements.get('lr-geojson-view')),
          viewers: ['lr-geojson-viewer', 'consumer-geojson-view'].filter(id => document.getElementById(id)).map(id => {
            const element = document.getElementById(id); const metadata = element.shadowRoot.querySelector('[part="metadata"]');
            return { id, features: JSON.parse(metadata.textContent).features.length, visible: metadata.getBoundingClientRect().height > 0 };
          }) }));
        assert.equal(state.oldTagDefined, false);
        assert.equal(state.viewers.length, expectedViewers.length, `${name}: canonical viewer count differs`);
        assert.ok(state.viewers.every(viewer => viewer.features === 2 && viewer.visible));
        assert.deepEqual(errors, [], `${name}: unexpected console/network errors`);
        await writeFile(join(artifactsDir, `${name}.json`), json({ packageVersion: proof.packageVersion, tarballSha256: proof.tarballSha256, stage: proof.stage, familyScenarios, fieldBrowserProof, ...state }));
        console.log(`Packed migrated consumer ${name}: ${state.viewers.length} canonical GeoJSON viewer(s) render two features; retired tag absent; ${familyScenarios.length} family scenarios passed.`);
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
  assert.ok(['exports-and-geojson', 'all-retirements', 'actual24'].includes(proof.stage), 'Unknown consumer stage');
  assert.equal(proof.coveredKeys.length, proof.stage === 'actual24' ? 1053 : proof.stage === 'all-retirements' ? 399 : 9, 'Incomplete browser cohort');
  assert.equal(new Set(proof.coveredKeys.map(compatibilityKey)).size, proof.coveredKeys.length, 'Duplicate browser identity');
}
