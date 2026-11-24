#!/usr/bin/env node
/**
 * Draft a reviewed-role overlay for one published Lyra UI tag from its custom-elements manifest.
 *
 *   node scripts/draft-role.mjs lr-gauge [--role gauge]
 *
 * The output is a starting point for review, never a registration: scalar members receive bounded
 * schemas, closed literal unions become enums, and every member that needs a decision (object or
 * array data, callbacks, element references, URL-like names) is listed for the reviewer instead of
 * being exposed. Adding the role to a catalog, its example and its conformance scenario stay manual.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from '../../lyra-ui/scripts/is-main-module.mjs';

const uiRoot = fileURLToPath(new URL('../../lyra-ui/', import.meta.url));
const urlLike = /(?:^|[A-Z_-])(?:url|href|src|srcset|action|formaction|poster|uri|image|icon|logo|avatar|thumbnail)$/iu;
const labelLike = /(?:label|heading|caption|title|valueText|placeholder|summary)$/u;
const descriptionLike = /(?:description|hint|text|message)$/iu;

/** Collect `export type Name = ...;` declarations so literal unions resolve through aliases. */
export function collectTypeAliases(root = path.join(uiRoot, 'src')) {
  const aliases = new Map();
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) { visit(file); continue; }
      if (!entry.name.endsWith('.ts') || entry.name.endsWith('.test.ts') || entry.name.endsWith('.stories.ts')) continue;
      for (const match of readFileSync(file, 'utf8').matchAll(/export type ([A-Za-z0-9_]+)\s*=\s*([^;]+);/gu)) aliases.set(match[1], match[2].trim());
    }
  };
  visit(root);
  return aliases;
}

/** Resolve a type text to a sorted list of string literals, or undefined when it is not a closed string set. */
export function literalUnion(text, aliases, seen = new Set()) {
  const values = [];
  for (const raw of text.split('|').map(part => part.trim()).filter(Boolean)) {
    if (raw === 'undefined' || raw === 'null') continue;
    const literal = /^'([^']*)'$/u.exec(raw) ?? /^"([^"]*)"$/u.exec(raw);
    if (literal) { values.push(literal[1]); continue; }
    if (!/^[A-Za-z0-9_]+$/u.test(raw) || seen.has(raw) || !aliases.has(raw)) return undefined;
    const nested = literalUnion(aliases.get(raw), aliases, new Set([...seen, raw]));
    if (!nested) return undefined;
    values.push(...nested);
  }
  return values.length ? [...new Set(values)] : undefined;
}

const SKIP_INHERITED = new Set(['dir', 'lang', 'strings', 'locale']);

/** Classify one manifest field into a schema expression or a review note. */
export function classifyMember(member, aliases) {
  const name = member.name;
  const text = (member.type?.text ?? '').replace(/\s+/gu, ' ').trim();
  const base = text.replace(/\s*\|\s*(?:undefined|null)\b/gu, '').trim();
  if (urlLike.test(name)) return { review: `${name}: URL-like member; needs a reviewed urlSinks policy or stays host-owned` };
  if (/=>|Function\b|\bElement\b|HTML[A-Za-z]*Element|Node\b|Promise</u.test(text)) return { review: `${name}: callback or element reference (${text}); host property only` };
  if (base === 'string') return { schema: labelLike.test(name) ? 'label' : descriptionLike.test(name) ? 'string(1024)' : 'string(256)' };
  if (base === 'number') return { schema: 'number', note: `${name}: set explicit minimum/maximum` };
  if (base === 'boolean') return { schema: 'boolean' };
  const union = literalUnion(base, aliases);
  if (union) return { schema: `choice(${union.map(value => `'${value}'`).join(', ')})` };
  if (/\[\]$|^readonly |^Array</u.test(base)) return { review: `${name}: array data (${text}); define a bounded item schema` };
  return { review: `${name}: structured type (${text || 'unknown'}); define a bounded schema or omit` };
}

export function findDeclaration(tag, manifest) {
  for (const module of manifest.modules) for (const declaration of module.declarations ?? []) if (declaration.tagName === tag) return { module: module.path, declaration };
  return undefined;
}

/** Own members first, then superclass and mixin members the manifest records by name. */
export function inheritedMembers(declaration, manifest, seen = new Set()) {
  if (!declaration || seen.has(declaration.name)) return [];
  seen.add(declaration.name);
  const byName = name => manifest.modules.flatMap(module => module.declarations ?? []).find(candidate => candidate.name === name);
  const own = declaration.members ?? [];
  const parents = [declaration.superclass?.name, ...(declaration.mixins ?? []).map(mixin => mixin.name)].filter(Boolean);
  const inherited = parents.flatMap(name => inheritedMembers(byName(name), manifest, seen));
  const names = new Set(own.map(member => member.name));
  return [...own, ...inherited.filter(member => !names.has(member.name))];
}

/** Build the draft text and the review list for one tag. */
export function draftRole(tag, { role = tag.replace(/^lr-/u, ''), manifest = JSON.parse(readFileSync(path.join(uiRoot, 'custom-elements.json'), 'utf8')), aliases = collectTypeAliases() } = {}) {
  const found = findDeclaration(tag, manifest);
  if (!found) throw new Error(`Unknown published tag: ${tag}`);
  const { declaration } = found;
  const properties = [];
  const review = [];
  const notes = [];
  for (const member of inheritedMembers(declaration, manifest)) {
    if (member.kind !== 'field' || member.static || member.readonly || member.privacy === 'private' || member.privacy === 'protected' || member.name.startsWith('_') || SKIP_INHERITED.has(member.name)) continue;
    if (/@internal|@deprecated/u.test(member.description ?? '') || member.deprecated) continue;
    const result = classifyMember(member, aliases);
    if (result.schema) properties.push(`${member.name}: ${result.schema}`);
    if (result.review) review.push(result.review);
    if (result.note) notes.push(result.note);
  }
  const slots = (declaration.slots ?? []).map(slot => slot.name ?? '');
  const events = (declaration.events ?? []).map(event => event.name).filter(Boolean);
  const named = properties.some(entry => entry.startsWith('label:')) ? `, accessibleName: { required: true, properties: ['label'] }` : '';
  const lines = [
    `  ${/^[a-z][a-z0-9]*$/u.test(role) ? role : `'${role}'`}: {`,
    `    tag: '${tag}',`,
    `    properties: { ${properties.join(', ')} }${named},`,
    ...(slots.length ? [`    // slots: ${JSON.stringify(slots)} — declare children/slots only for reviewed nesting`] : []),
    ...(events.length ? [`    // events: ${JSON.stringify(events)} — list in events only when an action may start from them`] : []),
    `    load: () => import('@aceshooting/lyra-ui/components/${tag}.js'),`,
    `    documentation: documentation('${tag}'),`,
    '  },',
  ];
  return { role, tag, source: lines.join('\n'), properties, review, notes };
}

if (isMainModule(import.meta.url)) {
  const [tag, ...rest] = process.argv.slice(2);
  if (!tag || !/^lr-[a-z0-9-]+$/u.test(tag)) { console.error('Usage: node scripts/draft-role.mjs lr-<tag> [--role <name>]'); process.exit(2); }
  const roleIndex = rest.indexOf('--role');
  const draft = draftRole(tag, roleIndex >= 0 ? { role: rest[roleIndex + 1] } : {});
  console.log(draft.source);
  for (const entry of [...draft.notes, ...draft.review]) console.error(`review: ${entry}`);
}
