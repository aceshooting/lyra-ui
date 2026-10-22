// node --test lit-lint-canary.test.mjs   (run from the repo root; needs `oxlint`, `eslint-plugin-lit`, `eslint-plugin-wc` installed)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseJsonc } from './lib/jsonc.mjs';

const ROOT_CONFIG = resolve(process.env.OXLINTRC ?? '.oxlintrc.json');
const FIXTURE = resolve(process.env.CANARY_FIXTURE ?? 'lit-lint-canary.fixture.ts');
const OXLINT = resolve(process.env.OXLINT_BIN ?? 'node_modules/.bin/oxlint');

const EXPECTED = [
  'lit(binding-positions)', 'lit(no-invalid-html)', 'lit(attribute-value-entities)', 'lit(no-duplicate-template-bindings)',
  'lit(no-legacy-template-syntax)', 'lit(no-invalid-escape-sequences)', 'lit(no-template-bind)', 'lit(quoted-expressions)',
  'lit(no-useless-template-literals)', 'lit(no-value-attribute)', 'lit(value-after-constraints)', 'lit(prefer-static-styles)',
  'lit(no-legacy-imports)', 'lit(attribute-names)', 'lit(lifecycle-super)', 'lit(no-property-change-update)',
  'wc(no-constructor-params)', 'wc(no-constructor-attributes)', 'wc(no-typos)', 'wc(no-closed-shadow-root)',
  'wc(attach-shadow-constructor)', 'wc(no-self-class)',
];

test('every enabled Lit/wc rule fires on its seeded defect (plugin, settings and class detection are live)', () => {
  // Reuse jsPlugins + settings + rules from the real config, but aim the rules at the fixture path.
  const cfg = parseJsonc(readFileSync(ROOT_CONFIG, 'utf8'));
  const dir = mkdtempSync(join(tmpdir(), 'lit-canary-'));
  const rules = {};
  for (const o of cfg.overrides ?? []) if (o.excludeFiles) Object.assign(rules, o.rules);
  // The temp config lives outside the repo, so resolve the plugin specifiers to absolute paths first.
  const requireFromRoot = createRequire(ROOT_CONFIG);
  const jsPlugins = cfg.jsPlugins.map((spec) => (typeof spec === 'string' ? requireFromRoot.resolve(spec) : { ...spec, specifier: requireFromRoot.resolve(spec.specifier) }));
  const canary = { plugins: [], categories: { correctness: 'off' }, jsPlugins, settings: cfg.settings, rules };
  const cfgPath = join(dir, 'canary.oxlintrc.json');
  writeFileSync(cfgPath, JSON.stringify(canary));
  let stdout = '';
  try {
    stdout = execFileSync(OXLINT, ['-c', cfgPath, '--disable-nested-config', '-f', 'json', FIXTURE], { encoding: 'utf8' });
  } catch (error) {
    stdout = error.stdout; // exit code 1 = findings, which is what we expect here
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  const seen = new Set(JSON.parse(stdout).diagnostics.map((d) => d.code));
  const missing = EXPECTED.filter((id) => !seen.has(id));
  assert.deepEqual(missing, [], `rules that no longer fire: ${missing.join(', ')}`);
});
