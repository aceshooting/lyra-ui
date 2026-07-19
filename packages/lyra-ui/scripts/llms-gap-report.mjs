#!/usr/bin/env node
// Reports, per family, every documentable name that custom-elements.json (or a component's own
// stylesheet) knows about but the component's llms/<family>.md section never mentions.
//
// This is the authoring aid behind `check-llms-freshness.mjs`: the checker fails the build, this
// prints the worklist. `node scripts/llms-gap-report.mjs [family...]`.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitSections, readTagFacts, FAMILIES } from './build-llms.mjs';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(readFileSync(path.join(packageDir, 'custom-elements.json'), 'utf8'));
const tagFacts = readTagFacts(manifest);

// Inherited from LyraElement / the FormAssociated mixin and documented once in llms/shared.md,
// never restated per component.
const SHARED_SURFACE = new Set([
  'locale', 'strings', 'localize', 'emit',
  'name', 'value', 'disabled', 'required', 'effectiveDisabled', 'form', 'labels', 'validity',
  'validationMessage', 'willValidate', 'setFormValue', 'checkValidity', 'reportValidity',
  'formResetCallback', 'formStateRestoreCallback', 'formDisabledCallback', 'internals',
]);

const declFor = new Map();
for (const mod of manifest.modules ?? []) {
  for (const decl of mod.declarations ?? []) {
    if (decl.customElement && decl.tagName) declFor.set(decl.tagName, { decl, mod });
  }
}

/** Custom properties a component's own stylesheet reads but the manifest never declares. */
function stylesheetTokens(modulePath) {
  const dir = path.join(packageDir, path.dirname(modulePath));
  if (!existsSync(dir)) return [];
  const found = new Set();
  for (const file of readdirSync(dir)) {
    if (!/\.styles\.ts$/.test(file)) continue;
    const text = readFileSync(path.join(dir, file), 'utf8');
    for (const m of text.matchAll(/var\((--lr-[a-z0-9-]+)/g)) found.add(m[1]);
  }
  return [...found];
}

const wanted = process.argv.slice(2);
let grandTotal = 0;

for (const [family] of FAMILIES) {
  if (wanted.length && !wanted.includes(family)) continue;
  const file = path.join(packageDir, 'llms', `${family}.md`);
  const sections = splitSections(readFileSync(file, 'utf8'));
  const lines = [];
  for (const section of sections) {
    for (const tag of section.tags) {
      const entry = declFor.get(tag);
      if (!entry) continue;
      const { decl, mod } = entry;
      const missing = [];
      const add = (kind, names) => {
        const gone = names.filter((n) => n && !section.text.includes(n));
        if (gone.length) missing.push(`${kind}: ${gone.join(', ')}`);
      };
      add(
        'property',
        (decl.members ?? [])
          .filter((m) => m.privacy !== 'private' && m.privacy !== 'protected' && !m.static && !m.inheritedFrom)
          .map((m) => m.name)
          .filter((n) => !SHARED_SURFACE.has(n) && !n.startsWith('_') && !n.startsWith('#')),
      );
      // An attribute counts as documented when its camelCase property twin is — `active-stage-id`
      // and `activeStageId` are the same knob, and the sections document the property form.
      const camel = (n) => n.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      add(
        'attribute',
        (decl.attributes ?? [])
          .map((a) => a.name)
          .filter((n) => !SHARED_SURFACE.has(n) && !SHARED_SURFACE.has(camel(n)) && !section.text.includes(camel(n))),
      );
      add('event', (decl.events ?? []).map((e) => e.name));
      add('slot', (decl.slots ?? []).map((s) => s.name).filter(Boolean));
      add('csspart', (decl.cssParts ?? []).map((p) => p.name));
      add('cssprop (manifest)', (decl.cssProperties ?? []).map((p) => p.name));
      // Component-scoped tokens only: the shared --lr-color-*/--lr-space-* layer is in tokens.md.
      const scoped = stylesheetTokens(mod.path).filter((t) =>
        t.startsWith(`--${tag.replace(/^lr-/, 'lr-')}-`),
      );
      add('cssprop (stylesheet, undeclared in manifest)', scoped);
      if (missing.length) {
        lines.push(`  ${tag} (${section.text.split('\n').length} lines)`);
        for (const m of missing) lines.push(`      ${m}`);
      }
    }
  }
  if (lines.length) {
    console.log(`\n### ${family}.md — ${lines.filter((l) => !l.startsWith('      ')).length} components with gaps`);
    console.log(lines.join('\n'));
    grandTotal += lines.filter((l) => l.startsWith('      ')).length;
  }
}
console.log(`\n${grandTotal} gap lines total.`);
