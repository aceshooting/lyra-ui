// `lyra-ui init-agents`: installs the skills bundled in @aceshooting/lyra-ui for Claude Code and
// Codex and keeps a marked pointer block in AGENTS.md / CLAUDE.md. Idempotent, dependency-free, and
// never touches anything outside its own skill directories and its own marker block.
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

import { AGENTS, AGENT_IDS, UNIVERSAL_SKILL_DIR, detectCaller } from './agent-registry.mjs';

export const BLOCK_START = '<!-- lyra-ui:start -->';
export const BLOCK_END = '<!-- lyra-ui:end -->';
export const MANAGED_MARKER = '.lyra-ui-managed';
const PACKAGE_NAME = '@aceshooting/lyra-ui';

export const INSTRUCTION_BLOCK = [
  BLOCK_START,
  '## Lyra UI (@aceshooting/lyra-ui)',
  '',
  'Before writing or reviewing any `lr-*` markup, use the `lyra-ui` skill (if your agent loads skills)',
  'or read `node_modules/@aceshooting/lyra-ui/llms.txt`; never guess attributes, slots, events or',
  'imports. One component: `node_modules/@aceshooting/lyra-ui/llms/components/<tag>.md`. Page and',
  'layout design: the `compose-lyra-interfaces` skill. Refresh with `npx lyra-ui init-agents`.',
  BLOCK_END,
].join('\n');

const agentList = AGENTS.map((agent) => agent.id).join(',');

const AGENTS_MD_NOTE = 'AGENTS.md now carries the pointer block.';

const HELP = `Usage: lyra-ui init-agents [options]

AI coding agents: run \`npx lyra-ui init-agents\` (add \`--agent <name>\` if you are not auto-detected) to
install the Lyra UI skill for yourself. It prints what was installed (absolute paths) and what to do
next so the skill loads; add \`--json\` for a machine-readable result.

Sets up AI coding agents (Claude Code, Codex, OpenCode, Cursor, Gemini CLI, GitHub Copilot, Amp,
Windsurf, ...) for this project: installs the Lyra UI skills bundled in
node_modules/${PACKAGE_NAME}/skills/ and adds or refreshes a short block between ${BLOCK_START}
and ${BLOCK_END} in AGENTS.md (created if missing; read by most agents) and CLAUDE.md (only if it
exists and does not import AGENTS.md). Safe to re-run; content outside the block and unrelated skill
directories are never modified.

The shared ${UNIVERSAL_SKILL_DIR}/ directory is always installed. Agents that read another
directory (today: Claude Code, .claude/skills) get a link to it. Which agents, in order: --agent(s);
the invoking agent, detected from its documented environment (Claude Code, Gemini CLI); agents
detected from project config; in a terminal without any of those, a prompt for humans.

Options:
  --agent, --agents <list>  ${agentList}, or "all"; overrides everything else
  --yes, -y              never prompt; use the invoking or detected agents
  --json                 print one JSON object instead of text
  --copy                 copy the skills instead of symlinking them to node_modules (a symlink
                         follows package upgrades; a copy is committable and refreshed by re-running)
  --link                 convert a previously managed copy back to a symlink
  --dry-run, -n          print what would change and write nothing
  --force                replace an existing skill directory that this tool did not create
  --dir <path>           project directory (default: the current directory)
  --help, -h             show this message
`;

export function parseArguments(argv) {
  const options = { agents: undefined, yes: false, json: false, mode: undefined, dryRun: false, force: false, dir: undefined, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const [flag, inline] = argument.startsWith('--') ? argument.split(/=(.*)/su, 2) : [argument];
    const value = () => {
      const next = inline ?? argv[++index];
      if (next === undefined || next.startsWith('--')) throw new Error(`${flag} needs a value`);
      return next;
    };
    if (flag === '--help' || flag === '-h') options.help = true;
    else if (flag === '--dry-run' || flag === '-n') options.dryRun = true;
    else if (flag === '--force') options.force = true;
    else if (flag === '--yes' || flag === '-y') options.yes = true;
    else if (flag === '--json') options.json = true;
    else if (flag === '--copy') options.mode = 'copy';
    else if (flag === '--link') options.mode = 'link';
    else if (flag === '--dir') options.dir = value();
    else if (flag === '--agents' || flag === '--agent') {
      const names = [...new Set(value().split(',').map((name) => name.trim().toLowerCase()).filter(Boolean))];
      const unknown = names.filter((name) => name !== 'all' && !AGENT_IDS.includes(name));
      if (unknown.length > 0 || names.length === 0) {
        throw new Error(`${flag} accepts ${AGENT_IDS.join(', ')} or all; got "${unknown.join(',')}"`);
      }
      options.agents = names.includes('all') ? [...AGENT_IDS] : names;
    } else throw new Error(`unknown option ${argument}`);
  }
  return options;
}

/** Agent ids whose detect paths exist in the project. */
export function detectAgents(projectDir) {
  return AGENTS.filter((agent) => agent.detect.some((entry) => existsSync(path.join(projectDir, entry))))
    .map((agent) => agent.id);
}

/**
 * Applies one line of the interactive prompt to the selection. Numbers (1-based, separated by
 * spaces or commas) toggle; `a` selects all, `n` none. An empty line confirms.
 * @returns {{ selected: string[], done: boolean, error?: string }}
 */
export function applySelectionInput(input, selected) {
  const text = input.trim().toLowerCase();
  if (text === '') return { selected: [...selected], done: true };
  if (text === 'a' || text === 'all') return { selected: [...AGENT_IDS], done: false };
  if (text === 'n' || text === 'none') return { selected: [], done: false };
  const next = new Set(selected);
  for (const token of text.split(/[\s,]+/u).filter(Boolean)) {
    const number = Number(token);
    const id = Number.isInteger(number) ? AGENT_IDS[number - 1] : AGENT_IDS.find((candidate) => candidate === token);
    if (!id) return { selected: [...selected], done: false, error: `"${token}" is not a listed number or agent` };
    if (next.has(id)) next.delete(id);
    else next.add(id);
  }
  return { selected: AGENT_IDS.filter((id) => next.has(id)), done: false };
}

function renderSelection(selected) {
  const lines = [`Which AI coding agents should be set up? ${UNIVERSAL_SKILL_DIR}/ (shared) is always installed.`];
  AGENTS.forEach((agent, index) => {
    const where = agent.ownSkillDir ? `needs ${agent.ownSkillDir}/` : `reads ${UNIVERSAL_SKILL_DIR}/`;
    lines.push(`  ${String(index + 1).padStart(2)}. [${selected.includes(agent.id) ? 'x' : ' '}] ${agent.name} (${where})`);
  });
  lines.push('Type numbers to toggle (e.g. "1 3"), a = all, n = none, Enter = confirm.');
  return lines.join('\n');
}

async function promptForAgents(initial, input, output) {
  const rl = createInterface({ input, output });
  const queue = [];
  let waiter = null;
  let closed = false;
  rl.on('line', (line) => {
    if (waiter) {
      const resolve = waiter;
      waiter = null;
      resolve(line);
    } else queue.push(line);
  });
  rl.on('close', () => {
    closed = true;
    if (waiter) waiter(null);
  });
  const nextLine = () => new Promise((resolve) => {
    if (queue.length > 0) resolve(queue.shift());
    else if (closed) resolve(null);
    else waiter = resolve;
  });
  let selected = [...initial];
  try {
    for (;;) {
      output.write(`${renderSelection(selected)}\n> `);
      const answer = await nextLine();
      if (answer === null) return selected;
      const result = applySelectionInput(answer, selected);
      selected = result.selected;
      if (result.error) output.write(`${result.error}\n`);
      if (result.done) return selected;
    }
  } finally {
    rl.close();
  }
}

/** Nearest ancestor directory holding this package's package.json. */
export function findPackageRoot(fromDirectory) {
  let directory = fromDirectory;
  for (;;) {
    const manifest = path.join(directory, 'package.json');
    if (existsSync(manifest)) {
      try {
        if (JSON.parse(readFileSync(manifest, 'utf8')).name === PACKAGE_NAME) return directory;
      } catch {
        // keep walking up
      }
    }
    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

function listFiles(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    return entry.isDirectory() ? listFiles(path.join(directory, entry.name), relative) : [relative];
  }).sort();
}

function sameTree(left, right) {
  const leftFiles = listFiles(left).filter((file) => file !== MANAGED_MARKER);
  const rightFiles = listFiles(right).filter((file) => file !== MANAGED_MARKER);
  return leftFiles.length === rightFiles.length
    && leftFiles.every((file, index) => file === rightFiles[index]
      && readFileSync(path.join(left, file)).equals(readFileSync(path.join(right, file))));
}

const exists = (target) => {
  try {
    lstatSync(target);
    return true;
  } catch {
    return false;
  }
};

/** Skill directories (a directory with a SKILL.md) inside the package's skills/. */
export function bundledSkills(packageRoot) {
  const skillsRoot = path.join(packageRoot, 'skills');
  if (!existsSync(skillsRoot)) return [];
  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(skillsRoot, entry.name, 'SKILL.md')))
    .map((entry) => entry.name)
    .sort();
}

/**
 * The package directory a symlink should point at: the project's own
 * node_modules/@aceshooting/lyra-ui (stable across upgrades) when it is this package, otherwise the
 * directory this CLI runs from.
 */
function stablePackageRoot(projectDir, packageRoot) {
  let directory = projectDir;
  for (;;) {
    const candidate = path.join(directory, 'node_modules', ...PACKAGE_NAME.split('/'));
    try {
      if (realpathSync(candidate) === realpathSync(packageRoot)) return candidate;
    } catch {
      // not installed here
    }
    const parent = path.dirname(directory);
    if (parent === directory) return packageRoot;
    directory = parent;
  }
}

/** Replaces the marked block, or appends it; never alters text outside the markers. */
export function applyInstructionBlock(original) {
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const block = INSTRUCTION_BLOCK.replaceAll('\n', eol);
  const start = original.indexOf(BLOCK_START);
  if (start !== -1) {
    const endMarker = original.indexOf(BLOCK_END, start);
    if (endMarker === -1) return { error: `${BLOCK_START} has no matching ${BLOCK_END}` };
    const end = endMarker + BLOCK_END.length;
    return { text: original.slice(0, start) + block + original.slice(end) };
  }
  if (original.includes(BLOCK_END)) return { error: `${BLOCK_END} without ${BLOCK_START}` };
  if (original.trim() === '') return { text: block + eol };
  const separator = original.endsWith(eol + eol) ? '' : original.endsWith(eol) ? eol : eol + eol;
  return { text: original + separator + block + eol };
}

/**
 * @param {string[]} argv
 * @param {{ packageRoot?: string, cwd?: string, stdout?: (line: string) => void, stderr?: (line: string) => void,
 *   platform?: string, input?: NodeJS.ReadableStream & { isTTY?: boolean }, output?: NodeJS.WritableStream & { isTTY?: boolean } }} [environment]
 * @returns {Promise<number>} exit code
 */
export async function runInitAgents(argv, environment = {}) {
  const out = environment.stdout ?? ((line) => console.log(line));
  const err = environment.stderr ?? ((line) => console.error(line));
  let options;
  try {
    options = parseArguments(argv);
  } catch (error) {
    err(`lyra-ui init-agents: ${error.message}\n\n${HELP}`);
    return 2;
  }
  if (options.help) {
    out(HELP);
    return 0;
  }

  const packageRoot = environment.packageRoot
    ?? findPackageRoot(path.dirname(fileURLToPath(import.meta.url)));
  const skills = packageRoot ? bundledSkills(packageRoot) : [];
  if (!packageRoot || skills.length === 0) {
    err(`lyra-ui init-agents: no bundled skills found${packageRoot ? ` in ${path.join(packageRoot, 'skills')}` : ''}.`);
    return 1;
  }
  const projectDir = path.resolve(environment.cwd ?? process.cwd(), options.dir ?? '.');
  if (!existsSync(projectDir) || !lstatSync(projectDir).isDirectory()) {
    err(`lyra-ui init-agents: ${projectDir} is not a directory.`);
    return 1;
  }

  // Which agents: --agent(s) > the invoking agent (documented environment) > project config; a
  // human at a terminal with none of those is asked. A caller never gets a prompt.
  const detected = detectAgents(projectDir);
  const caller = detectCaller(environment.env ?? process.env);
  const input = environment.input ?? process.stdin;
  const output = environment.output ?? process.stdout;
  const interactive = options.agents === undefined && caller === undefined && !options.yes
    && !options.json && Boolean(input.isTTY) && Boolean(output.isTTY);
  let selectedIds;
  let source;
  if (options.agents) [selectedIds, source] = [options.agents, 'flag'];
  else if (caller) [selectedIds, source] = [[caller], 'caller'];
  else if (interactive) [selectedIds, source] = [await promptForAgents(detected, input, output), 'prompt'];
  else [selectedIds, source] = [detected, 'detected'];
  const selected = AGENTS.filter((agent) => selectedIds.includes(agent.id));
  const ownDirectories = selected.filter((agent) => agent.ownSkillDir);

  const linkSource = stablePackageRoot(projectDir, packageRoot);
  const platform = environment.platform ?? process.platform;
  const dry = options.dryRun;
  const rel = (target) => path.relative(projectDir, target).split(path.sep).join('/') || '.';
  const records = [];
  let failed = false;
  // `text` is "<relative path> (detail)" or "<relative path>: error"; kept as structured records.
  const report = (status, text) => {
    const [first, ...rest] = text.split(' ');
    records.push({ status, path: path.join(projectDir, first.replace(/:$/u, '')), detail: rest.join(' ') || undefined, error: status === 'error' ? text : undefined });
  };
  const named = (agents) => agents.map((agent) => agent.name).join(', ') || 'none';
  const sourceLabel = { flag: 'from --agents', caller: 'invoking agent detected', prompt: 'selected', detected: 'detected in the project' }[source];

  // 1. Skills: the canonical copy in the shared directory, then links for agents needing their own.
  for (const skill of skills) {
    const bundled = path.join(packageRoot, 'skills', skill);
    const canonical = path.join(projectDir, UNIVERSAL_SKILL_DIR, skill);
    const targets = [
      { target: canonical, label: rel(canonical), canonical: true,
        linkTarget: path.relative(path.dirname(canonical), path.join(linkSource, 'skills', skill)).split(path.sep).join('/') },
      ...ownDirectories.map((agent) => {
        const target = path.join(projectDir, agent.ownSkillDir, skill);
        return { target, label: rel(target), canonical: false,
          linkTarget: path.relative(path.dirname(target), canonical).split(path.sep).join('/') };
      }),
    ];
    for (const entry of targets) {
      try {
        installSkill({ ...entry, bundled, options, platform, dry, report });
      } catch (error) {
        failed = true;
        report('error', `${entry.label}: ${error.message}`);
      }
    }
  }

  // 2. Instruction files: AGENTS.md always (universal); CLAUDE.md only when it exists and does not import it.
  for (const name of ['AGENTS.md', 'CLAUDE.md']) {
    const target = path.join(projectDir, name);
    try {
      const present = existsSync(target);
      if (!present && name === 'CLAUDE.md') continue;
      const original = present ? readFileSync(target, 'utf8') : '';
      if (name === 'CLAUDE.md' && /^@AGENTS\.md\s*$/mu.test(original)) {
        report('skipped', 'CLAUDE.md (imports AGENTS.md, which carries the block)');
        continue;
      }
      const next = applyInstructionBlock(original);
      if (next.error) {
        failed = true;
        report('error', `${name}: ${next.error}; fix the markers by hand and re-run`);
      } else if (next.text === original) {
        report('unchanged', `${name} (block up to date)`);
      } else {
        if (!dry) writeFileSync(target, next.text);
        report(!present ? 'created' : original.includes(BLOCK_START) ? 'updated' : 'added', `${name} (${present ? 'pointer block' : 'with pointer block'})`);
      }
    } catch (error) {
      failed = true;
      report('error', `${name}: ${error.message}`);
    }
  }

  // 3. Result.
  const dangling = !dry && records.some((record) => record.status === 'linked')
    && !existsSync(path.join(projectDir, 'node_modules', ...PACKAGE_NAME.split('/')));
  const next = [];
  if (!failed) {
    const targets = selected.length > 0 ? selected : [];
    for (const agent of targets) next.push(`${agent.name}: ${agent.reload}.`);
    if (targets.length === 0) next.push(`Agents reading ${UNIVERSAL_SKILL_DIR}/ (Codex, OpenCode, Cursor, Gemini CLI, GitHub Copilot, Amp, Windsurf) pick the skill up on their next session; ${AGENTS_MD_NOTE}`);
    if (dangling) next.push("Skills link into node_modules: run your package manager's install first, or re-run with --copy.");
    if (source !== 'flag') next.push(`Not you? Re-run with --agent <${AGENT_IDS.join('|')}> or --agents all.`);
  }
  const code = failed ? 1 : 0;
  if (options.json) {
    out(JSON.stringify({
      ok: !failed,
      dryRun: dry,
      projectDir,
      agents: { source, caller: caller ?? null, selected: selected.map((agent) => agent.id), detected },
      changes: records.map(({ status, path: target, detail, error }) => ({ status, path: target, ...(detail ? { detail } : {}), ...(error ? { error } : {}) })),
      next,
    }, null, 2));
    return code;
  }
  const shown = (record) => (interactive ? rel(record.path) : record.path);
  out(`${dry ? 'lyra-ui init-agents (dry run, nothing written)' : 'lyra-ui init-agents'} in ${projectDir}`);
  out(`Agents: ${UNIVERSAL_SKILL_DIR}/ (shared) + ${named(selected)} (${sourceLabel})`);
  for (const record of records) out(`  ${record.status.padEnd(10)}${shown(record)}${record.detail ? ` ${record.detail}` : ''}`);
  if (!failed) {
    out(dry ? 'Dry run: nothing was written; run without --dry-run to apply.' : 'Done.');
    if (next.length > 0) {
      out('Next:');
      for (const line of next) out(`  - ${line}`);
    }
  }
  return code;
}

function installSkill({ target, bundled, linkTarget, label, canonical, options, platform, dry, report }) {
  // The shared directory honours --copy; per-agent directories are always links to it.
  const wantsCopy = canonical ? options.mode === 'copy' || platform === 'win32' : platform === 'win32';
  const present = exists(target);
  const stat = present ? lstatSync(target) : undefined;
  let managedCopy = false;
  if (stat?.isSymbolicLink()) {
    const current = readlinkSync(target).split(path.sep).join('/');
    const ours = /@aceshooting\/lyra-ui\/skills\//u.test(current) || current === linkTarget
      || /(?:^|\/)\.agents\/skills\/[^/]+$/u.test(current);
    if (!ours && !options.force) {
      report('skipped', `${label} (symlink to ${current} is not managed by lyra-ui; use --force to replace)`);
      return;
    }
    if (!wantsCopy && current === linkTarget) {
      report('unchanged', `${label} -> ${linkTarget}`);
      return;
    }
  } else if (stat?.isDirectory()) {
    managedCopy = existsSync(path.join(target, MANAGED_MARKER));
    if (!managedCopy && !options.force) {
      report('skipped', `${label} (existing directory not created by lyra-ui; use --force to replace)`);
      return;
    }
    if (managedCopy && options.mode !== 'link') {
      if (sameTree(bundled, target)) {
        report('unchanged', `${label} (copy up to date)`);
        return;
      }
      if (!dry) copySkill(bundled, target);
      report('updated', `${label} (copy refreshed)`);
      return;
    }
  } else if (present && !options.force) {
    report('skipped', `${label} (exists and is not a directory; use --force to replace)`);
    return;
  }

  const status = present ? 'updated' : 'created';
  if (dry) {
    report(status, `${label} ${wantsCopy ? '(copy)' : `-> ${linkTarget}`}`);
    return;
  }
  if (present) rmSync(target, { recursive: true, force: true });
  mkdirSync(path.dirname(target), { recursive: true });
  if (wantsCopy) {
    copySkill(bundled, target);
    report(status, `${label} (copy${platform === 'win32' && options.mode !== 'copy' ? ', symlinks skipped on Windows' : ''})`);
    return;
  }
  try {
    symlinkSync(linkTarget, target, 'dir');
    report(status === 'created' ? 'linked' : 'relinked', `${label} -> ${linkTarget}`);
  } catch (error) {
    copySkill(bundled, target);
    report(status, `${label} (copy; symlink failed: ${error.code ?? error.message})`);
  }
}

function copySkill(source, target) {
  rmSync(target, { recursive: true, force: true });
  cpSync(source, target, { recursive: true });
  writeFileSync(path.join(target, MANAGED_MARKER), 'Managed by `npx lyra-ui init-agents`; re-run it to refresh this copy.\n');
}
