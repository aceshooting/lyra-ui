// Derives the slim Custom Elements Manifest that @aceshooting/lyra-ui publishes as its own
// `customElements` target (`custom-elements.slim.json`). Discovery tooling (Storybook, wc-toolkit,
// IDE analyzers) reads that field to learn which tags exist and what each accepts, so the slim file
// keeps exactly that: per tag, the attributes, public members, events, slots, CSS parts, CSS
// properties and CSS states, flattened across superclasses (most readers do not follow
// `superclass`), with module paths pointing at the shipped `dist/` files. Descriptions, source
// references, status/since metadata and deprecation records stay in the full `custom-elements.json`,
// which publishes from @aceshooting/lyra-ide together with the other editor data.
//
// The full manifest stays the single source of truth: the public API gate and every other
// generator read it, never this derivative.
import { expandManifestInheritance } from './manifest-compact.mjs';

export const SLIM_MANIFEST_FILE = 'custom-elements.slim.json';

const REGISTRATION_MODULE = /^src\/components\/(lr-[a-z0-9-]+)\.ts$/u;

/** Source module path (`src/x/y.ts`, optionally rooted) to the compiled file the package ships. */
export function publishedModulePath(value) {
  return String(value ?? '')
    .replace(/^\//u, '')
    .replace(/^src\//u, 'dist/')
    .replace(/\.tsx?$/u, '.js');
}

// Code-unit order, matching expandManifestInheritance: the output is byte-compared for freshness,
// and locale collation differs between ICU builds.
const byName = (left, right) => {
  const a = String(left.name ?? '');
  const b = String(right.name ?? '');
  return a < b ? -1 : a > b ? 1 : 0;
};

const typed = (entry) => (entry?.type?.text ? { type: { text: entry.type.text } } : {});

const isPublic = (entry) => (entry.privacy ?? 'public') === 'public'
  && !String(entry.name).startsWith('_') && !String(entry.name).startsWith('#');

function slimMember(member) {
  const out = { kind: member.kind, name: member.name };
  if (member.static) out.static = true;
  if (member.kind === 'method') {
    if (member.return?.type?.text) out.return = { type: { text: member.return.type.text } };
    return out;
  }
  Object.assign(out, typed(member));
  if (member.readonly) out.readonly = true;
  return out;
}

function slimDeclaration(declaration) {
  const out = { kind: 'class', name: declaration.name, tagName: declaration.tagName, customElement: true };
  const seen = new Set();
  const members = (declaration.members ?? [])
    .filter((member) => (member.kind === 'field' || member.kind === 'method') && isPublic(member))
    .map(slimMember)
    .filter((member) => {
      const key = JSON.stringify([member.kind, member.static === true, member.name]);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(byName);
  if (members.length > 0) out.members = members;
  const attributes = (declaration.attributes ?? []).map((attribute) => ({
    name: attribute.name,
    ...(attribute.fieldName ? { fieldName: attribute.fieldName } : {}),
    ...typed(attribute),
    ...(attribute.default !== undefined ? { default: attribute.default } : {}),
  })).sort(byName);
  if (attributes.length > 0) out.attributes = attributes;
  const events = (declaration.events ?? []).filter((event) => event.name)
    .map((event) => ({ name: event.name, ...typed(event) })).sort(byName);
  if (events.length > 0) out.events = events;
  for (const key of ['slots', 'cssParts', 'cssProperties', 'cssStates']) {
    const entries = (declaration[key] ?? []).map((entry) => ({ name: entry.name })).sort(byName);
    if (entries.length > 0) out[key] = entries;
  }
  return out;
}

/**
 * Builds the slim manifest from the full lyra-ui manifest (compact or flattened). Only modules under
 * `src/` belong to this package; companion modules are ignored.
 */
export function buildSlimManifest(full) {
  const expanded = expandManifestInheritance(structuredClone(full));
  const modules = [];
  for (const module of expanded.modules ?? []) {
    if (!String(module.path ?? '').replace(/^\//u, '').startsWith('src/')) continue;
    const declarations = (module.declarations ?? [])
      .filter((declaration) => declaration.kind === 'class' && declaration.customElement === true && declaration.tagName);
    if (declarations.length > 0) {
      const names = new Set(declarations.map((declaration) => declaration.name));
      const exports = (module.exports ?? [])
        .filter((entry) => entry.kind === 'js' && names.has(entry.name) && entry.declaration?.name)
        .map((entry) => ({
          kind: 'js',
          name: entry.name,
          declaration: { name: entry.declaration.name, module: publishedModulePath(entry.declaration.module ?? module.path) },
        }))
        .sort(byName);
      modules.push({
        kind: 'javascript-module',
        path: publishedModulePath(module.path),
        declarations: declarations.map(slimDeclaration).sort(byName),
        ...(exports.length > 0 ? { exports } : {}),
      });
      continue;
    }
    // The one registration module per tag (`src/components/lr-<tag>.ts`) carries the definition;
    // other modules that register a dependency tag on the side are not where a reader imports it.
    const registration = REGISTRATION_MODULE.exec(String(module.path ?? '').replace(/^\//u, ''));
    if (!registration) continue;
    const definitions = (module.exports ?? [])
      .filter((entry) => entry.kind === 'custom-element-definition' && entry.name === registration[1] && entry.declaration?.name)
      .map((entry) => ({
        kind: 'custom-element-definition',
        name: entry.name,
        declaration: { name: entry.declaration.name, module: publishedModulePath(entry.declaration.module) },
      }));
    if (definitions.length > 0) {
      modules.push({ kind: 'javascript-module', path: publishedModulePath(module.path), declarations: [], exports: definitions });
    }
  }
  modules.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  return { schemaVersion: full.schemaVersion ?? '1.0.0', readme: '', modules };
}

export function renderSlimManifest(full) {
  return `${JSON.stringify(buildSlimManifest(full))}\n`;
}
