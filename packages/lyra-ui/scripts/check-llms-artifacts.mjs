#!/usr/bin/env node
// Verifies the generated agent-facing artifacts against their authored sources:
//  1. `llms-full.txt` and everything under `llms/` (index, components/, tokens, peers, migration)
//     are byte-identical to a fresh `scripts/build-llms.mjs` run — the same generated-file
//     discipline already applied to `custom-elements.json`.
//  2. Every `@aceshooting/lyra-ui/components/...` path quoted anywhere in the agent-facing docs
//     resolves to a real module. Stale paths were shipped for a whole major after the components
//     moved into family directories, and a wrong path is a hard module-resolution failure for the
//     consumer, so this is checked rather than assumed.
//  3. No generated artifact, and not the shipped package README, links an authored
//     `llms/<family>.md` source, which is not published.
//  4. `package.json`'s `files` allowlist covers every artifact the docs tell an agent to read.
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, FAMILIES } from './build-llms.mjs';
import { isMainModule } from './is-main-module.mjs';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const problems = [];
const REQUIRED_PACKAGE_FILES = Object.freeze([
  'CHANGELOG.md',
  'llms.txt',
  'llms-full.txt',
  'llms/index.md',
  'llms/shared.md',
  'llms/tokens.md',
  'llms/peers.md',
  'llms/migration.md',
  'llms/components',
]);

const AUTHORED_FAMILY_FILES = Object.freeze(FAMILIES.map(([family]) => `llms/${family}.md`));

/**
 * Reports every reference to an authored `llms/<family>.md` source in `documents`, an iterable of
 * `[label, text]` pairs holding shipped text.
 */
export function unpublishedSourceReferenceProblems(documents) {
  const found = [];
  for (const [label, text] of documents) {
    for (const familyFile of AUTHORED_FAMILY_FILES) {
      if (text.includes(familyFile)) {
        found.push(
          `${label} references \`${familyFile}\`, which is an authored build input and is not published. Point at \`llms/components/<tag>.md\` or \`llms/index.md\` instead.`,
        );
      }
    }
  }
  return found;
}

export function packageAllowlistProblems(packageFiles) {
  const files = packageFiles instanceof Set ? packageFiles : new Set(packageFiles ?? []);
  return REQUIRED_PACKAGE_FILES.filter((required) => !files.has(required)).map(
    (required) => `package.json "files" is missing "${required}" — it would not reach consumers.`,
  );
}

// 1. Generated artifacts match a fresh build.
const expected = build({ write: false });
for (const [file, text] of expected) {
  const rel = path.relative(packageDir, file);
  if (!existsSync(file)) {
    problems.push(`${rel} is missing — run \`pnpm run llms\`.`);
    continue;
  }
  if (readFileSync(file, 'utf8') !== text) {
    problems.push(`${rel} is stale — run \`pnpm run llms\`.`);
  }
}
const componentsDir = path.join(packageDir, 'llms', 'components');
if (existsSync(componentsDir)) {
  for (const file of readdirSync(componentsDir)) {
    const full = path.join(componentsDir, file);
    if (!expected.has(full)) {
      problems.push(
        `llms/components/${file} is not produced by the builder — it documents a tag that no longer exists. Run \`pnpm run llms\`.`,
      );
    }
  }
}

// 2. Documented import paths resolve.
const docs = [
  'llms.txt',
  'llms-full.txt',
  'README.md',
  ...readdirSync(path.join(packageDir, 'llms'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join('llms', f)),
];
const seenPaths = new Map();
for (const doc of docs) {
  const file = path.join(packageDir, doc);
  if (!existsSync(file) || statSync(file).isDirectory()) continue;
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/@aceshooting\/lyra-ui\/(components\/[\w./-]+\.js)/g)) {
    if (!seenPaths.has(m[1])) seenPaths.set(m[1], doc);
  }
}
for (const [specifier, doc] of seenPaths) {
  const source = path.join(packageDir, 'src', specifier.replace(/\.js$/, '.ts'));
  if (!existsSync(source)) {
    problems.push(
      `${doc} documents \`@aceshooting/lyra-ui/${specifier}\`, which has no source module (expected src/${specifier.replace(/\.js$/, '.ts')}). Component entry points are \`components/<family>/<dir>/<file>.js\`.`,
    );
  }
}

// 3. No shipped text points at a file consumers don't get. The authored `llms/<family>.md` sources
//    are build inputs, not published artifacts — a cross-reference to one is a dead link for
//    everyone reading the package or the skill. The package README ships too, and is read from
//    node_modules and CDN file views where no link is rewritten to the repository.
problems.push(
  ...unpublishedSourceReferenceProblems([
    // The first line is the generated-file banner, which names its authored source on purpose so a
    // contributor editing the repo knows where to go; it is a provenance note, not a reader link.
    ...[...expected].map(([file, text]) => [
      path.relative(packageDir, file),
      text.split('\n').slice(1).join('\n'),
    ]),
    ['README.md', readFileSync(path.join(packageDir, 'README.md'), 'utf8')],
  ]),
);

// 4. The published allowlist covers what the docs point at.
const pkg = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
const files = new Set(pkg.files ?? []);
problems.push(...packageAllowlistProblems(files));

if (isMainModule(import.meta.url)) {
  if (problems.length > 0) {
    console.error('Generated agent-facing docs are out of sync:\n');
    for (const problem of problems) console.error(`  - ${problem}`);
    process.exitCode = 1;
  } else {
    console.log(
      `llms artifacts are in sync: llms-full.txt + ${expected.size - 1} files under llms/, ${seenPaths.size} documented import paths resolve.`,
    );
  }
}
