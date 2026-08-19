const INHERITABLE_ARRAYS = Object.freeze([
  'members',
  'attributes',
  'events',
  'slots',
  'cssParts',
  'cssProperties',
]);

// `compactManifest` prunes a resolvable inherited entry from every array above *except* cssParts.
// A JS/TypeScript consumer of `members`/`attributes`/`events`/`slots`/`cssProperties` already
// walks the class's own `extends` chain to see the full contract, so repeating a base class's
// entries on every subclass is redundant there (`expandManifestInheritance` reconstructs the
// union on demand for the few generators that need a flattened view). `::part()` has no such
// chain for its consumers: docs generators, editor tooling, and any `part=` usage check reads a
// tag's own `cssParts` list directly, per tag, the same way `cssStates` (never listed in
// `INHERITABLE_ARRAYS` at all) already always does. Pruning inherited parts made a subclass like
// `lr-number-input`/`lr-dropdown` under-report parts that are real at runtime and already
// documented in the component's own generated reference doc (which reads through
// `expandManifestInheritance` and so never showed the gap).
const NEVER_PRUNED_ARRAYS = Object.freeze(['cssParts']);

const normalizeModulePath = (path = '') => path.replace(/^\//, '').replace(/\.js$/, '.ts');

function declarationIndex(manifest) {
  const exact = new Map();
  const byName = new Map();
  for (const module of manifest.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      exact.set(`${normalizeModulePath(module.path)}#${declaration.name}`, declaration);
      const matches = byName.get(declaration.name) ?? [];
      matches.push(declaration);
      byName.set(declaration.name, matches);
    }
  }
  return { exact, byName };
}

function resolveSuperclass(declaration, index) {
  const superclass = declaration.superclass;
  if (!superclass?.name) return undefined;
  if (superclass.module) {
    const exact = index.exact.get(`${normalizeModulePath(superclass.module)}#${superclass.name}`);
    if (exact) return exact;
  }
  const named = index.byName.get(superclass.name) ?? [];
  return named.length === 1 ? named[0] : undefined;
}

function mergeIdentity(key, entry) {
  if (key !== 'members' || entry.kind !== 'method') return String(entry.name ?? '');
  const parameters = (entry.parameters ?? []).map((parameter) => [
    parameter.type?.text ?? '',
    Boolean(parameter.optional),
    Boolean(parameter.rest),
  ]);
  return `${entry.kind}:${String(entry.name ?? '')}:${JSON.stringify(parameters)}`;
}

const SUBCLASS_ANNOTATION_KEYS = Object.freeze(['description', 'summary', 'default', 'deprecated']);

/** The analyzer marks a subclass's explicit same-name annotation with `inheritedFrom` even when
 * its authored prose/default differs from the base. Such an entry is an override, not a redundant
 * inherited copy, and has to survive compaction so expansion can let it win. */
function hasSubclassAnnotationOverride(key, entry, superclass) {
  const inherited = (superclass[key] ?? []).find(
    (candidate) => mergeIdentity(key, candidate) === mergeIdentity(key, entry),
  );
  if (!inherited) return true;
  return SUBCLASS_ANNOTATION_KEYS.some(
    (annotation) =>
      Object.hasOwn(entry, annotation) &&
      JSON.stringify(entry[annotation]) !== JSON.stringify(inherited[annotation]),
  );
}

/**
 * Produces the published Custom Elements Manifest representation. Private/protected implementation
 * members are never public API, and standard-resolvable inherited surfaces belong on their base
 * declaration rather than being repeated in every subclass -- except cssParts, which are kept in
 * full on every declaration; see `NEVER_PRUNED_ARRAYS`. Unresolvable mixin-expression bases retain
 * their analyzer-projected inherited surface so compaction cannot hide an API.
 */
export function compactManifest(manifest) {
  const output = structuredClone(manifest);
  // Compare overrides against the analyzer's complete, unpruned base declarations. Looking them
  // up in `output` while compaction is in progress makes the result depend on module order: a base
  // visited earlier may already have lost its own inherited entries, making a grandchild's exact
  // copy look like a new override.
  const sourceIndex = declarationIndex(manifest);
  for (const module of output.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      const superclass = resolveSuperclass(declaration, sourceIndex);
      for (const key of INHERITABLE_ARRAYS) {
        if (!Array.isArray(declaration[key])) continue;
        declaration[key] = declaration[key].filter((entry) => {
          if (key === 'members' && ['private', 'protected'].includes(entry.privacy)) return false;
          if (NEVER_PRUNED_ARRAYS.includes(key)) return true;
          if (superclass && entry.inheritedFrom && !hasSubclassAnnotationOverride(key, entry, superclass)) {
            return false;
          }
          return true;
        });
        if (declaration[key].length === 0) delete declaration[key];
      }
    }
  }
  return output;
}

/** Expands standard-resolvable superclass surfaces for repository generators that intentionally
 * emit flattened editor/framework declarations. Public consumers may perform the same traversal
 * directly from the compact standards-compliant manifest. */
export function expandManifestInheritance(manifest) {
  const output = structuredClone(manifest);
  const index = declarationIndex(output);
  const expanded = new WeakSet();
  const active = new WeakSet();

  const visit = (declaration) => {
    if (expanded.has(declaration)) return;
    if (active.has(declaration)) throw new Error(`cyclic manifest superclass chain at ${declaration.name}`);
    active.add(declaration);
    const base = resolveSuperclass(declaration, index);
    if (base) {
      visit(base);
      for (const key of INHERITABLE_ARRAYS) {
        const own = declaration[key] ?? [];
        const inherited = (base[key] ?? []).map((entry) => ({
          ...structuredClone(entry),
          inheritedFrom: entry.inheritedFrom ?? {
            name: base.name,
          },
        }));
        // Methods may have several public overloads with the same name. A name-only map silently
        // collapsed setRangeText()/event overloads while expanding the compact manifest; match a
        // method override by its parameter signature and retain every other inherited overload.
        const merged = new Map(inherited.map((entry) => [mergeIdentity(key, entry), entry]));
        for (const entry of own) merged.set(mergeIdentity(key, entry), entry);
        if (merged.size > 0) {
          // Code-unit order, not localeCompare: this sort feeds the byte-compared generated
          // artifacts (framework types, editor data, llms/components), and collation differs
          // between ICU builds and default locales -- 80 arrays here order differently under the
          // two (autocapitalize/autocomplete/autoCorrect). A contributor on a small-ICU Node would
          // otherwise regenerate a different byte sequence and fail check:framework-types for no
          // real reason. Matches compareText() in custom-elements-manifest.config.js.
          declaration[key] = [...merged.values()].sort((a, b) => {
            const left = String(a.name ?? '');
            const right = String(b.name ?? '');
            return left < right ? -1 : left > right ? 1 : 0;
          });
        }
      }
    }
    active.delete(declaration);
    expanded.add(declaration);
  };

  for (const module of output.modules ?? []) {
    for (const declaration of module.declarations ?? []) visit(declaration);
  }
  return output;
}
