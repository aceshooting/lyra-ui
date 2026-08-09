// Shared gap computation between `llms-gap-report.mjs` (prints the worklist) and
// `check-llms-freshness.mjs` (fails the build). One implementation so the report an author fixes
// is exactly the set CI enforces.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitSections, readTagFacts, FAMILIES } from './build-llms.mjs';
import { expandManifestInheritance } from './manifest-compact.mjs';

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
const escapePattern = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * True when `name` appears in `text` as a genuine standalone token, not merely as a substring of an
 * unrelated word or a different (usually longer, hyphenated) identifier. A plain `text.includes(n)`
 * false-passes e.g. the `label`/`hint`/`error` CSS *parts* as "documented" purely because those exact
 * words already occur elsewhere in the section as *property* names ("the `label` property"), and it
 * false-passes a `change` *event* because it is a literal substring of the unrelated `lr-change`
 * event and of prose like "since changed". Both identifier characters (`\w`) and `-` count as
 * "still part of the token" on either side, so `min-hops` only matches itself whole (never the
 * `min-hops` inside a longer run) and `label` inside `mislabeled` or preceded by `lr-` is correctly
 * rejected. `name` is escaped before use since manifest names are treated as literal text, not
 * pattern syntax (defensive -- current names are plain identifiers/`--lr-*` tokens with no regex
 * metacharacters, but a future name might contain one).
 */
export function mentionsName(text, name) {
  const escaped = escapePattern(name);
  return new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`).test(text);
}

/**
 * Checks one member only inside its explicitly labelled authored API block. A component may use the
 * same vocabulary in several namespaces (`leading` can be a slot and a CSS part; `label` can be a
 * property, slot, and part), so a section-wide token search cannot prove the named contract surface
 * is actually enumerated where consumers look for it.
 */
export function contractBlockMentionsName(text, label, name, tag = '') {
  let scope = text;
  if (tag) {
    const headings = [...text.matchAll(/^(#{2,6})\s+`(lr-[a-z0-9-]+)`\s*$/gm)];
    const ownIndex = headings.findIndex((heading) => heading[2] === tag);
    if (ownIndex >= 0) {
      const own = headings[ownIndex];
      const ownLevel = own[1].length;
      const next = headings.slice(ownIndex + 1).find((heading) => heading[1].length <= ownLevel);
      scope = text.slice(own.index, next?.index ?? text.length);
    }
  }
  const escapedLabel = label.split(/\s+/).map(escapePattern).join('\\s+');
  const inlineMarker = new RegExp(`\\*\\*${escapedLabel}(?: \\(\\d+\\))?:\\*\\*`, 'i').exec(scope);
  const headingMarker = new RegExp(`^#{2,6}\\s+${escapedLabel}\\s*$`, 'im').exec(scope);
  const marker =
    inlineMarker && headingMarker
      ? inlineMarker.index < headingMarker.index
        ? inlineMarker
        : headingMarker
      : inlineMarker ?? headingMarker;
  if (!marker) return false;
  const remainder = scope.slice(marker.index + marker[0].length);
  const nextBlock = remainder.search(/^(?:\*\*[^*\n]+:\*\*|#{1,6}\s|---\s*$)/m);
  const block = nextBlock < 0 ? remainder : remainder.slice(0, nextBlock);
  return mentionsName(block, name);
}

/**
 * True only for the authored whole-surface inheritance declaration. Ordinary prose saying that a
 * component "inherits from" another one is intentionally insufficient: the exact marker is a
 * reviewable promise that every public inherited attribute, slot, part, event, and theme property
 * remains available without duplicating a long base-component table.
 */
export function inheritsAllPublicSurface(text, baseTag) {
  const escaped = escapePattern(baseTag);
  return new RegExp('^\\*\\*Inherits:\\*\\* all public surface from `' + escaped + '`\\.$', 'm').test(text);
}

function inheritedSurfaceIsDocumented(item, text, tagByDeclaration) {
  const baseTag = tagByDeclaration.get(item?.inheritedFrom?.name);
  return Boolean(baseTag && inheritsAllPublicSurface(text, baseTag));
}

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
 * Whether `tag` is the component a component-scoped custom property belongs to. A token is owned by
 * the longest registered tag whose `--<tag>-` prefix it carries, so `--lr-tab-group-hover-color`
 * belongs to `lr-tab-group` alone even though `--lr-tab-` also matches it.
 */
export function ownsToken(tag, token, allTags) {
  if (!token.startsWith(`--${tag}-`)) return false;
  for (const other of allTags) {
    if (other.length > tag.length && token.startsWith(`--${other}-`)) return false;
  }
  return true;
}

/**
 * @param {string[]} families authored family documents to inspect
 * @param {object | null} manifestOverride optional in-memory manifest for generation tests
 * @returns {Array<{family: string, tag: string, lines: number, kind: string, names: string[]}>}
 *   every documentable name the manifest (or the component's stylesheet) knows about that the
 *   component's own section never mentions.
 */
export function collectGaps(families = FAMILIES.map(([f]) => f), manifestOverride = null) {
  const manifest = expandManifestInheritance(
    manifestOverride ?? JSON.parse(
      readFileSync(path.join(packageDir, 'custom-elements.json'), 'utf8'),
    ),
  );
  const tagFacts = readTagFacts(manifest);
  const declFor = new Map();
  for (const mod of manifest.modules ?? []) {
    for (const decl of mod.declarations ?? []) {
      if (decl.customElement && decl.tagName) declFor.set(decl.tagName, { decl, mod });
    }
  }

  const allTags = [...declFor.keys()];
  const tagByDeclaration = new Map(
    [...declFor].map(([tag, { decl }]) => [decl.name, tag]),
  );
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
        const miss = (kind, names, mentions = (name) => mentionsName(section.text, name)) => {
          const gone = [...new Set(names)].filter((n) => n && !mentions(n));
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
            .filter((attribute) => !inheritedSurfaceIsDocumented(attribute, section.text, tagByDeclaration))
            .map((a) => a.name)
            .filter(
              (n) =>
                !SHARED_SURFACE.has(n) &&
                !SHARED_SURFACE.has(camel(n)) &&
                !mentionsName(section.text, camel(n)),
            ),
        );
        miss(
          'event',
          (decl.events ?? [])
            .filter((event) => !inheritedSurfaceIsDocumented(event, section.text, tagByDeclaration))
            .map((event) => event.name),
        );
        miss(
          'slot',
          (decl.slots ?? [])
            .filter((slot) => !inheritedSurfaceIsDocumented(slot, section.text, tagByDeclaration))
            .map((slot) => slot.name)
            .filter(Boolean),
        );
        const cssParts = (decl.cssParts ?? []).filter(
          (part) => !inheritedSurfaceIsDocumented(part, section.text, tagByDeclaration),
        );
        miss(
          'csspart',
          cssParts.filter((part) => !part.inheritedFrom).map((part) => part.name),
          (name) => contractBlockMentionsName(section.text, 'CSS parts', name, tag),
        );
        // Inherited members may be covered by the exact whole-surface declaration above or by
        // explicit compatibility prose in the child section. They are not required to be repeated
        // in the child's direct CSS-parts list, especially when a subclass intentionally replaces
        // a base visual while the compact manifest still retains the inherited metadata.
        miss('csspart (inherited)', cssParts.filter((part) => part.inheritedFrom).map((part) => part.name));
        miss(
          'cssprop (manifest)',
          (decl.cssProperties ?? [])
            .filter((property) => !inheritedSurfaceIsDocumented(property, section.text, tagByDeclaration))
            .map((property) => property.name),
        );
        // Component-scoped tokens only — the shared --lr-color-*/--lr-space-* layer lives in
        // llms/tokens.md and is deliberately not restated per component.
        // Ownership is by the LONGEST matching tag, not merely a prefix match: sibling components
        // sharing a directory can have tags that prefix one another (`lr-tab` / `lr-tab-group`),
        // and a plain `startsWith` would bill `--lr-tab-group-hover-color` to `lr-tab` as well,
        // demanding it be documented in a section it has nothing to do with.
        miss(
          'cssprop (stylesheet, undeclared in manifest)',
          stylesheetTokens(mod.path).filter((token) => ownsToken(tag, token, allTags)),
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
