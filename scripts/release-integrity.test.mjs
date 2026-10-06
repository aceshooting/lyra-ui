#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  collectGitHubPages,
  REQUIRED_CI_JOBS,
  REQUIRED_FULL_ENGINE_JOBS,
  REQUIRED_TEST_ALL_BROWSER_JOBS,
  evaluateCiRun,
  evaluateFullEngineRun,
  evaluateTestAllBrowsersRun,
  parseReleaseTag,
  planReleaseTags,
  selectReleaseTarball,
  validateAnnotatedTag,
  validateRebuiltTarballBytes,
  validateTarballIdentity,
  validateWorkflowSource,
  waitForSuccessfulCi,
  waitForSuccessfulFullEngine,
  waitForSuccessfulTestAllBrowsers,
  evaluateSiteFreshness,
} from './release-integrity.mjs';
import {
  changesetPackagePlan,
  renderChangesetPackagePlan,
} from './changeset-release-plan.mjs';
import { normalizeBrowserInput } from './plan-test-browsers.mjs';
import { updateDocumentationCounts, updateReadmeStatusLine } from './update-readme-status.mjs';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sha = '0123456789abcdef0123456789abcdef01234567';

function exactShellCommandCount(source, command) {
  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line === command).length;
}

function exactTopLevelShellCommandCount(source, command) {
  return source.split('\n').filter((line) => line === command).length;
}

function exactTopLevelShellCommandIndex(source, command) {
  return source.split('\n').findIndex((line) => line === command);
}

function localCiPrimaryBlock(source) {
  const primaryStart = source.indexOf('\nrequire_primary_toolchain\n');
  const platformStart = source.indexOf('\nif [[ "$RUN_PLATFORM" == "1" ]]', primaryStart + 1);
  assert.ok(
    primaryStart >= 0 && platformStart > primaryStart,
    'local CI must expose one live top-level primary block before platform branches',
  );
  return source.slice(primaryStart + 1, platformStart);
}

function shellFunctionRange(source, startName, endName) {
  const starts = [
    source.indexOf(`\n${startName}() {`),
    source.indexOf(`\n${startName}() (`),
  ].filter((index) => index >= 0);
  const ends = [
    source.indexOf(`\n${endName}() {`, Math.min(...starts) + 1),
    source.indexOf(`\n${endName}() (`, Math.min(...starts) + 1),
  ].filter((index) => index >= 0);
  const start = starts.length > 0 ? Math.min(...starts) : -1;
  const end = ends.length > 0 ? Math.min(...ends) : -1;
  assert.ok(start >= 0 && end > start, `expected ${startName} before ${endName}`);
  return source.slice(start + 1, end);
}

function writeFakeNode(executablePath, version) {
  mkdirSync(path.dirname(executablePath), { recursive: true });
  writeFileSync(
    executablePath,
    `#!/usr/bin/env sh\nif [ "\${1:-}" = "-p" ]; then printf '%s\\n' '${version}'; else printf 'v%s\\n' '${version}'; fi\n`,
  );
  chmodSync(executablePath, 0o755);
}

/** The ambient shell may carry `CI_SH_NODE*_BIN`/`CI_SH_PNPM*_BIN` overrides (a host that drives
 *  the platform matrix exports them). They preempt PATH/NVM resolution by design, so a fixture that
 *  exercises that resolution must not inherit them. */
function withoutToolchainOverrides(env) {
  return Object.fromEntries(
    Object.entries(env).filter(([key]) => !/^CI_SH_(?:NODE|PNPM)\d+_BIN$/u.test(key)),
  );
}

function resolveNodeFromCiFixture({ root, major, pathDirectory, nvmDirectory }) {
  const source = readFileSync(path.join(repoRoot, 'scripts/ci.sh'), 'utf8');
  const resolverSource = shellFunctionRange(source, 'resolve_command', 'run_with_toolchain');
  const result = spawnSync(
    'bash',
    ['-c', `${resolverSource}\nresolve_node_for_version "$1"`, 'resolver-fixture', String(major)],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...withoutToolchainOverrides(process.env),
        CI_SH_ROOT: root,
        NVM_DIR: nvmDirectory,
        PATH: `${pathDirectory}:/usr/bin:/bin`,
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function resolveCommandFromCiFixture({ cwd, pathValue, requested, shellPrelude = '' }) {
  const source = readFileSync(path.join(repoRoot, 'scripts/ci.sh'), 'utf8');
  const resolverSource = shellFunctionRange(source, 'resolve_command', 'run_with_toolchain');
  return spawnSync(
    'bash',
    ['-c', `${resolverSource}\n${shellPrelude}\nresolve_command "$1"`, 'resolver-fixture', requested],
    {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, PATH: pathValue },
    },
  );
}

function linkOrCopyExecutable(source, target) {
  try {
    linkSync(source, target);
  } catch {
    copyFileSync(source, target);
  }
  chmodSync(target, 0o755);
}

function exerciseSelectedToolchain({ label, selectedNode }) {
  const root = mkdtempSync(path.join(tmpdir(), `lyra-ci-${label}-toolchain-`));
  try {
    // The extensionless pnpm fixture must not inherit an enclosing repository's ESM mode.
    writeFileSync(path.join(root, 'package.json'), '{"type":"commonjs"}\n');
    const overrideDirectory = path.join(root, `${label}-override-without-node`);
    const selectedRuntimeDirectory = path.join(root, `${label}-selected-runtime`);
    const selectedPnpmDirectory = path.join(root, `${label}-pnpm-without-node`);
    const wrongNodeDirectory = path.join(root, 'wrong-node');
    const transactionTemp = path.join(root, 'tmp');
    mkdirSync(overrideDirectory, { recursive: true });
    mkdirSync(selectedRuntimeDirectory, { recursive: true });
    mkdirSync(selectedPnpmDirectory, { recursive: true });
    mkdirSync(wrongNodeDirectory, { recursive: true });
    mkdirSync(transactionTemp, { recursive: true });

    const selectedRuntime = path.join(selectedRuntimeDirectory, `runtime-${label}`);
    const wrongRuntime = path.join(wrongNodeDirectory, 'node');
    linkOrCopyExecutable(selectedNode, selectedRuntime);
    linkOrCopyExecutable(selectedNode, wrongRuntime);

    const selectedOverride = path.join(overrideDirectory, `node-${label}`);
    writeFileSync(
      selectedOverride,
      `#!/bin/sh\nexec ${JSON.stringify(selectedRuntime)} "$@"\n`,
    );
    chmodSync(selectedOverride, 0o755);

    const selectedPnpm = path.join(selectedPnpmDirectory, `pnpm-${label}`);
    writeFileSync(
      selectedPnpm,
      [
        '#!/usr/bin/env node',
        "const { spawnSync } = require('node:child_process');",
        "const { writeFileSync } = require('node:fs');",
        "const path = require('node:path');",
        "const args = process.argv.slice(2).filter((argument) => !argument.startsWith('--config.script-shell='));",
        'const mode = args[0];',
        "const observation = () => ({ cwd: process.cwd(), execPath: process.execPath, selectedPathFirst: process.env.PATH.split(path.delimiter)[0] === process.env.CI_SH_SELECTED_TOOLCHAIN_DIR });",
        "if (mode === '--nested') {",
        '  process.stdout.write(JSON.stringify(observation()));',
        "} else if (mode === '--failure') {",
        '  process.exit(17);',
        "} else if (mode === '--signal') {",
        '  process.kill(process.ppid, args[1]);',
        '  setTimeout(() => process.exit(91), 40);',
        "} else if (mode === '--top-signal') {",
        "  writeFileSync(process.env.LYRA_TEST_CHILD_PID_FILE, `${process.pid}\\n`);",
        '  process.kill(Number(process.env.LYRA_TEST_TOP_PID), args[1]);',
        '  setInterval(() => {}, 1000);',
        "} else if (mode === '--repeated-top-term') {",
        "  writeFileSync(process.env.LYRA_TEST_PROCESS_PID_FILE, JSON.stringify({ child: process.pid, worker: process.ppid }));",
        '  let handledTerm = false;',
        "  process.on('SIGTERM', () => {",
        '    if (handledTerm) return;',
        '    handledTerm = true;',
        "    process.kill(Number(process.env.LYRA_TEST_TOP_PID), 'SIGTERM');",
        '  });',
        "  process.kill(Number(process.env.LYRA_TEST_TOP_PID), 'SIGTERM');",
        '  setTimeout(() => {',
        "    writeFileSync(process.env.LYRA_TEST_SIGNAL_SAFETY_FILE, 'fired\\n');",
        '    process.exit(97);',
        '  }, 3000);',
        '  setInterval(() => {}, 1000);',
        '} else {',
        "  const lifecyclePath = `${process.env.LYRA_TEST_WRONG_NODE_DIR}${path.delimiter}${process.env.PATH}`;",
        "  const nested = spawnSync('pnpm', ['--nested'], { cwd: process.env.LYRA_TEST_NESTED_CWD, encoding: 'utf8', env: { ...process.env, PATH: lifecyclePath } });",
        "  if (nested.status !== 0) { process.stderr.write(nested.stderr); process.exit(nested.status ?? 1); }",
        '  process.stdout.write(JSON.stringify({ ...observation(), nested: JSON.parse(nested.stdout) }));',
        '}',
        '',
      ].join('\n'),
    );
    chmodSync(selectedPnpm, 0o755);
    const ciSource = readFileSync(path.join(repoRoot, 'scripts/ci.sh'), 'utf8');
    const functionSource = shellFunctionRange(
      ciSource,
      'run_with_toolchain',
      'validate_platform_toolchain',
    );
    const nestedCwd = path.join(root, 'nested/cwd');
    mkdirSync(nestedCwd, { recursive: true });
    const invoke = (...commandArgs) => spawnSync(
      'bash',
      [
        '-c',
        `${functionSource}\nCI_SH_ROOT="$1"\nrun_with_toolchain "$2" "$3" "\${@:4}"`,
        'toolchain-fixture',
        root,
        selectedOverride,
        selectedPnpm,
        ...commandArgs,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          LYRA_TEST_NESTED_CWD: nestedCwd,
          LYRA_TEST_WRONG_NODE_DIR: wrongNodeDirectory,
          PATH: `${wrongNodeDirectory}:/usr/bin:/bin`,
          TMPDIR: path.relative(root, transactionTemp),
        },
      },
    );

    const result = invoke('--outer');
    assert.equal(result.status, 0, result.stderr);
    const observation = JSON.parse(result.stdout);
    assert.deepEqual(
      observation,
      {
        cwd: root,
        execPath: selectedRuntime,
        selectedPathFirst: true,
        nested: {
          cwd: nestedCwd,
          execPath: selectedRuntime,
          selectedPathFirst: true,
        },
      },
      `${label} pnpm shebang and nested lifecycle must both use the selected Node process`,
    );
    assert.deepEqual(
      readdirSync(transactionTemp),
      [],
      `${label} selected-node proxy must be cleaned after the command`,
    );

    const failure = invoke('--failure');
    assert.equal(failure.status, 17, `${label} failure status must survive cleanup: ${failure.stderr}`);
    assert.deepEqual(readdirSync(transactionTemp), [], `${label} failure must clean its proxy`);

    for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM']) {
      const signaled = invoke('--signal', signal);
      assert.notEqual(signaled.status, 0, `${label} ${signal} must not report success`);
      assert.deepEqual(
        readdirSync(transactionTemp),
        [],
        `${label} ${signal} must clean its proxy through the trapped subshell`,
      );
    }

    for (const [signal, expectedStatus] of [
      ['SIGHUP', 129],
      ['SIGINT', 130],
      ['SIGTERM', 143],
    ]) {
      const childPidFile = path.join(root, `${signal}.child-pid`);
      const signaled = spawnSync(
        'bash',
        [
          '-c',
          `${functionSource}\nCI_SH_ROOT="$1"\nexport LYRA_TEST_TOP_PID=$$\nrun_with_toolchain "$2" "$3" --top-signal "$4"`,
          'top-level-toolchain-signal-fixture',
          root,
          selectedOverride,
          selectedPnpm,
          signal,
        ],
        {
          cwd: root,
          encoding: 'utf8',
          env: {
            ...process.env,
            LYRA_TEST_CHILD_PID_FILE: childPidFile,
            PATH: `${wrongNodeDirectory}:/usr/bin:/bin`,
            TMPDIR: path.relative(root, transactionTemp),
          },
          timeout: 5000,
        },
      );
      assert.equal(
        signaled.status,
        expectedStatus,
        `${label} ${signal} to the top-level shell must be forwarded:\n${signaled.stderr}`,
      );
      const selectedChildPid = readFileSync(childPidFile, 'utf8').trim();
      const childProbe = spawnSync(
        'bash',
        ['-c', 'kill -0 "$1" 2>/dev/null', 'probe', selectedChildPid],
      );
      assert.notEqual(
        childProbe.status,
        0,
        `${label} ${signal} must not leave selected child ${selectedChildPid} alive`,
      );
      assert.deepEqual(
        readdirSync(transactionTemp),
        [],
        `${label} ${signal} to the top-level shell must clean its proxy`,
      );
    }

    const repeatedTermPidFile = path.join(root, 'repeated-term-processes.json');
    const repeatedTermSafetyFile = path.join(root, 'repeated-term-safety-fired');
    const repeatedTerm = spawnSync(
      'bash',
      [
        '-c',
        `${functionSource}\nCI_SH_ROOT="$1"\nexport LYRA_TEST_TOP_PID=$$\nrun_with_toolchain "$2" "$3" --repeated-top-term`,
        'repeated-top-level-toolchain-signal-fixture',
        root,
        selectedOverride,
        selectedPnpm,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          LYRA_TEST_PROCESS_PID_FILE: repeatedTermPidFile,
          LYRA_TEST_SIGNAL_SAFETY_FILE: repeatedTermSafetyFile,
          PATH: `${wrongNodeDirectory}:/usr/bin:/bin`,
          TMPDIR: path.relative(root, transactionTemp),
        },
        timeout: 5000,
      },
    );
    assert.equal(
      repeatedTerm.status,
      143,
      `${label} repeated TERM must retain the outer signal status:\n${repeatedTerm.stderr}`,
    );
    assert.equal(repeatedTerm.signal, null, `${label} repeated TERM must stay trapped during teardown`);
    assert.equal(
      existsSync(repeatedTermSafetyFile),
      false,
      `${label} repeated TERM teardown must finish before the fixture safety timeout`,
    );
    const repeatedTermProcesses = JSON.parse(readFileSync(repeatedTermPidFile, 'utf8'));
    for (const [processLabel, processPid] of Object.entries(repeatedTermProcesses)) {
      const processProbe = spawnSync(
        'bash',
        ['-c', 'kill -0 "$1" 2>/dev/null', 'probe', String(processPid)],
      );
      assert.notEqual(
        processProbe.status,
        0,
        `${label} repeated TERM must not leave selected ${processLabel} ${processPid} alive`,
      );
    }
    assert.deepEqual(
      readdirSync(transactionTemp),
      [],
      `${label} repeated TERM must clean its selected-node proxy`,
    );

    const cleanupSignalMarker = path.join(root, 'cleanup-signal-sent');
    const cleanupSignalRm = path.join(wrongNodeDirectory, 'rm');
    writeFileSync(
      cleanupSignalRm,
      [
        '#!/bin/sh',
        'if mkdir "$LYRA_TEST_RM_SIGNAL_MARKER" 2>/dev/null; then',
        '  kill -TERM "$LYRA_TEST_TOP_PID"',
        '  sleep 0.25',
        'fi',
        'exec /bin/rm "$@"',
        '',
      ].join('\n'),
    );
    chmodSync(cleanupSignalRm, 0o755);
    const cleanupSignaled = spawnSync(
      'bash',
      [
        '-c',
        `${functionSource}\nCI_SH_ROOT="$1"\nexport LYRA_TEST_TOP_PID=$$\nrun_with_toolchain "$2" "$3" --nested`,
        'top-level-cleanup-signal-fixture',
        root,
        selectedOverride,
        selectedPnpm,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          LYRA_TEST_RM_SIGNAL_MARKER: cleanupSignalMarker,
          PATH: `${wrongNodeDirectory}:/usr/bin:/bin`,
          TMPDIR: path.relative(root, transactionTemp),
        },
        timeout: 5000,
      },
    );
    assert.equal(
      cleanupSignaled.status,
      143,
      `${label} TERM during proxy cleanup must retain the outer signal status:\n${cleanupSignaled.stderr}`,
    );
    assert.deepEqual(
      readdirSync(transactionTemp),
      [],
      `${label} TERM during cleanup must not strand its selected-node proxy`,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function exerciseRealPnpmLifecycle(selectedNode) {
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-ci-real-pnpm-lifecycle-'));
  try {
    const selectedRuntimeDirectory = path.join(root, 'selected-runtime');
    const overrideDirectory = path.join(root, 'override-without-node');
    const packageRoot = path.join(root, 'package');
    const hostileBin = path.join(packageRoot, 'node_modules/.bin');
    const transactionTemp = path.join(root, 'tmp');
    for (const directory of [
      selectedRuntimeDirectory,
      overrideDirectory,
      hostileBin,
      transactionTemp,
    ]) {
      mkdirSync(directory, { recursive: true });
    }

    const selectedRuntime = path.join(selectedRuntimeDirectory, 'selected-runtime');
    linkOrCopyExecutable(selectedNode, selectedRuntime);
    const selectedOverride = path.join(overrideDirectory, 'node-selected');
    writeFileSync(selectedOverride, `#!/bin/sh\nexec ${JSON.stringify(selectedRuntime)} "$@"\n`);
    chmodSync(selectedOverride, 0o755);

    const pnpmResolution = spawnSync('bash', ['-c', 'type -P -- pnpm'], {
      encoding: 'utf8',
      env: process.env,
    });
    assert.equal(pnpmResolution.status, 0, pnpmResolution.stderr);
    const pnpmLauncher = pnpmResolution.stdout.trim();
    assert.ok(path.isAbsolute(pnpmLauncher), 'real pnpm fixture requires one absolute launcher');
    // A global pnpm launcher can dispatch to the repository's pinned version.
    // Resolve that effective executable before run_with_toolchain deliberately
    // disables automatic package-manager switching for nested lifecycle calls.
    const effectivePnpm = spawnSync(
      pnpmLauncher,
      ['exec', selectedNode, '-p', 'process.env.npm_execpath'],
      { cwd: repoRoot, encoding: 'utf8', env: process.env },
    );
    assert.equal(effectivePnpm.status, 0, effectivePnpm.stderr);
    const selectedPnpm = effectivePnpm.stdout.trim();
    assert.ok(path.isAbsolute(selectedPnpm), 'real pnpm fixture requires one absolute executable');
    const packageManager = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).packageManager;

    writeFileSync(
      path.join(packageRoot, 'package.json'),
      `${JSON.stringify({
        name: 'real-pnpm-lifecycle-fixture',
        packageManager,
        private: true,
        scripts: { probe: 'node probe.cjs && pnpm --version' },
      }, null, 2)}\n`,
    );
    writeFileSync(
      path.join(packageRoot, 'probe.cjs'),
      [
        "const path = require('node:path');",
        'process.stdout.write(`${JSON.stringify({',
        '  execPath: process.execPath,',
        "  selectedPathFirst: process.env.PATH.split(path.delimiter)[0] === process.env.CI_SH_SELECTED_TOOLCHAIN_DIR,",
        '})}\\n`);',
        '',
      ].join('\n'),
    );
    writeFileSync(path.join(hostileBin, 'node'), '#!/bin/sh\nprintf "HOSTILE-LOCAL-NODE\\n"\n');
    writeFileSync(path.join(hostileBin, 'pnpm'), '#!/bin/sh\nprintf "LOCAL-PNPM-BYPASS\\n"\n');
    chmodSync(path.join(hostileBin, 'node'), 0o755);
    chmodSync(path.join(hostileBin, 'pnpm'), 0o755);

    const ciSource = readFileSync(path.join(repoRoot, 'scripts/ci.sh'), 'utf8');
    const functionSource = shellFunctionRange(
      ciSource,
      'run_with_toolchain',
      'validate_platform_toolchain',
    );
    const result = spawnSync(
      'bash',
      [
        '-c',
        `${functionSource}\nCI_SH_ROOT="$1"\nrun_with_toolchain "$2" "$3" --dir "$4" run probe`,
        'real-pnpm-lifecycle-fixture',
        root,
        selectedOverride,
        selectedPnpm,
        packageRoot,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: '/usr/bin:/bin',
          TMPDIR: path.relative(root, transactionTemp),
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.doesNotMatch(result.stdout, /HOSTILE-LOCAL-NODE|LOCAL-PNPM-BYPASS/u);
    const observationLine = result.stdout.split('\n').find((line) => line.startsWith('{'));
    assert.ok(observationLine, `real lifecycle probe did not run:\n${result.stdout}`);
    assert.deepEqual(JSON.parse(observationLine), {
      execPath: selectedRuntime,
      selectedPathFirst: true,
    });
    assert.ok(
      result.stdout.split('\n').includes(packageManager.replace(/^pnpm@/u, '')),
      `nested pnpm must report ${packageManager}:\n${result.stdout}${result.stderr}`,
    );
    assert.deepEqual(
      readdirSync(transactionTemp).filter((entry) => entry.startsWith('lyra-ci-selected-node.')),
      [],
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function assertLocalPublicApiAggregate(source) {
  const primary = localCiPrimaryBlock(source);
  const predecessorCommands = [
    'pnpm build',
    'pnpm check:packed-consumer',
    'node scripts/check-peer-compatibility.mjs',
  ];
  const predecessorIndexes = predecessorCommands.map((command) => {
    assert.equal(
      exactTopLevelShellCommandCount(primary, command),
      1,
      `the live primary block must run exactly one ${command}`,
    );
    return exactTopLevelShellCommandIndex(primary, command);
  });

  for (const packageName of ['@aceshooting/lyra-ui', '@aceshooting/lyra-flags']) {
    const command = `pnpm --filter ${packageName} check:public-api`;
    assert.equal(
      exactShellCommandCount(source, command),
      1,
      `local CI must run exactly one ${packageName} public-API command`,
    );
    assert.equal(
      exactTopLevelShellCommandCount(primary, command),
      1,
      `${packageName} public API must run in the live top-level primary block`,
    );
    const publicApiIndex = exactTopLevelShellCommandIndex(primary, command);
    assert.ok(
      predecessorIndexes.every((index) => index >= 0 && index < publicApiIndex),
      `${packageName} public API must run after build, packed consumer, and peer profiles`,
    );
  }
}

function assertLocalPackedConsumerRouting(source) {
  const toolchainStart = source.indexOf('\nvalidate_platform_toolchain()');
  const platformFunctionStart = source.indexOf('\nrun_platform_matrix_leg()', toolchainStart + 1);
  assert.ok(
    toolchainStart >= 0 && platformFunctionStart > toolchainStart,
    'local CI must expose validate_platform_toolchain before the platform leg',
  );
  const toolchainFunction = source.slice(toolchainStart, platformFunctionStart);
  assert.equal(
    exactShellCommandCount(toolchainFunction, '"$node_bin" scripts/check-node-version.mjs || return'),
    1,
    'platform toolchain validation must contain exactly one exact-Node invocation',
  );
  assert.match(toolchainFunction, /local manifest="package\.json"/u);
  assert.doesNotMatch(toolchainFunction, /ci-pnpm10|NODE20|PNPM20/u);
  assert.match(
    toolchainFunction,
    /if \[\[ "\$node_version" != "22" \]\]; then[\s\S]*?return 1/u,
    'unsupported contributor Node majors must fail before execution',
  );

  const functionStart = source.indexOf('\nrun_platform_matrix_leg()');
  const primaryStart = source.indexOf('\nrequire_primary_toolchain', functionStart + 1);
  assert.ok(functionStart >= 0 && primaryStart > functionStart, 'local CI must expose a parseable platform leg');
  const platformFunction = source.slice(functionStart, primaryStart);
  const packedCalls = [
    ...platformFunction.matchAll(
      /run_with_toolchain "\$node_bin" "\$pnpm_bin" (check:packed-consumer(?::contracts)?) \|\| return/gu,
    ),
  ];
  assert.deepEqual(
    packedCalls.map((match) => match[1]),
    [],
    'the primary supported-Node job owns packed coverage; browser legs must not duplicate it',
  );
  assert.doesNotMatch(platformFunction, /check-peer-compatibility/u);

  const primaryEnd = source.indexOf('\nif [[ "$RUN_PLATFORM" == "1" ]]', primaryStart);
  assert.ok(primaryEnd > primaryStart, 'local CI must expose a parseable primary aggregate');
  const primary = source.slice(primaryStart, primaryEnd);
  assert.equal(exactShellCommandCount(primary, 'pnpm check:packed-consumer'), 1);
  assert.equal(exactShellCommandCount(primary, 'pnpm check:packed-consumer:contracts'), 0);
  assert.equal(
    exactShellCommandCount(primary, 'node scripts/check-peer-compatibility.mjs'),
    1,
    'only the primary Node 22 packed flow must run all peer profiles',
  );
}

function assertCanonicalRegenOrder(source) {
  const expectedCommands = [
    'pnpm --filter @aceshooting/lyra-ui package-metadata',
    'pnpm --filter @aceshooting/lyra-ui default-string-slices',
    'pnpm manifest',
    'pnpm --filter @aceshooting/lyra-ui component-inventory',
    'pnpm --filter @aceshooting/lyra-ui tag-aliases',
    'pnpm manifest',
    'pnpm --filter @aceshooting/lyra-ui component-metadata',
    'pnpm registrations',
    'pnpm manifest',
    'pnpm --filter @aceshooting/lyra-ui component-inventory',
    'pnpm --filter @aceshooting/lyra-ui autoloader-manifest',
    'pnpm --filter @aceshooting/lyra-ui events',
    'pnpm --filter @aceshooting/lyra-ui framework-types',
    'pnpm --filter @aceshooting/lyra-ui exec node scripts/generate-palette.mjs',
    'pnpm --filter @aceshooting/lyra-ui exec node scripts/generate-chart-palette.mjs',
    'pnpm --filter @aceshooting/lyra-ui exec node scripts/generate-terminal-palette.mjs',
    'pnpm --filter @aceshooting/lyra-ui design-tokens',
    'pnpm --filter @aceshooting/lyra-ui generate-editor-data',
    'pnpm plugin:sync',
    './package.sh',
    'pnpm build',
    'pnpm --filter @aceshooting/lyra-ui exec node scripts/check-bundle-size.mjs --write-stats',
    'pnpm --filter @aceshooting/lyra-ui component-quality',
    'pnpm --filter @aceshooting/lyra-ui check:component-quality:built',
  ];
  let cursor = -1;
  for (const command of expectedCommands) {
    const next = source.indexOf(`\n${command}\n`, cursor + 1);
    assert.ok(next > cursor, `regen.sh must run in canonical order: ${command}`);
    cursor = next;
  }
  const expectedCounts = new Map([
    ['pnpm manifest', 3],
    ['pnpm --filter @aceshooting/lyra-ui component-inventory', 2],
  ]);
  for (const command of expectedCommands) {
    const expectedCount = expectedCounts.get(command) ?? 1;
    assert.equal(
      exactShellCommandCount(source, command),
      expectedCount,
      `regen.sh must run ${command} exactly ${expectedCount === 1 ? 'once' : `${expectedCount} times`}`,
    );
  }
  const finalQualityCommand = expectedCommands.at(-1);
  const finalQualityIndex = source.indexOf(`\n${finalQualityCommand}\n`);
  const afterFinalQuality = source.slice(finalQualityIndex + finalQualityCommand.length + 2);
  for (const command of expectedCommands.slice(0, -1)) {
    assert.equal(
      exactShellCommandCount(afterFinalQuality, command),
      0,
      `regen.sh may not run source writer ${command} after final component quality`,
    );
  }
  assert.doesNotMatch(source, /pnpm --filter @aceshooting\/lyra-ui (?:run )?llms(?:\s|$)/mu);
  assert.doesNotMatch(source, /--skip-build/u);
}
const successfulJobs = () =>
  REQUIRED_CI_JOBS.map((name, index) => ({
    id: index + 1,
    name,
    status: 'completed',
    conclusion: 'success',
  }));
const successfulFullEngineJobs = () =>
  REQUIRED_FULL_ENGINE_JOBS.map((name, index) => ({
    id: index + 1,
    name,
    status: 'completed',
    conclusion: 'success',
  }));
const successfulTestAllBrowserJobs = () =>
  REQUIRED_TEST_ALL_BROWSER_JOBS.map((name, index) => ({
    id: index + 1,
    name,
    status: 'completed',
    conclusion: 'success',
  }));

test('derives per-file package ownership from validated Changesets status JSON', () => {
  const plan = changesetPackagePlan({
    changesets: [
      {
        id: 'single-quoted-frontmatter',
        releases: [
          { name: '@aceshooting/lyra-ui', type: 'major' },
          { name: '@aceshooting/lyra-flags', type: 'patch' },
        ],
      },
      {
        id: 'flags-only',
        releases: [{ name: '@aceshooting/lyra-flags', type: 'minor' }],
      },
      { id: 'valid-empty-changeset', releases: [] },
    ],
  });

  assert.deepEqual(plan, [
    {
      id: 'single-quoted-frontmatter',
      packages: ['@aceshooting/lyra-ui', '@aceshooting/lyra-flags'],
    },
    { id: 'flags-only', packages: ['@aceshooting/lyra-flags'] },
    { id: 'valid-empty-changeset', packages: [] },
  ]);
  assert.equal(
    renderChangesetPackagePlan(plan),
    'single-quoted-frontmatter\t@aceshooting/lyra-ui @aceshooting/lyra-flags\n' +
      'flags-only\t@aceshooting/lyra-flags\n' +
      'valid-empty-changeset\t',
  );
});

test('fails closed on malformed or ambiguous Changesets status entries', () => {
  assert.throws(() => changesetPackagePlan({}), /no changesets array/u);
  assert.throws(
    () =>
      changesetPackagePlan({
        changesets: [
          { id: 'duplicate', releases: [{ name: '@aceshooting/lyra-ui', type: 'major' }] },
          { id: 'duplicate', releases: [{ name: '@aceshooting/lyra-flags', type: 'patch' }] },
        ],
      }),
    /duplicate id/u,
  );
  assert.throws(
    () =>
      changesetPackagePlan({
        changesets: [
          { id: 'bad-type', releases: [{ name: '@aceshooting/lyra-ui', type: 'breaking' }] },
        ],
      }),
    /invalid release type/u,
  );
});

test('hosted release planning retains committed changesets in an exact detached checkout', () => {
  const workspace = mkdtempSync(path.join(tmpdir(), 'lyra-detached-release-plan-'));
  const checkout = path.join(workspace, 'checkout');
  const bin = path.join(workspace, 'bin');
  const git = (args) => {
    const result = spawnSync('git', args, { cwd: checkout, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  try {
    for (const directory of ['scripts', 'packages/lyra-ui/scripts', 'packages/fixture', '.changeset']) {
      mkdirSync(path.join(checkout, directory), { recursive: true });
    }
    mkdirSync(bin);
    for (const file of ['scripts/changeset-release-plan.mjs', 'packages/lyra-ui/scripts/is-main-module.mjs']) {
      copyFileSync(path.join(repoRoot, file), path.join(checkout, file));
    }
    writeFileSync(path.join(checkout, 'package.json'), JSON.stringify({ name: 'release-fixture', private: true }));
    writeFileSync(path.join(checkout, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n');
    writeFileSync(path.join(checkout, 'packages/fixture/package.json'), JSON.stringify({
      name: 'release-fixture-package', version: '1.0.0',
    }));
    writeFileSync(path.join(checkout, '.changeset/config.json'), JSON.stringify({
      baseBranch: 'main', changelog: false, commit: false, fixed: [], linked: [],
      access: 'public', updateInternalDependencies: 'patch', ignore: [],
    }));
    writeFileSync(path.join(checkout, '.changeset/already-committed.md'),
      "---\n'release-fixture-package': minor\n---\n\nCommitted pending release.\n");
    const changesetCli = fileURLToPath(import.meta.resolve('@changesets/cli/bin.js'));
    // Run the installed Changesets CLI, stopping release:prepare before any version or build writes.
    writeFileSync(path.join(bin, 'pnpm'), `#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
const command = args[0] === 'changeset'
  ? [${JSON.stringify(changesetCli)}, ...args.slice(1)]
  : args.length === 1 && args[0] === 'release:prepare'
    ? ['scripts/changeset-release-plan.mjs'] : null;
if (!command) process.exit(72);
const result = spawnSync(process.execPath, command, { stdio: 'inherit' });
process.exit(result.status ?? 1);
`, { mode: 0o755 });
    git(['init', '--initial-branch=main']);
    git(['config', 'user.name', 'Release fixture']);
    git(['config', 'user.email', 'release@example.invalid']);
    git(['add', '.']);
    git(['commit', '-m', 'Committed pending release']);
    const dispatchSha = git(['rev-parse', 'HEAD']);
    git(['update-ref', 'refs/remotes/origin/main', dispatchSha]);
    git(['checkout', '--detach', dispatchSha]);
    git(['branch', '-D', 'main']);
    const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, GITHUB_SHA: dispatchSha };
    const missingBase = spawnSync(process.execPath, ['scripts/changeset-release-plan.mjs'], {
      cwd: checkout, env, encoding: 'utf8',
    });
    assert.equal(missingBase.status, 1);
    assert.equal(missingBase.stdout, '', 'failure diagnostics must not become TSV output');
    assert.match(missingBase.stderr, /Failed to find where HEAD diverged from "main"/u);

    const workflow = readFileSync(path.join(repoRoot, '.github/workflows/prepare-artifacts.yml'), 'utf8');
    const releaseStep = /      - name: Prepare release source from pending changesets\n        if: inputs.mode == 'release'\n        run: \|\n(?<commands>(?:          .*\n)+)/u.exec(workflow);
    assert.ok(releaseStep, 'the hosted release step must expose its exact checkout preparation');
    const commands = releaseStep.groups.commands.replace(/^          /gmu, '');
    const runReleaseStep = (sourceSha) => spawnSync('bash', ['-euo', 'pipefail', '-c', commands], {
      cwd: checkout, env: { ...env, GITHUB_SHA: sourceSha }, encoding: 'utf8',
    });
    for (const existingMain of [false, true]) {
      const prepared = runReleaseStep(dispatchSha);
      assert.equal(prepared.status, 0, prepared.stderr);
      assert.equal(prepared.stdout, 'already-committed\trelease-fixture-package\n',
        `all pending changesets remain visible with existing main=${existingMain}`);
      assert.equal(git(['rev-parse', 'HEAD']), dispatchSha);
      assert.equal(git(['rev-parse', 'refs/heads/main']), dispatchSha);
      assert.equal(git(['branch', '--show-current']), '', 'HEAD remains detached');
      assert.equal(git(['status', '--porcelain']), '', 'planning does not mutate tracked source');
    }

    git(['commit', '--allow-empty', '-m', 'Different source commit']);
    const otherSha = git(['rev-parse', 'HEAD']);
    for (const requestedSha of [dispatchSha, otherSha]) {
      const rejected = runReleaseStep(requestedSha);
      assert.notEqual(rejected.status, 0, 'mismatched HEAD or existing main must fail');
      assert.equal(rejected.stdout, '', 'rejected source must not reach release planning');
      assert.equal(git(['rev-parse', 'HEAD']), otherSha);
      assert.equal(git(['rev-parse', 'refs/heads/main']), dispatchSha, 'existing main is never overwritten');
      assert.equal(git(['status', '--porcelain']), '');
    }
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test('budgets the platform matrix for degraded fresh-runner OS dependency setup', () => {
  const workflow = readFileSync(
    path.join(repoRoot, '.github/workflows/ci.yml'),
    'utf8'
  );
  const platformStart = workflow.indexOf('\n  platform-contracts:');
  const stepsStart = workflow.indexOf('\n    steps:', platformStart);
  assert.ok(
    platformStart >= 0 && stepsStart > platformStart,
    'CI must define the platform-contracts job'
  );
  const platformHeader = workflow.slice(platformStart, stepsStart);
  assert.match(
    platformHeader,
    /timeout-minutes: 30/,
    'platform contracts must budget the observed 15-minute install-deps path before tests begin'
  );
});

test('runs the complete lint inventory as concurrent lanes in the stable lint gate', () => {
  const workflow = readFileSync(
    path.join(repoRoot, '.github/workflows/ci.yml'),
    'utf8'
  );
  const lyraPackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'packages/lyra-ui/package.json'), 'utf8')
  );
  const lintStart = workflow.indexOf('\n  lint:');
  const staticStart = workflow.indexOf('\n  static-checks:');
  assert.ok(lintStart > 0 && staticStart > lintStart, 'CI must keep one lint job before static-checks');
  const lintJob = workflow.slice(lintStart, staticStart);
  assert.match(workflow.slice(workflow.lastIndexOf('\n  # release-qualification:', lintStart), lintStart + 10), /# release-qualification: required\n  lint:/u);
  assert.match(lintJob, /name: lint\n/u);
  assert.match(lintJob, /fetch-depth: 0/u);
  assert.match(lintJob, /node-version-file: \.nvmrc/u);
  assert.match(lintJob, /- run: pnpm --filter @aceshooting\/lyra-ui run lint:parallel/u);
  assert.match(lintJob, /CI_JOBS: "3"/u);
  assert.doesNotMatch(workflow, /lint_shard|continue-on-error/u);
  assert.equal(
    lyraPackage.scripts.lint,
    'pnpm run contract-policy && tsc --noEmit -p tsconfig.json && pnpm run test:types && pnpm run check:test-types'
  );
  assert.equal(lyraPackage.scripts['lint:parallel'], 'node scripts/lint-parallel.mjs');
  assert.equal(
    lyraPackage.scripts['lint:ci-shard'],
    'node scripts/lint-ci-shard.mjs'
  );
});

test('requires the exhaustive packed ATTW matrix in the stable release gate', () => {
  const workflow = readFileSync(
    path.join(repoRoot, '.github/workflows/ci.yml'),
    'utf8'
  );
  const rootPackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
  );
  const tarballStart = workflow.indexOf('\n  packed_consumer_tarball:');
  const companionsStart = workflow.indexOf('\n  packed_consumer_companions:');
  const contractStart = workflow.indexOf('\n  packed_consumer_contract:');
  const attwStart = workflow.indexOf('\n  packed_consumer_attw:');
  const publicApiStart = workflow.indexOf('\n  packed_consumer_public_api:');
  const aggregateStart = workflow.indexOf('\n  packed-consumer:');
  const docsStart = workflow.indexOf('\n  docs_build:');
  assert.ok(
    tarballStart > 0 && companionsStart > tarballStart && contractStart > companionsStart &&
      attwStart > contractStart &&
      publicApiStart > attwStart &&
      aggregateStart > publicApiStart &&
      docsStart > aggregateStart,
    'CI must retain separate packed contract, ATTW, public-API, and aggregate jobs'
  );

  const tarballJob = workflow.slice(tarballStart, companionsStart);
  const companionsJob = workflow.slice(companionsStart, contractStart);
  const contractJob = workflow.slice(contractStart, attwStart);
  const attwJob = workflow.slice(attwStart, publicApiStart);
  const publicApiJob = workflow.slice(publicApiStart, aggregateStart);
  const aggregateJob = workflow.slice(aggregateStart, docsStart);
  assert.match(contractJob, /pnpm check:packed-consumer:contracts/u);
  assert.doesNotMatch(contractJob, /pnpm check:packed-consumer(?:\s|$)/u);
  assert.match(contractJob, /- packed_consumer_tarball\b[\s\S]*- packed_consumer_companions\b/u);
  assert.match(contractJob, /name: packed-attw-tarball/u);
  assert.match(contractJob, /name: packed-companion-tarballs/u);
  assert.equal([...contractJob.matchAll(/sha256sum --check SHA256SUMS/gu)].length, 2);
  for (const variable of ['LYRA_PACKED_UI_TARBALL', 'LYRA_PACKED_FLAGS_TARBALL', 'LYRA_PACKED_DOCS_TARBALL']) {
    assert.match(contractJob, new RegExp(`echo "${variable}=`, 'u'));
  }
  assert.doesNotMatch(contractJob, /pnpm build|pnpm pack|check:package-size/u);
  assert.match(companionsJob, /needs: \[build_and_coverage_build, changes\]/u);
  assert.match(companionsJob, /name: lyra-ui-dist/u);
  assert.match(companionsJob, /cd packages\/lyra-flags && pnpm pack --pack-destination/u);
  assert.match(companionsJob, /cd packages\/lyra-docs && pnpm pack --ignore-scripts --pack-destination/u);
  assert.match(companionsJob, /git diff --exit-code/u);
  assert.match(companionsJob, /sha256sum "\$\{tarballs\[@\]\}" > SHA256SUMS/u);
  assert.match(companionsJob, /name: packed-companion-tarballs/u);
  assert.match(companionsJob, /pnpm --filter @aceshooting\/lyra-ui check:package-size/u);
  assert.match(attwJob, /name: packed-consumer \/ attw \/ shard \$\{\{ matrix\.shard_index \}\}\/4/u);
  assert.match(publicApiJob, /--filter @aceshooting\/lyra-ui check:public-api/u);
  assert.match(publicApiJob, /--filter @aceshooting\/lyra-flags check:public-api/u);
  assert.match(attwJob, /shard_index: \[1, 2, 3, 4\]/u);
  assert.match(
    attwJob,
    /node scripts\/check-packed-attw\.mjs --shard-index \$\{\{ matrix\.shard_index \}\} --shard-total 4 --workers 4 --tarball artifacts\/packed-attw\/aceshooting-lyra-ui-\*\.tgz/u
  );
  assert.match(tarballJob, /pnpm pack --pack-destination/u);
  assert.match(tarballJob, /git diff --exit-code/u);
  assert.match(tarballJob, /sha256sum.*> SHA256SUMS/u);
  assert.match(tarballJob, /name: packed-attw-tarball/u);
  assert.match(tarballJob, /if-no-files-found: error/u);
  assert.match(attwJob, /needs: \[packed_consumer_tarball, changes\]/u);
  assert.match(attwJob, /name: packed-attw-tarball/u);
  assert.match(attwJob, /sha256sum --check SHA256SUMS/u);
  assert.match(attwJob, /timeout-minutes: 12/u);
  assert.doesNotMatch(attwJob, /pnpm pack|pnpm build/u);
  for (const dependency of [
    'packed_consumer_contract',
    'packed_consumer_attw',
    'packed_consumer_public_api',
  ]) {
    assert.match(aggregateJob, new RegExp(`- ${dependency}\\b`, 'u'));
  }
  assert.match(aggregateJob, /ATTW_RESULT: \$\{\{ needs\.packed_consumer_attw\.result \}\}/u);
  assert.match(aggregateJob, /if \[\[ "\$ATTW_RESULT" != "success" \]\]/u);

  assert.match(
    rootPackage.scripts['check:packed-consumer:contracts'],
    /check-packed-consumer\.mjs --skip-attw/u
  );
  assert.doesNotMatch(rootPackage.scripts['check:packed-consumer'], /skip-attw/u);
  assert.match(
    rootPackage.scripts['check:packed-consumer'],
    /node scripts\/check-packed-consumer\.mjs/u
  );
  assert.doesNotMatch(workflow, /node-version: 20|ci-pnpm10/u);

});

test('local CI aggregates both workspace public-API authorities and fails if either disappears', () => {
  const completeFixture = [
    '',
    'require_primary_toolchain',
    'pnpm build',
    'pnpm check:packed-consumer',
    'node scripts/check-peer-compatibility.mjs',
    'step "public API semver gate"',
    'pnpm --filter @aceshooting/lyra-ui check:public-api',
    'pnpm --filter @aceshooting/lyra-flags check:public-api',
    'if [[ "$RUN_PLATFORM" == "1" ]]; then',
    '  :',
    'fi',
    '',
  ].join('\n');
  assert.doesNotThrow(() => assertLocalPublicApiAggregate(completeFixture));
  for (const packageName of ['@aceshooting/lyra-ui', '@aceshooting/lyra-flags']) {
    assert.throws(
      () => assertLocalPublicApiAggregate(
        completeFixture.replace(`pnpm --filter ${packageName} check:public-api\n`, ''),
      ),
      new RegExp(`${packageName.replace('/', '\\/')} public-API command`, 'u'),
    );
  }

  assertLocalPublicApiAggregate(
    readFileSync(path.join(repoRoot, 'scripts/ci.sh'), 'utf8'),
  );
});

test('local CI keeps packed coverage in the primary supported-Node lane', () => {
  assertLocalPackedConsumerRouting(
    readFileSync(path.join(repoRoot, 'scripts/ci.sh'), 'utf8'),
  );
});

test('local CI resolves exact Node 22 authority ahead of wrong shims and newer installs and ignores unsupported majors', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-ci-node-resolver-'));
  try {
    const pathDirectory = path.join(root, 'bin');
    const nvmDirectory = path.join(root, 'nvm');
    writeFileSync(path.join(root, '.nvmrc'), '22.23.2\n');

    const activeExact = path.join(pathDirectory, 'node');
    const wrongShim = path.join(pathDirectory, 'node22');
    const exactNvm = path.join(nvmDirectory, 'versions/node/v22.23.2/bin/node');
    const newerNvm = path.join(nvmDirectory, 'versions/node/v22.24.0/bin/node');
    writeFakeNode(activeExact, '22.23.2');
    writeFakeNode(wrongShim, '22.23.1');
    writeFakeNode(exactNvm, '22.23.2');
    writeFakeNode(newerNvm, '22.24.0');

    assert.equal(
      resolveNodeFromCiFixture({ root, major: 22, pathDirectory, nvmDirectory }),
      activeExact,
      'Node 22 must select the active exact .nvmrc patch instead of a wrong node22 shim',
    );
    rmSync(activeExact);
    writeFakeNode(activeExact, '22.23.0');
    assert.equal(
      resolveNodeFromCiFixture({ root, major: 22, pathDirectory, nvmDirectory }),
      exactNvm,
      'Node 22 must select the exact .nvmrc install instead of a newer Node 22 patch',
    );
    writeFileSync(path.join(root, '.nvmrc'), '22.23.2\r\n');
    assert.equal(
      resolveNodeFromCiFixture({ root, major: 22, pathDirectory, nvmDirectory }),
      exactNvm,
      'Node 22 must accept the same exact authority from a CRLF checkout',
    );
    assert.equal(
      resolveNodeFromCiFixture({ root, major: 20, pathDirectory, nvmDirectory }),
      '',
      'unsupported Node majors must not select an executable',
    );

  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('local CI resolves only regular external executables and always returns an absolute path', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-ci-external-command-'));
  try {
    const relativeBin = path.join(root, 'relative-bin');
    const executable = path.join(relativeBin, 'fixture-command');
    const executableDirectory = path.join(root, 'executable-directory');
    mkdirSync(relativeBin);
    mkdirSync(executableDirectory);
    writeFileSync(executable, '#!/bin/sh\nexit 0\n');
    chmodSync(executable, 0o755);
    chmodSync(executableDirectory, 0o755);

    const relativePathResult = resolveCommandFromCiFixture({
      cwd: root,
      pathValue: 'relative-bin:/usr/bin:/bin',
      requested: 'fixture-command',
    });
    assert.equal(relativePathResult.status, 0, relativePathResult.stderr);
    assert.equal(relativePathResult.stdout.trim(), executable);

    const cwdPathResult = resolveCommandFromCiFixture({
      cwd: root,
      pathValue: '/usr/bin:/bin',
      requested: './relative-bin/fixture-command',
    });
    assert.equal(cwdPathResult.status, 0, cwdPathResult.stderr);
    assert.equal(cwdPathResult.stdout.trim(), executable);

    for (const [label, result] of [
      [
        'shell function',
        resolveCommandFromCiFixture({
          cwd: root,
          pathValue: '/usr/bin:/bin',
          requested: 'fixture-command',
          shellPrelude: 'fixture-command() { :; }',
        }),
      ],
      [
        'executable directory',
        resolveCommandFromCiFixture({
          cwd: root,
          pathValue: '/usr/bin:/bin',
          requested: './executable-directory',
        }),
      ],
      [
        'unresolved relative path',
        resolveCommandFromCiFixture({
          cwd: root,
          pathValue: '/usr/bin:/bin',
          requested: './missing-command',
        }),
      ],
    ]) {
      assert.equal(result.status, 0, `${label}: ${result.stderr}`);
      assert.equal(result.stdout, '', `${label} must not resolve as an external executable`);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('local CI structure rejects missing exact toolchain checks and dead public-API gates', () => {
  const source = readFileSync(path.join(repoRoot, 'scripts/ci.sh'), 'utf8');
  const missingExactCheck = source.replace(
    '  "$node_bin" scripts/check-node-version.mjs || return',
    '  :',
  );
  const acceptedUnsupportedMajor = source.replace(
    'if [[ "$node_version" != "22" ]]; then',
    'if [[ "$node_version" == "invalid" ]]; then',
  );
  const publicApiCommands =
    'pnpm --filter @aceshooting/lyra-ui check:public-api\n' +
    'pnpm --filter @aceshooting/lyra-flags check:public-api\n';
  const platformOnlyPublicApi = source
    .replace(publicApiCommands, '')
    .replace(
      'if [[ "$RUN_PLATFORM" == "1" ]]; then\n',
      `if [[ "$RUN_PLATFORM" == "1" ]]; then\n  ${publicApiCommands.replaceAll('\n', '\n  ')}`,
    );
  const deadPublicApi = source
    .replace(publicApiCommands, '')
    .replace(
      '\nrequire_primary_toolchain\n',
      `\ndead_public_api_gate() {\n  ${publicApiCommands.replaceAll('\n', '\n  ')}}\n\nrequire_primary_toolchain\n`,
    );

  for (const [label, mutation] of [
    ['missing exact-Node check', missingExactCheck],
    ['unsupported major accepted', acceptedUnsupportedMajor],
    ['platform-only public API', platformOnlyPublicApi],
    ['dead-function public API', deadPublicApi],
  ]) {
    assert.throws(
      () => {
        assertLocalPublicApiAggregate(mutation);
        assertLocalPackedConsumerRouting(mutation);
      },
      undefined,
      label,
    );
  }
});

test('regen fails closed on the exact toolchain before the canonical complete generator order', () => {
  const regenScript = readFileSync(path.join(repoRoot, 'scripts/regen.sh'), 'utf8');
  const argumentParsing = regenScript.indexOf('\nRUN_VISUAL=0');
  assert.ok(argumentParsing > 0, 'regen.sh must retain parseable argument handling');
  const guard = regenScript.slice(0, argumentParsing);
  assert.match(guard, /\nnode scripts\/check-node-version\.mjs\n/u);
  assert.match(guard, /require\("\.\/package\.json"\)\.packageManager/u);
  assert.match(guard, /\^pnpm@\(\(\?:0\|\[1-9\]\\d\*\)/u);
  assert.doesNotMatch(guard, /EXPECTED_PNPM_VERSION='\d/u);
  assert.match(guard, /actual_pnpm_version="\$\(pnpm --version\)"/u);
  assert.match(
    guard,
    /if \[\[ "\$actual_pnpm_version" != "\$expected_pnpm_version" \]\]; then[\s\S]*?exit 1[\s\S]*?\n  fi/u,
  );
  const versionReader = shellFunctionRange(
    regenScript,
    'read_expected_pnpm_version',
    'verify_regen_pnpm',
  );
  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'lyra-regen-pnpm-authority-'));
  try {
    writeFileSync(
      path.join(fixtureRoot, 'package.json'),
      `${JSON.stringify({ packageManager: 'pnpm@9.8.7' })}\n`,
    );
    const derived = spawnSync(
      'bash',
      ['-c', `${versionReader}\nread_expected_pnpm_version`],
      { cwd: fixtureRoot, encoding: 'utf8' },
    );
    assert.equal(derived.status, 0, derived.stderr);
    assert.equal(derived.stdout, '9.8.7');
    for (const packageManager of ['pnpm@9.8', 'npm@9.8.7', 'pnpm@09.8.7']) {
      writeFileSync(
        path.join(fixtureRoot, 'package.json'),
        `${JSON.stringify({ packageManager })}\n`,
      );
      const malformed = spawnSync(
        'bash',
        ['-c', `${versionReader}\nread_expected_pnpm_version`],
        { cwd: fixtureRoot, encoding: 'utf8' },
      );
      assert.notEqual(malformed.status, 0, packageManager);
      assert.match(malformed.stderr, /must pin one exact pnpm patch/u);
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
  assertCanonicalRegenOrder(regenScript);

  const finalQualityCommand =
    'pnpm --filter @aceshooting/lyra-ui check:component-quality:built';
  const duplicateLateWriter = regenScript.replace(
    `${finalQualityCommand}\n`,
    `${finalQualityCommand}\npnpm --filter @aceshooting/lyra-ui package-metadata\n`,
  );
  assert.throws(
    () => assertCanonicalRegenOrder(duplicateLateWriter),
    /exactly once|after final component quality/u,
    'a duplicated source writer after final quality must fail the canonical-order authority',
  );
});

test('lane groups skip only on an explicit change-scope false, and aggregates only accept that skip', () => {
  const ci = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
  assert.doesNotMatch(ci, /outputs\.(?:runtime|packages|docs_site) == 'true'/u, 'an unknown scope must run the lane');
  const accepted = [...ci.matchAll(/scoped\(\) \{[^\n]*\}|"\$VISUAL_REGRESSION_RESULT" == "skipped"[^\n]*/gu)].map(([line]) => line);
  assert.equal(accepted.length, 4);
  for (const line of accepted) assert.match(line, /(?:needs\.changes\.result \}\}|\$CHANGES_RESULT)" == "success"/u);
});

test('requires complete fail-closed coverage shards before the stable build gate passes', () => {
  const workflow = readFileSync(
    path.join(repoRoot, '.github/workflows/ci.yml'),
    'utf8'
  );
  const lyraPackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'packages/lyra-ui/package.json'), 'utf8')
  );
  const ciScript = readFileSync(path.join(repoRoot, 'scripts/ci.sh'), 'utf8');
  const shardStart = workflow.indexOf('\n  build_and_coverage_coverage_shard:');
  const mergeStart = workflow.indexOf('\n  build_and_coverage_coverage:');
  const aggregateStart = workflow.indexOf('\n  build-and-coverage:');
  const packedStart = workflow.indexOf('\n  packed_consumer_contract:');
  assert.ok(
    shardStart > 0 &&
      mergeStart > shardStart &&
      aggregateStart > mergeStart &&
      packedStart > aggregateStart,
    'CI must retain separate coverage shard, merge/floor, and stable aggregate jobs'
  );

  const shardJob = workflow.slice(shardStart, mergeStart);
  const mergeJob = workflow.slice(mergeStart, aggregateStart);
  const aggregateJob = workflow.slice(aggregateStart, packedStart);
  assert.match(
    shardJob,
    /name: build-and-coverage \/ coverage \/ shard \$\{\{ matrix\.shard \}\}\/4/u
  );
  assert.match(shardJob, /needs: \[build_and_coverage_build, changes\]/u);
  assert.match(shardJob, /fail-fast: false/u);
  assert.match(shardJob, /shard: \[1, 2, 3, 4\]/u);
  assert.match(
    shardJob,
    /image: mcr\.microsoft\.com\/playwright:v[0-9.]+-noble/u
  );
  assert.match(
    shardJob,
    /name: lyra-ui-dist\s+path: packages\/lyra-ui\/dist/u
  );
  assert.match(
    shardJob,
    /node scripts\/coverage-shard-runner\.mjs --shard \$\{\{ matrix\.shard \}\}/u
  );
  assert.match(
    shardJob,
    /if: \$\{\{ always\(\) \}\}[\s\S]*?uses: actions\/upload-artifact@[0-9a-f]+[\s\S]*?name: lyra-ui-coverage-shard-\$\{\{ matrix\.shard \}\}[\s\S]*?path: packages\/lyra-ui\/coverage\/shards\/coverage-shard-\$\{\{ matrix\.shard \}\}[\s\S]*?if-no-files-found: error/u
  );
  assert.equal(
    [...shardJob.matchAll(/uses: actions\/upload-artifact@/gu)].length,
    1,
    'each matrix worker must publish exactly one uniquely named shard artifact'
  );
  assert.doesNotMatch(
    shardJob,
    /coverage\/\.(?:shard|coverage)|coverage\/shards\/\.coverage/u,
    'coverage artifacts must not depend on upload-artifact hidden-file behavior'
  );

  assert.match(mergeJob, /if: \$\{\{ always\(\) && needs\.changes\.outputs\.runtime != 'false' \}\}/u);
  assert.match(mergeJob, /- build_and_coverage_coverage_shard\b/u);
  for (const shard of [1, 2, 3, 4]) {
    assert.match(
      mergeJob,
      new RegExp(
        `uses: actions/download-artifact@[0-9a-f]+[\\s\\S]*?name: lyra-ui-coverage-shard-${shard}\\s+path: packages/lyra-ui/coverage/shards/coverage-shard-${shard}\\b`,
        'u'
      )
    );
  }
  assert.equal(
    [...mergeJob.matchAll(/uses: actions\/download-artifact@/gu)].length,
    4,
    'the merge job must download exactly four individually named shard artifacts'
  );
  assert.doesNotMatch(mergeJob, /pattern:|merge-multiple:/u);
  assert.match(mergeJob, /node scripts\/coverage-shard-runner\.mjs --merge/u);
  assert.match(
    mergeJob,
    /pnpm --filter @aceshooting\/lyra-ui check:coverage-floors/u
  );
  assert.match(
    mergeJob,
    /COVERAGE_SHARD_RESULT: \$\{\{ needs\.build_and_coverage_coverage_shard\.result \}\}/u
  );
  assert.match(
    mergeJob,
    /if \[\[ "\$COVERAGE_SHARD_RESULT" != "success" \]\]/u
  );

  for (const dependency of [
    'build_and_coverage_coverage_shard',
    'build_and_coverage_coverage',
  ]) {
    assert.match(aggregateJob, new RegExp(`- ${dependency}\\b`, 'u'));
    assert.match(
      aggregateJob,
      new RegExp(`needs\\.${dependency}\\.result`, 'u')
    );
  }

  assert.equal(
    lyraPackage.scripts['test:coverage'],
    'node scripts/coverage-shard-runner.mjs'
  );
  assert.match(ciScript, /@aceshooting\/lyra-ui test:coverage/u);
  assert.doesNotMatch(ciScript, /coverage-shard-runner\.mjs --(?:shard|merge)/u);
});

test('normalizes the manually dispatched browser matrix through a closed allowlist', () => {
  assert.deepEqual(
    [
      ...normalizeBrowserInput(
        ' chromium,firefox,chrome,edge,safari,chromium '
      ),
    ],
    ['chromium', 'firefox', 'chrome', 'edge', 'safari']
  );

  for (const input of [
    '',
    'chromium,',
    'chromium,,firefox',
    'Chromium',
    'webkit',
    'chromium; touch /tmp/unsafe',
    'chromium,$(touch /tmp/unsafe)',
    'chromium\nfirefox',
  ]) {
    assert.throws(() => normalizeBrowserInput(input), /browser/iu, input);
  }
});

test('keeps workflow-dispatch browser input out of shell source after allowlist validation', () => {
  const workflow = readFileSync(
    path.join(repoRoot, '.github/workflows/test-all-browsers.yml'),
    'utf8'
  );
  const planJob = workflow.slice(
    workflow.indexOf('  plan:'),
    workflow.indexOf('\n  test:')
  );
  const testJob = workflow.slice(workflow.indexOf('\n  test:'));

  assert.match(planJob, /BROWSERS_INPUT: \$\{\{ inputs\.browsers \}\}/u);
  assert.match(
    planJob,
    /node scripts\/plan-test-browsers\.mjs >> "\$GITHUB_OUTPUT"/u
  );
  assert.doesNotMatch(planJob, /<<<\s*"\$\{\{ inputs\.browsers \}\}"/u);
  assert.match(testJob, /TEST_BROWSER: \$\{\{ matrix\.browser \}\}/u);
  assert.match(testJob, /shard: \[1, 2, 3, 4\]/u);
  assert.match(testJob, /TEST_SHARD: \$\{\{ matrix\.shard \}\}/u);
  assert.match(testJob, /--browsers "\$TEST_BROWSER"/u);
  assert.match(testJob, /--shards "\$TEST_SHARD"/u);
  assert.doesNotMatch(testJob, /--browsers\s+"\$\{\{ matrix\.browser \}\}"/u);
  assert.match(testJob, /# release-qualification: matrix[\s\S]*\n  qualification:/u);
});

test('deploys the docs CI built and checked, only after that CI run succeeded, with scoped Pages credentials', () => {
  const workflow = readFileSync(
    path.join(repoRoot, '.github/workflows/deploy-docs.yml'),
    'utf8'
  );
  const rootPackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
  );
  const workflowPermissions = workflow.slice(
    workflow.indexOf('\npermissions:'),
    workflow.indexOf('\nconcurrency:')
  );
  const buildJob = workflow.slice(
    workflow.indexOf('  build:'),
    workflow.indexOf('\n  deploy:')
  );
  const deployJob = workflow.slice(workflow.indexOf('\n  deploy:'));

  assert.match(workflowPermissions, /contents: read/u);
  assert.doesNotMatch(workflowPermissions, /pages: write|id-token: write/u);
  assert.doesNotMatch(buildJob, /pages: write|id-token: write/u);
  assert.match(deployJob, /permissions:\n\s+pages: write\n\s+id-token: write/u);
  assert.doesNotMatch(buildJob, /pnpm docs:build|pnpm install|actions\/checkout/u);
  assert.match(workflow, /on:\n  workflow_run:\n    workflows: \[CI\]\n    types: \[completed\]\n    branches: \[main\]/u);
  assert.match(buildJob, /github\.event\.workflow_run\.conclusion == 'success' && github\.event\.workflow_run\.event == 'push'/u);
  assert.match(buildJob, /name: storybook-static[\s\S]*run-id: \$\{\{ github\.event\.workflow_run\.id \}\}/u);
  assert.match(buildJob, /permissions:\n\s+actions: read\n\s+contents: read/u);
  assert.match(buildJob, /commits\/main" --jq \.sha/u);
  assert.match(deployJob, /if: \$\{\{ needs\.build\.outputs\.current == 'true' \}\}/u);
  assert.match(rootPackage.scripts['docs:build'], /^pnpm manifest:check &&/u);
  const ci = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
  const docsBuild = ci.slice(ci.indexOf('\n  docs_build:'), ci.indexOf('\n  docs_storybook_contract:'));
  assert.match(docsBuild, /- run: pnpm docs:build[\s\S]*LYRA_DOCS_BASE_URL: https:\/\/www\.lyra-ui\.com\/docs\//u);
  assert.match(docsBuild, /name: storybook-static/u);
});

test('root scripts keep canonical docs and policy entrypoints only', () => {
  const rootPackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
  );

  assert.equal(rootPackage.scripts.dev, 'storybook dev -p 6006');
  assert.equal(rootPackage.scripts.docs, rootPackage.scripts.dev);
  assert.equal(rootPackage.scripts.storybook, undefined);
  assert.equal(rootPackage.scripts['build-storybook'], undefined);
  assert.equal(rootPackage.scripts['provenance:check'], undefined);
});

test('full browser sweep scripts remove their temporary lane logs on every exit', () => {
  for (const relativePath of ['scripts/test.sh', 'scripts/test_all_browsers.sh']) {
    const source = readFileSync(path.join(repoRoot, relativePath), 'utf8');
    const tempDirectoryIndex = source.indexOf('LOG_DIR="$(mktemp -d)"');
    const cleanupIndex = source.indexOf('cleanup_logs()');
    const trapIndex = source.indexOf('trap cleanup_logs EXIT');
    const cleanup = source.slice(cleanupIndex, trapIndex);

    assert.ok(
      tempDirectoryIndex >= 0,
      `${relativePath} must create isolated lane logs`
    );
    assert.ok(
      cleanupIndex > tempDirectoryIndex,
      `${relativePath} must define cleanup after mktemp`
    );
    assert.ok(
      trapIndex > cleanupIndex,
      `${relativePath} must install its cleanup trap`
    );
    assert.match(cleanup, /local exit_status=\$\?/u);
    assert.match(cleanup, /trap - EXIT/u);
    assert.match(cleanup, /rm -rf -- "\$LOG_DIR"/u);
    assert.match(cleanup, /exit "\$exit_status"/u);
  }
});

test('runs a checksum-pinned actionlint in CI and the local aggregate', () => {
  const rootPackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
  );
  const workflowCheck = readFileSync(
    path.join(repoRoot, 'scripts/check-workflows.sh'),
    'utf8'
  );
  const ciWorkflow = readFileSync(
    path.join(repoRoot, '.github/workflows/ci.yml'),
    'utf8'
  );
  const ciScript = readFileSync(path.join(repoRoot, 'scripts/ci.sh'), 'utf8');

  assert.equal(
    rootPackage.scripts['check:workflows'],
    './scripts/check-workflows.sh'
  );
  assert.match(workflowCheck, /ACTIONLINT_VERSION="1\.7\.12"/u);
  assert.match(
    workflowCheck,
    /ACTIONLINT_SHA256="8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8"/u
  );
  assert.match(workflowCheck, /sha256sum --check/u);
  assert.doesNotMatch(workflowCheck, /releases\/latest|:latest/u);
  assert.match(ciWorkflow, /- run: pnpm check:workflows/u);
  assert.match(
    ciScript,
    /step "workflow syntax and policy"\s+pnpm check:workflows/u
  );
});

test('collects every GitHub API page and fails closed at its page bound', async () => {
  const pages = [
    Array.from({ length: 100 }, (_, index) => index),
    Array.from({ length: 100 }, (_, index) => index + 100),
    [200],
  ];
  const seen = await collectGitHubPages(async (page) => pages[page - 1], {
    pageSize: 100,
    maxPages: 4,
  });
  assert.equal(seen.length, 201);
  assert.equal(seen.at(-1), 200);

  await assert.rejects(
    collectGitHubPages(async () => Array(100).fill('job'), {
      pageSize: 100,
      maxPages: 2,
    }),
    /pagination exceeded 2 pages/
  );
});

test('requires one successful CI workflow run for the exact release commit and every matrix leg', () => {
  const run = {
    id: 42,
    name: 'CI',
    path: '.github/workflows/ci.yml',
    event: 'push',
    head_branch: 'main',
    head_sha: sha,
    status: 'completed',
    conclusion: 'success',
  };

  assert.deepEqual(evaluateCiRun({ run, jobs: successfulJobs(), sha }), {
    state: 'success',
    message: `CI run 42 passed all ${REQUIRED_CI_JOBS.length} required jobs for ${sha}.`,
  });

  const requiredSampleJob = REQUIRED_CI_JOBS[REQUIRED_CI_JOBS.length - 1];
  const missingRequiredJob = successfulJobs().filter(
    (job) => job.name !== requiredSampleJob
  );
  assert.deepEqual(evaluateCiRun({ run, jobs: missingRequiredJob, sha }), {
    state: 'failed',
    message: `CI run 42 is missing required job '${requiredSampleJob}'.`,
  });
  assert.equal(
    evaluateCiRun({
      run: { ...run, head_sha: 'f'.repeat(40) },
      jobs: successfulJobs(),
      sha,
    }).state,
    'failed'
  );
  assert.equal(
    evaluateCiRun({
      run: { ...run, conclusion: 'failure' },
      jobs: successfulJobs(),
      sha,
    }).state,
    'failed'
  );
  assert.equal(
    evaluateCiRun({
      run: { ...run, event: 'pull_request', head_branch: 'feature' },
      jobs: successfulJobs(),
      sha,
    }).state,
    'failed'
  );
  assert.deepEqual(
    evaluateCiRun({
      run,
      jobs: [
        ...successfulJobs(),
        {
          name: 'new-required-job',
          status: 'completed',
          conclusion: 'failure',
        },
      ],
      sha,
    }),
    {
      state: 'failed',
      message: "CI run 42 job 'new-required-job' is completed/failure.",
    }
  );
});

test('requires one successful full-engine run for the exact release commit and every required shard', () => {
  const run = {
    id: 84,
    name: 'Full browser-engine suite',
    path: '.github/workflows/full-engine.yml',
    event: 'workflow_dispatch',
    head_branch: 'main',
    head_sha: sha,
    status: 'completed',
    conclusion: 'success',
  };

  assert.deepEqual(
    evaluateFullEngineRun({ run, jobs: successfulFullEngineJobs(), sha }),
    {
      state: 'success',
      message: `Full browser-engine suite run 84 passed all ${REQUIRED_FULL_ENGINE_JOBS.length} required jobs for ${sha}.`,
    }
  );

  // Derived from the qualification manifest rather than naming a shard literally: the shard count
  // is a matrix knob (4 -> 8 when full-engine.yml was widened), and a hardcoded 'webkit / shard 4/4'
  // silently rots the moment it moves.
  const droppedJob = REQUIRED_FULL_ENGINE_JOBS[REQUIRED_FULL_ENGINE_JOBS.length - 1];
  const missingShard = successfulFullEngineJobs().filter((job) => job.name !== droppedJob);
  assert.deepEqual(evaluateFullEngineRun({ run, jobs: missingShard, sha }), {
    state: 'failed',
    message: `Full browser-engine suite run 84 is missing required job '${droppedJob}'.`,
  });
  assert.equal(
    evaluateFullEngineRun({
      run: { ...run, head_sha: 'f'.repeat(40) },
      jobs: successfulFullEngineJobs(),
      sha,
    }).state,
    'failed'
  );
  assert.equal(
    evaluateFullEngineRun({
      run: { ...run, event: 'schedule' },
      jobs: successfulFullEngineJobs(),
      sha,
    }).state,
    'failed'
  );
});

test('requires the exact main-branch Test All Browsers run and every Chromium-family browser job', () => {
  assert.deepEqual(REQUIRED_TEST_ALL_BROWSER_JOBS, ['chrome', 'chromium', 'edge']);
  const run = {
    id: 126,
    name: 'Test All Browsers',
    path: '.github/workflows/test-all-browsers.yml',
    event: 'workflow_dispatch',
    head_branch: 'main',
    head_sha: sha,
    status: 'completed',
    conclusion: 'success',
  };

  assert.deepEqual(
    evaluateTestAllBrowsersRun({
      run,
      jobs: successfulTestAllBrowserJobs(),
      sha,
    }),
    {
      state: 'success',
      message: `Test All Browsers run 126 passed all ${REQUIRED_TEST_ALL_BROWSER_JOBS.length} required jobs for ${sha}.`,
    }
  );

  const missingBrowser = successfulTestAllBrowserJobs().slice(0, -1);
  assert.deepEqual(
    evaluateTestAllBrowsersRun({ run, jobs: missingBrowser, sha }),
    {
      state: 'failed',
      message: "Test All Browsers run 126 is missing required job 'edge'.",
    }
  );
  const skippedBrowser = successfulTestAllBrowserJobs();
  skippedBrowser.at(-1).conclusion = 'skipped';
  assert.equal(
    evaluateTestAllBrowsersRun({ run, jobs: skippedBrowser, sha }).state,
    'failed'
  );
  for (const mismatchedRun of [
    { ...run, head_sha: 'f'.repeat(40) },
    { ...run, head_branch: 'feature' },
    { ...run, event: 'schedule' },
    { ...run, name: 'Another workflow' },
    { ...run, path: '.github/workflows/another.yml' },
  ]) {
    assert.equal(
      evaluateTestAllBrowsersRun({
        run: mismatchedRun,
        jobs: successfulTestAllBrowserJobs(),
        sha,
      }).state,
      'failed'
    );
  }
});

test('waits for a pending exact-SHA CI run without treating the publish check as a dependency', async () => {
  let calls = 0;
  const pendingRun = {
    id: 42,
    name: 'CI',
    path: '.github/workflows/ci.yml',
    event: 'push',
    head_branch: 'main',
    head_sha: sha,
    status: 'in_progress',
    conclusion: null,
  };
  const result = await waitForSuccessfulCi({
    sha,
    timeoutMs: 100,
    pollMs: 1,
    listRuns: async () => {
      calls += 1;
      return [
        {
          ...pendingRun,
          ...(calls > 1 ? { status: 'completed', conclusion: 'success' } : {}),
        },
      ];
    },
    listJobs: async () => successfulJobs(),
    delay: async () => {},
    now: (() => {
      let value = 0;
      return () => value++;
    })(),
  });

  assert.equal(result.run.id, 42);
  assert.equal(calls, 2);
});

test('times out when exact-SHA CI never completes', async () => {
  await assert.rejects(
    waitForSuccessfulCi({
      sha,
      timeoutMs: 2,
      pollMs: 1,
      listRuns: async () => [
        {
          id: 9,
          name: 'CI',
          path: '.github/workflows/ci.yml',
          event: 'push',
          head_branch: 'main',
          head_sha: sha,
          status: 'queued',
          conclusion: null,
        },
      ],
      listJobs: async () => [],
      delay: async () => {},
      now: (() => {
        let value = 0;
        return () => value++;
      })(),
    }),
    /Timed out waiting for a successful CI run/
  );
});

test('waits for a successful exact-SHA full-engine run', async () => {
  const run = {
    id: 84,
    name: 'Full browser-engine suite',
    path: '.github/workflows/full-engine.yml',
    event: 'workflow_dispatch',
    head_branch: 'main',
    head_sha: sha,
    status: 'completed',
    conclusion: 'success',
  };
  const result = await waitForSuccessfulFullEngine({
    sha,
    listRuns: async () => [run],
    listJobs: async () => successfulFullEngineJobs(),
    delay: async () => {},
  });
  assert.equal(result.run.id, 84);
});

test('waits for a successful exact-SHA Test All Browsers run', async () => {
  const run = {
    id: 126,
    name: 'Test All Browsers',
    path: '.github/workflows/test-all-browsers.yml',
    event: 'workflow_dispatch',
    head_branch: 'main',
    head_sha: sha,
    status: 'completed',
    conclusion: 'success',
  };
  const result = await waitForSuccessfulTestAllBrowsers({
    sha,
    listRuns: async () => [run],
    listJobs: async () => successfulTestAllBrowserJobs(),
    delay: async () => {},
  });
  assert.equal(result.run.id, 126);
});

test('resolves only supported release tags', () => {
  assert.deepEqual(parseReleaseTag('lyra-ui@8.1.0'), {
    tag: 'lyra-ui@8.1.0',
    directory: 'packages/lyra-ui',
    packageName: '@aceshooting/lyra-ui',
    version: '8.1.0',
  });
  assert.deepEqual(parseReleaseTag('lyra-flags@1.4.1'), {
    tag: 'lyra-flags@1.4.1',
    directory: 'packages/lyra-flags',
    packageName: '@aceshooting/lyra-flags',
    version: '1.4.1',
  });
  assert.deepEqual(parseReleaseTag('lyra-docs@0.1.0'), {
    tag: 'lyra-docs@0.1.0',
    directory: 'packages/lyra-docs',
    packageName: '@aceshooting/lyra-docs',
    version: '0.1.0',
  });
  assert.throws(
    () => parseReleaseTag('other@1.0.0'),
    /Unsupported release tag/
  );
  assert.throws(() => parseReleaseTag('lyra-ui@8'), /Unsupported release tag/);
  assert.throws(() => parseReleaseTag('lyra-ui@8.1.0-beta.1'), /stable/);
  assert.throws(() => parseReleaseTag('lyra-ui@8.1.0+rebuild.1'), /stable/);
});

test('release workflows accept the document companion and reject unsupported tag forms', () => {
  const release = readFileSync(path.join(repoRoot, '.github/workflows/release.yml'), 'utf8');
  assert.match(release, /options:\n(?:          - [^\n]+\n)*          - lyra-docs\n/u);
  const verification = readFileSync(path.join(repoRoot, '.github/workflows/release-verification.yml'), 'utf8');
  const resolveStep = verification.match(/- name: Resolve release tag[\s\S]*?        run: \|\n([\s\S]*?)(?=\n      - name: Checkout)/u)?.[1];
  assert.ok(resolveStep, 'the pre-checkout tag guard must exist');
  const script = resolveStep.replace(/^          /gmu, '');
  for (const [tag, accepted] of [
    ['lyra-ui@25.6.1', true],
    ['lyra-flags@2.3.0', true],
    ['lyra-docs@0.1.0', true],
    ['lyra-docs@0.1.0-beta.1', false],
    ['lyra-docs@0.1.0+rebuild.1', false],
    ['lyra-docs@00.1.0', false],
    ['lyra-other@0.1.0', false],
    ['refs/tags/lyra-docs@0.1.0', false],
  ]) {
    const result = spawnSync('bash', ['-c', script], {
      env: { ...process.env, REQUESTED_TAG: tag, GITHUB_OUTPUT: '/dev/null' },
      encoding: 'utf8',
    });
    assert.equal(result.status === 0, accepted, `${tag}: ${result.stdout}${result.stderr}`);
    if (accepted) assert.equal(parseReleaseTag(tag).tag, tag);
    else assert.throws(() => parseReleaseTag(tag), /Unsupported release tag/u);
  }
});

test('initial document release selects its existing version without releasing another package', () => {
  const docs = { directory: 'packages/lyra-docs', name: '@aceshooting/lyra-docs', version: '0.1.0' };
  const packages = [
    { directory: 'packages/lyra-ui', name: '@aceshooting/lyra-ui', version: '25.6.1' },
    docs,
  ];
  const plan = planReleaseTags({ packages, existingTags: [], selection: 'lyra-docs' });
  assert.deepEqual(plan, [parseReleaseTag('lyra-docs@0.1.0')]);
  assert.deepEqual(validateTarballIdentity(docs, plan[0]), { name: docs.name, version: docs.version });
  assert.throws(() => validateTarballIdentity({ ...docs, version: '0.1.1' }, plan[0]), /does not match tag version/u);
  assert.throws(() => validateTarballIdentity({ ...docs, name: '@aceshooting/lyra-ui' }, plan[0]), /does not match tag package/u);
  assert.throws(() => planReleaseTags({ packages, existingTags: ['lyra-docs@0.1.0'], selection: 'lyra-docs' }), /already exists/u);
});

test('document companion publishing does not schedule the UI website feed check', () => {
  const workflow = readFileSync(path.join(repoRoot, '.github/workflows/release-feed-freshness.yml'), 'utf8');
  assert.match(workflow, /if: \$\{\{ github\.event_name == 'workflow_dispatch' \|\| \(github\.event\.workflow_run\.conclusion == 'success' && !startsWith\(github\.event\.workflow_run\.head_branch, 'lyra-docs@'\)\) \}\}/u);
});

test('binds privileged workflow context to the requested peeled tag', () => {
  assert.deepEqual(
    validateWorkflowSource({
      tag: 'lyra-ui@8.1.0',
      eventName: 'workflow_dispatch',
      githubRef: 'refs/tags/lyra-ui@8.1.0',
      githubSha: sha,
      tagCommitSha: sha,
    }),
    {
      tag: 'lyra-ui@8.1.0',
      commitSha: sha,
      ref: 'refs/tags/lyra-ui@8.1.0',
      eventName: 'workflow_dispatch',
    }
  );
  assert.throws(
    () =>
      validateWorkflowSource({
        tag: 'lyra-ui@8.1.0',
        eventName: 'workflow_dispatch',
        githubRef: 'refs/heads/main',
        githubSha: sha,
        tagCommitSha: sha,
      }),
    /Dispatch the workflow with --ref 'lyra-ui@8.1.0'/
  );
  assert.throws(
    () =>
      validateWorkflowSource({
        tag: 'lyra-ui@8.1.0',
        eventName: 'workflow_dispatch',
        githubRef: 'refs/tags/lyra-ui@8.1.0',
        githubSha: 'f'.repeat(40),
        tagCommitSha: sha,
      }),
    /does not match tag/
  );
  assert.throws(
    () =>
      validateWorkflowSource({
        tag: 'lyra-ui@8.1.0',
        eventName: 'pull_request',
        githubRef: 'refs/tags/lyra-ui@8.1.0',
        githubSha: sha,
        tagCommitSha: sha,
      }),
    /not permitted/
  );
});

test('requires an annotated tag whose peeled commit is the checkout', () => {
  assert.deepEqual(
    validateAnnotatedTag({
      tag: 'lyra-ui@8.1.0',
      objectType: 'tag',
      checkoutSha: sha,
      tagCommitSha: sha,
    }),
    { tag: 'lyra-ui@8.1.0', commitSha: sha }
  );
  assert.throws(
    () =>
      validateAnnotatedTag({
        tag: 'lyra-ui@8.1.0',
        objectType: 'commit',
        checkoutSha: sha,
        tagCommitSha: sha,
      }),
    /must be annotated/
  );
  assert.throws(
    () =>
      validateAnnotatedTag({
        tag: 'lyra-ui@8.1.0',
        objectType: 'tag',
        checkoutSha: sha,
        tagCommitSha: 'f'.repeat(40),
      }),
    /does not match tag/
  );
});

test('requires exactly one release tarball and verifies its package identity', () => {
  assert.equal(selectReleaseTarball(['/tmp/a.tgz']), '/tmp/a.tgz');
  assert.throws(() => selectReleaseTarball([]), /exactly one/);
  assert.throws(
    () => selectReleaseTarball(['/tmp/a.tgz', '/tmp/b.tgz']),
    /exactly one/
  );

  const expected = parseReleaseTag('lyra-ui@8.1.0');
  assert.deepEqual(
    validateTarballIdentity(
      { name: '@aceshooting/lyra-ui', version: '8.1.0' },
      expected
    ),
    { name: '@aceshooting/lyra-ui', version: '8.1.0' }
  );
  assert.throws(
    () =>
      validateTarballIdentity(
        { name: '@aceshooting/lyra-flags', version: '8.1.0' },
        expected
      ),
    /package name/
  );
  assert.throws(
    () =>
      validateTarballIdentity(
        { name: '@aceshooting/lyra-ui', version: '8.0.0' },
        expected
      ),
    /package version/
  );
});

test('requires the downloaded release tarball to byte-match a tagged-source rebuild', () => {
  assert.deepEqual(
    validateRebuiltTarballBytes(
      Buffer.from('same tarball'),
      Buffer.from('same tarball')
    ),
    { byteLength: 12 }
  );
  assert.throws(
    () =>
      validateRebuiltTarballBytes(
        Buffer.from('release'),
        Buffer.from('rebuilt')
      ),
    /does not byte-match the exact tagged-source rebuild/
  );
  assert.throws(
    () => validateRebuiltTarballBytes('release', Buffer.from('rebuilt')),
    /requires two Buffer values/
  );
});

test('updates exactly one narrowly anchored README Status line and fails closed on drift', () => {
  const line =
    '`@aceshooting/lyra-ui` source is versioned at `8.0.0`; `@aceshooting/lyra-flags` source at `2.0.0` — releases.';
  assert.equal(
    updateReadmeStatusLine(line, {
      lyraUiVersion: '8.1.0',
      lyraFlagsVersion: '2.0.1',
    }),
    '`@aceshooting/lyra-ui` source is versioned at `8.1.0`; `@aceshooting/lyra-flags` source at `2.0.1` — releases.'
  );
  assert.throws(
    () =>
      updateReadmeStatusLine('No release status here.', {
        lyraUiVersion: '8.1.0',
        lyraFlagsVersion: '2.0.1',
      }),
    /expected exactly one source-version line, found 0/
  );
  assert.throws(
    () =>
      updateReadmeStatusLine(`${line}\n${line}`, {
        lyraUiVersion: '8.1.0',
        lyraFlagsVersion: '2.0.1',
      }),
    /expected exactly one source-version line, found 2/
  );
  assert.throws(
    () =>
      updateReadmeStatusLine(line, {
        lyraUiVersion: 'not-semver',
        lyraFlagsVersion: '2.0.1',
      }),
    /invalid version/
  );
  assert.throws(
    () =>
      updateReadmeStatusLine(
        '`@aceshooting/lyra-ui` is published at `8.0.0`; `@aceshooting/lyra-flags` at `2.0.0`.',
        { lyraUiVersion: '8.1.0', lyraFlagsVersion: '2.0.1' }
      ),
    /expected exactly one source-version line, found 0/
  );
  assert.throws(
    () =>
      updateReadmeStatusLine(line, {
        lyraUiVersion: '8.1.0+rebuild.1',
        lyraFlagsVersion: '2.0.1',
      }),
    /invalid version/
  );
  assert.throws(
    () =>
      updateReadmeStatusLine(line, {
        lyraUiVersion: '8.1.0-beta.1',
        lyraFlagsVersion: '2.0.1',
      }),
    /invalid version/
  );
});

test('updates exactly one anchored count in each authored documentation surface', () => {
  const docsIndex = '# Docs\nLibrary — 296 custom elements across 11 component families.\n';
  const introduction = '<div><strong>296</strong><span>custom elements</span></div>\n';
  const updated = updateDocumentationCounts(docsIndex, introduction, {
    tagCount: 304,
    familyCount: 11,
  });
  assert.equal(
    updated.docsIndex,
    '# Docs\nLibrary — 304 custom elements across 11 component families.\n',
  );
  assert.equal(
    updated.introduction,
    '<div><strong>304</strong><span>custom elements</span></div>\n',
  );
  assert.deepEqual(
    updateDocumentationCounts(updated.docsIndex, updated.introduction, {
      tagCount: 304,
      familyCount: 11,
    }),
    updated,
    'running the count updater again must be idempotent',
  );
});

test('documentation count updates reject missing or duplicate anchors and invalid counts', () => {
  const docsIndex = '296 custom elements across 11 component families';
  const introduction = '<strong>296</strong><span>custom elements</span>';
  const counts = { tagCount: 304, familyCount: 11 };
  assert.throws(
    () => updateDocumentationCounts('No count here.', introduction, counts),
    /docs\/index\.md catalog count, found 0/u,
  );
  assert.throws(
    () => updateDocumentationCounts(`${docsIndex}\n${docsIndex}`, introduction, counts),
    /docs\/index\.md catalog count, found 2/u,
  );
  assert.throws(
    () => updateDocumentationCounts(docsIndex, 'No count here.', counts),
    /Introduction\.mdx count, found 0/u,
  );
  assert.throws(
    () => updateDocumentationCounts(docsIndex, `${introduction}\n${introduction}`, counts),
    /Introduction\.mdx count, found 2/u,
  );
  assert.throws(
    () => updateDocumentationCounts(docsIndex, introduction, { ...counts, tagCount: 0 }),
    /custom-element count must be a positive safe integer/u,
  );
});

test('release workflows verify tagged-source bytes without exposing protected credentials', () => {
  const reusableVerification = readFileSync(
    path.join(repoRoot, '.github/workflows/release-verification.yml'),
    'utf8'
  );
  const publishWorkflow = readFileSync(
    path.join(repoRoot, '.github/workflows/publish.yml'),
    'utf8'
  );
  const signWorkflow = readFileSync(
    path.join(repoRoot, '.github/workflows/sign-release.yml'),
    'utf8'
  );

  const protectedPublish = publishWorkflow.slice(
    publishWorkflow.indexOf('\n  publish:\n')
  );
  const protectedSign = signWorkflow.slice(signWorkflow.indexOf('\n  sign:\n'));

  for (const caller of [publishWorkflow, signWorkflow]) {
    const workflow = `${reusableVerification}\n${caller}`;
    assert.match(workflow, /persist-credentials: false/);
    assert.match(workflow, /validate-workflow-source/);
    assert.match(workflow, /wait-ci/);
    assert.match(workflow, /wait-test-all-browsers/);
    assert.match(workflow, /wait-full-engine/);
    assert.match(workflow, /validate-tarball/);
    assert.match(workflow, /compare-rebuild/);
    assert.match(workflow, /Upload byte-verified tarball/);
    assert.match(workflow, /Download byte-verified tarball/);
    assert.match(workflow, /EXPECTED_SHA256/);
    assert.match(workflow, /tag_sha:/);
    assert.match(workflow, /git ls-remote --tags/);
    assert.match(
      workflow,
      /gh release upload "\$TAG" "\$TARBALL"[^\n]+--clobber/
    );
    assert.match(workflow, /release-roundtrip/);
    assert.match(workflow, /retention-days: 14/);
    assert.match(workflow, /\.sigstore\.json/);
    assert.match(workflow, /intoto="\$TARBALL\.intoto\.jsonl"/);
    assert.match(
      workflow,
      /gh release upload "\$TAG" "\$provenance" "\$intoto"[^\n]+--clobber/
    );
    assert.ok(
      workflow.indexOf('compare-rebuild') <
        workflow.indexOf('actions/upload-artifact@')
    );
    assert.ok(
      workflow.indexOf('Rebind release tag and tarball after approval') <
        workflow.indexOf('actions/attest@')
    );
    assert.ok(
      workflow.indexOf('Verify transferred artifact digest') <
        workflow.indexOf('actions/attest@')
    );
  }

  for (const protectedJob of [protectedPublish, protectedSign]) {
    assert.match(protectedJob, /environment: npm-publish/);
    assert.doesNotMatch(
      protectedJob,
      /actions\/checkout@|pnpm\/action-setup|pnpm install/
    );
    assert.doesNotMatch(protectedJob, /scripts\/release-integrity\.mjs/);
  }

  assert.match(
    publishWorkflow,
    /npm publish "\$TARBALL" --access public --dry-run/
  );
  assert.match(publishWorkflow, /npm publish "\$TARBALL" --access public\n/);
  assert.ok(
    publishWorkflow.indexOf('actions/attest@') <
      publishWorkflow.indexOf('npm publish "$TARBALL"')
  );
});

test('checkout-free publishing uses the Node version exported by tagged-source verification', () => {
  const verification = readFileSync(
    path.join(repoRoot, '.github/workflows/release-verification.yml'), 'utf8',
  );
  const publish = readFileSync(path.join(repoRoot, '.github/workflows/publish.yml'), 'utf8');
  const protectedPublish = publish.slice(publish.indexOf('\n  publish:\n'));
  const workflowOutputs = verification.slice(0, verification.indexOf('\njobs:'));
  const verificationJob = verification.slice(verification.indexOf('\n  verify:\n'));

  assert.match(workflowOutputs, /node_version:\n\s+description: [^\n]+\n\s+value: \$\{\{ jobs\.verify\.outputs\.node_version \}\}/u);
  assert.match(verificationJob, /node_version: \$\{\{ steps\.node\.outputs\['node-version'\] \}\}/u);
  assert.match(verificationJob, /- uses: actions\/setup-node@[^\n]+\n\s+id: node\n\s+with:\n\s+node-version-file: \.nvmrc/u);
  assert.ok(verificationJob.indexOf('actions/checkout@') < verificationJob.indexOf('actions/setup-node@'));
  assert.match(protectedPublish, /node-version: \$\{\{ needs\.verify\.outputs\.node_version \}\}/u);
  assert.doesNotMatch(protectedPublish, /node-version-file:|actions\/checkout@|pnpm\/action-setup|pnpm install/u);
  assert.doesNotMatch(protectedPublish, /node-version: ['"]?v?\d/u,
    'publishing must inherit the verified runtime, not duplicate the repository version pin');
});

test('release workflow qualifies the exact main commit before tagging, releasing, and publishing', () => {
  const releaseWorkflow = readFileSync(
    path.join(repoRoot, '.github/workflows/release.yml'),
    'utf8'
  );
  const job = (name, next) =>
    releaseWorkflow.slice(
      releaseWorkflow.indexOf(`\n  ${name}:\n`),
      next ? releaseWorkflow.indexOf(`\n  ${next}:\n`) : undefined
    );
  const plan = job('plan', 'pack');
  const pack = job('pack', 'release');
  const release = job('release');

  const triggers = releaseWorkflow.slice(
    releaseWorkflow.indexOf('\non:\n'),
    releaseWorkflow.indexOf('\npermissions:\n')
  );
  assert.match(triggers, /^\non:\n  workflow_dispatch:\n/);
  assert.doesNotMatch(triggers, /\n  (push|release|schedule|pull_request|workflow_run):/);
  assert.match(releaseWorkflow, /\npermissions:\n  contents: read\n/);
  for (const uses of releaseWorkflow.match(/uses: \S+/g) ?? []) {
    assert.match(uses, /@[0-9a-f]{40}$/u, `${uses} must be pinned to a commit SHA`);
  }

  // Plan: main only, unreleased tags from committed versions, all three gates on the exact SHA.
  assert.match(plan, /"\$GITHUB_REF" != "refs\/heads\/main"/);
  assert.match(plan, /release-integrity\.mjs plan-release/);
  assert.match(
    plan,
    /wait-ci[\s\S]*--sha "\$SHA" --workflow ci\.yml[\s\S]*wait-test-all-browsers[\s\S]*--sha "\$SHA" --workflow test-all-browsers\.yml[\s\S]*wait-full-engine[\s\S]*--sha "\$SHA" --workflow full-engine\.yml/
  );
  assert.doesNotMatch(plan, /contents: write|actions: write/);

  // Pack: credential-free, pinned toolchain, the same pack command the publish rebuild compares.
  assert.match(pack, /persist-credentials: false/);
  assert.match(pack, /node-version-file: \.nvmrc/);
  assert.match(pack, /pnpm install --frozen-lockfile/);
  assert.match(pack, /pnpm --filter "\$name" --fail-if-no-match pack --pack-destination/);
  assert.match(pack, /check:component-quality:built/);
  assert.match(pack, /validate-tarball --tag "\$tag"/);
  assert.match(pack, /CHANGELOG\.md[\s\S]*custom-elements\.json[\s\S]*llms\.txt[\s\S]*llms-full\.txt/);
  assert.match(pack, /git diff --exit-code/);
  assert.doesNotMatch(pack, /contents: write|GH_TOKEN/);

  // Release: no checkout or repository script under the write token; atomic annotated tags on
  // the qualified SHA, then releases, then an explicit publish dispatch on each tag.
  assert.match(release, /needs: \[plan, pack\]/);
  assert.doesNotMatch(release, /actions\/checkout@|pnpm |scripts\//);
  const tag = release.indexOf('git tag -a "$tag" -m "Release $tag" "$SHA"');
  const pushTags = release.indexOf('git push --atomic origin');
  const createRelease = release.indexOf('gh release create "$tag"');
  const dispatch = release.indexOf(
    'gh workflow run publish.yml --repo "$GITHUB_REPOSITORY" --ref "$tag" -f tag="$tag"'
  );
  assert.ok(tag > 0 && tag < pushTags);
  assert.ok(pushTags < createRelease);
  assert.ok(createRelease < dispatch);
  assert.match(release, /--verify-tag/);

  const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  assert.doesNotMatch(readme, /`@aceshooting\/lyra-ui` is published at/);
  assert.match(readme, /source is versioned at/);

  const ciWorkflow = readFileSync(
    path.join(repoRoot, '.github/workflows/ci.yml'),
    'utf8'
  );
  const lintJob = ciWorkflow.slice(
    ciWorkflow.indexOf('\n  lint:'),
    ciWorkflow.indexOf('\n  static-checks:')
  );
  assert.match(lintJob, /fetch-depth: 0/);
});

test('release planning tags only unreleased stable package versions', () => {
  const packages = [
    { directory: 'packages/lyra-ui', name: '@aceshooting/lyra-ui', version: '22.0.0', private: false },
    { directory: 'packages/lyra-flags', name: '@aceshooting/lyra-flags', version: '2.3.0', private: false },
    { directory: 'packages/tooling', name: 'tooling', version: '1.0.0', private: true },
  ];
  const existingTags = ['lyra-ui@21.2.0', 'lyra-flags@2.3.0'];
  assert.deepEqual(
    planReleaseTags({ packages, existingTags }).map(({ tag }) => tag),
    ['lyra-ui@22.0.0']
  );
  assert.deepEqual(
    planReleaseTags({ packages, existingTags, selection: 'lyra-ui' }).map(({ tag }) => tag),
    ['lyra-ui@22.0.0']
  );
  assert.throws(
    () => planReleaseTags({ packages, existingTags, selection: 'lyra-flags' }),
    /'lyra-flags@2\.3\.0' already exists/u
  );
  assert.throws(
    () => planReleaseTags({ packages, existingTags: [...existingTags, 'lyra-ui@22.0.0'] }),
    /nothing to release/u
  );
  assert.throws(
    () => planReleaseTags({ packages, existingTags, selection: 'tooling' }),
    /Unknown release package/u
  );
  assert.throws(
    () =>
      planReleaseTags({
        packages: [{ ...packages[0], version: '22.0.0-next.1' }],
        existingTags,
      }),
    /Unsupported release tag/u
  );
  assert.throws(
    () =>
      planReleaseTags({
        packages: [{ ...packages[0], name: '@aceshooting/other' }],
        existingTags,
      }),
    /does not match tag package/u
  );
});

test('package freshness gates track the standalone skill changelog', () => {
  const workflow = readFileSync(
    path.join(repoRoot, '.github/workflows/ci.yml'),
    'utf8'
  );
  const ciScript = readFileSync(path.join(repoRoot, 'scripts/ci.sh'), 'utf8');
  const regenScript = readFileSync(path.join(repoRoot, 'scripts/regen.sh'), 'utf8');
  const changelogPath = 'plugins/lyra-ui/skills/lyra-ui/CHANGELOG.md';

  const packageFreshnessLine = workflow
    .split('\n')
    .find((line) => line.includes('git diff --exit-code -- plugins/lyra-ui/skills/lyra-ui/'));
  assert.ok(packageFreshnessLine, 'CI must retain the standalone skill freshness diff');
  assert.ok(packageFreshnessLine.includes(changelogPath));
  const packageFreshnessBlock = ciScript.slice(
    ciScript.indexOf('step "plugin reference sync"'),
    ciScript.indexOf('step "skill:check"')
  );
  assert.ok(packageFreshnessBlock.includes(changelogPath));
  const changedPathsBlock = regenScript.slice(
    regenScript.indexOf('CHANGED_PATHS=('),
    regenScript.indexOf('git status --short -- "${CHANGED_PATHS[@]}"')
  );
  assert.ok(changedPathsBlock.includes(changelogPath));
});

test('package lifecycle and root custom-elements metadata are clean-checkout safe', () => {
  const rootPackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'package.json'), 'utf8')
  );
  const lyraPackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'packages/lyra-ui/package.json'), 'utf8')
  );
  const lyraManifestRelativePath = path.posix.join(
    'packages/lyra-ui',
    lyraPackage.customElements
  );
  const rootManifestPath = path.resolve(repoRoot, rootPackage.customElements);
  const lyraManifestPath = path.resolve(repoRoot, lyraManifestRelativePath);

  assert.equal(rootPackage.customElements, lyraManifestRelativePath);
  assert.equal(rootManifestPath, lyraManifestPath);
  const customElementsManifest = JSON.parse(
    readFileSync(rootManifestPath, 'utf8')
  );
  assert.equal(customElementsManifest.schemaVersion, '1.0.0');
  assert.ok(
    Array.isArray(customElementsManifest.modules) &&
      customElementsManifest.modules.length > 0,
    'the root customElements target must be a populated custom-elements manifest'
  );
  assert.equal(lyraPackage.scripts.pretest, 'pnpm run build');
  assert.match(lyraPackage.scripts.prepack, /^pnpm run archive-changelog && pnpm run package-metadata &&/);
});

test('editor data is generated only after its manifest and parity inventory inputs are fresh', () => {
  const upgradeScript = readFileSync(
    path.join(repoRoot, 'scripts/upgrade.sh'),
    'utf8'
  );
  const manifestIndex = upgradeScript.indexOf('pnpm manifest');
  const inventoryIndex = upgradeScript.indexOf(
    'check-pinned-upstream-manifests.mjs --write-inventory'
  );
  const editorDataIndex = upgradeScript.indexOf('run generate-editor-data');

  assert.ok(manifestIndex >= 0, 'upgrade must regenerate the manifest');
  assert.ok(
    inventoryIndex > manifestIndex,
    'upgrade must refresh the parity inventory after the manifest'
  );
  assert.ok(
    editorDataIndex > inventoryIndex,
    'upgrade must refresh editor data after the parity inventory passes'
  );

  const lyraPackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'packages/lyra-ui/package.json'), 'utf8')
  );
  const prepackManifestIndex = lyraPackage.scripts.prepack.indexOf('run manifest');
  const prepackEditorDataIndex = lyraPackage.scripts.prepack.indexOf(
    'run generate-editor-data'
  );
  assert.ok(
    prepackManifestIndex >= 0 && prepackEditorDataIndex > prepackManifestIndex,
    'prepack must refresh editor data only after regenerating its manifest input'
  );
});

test('upgrade measures component quality after packaging and the final source build', () => {
  const upgradeScript = readFileSync(path.join(repoRoot, 'scripts/upgrade.sh'), 'utf8');
  const lastSourceWriter = upgradeScript.indexOf('run scoped-definitions');
  const finalBuild = upgradeScript.lastIndexOf('pnpm build');
  const quality = upgradeScript.indexOf('generate-component-quality.mjs --write --measure-gzip');
  const packageScript = upgradeScript.indexOf('./package.sh');

  assert.ok(lastSourceWriter >= 0, 'upgrade must regenerate source-backed registrations');
  assert.ok(packageScript > lastSourceWriter, 'upgrade must package after its source generators');
  assert.ok(finalBuild > packageScript, 'upgrade must rebuild after package.sh finishes its generators');
  assert.ok(quality > finalBuild, 'component quality must measure the final built output');
  assert.equal(
    (upgradeScript.match(/generate-component-quality\.mjs --write --measure-gzip/gu) ?? []).length,
    1,
    'upgrade must write measured component quality only once, after the final build',
  );
});

test('checker self-tests and the strict test-tree type gate stay blocking', () => {
  const lyraPackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'packages/lyra-ui/package.json'), 'utf8')
  );
  const policy = lyraPackage.scripts['contract-policy'];
  for (const sequence of [
    'pnpm run provenance-policy && pnpm run test:provenance',
    'pnpm run test:tag-aliases && pnpm run test:registrations',
    'pnpm run check:form-associated && pnpm run test:form-associated',
    'pnpm run check:numeric-guards && pnpm run test:numeric-guards',
  ]) {
    assert.ok(policy.includes(sequence), `${sequence} must remain in contract-policy`);
  }

  assert.match(
    lyraPackage.scripts.lint,
    /pnpm run contract-policy && tsc --noEmit -p tsconfig\.json && pnpm run test:types && pnpm run check:test-types$/u,
    'the complete test tree must remain a blocking lint suffix'
  );

  const workflow = readFileSync(
    path.join(repoRoot, '.github/workflows/ci.yml'),
    'utf8'
  );
  assert.doesNotMatch(
    workflow,
    /Report test-tree TypeScript diagnostics|continue-on-error: true[\s\S]*?check:test-types/u,
    'CI must not demote the strict test-tree type gate to a diagnostic'
  );

  const knipConfig = readFileSync(path.join(repoRoot, 'knip.config.js'), 'utf8');
  assert.doesNotMatch(
    knipConfig,
    /['"]scripts\/\*\.mjs['"]/u,
    'package scripts and workflow commands, not a blanket wildcard, must establish Knip entries'
  );
});

test('package peer floors remain independent from current development pins', () => {
  const lyraPackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'packages/lyra-ui/package.json'), 'utf8'),
  );
  const expectedFloors = {
    'chart.js': '^4.0.1',
    '@sgratzl/chartjs-chart-boxplot': '^4.0.0',
    'chartjs-plugin-annotation': '^3.0.0',
    'chartjs-plugin-zoom': '^2.0.0',
    katex: '^0.18.4 || ^0.19.0',
    mammoth: '^1.12.1',
  };

  for (const [name, floor] of Object.entries(expectedFloors)) {
    assert.equal(
      lyraPackage.peerDependencies[name],
      floor,
      `${name} must retain its reviewed consumer floor`,
    );
    assert.equal(
      lyraPackage.peerDependenciesMeta[name]?.optional,
      true,
      `${name} must remain an optional peer`,
    );
    assert.notEqual(
      lyraPackage.devDependencies[name],
      floor,
      `${name} development pin must remain independently current`,
    );
  }
  assert.equal(lyraPackage.peerDependencies['chartjs-plugin-datalabels'], '^2.2.0');
  assert.equal(lyraPackage.peerDependencies.dompurify, '^3.4.14');
  assert.equal(lyraPackage.peerDependencies.marked, '^18.0.11');
  assert.equal(lyraPackage.peerDependencies['pdfjs-dist'], '^6.3.289');
});

test('upgrade protects managed peer floors before synchronizing package-manager prose and installing', () => {
  const upgradeScript = readFileSync(path.join(repoRoot, 'scripts/upgrade.sh'), 'utf8');
  const exactNodeIndex = upgradeScript.indexOf('\nnode scripts/check-node-version.mjs\n');
  const firstNcuIndex = upgradeScript.indexOf('pnpm dlx npm-check-updates@latest');
  const secondNcuIndex = upgradeScript.indexOf(
    'pnpm dlx npm-check-updates@latest',
    firstNcuIndex + 1,
  );
  const authorityGuardIndex = upgradeScript.indexOf(
    'node scripts/check-peer-compatibility.mjs --check-managed-peer-rewrites',
  );
  const syncDocsIndex = upgradeScript.indexOf(
    'node scripts/sync-package-manager-docs.mjs --write',
  );
  const installIndex = upgradeScript.indexOf('pnpm install --no-prod --no-frozen-lockfile');

  assert.ok(exactNodeIndex >= 0, 'upgrade must fail closed on the exact Node authority');
  assert.ok(secondNcuIndex > firstNcuIndex, 'upgrade must retain separate non-peer and peer NCU passes');
  assert.ok(
    authorityGuardIndex > secondNcuIndex,
    'upgrade must inspect managed peer floors after the peer NCU pass',
  );
  assert.ok(
    syncDocsIndex > authorityGuardIndex && syncDocsIndex < installIndex,
    'upgrade must synchronize package-manager prose after both NCU passes and before install',
  );
  assert.ok(
    upgradeScript.indexOf('node scripts/check-peer-compatibility.mjs --write-current-versions') > installIndex,
    'upgrade must refresh the checked current-version authority only after the lockfile exists',
  );
});

test('upgrade dependency-only mode installs and synchronizes peers without generation or builds', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-upgrade-mode-'));
  try {
    mkdirSync(path.join(root, 'scripts'), { recursive: true });
    mkdirSync(path.join(root, 'packages/lyra-ui'), { recursive: true });
    mkdirSync(path.join(root, 'bin'));
    copyFileSync(path.join(repoRoot, 'scripts/upgrade.sh'), path.join(root, 'scripts/upgrade.sh'));
    writeFileSync(path.join(root, '.nvmrc'), '22.23.2\n');
    writeFileSync(path.join(root, 'packages/lyra-ui/package.json'), '{}\n');
    const commandLog = path.join(root, 'commands.log');
    for (const command of ['node', 'pnpm']) {
      const binary = path.join(root, 'bin', command);
      writeFileSync(binary, `#!/usr/bin/env bash\nif [[ "$1" == '-p' ]]; then echo '22.23.2'; exit 0; fi\nprintf '%s\\n' '${command} '"$*" >> "$UPGRADE_TEST_LOG"\n`);
      chmodSync(binary, 0o755);
    }
    writeFileSync(path.join(root, 'package.sh'), '#!/usr/bin/env bash\necho package.sh >> "$UPGRADE_TEST_LOG"\n');
    chmodSync(path.join(root, 'package.sh'), 0o755);
    const run = (verify) => {
      writeFileSync(commandLog, '');
      const env = { ...process.env, PATH: `${path.join(root, 'bin')}:/usr/bin:/bin`, UPGRADE_TEST_LOG: commandLog };
      delete env.VERIFY;
      if (verify !== undefined) env.VERIFY = verify;
      const result = spawnSync('bash', ['scripts/upgrade.sh'], { cwd: root, encoding: 'utf8', env });
      assert.equal(result.status, 0, result.stderr);
      return { output: result.stdout, commands: readFileSync(commandLog, 'utf8') };
    };
    const dependencyOnly = run('0');
    assert.match(dependencyOnly.commands, /pnpm install --no-prod --no-frozen-lockfile/u);
    assert.match(dependencyOnly.commands, /check-managed-peer-rewrites/u);
    assert.match(dependencyOnly.commands, /sync-package-manager-docs\.mjs --write/u);
    assert.match(dependencyOnly.commands, /check-peer-compatibility\.mjs --write-current-versions/u);
    assert.doesNotMatch(dependencyOnly.commands, /pnpm manifest|pnpm build|package\.sh|generate-component-quality|run archive-changelog/u);
    assert.match(dependencyOnly.output, /skipped because VERIFY=0/u);
    const full = run(undefined);
    assert.match(full.commands, /pnpm manifest/u);
    assert.match(full.commands, /package\.sh/u);
    assert.match(full.commands, /pnpm build/u);
    assert.match(full.commands, /generate-component-quality\.mjs --write --measure-gzip/u);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('upgrade keeps the supported Shiki peer floor while refreshing its development version', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-upgrade-shiki-'));
  try {
    mkdirSync(path.join(root, 'scripts'), { recursive: true });
    mkdirSync(path.join(root, 'packages/lyra-ui'), { recursive: true });
    mkdirSync(path.join(root, 'bin'));
    copyFileSync(path.join(repoRoot, 'scripts/upgrade.sh'), path.join(root, 'scripts/upgrade.sh'));
    writeFileSync(path.join(root, '.nvmrc'), '22.23.2\n');
    const manifestPath = path.join(root, 'packages/lyra-ui/package.json');
    writeFileSync(manifestPath, JSON.stringify({
      peerDependencies: { shiki: '^4.4.3' },
      devDependencies: { shiki: '^4.4.3' },
    }));
    const nodeStub = path.join(root, 'bin/node');
    writeFileSync(nodeStub, '#!/usr/bin/env bash\nif [[ "$1" == "-p" ]]; then echo "22.23.2"; fi\n');
    chmodSync(nodeStub, 0o755);
    const pnpmStub = path.join(root, 'bin/pnpm');
    writeFileSync(pnpmStub, `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[0] === 'dlx') {
  const manifest = JSON.parse(fs.readFileSync('packages/lyra-ui/package.json', 'utf8'));
  const section = args[args.indexOf('--dep') + 1];
  const rejected = args.includes('--reject') ? args[args.indexOf('--reject') + 1].split(',') : [];
  if (section === 'peer') {
    if (!rejected.includes('shiki')) manifest.peerDependencies.shiki = '^4.5.0';
  } else {
    manifest.devDependencies.shiki = '^4.5.0';
  }
  fs.writeFileSync('packages/lyra-ui/package.json', JSON.stringify(manifest));
}
`);
    chmodSync(pnpmStub, 0o755);
    const result = spawnSync('bash', ['scripts/upgrade.sh'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${path.join(root, 'bin')}:/usr/bin:/bin`, VERIFY: '0' },
    });
    assert.equal(result.status, 0, result.stderr);
    const upgraded = JSON.parse(readFileSync(manifestPath, 'utf8'));
    assert.equal(upgraded.devDependencies.shiki, '^4.5.0');
    assert.equal(upgraded.peerDependencies.shiki, '^4.4.3');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

/** Run one helper from upgrade.sh's exact-Node activation block against a fixture tree. The block
 *  is extracted rather than re-implemented so the test fails when the script's own resolution
 *  changes, and the ambient host's real version-manager directories are replaced by the fixture. */
function runUpgradeNodeHelper({ root, invocation, env = {} }) {
  const source = readFileSync(path.join(repoRoot, 'scripts/upgrade.sh'), 'utf8');
  const blockStart = source.indexOf('\nread_exact_node_patch() {');
  const blockEnd = source.indexOf('\nactivate_exact_node\n', blockStart + 1);
  assert.ok(
    blockStart >= 0 && blockEnd > blockStart,
    'upgrade must define its exact-Node helpers ahead of the top-level activation call',
  );
  const helperSource = source.slice(blockStart + 1, blockEnd);
  const result = spawnSync(
    'bash',
    ['-c', `set -euo pipefail\nROOT_DIR="$PWD"\n${helperSource}\n${invocation}`, 'upgrade-fixture'],
    {
      cwd: root,
      encoding: 'utf8',
      env: {
        PATH: `${path.join(root, 'bin')}:/usr/bin:/bin`,
        HOME: root,
        NVM_DIR: path.join(root, 'nvm'),
        XDG_DATA_HOME: path.join(root, 'data'),
        ...env,
      },
    },
  );
  return result;
}

test('upgrade activates the exact .nvmrc Node before the fail-closed authority check', () => {
  const upgradeScript = readFileSync(path.join(repoRoot, 'scripts/upgrade.sh'), 'utf8');
  const activationIndex = exactTopLevelShellCommandIndex(upgradeScript, 'activate_exact_node');
  const authorityIndex = exactTopLevelShellCommandIndex(
    upgradeScript,
    'node scripts/check-node-version.mjs',
  );

  assert.ok(activationIndex >= 0, 'upgrade must activate the exact Node authority itself');
  assert.ok(
    authorityIndex > activationIndex,
    'the exact Node check must stay the fail-closed authority after activation',
  );
});

test('upgrade selects only an installed Node whose reported patch matches .nvmrc', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-upgrade-node-'));
  try {
    writeFileSync(path.join(root, '.nvmrc'), '22.23.2\n');
    const nvmExact = path.join(root, 'nvm/versions/node/v22.23.2/bin/node');
    writeFakeNode(nvmExact, '22.23.2');
    // A deterministic wrong-runtime shell: the ambient host's own node must not decide the result.
    writeFakeNode(path.join(root, 'bin/node'), '26.5.0');

    assert.equal(
      runUpgradeNodeHelper({ root, invocation: 'read_exact_node_patch' }).stdout.trim(),
      '22.23.2',
      'the pinned patch must be read from .nvmrc',
    );
    writeFileSync(path.join(root, '.nvmrc'), '22.23.2\r\n');
    assert.equal(
      runUpgradeNodeHelper({ root, invocation: 'read_exact_node_patch' }).stdout.trim(),
      '22.23.2',
      'a CRLF checkout must resolve the same pinned patch',
    );
    writeFileSync(path.join(root, '.nvmrc'), '22.23.2\n');

    assert.equal(
      runUpgradeNodeHelper({ root, invocation: 'find_exact_node_bin 22.23.2' }).stdout.trim(),
      nvmExact,
      'the installed exact patch must be selected from the version manager',
    );

    const override = path.join(root, 'override/node');
    writeFakeNode(override, '22.23.2');
    assert.equal(
      runUpgradeNodeHelper({
        root,
        invocation: 'find_exact_node_bin 22.23.2',
        env: { UPGRADE_SH_NODE_BIN: override },
      }).stdout.trim(),
      override,
      'an explicit override must preempt version-manager layouts',
    );
    assert.equal(
      runUpgradeNodeHelper({
        root,
        invocation: 'find_exact_node_bin 22.23.2',
        env: { UPGRADE_SH_NODE_BIN: path.join(root, 'missing/node') },
      }).stdout.trim(),
      nvmExact,
      'an override that is not installed must not shadow a real exact install',
    );

    rmSync(nvmExact);
    writeFakeNode(nvmExact, '22.24.0');
    assert.equal(
      runUpgradeNodeHelper({ root, invocation: 'find_exact_node_bin 22.23.2' }).stdout.trim(),
      '',
      'a directory named for the pinned patch must never outrank the version it reports',
    );

    const activation = runUpgradeNodeHelper({ root, invocation: 'activate_exact_node' });
    assert.equal(activation.status, 0, activation.stderr);
    assert.match(
      activation.stderr,
      /No installed Node 22\.23\.2 found to activate \(active: 26\.5\.0\)/u,
      'a host with no matching install must say so and leave the authority check to fail closed',
    );

    rmSync(nvmExact);
    writeFakeNode(nvmExact, '22.23.2');
    const selected = runUpgradeNodeHelper({ root, invocation: 'activate_exact_node; command -v node' });
    assert.equal(selected.status, 0, selected.stderr);
    assert.equal(
      selected.stdout.trim().split('\n').pop(),
      nvmExact,
      'activation must put the exact interpreter ahead of the wrong active runtime on PATH',
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('primary CI and release qualification use the exact Node file while compatibility matrix remains explicit', () => {
  const workflow = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
  const qualityStart = workflow.indexOf('\n  build_and_coverage_quality:');
  const ssrStart = workflow.indexOf('\n  build_and_coverage_ssr_hydration:', qualityStart + 1);
  const contractStart = workflow.indexOf('\n  packed_consumer_contract:');
  const attwStart = workflow.indexOf('\n  packed_consumer_attw:', contractStart + 1);
  const platformStart = workflow.indexOf('\n  platform-contracts:');
  assert.ok(qualityStart >= 0 && ssrStart > qualityStart, 'CI must expose the quality job boundary');
  assert.ok(contractStart >= 0 && attwStart > contractStart, 'CI must expose the packed contract job');
  assert.ok(platformStart >= 0, 'CI must expose the platform job');

  const qualityJob = workflow.slice(qualityStart, ssrStart);
  const contractJob = workflow.slice(contractStart, attwStart);
  const platformJob = workflow.slice(platformStart);
  assert.match(qualityJob, /node-version-file: \.nvmrc/u);
  assert.doesNotMatch(qualityJob, /node-version: 22/u);
  assert.match(workflow.slice(0, workflow.indexOf('  platform-contracts:')), /node-version-file: \.nvmrc/u);
  assert.doesNotMatch(
    workflow.slice(0, workflow.indexOf('  platform-contracts:')),
    /node-version: 22(?:\.\d+)?/u,
    'primary CI jobs must not float on an arbitrary Node 22 patch',
  );
  assert.equal(
    (contractJob.match(/node scripts\/check-peer-compatibility\.mjs/gu) ?? []).length,
    1,
    'the primary hosted packed-consumer contract job must run peer qualification exactly once',
  );
  assert.match(contractJob, /tarballs=\("\$LYRA_PACKED_MIGRATION_ARTIFACTS"\/packages\/aceshooting-lyra-ui-\*\.tgz\)/u);
  assert.match(contractJob, /"\$\{#tarballs\[@\]\}" -ne 1/u);
  assert.match(contractJob, /receipt\.sha256, createHash\('sha256'\)\.update\(bytes\)\.digest\('hex'\)/u);
  assert.match(contractJob, /node scripts\/check-peer-compatibility\.mjs --tarball "\$\{tarballs\[0\]\}"/u);
  assert.match(
    contractJob,
    /node-version-file: \.nvmrc/u,
    'the exact peer-profile checker must run under the checked-in Node patch, not a drifting Node 22 latest',
  );
  const chromiumProvisionIndex = contractJob.indexOf('image: mcr.microsoft.com/playwright:');
  const peerQualificationIndex = contractJob.indexOf('node scripts/check-peer-compatibility.mjs');
  assert.ok(
    chromiumProvisionIndex >= 0 && chromiumProvisionIndex < peerQualificationIndex,
    'the primary peer-profile runner must provision Chromium before it launches packed consumers',
  );
  assert.doesNotMatch(platformJob, /check-peer-compatibility/u);
  assert.doesNotMatch(platformJob, /node-version: 20|ci-pnpm10/u);

  const publishWorkflow = readFileSync(
    path.join(repoRoot, '.github/workflows/publish.yml'),
    'utf8',
  );
  assert.match(publishWorkflow, /node-version: \$\{\{ needs\.verify\.outputs\.node_version \}\}/u);
  const protectedStart = publishWorkflow.indexOf('\n  publish:');
  assert.ok(protectedStart >= 0, 'publish workflow must retain its protected signer job');
  const protectedSigner = publishWorkflow.slice(protectedStart);
  assert.doesNotMatch(protectedSigner, /actions\/checkout@|pnpm\/action-setup|pnpm install/u);
  assert.match(protectedSigner, /actions\/attest@/u);
  assert.match(protectedSigner, /npm publish "\$TARBALL" --access public/u);

  const verificationWorkflow = readFileSync(
    path.join(repoRoot, '.github/workflows/release-verification.yml'),
    'utf8',
  );
  assert.match(
    verificationWorkflow,
    /node-version-file: \.nvmrc/u,
    'the byte-compared tagged-source rebuild must use the exact checked-in Node patch',
  );
  for (const workflowName of ['test-all-browsers.yml', 'full-engine.yml', 'release.yml']) {
    const workflowSource = readFileSync(
      path.join(repoRoot, '.github/workflows', workflowName),
      'utf8',
    );
    assert.match(
      workflowSource,
      /node-version-file: \.nvmrc/u,
      `${workflowName} must use the repository's exact Node patch`,
    );
    assert.doesNotMatch(
      workflowSource,
      /node-version: 22(?:\.\d+)?/u,
      `${workflowName} must not float on an arbitrary Node 22 patch`,
    );
  }
  assert.doesNotMatch(
    verificationWorkflow,
    /node-version: 22\s*$/mu,
    'the byte-compared tagged-source rebuild must not drift with a floating Node 22 lane',
  );
  assert.match(
    verificationWorkflow,
    /name: verified-release-tarball[\s\S]*?retention-days: 14/u,
    'the protected signer must consume the retained byte-verified artifact',
  );
});

test('package-manager documentation has one explicit write/check synchronization authority', () => {
  const synchronizer = readFileSync(
    path.join(repoRoot, 'scripts/sync-package-manager-docs.mjs'),
    'utf8'
  );
  for (const governedPath of [
    'AGENTS.md',
    'CONTRIBUTING.md',
    'docs/agents/ci-and-gates.md',
  ]) {
    assert.ok(
      synchronizer.includes(governedPath),
      `${governedPath} must remain governed by the package-manager documentation synchronizer`
    );
  }
  assert.match(synchronizer, /--write/u);
  assert.match(synchronizer, /--check/u);
});

test('static and local CI run the release-tooling self-tests and package-manager documentation check', () => {
  const rootPackage = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const toolingCommand = rootPackage.scripts['check:release-tooling'];
  assert.equal(
    toolingCommand,
    'node --test scripts/release-prepare.test.mjs scripts/release-integrity.test.mjs scripts/check-peer-compatibility.test.mjs scripts/check-node-version.test.mjs scripts/sync-package-manager-docs.test.mjs scripts/update-framework-recipe-versions.test.mjs && node scripts/sync-package-manager-docs.mjs --check',
    'one root command must keep all release-tooling unit tests and synchronized package-manager prose together',
  );

  const workflow = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
  const staticStart = workflow.indexOf('\n  static-checks:');
  const buildStart = workflow.indexOf('\n  build_and_coverage_build:', staticStart + 1);
  assert.ok(staticStart >= 0 && buildStart > staticStart, 'CI must retain the static-checks job boundary');
  assert.match(
    workflow.slice(staticStart, buildStart),
    /pnpm check:release-tooling/u,
    'the static release gate must run the release-tooling command',
  );

  const localCi = readFileSync(path.join(repoRoot, 'scripts/ci.sh'), 'utf8');
  assert.match(
    localCi,
    /step "release tooling checks"\npnpm check:release-tooling/u,
    'the local CI reproduction must run the same release-tooling command',
  );
});

test('contributor docs derive the local platform modes from the runner and CI matrix', () => {
  const ciScript = readFileSync(path.join(repoRoot, 'scripts/ci.sh'), 'utf8');
  const workflow = readFileSync(
    path.join(repoRoot, '.github/workflows/ci.yml'),
    'utf8'
  );
  const guide = readFileSync(
    path.join(repoRoot, 'docs/agents/ci-and-gates.md'),
    'utf8'
  );
  const localAggregate = guide
    .split('## Local aggregate: `scripts/ci.sh`')[1]
    ?.split('\n## ')[0];
  assert.ok(
    localAggregate,
    'the contributor guide must document scripts/ci.sh'
  );
  const normalizedAggregate = localAggregate.replace(/\s+/gu, ' ');

  const browserLoop = ciScript.match(
    /if \[\[ "\$RUN_PLATFORM" == "1" \]\]; then\s+for browser in ([^;]+); do/u
  );
  assert.ok(
    browserLoop,
    'scripts/ci.sh must expose a parseable --platform browser loop'
  );
  const platformBrowsers = browserLoop[1].trim().split(/\s+/u);
  const displayName = (browser) => browser[0].toUpperCase() + browser.slice(1);
  const formattedBrowserList = platformBrowsers
    .map(displayName)
    .map((browser, index, all) =>
      index === all.length - 1 && all.length > 1 ? `and ${browser}` : browser
    )
    .join(platformBrowsers.length > 2 ? ', ' : ' ');
  assert.ok(
    normalizedAggregate.includes(
      `The ${platformBrowsers.length}-browser Node 22 sweep is ${formattedBrowserList}.`
    ),
    'the guide must list every browser in scripts/ci.sh --platform'
  );

  const platformStart = workflow.indexOf('\n  platform-contracts:');
  const stepsStart = workflow.indexOf('\n    steps:', platformStart);
  assert.ok(
    platformStart >= 0 && stepsStart > platformStart,
    'CI must define platform-contracts'
  );
  const platformHeader = workflow.slice(platformStart, stepsStart);
  const legs = [
    ...platformHeader.matchAll(
      /          - browser: (\S+)\n            node-version: (\d+)\n            shard_index: (\d+)\n            shard_total: (\d+)/gu
    ),
  ].map((match) => ({
    browser: displayName(match[1]),
    node: Number(match[2]),
    shard: Number(match[3]),
    total: Number(match[4]),
  }));
  assert.ok(
    legs.length > 0,
    'the CI platform matrix must have parseable include rows'
  );

  const nodeSummaries = [...new Set(legs.map(({ node }) => node))]
    .sort((a, b) => a - b)
    .map((node) => {
      const nodeLegs = legs.filter((leg) => leg.node === node);
      const browserTotals = [
        ...new Map(nodeLegs.map(({ browser, total }) => [browser, total])),
      ];
      const list = browserTotals
        .map(
          ([browser, total]) =>
            `${browser} (${total} ${total === 1 ? 'shard' : 'shards'})`
        )
        .map((entry, index, all) =>
          index === all.length - 1 && all.length > 1 ? `and ${entry}` : entry
        )
        .join(browserTotals.length > 2 ? ', ' : ' ');
      return `Node ${node} runs ${list}`;
    });
  assert.ok(
    normalizedAggregate.includes(
      `Its ${legs.length} legs are source-derived: ${nodeSummaries.join('; ')}.`
    ),
    'the guide must enumerate every CI platform leg from the workflow matrix'
  );
});

test('catalog prose uses the shipped strict virtualization threshold contract', () => {
  const readme = readFileSync(
    path.join(repoRoot, 'packages/lyra-ui/README.md'),
    'utf8'
  );
  const shared = readFileSync(
    path.join(repoRoot, 'packages/lyra-ui/llms/shared.md'),
    'utf8'
  );
  const catalogRows = ['lr-ingestion-queue', 'lr-activity-feed'].map(
    (tagName) => {
      const row = readme
        .split('\n')
        .find((line) => line.startsWith(`| \`<${tagName}>\``));
      assert.ok(row, `README catalog must contain <${tagName}>`);
      return row;
    }
  );

  for (const row of catalogRows) {
    assert.match(row, /`virtualizeAt`/u);
    assert.match(row, /(?:above|more than) `virtualizeAt`/u);
    assert.doesNotMatch(row, /virtualizeThreshold|at or above/iu);
  }
  assert.match(shared, /`virtualizeThreshold` → `virtualizeAt`/u);
});

test('MCP catalog prose matches the validated resource and request-event contract', () => {
  const readme = readFileSync(
    path.join(repoRoot, 'packages/lyra-ui/README.md'),
    'utf8'
  );
  const row = readme
    .split('\n')
    .find((line) => line.startsWith('| `<lr-mcp-app>`'));
  assert.ok(row, 'README catalog must contain <lr-mcp-app>');
  assert.match(row, /required resource descriptor/iu);
  assert.match(row, /exactly one of HTML or source URL/iu);
  assert.match(row, /host-authorized request events/iu);
  assert.doesNotMatch(row, /origin allowlist|error event/iu);
});

test('typed chart catalog prose matches the writable type contract', () => {
  const readme = readFileSync(
    path.join(repoRoot, 'packages/lyra-ui/README.md'),
    'utf8'
  );
  const row = readme
    .split('\n')
    .find((line) => line.startsWith('| `<lr-bar-chart>`'));
  assert.ok(row, 'README catalog must contain the typed chart row');
  assert.match(row, /tag-specific defaults/iu);
  assert.match(row, /full writable `LyraChartType` vocabulary/iu);
  assert.doesNotMatch(row, /type` locked/iu);
});

test('sequence playback catalog prose uses the v9 domain surface', () => {
  const readme = readFileSync(
    path.join(repoRoot, 'packages/lyra-ui/README.md'),
    'utf8'
  );
  const row = readme
    .split('\n')
    .find((line) => line.startsWith('| `<lr-sequence-playback>`'));
  assert.ok(row, 'README catalog must contain <lr-sequence-playback>');
  assert.match(row, /`itemCount`/u);
  assert.match(row, /`currentIndex`/u);
  assert.match(row, /`lr-sequence-step`/u);
  assert.doesNotMatch(readme, /^\| `<lr-playback>`/mu);
});

test('the authored provider-neutral AI import example compiles against the shipped source entry', () => {
  const shared = readFileSync(
    path.join(repoRoot, 'packages/lyra-ui/llms/shared.md'),
    'utf8'
  );
  const section = shared
    .split('## Provider-neutral AI types: `@aceshooting/lyra-ui/ai`')[1]
    ?.split('\n## ')[0];
  assert.ok(section, 'shared.md must contain the provider-neutral AI section');
  assert.match(section, /monotonic `generation`/u);
  assert.match(section, /strictly increasing `sequence`/u);
  assert.match(section, /DEFAULT_AGENT_STREAM_LIMITS/u);
  assert.match(section, /success\/error\s+union/u);
  assert.doesNotMatch(
    section,
    /src\/ai\/types\.contract\.ts|adaptAiSdkStream|adaptAgUiEvents/u
  );
  const snippet = section.match(/```ts\n([\s\S]*?)\n```/u)?.[1];
  assert.ok(snippet, 'the AI section must contain a TypeScript import example');

  const tempDir = mkdtempSync(path.join(tmpdir(), 'lyra-ai-doc-example-'));
  try {
    const sourcePath = path.join(tempDir, 'example.ts');
    const configPath = path.join(tempDir, 'tsconfig.json');
    writeFileSync(sourcePath, `${snippet}\n`, 'utf8');
    // This consumer intentionally lives outside src, so the package's rootDir/outDir
    // backmapping cannot apply. Resolve its private default-condition imports to the same
    // source counterparts without requiring dist or substituting declaration stubs.
    const packageDir = path.join(repoRoot, 'packages/lyra-ui');
    const packageImports = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8')).imports;
    const sourceImportPaths = Object.fromEntries(Object.entries(packageImports).map(([name, conditions]) => {
      assert.match(conditions.default, /^\.\/dist\/.+\.js$/u, `${name} must name a compiled source module`);
      const sourceTarget = conditions.default.replace(/^\.\/dist\//u, 'src/').replace(/\.js$/u, '.ts');
      return [name, [path.relative(tempDir, path.join(packageDir, sourceTarget))]];
    }));
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'ESNext',
            moduleResolution: 'bundler',
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            noUnusedLocals: false,
            noUnusedParameters: false,
            verbatimModuleSyntax: true,
            experimentalDecorators: true,
            useDefineForClassFields: false,
            paths: {
              ...sourceImportPaths,
              '@aceshooting/lyra-ui/ai': [
                path.relative(
                  tempDir,
                  path.join(repoRoot, 'packages/lyra-ui/src/ai/index.ts')
                ),
              ],
            },
          },
          files: [sourcePath],
        },
        null,
        2
      )
    );

    const tsc = path.join(repoRoot, 'packages/lyra-ui/node_modules/.bin/tsc');
    const result = spawnSync(
      tsc,
      ['--project', configPath, '--pretty', 'false'],
      {
        cwd: repoRoot,
        encoding: 'utf8',
      }
    );
    assert.equal(
      result.status,
      0,
      `shared.md AI example must compile against src/ai/index.ts:\n${result.stdout}${result.stderr}`
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('local platform legs execute pnpm shebangs and nested calls with the selected Node even when its override has no sibling node', () => {
  const ciScript = readFileSync(path.join(repoRoot, 'scripts/ci.sh'), 'utf8');
  const runWithToolchain = ciScript.slice(
    ciScript.indexOf('run_with_toolchain()'),
    ciScript.indexOf(
      '\nvalidate_platform_toolchain()',
      ciScript.indexOf('run_with_toolchain()')
    )
  );

  assert.match(runWithToolchain, /process\.execPath/u);
  assert.match(runWithToolchain, /mktemp -d/u);
  assert.match(runWithToolchain, /ln -s/u);
  assert.match(runWithToolchain, /run_with_toolchain\(\) \{/u);
  assert.match(runWithToolchain, /_run_with_toolchain_worker\(\) \{/u);
  assert.match(runWithToolchain, /CI_SH_ACTIVE_TOOLCHAIN_PID/u);
  assert.match(runWithToolchain, /kill -s "\$signal_name" -- "-\$selected_command_pid"/u);
  assert.match(runWithToolchain, /trap .*EXIT/u);
  for (const signal of ['HUP', 'INT', 'TERM']) {
    assert.match(runWithToolchain, new RegExp(`trap .*${signal}`, 'u'));
  }
  assert.match(runWithToolchain, /PATH="\$selected_node_proxy_dir:\$PATH"/u);
  assert.match(runWithToolchain, /CI_SH_SELECTED_TOOLCHAIN_DIR="\$selected_node_proxy_dir"/u);
  assert.match(
    runWithToolchain,
    /PATH="\$CI_SH_SELECTED_TOOLCHAIN_DIR:\$PATH"/u,
    'the nested pnpm wrapper must re-prepend the selected node/proxy directory',
  );
  assert.match(runWithToolchain, /CI_SH_SELECTED_PNPM_BIN="\$pnpm_bin"/u);
  assert.match(runWithToolchain, /npm_config_scripts_prepend_node_path=false/u);
  assert.match(runWithToolchain, /--config\.script-shell=/u);

  // This executable fixture exercises the selected contributor runtime.
  // fixtures, not source-only assertions: an intentionally wrong PATH `node`
  // must be bypassed for the first pnpm shebang and its nested pnpm call.
  for (const label of ['node22']) {
    exerciseSelectedToolchain({ label, selectedNode: process.execPath });
  }
});

test('real pnpm lifecycle scripts keep the selected node and pnpm ahead of package-local bin shims', () => {
  exerciseRealPnpmLifecycle(process.execPath);
});

test('policy-summary registration and authored docs match its actual composition', () => {
  const registration = readFileSync(
    path.join(
      repoRoot,
      'packages/lyra-ui/src/components/agent-tools/policy-summary/policy-summary.ts'
    ),
    'utf8'
  );
  const readme = readFileSync(
    path.join(repoRoot, 'packages/lyra-ui/README.md'),
    'utf8'
  );
  const authored = readFileSync(
    path.join(repoRoot, 'packages/lyra-ui/llms/agent-tools.md'),
    'utf8'
  );

  assert.doesNotMatch(registration, /overlays\/callout/u);
  const catalogRow =
    readme.split('\n').find((line) => line.includes('<lr-policy-summary>')) ??
    '';
  assert.doesNotMatch(catalogRow, /lr-callout/u);
  const section =
    authored.split('## `lr-policy-summary`')[1]?.split('\n## ')[0] ?? '';
  assert.doesNotMatch(section, /tones? the badge and callout/iu);
});

test('interactive graph-legend story exposes visible feedback without a duplicate live region', () => {
  const story = readFileSync(
    path.join(
      repoRoot,
      'packages/lyra-ui/src/components/retrieval/graph-legend/graph-legend.stories.ts'
    ),
    'utf8'
  );

  assert.doesNotMatch(story, /@lr-visibility-change=\$\{[^}]*console\.log/su);
  assert.match(story, /<p data-visibility-feedback>/u);
  assert.doesNotMatch(story, /data-visibility-feedback[^>]*aria-live/u);
});

test('every Playwright container image tracks the pinned playwright dependency', () => {
  const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const pinned = (pkg.devDependencies?.playwright ?? pkg.dependencies?.playwright ?? '').replace(
    /[^0-9.]/g,
    ''
  );
  assert.match(pinned, /^\d+\.\d+\.\d+$/, 'root package.json must pin a concrete playwright version');

  // The browser jobs no longer run `playwright install`; they inherit the binaries baked into the
  // image. A version skew there is silent and total -- Playwright would look for a browser build
  // the image does not carry -- so the tag is gated rather than trusted.
  for (const file of [
    '.github/workflows/ci.yml',
    '.github/workflows/full-engine.yml',
    '.github/workflows/test-all-browsers.yml',
  ]) {
    const src = readFileSync(path.join(repoRoot, file), 'utf8');
    const tags = [...src.matchAll(/mcr\.microsoft\.com\/playwright:v([0-9.]+)-/g)].map((m) => m[1]);
    assert.ok(tags.length > 0, `${file} must run its browser jobs in the pinned Playwright image`);
    for (const tag of tags) {
      assert.equal(tag, pinned, `${file} pins a Playwright image that package.json no longer matches`);
    }
  }

  // Drives the browser cache key for the two VM-only legs.
  const cacheVersion = readFileSync(path.join(repoRoot, '.github/playwright-version.txt'), 'utf8').trim();
  assert.equal(cacheVersion, pinned, '.github/playwright-version.txt must match the pinned playwright version');
});

// The published upgrade feed lagging npm was reported twice, from two different consumer projects,
// on two consecutive releases. Both shapes are pinned here because they fail differently: a stale
// `latest` misleads a reader who diffs from it, while a missing `releases` entry defeats even a
// reader who ignores `latest` and scans the array. The real 11.1.0 report hit BOTH at once.
test('treats a published upgrade feed that lags npm as an incomplete release', () => {
  const fresh = evaluateSiteFreshness({
    packageName: '@aceshooting/lyra-ui',
    expectedVersion: '11.3.0',
    npmDistTagLatest: '11.3.0',
    changelog: { latest: '11.3.0', releases: [{ version: '11.3.0' }, { version: '11.2.0' }] },
  });
  assert.deepEqual(fresh, { fresh: true, problems: [] });

  // The exact shape reported for 11.1.0: absent from `latest` AND from `releases`.
  const lagging = evaluateSiteFreshness({
    packageName: '@aceshooting/lyra-ui',
    expectedVersion: '11.1.0',
    npmDistTagLatest: '11.1.0',
    changelog: { latest: '11.0.0', releases: [{ version: '11.0.0' }] },
  });
  assert.equal(lagging.fresh, false);
  assert.equal(lagging.problems.length, 2);
  assert.match(lagging.problems[0], /"latest" is 11\.0\.0, expected 11\.1\.0/);
  assert.match(lagging.problems[1], /"releases" contains no entry for 11\.1\.0/);

  // A feed whose `latest` is right but whose array is missing the entry is still not fresh --
  // a consumer reading release notes between two versions finds nothing to read.
  const partial = evaluateSiteFreshness({
    packageName: '@aceshooting/lyra-ui',
    expectedVersion: '11.3.0',
    npmDistTagLatest: '11.3.0',
    changelog: { latest: '11.3.0', releases: [{ version: '11.2.0' }] },
  });
  assert.equal(partial.fresh, false);
  assert.equal(partial.problems.length, 1);

  // npm itself not having the version yet is reported distinctly from the feed being stale, so a
  // maintainer can tell "publish CI has not finished" from "the site was never deployed".
  const npmBehind = evaluateSiteFreshness({
    packageName: '@aceshooting/lyra-ui',
    expectedVersion: '11.3.0',
    npmDistTagLatest: '11.2.0',
    changelog: { latest: '11.3.0', releases: [{ version: '11.3.0' }] },
  });
  assert.equal(npmBehind.fresh, false);
  assert.match(npmBehind.problems[0], /npm dist-tags\.latest .* is 11\.2\.0, expected 11\.3\.0/);

  // The component catalog rides the same deploy and was caught a release behind npm at the same
  // time -- the third instance of one root cause. Checked here so it is not reported a fourth time.
  const staleCatalog = evaluateSiteFreshness({
    packageName: '@aceshooting/lyra-ui',
    expectedVersion: '11.3.0',
    npmDistTagLatest: '11.3.0',
    changelog: { latest: '11.3.0', releases: [{ version: '11.3.0' }] },
    catalogVersion: '11.2.0+sha256.51be72f509780516',
  });
  assert.equal(staleCatalog.fresh, false);
  assert.match(staleCatalog.problems[0], /catalog_version is 11\.2\.0\+sha256/);

  // The build-fingerprint suffix is not part of the version comparison.
  assert.equal(
    evaluateSiteFreshness({
      packageName: '@aceshooting/lyra-ui',
      expectedVersion: '11.3.0',
      npmDistTagLatest: '11.3.0',
      changelog: { latest: '11.3.0', releases: [{ version: '11.3.0' }] },
      catalogVersion: '11.3.0+sha256.51be72f509780516',
    }).fresh,
    true
  );

  // An unreachable catalog endpoint must not block an otherwise-valid release: it is optional
  // infrastructure, unlike the changelog feed the upgrade workflow actually instructs readers to use.
  assert.equal(
    evaluateSiteFreshness({
      packageName: '@aceshooting/lyra-ui',
      expectedVersion: '11.3.0',
      npmDistTagLatest: '11.3.0',
      changelog: { latest: '11.3.0', releases: [{ version: '11.3.0' }] },
      catalogVersion: undefined,
    }).fresh,
    true
  );

  // An unreachable or non-JSON feed fails closed rather than being read as fresh.
  const unreachable = evaluateSiteFreshness({
    packageName: '@aceshooting/lyra-ui',
    expectedVersion: '11.3.0',
    npmDistTagLatest: '11.3.0',
    changelog: null,
  });
  assert.equal(unreachable.fresh, false);
  assert.match(unreachable.problems[0], /could not be fetched/);
});

test('CI phase logging preserves failed commands and literal arguments', () => {
  const result = spawnSync('bash', [
    path.join(repoRoot, 'scripts/ci-phase.sh'),
    'consumer build',
    'bash',
    '-c',
    'printf "%s\\n" "$1"; exit 17',
    '--',
    'literal $(touch never)',
  ], { encoding: 'utf8' });
  assert.equal(result.status, 17, result.stderr);
  assert.match(result.stdout, /literal \$\(touch never\)/u);
  assert.match(result.stdout, /phase-start.*UTC.*consumer build/u);
  assert.match(result.stdout, /phase-end.*UTC.*consumer build.*elapsed=[0-9]+s.*status=17/u);
});

test('CI phase logging streams output before the command finishes', { timeout: 10000 }, async () => {
  const child = spawn('bash', [
    path.join(repoRoot, 'scripts/ci-phase.sh'),
    'live tests',
    'bash',
    '-c',
    'printf "live-output\\n"; read -r; printf "finished\\n"',
  ], { timeout: 5000, killSignal: 'SIGKILL' });
  let stdout = '';
  let stderr = '';
  let sawLiveBeforeFinished = false;
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
    if (!sawLiveBeforeFinished && stdout.includes('live-output') && !stdout.includes('finished')) {
      sawLiveBeforeFinished = true;
      child.stdin.write('\n');
    }
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });
  try {
    const status = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('close', resolve);
    });
    assert.equal(status, 0, stderr);
    assert.equal(sawLiveBeforeFinished, true, stdout);
    assert.match(stdout, /finished/u);
    assert.match(stdout, /phase-end.*status=0/u);
  } finally {
    child.stdin.end();
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
  }
});

test('CI browser provisioning preserves requested rows, native engines and real channels', () => {
  const source = readFileSync(path.join(repoRoot, '.github/workflows/test-all-browsers.yml'), 'utf8');
  const testJob = source.slice(source.indexOf('\n  test:'), source.indexOf('\n  qualification:'));
  assert.match(testJob, /browser: \$\{\{ fromJSON\(needs.plan.outputs.browsers\) \}\}/u);
  assert.doesNotMatch(testJob, /include:/u);
  assert.match(testJob, /image:.*chromium.*firefox.*safari.*mcr\.microsoft\.com\/playwright:v[0-9.]+-noble.*\|\| ''/u);
  assert.match(testJob, /options: --shm-size=2g -v \/usr\/share\/fonts:\/usr\/share\/host-fonts:ro/u);
  assert.match(testJob, /HOME:.*'\/root'.*'\/home\/runner'/u);
  assert.match(testJob, /DejaVu/u);
  assert.match(testJob, /timeout-minutes: 60/u);
  assert.equal([...testJob.matchAll(/timeout-minutes:/gu)].length, 1);
  assert.match(testJob, /channel-os.*playwright install-deps "\$INSTALL_BROWSER"/u);
  assert.match(testJob, /channel-binary.*playwright install "\$INSTALL_BROWSER"/u);
  assert.match(testJob, /matrix.browser == 'chrome' \|\| matrix.browser == 'edge'/u);
  assert.match(testJob, /matrix.browser == 'edge' && 'msedge' \|\| 'chrome'/u);
  assert.match(testJob, /TEST_ALL_BROWSERS_SKIP_INSTALL: '1'/u);
  assert.match(testJob, /test_all_browsers\.sh --serial --browsers "\$TEST_BROWSER" --shards "\$TEST_SHARD"/u);
  assert.doesNotMatch(testJob, /pkill|killall|continue-on-error|install --with-deps/u);
  const ci = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
  const packed = ci.slice(ci.indexOf('\n  packed_consumer_contract:'), ci.indexOf('\n  packed_consumer_attw:'));
  assert.match(packed, /image: mcr\.microsoft\.com\/playwright:v[0-9.]+-noble/u);
  assert.match(packed, /HOME: \/root/u);
  assert.match(packed, /\/usr\/share\/host-fonts/u);
  assert.doesNotMatch(packed, /playwright install/u);
  assert.match(packed, /timeout-minutes: 25/u);
});

test('serial browser sweep keeps shard failures fatal with a mocked actual runner', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-browser-sweep-contract-'));
  try {
    const pnpmVersion = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).packageManager.replace(/^pnpm@/u, '');
    const executable = path.join(root, 'pnpm');
    const calls = path.join(root, 'calls');
    writeFileSync(executable, `#!/usr/bin/env bash\nset -euo pipefail\nif [[ "$1" == --version ]]; then echo '${pnpmVersion}'; exit; fi\nprintf '%s %s\\n' "\${WTR_SHARD_INDEX:-build}" "$*" >> "$MOCK_CALLS"\nif [[ "$*" == *test:full-engine-shard* ]]; then echo live-shard; exit 17; fi\n`);
    chmodSync(executable, 0o755);
    const result = spawnSync('bash', [
      path.join(repoRoot, 'scripts/test_all_browsers.sh'),
      '--serial',
      '--browser',
      'safari',
      '--shards',
      '1,2',
    ], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${root}:${process.env.PATH}`,
        MOCK_CALLS: calls,
        TEST_ALL_BROWSERS_SKIP_INSTALL: '1',
      },
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /live-shard/u);
    assert.match(result.stdout, /FAIL.*safari/u);
    const commands = readFileSync(calls, 'utf8').trim().split('\n');
    assert.equal(commands.length, 2, commands.join('\n'));
    assert.match(commands[0], /^build build$/u);
    assert.match(commands[1], /^1 .*test:full-engine-shard$/u);
    const kept = result.stderr.match(/^lane logs kept for inspection: (.+)$/mu)?.[1];
    assert.ok(kept, result.stderr);
    try {
      assert.match(result.stdout, new RegExp(`log: ${kept.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}/safari\\.log`, 'u'));
      assert.match(readFileSync(path.join(kept, 'safari.log'), 'utf8'), /live-shard/u);
    } finally {
      rmSync(kept, { recursive: true, force: true });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
