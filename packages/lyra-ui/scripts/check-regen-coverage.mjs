import { isMainModule } from './is-main-module.mjs';

// Guards against the exact defect that motivated it: ~20 generators each write a committed
// artifact, `pnpm lint`'s `contract-policy` chain has a matching freshness gate for each one, and
// nothing ever forced `package.json#scripts.regen` to actually reach all of them. `registration-
// graph` and `testing-event-registry` both went stale this way in the same session -- neither
// shares a naming convention with anything else, so a hand-kept "here is the list" table would
// have needed a human to remember them, which is precisely how they were forgotten the first time.
//
// So the ground truth is derived from the GATE side, not a table: every freshness gate reachable
// from `contract-policy` announces its own remedy, in one of three mechanical shapes this file
// detects without ever naming a generator or a gate by hand:
//
//   1. SELF-PAIRING. The same `scripts/<file>.mjs` is invoked elsewhere in package.json with a
//      DIFFERENT argument signature -- a `--check`/write flag pair on one script
//      (`generate-registration-graph.mjs` alone vs. `--check`, `build-testing-event-registry.mjs`
//      alone vs. `--check`). Found by scanning every `package.json` script for
//      `node scripts/<file>.mjs [args]` and grouping by file regardless of which script name each
//      variant lives under.
//   2. REMEDY TEXT. A gate's own failure message names its fix as a backtick-quoted pnpm command
//      (pnpm run <name>, or pnpm --filter <pkg> <name>) -- check-event-types.mjs telling a caller
//      to run its events script, check-manifest.mjs telling a caller to run its manifest script by
//      package filter. The named script is resolved back to whichever scripts/*.mjs file it
//      (recursively expanding any further pnpm-run alias) ultimately invokes.
//   3. REFERENCE SCAN. A gate that regenerates-and-diffs internally, or imports a generator's pure
//      functions to validate against, names the generator file directly -- as an import specifier
//      (`check-tag-aliases.mjs` importing `./generate-tag-aliases.mjs`) or a quoted
//      `scripts/generate-*.mjs` path (`check-palette-freshness.mjs`'s `PALETTE_GENERATORS` array).
//
// Every generator file surfaced by any of the three must then be reachable by recursively
// expanding `pnpm run <name>` references from `regen` -- or carry a reasoned exemption below.
// A generator with NO gate opinion (nothing above ever names it) is invisible to this checker by
// design: the point is closing the gap between what the gates already demand and what `regen`
// actually does, not inventing new demands.
//
// Run: node scripts/check-regen-coverage.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const scriptsDir = path.join(packageDir, 'scripts');

const PNPM_RUN_RE = /^pnpm run ([\w:-]+)$/;
const NODE_SCRIPT_RE = /^node(?:\s+--test)?\s+scripts\/([\w.-]+\.mjs)\b(.*)$/;
const REMEDY_RE = /`pnpm(?: --filter [^\s`]+)? (?:run )?([A-Za-z][\w:-]*)`/g;
const REFERENCE_RE = /(?:from\s+['"]\.\/|['"](?:\.\/)?(?:scripts\/)?)((?:generate|build)-[\w-]+\.mjs)['"]/g;

/** Top-level `&&`-separated commands. Every script in this package chains steps this way; none use
 * `||` or `;`, so a more elaborate shell-aware split would be untested complexity. */
export function splitCommand(command) {
  return command.split('&&').map((segment) => segment.trim()).filter(Boolean);
}

/** One `&&`-segment, classified as a same-package script alias, a direct `node scripts/*.mjs`
 * invocation (file + its trailing arguments, verbatim), or something this checker does not model
 * (a raw `tsc`, an `mkdir`, ...). */
export function parseSegment(segment) {
  const pnpmRun = segment.match(PNPM_RUN_RE);
  if (pnpmRun) return { type: 'pnpm-run', name: pnpmRun[1] };
  const nodeScript = segment.match(NODE_SCRIPT_RE);
  if (nodeScript) return { type: 'node-script', file: nodeScript[1], args: nodeScript[2].trim() };
  return { type: 'other', raw: segment };
}

/**
 * Recursively expands `pnpm run <name>` references starting at `entry`, collecting every
 * `scripts/<file>.mjs` invocation reached along the way (with the exact argument string each
 * reached call site used). This is the one function both "does regen reach it" and "does a
 * `pnpm run <name>` remedy resolve to a file" are built from, so a nested alias
 * (`regen` -> `registrations` -> `tag-aliases` -> `generate-tag-aliases.mjs`) is not a special case.
 *
 * @param {string} entry
 * @param {Record<string, string>} scripts
 * @returns {{ scriptNames: Set<string>, files: Map<string, Set<string>> }}
 */
export function expandScript(entry, scripts) {
  const scriptNames = new Set();
  const files = new Map();
  const queue = [entry];
  while (queue.length > 0) {
    const name = queue.shift();
    if (scriptNames.has(name)) continue;
    scriptNames.add(name);
    const command = scripts[name];
    if (!command) continue;
    for (const segment of splitCommand(command)) {
      const parsed = parseSegment(segment);
      if (parsed.type === 'pnpm-run') {
        queue.push(parsed.name);
      } else if (parsed.type === 'node-script') {
        if (!files.has(parsed.file)) files.set(parsed.file, new Set());
        files.get(parsed.file).add(parsed.args);
      }
    }
  }
  return { scriptNames, files };
}

/**
 * Every `scripts/<file>.mjs` invocation across ALL `package.json` scripts, regardless of
 * reachability from anywhere -- keyed by file, then by the exact argument string, to whichever
 * script name(s) use it. A file with more than one distinct argument string is a self-`--check`/
 * write pair; that is how mechanism 1 finds `generate-registration-graph.mjs` alone (regen) vs.
 * `--check` (the gate) without either script naming the other.
 *
 * @param {Record<string, string>} scripts
 * @returns {Map<string, Map<string, Set<string>>>}
 */
export function collectFileInvocations(scripts) {
  const invocations = new Map();
  for (const [name, command] of Object.entries(scripts)) {
    for (const segment of splitCommand(command)) {
      const parsed = parseSegment(segment);
      if (parsed.type !== 'node-script') continue;
      if (!invocations.has(parsed.file)) invocations.set(parsed.file, new Map());
      const byArgs = invocations.get(parsed.file);
      if (!byArgs.has(parsed.args)) byArgs.set(parsed.args, new Set());
      byArgs.get(parsed.args).add(name);
    }
  }
  return invocations;
}

/** Distinct backtick-quoted `` `pnpm run <name>` ``/`` `pnpm --filter <pkg> <name>` `` remedy
 * names a gate's own source announces. */
export function extractRemedyNames(source) {
  return [...new Set([...source.matchAll(REMEDY_RE)].map((match) => match[1]))];
}

/** Distinct `generate-*.mjs`/`build-*.mjs` filenames `source` names directly, as an import
 * specifier or a quoted `scripts/`-relative path, excluding a self-reference to `ownFile`. */
export function extractReferencedGeneratorFiles(source, ownFile) {
  const files = new Set();
  for (const match of source.matchAll(REFERENCE_RE)) {
    if (match[1] !== ownFile) files.add(match[1]);
  }
  return [...files];
}

/** Names that resolve to another gate rather than a remedy (`check:event-contracts`, `lint`,
 * `contract-policy` itself) -- real generator scripts in this package never use these prefixes. */
function isGateName(name) {
  return /^(check[:-]|test:)/.test(name) || name === 'contract-policy' || name === 'lint';
}

/**
 * Every generator file a `contract-policy`-reachable freshness gate names as its own remedy,
 * mapped to the reason(s) it was flagged. See the file header for the three detection mechanisms.
 *
 * @param {{ scripts: Record<string, string>, readScriptSource: (file: string) => string | null,
 *   contractPolicyEntry?: string }} options
 * @returns {Map<string, Set<string>>}
 */
export function computeRequiredGenerators({ scripts, readScriptSource, contractPolicyEntry = 'contract-policy' }) {
  const contractReach = expandScript(contractPolicyEntry, scripts);
  const fileInvocations = collectFileInvocations(scripts);
  const required = new Map();
  const addRequired = (file, reason) => {
    if (!required.has(file)) required.set(file, new Set());
    required.get(file).add(reason);
  };

  for (const file of contractReach.files.keys()) {
    const source = readScriptSource(file);
    if (source == null) continue;

    const invocations = fileInvocations.get(file);
    if (invocations && invocations.size > 1) {
      const variants = [...invocations.keys()].map((args) => args || '(no args)');
      addRequired(file, `${file} is self-check-paired (argument variants: ${variants.join(' | ')})`);
    }

    for (const name of extractRemedyNames(source)) {
      if (isGateName(name) || !scripts[name]) continue;
      for (const targetFile of expandScript(name, scripts).files.keys()) {
        if (targetFile === file) continue;
        if (readScriptSource(targetFile) == null) continue; // not this package's scripts/ (e.g. a repo-root tool)
        addRequired(targetFile, `${file} names \`pnpm run ${name}\` as its remedy`);
      }
    }

    for (const referenced of extractReferencedGeneratorFiles(source, file)) {
      if (readScriptSource(referenced) == null) continue; // same repo-root-vs-package scoping guard
      addRequired(referenced, `${file} references ${referenced} directly`);
    }
  }
  return required;
}

/**
 * The full pass/fail decision, as data so it is testable without a real `package.json` or a real
 * `scripts/` directory.
 *
 * @param {{ scripts: Record<string, string>, readScriptSource: (file: string) => string | null,
 *   exemptions: Record<string, string>, regenEntry?: string, contractPolicyEntry?: string }} options
 */
export function computeCoverage({
  scripts,
  readScriptSource,
  exemptions,
  regenEntry = 'regen',
  contractPolicyEntry = 'contract-policy',
}) {
  const invalidExemptions = Object.entries(exemptions)
    .filter(([, reason]) => !reason || !reason.trim())
    .map(([key]) => key);

  const required = computeRequiredGenerators({ scripts, readScriptSource, contractPolicyEntry });
  const regenReach = expandScript(regenEntry, scripts);

  const violations = [];
  for (const [file, reasons] of required) {
    if (exemptions[file]) continue;
    if (regenReach.files.has(file)) continue;
    violations.push({ file, reasons: [...reasons] });
  }

  return {
    ok: violations.length === 0 && invalidExemptions.length === 0,
    violations,
    invalidExemptions,
    requiredCount: required.size,
    exemptedCount: [...required.keys()].filter((file) => exemptions[file]).length,
  };
}

// Deliberate exclusions, each with the one-line reason a bare glob or a --write/--refresh flag
// cannot express on its own. A suppression that stops matching anything real is harmless (it just
// never fires) -- unlike the gate this file itself guards, going quiet is not this map's failure
// mode; a MISSING reason is, and that is what `computeCoverage` fails closed on.
export const EXEMPTIONS = Object.freeze({
  'generate-component-quality.mjs':
    'measures BUILT dist/ output (gzip size) and test quality, so it must run after `pnpm build`; ' +
    'documented as the one step run separately after `regen`, not inside it (docs/agents/ci-and-gates.md).',
  'build.mjs':
    'the build step itself, a prerequisite for `component-quality`, not a source-artifact generator; ' +
    'run `pnpm build` separately before `component-quality` (docs/agents/ci-and-gates.md).',
  'check-build-artifacts.mjs':
    'a dist/ hygiene check chained inside `build` itself (see the "build" script), reached only ' +
    'because a remedy names `pnpm run build`; it verifies build output, it does not generate a ' +
    'committed source artifact.',
  'ai-compile-contract.test.mjs':
    'chained inside check:build-artifacts, itself chained inside `build`; same reasoning as ' +
    'check-build-artifacts.mjs above.',
  'theme-bootstrap-build-check.test.mjs':
    'chained inside check:build-artifacts, itself chained inside `build`; same reasoning as ' +
    'check-build-artifacts.mjs above.',
  'generate-component-inventory.mjs':
    'a library CLI that requires explicit --webawesome-manifest/--shoelace-manifest paths and has no ' +
    'package.json script of its own; the committed component-inventory.json is regenerated by the ' +
    'network-verified `component-inventory` script (check-pinned-upstream-manifests.mjs ' +
    '--write-inventory), which calls this module\'s generateInventory() internally with the pinned, ' +
    'verified manifests.',
  'generate-docx-fixture.mjs':
    'a manual, occasional fixture regeneration tool per its own header comment; committed only when ' +
    'the fixture intentionally changes, and verified by viewer-fixture-generators.test.mjs\'s ' +
    'determinism check, not a contract-policy freshness gate against a committed artifact.',
  'generate-ebook-fixture.mjs':
    'same shape and reason as generate-docx-fixture.mjs: a manual, occasional fixture tool, not a ' +
    'freshness-gated generator.',
  'generate-theme-bootstrap.mjs':
    'writes dist/theme/theme-bootstrap.js, a BUILD OUTPUT regenerated automatically inside ' +
    'scripts/build.mjs itself; verified by check:theme-bootstrap, which is chained into `build` ' +
    '(like check:build-artifacts), never into contract-policy, so there is no committed source ' +
    'artifact for `regen` to refresh.',
  'generate-side-effects.mjs':
    'its generateSideEffects() is invoked internally by generate-registration-artifacts.mjs, which ' +
    '`registrations` (already in `regen`) runs; the standalone CLI is a manual escape hatch for the ' +
    'same output, not a second committed artifact.',
  'component-metadata:history':
    'a manual, occasional git-history reconciliation (--refresh-history) for the release-history ' +
    'record, run around a release rather than after an ordinary source change (docs/agents/ci-and-gates.md).',
  'coverage-floors':
    'write-coverage-floors.mjs --write-floors encodes reviewed coverage-floor exceptions derived from ' +
    'a finished `test:coverage` run, not from source; check:coverage-floors also sits outside ' +
    'contract-policy for the same reason (docs/agents/ci-and-gates.md\'s "Coverage floors" section).',
});

if (isMainModule(import.meta.url)) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
  const readScriptSource = (file) => {
    try {
      return fs.readFileSync(path.join(scriptsDir, file), 'utf8');
    } catch {
      return null;
    }
  };

  const result = computeCoverage({ scripts: packageJson.scripts, readScriptSource, exemptions: EXEMPTIONS });

  if (result.invalidExemptions.length > 0) {
    console.error(
      `check-regen-coverage: exemption(s) with no stated reason: ${result.invalidExemptions.join(', ')}`,
    );
  }
  if (result.violations.length > 0) {
    console.error(
      `\`pnpm regen\` does not reach ${result.violations.length} generator(s) a contract-policy gate requires:`,
    );
    for (const { file, reasons } of result.violations) {
      console.error(`- ${file}`);
      for (const reason of reasons) console.error(`    ${reason}`);
    }
    console.error(
      '\nAdd the missing generator to the `regen` chain in package.json (via its own `pnpm run <name>` ' +
        'script, not a re-spelled `node scripts/...` path), or add a reasoned exemption to EXEMPTIONS in ' +
        'scripts/check-regen-coverage.mjs.',
    );
  }

  if (!result.ok) {
    process.exitCode = 1;
  } else {
    console.log(
      `regen coverage verified: ${result.requiredCount} gate-required generator(s) reachable from ` +
        `\`pnpm run regen\` (${result.exemptedCount} exempted).`,
    );
  }
}
