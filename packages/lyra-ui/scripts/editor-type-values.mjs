import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const STRING_LITERAL = /^(?:'[^']*'|"[^"]*")$/;
const NUMBER_LITERAL = /^-?\d+(?:\.\d+)?$/;
const OTHER_LITERAL = /^(?:null|undefined|true|false)$/;
const UNION_MEMBER = /\s*('[^']*'|"[^"]*"|-?\d+(?:\.\d+)?|null|undefined|true|false|[A-Za-z_$][A-Za-z0-9_$]*)\s*(\||$)/gy;

/** Parses only the deliberately narrow alias vocabulary used for HTML attribute values. */
export function parseSimpleUnion(typeText) {
  if (typeof typeText !== 'string' || typeText.trim().length === 0) return undefined;
  const members = [];
  let offset = 0;
  let complete = false;
  while (offset < typeText.length) {
    UNION_MEMBER.lastIndex = offset;
    const match = UNION_MEMBER.exec(typeText);
    if (!match || match.index !== offset) return undefined;
    members.push(match[1]);
    offset = UNION_MEMBER.lastIndex;
    if (match[2] === '') {
      complete = true;
      break;
    }
  }
  if (!complete || typeText.slice(offset).trim().length > 0) return undefined;
  return members.length > 0 ? members : undefined;
}

/**
 * Reads simple exported type aliases without guessing at mapped, conditional, lookup, generic, or
 * object types. Alias-to-alias unions are retained for recursive resolution; duplicate names with
 * different bodies are marked ambiguous and can never be expanded.
 */
export function readTypeAliases(root) {
  const sources = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) sources.push(full);
    }
  };
  walk(root);
  sources.sort();

  const aliases = new Map();
  const ambiguous = new Set();
  const declarations = new Map();
  const declaration = /export\s+type\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*([^;]+);/g;
  for (const file of sources) {
    for (const match of readFileSync(file, 'utf8').matchAll(declaration)) {
      const [, name, rawBody] = match;
      const body = rawBody.replace(/\s+/g, ' ').trim().replace(/^\|\s*/, '');
      if (ambiguous.has(name)) continue;
      if (declarations.has(name) && declarations.get(name) !== body) {
        aliases.delete(name);
        ambiguous.add(name);
        continue;
      }
      declarations.set(name, body);
      if (parseSimpleUnion(body)) aliases.set(name, body);
    }
  }
  return { aliases, ambiguous };
}

function expandMembers(typeText, registry, resolving) {
  const members = parseSimpleUnion(typeText);
  if (!members) return undefined;
  const expanded = [];
  for (const member of members) {
    if (STRING_LITERAL.test(member) || NUMBER_LITERAL.test(member) || OTHER_LITERAL.test(member)) {
      if (member !== 'null' && member !== 'undefined') expanded.push(member);
      continue;
    }
    if (!IDENTIFIER.test(member) || registry.ambiguous.has(member) || resolving.has(member)) {
      return undefined;
    }
    const body = registry.aliases.get(member);
    if (!body) return undefined;
    const nested = expandMembers(body, registry, new Set([...resolving, member]));
    if (!nested) return undefined;
    expanded.push(...nested);
  }
  return [...new Set(expanded)];
}

/** Resolves literal unions through any number of unambiguous alias hops. */
export function expandTypeText(typeText, registry) {
  if (!typeText) return undefined;
  const members = expandMembers(typeText, registry, new Set());
  return members?.length ? members.join(' | ') : undefined;
}

/** VS Code html.customData values for one attribute type. */
export function htmlDataValues(typeText, registry) {
  const expanded = expandTypeText(typeText, registry);
  const members = expanded ? parseSimpleUnion(expanded) : undefined;
  if (!members) return undefined;
  const values = members.flatMap((member) => {
    if (STRING_LITERAL.test(member)) return [{ name: member.slice(1, -1) }];
    if (NUMBER_LITERAL.test(member)) return [{ name: member }];
    return [];
  });
  return values.length ? values : undefined;
}

/** JetBrains web-types value metadata for one attribute type. */
export function webTypesValue(typeText, registry) {
  if (!typeText) return undefined;
  const expanded = expandTypeText(typeText, registry);
  if (expanded) {
    const members = parseSimpleUnion(expanded);
    if (members?.length) return { type: members };
  }
  return IDENTIFIER.test(typeText) ? { type: [typeText] } : undefined;
}
