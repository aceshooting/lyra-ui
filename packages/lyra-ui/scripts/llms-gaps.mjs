// Shared gap computation between `llms-gap-report.mjs` (prints the worklist) and
// `check-llms-freshness.mjs` (fails the build). One implementation so the report an author fixes
// is exactly the set CI enforces.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitSections, readTagFacts, FAMILIES } from './build-llms.mjs';

export const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Inherited from LyraElement / the FormAssociated mixin and documented once in llms/shared.md,
// never restated per component. Components that re-declare one as a thin override still count as
// covered by the shared section.
const SHARED_SURFACE = new Set([
  'locale', 'strings', 'localize', 'emit',
  'name', 'value', 'disabled', 'required', 'effectiveDisabled', 'form', 'labels', 'validity',
  'validationMessage', 'willValidate', 'setFormValue', 'checkValidity', 'reportValidity',
  'formResetCallback', 'formStateRestoreCallback', 'formDisabledCallback', 'internals',
]);

const camel = (name) => name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** Custom properties a component's own stylesheet reads but the manifest may not declare. */
function stylesheetTokens(modulePath) {
  const dir = path.join(packageDir, path.dirname(modulePath));
  if (!existsSync(dir)) return [];
  const found = new Set();
  for (const file of readdirSync(dir)) {
    if (!/\.styles\.ts$/.test(file)) continue;
    for (const m of readFileSync(path.join(dir, file), 'utf8').matchAll(/var\((--lr-[a-z0-9-]+)/g)) {
      found.add(m[1]);
    }
  }
  return [...found];
}

/**
 * @returns {Array<{family: string, tag: string, lines: number, kind: string, names: string[]}>}
 *   every documentable name the manifest (or the component's stylesheet) knows about that the
 *   component's own section never mentions.
 */
export function collectGaps(families = FAMILIES.map(([f]) => f)) {
  const manifest = JSON.parse(readFileSync(path.join(packageDir, 'custom-elements.json'), 'utf8'));
  const tagFacts = readTagFacts(manifest);
  const declFor = new Map();
  for (const mod of manifest.modules ?? []) {
    for (const decl of mod.declarations ?? []) {
      if (decl.customElement && decl.tagName) declFor.set(decl.tagName, { decl, mod });
    }
  }

  const gaps = [];
  for (const family of families) {
    const file = path.join(packageDir, 'llms', `${family}.md`);
    if (!existsSync(file)) continue;
    for (const section of splitSections(readFileSync(file, 'utf8'))) {
      for (const tag of section.tags) {
        const entry = declFor.get(tag);
        if (!entry) continue;
        const { decl, mod } = entry;
        const lines = section.text.split('\n').length;
        const miss = (kind, names) => {
          const gone = [...new Set(names)].filter((n) => n && !section.text.includes(n));
          if (gone.length) gaps.push({ family, tag, lines, kind, names: gone });
        };
        miss(
          'property',
          (decl.members ?? [])
            .filter(
              (m) =>
                m.privacy !== 'private' &&
                m.privacy !== 'protected' &&
                !m.static &&
                !m.inheritedFrom,
            )
            .map((m) => m.name)
            .filter((n) => !SHARED_SURFACE.has(n) && !n.startsWith('_') && !n.startsWith('#')),
        );
        // An attribute counts as documented when its camelCase property twin is — they are the
        // same knob and the sections document the property form.
        miss(
          'attribute',
          (decl.attributes ?? [])
            .map((a) => a.name)
            .filter(
              (n) =>
                !SHARED_SURFACE.has(n) &&
                !SHARED_SURFACE.has(camel(n)) &&
                !section.text.includes(camel(n)),
            ),
        );
        miss('event', (decl.events ?? []).map((e) => e.name));
        miss('slot', (decl.slots ?? []).map((s) => s.name).filter(Boolean));
        miss('csspart', (decl.cssParts ?? []).map((p) => p.name));
        miss('cssprop (manifest)', (decl.cssProperties ?? []).map((p) => p.name));
        // Component-scoped tokens only — the shared --lr-color-*/--lr-space-* layer lives in
        // llms/tokens.md and is deliberately not restated per component.
        miss(
          'cssprop (stylesheet, undeclared in manifest)',
          stylesheetTokens(mod.path).filter((t) => t.startsWith(`--${tag}-`)),
        );
      }
    }
  }
  return gaps;
}

export { FAMILIES, tagFactsFor };

function tagFactsFor() {
  const manifest = JSON.parse(readFileSync(path.join(packageDir, 'custom-elements.json'), 'utf8'));
  return readTagFacts(manifest);
}
