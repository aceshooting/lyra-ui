import { spawnSync } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const LINT_SHARD_TOTAL = 3;

const POLICY_ENTRYPOINT = 'pnpm run contract-policy';
const LINT_SUFFIX = [
  'tsc --noEmit -p tsconfig.json',
  'pnpm run test:types',
];

// Durations are rounded observations from a representative hosted CI run. Keeping only the
// material costs makes the schedule understandable while a unit-cost fallback ensures a new,
// valid policy command is assigned rather than silently omitted.
const COMMAND_WEIGHTS = new Map([
  ['pnpm run test:component-inventory', 163],
  ['pnpm run check:qualification', 68],
  ['pnpm run check:component-quality', 44],
  ['pnpm run check:test-assertions', 33],
  ['pnpm run test:tooling', 24],
  ['pnpm run check:default-string-slices', 20],
  ['pnpm run manifest:check', 16],
  ['pnpm run test:component-metadata', 15],
  ['pnpm run check:collection-event-ownership', 10],
  ['pnpm run test:architecture', 9],
  ['pnpm run check:event-barrel', 7],
  ['pnpm run check:default-strings', 7],
  ['pnpm run llms-freshness', 6],
  ['pnpm run check:component-metadata', 5],
  ['tsc --noEmit -p tsconfig.json', 5],
  ['pnpm run test:types', 5],
]);

const PNPM_RUN_COMMAND = /^pnpm run ([A-Za-z0-9:_-]+)$/u;
const NODE_SCRIPT_COMMAND = /^node (scripts\/[A-Za-z0-9._/-]+\.mjs)$/u;
const SHELL_CONTROL = /[;&|`'"\\$<>(){}\r\n]/u;

function parseConjunction(source, label) {
  if (typeof source !== 'string' || source.length === 0) {
    throw new Error(`${label} must be a non-empty command string.`);
  }
  if (source.trim() !== source) {
    throw new Error(`${label} must not contain surrounding whitespace.`);
  }

  const commands = source.split(' && ');
  if (
    commands.length === 0 ||
    commands.some((command) => command.length === 0 || command.trim() !== command)
  ) {
    throw new Error(`${label} contains a malformed top-level && chain.`);
  }
  if (commands.join(' && ') !== source) {
    throw new Error(`${label} contains an unsupported top-level command separator.`);
  }
  for (const command of commands) {
    if (SHELL_CONTROL.test(command)) {
      throw new Error(`${label} contains an unsupported shell operator in ${JSON.stringify(command)}.`);
    }
  }
  return commands;
}

function validatePnpmCommand(command, scripts, label) {
  const match = command.match(PNPM_RUN_COMMAND);
  if (!match) return false;
  const scriptName = match[1];
  if (scriptName === 'contract-policy' || scriptName === 'lint') {
    throw new Error(`${label} cannot recursively invoke ${JSON.stringify(scriptName)}.`);
  }
  if (
    !Object.hasOwn(scripts, scriptName) ||
    typeof scripts[scriptName] !== 'string' ||
    scripts[scriptName].length === 0
  ) {
    throw new Error(`${label} references missing package script ${JSON.stringify(scriptName)}.`);
  }
  return true;
}

function validateNodeCommand(command, label) {
  const match = command.match(NODE_SCRIPT_COMMAND);
  if (!match) return false;
  if (match[1].split('/').includes('..')) {
    throw new Error(`${label} cannot traverse outside scripts/: ${JSON.stringify(command)}.`);
  }
  return true;
}

function validatePolicyCommand(command, scripts) {
  const label = `contract-policy command ${JSON.stringify(command)}`;
  if (validatePnpmCommand(command, scripts, label)) return;
  if (validateNodeCommand(command, label)) return;
  throw new Error(`${label} does not match a supported fail-closed command shape.`);
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/** Builds the complete CI lint inventory from the package's authoritative scripts. */
export function buildLintInventory(scripts) {
  if (!scripts || typeof scripts !== 'object' || Array.isArray(scripts)) {
    throw new Error('package.json scripts must be an object.');
  }

  const policyCommands = parseConjunction(scripts['contract-policy'], 'contract-policy');
  for (const command of policyCommands) validatePolicyCommand(command, scripts);

  const lintCommands = parseConjunction(scripts.lint, 'lint');
  if (lintCommands[0] !== POLICY_ENTRYPOINT) {
    throw new Error(`lint must begin with the exact ${JSON.stringify(POLICY_ENTRYPOINT)} wrapper.`);
  }
  const suffix = lintCommands.slice(1);
  if (!sameArray(suffix, LINT_SUFFIX)) {
    throw new Error(
      `lint must end with the exact static type-check suffix: ${LINT_SUFFIX.join(' && ')}.`,
    );
  }
  validatePnpmCommand(LINT_SUFFIX[1], scripts, 'lint type-test suffix');

  return [...policyCommands, ...LINT_SUFFIX].map((command, index) => ({
    ordinal: index + 1,
    source: index < policyCommands.length ? 'contract-policy' : 'lint-suffix',
    command,
  }));
}

function validateInventory(inventory) {
  if (!Array.isArray(inventory) || inventory.length < LINT_SHARD_TOTAL) {
    throw new Error(`Lint inventory must contain at least ${LINT_SHARD_TOTAL} commands.`);
  }
  for (const [index, item] of inventory.entries()) {
    if (
      !item ||
      item.ordinal !== index + 1 ||
      typeof item.command !== 'string' ||
      item.command.length === 0
    ) {
      throw new Error('Lint inventory ordinals must be contiguous and commands must be non-empty.');
    }
  }
}

/** Deterministically balances the authoritative inventory into three weighted lanes. */
export function partitionLintInventory(inventory, shardTotal = LINT_SHARD_TOTAL) {
  validateInventory(inventory);
  if (shardTotal !== LINT_SHARD_TOTAL) {
    throw new Error(
      `Lint shard total must remain ${LINT_SHARD_TOTAL}; received ${JSON.stringify(shardTotal)}.`,
    );
  }

  const lanes = Array.from({ length: shardTotal }, (_unused, index) => ({
    shardIndex: index + 1,
    shardTotal,
    totalWeight: 0,
    commands: [],
  }));
  const weighted = inventory
    .map((item) => ({
      ...item,
      weight: COMMAND_WEIGHTS.get(item.command) ?? 1,
    }))
    .sort((left, right) => right.weight - left.weight || left.ordinal - right.ordinal);

  for (const item of weighted) {
    let target = lanes[0];
    for (const candidate of lanes.slice(1)) {
      if (candidate.totalWeight < target.totalWeight) target = candidate;
    }
    target.commands.push(item);
    target.totalWeight += item.weight;
  }

  for (const lane of lanes) {
    lane.commands.sort((left, right) => left.ordinal - right.ordinal);
    if (lane.commands.length === 0) {
      throw new Error(`Lint shard ${lane.shardIndex}/${shardTotal} is empty.`);
    }
  }
  return lanes;
}

function positiveInteger(value, label) {
  if (!/^[1-9]\d*$/u.test(String(value ?? ''))) {
    throw new Error(`${label} must be a positive integer; received ${JSON.stringify(value)}.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${label} must be a safe positive integer; received ${JSON.stringify(value)}.`);
  }
  return parsed;
}

/** Accepts only `--shard N/3`, keeping workflow coordinates coupled to the source partition. */
export function parseLintShardArguments(argv) {
  if (argv.length !== 2 || argv[0] !== '--shard') {
    throw new Error(`Lint shard usage: lint-ci-shard.mjs --shard 1-${LINT_SHARD_TOTAL}/${LINT_SHARD_TOTAL}.`);
  }
  const coordinate = String(argv[1]);
  const match = coordinate.match(/^([^/]+)\/([^/]+)$/u);
  if (!match) {
    throw new Error(`Lint shard coordinate must use N/${LINT_SHARD_TOTAL}; received ${JSON.stringify(argv[1])}.`);
  }
  const shardIndex = positiveInteger(match[1], 'lint shard index');
  const shardTotal = positiveInteger(match[2], 'lint shard total');
  if (shardTotal !== LINT_SHARD_TOTAL) {
    throw new Error(`Lint shard total must be ${LINT_SHARD_TOTAL}; received ${shardTotal}.`);
  }
  if (shardIndex > shardTotal) {
    throw new Error(`Lint shard index (${shardIndex}) cannot exceed lint shard total (${shardTotal}).`);
  }
  return { shardIndex, shardTotal };
}

function commandInvocation(command, platform) {
  const [rawExecutable, ...args] = command.split(' ');
  const executable =
    platform === 'win32' && (rawExecutable === 'pnpm' || rawExecutable === 'tsc')
      ? `${rawExecutable}.cmd`
      : rawExecutable;
  return { executable, args };
}

/** Executes one selected lint lane, stopping immediately and preserving a child failure status. */
export function runLintShard(
  scripts,
  { shardIndex, shardTotal },
  {
    cwd = packageDirectory,
    environment = process.env,
    platform = process.platform,
    spawn = spawnSync,
  } = {},
) {
  const index = positiveInteger(shardIndex, 'lint shard index');
  const total = positiveInteger(shardTotal, 'lint shard total');
  if (total !== LINT_SHARD_TOTAL) {
    throw new Error(`Lint shard total must be ${LINT_SHARD_TOTAL}; received ${total}.`);
  }
  if (index > total) {
    throw new Error(`Lint shard index (${index}) cannot exceed lint shard total (${total}).`);
  }

  const inventory = buildLintInventory(scripts);
  const lane = partitionLintInventory(inventory, total)[index - 1];
  console.log(
    `Lint shard ${index}/${total}: ${lane.commands.length} of ${inventory.length} commands ` +
      `(estimated weight ${lane.totalWeight}).`,
  );

  for (const item of lane.commands) {
    console.log(`  [${item.ordinal}/${inventory.length}] ${item.command}`);
    const { executable, args } = commandInvocation(item.command, platform);
    const result = spawn(executable, args, {
      cwd,
      env: environment,
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    if (result.signal) {
      throw new Error(
        `Lint command ${item.ordinal}/${inventory.length} was terminated by signal ${result.signal}.`,
      );
    }
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

export function readPackageScripts(directory = packageDirectory) {
  const packageJson = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
  return packageJson.scripts;
}

const isMain =
  process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  const configuration = parseLintShardArguments(process.argv.slice(2));
  process.exitCode = runLintShard(readPackageScripts(), configuration);
}
