import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { collectEvidence, parseAudit, patchRegistrations, sha256, validateMitigations } from './check-dependency-security.mjs';

const mitigations = JSON.parse(await readFile(new URL('./fixtures/dependency-security.json', import.meta.url)));
const advisory = (entry) => ({
  github_advisory_id: entry.advisory, module_name: entry.package, severity: 'high',
  findings: [{ version: entry.version, paths: [`application>${entry.package}`] }],
});
const report = (advisories) => JSON.stringify({
  advisories: Object.fromEntries(advisories.map((entry, index) => [index, entry])),
  metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: advisories.length, critical: 0 } },
});
const mitigationEvidence = (entry) => ({
  advisory: entry.advisory, package: entry.package, version: entry.version,
  registration: entry.patch, patchSha256: entry.patchSha256,
  scannerCorrespondence: true, installed: [{ version: entry.version, files: { ...entry.files } }],
});
const evidence = () => mitigations.map(mitigationEvidence);

test('accepts exact verified patches while retaining registry advisory counts', () => {
  const advisories = parseAudit(report(mitigations.map(advisory)), 1);
  assert.deepEqual(validateMitigations(advisories, mitigations, evidence()), { unmitigated: 0, patched: advisories.length });
  assert.deepEqual(parseAudit(report([]), 0), []);
});

test('verifies retained patches when the registry no longer reports their advisory', () => {
  const active = mitigations.filter((entry) => entry.package !== 'sprintf-js').map(advisory);
  assert.deepEqual(validateMitigations(active, mitigations, evidence()), { unmitigated: 0, patched: active.length });
  assert.deepEqual(validateMitigations([], mitigations, evidence()), { unmitigated: 0, patched: 0 });
});

test('rejects new advisories and every finding of an unexpected version', () => {
  const changed = mitigations.map(advisory);
  changed[0].github_advisory_id = 'GHSA-new-advisory';
  assert.throws(() => validateMitigations(changed, mitigations, evidence()), /Unmitigated/);
  const versions = mitigations.map(advisory);
  versions[0].findings.push({ version: '3.0.2', paths: ['application>braces'] });
  assert.throws(() => validateMitigations(versions, mitigations, evidence()), /Unmitigated/);
  versions[0].findings.reverse();
  assert.throws(() => validateMitigations(versions, mitigations, evidence()), /Unmitigated/);
});

for (const change of [
  (proof) => { proof.registration = undefined; },
  (proof) => { proof.registration = 'patches/different.patch'; },
  (proof) => { proof.patchSha256 = 'changed'; },
  (proof) => { proof.installed = []; },
  (proof) => { proof.installed[0].version = '0.0.0'; },
  (proof) => { proof.installed[0].files = {}; },
  (proof) => { proof.installed[0].files[Object.keys(proof.installed[0].files)[0]] = 'changed'; },
  (proof) => { proof.installed.push({ version: '0.0.0', files: {} }); },
  (proof) => { proof.scannerCorrespondence = false; },
]) {
  test(`rejects incomplete or changed patch evidence: ${change.toString()}`, () => {
    const proof = evidence();
    change(proof[0]);
    assert.throws(() => validateMitigations(mitigations.map(advisory), mitigations, proof));
    // Patch evidence is mandatory even when the registry no longer reports the advisory.
    assert.throws(() => validateMitigations([], mitigations, proof));
  });
}

test('fails closed on audit errors, malformed responses, and inconsistent totals', () => {
  for (const [stdout, status] of [
    ['', 1], ['not json', 0], ['{}', 0], ['[]', 0], ['null', 0],
    [JSON.stringify({ error: { code: 'ENETUNREACH' } }), 1],
    [report([]), 2], [report([]), null], [report([]), 1],
    [report(mitigations.map(advisory)), 0],
    [report([{ ...advisory(mitigations[0]), findings: [] }]), 1],
    [report([{ ...advisory(mitigations[0]), findings: [{ version: '3.0.3', paths: [] }] }]), 1],
    [report([{ ...advisory(mitigations[0]), severity: 'unknown' }]), 1],
    [report([]).replace('"high":0', '"high":1'), 0],
  ]) assert.throws(() => parseAudit(stdout, status));
});

test('reads only exact patch registrations and rejects unsupported mappings', () => {
  assert.deepEqual(patchRegistrations("packages:\n  - 'packages/*'\npatchedDependencies:\n  braces@3.0.3: patches/braces@3.0.3.patch\noverrides:\n  braces: 3.0.3\n"), {
    'braces@3.0.3': 'patches/braces@3.0.3.patch',
  });
  assert.throws(() => patchRegistrations('packages: []\n'));
  assert.throws(() => patchRegistrations('patchedDependencies:\n  braces: { path: patch }\n'));
});


test('checks reachable installed sources and ignores unused virtual-store copies', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-dependency-security-'));
  try {
    const entry = {
      advisory: 'GHSA-test', package: 'braces', version: '3.0.3', patch: 'patches/braces.patch',
      patchSha256: sha256('reviewed patch'), files: { 'index.js': sha256('patched source') },
    };
    await mkdir(join(root, 'packages'));
    await mkdir(join(root, 'patches'));
    const store = join(root, 'node_modules/.pnpm/host/node_modules');
    await mkdir(join(store, 'host'), { recursive: true });
    await writeFile(join(store, 'host/package.json'), JSON.stringify({ name: 'host', version: '1.0.0' }));
    await symlink(join(store, 'host'), join(root, 'node_modules/host'));
    await mkdir(join(store, 'braces'));
    await writeFile(join(store, 'braces/package.json'), JSON.stringify({ name: 'braces', version: '3.0.3' }));
    await writeFile(join(store, 'braces/index.js'), 'patched source');
    await mkdir(join(root, 'node_modules/.pnpm/unused/node_modules/braces'), { recursive: true });
    await writeFile(join(root, 'node_modules/.pnpm/unused/node_modules/braces/package.json'),
      JSON.stringify({ name: 'braces', version: '3.0.2' }));
    await writeFile(join(root, entry.patch), 'reviewed patch');
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'patchedDependencies:\n  braces@3.0.3: patches/braces.patch\n');
    await writeFile(join(root, 'osv-scanner.toml'),
      '[[IgnoredVulns]]\nid = "GHSA-test"\nreason = "Verified patches/braces.patch"\n');
    const proof = await collectEvidence(root, [entry]);
    assert.equal(proof[0].installed.length, 1);
    assert.deepEqual(validateMitigations([advisory(entry)], [entry], proof), { unmitigated: 0, patched: 1 });
    await writeFile(join(store, 'braces/index.js'), 'unpatched source');
    const changed = await collectEvidence(root, [entry]);
    assert.throws(() => validateMitigations([advisory(entry)], [entry], changed), /Unverified installed/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('vendored SheetJS retains exact bytes, package identity and development-only registration', async () => {
  const { verifyVendoredSheetJs } = await import('./check-dependency-security.mjs');
  const root = new URL('../', import.meta.url);
  await verifyVendoredSheetJs(root);
  const manifest = JSON.parse(await readFile(new URL('packages/lyra-ui/package.json', root)));
  for (const change of [
    value => { value.devDependencies.xlsx = 'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz'; },
    value => { value.peerDependencies.xlsx = '*'; },
    value => { value.peerDependenciesMeta.xlsx.optional = false; },
  ]) {
    const altered = structuredClone(manifest); change(altered);
    await assert.rejects(verifyVendoredSheetJs(root, { manifest: altered }));
  }
  await assert.rejects(verifyVendoredSheetJs(root, { bytes: Buffer.from('tampered archive') }));
});

test('explicit SheetJS advisory response rejects vulnerabilities and malformed registry data', async () => {
  const { parseSheetJsAdvisories } = await import('./check-dependency-security.mjs');
  assert.deepEqual(parseSheetJsAdvisories({}), []);
  assert.deepEqual(parseSheetJsAdvisories({ xlsx: [] }), []);
  for (const value of [null, [], { error: 'unavailable' }, { xlsx: {} }, { other: [] }, { xlsx: [null] },
    { xlsx: [{ id: 1, name: 'xlsx', severity: 'high', vulnerable_versions: '<1', title: 'vulnerability', url: 'https://example.com' }] }]) {
    assert.throws(() => parseSheetJsAdvisories(value));
  }
});

test('explicit SheetJS audit sends exact installed version and bounds response failures', async () => {
  const { auditSheetJs } = await import('./check-dependency-security.mjs');
  const request = async (url, options) => {
    assert.equal(url, 'https://registry.npmjs.org/-/npm/v1/security/advisories/bulk');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { xlsx: ['0.20.3'] });
    assert.ok(options.signal instanceof AbortSignal);
    return new Response('{}');
  };
  await auditSheetJs(request);
  for (const response of [new Response('unavailable', { status: 503 }), new Response('not-json'),
    new Response(' '.repeat(1024 * 1024 + 1)), new Response('{"xlsx":[{}]}')]) {
    await assert.rejects(auditSheetJs(async () => response));
  }
  await assert.rejects(auditSheetJs(async () => { throw new Error('network failure'); }));
});

test('dependency upgrades preserve the manually reviewed SheetJS development archive and peer floor', async () => {
  const script = await readFile(new URL('./upgrade.sh', import.meta.url), 'utf8');
  const passes = script.split('pnpm dlx npm-check-updates@latest').slice(1);
  for (const scope of ['prod,dev,optional,packageManager', 'peer']) {
    const pass = passes.find(value => value.includes(`--dep ${scope} `));
    assert.ok(pass, `Missing dependency upgrade pass ${scope}`);
    const rejected = pass.match(/--reject ([^\n]+)/u)?.[1].trim().replace(/\s*\\$/u, '').split(',');
    assert.ok(rejected?.includes('xlsx'), `The ${scope} pass must preserve the reviewed SheetJS identity`);
  }
});


function multiversionMitigations() {
  return ['2.3.2', '4.0.7'].map(version => ({
    advisory: 'GHSA-test-shared', package: 'picomatch', version,
    patch: `patches/picomatch@${version}.patch`,
    patchSha256: sha256(`reviewed patch ${version}`),
    files: { 'lib/parse.js': sha256(`patched source ${version}`) },
  }));
}

const multiversionAdvisory = entries => ({
  ...advisory(entries[0]),
  findings: entries.map(entry => ({ version: entry.version, paths: [`application>${entry.package}@${entry.version}`] })),
});

test('accepts independently proved versions of one advisory in either finding and proof order', () => {
  const entries = multiversionMitigations();
  for (const ordered of [entries, [...entries].reverse()]) {
    const findings = parseAudit(report([multiversionAdvisory(ordered)]), 1);
    assert.deepEqual(validateMitigations(findings, entries, [...ordered].reverse().map(mitigationEvidence)),
      { unmitigated: 0, patched: 1 }, 'patched counts registry advisory records, not version findings');
  }
  assert.deepEqual(validateMitigations([], entries, entries.map(mitigationEvidence)), { unmitigated: 0, patched: 0 });
});

test('requires the exact package as well as advisory and version evidence identity', () => {
  const entry = multiversionMitigations()[0];
  for (const field of ['package', 'version']) {
    const proof = mitigationEvidence(entry);
    proof[field] = 'unexpected';
    assert.throws(() => validateMitigations([advisory(entry)], [entry], [proof]));
    delete proof[field];
    assert.throws(() => validateMitigations([], [entry], [proof]));
  }
});

test('rejects a missing version proof even when another version proves the same advisory', () => {
  const entries = multiversionMitigations();
  assert.throws(() => validateMitigations([multiversionAdvisory(entries)], entries,
    [mitigationEvidence(entries[0])]), /Missing or changed patch/);
});

test('rejects duplicate exact mitigation identities even when the registry reports no advisory', () => {
  const entry = multiversionMitigations()[0];
  assert.throws(() => validateMitigations([], [entry, { ...entry }], [mitigationEvidence(entry)]),
    /Duplicate mitigation/);
});

test('rejects duplicate or unmatched version proofs instead of accepting the first match', () => {
  const entries = multiversionMitigations();
  const proofs = entries.map(mitigationEvidence);
  assert.throws(() => validateMitigations([], entries, [...proofs, mitigationEvidence(entries[0])]),
    /Duplicate patch evidence/);
  assert.throws(() => validateMitigations([], entries,
    [...proofs, { ...mitigationEvidence(entries[0]), version: '4.0.6' }]), /Unexpected patch evidence/);
});

test('rejects every unreviewed version finding without weakening either supported version', () => {
  const entries = multiversionMitigations();
  const known = multiversionAdvisory(entries);
  for (const version of ['4.0.6', '2.3.1', '4.0.8', '']) {
    const unknown = { version, paths: ['application>picomatch'] };
    for (const findings of [[unknown, ...known.findings], [...known.findings, unknown]]) {
      assert.throws(() => validateMitigations([{ ...known, findings }], entries, entries.map(mitigationEvidence)));
    }
  }
});

test('verifies each version patch, installed digest and scanner reference even after audit withdrawal', () => {
  const entries = multiversionMitigations();
  for (const change of [
    proof => { proof.registration = entries[0].patch; },
    proof => { proof.patchSha256 = entries[0].patchSha256; },
    proof => { proof.installed[0].files['lib/parse.js'] = entries[0].files['lib/parse.js']; },
    proof => { proof.scannerCorrespondence = false; },
  ]) {
    const proofs = entries.map(mitigationEvidence);
    change(proofs[1]);
    assert.throws(() => validateMitigations([multiversionAdvisory(entries)], entries, proofs));
    assert.throws(() => validateMitigations([], entries, proofs));
  }
});

test('verifies every reachable physical copy within an exact-version proof', () => {
  const entry = multiversionMitigations()[0];
  const proof = mitigationEvidence(entry);
  proof.installed.push({ version: entry.version, files: { ...entry.files } });
  assert.deepEqual(validateMitigations([advisory(entry)], [entry], [proof]), { unmitigated: 0, patched: 1 });
  proof.installed[1].files['lib/parse.js'] = sha256('unpatched second physical copy');
  assert.throws(() => validateMitigations([advisory(entry)], [entry], [proof]), /Unverified installed/);
});

test('collects separate reachable versions with their own source digests and scanner patch references', async () => {
  const root = await mkdtemp(join(tmpdir(), 'lyra-dependency-security-versions-'));
  const entries = multiversionMitigations();
  try {
    await mkdir(join(root, 'packages'));
    await mkdir(join(root, 'patches'));
    const installed = new Map();
    for (const [index, entry] of entries.entries()) {
      const name = `host-${index}`;
      const store = join(root, 'node_modules/.pnpm', name, 'node_modules');
      await mkdir(join(store, name), { recursive: true });
      await writeFile(join(store, name, 'package.json'), JSON.stringify({ name, version: '1.0.0' }));
      await symlink(join(store, name), join(root, 'node_modules', name));
      const packageRoot = join(store, entry.package);
      await mkdir(join(packageRoot, 'lib'), { recursive: true });
      await writeFile(join(packageRoot, 'package.json'), JSON.stringify({ name: entry.package, version: entry.version }));
      await writeFile(join(packageRoot, 'lib/parse.js'), `patched source ${entry.version}`);
      await writeFile(join(root, entry.patch), `reviewed patch ${entry.version}`);
      installed.set(entry.version, packageRoot);
    }
    await writeFile(join(root, 'pnpm-workspace.yaml'), 'patchedDependencies:\n' +
      entries.map(entry => `  ${entry.package}@${entry.version}: ${entry.patch}\n`).join(''));
    const scanner = paths => '[[IgnoredVulns]]\nid = "GHSA-test-shared"\nreason = "Verified ' + paths.join(' and ') + '"\n';
    await writeFile(join(root, 'osv-scanner.toml'), scanner(entries.map(entry => entry.patch)));
    const proofs = await collectEvidence(root, entries);
    for (const entry of entries) {
      const proof = proofs.find(value => value.advisory === entry.advisory &&
        value.package === entry.package && value.version === entry.version);
      assert.ok(proof, `missing exact collected identity ${entry.package}@${entry.version}`);
      assert.deepEqual(proof.installed, [{ version: entry.version, files: { ...entry.files } }]);
      assert.equal(proof.registration, entry.patch);
      assert.equal(proof.patchSha256, entry.patchSha256);
      assert.equal(proof.scannerCorrespondence, true);
    }
    assert.deepEqual(validateMitigations([multiversionAdvisory(entries)], entries, proofs), { unmitigated: 0, patched: 1 });
    await writeFile(join(installed.get(entries[1].version), 'lib/parse.js'), 'unpatched second version');
    const changed = await collectEvidence(root, entries);
    assert.throws(() => validateMitigations([], entries, changed), /Unverified installed/);
    await writeFile(join(installed.get(entries[1].version), 'lib/parse.js'), `patched source ${entries[1].version}`);
    await writeFile(join(root, 'osv-scanner.toml'), scanner([entries[0].patch]));
    const missingReference = await collectEvidence(root, entries);
    assert.equal(missingReference[0].scannerCorrespondence, true);
    assert.equal(missingReference[1].scannerCorrespondence, false);
    assert.throws(() => validateMitigations([], entries, missingReference), /Missing scanner patch reference/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
