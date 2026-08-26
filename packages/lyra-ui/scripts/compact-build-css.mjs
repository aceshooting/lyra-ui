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

function opensUrlToken(source, index, previousCharacter) {
  if (source.slice(index, index + 4).toLowerCase() !== 'url(') return false;
  const before = index > 0 ? source[index - 1] : previousCharacter;
  return before == null || !IDENTIFIER_TAIL.test(before);
}

/** Collapses only CSS whitespace runs, retaining strings, unquoted URLs, escapes, and expressions. */
export function collapseCssWhitespaceChunks(chunks) {
  let state = NORMAL;
  let quote = '';
  let urlQuote = '';
  let lastCharacter = null;

  return chunks.map((source) => {
    let output = '';
    let index = 0;
    while (index < source.length) {
      const character = source[index];

      if (character === '\\') {
        output += character;
        index += 1;
        if (index < source.length) output += source[index++];
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
        output += ' ';
        lastCharacter = ' ';
        continue;
      }

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
export function compactCssModule(source, filename = 'module.js') {
  const templates = [];
  collectStyleTemplates(parseModule(source, filename), templates);
  if (templates.length === 0) {
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
    let compacted = collapseCssWhitespaceChunks(chunks);
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

  edits.sort((left, right) => left.start - right.start);
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
    if (!source.includes('css')) continue;
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
