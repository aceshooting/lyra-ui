import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  EXEMPTION_MARKER,
  GENERATED_LLMS_FILES,
  classifyMember,
  findLlmsDefaultMismatches,
} from './check-llms-defaults.mjs';

/** Builds a throwaway package tree so each rule is exercised against a known declaration. */
function scratchPackage(members, familyDoc) {
  const dir = mkdtempSync(join(tmpdir(), 'lyra-llms-defaults-'));
  writeFileSync(
    join(dir, 'custom-elements.json'),
    JSON.stringify({
      modules: [
        {
          declarations: [
            {
              tagName: 'lr-probe',
              members: Object.entries(members).map(([name, member]) => ({
                kind: 'field',
                name,
                type: { text: member.type },
                ...(member.default === undefined ? {} : { default: member.default }),
              })),
            },
          ],
        },
      ],
    }),
  );
  mkdirSync(join(dir, 'llms'));
  writeFileSync(join(dir, 'llms', 'probe.md'), `## \`lr-probe\`\n\n${familyDoc}\n`);
  return dir;
}

function withScratch(members, familyDoc, assertions) {
  const dir = scratchPackage(members, familyDoc);
  try {
    assertions(findLlmsDefaultMismatches(dir));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('the shipped authored reference agrees with custom-elements.json', () => {
  assert.deepEqual(findLlmsDefaultMismatches(), []);
});

test('the generated llms files are excluded, since regenerating them is the fix', () => {
  assert.deepEqual(GENERATED_LLMS_FILES, ['index.md', 'tokens.md', 'peers.md', 'migration.md']);
});

test('classifyMember separates optional, defaulted, and setter-widened accessors', () => {
  assert.equal(classifyMember({ type: 'string | undefined', default: null }), 'optional');
  assert.equal(classifyMember({ type: 'string', default: "''" }), 'defaulted');
  assert.equal(classifyMember({ type: 'string | null', default: 'null' }), 'defaulted');
  assert.equal(
    classifyMember({ type: 'readonly Foo[] | null | undefined', default: null }),
    'accessor',
  );
  assert.equal(classifyMember(undefined), null);
});

// The exact shape of U12.C56: `accessibleLabel?: string` declared, `= ''` documented.
test('a documented default over an optional declaration is reported', () => {
  withScratch(
    { accessibleLabel: { type: 'string | undefined' } },
    "- `accessibleLabel: string = ''` (attribute `accessible-label`) — fallback landmark name",
    (findings) => {
      assert.equal(findings.length, 1);
      assert.equal(findings[0].rule, 'documented-default-but-optional');
      assert.equal(findings[0].member, 'accessibleLabel');
      assert.deepEqual(findings[0].tags, ['lr-probe']);
    },
  );
});

test('a documented optional over a real default is reported', () => {
  withScratch(
    { caption: { type: 'string', default: "''" } },
    '- `caption?: string` — an optional visible caption',
    (findings) => {
      assert.equal(findings.length, 1);
      assert.equal(findings[0].rule, 'documented-optional-but-defaulted');
      assert.equal(findings[0].member, 'caption');
    },
  );
});

test('a correct pairing in either direction is silent', () => {
  withScratch(
    { label: { type: 'string | undefined' }, caption: { type: 'string', default: "''" } },
    '- `label?: string` — optional\n- `caption: string = \'\'` — defaulted',
    (findings) => assert.deepEqual(findings, []),
  );
});

// lr-filter-bar's filters/value: the setter accepts null|undefined, the getter returns [] / {}.
test('a setter-widened accessor pair may document its canonical non-null default', () => {
  withScratch(
    { filters: { type: 'readonly LyraFilterBarFilterDefinition[] | null | undefined' } },
    '- `filters: readonly LyraFilterBarFilterDefinition[] = []` (attribute: false) — filter schema',
    (findings) => assert.deepEqual(findings, []),
  );
});

// A documented function type must not read as a default of `> unknown`.
test('an arrow in a documented function type is not parsed as a default', () => {
  withScratch(
    { getTag: { type: 'LyraComboboxTagRenderer | undefined' } },
    '- `getTag: ((option: LyraOption, index: number) => unknown) | undefined` — per-tag renderer',
    (findings) => assert.deepEqual(findings, []),
  );
});

// A same-named field of a documented data-shape interface, mid-prose, is not the component property.
test('an optional claim mid-prose is not treated as property documentation', () => {
  withScratch(
    { status: { type: 'ChatComposerStatus', default: "'idle'" } },
    'The attachment record adds `file?`, `bytes?`, and `status?: \'pending\' | \'error\'` fields.',
    (findings) => assert.deepEqual(findings, []),
  );
});

test('a deliberate exception opts out on its own line or the line before', () => {
  const doc = "- `accessibleLabel: string = ''` <!-- llms-default-exempt: documented intent -->";
  withScratch({ accessibleLabel: { type: 'string | undefined' } }, doc, (findings) =>
    assert.deepEqual(findings, []),
  );
  const preceding = `<!-- llms-default-exempt: documented intent -->\n- \`accessibleLabel: string = ''\``;
  withScratch({ accessibleLabel: { type: 'string | undefined' } }, preceding, (findings) =>
    assert.deepEqual(findings, []),
  );
  assert.ok(EXEMPTION_MARKER.test('<!-- llms-default-exempt: because -->'));
  assert.ok(!EXEMPTION_MARKER.test('<!-- llms-default-exempt: -->'), 'a bare marker needs a reason');
});

test('a claim in a section naming no tag is ignored', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lyra-llms-defaults-untagged-'));
  try {
    writeFileSync(join(dir, 'custom-elements.json'), JSON.stringify({ modules: [] }));
    mkdirSync(join(dir, 'llms'));
    writeFileSync(join(dir, 'llms', 'shared.md'), "## Shared vocabulary\n\n- `label: string = ''`\n");
    assert.deepEqual(findLlmsDefaultMismatches(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the gate runs when its entry module is reached through a symlink', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'lyra-llms-defaults-symlink-'));
  const entry = fileURLToPath(new URL('./check-llms-defaults.mjs', import.meta.url));
  const linkedEntry = join(scratch, 'check-llms-defaults.mjs');
  try {
    symlinkSync(entry, linkedEntry);
    const result = spawnSync(process.execPath, [linkedEntry], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /llms property defaults verified/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
