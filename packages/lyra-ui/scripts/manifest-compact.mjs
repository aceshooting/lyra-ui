const INHERITABLE_ARRAYS = Object.freeze([
  'members',
  'attributes',
  'events',
  'slots',
  'cssParts',
  'cssProperties',
]);

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

/**
 * Produces the published Custom Elements Manifest representation. Private/protected implementation
 * members are never public API, and standard-resolvable inherited surfaces belong on their base
 * declaration rather than being repeated in every subclass. Unresolvable mixin-expression bases
 * retain their analyzer-projected inherited surface so compaction cannot hide an API.
 */
export function compactManifest(manifest) {
  const output = structuredClone(manifest);
  const index = declarationIndex(output);
  for (const module of output.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      const superclassIsResolvable = resolveSuperclass(declaration, index) !== undefined;
      for (const key of INHERITABLE_ARRAYS) {
        if (!Array.isArray(declaration[key])) continue;
        declaration[key] = declaration[key].filter((entry) => {
          if (key === 'members' && ['private', 'protected'].includes(entry.privacy)) return false;
          if (superclassIsResolvable && entry.inheritedFrom) return false;
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
          declaration[key] = [...merged.values()].sort((a, b) =>
            String(a.name ?? '').localeCompare(String(b.name ?? '')),
          );
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
