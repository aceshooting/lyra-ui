import { isMainModule } from './is-main-module.mjs';

import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';

async function declarationFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return declarationFiles(fullPath);
    return entry.isFile() && entry.name.endsWith('.d.ts') ? [fullPath] : [];
  }));
  return nested.flat();
}

const IDENTIFIER_CONTINUE = /[\p{ID_Continue}$]/u;
const OPERATOR_CHARACTER = /[+\-*/%<>=!&|?^~.]/u;

function needsSeparator(left, right) {
  if (left == null || right == null) return false;
  if (IDENTIFIER_CONTINUE.test(left) && IDENTIFIER_CONTINUE.test(right)) return true;
  // Do not turn two deliberately separate operators into `=>`, `++`, `?.`, `>>`, and so on.
  if (OPERATOR_CHARACTER.test(left) && OPERATOR_CHARACTER.test(right)) return true;
  // `1 .member` must not become the numeric literal `1.` followed by an identifier.
  return /[0-9]/u.test(left) && right === '.';
}

function assertDeclarationParses(source, filename) {
  const parsed = parseSync(filename, source, { lang: 'dts', sourceType: 'module' });
  const fatal = parsed.errors.filter((error) => error.severity !== 'Warning');
  if (fatal.length > 0) {
    throw new Error(
      `${filename}: declaration compaction produced invalid syntax: ` +
        fatal.map((error) => error.message).join('; '),
    );
  }
}

/**
 * Removes lexically redundant declaration whitespace while retaining every type token and every
 * documentation comment. String and template bodies are copied byte-for-byte. JSDoc keeps an
 * explicit line boundary on each side, while indentation before its leading `*` is normalized
 * away because TypeScript's documentation parser discards it.
 */
export function compactDeclarationText(source, filename = 'module.d.ts') {
  let output = '';
  let index = 0;
  let state = 'code';
  let quote = '';
  let jsdoc = false;

  while (index < source.length) {
    const character = source[index];
    const next = source[index + 1];

    if (state === 'block-comment') {
      if (character === '*' && next === '/') {
        output += '*/';
        index += 2;
        state = 'code';
        if (jsdoc && index < source.length && !output.endsWith('\n')) output += '\n';
        jsdoc = false;
        continue;
      }
      if (character === '\r' && next === '\n') {
        output += '\n';
        index += 2;
        while (source[index] === ' ' || source[index] === '\t') index += 1;
        continue;
      }
      if (character === '\n') {
        output += '\n';
        index += 1;
        while (source[index] === ' ' || source[index] === '\t') index += 1;
        continue;
      }
      output += character;
      index += 1;
      continue;
    }

    if (state === 'line-comment') {
      output += character;
      index += 1;
      if (character === '\n') state = 'code';
      continue;
    }

    if (state === 'string' || state === 'template') {
      output += character;
      index += 1;
      if (character === '\\' && index < source.length) {
        output += source[index];
        index += 1;
      } else if (character === quote) {
        state = 'code';
      }
      continue;
    }

    if (character === '/' && next === '*') {
      jsdoc = source[index + 2] === '*';
      if (jsdoc && output.length > 0 && !output.endsWith('\n')) output += '\n';
      output += '/*';
      index += 2;
      state = 'block-comment';
      continue;
    }

    if (character === '/' && next === '/') {
      output += '//';
      index += 2;
      state = 'line-comment';
      continue;
    }

    if (character === '\'' || character === '"' || character === '`') {
      output += character;
      index += 1;
      quote = character;
      state = character === '`' ? 'template' : 'string';
      continue;
    }

    if (/\s/u.test(character)) {
      do index += 1;
      while (index < source.length && /\s/u.test(source[index]));
      if (needsSeparator(output.at(-1), source[index])) output += ' ';
      continue;
    }

    output += character;
    index += 1;
  }

  if (output.length > 0 && !output.endsWith('\n')) output += '\n';
  assertDeclarationParses(output, filename);
  return output;
}

/** Compacts emitted declarations without removing their IDE-facing documentation. */
export async function compactBuildDeclarations(directory) {
  const files = await declarationFiles(directory);
  let beforeBytes = 0;
  let afterBytes = 0;
  await Promise.all(files.map(async (file) => {
    const source = await readFile(file, 'utf8');
    beforeBytes += Buffer.byteLength(source);
    const compacted = compactDeclarationText(source, path.relative(directory, file));
    afterBytes += Buffer.byteLength(compacted);
    if (compacted !== source) await writeFile(file, compacted);
  }));
  return { files: files.length, beforeBytes, afterBytes };
}

if (isMainModule(import.meta.url)) {
  const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const directory = process.argv[2] ? path.resolve(process.argv[2]) : path.join(packageDir, 'dist');
  const result = await compactBuildDeclarations(directory);
  console.log(
    `Compacted ${result.files} declaration modules: ${result.beforeBytes.toLocaleString('en')} -> ` +
      `${result.afterBytes.toLocaleString('en')} bytes.`,
  );
}
