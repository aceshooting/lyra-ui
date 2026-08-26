// Cross-checks every property default the AUTHORED llms/<family>.md reference states against the
// declaration recorded in custom-elements.json.
//
// Nothing else compares those two surfaces. The manifest is generated from source, and the family
// docs are hand-written, so a property can change from `foo = ''` to `foo?: string` (or back) with
// every existing gate staying green while the published reference keeps describing the old shape.
// That is not cosmetic: `label: string = ''` tells a consumer an unset property reads back `''`,
// so `el.label.trim()` is safe and `label ?? fallback` is dead code. The real readback is
// `undefined`, which throws. The 2026-08-25 review found this class twice (C56, C84) and a sweep
// of the same pairing then found eleven further instances nobody had reported -- the signature of
// a defect class with no gate rather than a handful of typos.
//
// Two directions, because both mislead:
//   documented-default-but-optional  -- `name: T = D` documented, declaration is optional
//   documented-optional-but-defaulted -- `name?: T` documented, declaration carries a real default
//
// Claims are attributed to the `lr-*` tags named in the nearest preceding heading, and a claim is
// only reported when EVERY tag in that section that owns the member contradicts it -- a family
// section covering several tags routinely documents the shape they share.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './is-main-module.mjs';

const packageDir = fileURLToPath(new URL('..', import.meta.url));

/** Generated under llms/; regenerating them is the fix, so auditing them would report the cause twice. */
export const GENERATED_LLMS_FILES = Object.freeze(['index.md', 'tokens.md', 'peers.md', 'migration.md']);

/**
 * Opt out one line with `<!-- llms-default-exempt: why -->` on it or on the line before. The
 * `(?!-->)` is load-bearing: without it `\S` matches the `-` of the comment's own terminator, so a
 * reasonless `<!-- llms-default-exempt: -->` would silence the line while explaining nothing.
 */
export const EXEMPTION_MARKER = /<!--\s*llms-default-exempt:\s*(?!-->)\S/;

// `=(?!>)` keeps a documented function type -- `(option: LyraOption) => unknown` -- from reading as
// a default of `> unknown`, which is what a naive `=` split produces.
const DEFAULT_CLAIM = /`([A-Za-z][A-Za-z0-9]*)\s*:\s*([^`]+?)\s*=(?!>)\s*([^`]+)`/g;
// Only a claim OPENING a property bullet counts as documenting the component's own property. Mid
// sentence, `status?: 'pending' | 'error'` is usually a field of a documented data-shape interface
// (`LyraPromptInputAttachment`) that happens to share a name with an unrelated component property.
const OPTIONAL_BULLET_CLAIM = /^\s*-\s+`([A-Za-z][A-Za-z0-9]*)\?\s*:\s*([^`=]+?)`/;
const HEADING = /^#{2,3}\s+(.*)$/;
const TAG = /lr-[a-z0-9-]+/g;

/** @returns {Map<string, Map<string, {type: string, default: string | null}>>} tag -> member -> declaration */
export function collectManifestMembers(manifest) {
  const tags = new Map();
  for (const module of manifest.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      const tag = declaration.tagName;
      if (!tag) continue;
      const members = tags.get(tag) ?? new Map();
      for (const member of declaration.members ?? []) {
        if (member.kind !== 'field') continue;
        members.set(member.name, { type: member.type?.text ?? '', default: member.default ?? null });
      }
      tags.set(tag, members);
    }
  }
  return tags;
}

/**
 * `accessor` is the getter/setter pair whose setter accepts `null | undefined` for convenience
 * while the getter still returns a canonical non-null value -- `lr-filter-bar`'s `filters`/`value`.
 * The manifest records the widened setter signature, so documenting `= []` there is correct and
 * only the union carrying BOTH `null` and `undefined` has that shape.
 */
export function classifyMember(entry) {
  if (!entry) return null;
  const parts = new Set(entry.type.split('|').map((part) => part.trim()));
  if (parts.has('null') && parts.has('undefined')) return 'accessor';
  if (parts.has('undefined') && (entry.default === null || entry.default === 'undefined')) return 'optional';
  if (entry.default !== null && entry.default !== 'undefined') return 'defaulted';
  return 'other';
}

function authoredFamilyDocs(llmsDir) {
  return readdirSync(llmsDir)
    .filter((name) => name.endsWith('.md') && !GENERATED_LLMS_FILES.includes(name))
    .sort();
}

export function findLlmsDefaultMismatches(dir = packageDir) {
  const manifest = JSON.parse(readFileSync(join(dir, 'custom-elements.json'), 'utf8'));
  const tags = collectManifestMembers(manifest);
  const llmsDir = join(dir, 'llms');
  const findings = [];

  for (const name of authoredFamilyDocs(llmsDir)) {
    const lines = readFileSync(join(llmsDir, name), 'utf8').split('\n');
    let sectionTags = [];
    lines.forEach((line, index) => {
      const heading = HEADING.exec(line);
      if (heading) {
        sectionTags = heading[1].match(TAG) ?? [];
        return;
      }
      if (EXEMPTION_MARKER.test(line) || (index > 0 && EXEMPTION_MARKER.test(lines[index - 1]))) return;

      const owners = (member) =>
        sectionTags.filter((tag) => classifyMember(tags.get(tag)?.get(member)) !== null);
      const report = (member, rule, documented) => {
        findings.push({ file: `llms/${name}`, line: index + 1, member, rule, documented, tags: owners(member) });
      };

      for (const [, member, , documented] of line.matchAll(DEFAULT_CLAIM)) {
        const owning = owners(member);
        if (owning.length === 0) continue;
        if (owning.every((tag) => classifyMember(tags.get(tag).get(member)) === 'optional')) {
          report(member, 'documented-default-but-optional', `${member}: … = ${documented.trim()}`);
        }
      }

      const bullet = OPTIONAL_BULLET_CLAIM.exec(line);
      if (bullet) {
        const member = bullet[1];
        const owning = owners(member);
        if (
          owning.length > 0 &&
          owning.every((tag) => classifyMember(tags.get(tag).get(member)) === 'defaulted')
        ) {
          report(member, 'documented-optional-but-defaulted', `${member}?: ${bullet[2].trim()}`);
        }
      }
    });
  }
  return findings;
}

const EXPLANATION = Object.freeze({
  'documented-default-but-optional':
    'the reference states a default, but the property is declared optional and reads back `undefined`',
  'documented-optional-but-defaulted':
    'the reference states the property is optional, but the declaration carries a real default',
});

if (isMainModule(import.meta.url)) {
  const findings = findLlmsDefaultMismatches();
  if (findings.length > 0) {
    console.error(
      `Authored llms property defaults disagree with custom-elements.json (${findings.length}):\n`,
    );
    for (const finding of findings) {
      console.error(`  ${finding.file}:${finding.line}  \`${finding.documented}\``);
      console.error(`    ${finding.tags.join(', ')} — ${EXPLANATION[finding.rule]}`);
    }
    console.error(
      '\nFix the prose to match the declaration (or the declaration, if the docs describe the intent),\n' +
        'then rerun ./package.sh so the generated llms/components/ and packaged references agree.\n' +
        'A deliberate exception opts out with `<!-- llms-default-exempt: reason -->`.',
    );
    process.exitCode = 1;
  } else {
    console.log('llms property defaults verified against custom-elements.json.');
  }
}
