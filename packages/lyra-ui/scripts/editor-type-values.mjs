import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const STRING_LITERAL = /^(?:'[^']*'|"[^"]*")$/;
const NUMBER_LITERAL = /^-?\d+(?:\.\d+)?$/;
const OTHER_LITERAL = /^(?:null|undefined|true|false)$/;
const UNION_MEMBER = /\s*('[^']*'|"[^"]*"|-?\d+(?:\.\d+)?|null|undefined|true|false|[A-Za-z_$][A-Za-z0-9_$]*)\s*(\||$)/gy;

// These platform/library vocabularies are public, finite HTML attribute sets but their declaration
// syntax is not available in Lyra's source tree (and, in Placement's case, includes template
// literal types). Keep the small reviewed sets explicit rather than silently dropping editor
// completion or coupling this generator to a particular node_modules layout.
const EXTERNAL_CLOSED_TYPES = new Map([
  ['FillMode', "'auto' | 'backwards' | 'both' | 'forwards' | 'none'"],
  ['PlaybackDirection', "'alternate' | 'alternate-reverse' | 'normal' | 'reverse'"],
  [
    'Placement',
    [
      'top', 'top-start', 'top-end',
      'right', 'right-start', 'right-end',
      'bottom', 'bottom-start', 'bottom-end',
      'left', 'left-start', 'left-end',
    ].map((value) => `'${value}'`).join(' | '),
  ],
]);

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
 * Reads exported type aliases plus the public property shape of property-only exported interfaces.
 * Closed-value resolution below deliberately understands only unions, Extract/Exclude, and indexed
 * access; every other expression remains opaque. Structural consumers can use the separately
 * recorded object/interface shapes. Duplicate names with different bodies are marked ambiguous and
 * can never be expanded.
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

  const aliases = new Map(EXTERNAL_CLOSED_TYPES);
  const ambiguous = new Set();
  const declarations = new Map();
  const indexedProperties = new Map();
  const structuralAliases = new Map();
  const structuralAmbiguous = new Set();
  const recordStructuralAlias = (name, body) => {
    if (structuralAmbiguous.has(name)) return;
    if (structuralAliases.has(name) && structuralAliases.get(name) !== body) {
      structuralAliases.delete(name);
      structuralAmbiguous.add(name);
      return;
    }
    structuralAliases.set(name, body);
  };
  const declaration = /export\s+type\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*/g;
  for (const file of sources) {
    const source = readFileSync(file, 'utf8');
    declaration.lastIndex = 0;
    let match;
    while ((match = declaration.exec(source))) {
      const name = match[1];
      const bodyStart = declaration.lastIndex;
      const stack = [];
      let quote = '';
      let bodyEnd = -1;
      const openers = new Map([['(', ')'], ['[', ']'], ['{', '}'], ['<', '>']]);
      for (let index = bodyStart; index < source.length; index += 1) {
        const char = source[index];
        if (quote) {
          if (char === quote && source[index - 1] !== '\\') quote = '';
          continue;
        }
        if (char === "'" || char === '"' || char === '`') {
          quote = char;
          continue;
        }
        if (openers.has(char)) stack.push(openers.get(char));
        else if (stack.at(-1) === char) stack.pop();
        else if (char === ';' && stack.length === 0) {
          bodyEnd = index;
          break;
        }
      }
      if (bodyEnd < 0) continue;
      declaration.lastIndex = bodyEnd + 1;
      const rawBody = source.slice(bodyStart, bodyEnd);
      const body = rawBody.replace(/\s+/g, ' ').trim().replace(/^\|\s*/, '');
      if (ambiguous.has(name)) continue;
      if (declarations.has(name) && declarations.get(name) !== body) {
        aliases.delete(name);
        ambiguous.add(name);
        continue;
      }
      declarations.set(name, body);
      aliases.set(name, body);
      if (/^\{[\s\S]*\}$/u.test(body)) {
        recordStructuralAlias(name, body);
      }
    }

    const interfaceStart = /export\s+interface\s+([A-Za-z_$][A-Za-z0-9_$]*)[^\{]*\{/g;
    for (const match of source.matchAll(interfaceStart)) {
      const name = match[1];
      const bodyStart = match.index + match[0].length;
      let depth = 1;
      let quote = '';
      let bodyEnd = -1;
      for (let index = bodyStart; index < source.length; index += 1) {
        const char = source[index];
        if (quote) {
          if (char === quote && source[index - 1] !== '\\') quote = '';
          continue;
        }
        if (char === "'" || char === '"' || char === '`') {
          quote = char;
          continue;
        }
        if (char === '{') depth += 1;
        if (char === '}') depth -= 1;
        if (depth === 0) {
          bodyEnd = index;
          break;
        }
      }
      if (bodyEnd < 0) continue;
      const body = source.slice(bodyStart, bodyEnd);
      const property =
        /(?:^|[;\n])\s*(readonly\s+)?([A-Za-z_$][A-Za-z0-9_$]*)(\?)?\s*:\s*([^;\n]+)\s*;/g;
      const structuralMembers = [];
      for (const propertyMatch of body.matchAll(property)) {
        const [, readonly, propertyName, optional, propertyType] = propertyMatch;
        indexedProperties.set(`${name}.${propertyName}`, propertyType.trim());
        structuralMembers.push(
          `${readonly ? 'readonly ' : ''}${propertyName}${optional ?? ''}: ${propertyType.trim()}`,
        );
      }
      const nonPropertyBody = body
        .replace(property, '')
        .replace(/\/\*[\s\S]*?\*\//gu, '')
        .replace(/\/\/[^\n]*/gu, '')
        .trim();
      if (structuralMembers.length > 0 && nonPropertyBody === '') {
        recordStructuralAlias(
          name,
          `{ ${structuralMembers.join('; ')} }`,
        );
      }
    }
  }
  return {
    aliases,
    ambiguous,
    indexedProperties,
    structuralAliases,
    structuralAmbiguous,
  };
}

function stripOuterParens(value) {
  let result = value.trim();
  while (result.startsWith('(') && result.endsWith(')')) {
    let depth = 0;
    let closesAtEnd = false;
    for (let index = 0; index < result.length; index += 1) {
      if (result[index] === '(') depth += 1;
      if (result[index] === ')') depth -= 1;
      if (depth === 0) {
        closesAtEnd = index === result.length - 1;
        break;
      }
    }
    if (!closesAtEnd) break;
    result = result.slice(1, -1).trim();
  }
  return result;
}

function splitTopLevel(value, delimiter = '|') {
  const parts = [];
  let start = 0;
  let quote = '';
  const stack = [];
  const openers = new Map([['(', ')'], ['[', ']'], ['{', '}'], ['<', '>']]);
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === quote && value[index - 1] !== '\\') quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (openers.has(char)) stack.push(openers.get(char));
    else if (stack.at(-1) === char) stack.pop();
    else if (char === delimiter && stack.length === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.every(Boolean) ? parts : undefined;
}

function resolveExpression(typeText, registry, resolving) {
  const expression = stripOuterParens(typeText);
  const union = splitTopLevel(expression);
  if (!union) return undefined;
  if (union.length > 1) {
    const values = [];
    let foundOpenBranch = false;
    for (const member of union) {
      const resolved = resolveExpression(member, registry, resolving);
      if (!resolved) return undefined;
      values.push(...resolved.values);
      foundOpenBranch ||= resolved.open;
    }
    return { values: [...new Set(values)], open: foundOpenBranch };
  }

  if (STRING_LITERAL.test(expression) || NUMBER_LITERAL.test(expression) || OTHER_LITERAL.test(expression)) {
    return {
      values: expression === 'null' || expression === 'undefined' ? [] : [expression],
      open: false,
    };
  }

  // An object branch makes a union open, but does not erase the useful closed literal members.
  if (/^\{[\s\S]*\}$/.test(expression)) return { values: [], open: true };

  const utility = /^(Extract|Exclude)\s*<([\s\S]+)>$/.exec(expression);
  if (utility) {
    const parameters = splitTopLevel(utility[2], ',');
    if (!parameters || parameters.length !== 2) return undefined;
    const source = resolveExpression(parameters[0], registry, resolving);
    const filter = resolveExpression(parameters[1], registry, resolving);
    if (!source || !filter || source.open || filter.open) return undefined;
    const filterSet = new Set(filter.values);
    return {
      values: source.values.filter((value) => utility[1] === 'Extract' ? filterSet.has(value) : !filterSet.has(value)),
      open: false,
    };
  }

  const indexed = /^([A-Za-z_$][A-Za-z0-9_$]*)\s*\[\s*['"]([^'"]+)['"]\s*\]$/.exec(expression);
  if (indexed) {
    const body = registry.indexedProperties?.get(`${indexed[1]}.${indexed[2]}`);
    return body ? resolveExpression(body, registry, resolving) : undefined;
  }

  if (!IDENTIFIER.test(expression) || registry.ambiguous.has(expression) || resolving.has(expression)) {
    return undefined;
  }
  const body = registry.aliases.get(expression);
  if (!body) return undefined;
  return resolveExpression(body, registry, new Set([...resolving, expression]));
}

/** Resolves literal unions through any number of unambiguous alias hops. */
export function expandTypeText(typeText, registry) {
  if (!typeText) return undefined;
  const resolved = resolveExpression(typeText, registry, new Set());
  return resolved?.values.length ? resolved.values.join(' | ') : undefined;
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
