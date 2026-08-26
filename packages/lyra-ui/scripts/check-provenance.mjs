#!/usr/bin/env node
import { isMainModule } from './is-main-module.mjs';

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryDir = path.resolve(packageDir, '..', '..');

const TEXT_FILE = /\.(?:cjs|css|cts|html|js|json|jsonc|jsx|md|mdx|mjs|mts|scss|sh|svg|ts|tsx|txt|xml|ya?ml)$/i;
const POLICY_FIXTURE_FILES = new Set([
  'packages/lyra-ui/scripts/check-provenance.mjs',
  'packages/lyra-ui/scripts/check-provenance.test.mjs',
]);
const GENERATED_OR_MIRRORED_PATH =
  /^(?:packages\/lyra-ui\/(?:custom-elements\.json|design-tokens\.json|llms-full\.txt|llms\/components\/|vscode-(?:css|html)-data\.json|web-types\.json)|plugins\/lyra-ui\/skills\/lyra-ui\/references\/|\.storybook\/token-preview\.generated\.js|skills\/.*\.skill$)/;

const forbidden = [
  { label: 'internal issue reference', pattern: /\bfr_[a-z0-9_-]{22}\b/i },
  { label: 'fix brief', pattern: /\bfix brief\b/i },
  { label: 'round-specific fix', pattern: /\bround\s+\d+['’]?s?\s+fix\b/i },
  { label: 'internal phase reference', pattern: /\b(?:this|later|future)[ -]phase\b/i },
  { label: 'release-tier framing', pattern: /\b(?:release[ -]tier|full tag\/tier table|component tiers|v1 core)\b/i },
  { label: 'internal review status', pattern: /\b(?:review finding|audit severity|battle-tested|adoption status)\b/i },
  {
    label: 'stale roadmap wording',
    pattern: /\b(?:a|the)\s+future\s+(?:enhancement|optimization|sticky-header|pin\/delete|streaming renderer|value|theme|option)\b/i,
  },
  { label: 'stale version wording', pattern: /\bpossible\s+v\d+\s+option\b/i },
  { label: 'reserved future feature', pattern: /\breserved for a future\b/i },
  {
    label: 'internal audit or review process',
    pattern:
      /\b(?:(?:audit|review)[ -](?:sweep|round|batch|finding|findings|severity|blocker)|(?:full-library|comprehensive)[ -](?:audit|review|re-audit)|full[ -]sweep remediation)\b/i,
  },
  {
    label: 'internal work label',
    pattern:
      /\b(?:task|family|tier|batch|round)(?:(?:\s*[:#]\s*|[-_])(?:[a-z]{0,4}\d+)|\s+(?:[a-z]{1,4}\d+|\d+))\b/i,
  },
];

const LOCAL_TOOLING_REFERENCE =
  /(?:^|[^a-z0-9_.-])(?:\.superpowers(?:[/\\]|$)|docs[/\\]superpowers(?:[/\\]|$)|superpowers[/\\](?:plans|reviews|specs)(?:[/\\]|$)|\.playwright-mcp(?:[/\\]|$)|playwright-mcp(?:[/\\]|$)|\.claude(?:[/\\]|$)|\.codex(?:[/\\]|$)|lyra-ui-audit\.md\b)/i;
const HASH = /(?<![a-f0-9#@/])[a-f0-9]{7,40}(?![a-f0-9])/gi;
const HASH_CONTEXT =
  /\b(?:commit(?:ted)?|introduced|fixed|corrected|changed|regressed|regression|landed|added|removed|rewritten|implemented|before|after|since)\b/i;
const DOCUMENTATION_FILE = /\.(?:md|mdx|txt)$/i;
const CODE_COMMENT = /(?:\/\/|\/\*|<!--|^\s*\*|^\s*#)/;
const STRUCTURED_COMMIT_METADATA =
  /^\s*(?:[-*]\s+)?(?:capture source commit|source commit|commit|revision)\s*:\s*`?[a-f0-9]{7,40}`?(?:\s*\([^)]*\))?\s*$/i;
const CHANGELOG_COMMIT_PREFIX = /^\s*-\s+[a-f0-9]{7,40}\s*:/i;
const NON_PERSONAL_USERS = new Set([
  'example',
  'node',
  'root',
  'runner',
  'user',
  'username',
]);

function normalizedPath(file) {
  return String(file).replaceAll('\\', '/').replace(/^\.\//, '');
}

export function isTrackedTextPath(file) {
  const relative = normalizedPath(file);
  return (
    TEXT_FILE.test(relative)
    && !POLICY_FIXTURE_FILES.has(relative)
    && !GENERATED_OR_MIRRORED_PATH.test(relative)
  );
}

function isPolicyDefinitionLine(file, line) {
  return (
    normalizedPath(file) === 'docs/agents/coding-conventions.md'
    && /must not cite internal audits|audit severity ratings|review finding|battle-tested/.test(line)
  );
}

function containsExplanatoryCommitHash(file, line) {
  const relative = normalizedPath(file);
  if (path.posix.basename(relative).toLowerCase() === 'changelog.md' && CHANGELOG_COMMIT_PREFIX.test(line)) {
    return false;
  }
  if (STRUCTURED_COMMIT_METADATA.test(line)) return false;
  const prose = DOCUMENTATION_FILE.test(relative) || CODE_COMMENT.test(line);
  if (!prose || !HASH_CONTEXT.test(line)) return false;
  for (const match of line.matchAll(HASH)) {
    const value = match[0];
    if (/[a-f]/i.test(value) && /\d/.test(value)) return true;
  }
  return false;
}

function containsPersonalPath(line) {
  const unixHomes = line.matchAll(/\/(?:Users|home)\/([A-Za-z0-9._-]+)\/(?=[^\s`'"<>])/g);
  for (const match of unixHomes) {
    const rest = line.slice(match.index + match[0].length);
    if (!NON_PERSONAL_USERS.has(match[1].toLowerCase()) && /(?:Projects?|workspace|repos?|src|work)\//i.test(rest)) {
      return true;
    }
  }
  const windowsHomes = line.matchAll(/\b[a-z]:\\Users\\([a-z0-9._-]+)\\(?=[^\s`'"<>])/gi);
  for (const match of windowsHomes) {
    const rest = line.slice(match.index + match[0].length);
    if (!NON_PERSONAL_USERS.has(match[1].toLowerCase()) && /(?:Projects?|workspace|repos?|src|work)\\/i.test(rest)) {
      return true;
    }
  }
  return /\/mnt\/[a-f0-9]{8}-[a-f0-9-]{27,}\/[^\s`'"<>]+/i.test(line);
}

export function findProvenanceFindings({ file, source }) {
  const relative = normalizedPath(file);
  if (POLICY_FIXTURE_FILES.has(relative)) return [];
  const findings = [];
  String(source).split('\n').forEach((line, index) => {
    const labels = new Set();
    for (const rule of forbidden) {
      if (rule.pattern.test(line) && !isPolicyDefinitionLine(relative, line)) labels.add(rule.label);
    }
    if (LOCAL_TOOLING_REFERENCE.test(line)) labels.add('local-only tooling reference');
    if (/§\s*\d+(?:\.\d+)*/.test(line)) labels.add('internal section reference');
    if (containsExplanatoryCommitHash(relative, line)) labels.add('explanatory commit provenance');
    if (containsPersonalPath(line)) labels.add('personal local filesystem path');
    for (const label of labels) findings.push({ file: relative, line: index + 1, label });
  });
  return findings;
}

export function collectTrackedTextFiles({
  root = repositoryDir,
  listTracked = () => execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }),
} = {}) {
  return String(listTracked())
    .split('\0')
    .filter(Boolean)
    .map(normalizedPath)
    .filter(isTrackedTextPath)
    .filter((file) => fs.existsSync(path.join(root, file)))
    .sort();
}

export function run({ root = repositoryDir } = {}) {
  const files = collectTrackedTextFiles({ root });
  const findings = [];
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    if (source.includes('\0')) continue;
    findings.push(...findProvenanceFindings({ file, source }));
  }

  if (findings.length > 0) {
    console.error(`Tracked-source provenance policy failed with ${findings.length} finding(s):`);
    for (const finding of findings) {
      console.error(`- ${finding.file}:${finding.line}: ${finding.label}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`Tracked-source provenance policy passed for ${files.length} textual files.`);
  }
  return findings;
}

if (isMainModule(import.meta.url)) run();
