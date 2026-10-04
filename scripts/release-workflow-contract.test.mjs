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
    /wait-ci[\s\S]*wait-test-all-browsers[\s\S]*wait-full-engine[\s\S]*compare-rebuild/
  );
  assert.match(reusable, /actions\/upload-artifact@/);
});

test('first Docs publication uses a protected, provenance-bearing token path only for an absent package', () => {
  const release = read('.github/workflows/release.yml');
  const publish = read('.github/workflows/publish.yml');
  const plan = release.slice(release.indexOf('\n  plan:\n'), release.indexOf('\n  pack:\n'));
  const dispatch = release.slice(release.indexOf('      - name: Dispatch npm publish for each tag'));
  const protectedJob = publish.slice(publish.indexOf('\n  publish:\n'));
  const eligibility = protectedJob.slice(
    protectedJob.indexOf('      - name: Require an unpublished Docs package for bootstrap after approval'),
    protectedJob.indexOf('      - name: Generate release provenance'),
  );
  const normalPublish = protectedJob.slice(
    protectedJob.indexOf('      - name: Publish to npm'),
    protectedJob.indexOf('      - name: Bootstrap first Docs package with npm provenance'),
  );
  const bootstrapPublish = protectedJob.slice(
    protectedJob.indexOf('      - name: Bootstrap first Docs package with npm provenance'),
  );

  assert.match(release, /first_package_bootstrap:\n\s+description: [^\n]+\n\s+required: false\n\s+type: boolean\n\s+default: false/u);
  assert.match(publish, /first_package_bootstrap:\n\s+description: [^\n]+\n\s+required: false\n\s+type: boolean\n\s+default: false/u);
  assert.match(plan, /"\$PACKAGE" != lyra-docs \|\| ! "\$TAGS" =~ \^lyra-docs@/u);
  assert.match(plan, /"\$status" != 404/u);
  assert.match(dispatch, /-f first_package_bootstrap=true/u);
  assert.match(eligibility, /"\$GITHUB_EVENT_NAME" != workflow_dispatch \|\| "\$DRY_RUN" == true/u);
  assert.match(eligibility, /! "\$TAG" =~ \^lyra-docs@/u);
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
  const plan = stepScript(read('.github/workflows/release.yml'), 'Require an unpublished Docs package for bootstrap');
  const publish = stepScript(read('.github/workflows/publish.yml'), 'Require an unpublished Docs package for bootstrap after approval');
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
    assert.equal(run(plan, { TAGS: 'lyra-docs@0.1.1 lyra-ui@25.6.2' }).status, 1);
    assert.equal(run(publish, { TAG: 'lyra-ui@25.6.2' }).status, 1);
    assert.equal(run(publish, { DRY_RUN: 'true' }).status, 1);
    assert.equal(run(publish, { GITHUB_EVENT_NAME: 'release' }).status, 1);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});
