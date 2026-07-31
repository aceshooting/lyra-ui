// Gates the library's core promise: migrating off Web Awesome or Shoelace is a mechanical tag
// rename. `migrate-wa.mjs` derives its rename table from README.md, and `test:migrate-wa` proves
// the *mechanism* works -- but nothing proved the table actually *covers* the upstream vocabulary.
// It didn't: a row mislabelled `-- (extra)` makes the codemod silently skip a tag that has a
// perfectly good lyra counterpart, and a consumer only finds out when the component doesn't render.
//
// This check measures the table against a frozen upstream inventory
// (`scripts/fixtures/upstream-tags.json`) and fails on four distinct defects:
//
//   1. coverage   -- an upstream tag with no mapping and no documented reason to have none
//   2. fiction    -- a `wa-*`/`sl-*` name in the README that no upstream version ever shipped
//   3. dangling   -- a mapping whose `lr-*` target is not a registered tag
//   4. polarity   -- a documented attribute rename that flips a boolean's sense, so a mechanically
//                    migrated app keeps compiling while quietly behaving differently
//
// Run: node scripts/check-migration-coverage.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMirrorMap } from './migrate-wa.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (...segments) => JSON.parse(fs.readFileSync(path.join(packageDir, ...segments), 'utf8'));

const fixture = readJson('scripts', 'fixtures', 'upstream-tags.json');
const manifest = readJson('custom-elements.json');
const readme = fs.readFileSync(path.join(packageDir, 'README.md'), 'utf8');

const lyraTags = new Set(
  manifest.modules.flatMap((module) => module.declarations ?? []).filter((d) => d.customElement && d.tagName).map((d) => d.tagName),
);

const upstream = [
  ...fixture.webawesome.free.map((tag) => ({ tag, source: 'wa', tier: 'free' })),
  ...fixture.webawesome.pro.map((tag) => ({ tag, source: 'wa', tier: 'pro' })),
  ...fixture.shoelace.tags.map((tag) => ({ tag, source: 'sl', tier: 'free' })),
];
const knownUpstream = new Set(upstream.map((entry) => entry.tag));

const { map: mirrorMap, conflicts } = buildMirrorMap(readme);
const errors = [];

for (const conflict of conflicts) errors.push(`ambiguous README mirror entry -- ${conflict}`);

// 1. Coverage. An upstream tag is covered when the README-derived table maps it. Anything else
// must carry an explicit, reasoned entry in the fixture's `noCounterpart` -- silence is the bug
// this check exists to catch.
const uncovered = [];
for (const { tag, source } of upstream) {
  if (mirrorMap.has(tag)) continue;
  const reason = fixture.noCounterpart[tag];
  if (typeof reason === 'string' && reason.trim().length > 0) continue;
  const sameName = `lr-${tag.slice(3)}`;
  uncovered.push({ tag, source, hint: lyraTags.has(sameName) ? ` (lyra registers ${sameName})` : '' });
}
for (const { tag, hint } of uncovered) {
  errors.push(`${tag}: no README mirror mapping and no documented reason for having none${hint}`);
}

// 2. Fiction. Every upstream tag name the README names must be one an upstream release actually
// shipped, or the migration table sends readers chasing a tag that does not exist. Wildcards
// (`wa-format-*`) are checked by prefix against the same inventory.
const namedUpstream = new Set([
  ...[...readme.matchAll(/`(wa-[a-z0-9-]+\*?)`/g)].map((m) => m[1]),
  ...[...readme.matchAll(/<(sl-[a-z0-9-]+)>/g)].map((m) => m[1]),
  ...[...readme.matchAll(/`(sl-[a-z0-9-]+)`/g)].map((m) => m[1]),
]);
for (const name of [...namedUpstream].sort()) {
  if (name.endsWith('*')) {
    const prefix = name.slice(0, -1);
    if (![...knownUpstream].some((tag) => tag.startsWith(prefix))) errors.push(`${name}: wildcard matches no upstream tag`);
    continue;
  }
  if (!knownUpstream.has(name)) errors.push(`${name}: named in README but no upstream release ships it`);
}

// 3. Dangling targets. A mapping to a tag lyra does not register rewrites working markup into a
// silently inert element.
for (const [from, to] of mirrorMap) {
  if (!lyraTags.has(to)) errors.push(`${from} -> ${to}: rename target is not a registered lyra tag`);
}

// 4. Polarity. A rename that flips a boolean's sense is worse than no rename at all: the migrated
// markup still parses, so nothing errors, and the component just behaves the other way round.
// Both an outright negation flip (`light-dismiss` -> `no-light-dismiss`) and a with/hide swap
// (`with-summary` -> `hide-summary`) are inversions.
const NEGATING = /^(?:no|not|without|hide|disable)-/;
const ASSERTING = /^(?:with|show|enable)-/;
const polarity = (name) => (NEGATING.test(name) ? -1 : ASSERTING.test(name) ? 1 : 0);
for (const rename of fixture.attributeRenames ?? []) {
  const from = polarity(rename.from);
  const to = polarity(rename.to);
  if (from !== to && (from === -1 || to === -1)) {
    errors.push(`${rename.component} ${rename.from} -> ${rename.to}: rename inverts the attribute's polarity`);
  }
}

if (errors.length) {
  console.error(`Migration coverage contract failed with ${errors.length} finding(s):`);
  for (const error of errors) console.error(`- ${error}`);
  const covered = upstream.length - uncovered.length;
  console.error(`\nCoverage: ${covered}/${upstream.length} upstream tags mapped or documented as unmirrored.`);
  process.exitCode = 1;
} else {
  const waTotal = fixture.webawesome.free.length + fixture.webawesome.pro.length;
  const waMapped = upstream.filter((e) => e.source === 'wa' && mirrorMap.has(e.tag)).length;
  const slMapped = upstream.filter((e) => e.source === 'sl' && mirrorMap.has(e.tag)).length;
  console.log(
    `Migration coverage contract passed: Web Awesome ${waMapped}/${waTotal} ` +
      `(${fixture.webawesome.version}), Shoelace ${slMapped}/${fixture.shoelace.tags.length} ` +
      `(${fixture.shoelace.version}) tags rename mechanically.`,
  );
}
