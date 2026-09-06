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
import { spawnSync } from 'node:child_process';
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
import { updateReadmeStatusLine } from './update-readme-status.mjs';

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
    const selectedPnpm = pnpmResolution.stdout.trim();
    assert.ok(path.isAbsolute(selectedPnpm), 'real pnpm fixture requires one absolute executable');

    writeFileSync(
      path.join(packageRoot, 'package.json'),
      `${JSON.stringify({
        name: 'real-pnpm-lifecycle-fixture',
        packageManager: 'pnpm@11.25.0',
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
    assert.match(result.stdout, /11\.25\.0/u);
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
  assert.match(
    toolchainFunction,
    /local manifest="package\.json"\n  \[\[ "\$node_version" == "20" \]\] && manifest="\.github\/ci-pnpm10\.json"/u,
    'Node 20 must retain its separate package-manager authority',
  );
  const nodeBranch = /  if \[\[ "\$node_version" == "22" \]\]; then\n    "\$node_bin" scripts\/check-node-version\.mjs \|\| return\n  else\n([\s\S]*?)\n  fi\n\n  local expected_pnpm/u.exec(
    toolchainFunction,
  );
  assert.ok(
    nodeBranch,
    'only the Node 22 branch may invoke the exact-patch checker',
  );
  assert.match(
    nodeBranch[1],
    /actual_node_major="\$\("\$node_bin" -p 'process\.versions\.node\.split\("\."\)\[0\]'\)"[\s\S]*?if \[\[ "\$actual_node_major" != "\$node_version" \]\]; then[\s\S]*?return 1/u,
    'Node 20 must stay live behind its major-version validation instead of the Node 22 exact check',
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
    ['check:packed-consumer:contracts'],
    'the platform matrix must contain only the contracts-only packed call',
  );
  assert.match(
    platformFunction,
    /if \[\[ "\$node_version" == "20" && "\$browser" == "firefox" && "\$shard_index" == "1" && "\$shard_total" == "1" \]\]; then[\s\S]*?run_with_toolchain "\$node_bin" "\$pnpm_bin" build \|\| return[\s\S]*?run_with_toolchain "\$node_bin" "\$pnpm_bin" check:packed-consumer:contracts \|\| return[\s\S]*?\n  fi/u,
    'only Node 20 / Firefox / shard 1-of-1 may run packed-consumer contracts after build',
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
    'pnpm --filter @aceshooting/lyra-ui component-metadata',
    'pnpm manifest',
    'pnpm --filter @aceshooting/lyra-ui component-inventory',
    'pnpm registrations',
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
    ['pnpm manifest', 2],
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

test('requires exhaustive fail-closed lint shards behind the stable lint gate', () => {
  const workflow = readFileSync(
    path.join(repoRoot, '.github/workflows/ci.yml'),
    'utf8'
  );
  const lyraPackage = JSON.parse(
    readFileSync(path.join(repoRoot, 'packages/lyra-ui/package.json'), 'utf8')
  );
  const shardStart = workflow.indexOf('\n  lint_shard:');
  const aggregateStart = workflow.indexOf('\n  lint:');
  const staticStart = workflow.indexOf('\n  static-checks:');
  assert.ok(
    shardStart > 0 &&
      aggregateStart > shardStart &&
      staticStart > aggregateStart,
    'CI must retain separate lint shard and stable aggregate jobs'
  );

  const shardJob = workflow.slice(shardStart, aggregateStart);
  const aggregateJob = workflow.slice(aggregateStart, staticStart);
  assert.match(
    shardJob,
    /name: lint \/ shard \$\{\{ matrix\.shard \}\}\/3/u
  );
  assert.match(shardJob, /fail-fast: false/u);
  assert.match(shardJob, /max-parallel: 3/u);
  assert.match(shardJob, /shard: \[1, 2, 3\]/u);
  assert.match(shardJob, /fetch-depth: 0/u);
  assert.match(shardJob, /node-version: 22/u);
  assert.match(shardJob, /pnpm install --frozen-lockfile/u);
  assert.match(
    shardJob,
    /node packages\/lyra-ui\/scripts\/lint-ci-shard\.mjs --shard "\$\{\{ matrix\.shard \}\}\/3"/u
  );
  assert.equal(
    [...shardJob.matchAll(/lint-ci-shard\.mjs/gu)].length,
    1,
    'each lint matrix worker must invoke exactly one selected shard'
  );
  assert.doesNotMatch(shardJob, /- run: pnpm lint(?:\s|$)/u);

  assert.match(
    workflow.slice(
      workflow.lastIndexOf('\n  # release-qualification:', aggregateStart),
      staticStart
    ),
    /# release-qualification: required\n  lint:\n/u
  );
  assert.match(aggregateJob, /name: lint/u);
  assert.match(aggregateJob, /if: \$\{\{ always\(\) \}\}/u);
  assert.match(aggregateJob, /- lint_shard\b/u);
  assert.match(
    aggregateJob,
    /LINT_SHARD_RESULT: \$\{\{ needs\.lint_shard\.result \}\}/u
  );
  assert.match(
    aggregateJob,
    /if \[\[ "\$LINT_SHARD_RESULT" != "success" \]\]/u
  );
  assert.match(aggregateJob, /exit 1/u);

  assert.equal(
    lyraPackage.scripts.lint,
    'pnpm run contract-policy && tsc --noEmit -p tsconfig.json && pnpm run test:types && pnpm run check:test-types'
  );
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
  const contractStart = workflow.indexOf('\n  packed_consumer_contract:');
  const attwStart = workflow.indexOf('\n  packed_consumer_attw:');
  const publicApiStart = workflow.indexOf('\n  packed_consumer_public_api:');
  const aggregateStart = workflow.indexOf('\n  packed-consumer:');
  const docsStart = workflow.indexOf('\n  docs_build:');
  assert.ok(
    contractStart > 0 &&
      attwStart > contractStart &&
      publicApiStart > attwStart &&
      aggregateStart > publicApiStart &&
      docsStart > aggregateStart,
    'CI must retain separate packed contract, ATTW, public-API, and aggregate jobs'
  );

  const contractJob = workflow.slice(contractStart, attwStart);
  const attwJob = workflow.slice(attwStart, publicApiStart);
  const publicApiJob = workflow.slice(publicApiStart, aggregateStart);
  const aggregateJob = workflow.slice(aggregateStart, docsStart);
  assert.match(contractJob, /pnpm check:packed-consumer:contracts/u);
  assert.doesNotMatch(contractJob, /pnpm check:packed-consumer(?:\s|$)/u);
  assert.match(attwJob, /name: packed-consumer \/ attw \/ shard \$\{\{ matrix\.shard_index \}\}\/4/u);
  assert.match(publicApiJob, /--filter @aceshooting\/lyra-ui check:public-api/u);
  assert.match(publicApiJob, /--filter @aceshooting\/lyra-flags check:public-api/u);
  assert.match(attwJob, /shard_index: \[1, 2, 3, 4\]/u);
  assert.match(
    attwJob,
    /pnpm check:packed-attw --shard-index \$\{\{ matrix\.shard_index \}\} --shard-total 4/u
  );
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
  assert.match(
    workflow,
    /Run packed consumer at the supported Node floor[\s\S]*?pnpm build && pnpm check:packed-consumer:contracts/u,
    'Node 20 must retain every packed contract while avoiding a duplicate monolithic ATTW sweep'
  );
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

test('local CI reserves contracts-only packed coverage for Node 20 Firefox 1-of-1', () => {
  assertLocalPackedConsumerRouting(
    readFileSync(path.join(repoRoot, 'scripts/ci.sh'), 'utf8'),
  );
});

test('local CI resolves exact Node 22 authority ahead of wrong shims and newer installs while Node 20 stays newest-major', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-ci-node-resolver-'));
  try {
    const pathDirectory = path.join(root, 'bin');
    const nvmDirectory = path.join(root, 'nvm');
    writeFileSync(path.join(root, '.nvmrc'), '22.23.2\n');

    const activeExact = path.join(pathDirectory, 'node');
    const wrongShim = path.join(pathDirectory, 'node22');
    const exactNvm = path.join(nvmDirectory, 'versions/node/v22.23.2/bin/node');
    const newerNvm = path.join(nvmDirectory, 'versions/node/v22.24.0/bin/node');
    const olderNode20 = path.join(nvmDirectory, 'versions/node/v20.18.3/bin/node');
    const newerNode20 = path.join(nvmDirectory, 'versions/node/v20.19.6/bin/node');
    writeFakeNode(activeExact, '22.23.2');
    writeFakeNode(wrongShim, '22.23.1');
    writeFakeNode(exactNvm, '22.23.2');
    writeFakeNode(newerNvm, '22.24.0');
    writeFakeNode(olderNode20, '20.18.3');
    writeFakeNode(newerNode20, '20.19.6');

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
      newerNode20,
      'the compatibility lane must retain newest-installed-patch selection for Node 20',
    );
    writeFileSync(
      path.join(pathDirectory, 'sort'),
      '#!/bin/sh\nif [ "${1:-}" = "-V" ]; then exit 64; fi\nexec /usr/bin/sort "$@"\n',
    );
    chmodSync(path.join(pathDirectory, 'sort'), 0o755);
    assert.equal(
      resolveNodeFromCiFixture({ root, major: 20, pathDirectory, nvmDirectory }),
      newerNode20,
      'the NVM fallback must select semver portably when stock sort has no -V option',
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

test('local CI structure rejects Node-20-breaking toolchain guards and dead or platform-only public-API gates', () => {
  const source = readFileSync(path.join(repoRoot, 'scripts/ci.sh'), 'utf8');
  const exactCheck = '    "$node_bin" scripts/check-node-version.mjs || return';
  const unconditionalExactCheck = source
    .replace(exactCheck, '    :')
    .replace(
      '  if [[ "$node_version" == "22" ]]; then',
      `  "$node_bin" scripts/check-node-version.mjs || return\n  if [[ "$node_version" == "22" ]]; then`,
    );
  const deadNode20Manifest = source.replace(
    '[[ "$node_version" == "20" ]] && manifest=".github/ci-pnpm10.json"',
    '[[ "$node_version" == "19" ]] && manifest=".github/ci-pnpm10.json"',
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
    ['unconditional exact-Node check', unconditionalExactCheck],
    ['dead Node 20 manifest branch', deadNode20Manifest],
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
  assert.match(shardJob, /needs: build_and_coverage_build/u);
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

  assert.match(mergeJob, /if: \$\{\{ always\(\) \}\}/u);
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

test('deploys docs from the committed manifest with scoped Pages credentials', () => {
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
  assert.match(buildJob, /- run: pnpm docs:build/u);
  assert.doesNotMatch(
    buildJob,
    /pnpm --filter @aceshooting\/lyra-ui run manifest(?:\s|$)/u
  );
  assert.match(rootPackage.scripts['docs:build'], /^pnpm manifest:check &&/u);
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

test('requires the exact main-branch Test All Browsers run and all five browser jobs', () => {
  assert.deepEqual(REQUIRED_TEST_ALL_BROWSER_JOBS, [
    'chrome',
    'chromium',
    'edge',
    'firefox',
    'safari',
  ]);
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
      message: "Test All Browsers run 126 is missing required job 'safari'.",
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
  assert.throws(
    () => parseReleaseTag('other@1.0.0'),
    /Unsupported release tag/
  );
  assert.throws(() => parseReleaseTag('lyra-ui@8'), /Unsupported release tag/);
  assert.throws(() => parseReleaseTag('lyra-ui@8.1.0-beta.1'), /stable/);
  assert.throws(() => parseReleaseTag('lyra-ui@8.1.0+rebuild.1'), /stable/);
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
    assert.doesNotMatch(workflow, /\.intoto\.jsonl/);
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

test('release script pins its repository and pushes release refs atomically', () => {
  const publishScript = readFileSync(
    path.join(repoRoot, 'scripts/publish.sh'),
    'utf8'
  );

  assert.match(publishScript, /GH_REPOSITORY="\$GH_ACCOUNT\/lyra-ui"/);
  assert.match(publishScript, /git remote get-url --push --all origin/);
  assert.match(publishScript, /git remote get-url --all origin/);
  assert.match(publishScript, /origin fetch URL/);
  assert.match(publishScript, /git ls-remote --tags origin/);
  assert.match(
    publishScript,
    /git push origin "\$release_sha:refs\/heads\/main"/
  );
  assert.doesNotMatch(publishScript, /git push origin HEAD:/);
  assert.match(
    publishScript,
    /git tag -a "\$\{TAG\[\$dir\]\}" -m "Release \$\{TAG\[\$dir\]\}" "\$release_sha"/
  );
  assert.match(
    publishScript,
    /current_head="\$\(git rev-parse HEAD\^\{commit\}\)"/
  );
  assert.match(
    publishScript,
    /local HEAD moved during exact-commit qualification/
  );
  assert.match(
    publishScript,
    /working tree changed during exact-commit qualification/
  );
  assert.match(publishScript, /git push --atomic origin "\$\{tag_args\[@\]\}"/);
  assert.match(
    publishScript,
    /gh release create[\s\S]*--repo "\$GH_REPOSITORY"/
  );
  assert.doesNotMatch(publishScript, /git add -A/);
  assert.doesNotMatch(publishScript, /export GH_TOKEN/);
  assert.match(publishScript, /Working tree is not clean/);
  assert.match(
    publishScript,
    /pnpm --filter "\$name" --if-present run package-metadata/
  );
  assert.match(publishScript, /src\/internal\/package-metadata\.ts/);
  assert.match(publishScript, /scripts\/fixtures\/component-metadata\.json/);
  assert.match(publishScript, /scripts\/fixtures\/component-inventory\.json/);
  assert.match(publishScript, /git diff --name-only/);
  assert.match(publishScript, /node scripts\/update-readme-status\.mjs/);
  assert.match(publishScript, /git add README\.md/);
  assert.match(publishScript, /node scripts\/sync-plugin-version\.mjs/);
  assert.match(publishScript, /\.\/package\.sh/);
  assert.match(publishScript, /pnpm skill:check/);
  assert.match(
    publishScript,
    /plugins\/lyra-ui\/\.claude-plugin\/plugin\.json/
  );
  assert.match(publishScript, /plugins\/lyra-ui\/\.codex-plugin\/plugin\.json/);
  assert.match(publishScript, /\.claude-plugin\/marketplace\.json/);
  assert.match(publishScript, /plugins\/lyra-ui\/skills\/lyra-ui\/CHANGELOG\.md/);
  assert.match(publishScript, /plugins\/lyra-ui\/skills\/lyra-ui\/references/);
  assert.match(publishScript, /skills\/lyra-ui\.skill/);
  assert.match(publishScript, /skills\/compose-lyra-interfaces\.skill/);
  assert.match(publishScript, /git --no-pager diff --stat/);
  assert.match(publishScript, /gh workflow run full-engine\.yml/);
  assert.match(
    publishScript,
    /gh workflow run test-all-browsers\.yml[\s\S]*--ref main[\s\S]*-f browsers=chromium,firefox,chrome,edge,safari/
  );
  assert.match(publishScript, /wait-ci/);
  assert.match(publishScript, /wait-test-all-browsers/);
  assert.match(publishScript, /wait-full-engine/);
  assert.match(publishScript, /not a stable core semver/);
  assert.match(publishScript, /QUALIFICATION_PASSED/);
  assert.match(publishScript, /Do NOT tag or release this commit/);
  assert.match(
    publishScript,
    /custom-elements\.json[\s\S]*llms\.txt[\s\S]*llms-full\.txt/
  );
  const changedReleaseBlock = publishScript.slice(
    publishScript.indexOf('RELEASE_DIRS=()'),
    publishScript.indexOf('declare -A NEW_VERSION')
  );
  assert.match(changedReleaseBlock, /for dir in "\$\{PKG_DIRS\[@\]\}"/);
  assert.doesNotMatch(
    changedReleaseBlock,
    /for name in "\$\{EFFECTIVE_NAMES\[@\]\}"/
  );
  assert.match(changedReleaseBlock, /AUTO_EXPANDED_RELEASE_DIRS/);
  assert.match(
    changedReleaseBlock,
    /Changesets expanded the release to publishable dependents/
  );
  assert.match(publishScript, /Changesets auto-expanded dependent/);
  assert.match(publishScript, /node scripts\/changeset-release-plan\.mjs/);
  assert.doesNotMatch(publishScript, /matchAll\(\/\^"/u);
  let gateCursor = publishScript.indexOf('pnpm changeset version');
  for (const command of [
    'run package-metadata',
    'run manifest',
    'run component-metadata',
    'run manifest',
    // llms must regenerate before lint: lint's own check-llms-freshness.mjs/
    // check-llms-artifacts.mjs verify llms/ against the manifest and package-metadata-embedded
    // version this loop just regenerated above, so running llms generation after lint (the
    // order this test used to encode as correct) meant every release that changed manifest
    // content or bumped the version failed lint on stale llms/ output.
    'run default-string-slices',
    'run framework-types',
    'run design-tokens',
    'run generate-editor-data',
    'run llms',
    'run lint',
    'run build',
    'run check:public-api',
    'run component-quality',
    'run test',
  ]) {
    const commandIndex = publishScript.indexOf(command, gateCursor + 1);
    assert.ok(
      commandIndex > gateCursor,
      `${command} must follow the preceding release gate`
    );
    gateCursor = commandIndex;
  }
  for (const command of [
    'node scripts/sync-plugin-version.mjs',
    './package.sh',
    'pnpm skill:check',
  ]) {
    const commandIndex = publishScript.indexOf(command, gateCursor + 1);
    assert.ok(
      commandIndex > gateCursor,
      `${command} must follow release-time LLM generation`
    );
    gateCursor = commandIndex;
  }
  const stagingBlock = publishScript.slice(
    publishScript.indexOf('git add README.md'),
    publishScript.indexOf('unexpected_tracked_changes=')
  );
  for (const generatedEvidence of [
    'scripts/fixtures/component-qualification.json',
    'scripts/fixtures/component-integration.json',
    'docs/component-quality.md',
    'docs/component-integration.md',
  ]) {
    assert.match(
      stagingBlock,
      new RegExp(generatedEvidence.replaceAll('.', '\\.'), 'u'),
      `release commit must include regenerated ${generatedEvidence}`
    );
  }
  const pushMain = publishScript.indexOf(
    'git push origin "$release_sha:refs/heads/main"'
  );
  const dispatch = publishScript.indexOf('gh workflow run full-engine.yml');
  const dispatchTestAll = publishScript.indexOf(
    'gh workflow run test-all-browsers.yml',
    dispatch
  );
  const waitCi = publishScript.indexOf('wait-ci', dispatchTestAll);
  const waitTestAll = publishScript.indexOf(
    'wait-test-all-browsers',
    waitCi
  );
  const waitFullEngine = publishScript.indexOf('wait-full-engine', waitTestAll);
  const qualificationDriftGuard = publishScript.indexOf(
    'current_head="$(git rev-parse HEAD^{commit})"',
    waitFullEngine
  );
  const qualificationStatus = publishScript.indexOf(
    'qualification_status="$(git status --porcelain)"',
    qualificationDriftGuard
  );
  const qualificationPassed = publishScript.indexOf(
    'QUALIFICATION_PASSED=1',
    waitFullEngine
  );
  const tag = publishScript.indexOf('git tag -a', waitFullEngine);
  const pushTags = publishScript.indexOf('git push --atomic origin', tag);
  const release = publishScript.lastIndexOf('gh release create');
  assert.ok(pushMain < dispatch);
  assert.ok(dispatch < dispatchTestAll);
  assert.ok(dispatchTestAll < waitCi);
  assert.ok(waitCi < waitTestAll);
  assert.ok(waitTestAll < waitFullEngine);
  assert.ok(waitFullEngine < qualificationDriftGuard);
  assert.ok(qualificationDriftGuard < qualificationStatus);
  assert.ok(qualificationStatus < qualificationPassed);
  assert.ok(qualificationPassed < tag);
  assert.ok(tag < pushTags);
  assert.ok(pushTags < release);

  const qualificationGuardBlock = publishScript.slice(
    qualificationDriftGuard,
    tag
  );
  assert.match(
    qualificationGuardBlock,
    /qualification_status="\$\(git status --porcelain\)"/
  );

  const packageExecution = publishScript.slice(
    publishScript.indexOf('pnpm install'),
    publishScript.indexOf('release_sha=')
  );
  assert.doesNotMatch(packageExecution, /GH_TOKEN=/);

  const readme = readFileSync(path.join(repoRoot, 'README.md'), 'utf8');
  assert.doesNotMatch(readme, /`@aceshooting\/lyra-ui` is published at/);
  assert.match(readme, /source is versioned at/);

  const ciWorkflow = readFileSync(
    path.join(repoRoot, '.github/workflows/ci.yml'),
    'utf8'
  );
  const lintShardJob = ciWorkflow.slice(
    ciWorkflow.indexOf('  lint_shard:'),
    ciWorkflow.indexOf('\n  lint:')
  );
  assert.match(lintShardJob, /fetch-depth: 0/);
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

test('release script exits non-zero when the published upgrade feed stays stale', () => {
  const publishScript = readFileSync(
    path.join(repoRoot, 'scripts/publish.sh'),
    'utf8'
  );
  const verificationStart = publishScript.indexOf('primary_dir=""');
  assert.ok(verificationStart >= 0, 'published-feed verification block must exist');
  const verificationBlock = publishScript.slice(verificationStart);
  const harness = `
set -u
RELEASE_DIRS=('packages/lyra-ui')
declare -A PKG_NAME NEW_VERSION
PKG_NAME['packages/lyra-ui']='@aceshooting/lyra-ui'
NEW_VERSION['packages/lyra-ui']='12.1.3'
node() { return 1; }
${verificationBlock}
`;
  const result = spawnSync('bash', ['-c', harness], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  assert.notEqual(result.status, 0, result.stderr);
  assert.match(result.stderr, /RELEASE INCOMPLETE/);
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
  assert.match(lyraPackage.scripts.prepack, /^pnpm run package-metadata &&/);
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
    katex: '^0.18.4',
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

test('hosted peer qualification stays primary-only and quality jobs alone read the exact Node file', () => {
  const workflow = readFileSync(path.join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
  const qualityStart = workflow.indexOf('\n  build_and_coverage_quality:');
  const ssrStart = workflow.indexOf('\n  build_and_coverage_ssr:', qualityStart + 1);
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
  assert.equal(
    (workflow.match(/node-version-file: \.nvmrc/gu) ?? []).length,
    1,
    'only the component-quality job may select the exact Node patch from .nvmrc',
  );
  assert.equal(
    (contractJob.match(/node scripts\/check-peer-compatibility\.mjs/gu) ?? []).length,
    1,
    'the primary hosted packed-consumer contract job must run peer qualification exactly once',
  );
  assert.match(
    contractJob,
    /node-version: 22\.23\.2/u,
    'the exact peer-profile checker must run under the checked-in Node patch, not a drifting Node 22 latest',
  );
  const chromiumProvisionIndex = contractJob.indexOf(
    'pnpm --filter @aceshooting/lyra-ui exec playwright install --with-deps chromium',
  );
  const peerQualificationIndex = contractJob.indexOf('node scripts/check-peer-compatibility.mjs');
  assert.ok(
    chromiumProvisionIndex >= 0 && chromiumProvisionIndex < peerQualificationIndex,
    'the primary peer-profile runner must provision Chromium before it launches packed consumers',
  );
  assert.doesNotMatch(platformJob, /check-peer-compatibility/u);
  assert.match(platformJob, /matrix\.node-version == 20/u);

  const publishWorkflow = readFileSync(
    path.join(repoRoot, '.github/workflows/publish.yml'),
    'utf8',
  );
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
    /node-version: 22\.23\.2/u,
    'the byte-compared tagged-source rebuild must use the exact checked-in Node patch',
  );
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
    'node --test scripts/publish.test.mjs scripts/release-integrity.test.mjs scripts/check-peer-compatibility.test.mjs scripts/check-node-version.test.mjs scripts/sync-package-manager-docs.test.mjs && node scripts/sync-package-manager-docs.mjs --check',
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

  // Both matrix majors use the same launcher contract. These are executable
  // fixtures, not source-only assertions: an intentionally wrong PATH `node`
  // must be bypassed for the first pnpm shebang and its nested pnpm call.
  for (const label of ['node20', 'node22']) {
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
  for (const file of ['.github/workflows/ci.yml', '.github/workflows/full-engine.yml']) {
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
