import fs from 'node:fs';
import path from 'node:path';

export const QUALIFICATION_DIMENSIONS = Object.freeze([
  'accessibility',
  'keyboard',
  'rtl',
  'reducedMotion',
  'narrowAllocation',
  'engines',
  'ssrHydration',
  'visual',
  'peerFailure',
  'security',
  'forcedColors',
  'assistiveTechnology',
]);

export const AXE_ASSERTION = /\baxe\b|toBeAccessible|isAccessible|(?<!\bnot\.)be\.accessible\s*\(/;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const TEST_CALL = /\b(?:it|test)(?:\.(?:only|skip))?\s*\(/g;
const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

function isIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function skipQuoted(source, index, quote) {
  for (let cursor = index + 1; cursor < source.length; cursor += 1) {
    if (source[cursor] === '\\') cursor += 1;
    else if (source[cursor] === quote) return cursor;
  }
  return source.length - 1;
}

function skipLineComment(source, index) {
  const newline = source.indexOf('\n', index + 2);
  return newline === -1 ? source.length - 1 : newline;
}

function skipBlockComment(source, index) {
  const close = source.indexOf('*/', index + 2);
  return close === -1 ? source.length - 1 : close + 1;
}

function skipRegexLiteral(source, start) {
  let inClass = false;
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === '\\') index += 1;
    else if (source[index] === '[') inClass = true;
    else if (source[index] === ']') inClass = false;
    else if (source[index] === '/' && !inClass) {
      while (/[a-z]/i.test(source[index + 1] ?? '')) index += 1;
      return index;
    } else if (source[index] === '\n') return start;
  }
  return start;
}

function startsRegexLiteral(source, index) {
  let previous = index - 1;
  while (previous >= 0 && /\s/.test(source[previous])) previous -= 1;
  if (previous < 0 || /[([{=:;,!?&|+*%^~<>-]/.test(source[previous])) return true;
  if (!/[A-Za-z0-9_$]/.test(source[previous])) return false;
  let start = previous;
  while (start >= 0 && /[A-Za-z0-9_$]/.test(source[start])) start -= 1;
  return /^(?:await|case|delete|in|instanceof|of|return|throw|typeof|void|yield)$/.test(
    source.slice(start + 1, previous + 1),
  );
}

/**
 * A same-length view that retains executable punctuation/identifiers while blanking comments and
 * literals. Test-call discovery must operate on code, not prose such as `reflects it (mirrors…)`
 * or an example string containing `test(...)`; indices still point back into the original source.
 */
function codeMask(source) {
  // String indices in the rest of this scanner are UTF-16 code-unit offsets. `split('')` preserves
  // those offsets; spreading would collapse a non-BMP glyph to one array entry and shift every
  // later test boundary by one code unit.
  const masked = source.split('');
  const blank = (start, end) => {
    for (let index = start; index <= end; index += 1) {
      if (masked[index] !== '\n') masked[index] = ' ';
    }
  };
  const templateEnd = (start) => {
    for (let index = start + 1; index < source.length; index += 1) {
      if (source[index] === '\\') index += 1;
      else if (source[index] === '`') return index;
      else if (source.slice(index, index + 2) === '${') {
        const end = matchingDelimiter(source, index + 1, '{', '}');
        if (end === -1) return source.length - 1;
        index = end;
      }
    }
    return source.length - 1;
  };
  for (let cursor = 0; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    const pair = source.slice(cursor, cursor + 2);
    let end = cursor;
    if (pair === '//') end = skipLineComment(source, cursor);
    else if (pair === '/*') end = skipBlockComment(source, cursor);
    else if (char === '/' && startsRegexLiteral(source, cursor)) end = skipRegexLiteral(source, cursor);
    else if (char === "'" || char === '"') end = skipQuoted(source, cursor, char);
    else if (char === '`') end = templateEnd(cursor);
    else continue;
    blank(cursor, end);
    cursor = end;
  }
  return masked.join('');
}

/**
 * A same-length view for evidence literals: preserve strings/templates that may contain mounted
 * markup, but blank comments and regular-expression examples that cannot create an element.
 */
function evidenceMask(source) {
  const masked = source.split('');
  const blank = (start, end) => {
    for (let index = start; index <= end; index += 1) {
      if (masked[index] !== '\n') masked[index] = ' ';
    }
  };
  for (let cursor = 0; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    const pair = source.slice(cursor, cursor + 2);
    if (char === "'" || char === '"' || char === '`') {
      cursor = skipQuoted(source, cursor, char);
      continue;
    }
    let end = cursor;
    if (pair === '//') end = skipLineComment(source, cursor);
    else if (pair === '/*') end = skipBlockComment(source, cursor);
    else if (char === '/' && startsRegexLiteral(source, cursor)) end = skipRegexLiteral(source, cursor);
    else continue;
    blank(cursor, end);
    cursor = end;
  }
  return masked.join('');
}

/**
 * Returns the index of the closing delimiter matching `source[openIndex]`.
 * Strings, comments, template literals, and nested `${...}` expressions are skipped exactly so a
 * component fixture can contain arbitrary markup without ending the surrounding test call early.
 */
export function matchingDelimiter(source, openIndex, open = source[openIndex], close) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const expected = close ?? pairs[open];
  if (!expected || source[openIndex] !== open) return -1;
  let depth = 1;
  for (let cursor = openIndex + 1; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    const pair = source.slice(cursor, cursor + 2);
    if (char === "'" || char === '"') cursor = skipQuoted(source, cursor, char);
    else if (pair === '//') cursor = skipLineComment(source, cursor);
    else if (pair === '/*') cursor = skipBlockComment(source, cursor);
    else if (char === '/' && startsRegexLiteral(source, cursor)) cursor = skipRegexLiteral(source, cursor);
    else if (char === '`') {
      for (cursor += 1; cursor < source.length; cursor += 1) {
        if (source[cursor] === '\\') cursor += 1;
        else if (source[cursor] === '`') break;
        else if (source.slice(cursor, cursor + 2) === '${') {
          const expressionEnd = matchingDelimiter(source, cursor + 1, '{', '}');
          if (expressionEnd === -1) return -1;
          cursor = expressionEnd;
        }
      }
    } else if (char === open) depth += 1;
    else if (char === expected && --depth === 0) return cursor;
  }
  return -1;
}

function topLevelComma(source) {
  const stack = [];
  for (let cursor = 0; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    const pair = source.slice(cursor, cursor + 2);
    if (char === "'" || char === '"') cursor = skipQuoted(source, cursor, char);
    else if (pair === '//') cursor = skipLineComment(source, cursor);
    else if (pair === '/*') cursor = skipBlockComment(source, cursor);
    else if (char === '/' && startsRegexLiteral(source, cursor)) cursor = skipRegexLiteral(source, cursor);
    else if (char === '`') {
      cursor = skipQuoted(source, cursor, '`');
    } else if ('([{'.includes(char)) stack.push(char);
    else if (')]}'.includes(char)) stack.pop();
    else if (char === ',' && stack.length === 0) return cursor;
  }
  return -1;
}

function literalTitle(raw) {
  const value = raw.trim();
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1);
  }
  if (value.startsWith('`') && value.endsWith('`')) return value.slice(1, -1);
  return value;
}

export function extractTestCases(source, file = '<source>') {
  const cases = [];
  const executable = codeMask(source);
  for (const match of executable.matchAll(TEST_CALL)) {
    const open = match.index + match[0].lastIndexOf('(');
    const close = matchingDelimiter(source, open, '(', ')');
    if (close === -1) continue;
    const argumentsText = source.slice(open + 1, close);
    const comma = topLevelComma(argumentsText);
    if (comma === -1) continue;
    const raw = source.slice(match.index, close + 1);
    cases.push({
      file,
      index: match.index,
      end: close + 1,
      line: source.slice(0, match.index).split('\n').length,
      title: literalTitle(argumentsText.slice(0, comma)),
      raw,
    });
  }
  return cases;
}

function parameterizedTagTableContains(fileSource, testCase, tag) {
  const executable = codeMask(fileSource);
  const loop = /\bfor\s*\(\s*const\s+(?:\[\s*tag(?:\s*,[^\]]*)?\]|tag)\s+of\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\)/g;
  for (const match of executable.matchAll(loop)) {
    const headerOpen = executable.indexOf('(', match.index);
    const headerClose = matchingDelimiter(fileSource, headerOpen, '(', ')');
    if (headerClose === -1) continue;
    const bodyOpen = executable.indexOf('{', headerClose + 1);
    if (bodyOpen === -1) continue;
    const bodyClose = matchingDelimiter(fileSource, bodyOpen, '{', '}');
    if (bodyClose === -1 || testCase.index < bodyOpen || testCase.index > bodyClose) continue;
    const table = initializerFor(fileSource, match[1]);
    if (table && exactTagPattern(tag).test(evidenceMask(table))) return true;
  }
  return false;
}

function accessibleExpectations(testCase) {
  const expectations = [];
  const executable = codeMask(testCase.raw);
  for (const match of executable.matchAll(/\bexpect\s*\(/g)) {
    const open = match.index + match[0].lastIndexOf('(');
    const close = matchingDelimiter(testCase.raw, open, '(', ')');
    if (close === -1) continue;
    const chain = executable.slice(close + 1, close + 100);
    if (!/^\s*(?:\.shadowDom)?\.to\.be\.accessible\s*\(/.test(chain)) continue;
    expectations.push(testCase.raw.slice(open + 1, close).trim());
  }
  return expectations;
}

function expressionEnd(source, start) {
  const stack = [];
  for (let cursor = start; cursor < source.length; cursor += 1) {
    const char = source[cursor];
    const pair = source.slice(cursor, cursor + 2);
    if (char === "'" || char === '"') cursor = skipQuoted(source, cursor, char);
    else if (pair === '//') cursor = skipLineComment(source, cursor);
    else if (pair === '/*') cursor = skipBlockComment(source, cursor);
    else if (char === '/' && startsRegexLiteral(source, cursor)) cursor = skipRegexLiteral(source, cursor);
    else if (char === '`') cursor = skipQuoted(source, cursor, '`');
    else if ('([{'.includes(char)) stack.push(char);
    else if (')]}'.includes(char)) stack.pop();
    else if ((char === ';' || char === ',') && stack.length === 0) return cursor;
  }
  return source.length;
}

function initializerFor(raw, identifier) {
  const escaped = identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declaration = new RegExp(`\\b(?:const|let|var)\\s+${escaped}(?:\\s*:[^=;]+)?\\s*=`, 'g').exec(codeMask(raw));
  if (!declaration) return '';
  const start = declaration.index + declaration[0].length;
  return raw.slice(start, expressionEnd(raw, start)).trim();
}

function destructuredInitializerFor(raw, identifier) {
  for (const match of codeMask(raw).matchAll(/\b(?:const|let|var)\s*\{([^}]+)\}\s*=/g)) {
    const names = match[1]
      .split(',')
      .map((part) => part.trim().split(/\s*:\s*/).at(-1)?.trim())
      .filter(Boolean);
    if (!names.includes(identifier)) continue;
    const start = match.index + match[0].length;
    return raw.slice(start, expressionEnd(raw, start)).trim();
  }
  return '';
}

function helperSnippet(source, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const executable = codeMask(source);
  const functionMatch = new RegExp(`\\b(?:async\\s+)?function\\s+${escaped}\\s*\\(`).exec(executable);
  if (functionMatch) {
    let bodyStart = executable.indexOf('{', functionMatch.index + functionMatch[0].length);
    while (bodyStart !== -1) {
      const bodyEnd = matchingDelimiter(source, bodyStart, '{', '}');
      if (bodyEnd === -1) break;
      const candidate = executable.slice(bodyStart + 1, bodyEnd);
      // A return type can itself be an object (`Promise<{ el: ... }>`). The actual function body is
      // the first balanced brace block that contains executable statements.
      if (/\breturn\b|\bconst\b|\blet\b|\bawait\b/.test(candidate)) {
        return source.slice(functionMatch.index, bodyEnd + 1);
      }
      bodyStart = executable.indexOf('{', bodyEnd + 1);
    }
  }
  const constMatch = new RegExp(`\\bconst\\s+${escaped}(?:\\s*:[^=;]+)?\\s*=`).exec(executable);
  if (constMatch) {
    const start = constMatch.index + constMatch[0].length;
    return source.slice(constMatch.index, expressionEnd(source, start) + 1);
  }
  return '';
}

function exactTagPattern(tag) {
  return new RegExp(`<${tag}(?:[\\s/>])|['"\x60]${tag}['"\x60]`);
}

function expressionEvidence(expression, testCase, fileSource, tag) {
  const exactTag = exactTagPattern(tag);
  if (exactTag.test(evidenceMask(expression))) return { expression, supportingSource: expression };

  // A wrapper fixture plus `wrapper.querySelector('lr-child')` still proves that the element passed
  // to axe is the named child, not merely a sibling mentioned elsewhere in the test.
  if (new RegExp(`\\.querySelector(?:<[^>]+>)?\\(\\s*['"]${tag}['"]\\s*\\)`).test(expression)) {
    return { expression, supportingSource: expression };
  }

  // Chart subclasses share one parameterized test. The exact tag is a reviewed member of the
  // source array, and the same `tag` variable constructs the element and names the test.
  if (
    /<\$\{tag\}(?:[\s/>])/.test(expression) &&
    /\$\{tag\}/.test(testCase.title) &&
    parameterizedTagTableContains(fileSource, testCase, tag)
  ) {
    return { expression, supportingSource: expression };
  }

  for (const call of expression.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)) {
    if (['fixture', 'html', 'expect'].includes(call[1])) continue;
    const helper = helperSnippet(fileSource, call[1]);
    if (helper && exactTag.test(evidenceMask(helper))) return { expression, supportingSource: helper };
  }
  // A fixture can receive a named TemplateResult (`fixture(threeItems)`) instead of invoking a
  // helper. Resolve those authored constants too; unlike a directory-wide tag search, this follows
  // only identifiers that participate in the expression passed to axe's exact target.
  for (const identifier of expression.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*)\b/g)) {
    if (['await', 'as', 'fixture', 'html', 'const', 'let', 'var'].includes(identifier[1])) continue;
    const helper = helperSnippet(fileSource, identifier[1]);
    if (helper && exactTag.test(evidenceMask(helper))) return { expression, supportingSource: helper };
  }
  return null;
}

function targetEvidence(expectation, testCase, fileSource, tag) {
  const stripped = expectation
    .replace(/^\(+/, '')
    .replace(/\)+$/, '')
    .replace(/\s+as\s+[A-Za-z_$][\w$<>,.[\] |]*/g, '')
    .trim();
  if (!IDENTIFIER.test(stripped)) return expressionEvidence(expectation, testCase, fileSource, tag);
  const initializer = initializerFor(testCase.raw, stripped) || destructuredInitializerFor(testCase.raw, stripped);
  if (!initializer) return null;
  // The target can be selected from a wrapper initialized earlier in the same test. Follow that
  // wrapper by name, but only when the target expression itself is a query/first-child operation.
  const owner = /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\.(?:querySelector|firstElementChild)/.exec(initializer)?.[1];
  if (owner) {
    const ownerInitializer = initializerFor(testCase.raw, owner);
    const ownerMarkupAssignment = new RegExp(`\\b${owner}\\.(?:innerHTML|outerHTML)\\s*=([\\s\\S]*?)<${tag}(?:[\\s/>])`).test(evidenceMask(testCase.raw));
    if (
      (exactTagPattern(tag).test(evidenceMask(ownerInitializer)) || ownerMarkupAssignment) &&
      exactTagPattern(tag).test(evidenceMask(testCase.raw))
    ) {
      return { expression: initializer, supportingSource: `${ownerInitializer}\n${testCase.raw}`, target: stripped };
    }
  }
  const direct = expressionEvidence(initializer, testCase, fileSource, tag);
  if (direct) return { ...direct, target: stripped };
  return null;
}

function classifyRenderedState(testCase, supportingSource, target) {
  const renderedSource = evidenceMask(supportingSource);
  const testSource = evidenceMask(testCase.raw);
  if (
    /\sopen(?:\s|>|=)/.test(renderedSource) ||
    /\.open\s*=\s*true|\.setAttribute\(\s*['"]open['"]/.test(testSource)
  ) return 'open';

  // Positive prose is never evidence (the rendered fixture still has to prove its state), but an
  // author's explicit statement that this is the empty/default case is useful disqualifying
  // evidence. Form chrome such as a label or placeholder must not silently turn that case into a
  // populated record. Combined titles such as "empty and populated states" remain eligible and
  // are decided from the source below.
  const title = testCase.title.toLowerCase();
  const titleNamesMeaningfulState = /\b(?:populated|open|loaded)\b/.test(title);
  const titleDisclaimsMeaningfulState =
    /\bdefault\b[^\n]*\bempty\b|\bempty\b[^\n]*\bdefault\b/.test(title) ||
    /\bempty (?:state|items? array|meter)\b|\bwhen empty\b|\bwhile disabled\b/.test(title) ||
    /\bno (?:content|data|items|detail|preview|renderer)\b/.test(title);
  if (titleDisclaimsMeaningfulState && !titleNamesMeaningfulState) return 'default';

  // Slotted text/elements and property bindings are data-bearing even when the test title is terse.
  const tagBody = /<lr-[a-z0-9-]+(?:\s[^>]*)?>([\s\S]*?)<\/lr-[a-z0-9-]+>/.exec(renderedSource)?.[1]?.trim();
  const renderedTagBody = tagBody
    ?.replace(/\$\{\s*(?:nothing|null|undefined|false|\[\]|\{\}|''|"")\s*\}/g, '')
    .trim();
  if (renderedTagBody) return 'populated';
  const bindings = [...renderedSource.matchAll(/\.[A-Za-z_$][\w$]*\s*=\s*\$\{([^}]*)\}/g)];
  if (bindings.some((match) => !/^(?:\[\]|\{\}|''|""|false|nothing|null|undefined)\s*$/.test(match[1].trim()))) {
    return 'populated';
  }
  if (/\.(?:data|dataset|datasets|items|rows|src|value)\s*=(?!\s*\$\{)/.test(renderedSource)) return 'populated';
  const startTag = /<lr-[a-z0-9-]+\s+([^>]+?)(?:\/?)>/.exec(renderedSource)?.[1] ?? '';
  const meaningfulAttributes = startTag
    .replace(/(?:^|\s)[.?@][A-Za-z_$][\w$-]*\s*=\s*\$\{[^}]*\}/g, '')
    .replace(/\b(?:aria-label|aria-labelledby|label|lang|dir|role|style|class)\s*=\s*(?:"[^"]*"|'[^']*'|\$\{[^}]*\})/g, '')
    .trim();
  if (meaningfulAttributes) return /(?:^|\s)open(?:\s|=|$)/.test(meaningfulAttributes) ? 'open' : 'populated';
  if (target) {
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const assignments = [...testSource.matchAll(new RegExp(`\\b${escaped}\\.([A-Za-z_$][\\w$]*)\\s*=`, 'g'))]
      .map((match) => match[1])
      .filter((name) => !['ariaLabel', 'className', 'dir', 'label', 'lang', 'role', 'strings', 'style', 'title'].includes(name));
    if (assignments.length > 0) return assignments.includes('open') ? 'open' : 'populated';
    if (new RegExp(`\\b${escaped}\\.(?:append|appendChild|create|insertAdjacentHTML|open|replaceChildren|show)\\s*\\(`).test(testSource)) {
      return /\.(?:open|show)\s*\(/.test(testSource) ? 'open' : 'populated';
    }
    if (new RegExp(`\\b${escaped}\\.(?:announce|search)\\s*\\(`).test(testSource)) return 'populated';
    if (new RegExp(`\\b${escaped}\\.shadowRoot[\\s\\S]*?\\.click\\s*\\(`).test(testSource)) return 'populated';
    if (new RegExp(`\\b(?:load|mount|populate|render|select|show)[A-Za-z0-9_$]*\\s*\\([^)]*\\b${escaped}\\b`).test(testSource)) {
      return 'populated';
    }
    if (new RegExp(`\\b${escaped}\\.setAttribute\\(\\s*['"](?!aria-|class|dir|label|lang|role|style|title)[^'"]+['"]`).test(testSource)) {
      return 'populated';
    }
  }
  return 'default';
}

/** Returns axe evidence that is tied to the exact instance mounted in the same test case. */
export function axeEvidenceForTag({ source, file, tag }) {
  const evidence = [];
  for (const testCase of extractTestCases(source, file)) {
    for (const expectation of accessibleExpectations(testCase)) {
      const target = targetEvidence(expectation, testCase, source, tag);
      if (!target) continue;
      evidence.push({
        file,
        line: testCase.line,
        test: testCase.title,
        target: target.target ?? 'inline fixture',
        state: classifyRenderedState(testCase, target.supportingSource, target.target),
      });
    }
  }
  return evidence;
}

export function readComponentTestFiles(componentDir, readDir = fs.readdirSync, readFile = fs.readFileSync) {
  let entries;
  try {
    entries = readDir(componentDir);
  } catch {
    return [];
  }
  return entries
    .filter((file) => file.endsWith('.test.ts'))
    .sort()
    .map((file) => ({ file: path.join(componentDir, file), source: readFile(path.join(componentDir, file), 'utf8') }));
}

/** Compatibility helper retained for callers of the first qualification gate. */
export function readComponentTests(componentDir, readDir = fs.readdirSync, readFile = fs.readFileSync) {
  return readComponentTestFiles(componentDir, readDir, readFile).map(({ source }) => source).join('\n');
}

/** A tag counts as mentioned in a literal fixture or a reviewed dynamic tag table. */
export function mountsTag(text, tag) {
  return new RegExp(`<${tag}(?:[\\s/>])`).test(text) || new RegExp(`['"\x60]${tag}['"\x60]`).test(text);
}

export function normalizeExemptions(config, dimensions = QUALIFICATION_DIMENSIONS) {
  const list = Array.isArray(config?.exemptions) ? config.exemptions : [];
  const byKey = new Map();
  const problems = config?.schemaVersion === 2 ? [] : ['qualification exemptions must use schemaVersion 2'];
  const valid = new Set(dimensions);
  for (const entry of list) {
    if (!entry || typeof entry.tag !== 'string' || !entry.tag) {
      problems.push('an exemption is missing a "tag"');
      continue;
    }
    if (!valid.has(entry.dimension)) {
      problems.push(`${entry.tag}: unknown dimension "${entry.dimension}"`);
      continue;
    }
    if (typeof entry.scope !== 'string' || entry.scope.trim().length < 8) {
      problems.push(`${entry.tag} (${entry.dimension}): needs a narrow "scope"`);
    }
    if (typeof entry.reason !== 'string' || entry.reason.trim().length < 24) {
      problems.push(`${entry.tag} (${entry.dimension}): needs a substantive "reason"`);
    }
    if (!entry.reviewer || !['human', 'automated-agent'].includes(entry.reviewer.kind) || typeof entry.reviewer.name !== 'string' || entry.reviewer.name.trim().length < 2) {
      problems.push(`${entry.tag} (${entry.dimension}): needs reviewer { kind, name } provenance`);
    }
    if (entry.reviewer?.kind === 'automated-agent' && entry.humanReview !== 'not-claimed') {
      problems.push(`${entry.tag} (${entry.dimension}): an automated exemption must explicitly disclaim human review`);
    } else if (!['not-claimed', 'scope-reviewed'].includes(entry.humanReview)) {
      problems.push(`${entry.tag} (${entry.dimension}): needs explicit humanReview provenance`);
    }
    if (!isIsoDate(entry.recordedAt)) {
      problems.push(`${entry.tag} (${entry.dimension}): needs an ISO recordedAt date`);
    }
    if (!Array.isArray(entry.evidence) || entry.evidence.length === 0 || entry.evidence.some((item) => typeof item !== 'string' || item.trim().length < 3)) {
      problems.push(`${entry.tag} (${entry.dimension}): needs at least one evidence reference`);
    }
    const key = `${entry.tag}\0${entry.dimension}`;
    if (byKey.has(key)) problems.push(`${entry.tag} (${entry.dimension}): duplicate exemption`);
    else byKey.set(key, entry);
  }
  return { byKey, problems };
}
