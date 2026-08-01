#!/usr/bin/env node

// Freshness gate for the generated global typed-event surface (`src/events.ts`), matching the
// discipline already applied to `custom-elements.json` (check-manifest.mjs) and the agent-facing
// docs (check-llms-artifacts.mjs): regenerate in memory, then diff against what is committed.
//
// The file is generated rather than authored precisely because it cannot be allowed to drift from
// the per-component `Lyra*EventMap` interfaces — a stale global map types a consumer's listener
// against a detail shape the component no longer emits, which is worse than no typing at all.
//
// Also asserts the two properties the output has to keep to stay gate-able and free:
//   * types only — no runtime statement can appear in a module a consumer imports for typing;
//   * side-effect free — it must not be listed in `package.json#sideEffects`, or every bundler
//     that respects the field would retain the (empty) module instead of dropping it.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { generate } from './generate-event-types.mjs';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const problems = [];

const expected = generate({ write: false });

for (const [file, text] of expected) {
  const relative = path.relative(packageDir, file).replaceAll(path.sep, '/');
  if (!existsSync(file)) {
    problems.push(`${relative} is missing — run \`pnpm run events\`.`);
    continue;
  }
  const actual = readFileSync(file, 'utf8');
  if (actual === text) continue;

  const actualLines = actual.split('\n');
  const expectedLines = text.split('\n');
  const index = actualLines.findIndex((line, at) => line !== expectedLines[at]);
  const at = index === -1 ? Math.min(actualLines.length, expectedLines.length) : index;
  problems.push(
    `${relative} is stale — run \`pnpm run events\`. First difference at line ${at + 1}:\n` +
      `      committed:  ${JSON.stringify(actualLines[at] ?? '<end of file>')}\n` +
      `      generated:  ${JSON.stringify(expectedLines[at] ?? '<end of file>')}`,
  );
}

// A statement that survives to the emitted JS would turn an opt-in typing module into a runtime
// import. Only `import type` / `export type` / `export interface` / `declare` may appear.
const RUNTIME_STATEMENT_RE =
  /^(?!\s|\/\/|\/\*|\*|import type\b|export type\b|export interface\b|declare\b|\}|\)|$).+/m;
for (const [file, text] of expected) {
  const relative = path.relative(packageDir, file).replaceAll(path.sep, '/');
  const offender = text.match(RUNTIME_STATEMENT_RE);
  if (offender) {
    problems.push(
      `${relative} contains a top-level statement that would survive into the emitted JavaScript ` +
        `(${JSON.stringify(offender[0].slice(0, 80))}); this module must stay types-only.`,
    );
  }
}

const pkg = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
const sideEffects = new Set(Array.isArray(pkg.sideEffects) ? pkg.sideEffects : []);
for (const file of expected.keys()) {
  const relative = path.relative(packageDir, file).replaceAll(path.sep, '/');
  const forms = [`./${relative}`, `./${relative.replace(/^src\//, 'dist/').replace(/\.ts$/, '.js')}`];
  for (const form of forms) {
    if (sideEffects.has(form)) {
      problems.push(
        `package.json "sideEffects" lists "${form}", but the generated event-type module has no ` +
          'side effects; listing it stops bundlers from dropping it.',
      );
    }
  }
}

if (problems.length > 0) {
  console.error('Generated typed-event surface is out of sync:\n');
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

const [[, text]] = [...expected];
const eventCount = text.match(/^  '[^']+': Lyra\w+Event;$/gm)?.length ?? 0;
const mapCount = text.match(/^import type \{/gm)?.length ?? 0;
console.log(
  `Typed-event surface is in sync: ${eventCount} events typed from ${mapCount} component event maps.`,
);
