import { isMainModule } from './is-main-module.mjs';

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';

const requireFromWorkspace = createRequire(new URL('../../../package.json', import.meta.url));
const requireFromVite = createRequire(requireFromWorkspace.resolve('vite'));
const { transform: transformCss } = requireFromVite('lightningcss');

const NORMAL = 0;
const STRING = 1;
const URL_TOKEN = 2;

const IDENTIFIER_TAIL = /[A-Za-z0-9_\-\\]/u;
// `>` and `~` are selector combinators or media range operators, never value arithmetic (unlike `+`).
const ATTRIBUTE_IDENTIFIER = /^-?[A-Za-z_][A-Za-z0-9_-]*$/u;
const SPACE_AFTER_OPTIONAL = new Set(['{', '}', ';', ',', '(', ':', '>', '~']);
const SPACE_BEFORE_OPTIONAL = new Set(['{', '}', ';', ',', ')', '>', '~', '!']);

function opensUrlToken(source, index, previousCharacter) {
  if (source.slice(index, index + 4).toLowerCase() !== 'url(') return false;
  const before = index > 0 ? source[index - 1] : previousCharacter;
  return before == null || !IDENTIFIER_TAIL.test(before);
}

/** Collapses CSS whitespace runs and drops the ones punctuation makes redundant, retaining strings,
 *  unquoted URLs, escapes, and expressions. */
export function collapseCssWhitespaceChunks(chunks, tighten = true) {
  let state = NORMAL;
  let quote = '';
  let urlQuote = '';
  let lastCharacter = null;
  // Custom property values keep their authored whitespace (their text is observable through
  // getPropertyValue), as the full stylesheet minifier does. `declaration` holds the text since the
  // last block or declaration boundary, with NUL standing in for an interpolation.
  let declaration = '';
  let customValue = false;
  let customDepth = 0;

  return chunks.map((source, chunkIndex) => {
    if (chunkIndex > 0 && !customValue) declaration += '\u0000';
    let output = '';
    let index = 0;
    // Output length just after the latest escape: an escaped character is identifier text.
    let escapedEnd = -1;
    // Output length just after the colon that opened the current custom property value.
    let customStart = -1;
    while (index < source.length) {
      const character = source[index];

      if (character === '\\') {
        output += character;
        index += 1;
        if (index < source.length) output += source[index++];
        escapedEnd = output.length;
        lastCharacter = output.at(-1) ?? lastCharacter;
        continue;
      }

      if (state === STRING) {
        output += character;
        index += 1;
        if (character === quote) state = NORMAL;
        lastCharacter = character;
        continue;
      }

      if (state === URL_TOKEN) {
        output += character;
        index += 1;
        if (urlQuote) {
          if (character === urlQuote) urlQuote = '';
        } else if (character === '\'' || character === '"') {
          urlQuote = character;
        } else if (character === ')') {
          state = NORMAL;
        }
        lastCharacter = character;
        continue;
      }

      if (character === '\'' || character === '"') {
        // An attribute selector value that is a plain identifier needs no quotes: [part='x'].
        const close = tighten && !customValue && output.at(-1) === '=' && escapedEnd !== output.length
          ? source.indexOf(character, index + 1) : -1;
        const value = close > index ? source.slice(index + 1, close) : '';
        if (source[close + 1] === ']' && ATTRIBUTE_IDENTIFIER.test(value)) {
          output += value;
          index = close + 1;
          lastCharacter = value.at(-1);
          continue;
        }
        output += character;
        index += 1;
        quote = character;
        state = STRING;
        lastCharacter = character;
        continue;
      }

      if (
        (character === 'u' || character === 'U') &&
        opensUrlToken(source, index, lastCharacter)
      ) {
        output += source.slice(index, index + 4);
        index += 4;
        state = URL_TOKEN;
        lastCharacter = '(';
        continue;
      }

      if (/\s/u.test(character)) {
        do index += 1;
        while (index < source.length && /\s/u.test(source[index]));
        // A run after a block, declaration, list or argument opener/separator, or before a
        // closer/separator, never separates two tokens. Runs that touch an interpolation stay, since
        // the interpolated text could need them.
        const previous = output.at(-1);
        const next = source[index];
        // A custom property whose whole value is one space (`--on: ;`, the space-toggle idiom) keeps
        // it: an empty value is invalid in engines without empty custom property support.
        const emptyValue = previous === ':' && (next === undefined || next === ';' || next === '}');
        const insideCustomValue = customValue && !(previous === ':' && output.length === customStart);
        if (tighten && !emptyValue && !insideCustomValue && ((previous !== undefined && escapedEnd !== output.length && SPACE_AFTER_OPTIONAL.has(previous)) ||
          (next !== undefined && SPACE_BEFORE_OPTIONAL.has(next)))) continue;
        output += ' ';
        lastCharacter = ' ';
        continue;
      }

      // A comment is copied as is and takes no part in declaration tracking.
      if (character === '/' && source[index + 1] === '*') {
        const end = source.indexOf('*/', index + 2);
        const stop = end < 0 ? source.length : end + 2;
        output += source.slice(index, stop);
        index = stop;
        lastCharacter = output.at(-1);
        continue;
      }
      if (customValue) {
        if (character === '(' || character === '[' || character === '{') customDepth += 1;
        else if ((character === ')' || character === ']') && customDepth > 0) customDepth -= 1;
        else if ((character === ';' || character === '}') && customDepth === 0) {
          customValue = false;
          declaration = '';
        }
        else if (character === '}') customDepth -= 1;
      } else if (character === '{' || character === ';' || character === '}') {
        declaration = '';
      } else if (character === ':' && /(?:^|\u0000)\s*-[\w-]*$|^\s*--[\w-]+$/u.test(declaration)) {
        customValue = true;
        customDepth = 0;
        customStart = output.length + 1;
      } else {
        declaration += character;
      }
      // The last declaration of a block needs no terminator.
      if (tighten && character === '}' && output.at(-1) === ';' && escapedEnd !== output.length) output = output.slice(0, -1);
      output += character;
      index += 1;
      lastCharacter = character;
    }
    return output;
  });
}

function collectStyleTemplates(node, found) {
  if (node == null || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) collectStyleTemplates(child, found);
    return;
  }
  if (
    node.type === 'TaggedTemplateExpression' &&
    node.tag?.type === 'Identifier' &&
    node.tag.name === 'css'
  ) {
    found.push(node.quasi);
  }
  for (const key of Object.keys(node)) {
    if (key !== 'parent') collectStyleTemplates(node[key], found);
  }
}

function parseModule(source, filename) {
  const parsed = parseSync(filename, source);
  const fatal = parsed.errors.filter((error) => error.severity !== 'Warning');
  if (fatal.length > 0) {
    throw new Error(`${filename}: parse failed: ${fatal.map((error) => error.message).join('; ')}`);
  }
  return parsed.program;
}

function minifyStylesheet(source, filename) {
  return transformCss({
    code: Buffer.from(source),
    drafts: { customMedia: true, nesting: true },
    filename,
    minify: true,
  }).code.toString();
}

function encodeTemplateChunk(cooked) {
  return cooked.replaceAll('\\', '\\\\').replaceAll('`', '\\`').replaceAll('${', '\\${');
}

function assertModuleRewrite(source, code, expectedCooked, beforeTemplates, filename) {
  const afterTemplates = [];
  collectStyleTemplates(parseModule(code, filename), afterTemplates);
  if (afterTemplates.length !== beforeTemplates.length) {
    throw new Error(`${filename}: CSS template count changed during compaction`);
  }
  for (const [templateIndex, before] of beforeTemplates.entries()) {
    const after = afterTemplates[templateIndex];
    if (before.expressions.length !== after.expressions.length) {
      throw new Error(`${filename}: CSS interpolation count changed in template ${templateIndex}`);
    }
    for (const [expressionIndex, beforeExpression] of before.expressions.entries()) {
      const afterExpression = after.expressions[expressionIndex];
      if (
        source.slice(beforeExpression.start, beforeExpression.end) !==
        code.slice(afterExpression.start, afterExpression.end)
      ) {
        throw new Error(
          `${filename}: CSS interpolation ${expressionIndex} changed in template ${templateIndex}`,
        );
      }
    }
    const actualCooked = after.quasis.map((quasi) => quasi.value.cooked);
    if (JSON.stringify(actualCooked) !== JSON.stringify(expectedCooked[templateIndex])) {
      throw new Error(`${filename}: cooked CSS text changed while encoding template ${templateIndex}`);
    }
  }
}

/** Compacts CSS template text without touching the surrounding JavaScript or interpolations. */
/**
 * Module-level style fragments other than a component's own `styles` (`const x = css\`...\``,
 * `const x = unsafeCSS(...)`) and frozen literal tables (`const x = Object.freeze({...})`).
 * Bundlers cannot drop an unused tagged template or call, so each shipped in every bundle importing
 * its module even when nothing used it. Wrapping the
 * initializer in a pure immediately invoked arrow keeps its evaluation order and value, and lets a
 * bundler drop it when unused. Runs after JavaScript compaction, which would inline the wrapper.
 */
/** Whether evaluating `node` can neither observe nor change anything outside the value it builds. */
function isInert(node) {
  switch (node?.type) {
    case 'Literal':
    case 'Identifier':
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
      return true;
    case 'TemplateLiteral':
      return node.expressions.every(isInert);
    case 'UnaryExpression':
      return node.operator !== 'delete' && isInert(node.argument);
    case 'ArrayExpression':
      return node.elements.every((element) => element === null || isInert(element));
    case 'ObjectExpression':
      return node.properties.every((property) => property.type === 'Property' &&
        (!property.computed || property.key.type === 'Literal') && isInert(property.value));
    default:
      return isFrozenLiteral(node);
  }
}

/** `Object.freeze()` of a fresh literal: freezing an object nothing else can reach is unobservable. */
function isFrozenLiteral(node) {
  return node?.type === 'CallExpression' && node.arguments.length === 1 &&
    node.callee.type === 'MemberExpression' && !node.callee.computed &&
    node.callee.object.type === 'Identifier' && node.callee.object.name === 'Object' &&
    node.callee.property.name === 'freeze' &&
    (node.arguments[0].type === 'ObjectExpression' || node.arguments[0].type === 'ArrayExpression') &&
    isInert(node.arguments[0]);
}

function droppableFragmentInitializers(program) {
  const found = [];
  for (const statement of program.body) {
    const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (declaration?.type !== 'VariableDeclaration' || declaration.kind !== 'const') continue;
    for (const variable of declaration.declarations) {
      const init = variable.init;
      if (variable.id.type !== 'Identifier' || variable.id.name === 'styles' || !init) continue;
      const isFragment = (init.type === 'TaggedTemplateExpression' && init.tag.type === 'Identifier' && init.tag.name === 'css') ||
        (init.type === 'CallExpression' && init.callee.type === 'Identifier' && init.callee.name === 'unsafeCSS');
      if (isFragment || isFrozenLiteral(init)) found.push(init);
    }
  }
  return found;
}

export function compactCssModule(source, filename = 'module.js') {
  const templates = [];
  const program = parseModule(source, filename);
  collectStyleTemplates(program, templates);
  const fragments = droppableFragmentInitializers(program);
  if (templates.length === 0 && fragments.length === 0) {
    return { code: source, templates: 0, minifiedTemplates: 0, removedBytes: 0 };
  }

  const edits = [];
  const expectedCooked = [];
  let minifiedTemplates = 0;
  for (const [templateIndex, template] of templates.entries()) {
    const chunks = template.quasis.map((quasi) => {
      if (quasi.value.cooked == null) {
        throw new Error(`${filename}: CSS template ${templateIndex} has an invalid escape`);
      }
      return quasi.value.cooked;
    });
    // A template nested in another template's interpolation is part of that interpolation's
    // source, which must stay byte-identical; it keeps the lexical collapse only.
    const nested = templates.some((outer) => outer !== template &&
      outer.expressions.some((expression) => expression.start <= template.start && template.end <= expression.end));
    let compacted = collapseCssWhitespaceChunks(chunks, !nested);
    if (template.expressions.length === 0) {
      try {
        const minified = minifyStylesheet(compacted[0], `${filename}#template-${templateIndex}`);
        if (Buffer.byteLength(encodeTemplateChunk(minified)) < Buffer.byteLength(template.quasis[0].value.raw)) {
          compacted = [minified];
          minifiedTemplates += 1;
        }
      } catch {
        // Some shared token fragments are intentionally not complete stylesheets. The lexical
        // whitespace pass remains safe for them and the package budget still catches regressions.
      }
    }
    expectedCooked.push(compacted);
    for (const [chunkIndex, quasi] of template.quasis.entries()) {
      const encoded = encodeTemplateChunk(compacted[chunkIndex]);
      if (encoded === source.slice(quasi.start, quasi.end)) continue;
      edits.push({ start: quasi.start, end: quasi.end, text: encoded });
    }
  }

  for (const init of fragments) {
    edits.push({ start: init.start, end: init.start, text: '/* @__PURE__ */(()=>' });
    edits.push({ start: init.end, end: init.end, text: ')()' });
  }
  edits.sort((left, right) => left.start - right.start || left.end - right.end);
  let code = '';
  let cursor = 0;
  for (const edit of edits) {
    code += source.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  code += source.slice(cursor);
  assertModuleRewrite(source, code, expectedCooked, templates, filename);
  return {
    code,
    templates: templates.length,
    minifiedTemplates,
    removedBytes: Buffer.byteLength(source) - Buffer.byteLength(code),
  };
}

async function filesWithExtension(directory, extension) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesWithExtension(fullPath, extension);
    return entry.isFile() && entry.name.endsWith(extension) ? [fullPath] : [];
  }));
  return nested.flat();
}

/** Compacts emitted Lit styles and standalone CSS assets under `directory`. */
export async function compactBuildCss(directory) {
  const [modules, stylesheets] = await Promise.all([
    filesWithExtension(directory, '.js'),
    filesWithExtension(directory, '.css'),
  ]);
  let modulesChanged = 0;
  let stylesheetsChanged = 0;
  let templates = 0;
  let minifiedTemplates = 0;
  let removedBytes = 0;

  for (const file of modules) {
    const source = await readFile(file, 'utf8');
    if (!source.includes('css') && !source.includes('Object.freeze')) continue;
    const result = compactCssModule(source, path.relative(directory, file));
    templates += result.templates;
    minifiedTemplates += result.minifiedTemplates;
    if (result.code === source) continue;
    modulesChanged += 1;
    removedBytes += result.removedBytes;
    await writeFile(file, result.code);
  }

  for (const file of stylesheets) {
    const source = await readFile(file, 'utf8');
    const compacted = minifyStylesheet(source, path.relative(directory, file));
    if (Buffer.byteLength(compacted) >= Buffer.byteLength(source)) continue;
    stylesheetsChanged += 1;
    removedBytes += Buffer.byteLength(source) - Buffer.byteLength(compacted);
    await writeFile(file, compacted);
  }

  return {
    modules: modules.length,
    modulesChanged,
    stylesheets: stylesheets.length,
    stylesheetsChanged,
    templates,
    minifiedTemplates,
    removedBytes,
  };
}

if (isMainModule(import.meta.url)) {
  const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const directory = process.argv[2] ? path.resolve(process.argv[2]) : path.join(packageDir, 'dist');
  const result = await compactBuildCss(directory);
  console.log(
    `Compacted ${result.templates.toLocaleString('en')} CSS templates and ` +
      `${result.stylesheets.toLocaleString('en')} stylesheets: ` +
      `${result.removedBytes.toLocaleString('en')} bytes removed.`,
  );
}
