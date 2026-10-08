#!/usr/bin/env node
// Generates packages/lyra-ui/skills/ (the skills that ship inside the npm package and that
// `npx lyra-ui init-agents` installs) from the single authored source, plugins/lyra-ui. The plugin
// keeps its own generated references/ copy for marketplace installs; the bundle instead points at the
// package's own llms/ directory (`node_modules/@aceshooting/lyra-ui/llms/`), so nothing is duplicated.
//
//   node scripts/build-skill-bundle.mjs           write packages/lyra-ui/skills/
//   node scripts/build-skill-bundle.mjs --check   fail when the committed bundle is stale
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { isMainModule } from '../packages/lyra-ui/scripts/is-main-module.mjs';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const PACKAGE_PREFIX = 'node_modules/@aceshooting/lyra-ui';
const LLMS_PREFIX = `${PACKAGE_PREFIX}/llms/`;
const SKILL_PREFIX = `${PACKAGE_PREFIX}/skills/lyra-ui/`;
const PLUGIN_ONLY_BLOCK = /^<!-- plugin-only:start -->\n[\s\S]*?\n<!-- plugin-only:end -->\n/gmu;
const PLUGIN_ONLY_INLINE = /<!-- plugin-only:start -->[\s\S]*?<!-- plugin-only:end -->/gu;

/** Longest description Codex accepts for a skill (Claude's limit is higher). */
export const MAX_DESCRIPTION_LENGTH = 1024;

/** Source file (relative to plugins/lyra-ui) -> bundle path (relative to packages/lyra-ui/skills). */
function bundleEntries(pluginDir) {
  const entries = [
    ['skills/lyra-ui/SKILL.md', 'lyra-ui/SKILL.md', 'lyra-ui'],
    ['skills/lyra-ui/reporting.md', 'lyra-ui/reporting.md', 'lyra-ui'],
    ['skills/compose-lyra-interfaces/SKILL.md', 'compose-lyra-interfaces/SKILL.md', 'compose'],
    [
      'skills/compose-lyra-interfaces/references/composition-patterns.md',
      'compose-lyra-interfaces/references/composition-patterns.md',
      'compose',
    ],
    [
      'skills/compose-lyra-interfaces/agents/openai.yaml',
      'compose-lyra-interfaces/agents/openai.yaml',
      'compose',
    ],
  ];
  for (const name of readdirSync(path.join(pluginDir, 'commands')).sort()) {
    if (name.endsWith('.md')) entries.push([`commands/${name}`, `lyra-ui/commands/${name}`, 'lyra-ui']);
  }
  return entries;
}

/** Pure text transform from plugin-relative wording to package-relative wording. */
export function bundleText(text, kind) {
  let out = text
    .replace(PLUGIN_ONLY_BLOCK, '')
    .replace(PLUGIN_ONLY_INLINE, '')
    .replace(/\n{3,}/gu, '\n\n');
  if (kind === 'compose') {
    out = out.replaceAll('../lyra-ui/references/', LLMS_PREFIX);
  } else {
    out = out
      .replaceAll('${CLAUDE_PLUGIN_ROOT}/skills/lyra-ui/references/', LLMS_PREFIX)
      .replaceAll('${CLAUDE_PLUGIN_ROOT}/skills/lyra-ui/', SKILL_PREFIX)
      .replaceAll('${CLAUDE_PLUGIN_ROOT}/commands/', `${SKILL_PREFIX}commands/`)
      .replace(/(?<![\w./-])references\//gu, LLMS_PREFIX);
  }
  return out;
}

export function parseFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---\n/u.exec(text);
  if (!match) return null;
  const fields = {};
  const lines = match[1].split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const field = /^([A-Za-z_-]+):\s*(.*)$/u.exec(lines[index]);
    if (!field) continue;
    let value = field[2];
    if (/^[>|][+-]?$/u.test(value)) {
      const folded = [];
      while (index + 1 < lines.length && /^\s+\S/u.test(lines[index + 1])) {
        index += 1;
        folded.push(lines[index].trim());
      }
      value = folded.join(' ');
    }
    fields[field[1]] = value.trim();
  }
  return fields;
}

/**
 * Renders the whole bundle in memory.
 * @returns {{ files: Map<string, string>, problems: string[] }}
 */
export function renderSkillBundle(root = repoRoot) {
  const pluginDir = path.join(root, 'plugins/lyra-ui');
  const packageDir = path.join(root, 'packages/lyra-ui');
  const files = new Map();
  const problems = [];

  for (const [source, target, kind] of bundleEntries(pluginDir)) {
    const text = bundleText(readFileSync(path.join(pluginDir, source), 'utf8'), kind);
    files.set(target, text);

    if (text.includes('${CLAUDE_PLUGIN_ROOT}') || text.includes('plugin-only')) {
      problems.push(`${target}: still mentions the plugin root or a plugin-only marker`);
    }
    if (kind === 'lyra-ui' && /(?<![\w./-])references\//u.test(text)) {
      problems.push(`${target}: has a references/ path that does not resolve inside the package`);
    }
    for (const match of text.matchAll(/node_modules\/@aceshooting\/lyra-ui\/([^\s)`'"#<>]+)/gu)) {
      const relative = match[1].replace(/[.,;:]+$/u, '');
      if (relative.includes('$')) continue;
      if (relative.endsWith('/') && existsSync(path.join(packageDir, relative))) continue;
      if (!existsSync(path.join(packageDir, relative)) && !relative.startsWith('skills/')) {
        problems.push(`${target}: ${match[0]} does not exist in packages/lyra-ui`);
      }
    }
  }

  for (const directory of ['lyra-ui', 'compose-lyra-interfaces']) {
    const skill = files.get(`${directory}/SKILL.md`);
    const meta = skill ? parseFrontmatter(skill) : null;
    if (!meta?.name || !meta.description) {
      problems.push(`${directory}/SKILL.md: frontmatter needs name and description`);
      continue;
    }
    if (meta.name !== directory) problems.push(`${directory}/SKILL.md: name "${meta.name}" must equal its directory`);
    if (meta.description.length > MAX_DESCRIPTION_LENGTH) {
      problems.push(`${directory}/SKILL.md: description exceeds ${MAX_DESCRIPTION_LENGTH} characters`);
    }
  }
  return { files, problems };
}

function walk(directory, prefix = '') {
  const found = [];
  if (!existsSync(directory)) return found;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) found.push(...walk(path.join(directory, entry.name), relative));
    else found.push(relative);
  }
  return found.sort();
}

/** Differences between the rendered bundle and the tree on disk. */
export function bundleDifferences(files, outputDir) {
  const differences = [];
  const onDisk = new Set(walk(outputDir));
  for (const [relative, text] of files) {
    if (!onDisk.has(relative)) differences.push(`missing: skills/${relative}`);
    else if (readFileSync(path.join(outputDir, relative), 'utf8') !== text) differences.push(`stale: skills/${relative}`);
  }
  for (const relative of onDisk) if (!files.has(relative)) differences.push(`unexpected: skills/${relative}`);
  return differences;
}

export function writeSkillBundle(files, outputDir) {
  rmSync(outputDir, { recursive: true, force: true });
  for (const [relative, text] of files) {
    const target = path.join(outputDir, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, text);
  }
}

function main(argv) {
  const check = argv.includes('--check');
  const outputDir = path.join(repoRoot, 'packages/lyra-ui/skills');
  const { files, problems } = renderSkillBundle(repoRoot);
  if (problems.length > 0) {
    console.error(problems.join('\n'));
    return 1;
  }
  if (check) {
    const differences = bundleDifferences(files, outputDir);
    if (differences.length > 0) {
      console.error(`${differences.join('\n')}\npackages/lyra-ui/skills/ is out of sync with plugins/lyra-ui; run ./package.sh`);
      return 1;
    }
    console.log(`Bundled skills are current (${files.size} files).`);
    return 0;
  }
  writeSkillBundle(files, outputDir);
  const bytes = [...files.values()].reduce((sum, text) => sum + Buffer.byteLength(text), 0);
  console.log(`Bundled ${files.size} skill files (${bytes.toLocaleString('en')} bytes) into packages/lyra-ui/skills/.`);
  return 0;
}

if (isMainModule(import.meta.url)) process.exitCode = main(process.argv.slice(2));
