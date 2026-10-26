import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');

test('release checkouts bind directly to the main dispatch commit before using dependency caches', () => {
  const workflow = read('.github/workflows/release.yml');
  const plan = workflow.slice(workflow.indexOf('\n  plan:\n'), workflow.indexOf('\n  pack:\n'));
  const pack = workflow.slice(workflow.indexOf('\n  pack:\n'), workflow.indexOf('\n  release:\n'));
  const release = workflow.slice(workflow.indexOf('\n  release:\n'));

  assert.match(plan, /if: \$\{\{ github\.ref == 'refs\/heads\/main' \}\}/);
  assert.match(plan, /"\$GITHUB_REF" != "refs\/heads\/main"/);
  assert.match(plan, /echo "sha=\$GITHUB_SHA" >> "\$GITHUB_OUTPUT"/);
  assert.match(plan, /sha: \$\{\{ steps\.source\.outputs\.sha \}\}/);
  assert.match(plan, /SHA: \$\{\{ steps\.source\.outputs\.sha \}\}/);
  assert.match(pack, /needs: plan/);
  assert.doesNotMatch(pack, /\bif:/);
  for (const job of [plan, pack]) {
    const checkouts = [...job.matchAll(/uses: actions\/checkout@[^\n]+\n\s+with:\n([\s\S]*?)(?=\n\s{6}-|$)/g)];
    assert.equal(checkouts.length, 1);
    assert.match(checkouts[0][1], /ref: \$\{\{ github\.sha \}\}/);
    assert.match(checkouts[0][1], /persist-credentials: false/);
    assert.doesNotMatch(job, /contents: write|actions: write|id-token: write/);
  }
  assert.match(release, /needs: \[plan, pack\]/);
  assert.match(release, /SHA: \$\{\{ needs\.plan\.outputs\.sha \}\}/);
  assert.doesNotMatch(release, /actions\/checkout@|cache:|pnpm |scripts\//);
});

test('publishing uses the verified bundled npm CLI without installing packages', () => {
  const workflow = read('.github/workflows/publish.yml');
  const step = workflow.indexOf('      - name: Update npm CLI (trusted publishing needs >=11.5.1)\n');
  assert.ok(step >= 0);
  const start = workflow.indexOf('        run: |\n', step) + '        run: |\n'.length;
  const lines = [];
  for (const line of workflow.slice(start).split('\n')) {
    if (line.startsWith('          ')) lines.push(line.slice(10));
    else if (line === '') lines.push('');
    else break;
  }
  const source = lines.join('\n');
  const fixture = mkdtempSync(path.join(tmpdir(), 'lyra-npm-cli-'));
  try {
    const systemTar = spawnSync('which', ['tar'], { encoding: 'utf8' }).stdout.trim();
    assert.ok(systemTar);
    const bin = path.join(fixture, 'bin');
    const writeExecutable = (name, script) => {
      const file = path.join(bin, name);
      writeFileSync(file, script);
      chmodSync(file, 0o755);
    };
    // Use a real archive and digest; only the download and pre-existing npm are substituted.
    const prepare = (version, name) => {
      const dir = path.join(fixture, name);
      const made = spawnSync('mkdir', ['-p', path.join(dir, 'package/bin'), bin]);
      assert.equal(made.status, 0);
      writeFileSync(path.join(dir, 'package/package.json'), JSON.stringify({ name: 'npm', version }));
      const cli = path.join(dir, 'package/bin/npm-cli.js');
      writeFileSync(cli, `#!/usr/bin/env node\nconst fs = require('node:fs');\nfs.appendFileSync(process.env.CLI_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');\nif (process.argv[2] === '--version') console.log(${JSON.stringify(version)});\n`);
      chmodSync(cli, 0o755);
      const archive = path.join(dir, 'npm.tgz');
      const packed = spawnSync(systemTar, ['-czf', archive, '-C', dir, 'package']);
      assert.equal(packed.status, 0);
      return { archive, integrity: `sha512-${createHash('sha512').update(readFileSync(archive)).digest('base64')}` };
    };
    const valid = prepare('12.0.1', 'valid');
    const wrongVersion = prepare('12.0.0', 'wrong-version');
    const tampered = path.join(fixture, 'tampered.tgz');
    writeFileSync(tampered, Buffer.concat([readFileSync(valid.archive), Buffer.from('tampered')]));
    writeExecutable('curl', '#!/usr/bin/env bash\ncp -- "$MOCK_NPM_ARCHIVE" npm.tgz\n');
    writeExecutable('npm', '#!/usr/bin/env bash\nprintf "%s\\n" "$*" >> "$GLOBAL_NPM_LOG"\nif [[ "$1" == --version ]]; then printf "12.0.1\\n"; fi\n');
    writeExecutable('tar', '#!/usr/bin/env bash\nprintf "extract\\n" >> "$EXTRACTION_LOG"\nexec "$SYSTEM_TAR" "$@"\n');
    const run = (name, archive, integrity) => {
      const cwd = path.join(fixture, name);
      assert.equal(spawnSync('mkdir', ['-p', cwd]).status, 0);
      const env = {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        RUNNER_TEMP: cwd,
        GITHUB_PATH: path.join(cwd, 'github-path'),
        CLI_LOG: path.join(cwd, 'cli-log'),
        GLOBAL_NPM_LOG: path.join(cwd, 'global-npm-log'),
        EXTRACTION_LOG: path.join(cwd, 'extraction-log'),
        SYSTEM_TAR: systemTar,
        MOCK_NPM_ARCHIVE: archive,
      };
      writeFileSync(env.GITHUB_PATH, '');
      const script = source.replace(/NPM_TARBALL_INTEGRITY='[^']+'/u, `NPM_TARBALL_INTEGRITY='${integrity}'`);
      const result = spawnSync('bash', ['-c', script], { cwd, env, encoding: 'utf8' });
      const contents = (file) => {
        try { return readFileSync(file, 'utf8'); } catch { return ''; }
      };
      return { result, env, cwd, path: contents(env.GITHUB_PATH), cli: contents(env.CLI_LOG), global: contents(env.GLOBAL_NPM_LOG), extraction: contents(env.EXTRACTION_LOG) };
    };
    const corrupt = run('corrupt-run', tampered, valid.integrity);
    assert.notEqual(corrupt.result.status, 0);
    assert.equal(corrupt.extraction, '', 'mismatched bytes must never be extracted');
    assert.equal(corrupt.cli, '', 'mismatched bytes must never execute');
    assert.equal(corrupt.global, '');
    assert.equal(corrupt.path, '');
    const wrong = run('wrong-run', wrongVersion.archive, wrongVersion.integrity);
    assert.notEqual(wrong.result.status, 0, 'the extracted version must match the pin');
    assert.equal(wrong.path, '', 'a wrong version must not reach subsequent steps');
    assert.equal(wrong.global, '');
    const accepted = run('accepted-run', valid.archive, valid.integrity);
    assert.equal(accepted.result.status, 0, accepted.result.stderr);
    assert.equal(accepted.global, '', 'verified bytes must not be passed to a global installer');
    assert.equal(accepted.extraction, 'extract\n');
    assert.equal(accepted.cli, '["--version"]\n');
    assert.ok(accepted.path.trim(), 'subsequent steps must receive the bundled CLI');
    const handoff = spawnSync('npm', ['publish', 'fixture.tgz', '--access', 'public', '--dry-run'], {
      cwd: accepted.cwd,
      env: { ...accepted.env, PATH: `${accepted.path.trim()}:${accepted.env.PATH}` },
      encoding: 'utf8',
    });
    assert.equal(handoff.status, 0, handoff.stderr);
    assert.equal(readFileSync(accepted.env.CLI_LOG, 'utf8'), '["--version"]\n["publish","fixture.tgz","--access","public","--dry-run"]\n');
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('publish and recovery signing share one credential-free verification workflow', () => {
  const reusable = read('.github/workflows/release-verification.yml');
  const publish = read('.github/workflows/publish.yml');
  const sign = read('.github/workflows/sign-release.yml');

  for (const caller of [publish, sign]) {
    assert.match(
      caller,
      /verify:\n\s+uses: \.\/\.github\/workflows\/release-verification\.yml/
    );
    assert.match(caller, /tag: \$\{\{/);
    const protectedStart = Math.max(
      caller.indexOf('\n  publish:\n'),
      caller.indexOf('\n  sign:\n')
    );
    assert.ok(protectedStart > 0);
    const preProtected = caller.slice(0, protectedStart);
    assert.doesNotMatch(
      preProtected,
      /release-integrity\.mjs|pnpm install|actions\/checkout@/
    );
  }

  assert.match(reusable, /workflow_call:/);
  assert.match(reusable, /tag_sha:[\s\S]*tarball_sha256:/);
  assert.match(reusable, /permissions:\n\s+contents: read/);
  assert.match(reusable, /actions: read/);
  assert.match(reusable, /checks: read/);
  assert.doesNotMatch(
    reusable,
    /contents: write|id-token: write|attestations: write|environment:/
  );
  assert.match(
    reusable,
    /wait-ci[\s\S]*wait-test-all-browsers[\s\S]*wait-full-engine[\s\S]*wait-quality-tools[\s\S]*compare-rebuild/
  );
  assert.match(reusable, /actions\/upload-artifact@/);
});

test('first publication of a companion package uses a protected, provenance-bearing token path only for an absent package', () => {
  const release = read('.github/workflows/release.yml');
  const publish = read('.github/workflows/publish.yml');
  const plan = release.slice(release.indexOf('\n  plan:\n'), release.indexOf('\n  pack:\n'));
  const dispatch = release.slice(release.indexOf('      - name: Dispatch npm publish for each tag'));
  const protectedJob = publish.slice(publish.indexOf('\n  publish:\n'));
  const eligibility = protectedJob.slice(
    protectedJob.indexOf('      - name: Require an unpublished first-publication package for bootstrap after approval'),
    protectedJob.indexOf('      - name: Generate release provenance'),
  );
  const normalPublish = protectedJob.slice(
    protectedJob.indexOf('      - name: Publish to npm'),
    protectedJob.indexOf('      - name: Bootstrap first package publication with npm provenance'),
  );
  const bootstrapPublish = protectedJob.slice(
    protectedJob.indexOf('      - name: Bootstrap first package publication with npm provenance'),
  );

  assert.match(release, /first_package_bootstrap:\n\s+description: [^\n]+\n\s+required: false\n\s+type: boolean\n\s+default: false/u);
  assert.match(publish, /first_package_bootstrap:\n\s+description: [^\n]+\n\s+required: false\n\s+type: boolean\n\s+default: false/u);
  assert.match(plan, /"\$PACKAGE" =~ \^lyra-\(docs\|ide\|translations\|map\|3d\|gen\)\$[\s\S]*"\$TAGS" =~ \^lyra-\(docs\|ide\|translations\|map\|3d\|gen\)@/u);
  assert.match(plan, /"\$status" != 404/u);
  assert.match(dispatch, /-f first_package_bootstrap=true/u);
  assert.match(eligibility, /"\$GITHUB_EVENT_NAME" != workflow_dispatch \|\| "\$DRY_RUN" == true/u);
  assert.match(eligibility, /! "\$TAG" =~ \^lyra-\(docs\|ide\|translations\|map\|3d\|gen\)@/u);
  assert.match(eligibility, /"\$status" != 404/u);
  assert.match(normalPublish, /if: \$\{\{ inputs\.first_package_bootstrap != true \}\}/u);
  assert.doesNotMatch(normalPublish, /NODE_AUTH_TOKEN|NPM_BOOTSTRAP_TOKEN|--provenance/u);
  assert.match(bootstrapPublish, /if: \$\{\{ inputs\.first_package_bootstrap == true \}\}/u);
  assert.match(bootstrapPublish, /NODE_AUTH_TOKEN: \$\{\{ secrets\.NPM_BOOTSTRAP_TOKEN \}\}/u);
  assert.match(bootstrapPublish, /"\$status" != 404[\s\S]*npm publish "\$TARBALL" --access public --provenance/u);
  assert.match(bootstrapPublish, /EXPECTED_SHA256:[\s\S]*EXPECTED_TAG_SHA:[\s\S]*git ls-remote --tags[\s\S]*sha256sum/u);
  assert.equal((protectedJob.match(/secrets\.NPM_BOOTSTRAP_TOKEN/gu) ?? []).length, 1);
});

test('both bootstrap eligibility checks fail closed on registry and package ambiguity', () => {
  const stepScript = (source, name) => {
    const marker = `      - name: ${name}\n`;
    const step = source.indexOf(marker);
    assert.ok(step >= 0, `Missing ${name}`);
    const run = source.indexOf('        run: |\n', step);
    const start = run + '        run: |\n'.length;
    assert.ok(run > step, `Missing script for ${name}`);
    const lines = [];
    for (const line of source.slice(start).split('\n')) {
      if (line.startsWith('          ')) lines.push(line.slice(10));
      else if (line === '') lines.push('');
      else break;
    }
    return lines.join('\n');
  };
  const plan = stepScript(read('.github/workflows/release.yml'), 'Require an unpublished first-publication package for bootstrap');
  const publish = stepScript(read('.github/workflows/publish.yml'), 'Require an unpublished first-publication package for bootstrap after approval');
  const fixture = mkdtempSync(path.join(tmpdir(), 'lyra-docs-bootstrap-'));
  try {
    const curl = path.join(fixture, 'curl');
    writeFileSync(curl, '#!/usr/bin/env bash\nprintf "%s" "$MOCK_REGISTRY_STATUS"\n');
    chmodSync(curl, 0o755);
    const run = (script, vars = {}) => spawnSync('bash', ['-c', script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fixture}:${process.env.PATH}`,
        BOOTSTRAP: 'true',
        DRY_RUN: 'false',
        GITHUB_EVENT_NAME: 'workflow_dispatch',
        MOCK_REGISTRY_STATUS: '404',
        PACKAGE: 'lyra-docs',
        TAG: 'lyra-docs@0.1.1',
        TAGS: 'lyra-docs@0.1.1',
        ...vars,
      },
    });
    for (const script of [plan, publish]) {
      const accepted = run(script);
      assert.equal(accepted.status, 0, accepted.stderr);
      for (const status of ['200', '401', '403', '503', '']) {
        assert.equal(run(script, { MOCK_REGISTRY_STATUS: status }).status, 1, `HTTP ${status || 'empty'} must fail`);
      }
    }
    assert.equal(run(plan, { PACKAGE: 'lyra-ui' }).status, 1);
    assert.equal(run(plan, { PACKAGE: 'all', TAGS: 'lyra-map@1.0.0' }).status, 1);
    assert.equal(run(plan, { PACKAGE: 'lyra-map', TAGS: 'lyra-map@1.0.0 lyra-ui@29.0.0' }).status, 1);
    for (const tag of ['lyra-map@01.0.0', 'lyra-map@1.0.0-beta.1', 'lyra-map@1.0.0+meta']) {
      assert.equal(run(plan, { PACKAGE: 'lyra-map', TAGS: tag }).status, 1);
      assert.equal(run(publish, { TAG: tag }).status, 1);
    }
    for (const status of ['200', '401', '403', '503', '']) {
      assert.equal(run(plan, { PACKAGE: 'lyra-map', TAGS: 'lyra-map@1.0.0', MOCK_REGISTRY_STATUS: status }).status, 1);
      assert.equal(run(publish, { TAG: 'lyra-map@1.0.0', MOCK_REGISTRY_STATUS: status }).status, 1);
    }
    assert.equal(run(publish, { TAG: 'lyra-map@1.0.0', DRY_RUN: 'true' }).status, 1);
    assert.equal(run(publish, { TAG: 'lyra-map@1.0.0', GITHUB_EVENT_NAME: 'release' }).status, 1);
    assert.equal(run(plan, { TAGS: 'lyra-docs@0.1.1 lyra-ui@25.6.2' }).status, 1);
    assert.equal(run(publish, { TAG: 'lyra-ui@25.6.2' }).status, 1);
    for (const [name, version] of [['lyra-ide', '27.0.0'], ['lyra-translations', '27.0.0'], ['lyra-map', '1.0.0'], ['lyra-3d', '1.0.0'], ['lyra-gen', '0.1.0']]) {
      const vars = { PACKAGE: name, TAG: `${name}@${version}`, TAGS: `${name}@${version}` };
      assert.equal(run(plan, vars).status, 0);
      assert.equal(run(publish, vars).status, 0);
      assert.equal(run(plan, { ...vars, PACKAGE: 'lyra-docs' }).status, 1);
    }
    assert.equal(run(publish, { DRY_RUN: 'true' }).status, 1);
    assert.equal(run(publish, { GITHUB_EVENT_NAME: 'release' }).status, 1);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('publishing fails unless the registry serves the released tarball bytes', () => {
  const workflow = read('.github/workflows/publish.yml');
  const step = workflow.indexOf('      - name: Confirm the registry serves the published tarball\n');
  assert.ok(step >= 0);
  assert.match(workflow.slice(step, step + 400), /if: \$\{\{ github\.event_name == 'release' \|\| inputs\.dry_run != true \}\}/);
  const start = workflow.indexOf('        run: |\n', step) + '        run: |\n'.length;
  const lines = [];
  for (const line of workflow.slice(start).split('\n')) {
    if (line.startsWith('          ')) lines.push(line.slice(10));
    else if (line === '') lines.push('');
    else break;
  }
  const source = lines.join('\n');
  const fixture = mkdtempSync(path.join(tmpdir(), 'lyra-registry-confirm-'));
  try {
    const tarball = path.join(fixture, 'fixture.tgz');
    writeFileSync(tarball, 'released bytes');
    const released = `sha512-${createHash('sha512').update('released bytes').digest('base64')}`;
    const bin = path.join(fixture, 'bin');
    spawnSync('mkdir', ['-p', bin]);
    const writeExecutable = (name, script) => {
      const file = path.join(bin, name);
      writeFileSync(file, script);
      chmodSync(file, 0o755);
    };
    writeExecutable('curl', '#!/usr/bin/env bash\nif [[ "${CURL_FAIL:-}" == true ]]; then exit 22; fi\nprintf \'%s\' "$REGISTRY_BODY"\n');
    writeExecutable('sleep', '#!/usr/bin/env bash\nexit 0\n');
    const run = (body, extraEnv = {}) => spawnSync('bash', ['-c', source], {
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, RUNNER_TEMP: fixture, TAG: 'lyra-ui@1.2.3', TARBALL: tarball, REGISTRY_BODY: body, ...extraEnv },
    });

    const served = run(JSON.stringify({ dist: { integrity: released } }));
    assert.equal(served.status, 0, served.stderr);
    assert.match(served.stdout, /npm serves @aceshooting\/lyra-ui@1\.2\.3 with the released integrity/);

    const other = run(JSON.stringify({ dist: { integrity: 'sha512-other' } }));
    assert.equal(other.status, 1);
    assert.match(other.stdout, /not the released sha512-/);

    // A staged version never appears in the registry: the step must fail instead of finishing green.
    const staged = run('{"error":"Not found"}');
    assert.equal(staged.status, 1);
    assert.match(staged.stdout, /still not served by the npm registry 20 minutes after publish\. It is most likely staged/);

    const malformed = run('{');
    assert.equal(malformed.status, 1);
    assert.match(malformed.stdout, /still not served by the npm registry 20 minutes after publish\. It is most likely staged/);

    const unavailable = run('', { CURL_FAIL: 'true' });
    assert.equal(unavailable.status, 22);
    assert.doesNotMatch(unavailable.stdout, /npm serves @aceshooting/);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('standalone release assets come from immutable source and reject incomplete or extra downloads', async () => {
  const { collectReleaseAssets, verifyReleaseAssets } = await import('./release-artifacts.mjs');
  const { mkdirSync, copyFileSync, symlinkSync } = await import('node:fs');
  const fixture = mkdtempSync(path.join(tmpdir(), 'lyra-release-assets-'));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: fixture, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  try {
    git('init', '--quiet');
    git('config', 'user.email', 'fixture@example.invalid');
    git('config', 'user.name', 'Release fixture');
    const expected = { directory: 'packages/lyra-ui', packageName: '@aceshooting/lyra-ui', version: '1.2.3' };
    const packageDir = path.join(fixture, expected.directory);
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({ name: expected.packageName, version: expected.version, scripts: { manifest: 'generate' } }));
    for (const name of ['CHANGELOG.md', 'custom-elements.json', 'llms.txt', 'llms-full.txt']) writeFileSync(path.join(packageDir, name), `committed ${name}\n`);
    git('add', '.');
    git('commit', '--quiet', '-m', 'Fixture source');
    const sourceSha = git('rev-parse', 'HEAD');
    // The SBOM generator reads the installed workspace; its reproduction is covered by release-sbom.test.mjs.
    const sbom = () => Buffer.from('{"bomFormat":"CycloneDX"}\n');
    const args = { expected, sourceSha, repositoryRoot: fixture, sbom };
    const downloads = path.join(fixture, 'downloads');
    const spec = collectReleaseAssets({ ...args, directory: downloads });
    assert.equal(spec.sourceName, 'lyra-ui-1.2.3-source.tar');
    assert.equal(spec.sbomName, 'lyra-ui-1.2.3.cdx.json');
    assert.equal(spec.standalone.length, 4);
    writeFileSync(path.join(downloads, spec.tarballName), 'separately validated package bytes');
    // Local generated drift must not become signed source or standalone evidence.
    writeFileSync(path.join(packageDir, 'llms.txt'), 'mutable local data');
    writeFileSync(path.join(packageDir, 'package.json'), '{}');
    const verified = path.join(fixture, 'verified');
    const result = verifyReleaseAssets({ ...args, directory: downloads, outputDirectory: verified });
    const manifest = readFileSync(path.join(verified, 'SHA256SUMS'));
    assert.equal(result.manifestSha256, createHash('sha256').update(manifest).digest('hex'));
    assert.equal(readFileSync(path.join(verified, 'llms.txt'), 'utf8'), 'committed llms.txt\n');
    assert.equal(manifest.toString().trim().split('\n').length, 6, 'source, four standalone assets and the SBOM');
    assert.equal(readFileSync(path.join(verified, spec.sbomName), 'utf8'), '{"bomFormat":"CycloneDX"}\n');
    const sourceEntry = spawnSync('tar', ['-xOf', path.join(verified, spec.sourceName), `lyra-ui-${sourceSha}/packages/lyra-ui/llms.txt`], { encoding: 'utf8' });
    assert.equal(sourceEntry.status, 0, sourceEntry.stderr);
    assert.equal(sourceEntry.stdout, 'committed llms.txt\n');
    assert.throws(() => verifyReleaseAssets({ ...args, directory: downloads, outputDirectory: verified }), /must be empty/);
    assert.throws(() => collectReleaseAssets({ ...args, sourceSha: 'HEAD', directory: verified }), /full source commit/);
    assert.throws(() => collectReleaseAssets({ ...args, expected: { ...expected, version: '1.2.4' }, directory: verified }), /tagged package identity/);
    let count = 0;
    const check = (pattern) => assert.throws(() => verifyReleaseAssets({ ...args, directory: downloads, outputDirectory: path.join(fixture, `rejected-${count++}`) }), pattern);
    for (const name of [...spec.standalone, spec.sbomName, spec.sourceName]) {
      const file = path.join(downloads, name);
      const original = readFileSync(file);
      writeFileSync(file, Buffer.concat([original, Buffer.from('tampered')]));
      check(/does not byte-match/);
      writeFileSync(file, original);
      rmSync(file);
      check(/ENOENT/);
      writeFileSync(file, original);
    }
    for (const name of ['unexpected.txt', 'unknown.sigstore.json', 'SHA256SUMS', 'nested']) {
      writeFileSync(path.join(downloads, name), 'unapproved');
      check(/Unexpected release asset/);
      rmSync(path.join(downloads, name));
    }
    const llms = path.join(downloads, 'llms.txt');
    rmSync(llms);
    symlinkSync(path.join(verified, 'llms.txt'), llms);
    check(/regular release asset/);
    rmSync(llms);
    copyFileSync(path.join(verified, 'llms.txt'), llms);
    writeFileSync(path.join(downloads, `${spec.sourceName}.sigstore.json`), 'previous provenance');
    verifyReleaseAssets({ ...args, directory: downloads, outputDirectory: path.join(fixture, 'with-sidecar') });
    // Companion packages without a manifest generator still require source and changelog.
    git('checkout', '--', expected.directory);
    writeFileSync(path.join(packageDir, 'package.json'), JSON.stringify({ name: expected.packageName, version: expected.version }));
    git('add', expected.directory);
    git('commit', '--quiet', '-m', 'Fixture without manifest generator');
    const minimal = collectReleaseAssets({ ...args, sourceSha: git('rev-parse', 'HEAD'), directory: path.join(fixture, 'minimal') });
    assert.deepEqual(minimal.standalone, ['CHANGELOG.md']);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

function standaloneStep(workflow, name) {
  const marker = `      - name: ${name}\n`;
  const step = workflow.indexOf(marker);
  assert.ok(step >= 0, `Missing ${name}`);
  const start = workflow.indexOf('        run: |\n', step) + '        run: |\n'.length;
  const lines = [];
  for (const line of workflow.slice(start).split('\n')) {
    if (line.startsWith('          ')) lines.push(line.slice(10));
    else if (line === '') lines.push('');
    else break;
  }
  return lines.join('\n');
}

test('standalone protected transfer rejects altered manifests, bytes, links and extra files', async () => {
  const { mkdirSync, symlinkSync } = await import('node:fs');
  const sources = ['publish', 'sign-release'].map((name) => standaloneStep(read(`.github/workflows/${name}.yml`), 'Verify standalone asset transfer'));
  assert.equal(sources[0], sources[1]);
  const fixture = mkdtempSync(path.join(tmpdir(), 'lyra-standalone-transfer-'));
  try {
    const dir = path.join(fixture, 'verified-additional-release');
    mkdirSync(dir);
    const files = ['CHANGELOG.md', 'lyra-ui-1.2.3-source.tar'];
    for (const name of files) writeFileSync(path.join(dir, name), name);
    const manifest = files.map((name) => `${createHash('sha256').update(name).digest('hex')}  ${name}\n`).join('');
    writeFileSync(path.join(dir, 'SHA256SUMS'), manifest);
    const expected = createHash('sha256').update(manifest).digest('hex');
    const output = path.join(fixture, 'output');
    const run = (sha = expected) => spawnSync('bash', ['-c', sources[0]], { encoding: 'utf8', env: { ...process.env, RUNNER_TEMP: fixture, GITHUB_OUTPUT: output, EXPECTED_MANIFEST_SHA256: sha } });
    const accepted = run();
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.match(readFileSync(output, 'utf8'), /paths<<RELEASE_ASSETS/);
    assert.doesNotMatch(readFileSync(output, 'utf8'), /\/SHA256SUMS/);
    writeFileSync(path.join(dir, 'SHA256SUMS'), `${manifest}altered\n`);
    assert.notEqual(run().status, 0);
    const traversal = `${'0'.repeat(64)}  ../escape\n`;
    writeFileSync(path.join(dir, 'SHA256SUMS'), traversal);
    assert.notEqual(run(createHash('sha256').update(traversal).digest('hex')).status, 0);
    writeFileSync(path.join(dir, 'SHA256SUMS'), manifest);
    writeFileSync(path.join(dir, files[0]), 'tampered');
    assert.notEqual(run().status, 0);
    writeFileSync(path.join(dir, files[0]), files[0]);
    writeFileSync(path.join(dir, 'unverified.txt'), 'extra');
    assert.notEqual(run().status, 0);
    rmSync(path.join(dir, 'unverified.txt'));
    rmSync(path.join(dir, files[0]));
    writeFileSync(path.join(fixture, 'outside'), files[0]);
    symlinkSync(path.join(fixture, 'outside'), path.join(dir, files[0]));
    assert.notEqual(run().status, 0);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('standalone asset signing preserves authority, qualification and dry-run boundaries', () => {
  const verifier = read('.github/workflows/release-verification.yml');
  const release = read('.github/workflows/release.yml');
  assert.match(release, /collect-release-assets[\s\S]*--sha "\$GITHUB_SHA"/);
  assert.match(verifier, /--pattern '\*'/);
  assert.match(verifier, /compare-rebuild[\s\S]*verify-release-assets/);
  assert.match(verifier, /SOURCE_SHA: \$\{\{ steps\.source\.outputs\.sha \}\}/);
  assert.match(verifier, /additional_assets_sha256: \$\{\{ steps\.additional_assets\.outputs\.sha256 \}\}/);
  for (const name of ['publish', 'sign-release']) {
    const workflow = read(`.github/workflows/${name}.yml`);
    const protectedJob = workflow.slice(workflow.indexOf(name === 'publish' ? '\n  publish:\n' : '\n  sign:\n'));
    assert.doesNotMatch(protectedJob, /actions\/checkout@|pnpm install|scripts\/release-|git archive/);
    assert.match(protectedJob, /environment: npm-publish/);
    assert.match(protectedJob, /subject-path: \$\{\{ steps\.additional_assets\.outputs\.paths \}\}/);
    assert.match(protectedJob, /EXPECTED_MANIFEST_SHA256: \$\{\{ needs\.verify\.outputs\.additional_assets_sha256 \}\}/);
    assert.ok(protectedJob.indexOf('Rebind all standalone release assets after approval') < protectedJob.indexOf('Generate standalone release provenance'));
    if (name === 'publish') {
      for (const step of ['Generate standalone release provenance', 'Upload standalone release provenance']) {
        const section = protectedJob.slice(protectedJob.indexOf(`      - name: ${step}\n`)).split('\n      - name:')[0];
        assert.match(section, /if: \$\{\{ github\.event_name == 'release' \|\| inputs\.dry_run != true \}\}/);
      }
    }
  }
});

test('standalone approval round-trip and provenance upload reject moved tags and changed release assets', async () => {
  const { mkdirSync, readdirSync } = await import('node:fs');
  const publish = read('.github/workflows/publish.yml');
  const sign = read('.github/workflows/sign-release.yml');
  const rebindName = 'Rebind all standalone release assets after approval';
  const uploadName = 'Upload standalone release provenance';
  for (const name of [rebindName, uploadName]) assert.equal(standaloneStep(publish, name), standaloneStep(sign, name));
  const fixture = mkdtempSync(path.join(tmpdir(), 'lyra-standalone-roundtrip-'));
  try {
    const bin = path.join(fixture, 'bin');
    mkdirSync(bin);
    const executable = (name, source) => { const file = path.join(bin, name); writeFileSync(file, source); chmodSync(file, 0o755); };
    executable('git', '#!/usr/bin/env bash\nprintf "%s\\trefs/tags/lyra-ui@1.2.3^{}\\n" "$MOCK_TAG_SHA"\n');
    executable('gh', `#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path');
const args = process.argv.slice(2);
fs.appendFileSync(process.env.MOCK_LOG, JSON.stringify(args) + '\\n');
if (args[0] !== 'release') process.exit(90);
if (args[1] === 'upload') {
  for (const file of args.slice(3, args.indexOf('--repo'))) fs.copyFileSync(file, path.join(process.env.MOCK_RELEASE, path.basename(file)));
} else if (args[1] === 'download') {
  const dir = args[args.indexOf('--dir') + 1], pattern = args[args.indexOf('--pattern') + 1];
  const names = fs.readdirSync(process.env.MOCK_RELEASE).filter(name => pattern === '*' || pattern === name);
  if (!names.length) process.exit(1);
  for (const name of names) fs.copyFileSync(path.join(process.env.MOCK_RELEASE, name), path.join(dir, name));
} else process.exit(91);
`);
    let sequence = 0;
    const run = ({ workflow = publish, step = rebindName, changed = false, extra = false, moved = false, dryRun = false, changedTarball = false, missingTarball = false, missingStandalone = false } = {}) => {
      const runDir = path.join(fixture, String(sequence++));
      const verified = path.join(runDir, 'verified-additional-release');
      const remote = path.join(runDir, 'remote');
      mkdirSync(verified, { recursive: true });
      mkdirSync(remote);
      const names = ['CHANGELOG.md', 'lyra-ui-1.2.3-source.tar'];
      const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
      for (const name of names) { writeFileSync(path.join(verified, name), name); writeFileSync(path.join(remote, name), changed ? 'changed' : name); }
      writeFileSync(path.join(verified, 'SHA256SUMS'), names.map(name => `${sha(name)}  ${name}\n`).join(''));
      const tarball = path.join(runDir, 'aceshooting-lyra-ui-1.2.3.tgz');
      writeFileSync(tarball, 'tarball');
      if (!missingTarball) writeFileSync(path.join(remote, path.basename(tarball)), changedTarball ? 'changed tarball' : 'tarball');
      if (missingStandalone) rmSync(path.join(remote, names[0]));
      if (extra) writeFileSync(path.join(remote, 'unverified.txt'), 'unverified');
      const bundle = path.join(runDir, 'bundle.json');
      writeFileSync(bundle, 'fixture bundle');
      const log = path.join(runDir, 'calls.log');
      const sourceSha = 'a'.repeat(40);
      const result = spawnSync('bash', ['-c', standaloneStep(workflow, step)], { encoding: 'utf8', env: {
        ...process.env, PATH: `${bin}:${process.env.PATH}`, RUNNER_TEMP: runDir,
        EXPECTED_TAG_SHA: sourceSha, EXPECTED_TARBALL_SHA256: sha('tarball'),
        MOCK_TAG_SHA: moved ? 'b'.repeat(40) : sourceSha, MOCK_RELEASE: remote, MOCK_LOG: log,
        GITHUB_REPOSITORY: 'fixture/repository', GITHUB_EVENT_NAME: 'workflow_dispatch',
        TAG: 'lyra-ui@1.2.3', TARBALL: tarball, DRY_RUN: String(dryRun), BUNDLE: bundle,
      } });
      return { result, remote, names: readdirSync(remote), calls: (() => { try { return readFileSync(log, 'utf8'); } catch { return ''; } })() };
    };
    const restored = run({ changed: true });
    assert.equal(restored.result.status, 0, restored.result.stderr);
    assert.equal(readFileSync(path.join(restored.remote, 'CHANGELOG.md'), 'utf8'), 'CHANGELOG.md');
    assert.notEqual(run({ extra: true }).result.status, 0, 'undeclared downloads must fail');
    const moved = run({ moved: true });
    assert.notEqual(moved.result.status, 0);
    assert.equal(moved.calls, '', 'moved tags cannot authorize release changes');
    const dry = run({ dryRun: true });
    assert.equal(dry.result.status, 0, dry.result.stderr);
    assert.doesNotMatch(dry.calls, /"upload"/);
    const alteredDry = run({ dryRun: true, changed: true });
    assert.notEqual(alteredDry.result.status, 0);
    assert.doesNotMatch(alteredDry.calls, /"upload"/);
    for (const workflow of [publish, sign]) {
      const uploaded = run({ workflow, step: uploadName });
      assert.equal(uploaded.result.status, 0, uploaded.result.stderr);
      assert.equal(uploaded.names.filter(name => name.endsWith('.sigstore.json')).length, 2);
      // Model changes after the earlier approval check and intervening attestation steps.
      for (const state of [
        { extra: true }, { changedTarball: true }, { missingTarball: true },
        { missingStandalone: true }, { changed: true }, { moved: true },
      ]) {
        const rejected = run({ workflow, step: uploadName, ...state });
        assert.notEqual(rejected.result.status, 0, `Final publication must reject ${JSON.stringify(state)}`);
        assert.doesNotMatch(rejected.calls, /"upload"/);
        assert.equal(rejected.names.filter(name => name.endsWith('.sigstore.json')).length, 0);
      }
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('every exact-commit qualification wait names all four workflows, in the same order, in release and publish verification', () => {
  const release = read('.github/workflows/release.yml');
  const verification = read('.github/workflows/release-verification.yml');
  const manifest = JSON.parse(read('.github/release-qualification.json'));
  const commands = ['wait-ci', 'wait-test-all-browsers', 'wait-full-engine', 'wait-quality-tools'];
  const workflows = ['ci.yml', 'test-all-browsers.yml', 'full-engine.yml', 'quality-tools.yml'];

  // The release plan step is renamed to include every gate, and it is the only step that waits.
  assert.match(release, /- name: Require CI, Test All Browsers, the Full browser-engine suite, and Quality tools on this commit\n/u);
  assert.doesNotMatch(release, /Require CI, Test All Browsers, and the Full browser-engine suite/u);
  for (const [source, label] of [[release, 'release.yml'], [verification, 'release-verification.yml']]) {
    let from = 0;
    for (const [index, command] of commands.entries()) {
      const at = source.indexOf(`release-integrity.mjs ${command}`, from);
      assert.ok(at >= from, `${label} runs ${command} after the previous wait`);
      const call = source.slice(at, source.indexOf('\n          node ', at + 10) >= 0 ? source.indexOf('\n          node ', at + 10) : at + 400);
      assert.match(call, new RegExp(`--workflow ${workflows[index].replace('.', '\\.')}`, 'u'), `${label} ${command} waits for ${workflows[index]}`);
      assert.match(call, /--timeout-seconds \d+/u);
      from = at + 1;
    }
  }

  // The release-qualification manifest names the same four workflows, each as a dispatched main run
  // except push CI, so the waits above and release-integrity.mjs read one source of truth.
  assert.deepEqual(Object.keys(manifest.workflows).sort(), ['ci', 'fullEngine', 'qualityTools', 'testAllBrowsers']);
  for (const [key, workflow] of Object.entries(manifest.workflows)) {
    assert.equal(workflow.event, key === 'ci' ? 'push' : 'workflow_dispatch', key);
    assert.equal(workflow.headBranch, 'main', key);
    assert.ok(workflow.requiredJobs.length > 0, key);
  }
});

test('the release plan job outlasts all four qualification waits running to their full windows', () => {
  const release = read('.github/workflows/release.yml');
  const plan = release.slice(release.indexOf('\n  plan:\n'), release.indexOf('\n  pack:\n'));
  const windows = [...plan.matchAll(/--timeout-seconds (\d+)/gu)].map((match) => Number(match[1]));
  assert.equal(windows.length, 4, 'CI, Test All Browsers, the full-engine suite and Quality tools');
  const budgetMinutes = Number(plan.match(/timeout-minutes: (\d+)/u)?.[1]);
  // The waits run one after another, each with its own deadline, so the job must survive their sum
  // plus the checkout, tag planning and bootstrap checks around them (five minutes is generous).
  assert.ok(
    budgetMinutes * 60 >= windows.reduce((sum, seconds) => sum + seconds, 0) + 300,
    `plan has ${budgetMinutes} minutes for waits of ${windows.join(' + ')} seconds`,
  );
});
