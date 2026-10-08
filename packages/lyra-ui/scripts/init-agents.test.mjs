import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { AGENTS, AGENT_IDS, detectCaller, skillInstallDirectories } from './agent-registry.mjs';
import {
  BLOCK_END, BLOCK_START, INSTRUCTION_BLOCK, MANAGED_MARKER, applyInstructionBlock, applySelectionInput, bundledSkills,
  detectAgents, findPackageRoot, parseArguments, runInitAgents,
} from './init-agents.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const roots = [];

function workspace() {
  const root = mkdtempSync(path.join(tmpdir(), 'lyra-init-agents-'));
  roots.push(root);
  const pkg = path.join(root, 'store', 'lyra-ui');
  for (const name of ['lyra-ui', 'compose-lyra-interfaces']) {
    mkdirSync(path.join(pkg, 'skills', name, 'references'), { recursive: true });
    writeFileSync(path.join(pkg, 'skills', name, 'SKILL.md'), `---\nname: ${name}\ndescription: test\n---\n`);
    writeFileSync(path.join(pkg, 'skills', name, 'references', 'a.md'), `a ${name}\n`);
  }
  mkdirSync(path.join(pkg, 'skills', 'not-a-skill'), { recursive: true });
  writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: '@aceshooting/lyra-ui' }));
  const project = path.join(root, 'project');
  mkdirSync(path.join(project, 'node_modules', '@aceshooting'), { recursive: true });
  symlinkSync(pkg, path.join(project, 'node_modules', '@aceshooting', 'lyra-ui'), 'dir');
  return { root, pkg, project };
}

async function run(project, pkg, args = [], env = {}) {
  const lines = [];
  const errors = [];
  // A non-TTY stream: if the command ever prompted it would hang the test, so every call proves no prompt.
  const code = await runInitAgents(['--dir', project, ...args], {
    packageRoot: pkg, stdout: (line) => lines.push(line), stderr: (line) => errors.push(line),
    input: { isTTY: false }, output: { isTTY: false }, env,
  });
  return { code, text: lines.join('\n'), errors: errors.join('\n') };
}

const read = (...parts) => readFileSync(path.join(...parts), 'utf8');
const isLink = (target) => lstatSync(target).isSymbolicLink();

after(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }); });

const SKILLS = ['lyra-ui', 'compose-lyra-interfaces'];
const linkTo = (name) => `../../node_modules/@aceshooting/lyra-ui/skills/${name}`;

describe('agent registry', () => {
  test('lists only agents with documented project skill support, each with an official docs URL', () => {
    assert.deepEqual(AGENT_IDS, ['claude', 'codex', 'opencode', 'cursor', 'gemini', 'copilot', 'amp', 'windsurf']);
    for (const agent of AGENTS) {
      assert.match(agent.docs, /^https:\/\//u, agent.id);
      assert.ok(agent.reads.length > 0, agent.id);
      // Every agent either reads the shared directory or declares the one extra directory it needs.
      assert.ok(agent.ownSkillDir !== null || agent.reads.includes('.agents/skills'), agent.id);
    }
    assert.deepEqual(skillInstallDirectories(), ['.agents/skills', '.claude/skills']);
  });

  test('detects agents from their config paths', () => {
    const { project } = workspace();
    assert.deepEqual(detectAgents(project), []);
    mkdirSync(path.join(project, '.opencode'));
    writeFileSync(path.join(project, 'CLAUDE.md'), '# c\n');
    mkdirSync(path.join(project, '.github'));
    writeFileSync(path.join(project, '.github/copilot-instructions.md'), 'x');
    assert.deepEqual(detectAgents(project), ['claude', 'opencode', 'copilot']);
  });
});

describe('init-agents agent selection', () => {
  test('default with nothing detected: only the shared .agents/skills symlinks, never prompting', async () => {
    const { pkg, project } = workspace();
    const result = await run(project, pkg);
    assert.equal(result.code, 0, result.text + result.errors);
    for (const name of SKILLS) {
      const target = path.join(project, '.agents/skills', name);
      assert.equal(isLink(target), true);
      assert.equal(readlinkSync(target), linkTo(name));
      assert.match(read(target, 'SKILL.md'), new RegExp(`name: ${name}`, 'u'));
    }
    assert.equal(existsSync(path.join(project, '.claude')), false);
    assert.equal(existsSync(path.join(project, '.agents/skills/not-a-skill')), false);
    assert.match(result.text, /--agents all/u);
    assert.match(result.text, /detected in the project/u);
  });

  test('a detected Claude Code gets a link to the shared copy; --yes behaves the same', async () => {
    const { pkg, project } = workspace();
    mkdirSync(path.join(project, '.claude'));
    const result = await run(project, pkg, ['--yes']);
    assert.equal(result.code, 0);
    for (const name of SKILLS) {
      const target = path.join(project, '.claude/skills', name);
      assert.equal(isLink(target), true);
      assert.equal(readlinkSync(target), `../../.agents/skills/${name}`);
      assert.match(read(target, 'SKILL.md'), new RegExp(`name: ${name}`, 'u'));
    }
  });

  test('--agents overrides detection both ways', async () => {
    const { pkg, project } = workspace();
    mkdirSync(path.join(project, '.claude'));
    // Detected claude is NOT installed when --agents names only others.
    assert.equal((await run(project, pkg, ['--agents', 'opencode,codex'])).code, 0);
    assert.equal(existsSync(path.join(project, '.claude/skills')), false);
    assert.equal(existsSync(path.join(project, '.agents/skills/lyra-ui')), true);
    // Naming claude installs it in a project that does not use it yet.
    const other = workspace();
    assert.equal((await run(other.project, other.pkg, ['--agents', 'claude'])).code, 0);
    assert.equal(isLink(path.join(other.project, '.claude/skills/lyra-ui')), true);
  });

  test('--agents all installs for every registered agent', async () => {
    const { pkg, project } = workspace();
    const result = await run(project, pkg, ['--agents', 'all']);
    assert.equal(result.code, 0);
    for (const agent of AGENTS) assert.match(result.text, new RegExp(agent.name, 'u'));
    assert.equal(isLink(path.join(project, '.claude/skills/lyra-ui')), true);
    assert.equal(isLink(path.join(project, '.agents/skills/lyra-ui')), true);
    assert.deepEqual(parseArguments(['--agents=all']).agents, AGENT_IDS);
  });

  test('an agent without own directory needs nothing beyond the shared copy and AGENTS.md block', async () => {
    const { pkg, project } = workspace();
    const result = await run(project, pkg, ['--agents', 'amp']);
    assert.equal(result.code, 0);
    assert.equal(existsSync(path.join(project, '.claude')), false);
    assert.equal(existsSync(path.join(project, '.agents/skills/lyra-ui')), true);
    assert.equal(read(project, 'AGENTS.md'), `${INSTRUCTION_BLOCK}\n`);
  });

  test('is idempotent: a second run changes nothing', async () => {
    const { pkg, project } = workspace();
    mkdirSync(path.join(project, '.claude'));
    await run(project, pkg);
    const before = read(project, 'AGENTS.md');
    const second = await run(project, pkg);
    assert.equal(second.code, 0);
    assert.doesNotMatch(second.text, /^\s+(?:created|updated|linked|relinked|added)\s/mu);
    assert.match(second.text, /unchanged/u);
    assert.equal(read(project, 'AGENTS.md'), before);
  });

  test('--copy copies the shared directory, marks it managed, refreshes it, and --link converts back', async () => {
    const { pkg, project } = workspace();
    mkdirSync(path.join(project, '.claude'));
    assert.equal((await run(project, pkg, ['--copy'])).code, 0);
    const target = path.join(project, '.agents/skills/lyra-ui');
    assert.equal(isLink(target), false);
    assert.equal(existsSync(path.join(target, MANAGED_MARKER)), true);
    // The Claude entry is a link to the shared copy even in copy mode.
    assert.equal(readlinkSync(path.join(project, '.claude/skills/lyra-ui')), '../../.agents/skills/lyra-ui');
    assert.equal((await run(project, pkg, ['--copy'])).text.includes('copy up to date'), true);
    writeFileSync(path.join(pkg, 'skills/lyra-ui/references/a.md'), 'changed\n');
    assert.match((await run(project, pkg)).text, /copy refreshed/u);
    assert.equal(read(target, 'references/a.md'), 'changed\n');
    assert.equal((await run(project, pkg, ['--link'])).code, 0);
    assert.equal(isLink(target), true);
  });

  test('--dry-run reports and writes nothing', async () => {
    const { pkg, project } = workspace();
    const result = await run(project, pkg, ['--dry-run', '--agents', 'all']);
    assert.equal(result.code, 0);
    assert.match(result.text, /dry run/u);
    assert.match(result.text, /created/u);
    assert.equal(existsSync(path.join(project, '.claude')), false);
    assert.equal(existsSync(path.join(project, '.agents')), false);
    assert.equal(existsSync(path.join(project, 'AGENTS.md')), false);
  });

  test('never replaces a directory or symlink it did not create unless --force', async () => {
    const { pkg, project } = workspace();
    const own = path.join(project, '.agents/skills/lyra-ui');
    mkdirSync(own, { recursive: true });
    writeFileSync(path.join(own, 'SKILL.md'), 'mine\n');
    const foreign = path.join(project, '.claude/skills/compose-lyra-interfaces');
    mkdirSync(path.dirname(foreign), { recursive: true });
    symlinkSync('../../somewhere-else', foreign, 'dir');
    const result = await run(project, pkg, ['--agents', 'claude']);
    assert.equal(result.code, 0);
    assert.match(result.text, /not created by lyra-ui/u);
    assert.match(result.text, /not managed by lyra-ui/u);
    assert.equal(read(own, 'SKILL.md'), 'mine\n');
    assert.equal(readlinkSync(foreign), '../../somewhere-else');
    assert.equal((await run(project, pkg, ['--agents', 'claude', '--force'])).code, 0);
    assert.equal(isLink(own), true);
    assert.equal(isLink(foreign), true);
  });

  test('a dangling managed symlink (dependencies not installed) is left alone on re-run', async () => {
    const { root, pkg } = workspace();
    const bare = path.join(root, 'bare');
    mkdirSync(bare);
    const first = await run(bare, pkg);
    assert.equal(first.code, 0);
    assert.match(first.text, /Skills link into node_modules/u);
    assert.match((await run(bare, pkg)).text, /unchanged/u);
  });

  test('fails clearly when the package ships no skills', async () => {
    const { root, project } = workspace();
    const empty = path.join(root, 'empty');
    mkdirSync(empty);
    const result = await run(project, empty);
    assert.equal(result.code, 1);
    assert.match(result.errors, /no bundled skills/u);
  });

  test('rejects bad options and a missing project directory', async () => {
    const { pkg, project } = workspace();
    assert.equal((await run(project, pkg, ['--agents', 'vim'])).code, 2);
    assert.equal((await run(project, pkg, ['--nope'])).code, 2);
    assert.equal((await run(path.join(project, 'missing'), pkg)).code, 1);
    assert.equal((await run(project, pkg, ['--help'])).code, 0);
    assert.deepEqual(parseArguments(['--agents=claude', '-n', '-y']).agents, ['claude']);
    assert.equal(parseArguments(['-y']).yes, true);
  });
});

describe('invoking-agent detection and precedence', () => {
  test('detects only agents with a documented environment variable', () => {
    assert.equal(detectCaller({ CLAUDECODE: '1' }), 'claude');
    assert.equal(detectCaller({ GEMINI_CLI: '1' }), 'gemini');
    assert.equal(detectCaller({ CLAUDECODE: '0' }), undefined);
    assert.equal(detectCaller({ CURSOR_AGENT: '1', CODEX_THREAD_ID: 'x', OPENCODE: '1', AGENT: 'amp' }), undefined);
    assert.equal(detectCaller({}), undefined);
    for (const agent of AGENTS) assert.ok(agent.reload.length > 10, agent.id);
  });

  test('a caller selects itself, beating project config, and reports reload steps', async () => {
    const { pkg, project } = workspace();
    mkdirSync(path.join(project, '.gemini'));
    const result = await run(project, pkg, [], { CLAUDECODE: '1' });
    assert.equal(result.code, 0);
    assert.equal(isLink(path.join(project, '.claude/skills/lyra-ui')), true);
    assert.match(result.text, /invoking agent detected/u);
    assert.match(result.text, /Claude Code: run \/reload-skills/u);
    assert.doesNotMatch(result.text, /Gemini CLI:/u);
    assert.ok(result.text.includes(path.join(project, '.agents/skills/lyra-ui')), 'absolute paths for agents');
  });

  test('--agent overrides the caller, and the caller overrides project config', async () => {
    const { pkg, project } = workspace();
    const flagged = await run(project, pkg, ['--agent', 'codex'], { CLAUDECODE: '1' });
    assert.match(flagged.text, /from --agents/u);
    assert.equal(existsSync(path.join(project, '.claude')), false);
    const other = workspace();
    mkdirSync(path.join(other.project, '.claude'));
    const viaCaller = await run(other.project, other.pkg, [], { GEMINI_CLI: '1' });
    assert.match(viaCaller.text, /Gemini CLI: run \/skills reload/u);
    assert.equal(existsSync(path.join(other.project, '.claude/skills')), false);
  });

  test('a caller on a terminal is never prompted', async () => {
    const { PassThrough } = await import('node:stream');
    const { pkg, project } = workspace();
    const input = new PassThrough();
    input.isTTY = true;
    const output = new PassThrough();
    output.isTTY = true;
    let written = '';
    output.on('data', (chunk) => { written += chunk; });
    const code = await runInitAgents(['--dir', project], {
      packageRoot: pkg, stdout: () => {}, stderr: () => {}, input, output, env: { CLAUDECODE: '1' },
    });
    assert.equal(code, 0);
    assert.doesNotMatch(written, /Which AI coding agents/u);
    assert.equal(isLink(path.join(project, '.claude/skills/lyra-ui')), true);
  });

  test('--json prints one object with the documented shape and exits 0 when nothing changes', async () => {
    const { pkg, project } = workspace();
    const first = JSON.parse((await run(project, pkg, ['--json'], { CLAUDECODE: '1' })).text);
    assert.deepEqual(Object.keys(first), ['ok', 'dryRun', 'projectDir', 'agents', 'changes', 'next']);
    assert.equal(first.ok, true);
    assert.deepEqual(first.agents, { source: 'caller', caller: 'claude', selected: ['claude'], detected: [] });
    assert.ok(first.changes.every((change) => path.isAbsolute(change.path) && typeof change.status === 'string'));
    assert.ok(first.changes.some((change) => change.path.endsWith('AGENTS.md')));
    assert.ok(first.next.some((line) => line.includes('/reload-skills')));
    const again = await run(project, pkg, ['--json'], { CLAUDECODE: '1' });
    assert.equal(again.code, 0);
    assert.ok(JSON.parse(again.text).changes.every((change) => change.status === 'unchanged'));
  });
});

describe('interactive selection helper', () => {
  test('numbers and names toggle, a/n select all/none, empty confirms, bad input is reported', () => {
    assert.deepEqual(applySelectionInput('1 3', []), { selected: ['claude', 'opencode'], done: false });
    assert.deepEqual(applySelectionInput('1, cursor', ['claude', 'codex']).selected, ['codex', 'cursor']);
    assert.deepEqual(applySelectionInput('a', []).selected, AGENT_IDS);
    assert.deepEqual(applySelectionInput('n', AGENT_IDS).selected, []);
    assert.deepEqual(applySelectionInput('  ', ['amp']), { selected: ['amp'], done: true });
    const bad = applySelectionInput('99', ['amp']);
    assert.equal(bad.done, false);
    assert.deepEqual(bad.selected, ['amp']);
    assert.match(bad.error, /not a listed/u);
  });

  test('a TTY prompt is used only without --agents and --yes (simulated terminal)', async () => {
    const { PassThrough } = await import('node:stream');
    const { pkg, project } = workspace();
    const make = () => {
      const input = new PassThrough();
      input.isTTY = true;
      const output = new PassThrough();
      output.isTTY = true;
      let written = '';
      output.on('data', (chunk) => { written += chunk; });
      return { input, output, text: () => written };
    };
    const lines = [];
    const terminal = make();
    const pending = runInitAgents(['--dir', project], {
      packageRoot: pkg, stdout: (line) => lines.push(line), stderr: () => {}, input: terminal.input, output: terminal.output, env: {},
    });
    terminal.input.write('1\n\n');
    assert.equal(await pending, 0);
    assert.match(terminal.text(), /Which AI coding agents/u);
    assert.equal(isLink(path.join(project, '.claude/skills/lyra-ui')), true);
    // --yes and --agents never prompt even on a terminal (the stream would never answer).
    for (const args of [['--yes'], ['--agents', 'codex']]) {
      const silent = make();
      const other = workspace();
      const code = await runInitAgents(['--dir', other.project, ...args], {
        packageRoot: other.pkg, stdout: () => {}, stderr: () => {}, input: silent.input, output: silent.output, env: {},
      });
      assert.equal(code, 0);
      assert.doesNotMatch(silent.text(), /Which AI coding agents/u);
    }
  });
});

describe('init-agents instruction block', () => {
  test('creates AGENTS.md always, and writes CLAUDE.md only when it exists', async () => {
    const { pkg, project } = workspace();
    await run(project, pkg);
    assert.equal(read(project, 'AGENTS.md'), `${INSTRUCTION_BLOCK}\n`);
    assert.equal(existsSync(path.join(project, 'CLAUDE.md')), false);
    writeFileSync(path.join(project, 'CLAUDE.md'), '# Project\n\nKeep tests green.\n');
    await run(project, pkg);
    assert.equal(read(project, 'CLAUDE.md'), `# Project\n\nKeep tests green.\n\n${INSTRUCTION_BLOCK}\n`);
  });

  test('refreshes a stale block in place without touching surrounding content', async () => {
    const { pkg, project } = workspace();
    writeFileSync(
      path.join(project, 'AGENTS.md'),
      `# Mine\n\n${BLOCK_START}\nold text\n${BLOCK_END}\n\n## After\nkeep\n`,
    );
    const result = await run(project, pkg);
    assert.match(result.text, /updated\s+\S*AGENTS\.md/u);
    assert.equal(read(project, 'AGENTS.md'), `# Mine\n\n${INSTRUCTION_BLOCK}\n\n## After\nkeep\n`);
    assert.match((await run(project, pkg)).text, /AGENTS\.md \(block up to date\)/u);
  });

  test('preserves CRLF files and appends exactly one blank line', () => {
    assert.equal(
      applyInstructionBlock('# A\r\n').text,
      `# A\r\n\r\n${INSTRUCTION_BLOCK.replaceAll('\n', '\r\n')}\r\n`,
    );
    assert.equal(applyInstructionBlock('').text, `${INSTRUCTION_BLOCK}\n`);
    assert.equal(applyInstructionBlock('x\n\n').text, `x\n\n${INSTRUCTION_BLOCK}\n`);
  });

  test('refuses to edit a file with a broken marker pair', async () => {
    const { pkg, project } = workspace();
    const broken = `# Mine\n${BLOCK_START}\nunterminated\n`;
    writeFileSync(path.join(project, 'AGENTS.md'), broken);
    const result = await run(project, pkg);
    assert.equal(result.code, 1);
    assert.match(result.text, /no matching/u);
    assert.equal(read(project, 'AGENTS.md'), broken);
    assert.equal(applyInstructionBlock(`x ${BLOCK_END}\n`).error !== undefined, true);
  });

  test('does not duplicate the block into a CLAUDE.md that imports AGENTS.md', async () => {
    const { pkg, project } = workspace();
    writeFileSync(path.join(project, 'CLAUDE.md'), '@AGENTS.md\n');
    const result = await run(project, pkg);
    assert.match(result.text, /imports AGENTS\.md/u);
    assert.equal(read(project, 'CLAUDE.md'), '@AGENTS.md\n');
  });

  test('--dry-run leaves existing files untouched', async () => {
    const { pkg, project } = workspace();
    writeFileSync(path.join(project, 'AGENTS.md'), '# keep\n');
    await run(project, pkg, ['--dry-run']);
    assert.equal(read(project, 'AGENTS.md'), '# keep\n');
  });

  test('the block points at files that exist in the real package', () => {
    const packageRoot = findPackageRoot(scriptsDir);
    assert.ok(packageRoot, 'package root found');
    assert.equal(existsSync(path.join(packageRoot, 'llms.txt')), true);
    for (const match of INSTRUCTION_BLOCK.matchAll(/node_modules\/@aceshooting\/lyra-ui\/([^\s`<]+)/gu)) {
      const relative = match[1].replace(/[.,]$/u, '');
      assert.equal(existsSync(path.join(packageRoot, relative.replace(/\/<tag>\.md$/u, ''))), true, relative);
    }
  });
});

describe('bundled skills of this checkout', () => {
  test('lists lyra-ui and compose-lyra-interfaces with valid frontmatter', async () => {
    const packageRoot = findPackageRoot(scriptsDir);
    const skills = bundledSkills(packageRoot);
    assert.deepEqual(skills, ['compose-lyra-interfaces', 'lyra-ui']);
    for (const name of skills) {
      const text = read(packageRoot, 'skills', name, 'SKILL.md');
      assert.match(text, new RegExp(`^---\\nname: ${name}\\ndescription:`, 'u'));
    }
  });

  test('the lyra-ui executable dispatches init-agents', async () => {
    const { project } = workspace();
    const cli = spawnSync(process.execPath, [path.join(scriptsDir, 'lyra-ui.mjs'), 'init-agents', '--yes', '--dry-run', '--dir', project], { encoding: 'utf8' });
    assert.equal(cli.status, 0, cli.stderr);
    assert.match(cli.stdout, /dry run/u);
    const unknown = spawnSync(process.execPath, [path.join(scriptsDir, 'lyra-ui.mjs'), 'nope'], { encoding: 'utf8' });
    assert.equal(unknown.status, 2);
    const migrate = spawnSync(process.execPath, [path.join(scriptsDir, 'lyra-ui.mjs'), 'migrate-wa', '--help'], { encoding: 'utf8' });
    assert.equal(migrate.status, 0, migrate.stderr);
    assert.match(migrate.stdout, /Usage: lyra-ui-migrate/u);
  });
});
