// Source scanning, lexical ownership, and location-aware migration analysis.
import path from 'node:path';
import { invariant } from './migration-contract.mjs';
import { htmlCommentEnd } from './html-comments.mjs';


export function ecosystemForTag(tag) {
  return tag.startsWith('wa-') ? 'webawesome' : 'shoelace';
}

export function lineStarts(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) if (text[index] === '\n') starts.push(index + 1);
  return starts;
}

export function locationAt(starts, offset) {
  let low = 0;
  let high = starts.length;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (starts[middle] <= offset) low = middle;
    else high = middle;
  }
  return { line: low + 1, column: offset - starts[low] + 1 };
}

export function reportEntry({
  textStarts,
  file,
  offset,
  origin,
  upstreamTag,
  upstreamMember = null,
  action,
  target = null,
  warningCode: code = null,
  behaviorReviewFlags = null,
  message,
}) {
  const location = locationAt(textStarts, offset);
  const entry = {
    file,
    line: location.line,
    column: location.column,
    origin,
    upstreamTag,
    upstreamMember,
    action,
    target,
    warningCode: code,
    message,
  };
  if (behaviorReviewFlags?.length) {
    entry.behaviorReviewFlags = Object.freeze([...behaviorReviewFlags]);
  }
  return entry;
}

export function commentRanges(text) {
  const ranges = [];
  let index = 0;
  while (index < text.length) {
    if (text.startsWith('<!--', index)) {
      const finish = htmlCommentEnd(text, index);
      ranges.push([index, finish]);
      index = finish;
      continue;
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      const finish = end < 0 ? text.length : end + 2;
      ranges.push([index, finish]);
      index = finish;
      continue;
    }
    if (text.startsWith('//', index)) {
      const end = text.indexOf('\n', index + 2);
      const finish = end < 0 ? text.length : end;
      ranges.push([index, finish]);
      index = finish;
      continue;
    }
    if (text[index] === '"' || text[index] === "'" || text[index] === '`') {
      const quote = text[index++];
      while (index < text.length) {
        if (text[index] === '\\') index += 2;
        else if (text[index] === quote) {
          index += 1;
          break;
        } else index += 1;
      }
      continue;
    }
    index += 1;
  }
  return ranges;
}

export function insideRanges(offset, ranges) {
  return ranges.some(([start, end]) => offset >= start && offset < end);
}

export function quotedRangeContaining(text, offset) {
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (character !== '"' && character !== "'" && character !== '`') {
      index += 1;
      continue;
    }
    const start = index;
    const quote = character;
    index += 1;
    while (index < text.length) {
      if (text[index] === '\\') index += 2;
      else if (text[index] === quote) {
        index += 1;
        break;
      } else index += 1;
    }
    if (offset >= start && offset < index) return [start, index];
  }
  return null;
}

export function htmlTemplateStyleRanges(text) {
  const ranges = [];
  for (const match of text.matchAll(/<style(?:\s[^>]*)?>(?<body>[\s\S]*?)<\/style\s*>/gi)) {
    const quoted = quotedRangeContaining(text, match.index);
    if (!quoted || text[quoted[0]] !== '`') continue;
    if (!/\bhtml\s*$/.test(text.slice(0, quoted[0]))) continue;
    if (insideTemplateExpression(text, quoted[0], match.index)) continue;
    const bodyStart = match.index + match[0].indexOf(match.groups.body);
    ranges.push([bodyStart, bodyStart + match.groups.body.length]);
  }
  return ranges;
}

export function insideTemplateExpression(text, templateStart, offset) {
  let expressionDepth = 0;
  for (let index = templateStart + 1; index < offset; index += 1) {
    if (text[index] === '\\') {
      index += 1;
      continue;
    }
    if (expressionDepth === 0) {
      if (text.startsWith('${', index)) {
        expressionDepth = 1;
        index += 1;
      } else if (text[index] === '`') {
        return false;
      }
      continue;
    }
    if (text[index] === '"' || text[index] === "'") {
      const quote = text[index];
      index += 1;
      while (index < offset && text[index] !== quote) {
        if (text[index] === '\\') index += 1;
        index += 1;
      }
      continue;
    }
    if (text.startsWith('//', index)) {
      const end = text.indexOf('\n', index + 2);
      index = end < 0 || end >= offset ? offset : end;
      continue;
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      index = end < 0 || end >= offset ? offset : end + 1;
      continue;
    }
    if (text[index] === '{') expressionDepth += 1;
    else if (text[index] === '}') expressionDepth = Math.max(0, expressionDepth - 1);
  }
  return expressionDepth > 0;
}

export function findTagEnd(text, start) {
  let quote = null;
  let braces = 0;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') braces += 1;
    else if (character === '}') braces = Math.max(0, braces - 1);
    else if (character === '>' && braces === 0) return index;
  }
  return -1;
}

export function scanMarkupTags(text, ignoredRanges) {
  const tokens = [];
  const regex = /<(?<closing>\/)?(?<tag>(?:wa|sl)-[a-z][a-z0-9-]*)(?=[\s/>])/g;
  for (const match of text.matchAll(regex)) {
    if (insideRanges(match.index, ignoredRanges)) continue;
    const closing = Boolean(match.groups.closing);
    const nameStart = match.index + 1 + (closing ? 1 : 0);
    const end = findTagEnd(text, match.index + match[0].length);
    if (end < 0) continue;
    tokens.push({
      tag: match.groups.tag,
      start: match.index,
      nameStart,
      nameEnd: nameStart + match.groups.tag.length,
      end,
      closing,
      selfClosing: !closing && /\/\s*>$/.test(text.slice(match.index, end + 1)),
    });
  }
  return tokens;
}

export function scanAllOpeningTags(text, ignoredRanges, inside = (offset) => insideRanges(offset, ignoredRanges)) {
  const tokens = [];
  const regex = /<(?<tag>[a-z][a-z0-9.-]*)(?=[\s/>])/gi;
  for (const match of text.matchAll(regex)) {
    if (inside(match.index)) continue;
    const end = findTagEnd(text, match.index + match[0].length);
    if (end < 0) continue;
    const nameStart = match.index + 1;
    tokens.push({
      tag: match.groups.tag,
      start: match.index,
      nameStart,
      nameEnd: nameStart + match.groups.tag.length,
      end,
      closing: false,
      selfClosing: /\/\s*>$/.test(text.slice(match.index, end + 1)),
    });
  }
  return tokens;
}

const DOM_FACTORY_CONSTRUCTION = 'construction';
const DOM_FACTORY_LOOKUP = 'lookup';
const JS_IDENTIFIER = '[$A-Z_a-z][$\\w]*';

function normalizedMemberExpression(value) {
  let expression = value.trim();
  while (expression.startsWith('(') && skipBalanced(expression, 0, '(', ')') === expression.length) {
    expression = expression.slice(1, -1).trim();
  }
  return expression
    .replace(/\?\.\s*\[\s*(['"])([$A-Z_a-z][$\w]*)\1\s*\]/g, '.$2')
    .replace(/\[\s*(['"])([$A-Z_a-z][$\w]*)\1\s*\]/g, '.$2')
    .replace(/\s*(?:\?\.|\.)\s*/g, '.');
}

function memberExpressionPattern(expression) {
  const [root, ...members] = expression.split('.');
  const wrapped = (pattern) =>
    `(?:${pattern}\\s*!?|\\(\\s*${pattern}\\s+as\\s+[^;\\n]+?\\)\\s*!?)`;
  return members.reduce((pattern, member) => {
    const escaped = regexEscape(member);
    return wrapped(
      `${pattern}(?:\\s*(?:\\.|\\?\\.)\\s*${escaped}` +
      `|\\s*(?:\\?\\.)?\\s*\\[\\s*(?:'${escaped}'|"${escaped}"|\\x60${escaped}\\x60)\\s*\\])`,
    );
  }, wrapped(regexEscape(root)));
}

function canonicalFactoryExpression(value, callees) {
  const normalized = normalizedMemberExpression(value);
  if (callees.has(normalized)) return normalized;
  const source = value.trim();
  for (const candidate of callees.keys()) {
    if (new RegExp(`^(?:${memberExpressionPattern(candidate)})$`).test(source)) return candidate;
  }
  return normalized;
}

function classifyFactoryExpression(
  value,
  bindings,
  documentReferences,
  registryReferences,
  bareCreateElementAvailable = true,
) {
  let expression = normalizedMemberExpression(value);
  const bound = expression.match(/^(?<target>.+)\.bind\s*\([^()]*\)$/s);
  if (bound) expression = normalizedMemberExpression(bound.groups.target);
  if (bindings.has(expression)) return bindings.get(expression);
  if (expression === 'createElement' && bareCreateElementAvailable) {
    return DOM_FACTORY_CONSTRUCTION;
  }
  for (const reference of documentReferences) {
    if (expression === `${reference}.createElement`) return DOM_FACTORY_CONSTRUCTION;
  }
  for (const reference of registryReferences) {
    if (expression === `${reference}.get` || expression === `${reference}.whenDefined`) {
      return DOM_FACTORY_LOOKUP;
    }
  }
  return null;
}

function classifyFactoryInitializer(
  value,
  bindings,
  documentReferences,
  registryReferences,
  bareCreateElementAvailable = true,
) {
  const direct = classifyFactoryExpression(
    value,
    bindings,
    documentReferences,
    registryReferences,
    bareCreateElementAvailable,
  );
  if (direct) return direct;
  const arrow = value.match(
    new RegExp(
      `^(?:async\\s+)?(?:\\(\\s*(?<parameter>${JS_IDENTIFIER})[^)]*\\)|(?<bare>${JS_IDENTIFIER}))\\s*=>\\s*(?<body>.+)$`,
      's',
    ),
  );
  if (!arrow) return null;
  const parameter = arrow.groups.parameter ?? arrow.groups.bare;
  const body = arrow.groups.body.trim().replace(/^\{\s*return\s+/, '').replace(/\s*\}$/, '').trim();
  const call = body.match(
    new RegExp(
      `^(?<factory>${JS_IDENTIFIER}(?:\\s*\\.\\s*${JS_IDENTIFIER})*)\\s*` +
        `\\(\\s*${regexEscape(parameter)}\\s*\\)$`,
    ),
  );
  return call
    ? classifyFactoryExpression(
        call.groups.factory,
        bindings,
        documentReferences,
        registryReferences,
        bareCreateElementAvailable,
      )
    : null;
}

function parseDestructuredBindings(source) {
  const bindings = [];
  for (const rawEntry of source.split(',')) {
    const entry = rawEntry.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n\r]*/g, '').trim();
    if (!entry || entry.startsWith('...')) continue;
    const match = entry.match(
      new RegExp(`^(?<property>${JS_IDENTIFIER})(?:\\s*:\\s*(?<local>${JS_IDENTIFIER}))?(?:\\s*=.*)?$`),
    );
    if (match) bindings.push({ property: match.groups.property, local: match.groups.local ?? match.groups.property });
  }
  return bindings;
}

function codeBraceRanges(text) {
  const stack = [];
  const ranges = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text.startsWith('//', index)) {
      const end = text.indexOf('\n', index + 2);
      index = end < 0 ? text.length : end;
      continue;
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      index = end < 0 ? text.length : end + 1;
      continue;
    }
    const character = text[index];
    if (character === '"' || character === "'" || character === '`') {
      const quote = character;
      index += 1;
      while (index < text.length) {
        if (text[index] === '\\') index += 2;
        else if (text[index] === quote) break;
        else index += 1;
      }
      continue;
    }
    if (character === '{') stack.push(index);
    else if (character === '}' && stack.length > 0) {
      ranges.push([stack.pop(), index + 1]);
    }
  }
  return ranges;
}

function identifierAppears(source, name) {
  return new RegExp(`(?<![$\\w])${regexEscape(name)}(?![$\\w])`).test(source);
}

function enclosingBraceRange(braceRanges, offset, textLength) {
  let enclosing = null;
  for (const range of braceRanges) {
    if (range[0] >= offset || range[1] <= offset) continue;
    if (!enclosing || range[1] - range[0] < enclosing[1] - enclosing[0]) enclosing = range;
  }
  return enclosing ?? [0, textLength];
}

function topLevelIndex(source, wanted) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const stack = [];
  let quote = null;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (Object.hasOwn(pairs, character)) stack.push(pairs[character]);
    else if (stack.at(-1) === character) stack.pop();
    else if (stack.length === 0 && character === wanted) return index;
  }
  return -1;
}

function parameterListBindsName(parameters, name) {
  let rest = parameters;
  while (rest) {
    const comma = topLevelIndex(rest, ',');
    const parameter = (comma < 0 ? rest : rest.slice(0, comma)).trim();
    const equals = topLevelIndex(parameter, '=');
    const binding = (equals < 0 ? parameter : parameter.slice(0, equals)).trim();
    const restBinding = binding.replace(/^\.\.\.\s*/, '');
    if (
      new RegExp(
        `^(?:(?:public|private|protected|readonly|override)\\s+)*(?:\\.\\.\\.\\s*)?` +
          `${regexEscape(name)}(?=\\s*(?:[?:]|$))`,
      ).test(binding) ||
      ((restBinding.startsWith('{') || restBinding.startsWith('[')) && identifierAppears(restBinding, name))
    ) {
      return true;
    }
    if (comma < 0) break;
    rest = rest.slice(comma + 1);
  }
  return false;
}

function nextCodeIndex(text, start) {
  let index = start;
  while (index < text.length) {
    if (/\s/.test(text[index])) {
      index += 1;
      continue;
    }
    if (text.startsWith('//', index)) {
      const end = text.indexOf('\n', index + 2);
      index = end < 0 ? text.length : end + 1;
      continue;
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      index = end < 0 ? text.length : end + 2;
      continue;
    }
    break;
  }
  return index;
}

function matchingTypeParameterEnd(text, start) {
  let depth = 0;
  let quote = null;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (text.startsWith('//', index)) {
      const end = text.indexOf('\n', index + 2);
      index = end < 0 ? text.length : end;
      continue;
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      index = end < 0 ? text.length : end + 1;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '<') depth += 1;
    else if (character === '>' && text[index - 1] !== '=') {
      depth -= 1;
      if (depth === 0) return index;
      if (depth < 0) return -1;
    }
  }
  return -1;
}

function stripTrailingTypeParameters(text) {
  const value = text.trimEnd();
  if (!value.endsWith('>')) return value;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '<' || quotedRangeContaining(value, index)) continue;
    if (matchingTypeParameterEnd(value, index) === value.length - 1) {
      return value.slice(0, index).trimEnd();
    }
  }
  return value;
}

function scanCallableScopes(text, ignoredRanges, braceRanges) {
  const scopes = [];
  const remember = (parameters, body, parameterRange) => {
    if (!body) return;
    const key = `${body[0]}:${body[1]}:${parameters}`;
    if (!scopes.some((scope) => scope.key === key)) {
      scopes.push({ key, parameters, parameterRange, body });
    }
  };

  for (let open = text.indexOf('('); open >= 0; open = text.indexOf('(', open + 1)) {
    if (insideRanges(open, ignoredRanges) || quotedRangeContaining(text, open)) continue;
    const closeAfter = skipBalanced(text, open, '(', ')');
    if (closeAfter <= open + 1 || closeAfter > text.length) continue;
    const close = closeAfter - 1;
    const prefix = text.slice(Math.max(0, open - 200), open);
    const callablePrefix = stripTrailingTypeParameters(prefix);
    const functionLike = /\bfunction(?:\s*\*)?(?:\s+[$A-Z_a-z][$\w]*)?\s*$/s.test(callablePrefix);
    const methodMatch = callablePrefix.match(
      /(?:^|[;{}\n])\s*(?:(?:public|private|protected|static|abstract|async|override|get|set)\s+)*(?:\*\s*)?(?<name>[$A-Z_a-z][$\w]*|constructor|\[['"][^'"\n]+['"]\])\s*$/s,
    );
    const methodLike = Boolean(
      methodMatch && !new Set(['catch', 'for', 'if', 'switch', 'while', 'with']).has(methodMatch.groups.name),
    );
    const suffix = text.slice(closeAfter, Math.min(text.length, closeAfter + 500));
    const arrow = suffix.match(/^\s*(?::[\s\S]*?)?=>/);
    let body = null;
    if (arrow) {
      const bodyStart = nextCodeIndex(text, closeAfter + arrow[0].length);
      body = text[bodyStart] === '{'
        ? braceRanges.find(([start]) => start === bodyStart) ?? null
        : [bodyStart, simpleStatementEnd(text, bodyStart)];
    } else if (functionLike || methodLike) {
      const bodyStart = nextCodeIndex(text, closeAfter);
      const openingBrace = text[bodyStart] === '{'
        ? bodyStart
        : text.indexOf('{', bodyStart);
      const boundary = text.slice(bodyStart, openingBrace < 0 ? text.length : openingBrace);
      if (openingBrace >= 0 && !/[;=]/.test(boundary)) {
        body = braceRanges.find(([start]) => start === openingBrace) ?? null;
      }
    }
    remember(text.slice(open + 1, close), body, [open + 1, close]);
    open = close;
  }

  const bareArrow = new RegExp(`(?<![$\\w])(?<parameter>${JS_IDENTIFIER})\\s*=>`, 'g');
  for (const match of text.matchAll(bareArrow)) {
    if (insideRanges(match.index, ignoredRanges) || quotedRangeContaining(text, match.index)) continue;
    const bodyStart = nextCodeIndex(text, match.index + match[0].length);
    const body = text[bodyStart] === '{'
      ? braceRanges.find(([start]) => start === bodyStart) ?? null
      : [bodyStart, simpleStatementEnd(text, bodyStart)];
    remember(
      match.groups.parameter,
      body,
      [match.index, match.index + match.groups.parameter.length],
    );
  }
  return scopes;
}

function enclosingFunctionRange(callableScopes, offset, textLength) {
  let enclosing = null;
  for (const { body } of callableScopes) {
    if (body[0] >= offset || body[1] <= offset) continue;
    if (!enclosing || body[1] - body[0] < enclosing[1] - enclosing[0]) enclosing = body;
  }
  return enclosing ?? [0, textLength];
}

function sameRange(left, right) {
  return Boolean(left && right && left[0] === right[0] && left[1] === right[1]);
}

function identifierShadowRanges(text, name, ignoredRanges, braceRanges, callableScopes) {
  const ranges = [];
  const escaped = regexEscape(name);
  const addBodyRange = (match, bodyStart) => {
    if (insideRanges(match.index, ignoredRanges) || quotedRangeContaining(text, match.index)) return;
    const body = braceRanges.find(([start]) => start === bodyStart);
    if (body) ranges.push(body);
  };

  const declarationPattern = new RegExp(
    `\\b(?<kind>const|let|var|function|class)\\s+${escaped}(?![$\\w])`,
    'g',
  );
  for (const match of text.matchAll(declarationPattern)) {
    if (insideRanges(match.index, ignoredRanges) || quotedRangeContaining(text, match.index)) continue;
    // Treat block function declarations as function-scoped too. Modules use lexical block
    // semantics, while sloppy scripts may apply Annex B hoisting; the wider range fails closed in
    // both inputs instead of rewriting a possibly shadowed DOM global.
    ranges.push(match.groups.kind === 'var' || match.groups.kind === 'function'
      ? enclosingFunctionRange(callableScopes, match.index, text.length)
      : enclosingBraceRange(braceRanges, match.index, text.length));
  }
  const destructuringPattern = /\b(?<kind>const|let|var)\s*\{(?<bindings>[^{}\n]+)\}/g;
  for (const match of text.matchAll(destructuringPattern)) {
    if (insideRanges(match.index, ignoredRanges) || quotedRangeContaining(text, match.index)) continue;
    if (!parseDestructuredBindings(match.groups.bindings).some(({ local }) => local === name)) continue;
    ranges.push(match.groups.kind === 'var'
      ? enclosingFunctionRange(callableScopes, match.index, text.length)
      : enclosingBraceRange(braceRanges, match.index, text.length));
  }
  const importPattern = /\bimport\s+(?<clause>[^'";\n]+?)\s+from\s*['"]/g;
  for (const match of text.matchAll(importPattern)) {
    if (insideRanges(match.index, ignoredRanges) || quotedRangeContaining(text, match.index)) continue;
    const clause = match.groups.clause.trim().replace(/^type\s+/, '');
    const locals = [];
    const defaultBinding = clause.match(new RegExp(`^(?<local>${JS_IDENTIFIER})(?:\\s*,|$)`));
    if (defaultBinding) locals.push(defaultBinding.groups.local);
    const namespaceBinding = clause.match(new RegExp(`\\*\\s+as\\s+(?<local>${JS_IDENTIFIER})`));
    if (namespaceBinding) locals.push(namespaceBinding.groups.local);
    const namedBindings = clause.match(/\{(?<bindings>[\s\S]*?)\}/)?.groups.bindings;
    if (namedBindings) locals.push(...parseNamedModuleBindings(namedBindings).map(({ local }) => local));
    if (locals.includes(name)) ranges.push([0, text.length]);
  }

  for (const callable of callableScopes) {
    if (parameterListBindsName(callable.parameters, name)) {
      ranges.push(callable.parameterRange, callable.body);
    }
  }

  const catchPattern = /\bcatch\s*\(/g;
  for (const match of text.matchAll(catchPattern)) {
    if (insideRanges(match.index, ignoredRanges) || quotedRangeContaining(text, match.index)) continue;
    const open = match.index + match[0].lastIndexOf('(');
    const closeAfter = skipBalanced(text, open, '(', ')');
    if (closeAfter <= open + 1 || closeAfter > text.length) continue;
    const binding = text.slice(open + 1, closeAfter - 1);
    if (!parameterListBindsName(binding, name)) continue;
    const bodyStart = nextCodeIndex(text, closeAfter);
    if (text[bodyStart] === '{') addBodyRange(match, bodyStart);
  }
  return ranges;
}

function identifierIsShadowedAt(shadowRanges, name, offset) {
  return (shadowRanges.get(name) ?? []).some(([start, end]) => offset >= start && offset < end);
}

function innermostShadowRange(shadowRanges, name, offset) {
  let innermost = null;
  for (const range of shadowRanges.get(name) ?? []) {
    if (offset < range[0] || offset >= range[1]) continue;
    if (!innermost || range[1] - range[0] < innermost[1] - innermost[0]) innermost = range;
  }
  return innermost;
}

function visibleReferencesAt(references, referenceScopes, shadowRanges, offset) {
  return new Set(
    [...references].filter((reference) => {
      const root = reference.split('.')[0];
      const shadow = innermostShadowRange(shadowRanges, root, offset);
      return (referenceScopes.get(reference) ?? []).some((record) =>
        offset >= record.scope[0] && offset < record.scope[1] &&
        (record.global ? !shadow : sameRange(record.scope, shadow)));
    }),
  );
}

function declarationScope(kind, offset, braceRanges, callableScopes, textLength) {
  return kind === 'var'
    ? enclosingFunctionRange(callableScopes, offset, textLength)
    : enclosingBraceRange(braceRanges, offset, textLength);
}

function addScopedRecord(table, name, record) {
  const records = table.get(name) ?? [];
  if (records.some((candidate) =>
    candidate.kind === record.kind &&
    candidate.declarationIndex === record.declarationIndex &&
    sameRange(candidate.scope, record.scope))) {
    return false;
  }
  records.push(record);
  table.set(name, records);
  return true;
}

function visibleBindingRecord(factoryAnalysis, name, offset) {
  const shadow = innermostShadowRange(factoryAnalysis.shadowRanges, name.split('.')[0], offset);
  return (factoryAnalysis.bindingScopes.get(name) ?? [])
    .filter((record) =>
      offset >= record.scope[0] && offset < record.scope[1] &&
      (record.global ? !shadow : sameRange(record.scope, shadow)))
    .sort((left, right) =>
      left.scope[1] - left.scope[0] - (right.scope[1] - right.scope[0]) ||
      right.declarationIndex - left.declarationIndex)[0]
    ?? null;
}

function visibleBindingsAt(bindings, bindingScopes, shadowRanges, offset) {
  const analysis = { bindingScopes, shadowRanges };
  return new Map(
    [...bindings].filter(([name]) => visibleBindingRecord(analysis, name, offset)),
  );
}

function scanLocalDomFactoryBindings(text, ignoredRanges, seededBindings = new Map()) {
  const bindings = new Map(seededBindings);
  const bindingScopes = new Map();
  const documentReferences = new Set(['document', 'window.document', 'globalThis.document']);
  const registryReferences = new Set(['customElements', 'window.customElements', 'globalThis.customElements']);
  const documentReferenceScopes = new Map();
  const registryReferenceScopes = new Map();
  const moduleScope = [0, text.length];
  for (const reference of documentReferences) {
    addScopedRecord(documentReferenceScopes, reference, {
      scope: moduleScope,
      declarationIndex: -1,
      global: true,
    });
  }
  for (const reference of registryReferences) {
    addScopedRecord(registryReferenceScopes, reference, {
      scope: moduleScope,
      declarationIndex: -1,
      global: true,
    });
  }
  const braceRanges = codeBraceRanges(text);
  const callableScopes = scanCallableScopes(text, ignoredRanges, braceRanges);
  const declarationPattern = new RegExp(
    `\\b(?<declarationKind>const|let|var)\\s+(?<name>${JS_IDENTIFIER})` +
      `(?:\\s*:[^=;\\n]+)?\\s*=\\s*(?<rhs>[^;\\n]+)`,
    'g',
  );
  const declarations = [...text.matchAll(declarationPattern)].filter(
    (match) => !insideRanges(match.index, ignoredRanges) && !quotedRangeContaining(text, match.index),
  );
  const destructuringPattern = /\b(?<declarationKind>const|let|var)\s*\{(?<bindings>[^{}\n]+)\}\s*=\s*(?<source>[$A-Z_a-z][$\w]*(?:\s*\.\s*[$A-Z_a-z][$\w]*)*)/g;
  const destructurings = [...text.matchAll(destructuringPattern)].filter(
    (match) => !insideRanges(match.index, ignoredRanges) && !quotedRangeContaining(text, match.index),
  );
  const functionPattern = new RegExp(
    `\\bfunction\\s+(?<name>${JS_IDENTIFIER})\\s*\\(\\s*(?<parameter>${JS_IDENTIFIER})[^)]*\\)\\s*\\{\\s*return\\s+(?<factory>${JS_IDENTIFIER}(?:\\s*\\.\\s*${JS_IDENTIFIER})*)\\s*\\(\\s*\\k<parameter>\\s*\\)\\s*;?\\s*\\}`,
    'g',
  );
  const functions = [...text.matchAll(functionPattern)].filter(
    (match) => !insideRanges(match.index, ignoredRanges) && !quotedRangeContaining(text, match.index),
  );

  const candidateNames = new Set([
    'createElement',
    'customElements',
    'document',
    'globalThis',
    'querySelector',
    'querySelectorAll',
    'window',
    ...[...seededBindings.keys()].map((name) => name.split('.')[0]),
    ...declarations.map((match) => match.groups.name),
    ...destructurings.flatMap((match) =>
      parseDestructuredBindings(match.groups.bindings).map(({ local }) => local)),
    ...functions.map((match) => match.groups.name),
  ]);
  const shadowRanges = new Map(
    [...candidateNames].map((name) => [
      name,
      identifierShadowRanges(text, name, ignoredRanges, braceRanges, callableScopes),
    ]),
  );
  for (const [name, kind] of seededBindings) {
    addScopedRecord(bindingScopes, name, {
      kind,
      scope: moduleScope,
      declarationIndex: -1,
      declarationEnd: 0,
      declarationKind: 'import',
    });
  }

  const bindingPasses = Math.max(2, declarations.length + destructurings.length + functions.length + 1);
  for (let pass = 0; pass < bindingPasses; pass += 1) {
    let changed = false;
    for (const declaration of declarations) {
      const name = declaration.groups.name;
      const rhs = normalizedMemberExpression(declaration.groups.rhs);
      const scope = declarationScope(
        declaration.groups.declarationKind,
        declaration.index,
        braceRanges,
        callableScopes,
        text.length,
      );
      const visibleDocuments = visibleReferencesAt(
        documentReferences,
        documentReferenceScopes,
        shadowRanges,
        declaration.index,
      );
      const visibleRegistries = visibleReferencesAt(
        registryReferences,
        registryReferenceScopes,
        shadowRanges,
        declaration.index,
      );
      if (visibleDocuments.has(rhs)) {
        documentReferences.add(name);
        changed = addScopedRecord(documentReferenceScopes, name, {
          scope,
          declarationIndex: declaration.index,
        }) || changed;
      }
      if (visibleRegistries.has(rhs)) {
        registryReferences.add(name);
        changed = addScopedRecord(registryReferenceScopes, name, {
          scope,
          declarationIndex: declaration.index,
        }) || changed;
      }
      const visibleBindings = visibleBindingsAt(
        bindings,
        bindingScopes,
        shadowRanges,
        declaration.index,
      );
      const kind = classifyFactoryInitializer(
        rhs,
        visibleBindings,
        visibleDocuments,
        visibleRegistries,
        !identifierIsShadowedAt(shadowRanges, 'createElement', declaration.index),
      );
      if (kind) {
        bindings.set(name, kind);
        changed = addScopedRecord(bindingScopes, name, {
          kind,
          scope,
          declarationIndex: declaration.index,
          declarationEnd: declaration.index + declaration[0].length,
          declarationKind: declaration.groups.declarationKind,
        }) || changed;
      }

    }

    for (const destructuring of destructurings) {
      const source = normalizedMemberExpression(destructuring.groups.source);
      const scope = declarationScope(
        destructuring.groups.declarationKind,
        destructuring.index,
        braceRanges,
        callableScopes,
        text.length,
      );
      const fromDocument = visibleReferencesAt(
        documentReferences,
        documentReferenceScopes,
        shadowRanges,
        destructuring.index,
      ).has(source);
      const fromRegistry = visibleReferencesAt(
        registryReferences,
        registryReferenceScopes,
        shadowRanges,
        destructuring.index,
      ).has(source);
      if (!fromDocument && !fromRegistry) continue;
      for (const binding of parseDestructuredBindings(destructuring.groups.bindings)) {
        const kind = fromDocument && binding.property === 'createElement'
          ? DOM_FACTORY_CONSTRUCTION
          : fromRegistry && (binding.property === 'get' || binding.property === 'whenDefined')
            ? DOM_FACTORY_LOOKUP
            : null;
        if (kind) {
          bindings.set(binding.local, kind);
          changed = addScopedRecord(bindingScopes, binding.local, {
            kind,
            scope,
            declarationIndex: destructuring.index,
            declarationEnd: destructuring.index + destructuring[0].length,
            declarationKind: destructuring.groups.declarationKind,
          }) || changed;
        }
      }
    }

    for (const match of functions) {
      const visibleDocuments = visibleReferencesAt(
        documentReferences,
        documentReferenceScopes,
        shadowRanges,
        match.index,
      );
      const visibleRegistries = visibleReferencesAt(
        registryReferences,
        registryReferenceScopes,
        shadowRanges,
        match.index,
      );
      const kind = classifyFactoryExpression(
        match.groups.factory,
        visibleBindingsAt(bindings, bindingScopes, shadowRanges, match.index),
        visibleDocuments,
        visibleRegistries,
        !identifierIsShadowedAt(shadowRanges, 'createElement', match.index),
      );
      if (kind) {
        const scope = enclosingFunctionRange(callableScopes, match.index, text.length);
        bindings.set(match.groups.name, kind);
        changed = addScopedRecord(bindingScopes, match.groups.name, {
          kind,
          scope,
          declarationIndex: match.index,
          declarationEnd: match.index + match[0].length,
          declarationKind: 'function',
        }) || changed;
      }
    }
    if (!changed) break;
  }
  const moduleBindings = new Map();
  for (const [name, records] of bindingScopes) {
    const record = records.find(({ scope }) => sameRange(scope, moduleScope));
    if (record) moduleBindings.set(name, record.kind);
  }
  return {
    bindings,
    bindingScopes,
    moduleBindings,
    documentReferences,
    documentReferenceScopes,
    registryReferences,
    registryReferenceScopes,
    shadowRanges,
  };
}

function assignedConstructionAlias(text, callStart) {
  const boundary = Math.max(
    text.lastIndexOf(';', callStart - 1),
    text.lastIndexOf('{', callStart - 1),
    text.lastIndexOf('}', callStart - 1),
  );
  const prefix = text.slice(boundary + 1, callStart);
  const match = prefix.match(
    new RegExp(`\\b(?:export\\s+)?(?:const|let|var)\\s+(?<alias>${JS_IDENTIFIER})(?:\\s*:[^=]+)?\\s*=\\s*$`, 's'),
  );
  return match?.groups.alias ?? null;
}

function bindingIsStableBefore(text, name, callStart, expectedKind, factoryAnalysis) {
  const record = visibleBindingRecord(factoryAnalysis, name, callStart);
  if (!record || record.kind !== expectedKind) return false;
  if (!new Set(['const', 'function', 'import']).has(record.declarationKind)) return false;
  if (record.declarationKind === 'const' && callStart < record.declarationEnd) return false;
  const start = Math.max(record.declarationEnd ?? 0, record.scope[0]);
  const intervening = text.slice(start, callStart);
  const pattern = new RegExp(`(?<![$\\w.])${regexEscape(name)}\\s*=(?!=|>)`, 'g');
  const comments = commentRanges(intervening);
  return ![...intervening.matchAll(pattern)].some((match) =>
    !insideRanges(match.index, comments) &&
    !quotedRangeContaining(intervening, match.index) &&
    sameRange(
      record.scope,
      innermostShadowRange(factoryAnalysis.shadowRanges, name.split('.')[0], start + match.index),
    ));
}

function scanFactoryTagReferences(text, ignoredRanges, factoryAnalysis) {
  const callees = new Map(factoryAnalysis.bindings);
  callees.set('createElement', DOM_FACTORY_CONSTRUCTION);
  for (const reference of factoryAnalysis.documentReferences) {
    callees.set(`${reference}.createElement`, DOM_FACTORY_CONSTRUCTION);
  }
  for (const reference of factoryAnalysis.registryReferences) {
    callees.set(`${reference}.get`, DOM_FACTORY_LOOKUP);
    callees.set(`${reference}.whenDefined`, DOM_FACTORY_LOOKUP);
  }
  const alternatives = [...callees.keys()]
    .sort((left, right) => right.length - left.length)
    .map(memberExpressionPattern)
    .join('|');
  if (!alternatives) return [];
  const pattern = new RegExp(
    `(?<![$\\w./])(?<api>(?:\\(\\s*(?:${alternatives})\\s*\\)|(?:${alternatives})))(?![$\\w])` +
      `(?:\\s*\\.\\s*bind\\s*\\([^()]*\\))?\\s*(?:<[^>\\n]+>)?\\s*` +
      `(?:(?:\\?\\.)?\\s*\\(\\s*|\\.\\s*call\\s*\\(\\s*[^,()]+\\s*,\\s*)` +
      `(?<quote>['"\\x60])(?<tag>(?:wa|sl)-[a-z][a-z0-9-]*)\\k<quote>`,
    'g',
  );
  const references = [];
  for (const match of text.matchAll(pattern)) {
    const relative = match[0].lastIndexOf(match.groups.tag);
    const start = match.index + relative;
    if (insideRanges(match.index, ignoredRanges) || insideRanges(start, ignoredRanges)) continue;
    const tagQuote = quotedRangeContaining(text, start);
    const calleeQuote = quotedRangeContaining(text, match.index);
    if (
      tagQuote && calleeQuote &&
      tagQuote[0] === calleeQuote[0] && tagQuote[1] === calleeQuote[1] &&
      (text[tagQuote[0]] !== '`' || !insideTemplateExpression(text, tagQuote[0], match.index))
    ) {
      continue;
    }
    const api = canonicalFactoryExpression(match.groups.api, callees);
    if (factoryAnalysis.bindings.has(api)) {
      if (!bindingIsStableBefore(text, api, match.index, callees.get(api), factoryAnalysis)) continue;
    } else if (api === 'createElement') {
      if (identifierIsShadowedAt(factoryAnalysis.shadowRanges, api, match.index)) continue;
    } else if (api.endsWith('.createElement')) {
      const reference = api.slice(0, -'.createElement'.length);
      const visibleDocuments = visibleReferencesAt(
        factoryAnalysis.documentReferences,
        factoryAnalysis.documentReferenceScopes,
        factoryAnalysis.shadowRanges,
        match.index,
      );
      if (!visibleDocuments.has(reference)) continue;
    } else if (api.endsWith('.get') || api.endsWith('.whenDefined')) {
      const suffix = api.endsWith('.get') ? '.get' : '.whenDefined';
      const reference = api.slice(0, -suffix.length);
      const visibleRegistries = visibleReferencesAt(
        factoryAnalysis.registryReferences,
        factoryAnalysis.registryReferenceScopes,
        factoryAnalysis.shadowRanges,
        match.index,
      );
      if (!visibleRegistries.has(reference)) continue;
    }
    const open = match.index + match[0].lastIndexOf('(', relative);
    const callEnd = skipBalanced(text, open, '(', ')');
    references.push({
      tag: match.groups.tag,
      start,
      end: start + match.groups.tag.length,
      callStart: match.index,
      callEnd: callEnd ?? match.index + match[0].length,
      resultAlias: assignedConstructionAlias(text, match.index),
      kind: callees.get(api),
    });
  }
  return references;
}

export function scanApiTagReferences(text, ignoredRanges, suppliedFactoryBindings = null) {
  const factoryAnalysis = scanLocalDomFactoryBindings(
    text,
    ignoredRanges,
    suppliedFactoryBindings ?? new Map(),
  );
  const references = scanFactoryTagReferences(text, ignoredRanges, factoryAnalysis);
  const lookupPattern = /(?<![$\w.])(?<api>(?:(?:window|globalThis)\.)?document\.querySelector(?:All)?|querySelector(?:All)?)\s*(?:<[^>\n]+>)?\(\s*(?<quote>['"])(?<tag>(?:wa|sl)-[a-z][a-z0-9-]*)\k<quote>/g;
  for (const match of text.matchAll(lookupPattern)) {
    if (insideRanges(match.index, ignoredRanges)) continue;
    if (match.groups.api.includes('document.')) {
      const reference = match.groups.api.replace(/\.querySelector(?:All)?$/, '');
      const visibleDocuments = visibleReferencesAt(
        factoryAnalysis.documentReferences,
        factoryAnalysis.documentReferenceScopes,
        factoryAnalysis.shadowRanges,
        match.index,
      );
      if (!visibleDocuments.has(reference)) continue;
    } else if (
      identifierIsShadowedAt(factoryAnalysis.shadowRanges, match.groups.api, match.index)
    ) {
      continue;
    }
    const relative = match[0].lastIndexOf(match.groups.tag);
    const start = match.index + relative;
    references.push({
      tag: match.groups.tag,
      start,
      end: start + match.groups.tag.length,
      callStart: match.index,
      callEnd: match.index + match[0].length,
      resultAlias: null,
      kind: DOM_FACTORY_LOOKUP,
    });
  }
  const unique = new Map();
  for (const reference of references) {
    unique.set(`${reference.start}:${reference.end}:${reference.kind}`, reference);
  }
  return [...unique.values()].sort((left, right) => left.start - right.start || left.end - right.end);
}

export function skipBalanced(text, start, open, close) {
  let depth = 0;
  let quote = null;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') quote = character;
    else if (character === open) depth += 1;
    else if (character === close && --depth === 0) return index + 1;
  }
  return text.length;
}

function constructionStatementEnd(text, callEnd) {
  const lineEnd = text.indexOf('\n', callEnd);
  const semicolon = text.indexOf(';', callEnd);
  const end = semicolon >= 0 && (lineEnd < 0 || semicolon < lineEnd)
    ? semicolon
    : lineEnd < 0
      ? text.length
      : lineEnd;
  const suffix = text.slice(callEnd, end).trim();
  if (suffix && !/^(?:!|as\s+[^;\n]+|satisfies\s+[^;\n]+)$/.test(suffix)) return null;
  return end < text.length ? end + 1 : end;
}

function skipMigrationTrivia(text, start) {
  let index = start;
  while (index < text.length) {
    if (/\s/.test(text[index]) || text[index] === ';') {
      index += 1;
      continue;
    }
    if (text.startsWith('//', index)) {
      const end = text.indexOf('\n', index + 2);
      index = end < 0 ? text.length : end + 1;
      continue;
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      index = end < 0 ? text.length : end + 2;
      continue;
    }
    break;
  }
  return index;
}

function containsIdentifierCode(text, name) {
  const pattern = new RegExp(`(?<![$\\w])${regexEscape(name)}(?![$\\w])`, 'y');
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (character === '"' || character === "'" || character === '`') {
      const quote = character;
      index += 1;
      while (index < text.length) {
        if (text[index] === '\\') index += 2;
        else if (text[index] === quote) {
          index += 1;
          break;
        } else index += 1;
      }
      continue;
    }
    if (text.startsWith('//', index)) {
      const end = text.indexOf('\n', index + 2);
      index = end < 0 ? text.length : end + 1;
      continue;
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      index = end < 0 ? text.length : end + 2;
      continue;
    }
    pattern.lastIndex = index;
    if (pattern.exec(text)) return true;
    index += 1;
  }
  return false;
}

function simpleStatementEnd(text, start) {
  const depths = { '(': 0, '[': 0, '{': 0 };
  const closes = { ')': '(', ']': '[', '}': '{' };
  let quote = null;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (text.startsWith('//', index)) {
      const end = text.indexOf('\n', index + 2);
      return end < 0 ? text.length : end + 1;
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      index = end < 0 ? text.length : end + 1;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (Object.hasOwn(depths, character)) depths[character] += 1;
    else if (Object.hasOwn(closes, character)) {
      const opening = closes[character];
      depths[opening] = Math.max(0, depths[opening] - 1);
    } else if (
      (character === ';' || character === '\n') &&
      depths['('] === 0 && depths['['] === 0 && depths['{'] === 0
    ) {
      return index + 1;
    }
  }
  return text.length;
}

function scanImmediateAliasWrite(text, start, alias) {
  const escapedAlias = regexEscape(alias);
  const source = text.slice(start);
  const attribute = source.match(
    new RegExp(
      `^${escapedAlias}\\s*\\.\\s*setAttribute\\s*\\(\\s*` +
        `(?<quote>['"])(?<member>[A-Za-z_:][-.A-Za-z0-9_:]*)\\k<quote>\\s*,`,
    ),
  );
  if (attribute) {
    const open = start + attribute[0].indexOf('(');
    const callEnd = skipBalanced(text, open, '(', ')');
    if (containsIdentifierCode(text.slice(open + 1, callEnd - 1), alias)) return null;
    const next = simpleStatementEnd(text, callEnd);
    if (text.slice(callEnd, next).replace(/[;\s]/g, '')) return null;
    return { member: attribute.groups.member, kind: 'attribute', next };
  }

  const dotProperty = source.match(
    new RegExp(`^${escapedAlias}\\s*\\.\\s*(?<member>${JS_IDENTIFIER})\\s*=(?!=|>)`),
  );
  const bracketProperty = dotProperty
    ? null
    : source.match(
      new RegExp(
        `^${escapedAlias}\\s*\\[\\s*(?<quote>['"])(?<member>[^'"]+)\\k<quote>\\s*\\]\\s*=(?!=|>)`,
      ),
    );
  const property = dotProperty ?? bracketProperty;
  if (!property) return null;
  const next = simpleStatementEnd(text, start + property[0].length);
  const rightHandSide = text.slice(start + property[0].length, next);
  if (containsIdentifierCode(rightHandSide, alias)) return null;
  return { member: property.groups.member, kind: 'property', next };
}

function defaultWriteMatches(rule, write) {
  const variants = new Set([rule.member, kebabCase(rule.member), camelCase(rule.member)]);
  if (write.kind === 'attribute') {
    const name = write.member.toLowerCase();
    return [...variants].some((variant) => variant.toLowerCase() === name);
  }
  return variants.has(write.member);
}

export function assessImperativeDefaults(text, reference, defaults) {
  if (!reference.resultAlias) return { safe: false, missing: defaults };
  let cursor = constructionStatementEnd(text, reference.callEnd);
  if (cursor === null) return { safe: false, missing: defaults };
  const missing = new Set(defaults);
  for (let writes = 0; writes < 64 && missing.size > 0; writes += 1) {
    cursor = skipMigrationTrivia(text, cursor);
    const write = scanImmediateAliasWrite(text, cursor, reference.resultAlias);
    if (!write) break;
    for (const rule of missing) {
      if (defaultWriteMatches(rule, write)) missing.delete(rule);
    }
    cursor = write.next;
  }
  return { safe: missing.size === 0, missing: [...missing] };
}

export function parseTagAttributes(text, token) {
  const records = [];
  let index = token.nameEnd;
  while (index < token.end) {
    while (/\s/.test(text[index] ?? '')) index += 1;
    if (index >= token.end || text[index] === '/') break;
    if (text[index] === '{') {
      index = skipBalanced(text, index, '{', '}');
      continue;
    }
    const nameStart = index;
    while (index < token.end && !/[\s=/>]/.test(text[index])) index += 1;
    const nameEnd = index;
    if (nameEnd === nameStart) {
      index += 1;
      continue;
    }
    while (/\s/.test(text[index] ?? '')) index += 1;
    let valueKind = 'boolean';
    let valueStart = null;
    let valueEnd = null;
    if (text[index] === '=') {
      index += 1;
      while (/\s/.test(text[index] ?? '')) index += 1;
      if (text[index] === '"' || text[index] === "'") {
        const quote = text[index++];
        valueKind = 'literal';
        valueStart = index;
        while (index < token.end && text[index] !== quote) {
          if (text[index] === '\\') index += 1;
          index += 1;
        }
        valueEnd = index;
        if (text[index] === quote) index += 1;
      } else if (text[index] === '{') {
        valueKind = 'expression';
        valueStart = index;
        index = skipBalanced(text, index, '{', '}');
        valueEnd = index;
      } else {
        valueKind = 'literal';
        valueStart = index;
        while (index < token.end && !/[\s>]/.test(text[index])) index += 1;
        valueEnd = index;
      }
    }
    records.push({
      rawName: text.slice(nameStart, nameEnd),
      nameStart,
      nameEnd,
      valueKind,
      valueStart,
      valueEnd,
      value: valueStart === null ? null : text.slice(valueStart, valueEnd),
    });
  }
  return records;
}

export function kebabCase(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replaceAll('_', '-').toLowerCase();
}

export function camelCase(name) {
  return name.replace(/-([a-z0-9])/g, (_match, letter) => letter.toUpperCase());
}

function pascalCase(name) {
  const camel = camelCase(name);
  return camel[0]?.toUpperCase() + camel.slice(1);
}

export function memberStyle(source, target) {
  if (source === source.toLowerCase()) return kebabCase(target);
  return camelCase(target);
}

export function namedRule(rawName, mapping) {
  const candidates = [];
  const addCandidate = (section, prefix, name, suffix = '') => candidates.push({ section, prefix, name, suffix });
  if (rawName.startsWith('v-on:')) addCandidate('events', 'v-on:', rawName.slice(5));
  else if (rawName.startsWith('on:')) addCandidate('events', 'on:', rawName.slice(3));
  else if (rawName.startsWith('@')) addCandidate('events', '@', rawName.slice(1));
  else if (/^on[A-Z]/.test(rawName)) addCandidate('events', 'on', rawName.slice(2), 'jsx-event');
  else if (rawName.startsWith('v-bind:')) addCandidate('properties', 'v-bind:', rawName.slice(7));
  else if (rawName.startsWith('bind:')) addCandidate('properties', 'bind:', rawName.slice(5));
  else if (rawName.startsWith(':')) addCandidate('properties', ':', rawName.slice(1));
  else if (rawName.startsWith('.')) addCandidate('properties', '.', rawName.slice(1));
  else if (rawName.startsWith('?')) addCandidate('attributes', '?', rawName.slice(1));
  else {
    addCandidate('attributes', '', rawName);
    addCandidate('properties', '', rawName);
  }

  for (const candidate of candidates) {
    for (const rule of mapping.rewrites[candidate.section]) {
      const matches = candidate.suffix === 'jsx-event'
        ? candidate.name === pascalCase(rule.from)
        : new Set([rule.from, kebabCase(rule.from), camelCase(rule.from)]).has(candidate.name);
      if (!matches) continue;
      const targetName = candidate.suffix === 'jsx-event'
        ? pascalCase(rule.to)
        : memberStyle(candidate.name, rule.to);
      return {
        section: candidate.section,
        from: rule.from,
        to: rule.to,
        replacement: `${candidate.prefix}${targetName}`,
      };
    }
  }
  return null;
}

export function isDynamicAttribute(attribute) {
  return (
    attribute.valueKind === 'expression' ||
    /^(?:[.?:]|v-bind:|bind:)/.test(attribute.rawName)
  );
}

export const VOID_HTML_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

export function pairedMarkupTokens(tokens) {
  const stack = [];
  const pairs = new Map();
  for (const token of tokens) {
    if (!token.closing && !token.selfClosing) {
      stack.push(token);
      continue;
    }
    if (!token.closing) continue;
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      if (stack[index].tag !== token.tag) continue;
      const [opening] = stack.splice(index, 1);
      pairs.set(opening.start, token);
      break;
    }
  }
  return pairs;
}

export function scanDirectElementChildren(text, start, end, ignoredRanges) {
  const directTags = [];
  const stack = [];
  let cursor = start;
  let dynamicDirectContent = false;
  const tagPattern = /<(?<closing>\/)?(?<tag>[a-z][a-z0-9.:-]*)(?=[\s/>])/gi;
  tagPattern.lastIndex = start;

  const noteGap = (gapStart, gapEnd) => {
    if (stack.length === 0 && /\$\{|\{\{|<%/.test(text.slice(gapStart, gapEnd))) {
      dynamicDirectContent = true;
    }
  };

  for (let match = tagPattern.exec(text); match && match.index < end; match = tagPattern.exec(text)) {
    if (insideRanges(match.index, ignoredRanges)) continue;
    noteGap(cursor, match.index);
    const tokenEnd = findTagEnd(text, match.index + match[0].length);
    if (tokenEnd < 0 || tokenEnd >= end) break;
    const tagName = match.groups.tag.toLowerCase();
    if (match.groups.closing) {
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        if (stack[index] !== tagName) continue;
        stack.splice(index, 1);
        break;
      }
    } else {
      if (stack.length === 0) directTags.push(tagName);
      const selfClosing = /\/\s*>$/.test(text.slice(match.index, tokenEnd + 1));
      if (!selfClosing && !VOID_HTML_TAGS.has(tagName)) stack.push(tagName);
    }
    cursor = tokenEnd + 1;
    tagPattern.lastIndex = cursor;
  }
  noteGap(cursor, end);
  return { directTags, dynamicDirectContent };
}

export function normalizedAttributeName(attribute) {
  return attribute.rawName.replace(/^(?:v-bind:|bind:|[.?:])/, '').toLowerCase();
}

function stripTrailingModuleTrivia(text) {
  let value = text;
  while (true) {
    const next = value
      .replace(/\s+$/, '')
      .replace(/\/\*[\s\S]*?\*\/$/, '')
      .replace(/\/\/[^\n\r]*$/, '');
    if (next === value) return value;
    value = next;
  }
}

export function moduleSpecifierContext(text, quoteStart) {
  const prefix = stripTrailingModuleTrivia(text.slice(0, quoteStart));
  if (/\bimport\s*\($/.test(prefix)) return { sideEffect: false, kind: 'dynamic-import' };
  if (/\brequire\s*\($/.test(prefix)) return { sideEffect: false, kind: 'require' };
  if (/\bfrom$/.test(prefix)) return { sideEffect: false, kind: 'binding' };
  if (/\bimport$/.test(prefix)) return { sideEffect: true, kind: 'import' };
  return null;
}

export function regexEscape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function scanImports(text, ignoredRanges, contract) {
  const packageAlternatives = [...contract.packageIdentities.keys()]
    .sort((left, right) => right.length - left.length)
    .map(regexEscape)
    .join('|');
  const packagePattern = new RegExp(
    `(['"])(?<specifier>${packageAlternatives})(?<subpath>\\/[^'"\\s]*)?\\1`,
    'g',
  );
  const imports = [];
  for (const match of text.matchAll(packagePattern)) {
    if (insideRanges(match.index, ignoredRanges)) continue;
    const quoteStart = match.index;
    const context = moduleSpecifierContext(text, quoteStart);
    if (!context) continue;
    const specifier = `${match.groups.specifier}${match.groups.subpath ?? ''}`;
    const identity = contract.packageIdentities.get(match.groups.specifier);
    invariant(identity, `unrecognized package identity ${match.groups.specifier}`);
    const closingQuoteEnd = quoteStart + match[0].length;
    const lineBreak = text.indexOf('\n', closingQuoteEnd);
    const lineEnd = lineBreak === -1 ? text.length : lineBreak;
    const semicolon = text.indexOf(';', closingQuoteEnd);
    const statementEnd = semicolon !== -1 && semicolon < lineEnd ? semicolon + 1 : lineEnd;
    imports.push({
      ...context,
      ecosystem: identity.ecosystem,
      tiers: identity.tiers,
      packageName: match.groups.specifier,
      specifier,
      subpath: match.groups.subpath ?? '',
      quote: match[1],
      start: quoteStart + 1,
      end: quoteStart + 1 + specifier.length,
      statementEnd,
    });
  }
  return imports;
}

export function parseNamedModuleBindings(source) {
  const bindings = [];
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n\r]*/g, '');
  for (const rawEntry of withoutComments.split(',')) {
    const entry = rawEntry.trim().replace(/^type\s+/, '');
    if (!entry) continue;
    const match = entry.match(
      new RegExp(`^(?<imported>${JS_IDENTIFIER})(?:\\s+as\\s+(?<local>${JS_IDENTIFIER}))?$`),
    );
    if (match) {
      bindings.push({ imported: match.groups.imported, local: match.groups.local ?? match.groups.imported });
    }
  }
  return bindings;
}

function scanModuleFactoryLinks(text, ignoredRanges) {
  const imports = [];
  const localExports = [];
  const reexports = [];
  const starExports = [];
  const addMatches = (pattern, visit) => {
    for (const match of text.matchAll(pattern)) {
      if (!insideRanges(match.index, ignoredRanges) && !quotedRangeContaining(text, match.index)) {
        visit(match);
      }
    }
  };

  addMatches(
    /\bimport\s+(?!type\b)\{(?<bindings>[\s\S]*?)\}\s*from\s*(?<quote>['"])(?<source>[^'"]+)\k<quote>/g,
    (match) => {
      for (const binding of parseNamedModuleBindings(match.groups.bindings)) {
        imports.push({ source: match.groups.source, imported: binding.imported, local: binding.local });
      }
    },
  );
  addMatches(
    new RegExp(
      `\\bimport\\s+(?!type\\b)(?<local>${JS_IDENTIFIER})` +
        `(?:\\s*,\\s*(?:\\{[\\s\\S]*?\\}|\\*\\s+as\\s+${JS_IDENTIFIER}))?` +
        `\\s+from\\s*(?<quote>['"])(?<source>[^'"]+)\\k<quote>`,
      'g',
    ),
    (match) => imports.push({ source: match.groups.source, imported: 'default', local: match.groups.local }),
  );
  addMatches(
    new RegExp(
      `\\bimport\\s+\\*\\s+as\\s+(?<local>${JS_IDENTIFIER})\\s+from\\s*` +
        `(?<quote>['"])(?<source>[^'"]+)\\k<quote>`,
      'g',
    ),
    (match) => imports.push({ source: match.groups.source, imported: '*', local: match.groups.local }),
  );

  addMatches(
    /\bexport\s*\{(?<bindings>[\s\S]*?)\}\s*from\s*(?<quote>['"])(?<source>[^'"]+)\k<quote>/g,
    (match) => {
      for (const binding of parseNamedModuleBindings(match.groups.bindings)) {
        reexports.push({
          source: match.groups.source,
          imported: binding.imported,
          exported: binding.local,
        });
      }
    },
  );
  addMatches(
    /\bexport\s*\*\s*from\s*(?<quote>['"])(?<source>[^'"]+)\k<quote>/g,
    (match) => starExports.push(match.groups.source),
  );
  addMatches(
    /\bexport\s*\{(?<bindings>[\s\S]*?)\}(?!\s*from\b)/g,
    (match) => {
      for (const binding of parseNamedModuleBindings(match.groups.bindings)) {
        localExports.push({ local: binding.imported, exported: binding.local });
      }
    },
  );
  addMatches(
    new RegExp(`\\bexport\\s+(?:const|let|var|function)\\s+(?<name>${JS_IDENTIFIER})`, 'g'),
    (match) => localExports.push({ local: match.groups.name, exported: match.groups.name }),
  );
  addMatches(
    new RegExp(`\\bexport\\s+default\\s+(?<name>${JS_IDENTIFIER})(?![$\\w])`, 'g'),
    (match) => localExports.push({ local: match.groups.name, exported: 'default' }),
  );
  return { imports, localExports, reexports, starExports };
}

const MODULE_SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

function resolveScannedModule(fromFile, specifier, scannedFiles) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const extension = path.extname(base);
  const candidates = [base];
  if (extension) {
    const stem = base.slice(0, -extension.length);
    for (const candidateExtension of MODULE_SOURCE_EXTENSIONS) candidates.push(`${stem}${candidateExtension}`);
  } else {
    for (const candidateExtension of MODULE_SOURCE_EXTENSIONS) candidates.push(`${base}${candidateExtension}`);
  }
  for (const candidateExtension of MODULE_SOURCE_EXTENSIONS) {
    candidates.push(path.join(base, `index${candidateExtension}`));
  }
  return candidates.find((candidate) => scannedFiles.has(candidate)) ?? null;
}

function factoryMapEqual(left, right) {
  return left.size === right.size && [...left].every(([name, kind]) => right.get(name) === kind);
}

export function buildProjectDomFactoryBindings(originals) {
  const modules = new Map();
  for (const [file, text] of originals) {
    const resolvedFile = path.resolve(file);
    const ignoredRanges = commentRanges(text);
    modules.set(resolvedFile, {
      text,
      ignoredRanges,
      links: scanModuleFactoryLinks(text, ignoredRanges),
    });
  }
  const scannedFiles = new Set(modules.keys());
  const exportedBindings = new Map([...scannedFiles].map((file) => [file, new Map()]));
  const importedBindings = new Map([...scannedFiles].map((file) => [file, new Map()]));

  for (let pass = 0; pass < Math.max(4, modules.size * 4); pass += 1) {
    let changed = false;
    for (const [file, module] of modules) {
      const seeds = new Map();
      for (const imported of module.links.imports) {
        const target = resolveScannedModule(file, imported.source, scannedFiles);
        if (!target) continue;
        const targetExports = exportedBindings.get(target);
        if (imported.imported === '*') {
          for (const [name, kind] of targetExports) seeds.set(`${imported.local}.${name}`, kind);
        } else {
          const kind = targetExports.get(imported.imported);
          if (kind) seeds.set(imported.local, kind);
        }
      }
      const analysis = scanLocalDomFactoryBindings(module.text, module.ignoredRanges, seeds);
      if (!factoryMapEqual(importedBindings.get(file), seeds)) {
        importedBindings.set(file, seeds);
        changed = true;
      }

      const nextExports = new Map();
      for (const exported of module.links.localExports) {
        const kind = analysis.moduleBindings.get(exported.local);
        if (kind) nextExports.set(exported.exported, kind);
      }
      for (const reexported of module.links.reexports) {
        const target = resolveScannedModule(file, reexported.source, scannedFiles);
        const kind = target ? exportedBindings.get(target).get(reexported.imported) : null;
        if (kind) nextExports.set(reexported.exported, kind);
      }
      for (const source of module.links.starExports) {
        const target = resolveScannedModule(file, source, scannedFiles);
        if (!target) continue;
        for (const [name, kind] of exportedBindings.get(target)) {
          if (name !== 'default') nextExports.set(name, kind);
        }
      }
      if (!factoryMapEqual(exportedBindings.get(file), nextExports)) {
        exportedBindings.set(file, nextExports);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return importedBindings;
}

export function finalizeEdits(original, edits) {
  const unique = [];
  const seen = new Set();
  for (const edit of edits) {
    const key = `${edit.start}:${edit.end}:${edit.replacement}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(edit);
  }
  unique.sort((left, right) => left.start - right.start || left.end - right.end);
  for (let index = 1; index < unique.length; index += 1) {
    if (unique[index].start < unique[index - 1].end) {
      throw new Error(`Migration rewrite conflict at offsets ${unique[index - 1].start} and ${unique[index].start}`);
    }
  }
  // Assembled from the end in one pass, exactly as applying each edit to the whole string in
  // descending order would, but linear in the text size instead of in size times edit count.
  const parts = [];
  let cursor = original.length;
  for (const edit of [...unique].sort((left, right) => right.start - left.start || right.end - left.end)) {
    parts.push(original.slice(edit.end, cursor), edit.replacement);
    cursor = edit.start;
  }
  parts.push(original.slice(0, cursor));
  return parts.reverse().join('');
}

export function localMigrationKey(origin, tag) {
  return `${origin}:${tag}`;
}

/** Convert a local origin to the short release label used in migration messages. */
export function originLabel(origin) {
  return String(origin).replace(/^lyra-/, '');
}

export function serializeLocalDefault(rule) {
  if (rule.value === true) return rule.member;
  const value = String(rule.value).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  return `${rule.member}="${value}"`;
}

export function scanLocalMigrationHazards(text, profiles, ignoredRanges, openingTokens) {
  const uses = [];
  const blocked = new Set();
  const tags = new Set(profiles.keys());
  const apiPattern = /\b(?:(?:[$A-Z_a-z][$\w]*)\s*(?:\?\.|\.)\s*(?:createElement|querySelector(?:All)?)|(?:createElement|querySelector(?:All)?)|customElements\.(?:get|whenDefined))\s*(?:<[^>\n]+>)?\(\s*(['"])(?<tag>lr-[a-z][a-z0-9-]*)\1/g;
  for (const match of text.matchAll(apiPattern)) {
    if (insideRanges(match.index, ignoredRanges) || !tags.has(match.groups.tag)) continue;
    const offset = match.index + match[0].lastIndexOf(match.groups.tag);
    const key = localMigrationKey(profiles.get(match.groups.tag).origin, match.groups.tag);
    blocked.add(key);
    uses.push({
      key,
      tag: match.groups.tag,
      offset,
      warningCode: 'ALIASED_MEMBER_REVIEW',
      message:
        `${match.groups.tag} is accessed through a DOM alias; review property assignments before ` +
        `inserting ${originLabel(profiles.get(match.groups.tag).origin)} compatibility defaults.`,
    });
  }

  for (const token of openingTokens) {
    const profile = profiles.get(token.tag);
    if (!profile) continue;
    const opening = text.slice(token.nameEnd, token.end);
    const patterns = [
      /\{\s*\.\.\.[^}]+\}/g,
      /\bv-bind\s*=\s*(?:"[^"]*"|'[^']*'|\{[^}]*\})/g,
    ];
    for (const pattern of patterns) {
      for (const match of opening.matchAll(pattern)) {
        const offset = token.nameEnd + match.index;
        const key = localMigrationKey(profile.origin, token.tag);
        blocked.add(key);
        uses.push({
          key,
          tag: token.tag,
          offset,
          warningCode: 'DYNAMIC_VALUE_REVIEW',
          message:
            `${token.tag} has an opaque attribute spread that may already provide a migrated default; ` +
            'expand or review it before running this profile.',
        });
      }
    }
  }
  return { uses, blocked };
}
