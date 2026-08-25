import { realpathSync } from 'node:fs';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';

/** The only tag whose template body is a stylesheet. `html`/`svg`/`staticHtml` bodies are markup,
 * where a slash-star sequence is literal text rather than a comment, so they are deliberately not
 * scanned. */
const STYLE_TAG = 'css';

const NORMAL = 0;
const STRING = 1;
const URL = 2;
const COMMENT = 3;

const HORIZONTAL_WHITESPACE = /[ \t]/;
const WHITESPACE = /\s/;
/** Characters that would make a preceding `url` part of a longer identifier. Includes `\` because
 * CSS identifiers may carry escapes. */
const IDENTIFIER_TAIL = /[A-Za-z0-9_\-\\]/;

class CssCommentStripError extends Error {}

function isWhitespace(character) {
  return character != null && WHITESPACE.test(character);
}

/** True when `source` has a case-insensitive `url(` at `index` that opens a URL token rather than
 * ending some longer identifier. `previousCharacter` covers the case where the token starts at the
 * very beginning of a template chunk. */
function opensUrlToken(source, index, previousCharacter) {
  if (source.slice(index, index + 4).toLowerCase() !== 'url(') return false;
  const before = index > 0 ? source[index - 1] : previousCharacter;
  return before == null || !IDENTIFIER_TAIL.test(before);
}

/**
 * Strips CSS comments from one `css` tagged template's raw chunks.
 *
 * The chunks are the template's quasis: the literal text between the backticks and every
 * `${...}`. Scanner state is threaded across them so a string or `url()` that an interpolation
 * splits (`content: '${x}'`, `url(${dataUrl})`) keeps its context, and every interpolation is an
 * opaque atom that is never inspected, moved, or rewritten.
 *
 * Whitespace is preserved wherever removing the comment could weld two tokens into one: the
 * comment collapses to nothing only when a delimiter already survives on one side, and to a single
 * space otherwise. A comment occupying a whole line takes that line's indentation and newline with
 * it, which is always safe because the newline ending the *previous* line remains.
 *
 * @param {readonly string[]} chunks raw template text between interpolations
 * @param {string} describe context used in error messages
 * @returns {string[]} the same number of chunks, comment-free
 */
export function stripCssTemplateChunks(chunks, describe = 'css template') {
  let state = NORMAL;
  let quote = '';
  /** Last raw character consumed anywhere in the template, for `url(` boundary detection. */
  let lastCharacter = null;
  let commentStart = -1;

  const stripped = chunks.map((source, chunkIndex) => {
    const isFirstChunk = chunkIndex === 0;
    const isLastChunk = chunkIndex === chunks.length - 1;
    let out = '';
    let cursor = 0;
    let index = 0;

    /** Applies one comment's removal, choosing the whitespace-safe replacement. */
    const removeComment = (commentEnd) => {
      // Whole-line comment: swallow its indentation and its terminating newline. Safe because the
      // newline that ended the previous line is untouched, so a delimiter always survives.
      let lineStart = commentStart;
      while (lineStart > 0 && HORIZONTAL_WHITESPACE.test(source[lineStart - 1])) lineStart -= 1;
      let after = commentEnd;
      while (after < source.length && HORIZONTAL_WHITESPACE.test(source[after])) after += 1;
      const startsLine = lineStart > 0 && source[lineStart - 1] === '\n';
      let lineEnd = -1;
      if (source[after] === '\r' && source[after + 1] === '\n') lineEnd = after + 2;
      else if (source[after] === '\n') lineEnd = after + 1;
      if (startsLine && lineEnd !== -1) {
        out += source.slice(cursor, lineStart);
        cursor = lineEnd;
        return;
      }

      const emitted = out + source.slice(cursor, commentStart);
      const previous = emitted.length > 0 ? emitted[emitted.length - 1] : null;
      // Nothing at all precedes the first chunk's opening; an interpolation precedes every later
      // chunk, and `}` is not a delimiter.
      const previousIsDelimiter =
        previous == null ? isFirstChunk : isWhitespace(previous);
      const next = commentEnd < source.length ? source[commentEnd] : null;
      // Nothing follows the tail chunk; an interpolation follows every other chunk's end.
      const nextIsDelimiter = next == null ? isLastChunk : isWhitespace(next);

      out += source.slice(cursor, commentStart);
      if (!previousIsDelimiter && !nextIsDelimiter) out += ' ';
      cursor = commentEnd;
    };

    while (index < source.length) {
      const character = source[index];

      if (state === COMMENT) {
        if (character === '*' && source[index + 1] === '/') {
          index += 2;
          removeComment(index);
          state = NORMAL;
          continue;
        }
        index += 1;
        continue;
      }

      // A backslash escape is one opaque unit in every non-comment context, so an escaped `/`,
      // quote, or backtick can never be mistaken for syntax. This is also what keeps the escaped
      // backticks that appear inside several source comments intact.
      if (character === '\\') {
        lastCharacter = source[index + 1] ?? character;
        index += 2;
        continue;
      }

      if (state === STRING) {
        // CSS strings do not survive a raw newline; recover rather than swallowing the rest.
        if (character === quote || character === '\n') state = NORMAL;
        lastCharacter = character;
        index += 1;
        continue;
      }

      if (state === URL) {
        if (character === ')') state = NORMAL;
        lastCharacter = character;
        index += 1;
        continue;
      }

      if (character === '/' && source[index + 1] === '*') {
        // `\\/*` in raw text cooks to a backslash followed by `/*`, which CSS reads as an escape
        // rather than a comment. Refuse instead of guessing.
        const before = index > 0 ? source[index - 1] : null;
        if (before === '\\') {
          throw new CssCommentStripError(
            `${describe}: refusing to strip a comment preceded by a backslash escape`,
          );
        }
        commentStart = index;
        state = COMMENT;
        index += 2;
        continue;
      }

      if (character === '"' || character === "'") {
        quote = character;
        state = STRING;
        lastCharacter = character;
        index += 1;
        continue;
      }

      if (
        (character === 'u' || character === 'U') &&
        opensUrlToken(source, index, lastCharacter)
      ) {
        let scan = index + 4;
        while (scan < source.length && WHITESPACE.test(source[scan])) scan += 1;
        // A quoted URL is an ordinary string; only the unquoted form needs its own context. An
        // interpolated URL (`url(${x})`) runs off the end of the chunk and is unquoted.
        if (scan < source.length && (source[scan] === '"' || source[scan] === "'")) {
          lastCharacter = source[index + 3];
          index += 4;
          continue;
        }
        state = URL;
        lastCharacter = scan > index ? source[scan - 1] : character;
        index = scan;
        continue;
      }

      lastCharacter = character;
      index += 1;
    }

    if (state === COMMENT) {
      throw new CssCommentStripError(
        `${describe}: a CSS comment spans an interpolation or the end of the template`,
      );
    }

    return out + source.slice(cursor);
  });

  return stripped;
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
    node.tag.name === STYLE_TAG
  ) {
    found.push(node.quasi);
  }
  for (const key of Object.keys(node)) {
    if (key === 'parent') continue;
    collectStyleTemplates(node[key], found);
  }
}

/**
 * Removes CSS comments from every `css` tagged template in one emitted module.
 *
 * Only byte ranges strictly inside a template's literal chunks are rewritten, so every `${...}`
 * interpolation and every byte of surrounding JavaScript -- including ordinary JavaScript
 * comments -- is reproduced verbatim.
 *
 * @param {string} source emitted JavaScript
 * @param {string} filename for parser diagnostics and error messages
 * @returns {{ code: string, templates: number, chunksChanged: number, removedBytes: number }}
 */
export function stripCssCommentsFromModule(source, filename = 'module.js') {
  const parsed = parseSync(filename, source);
  const fatal = parsed.errors.filter((error) => error.severity !== 'Warning');
  if (fatal.length > 0) {
    throw new CssCommentStripError(
      `${filename}: parse failed: ${fatal.map((error) => error.message).join('; ')}`,
    );
  }
  const templates = [];
  collectStyleTemplates(parsed.program, templates);
  if (templates.length === 0) {
    return { code: source, templates: 0, chunksChanged: 0, removedBytes: 0 };
  }

  const edits = [];
  let chunksChanged = 0;
  for (const template of templates) {
    const ranges = template.quasis.map((quasi) => [quasi.start, quasi.end]);
    const chunks = ranges.map(([start, end]) => source.slice(start, end));
    const stripped = stripCssTemplateChunks(
      chunks,
      `${filename}:${template.start}`,
    );
    for (const [chunkIndex, [start, end]] of ranges.entries()) {
      if (stripped[chunkIndex] === chunks[chunkIndex]) continue;
      chunksChanged += 1;
      edits.push({ start, end, text: stripped[chunkIndex] });
    }
  }
  if (edits.length === 0) {
    return { code: source, templates: templates.length, chunksChanged: 0, removedBytes: 0 };
  }

  edits.sort((a, b) => a.start - b.start);
  let code = '';
  let cursor = 0;
  for (const edit of edits) {
    code += source.slice(cursor, edit.start) + edit.text;
    cursor = edit.end;
  }
  code += source.slice(cursor);
  assertInterpolationsSurvived(source, code, templates, filename);
  return {
    code,
    templates: templates.length,
    chunksChanged,
    removedBytes: Buffer.byteLength(source) - Buffer.byteLength(code),
  };
}

/** Re-parses the rewritten module and proves the rewrite moved no structure: the same modules'
 * worth of `css` templates, each with the same number of chunks and byte-identical interpolation
 * source text. A stripper that reached outside a chunk -- welding an interpolation into a comment,
 * or minting a stray backtick -- cannot survive this. */
function assertInterpolationsSurvived(source, code, beforeTemplates, filename) {
  const reparsed = parseSync(filename, code);
  const fatal = reparsed.errors.filter((error) => error.severity !== 'Warning');
  if (fatal.length > 0) {
    throw new CssCommentStripError(
      `${filename}: stripping produced unparseable output: ` +
        fatal.map((error) => error.message).join('; '),
    );
  }
  const afterTemplates = [];
  collectStyleTemplates(reparsed.program, afterTemplates);
  if (afterTemplates.length !== beforeTemplates.length) {
    throw new CssCommentStripError(
      `${filename}: css template count changed ` +
        `(${beforeTemplates.length} -> ${afterTemplates.length})`,
    );
  }
  for (const [index, before] of beforeTemplates.entries()) {
    const after = afterTemplates[index];
    if (before.expressions.length !== after.expressions.length) {
      throw new CssCommentStripError(
        `${filename}: interpolation count changed in css template ${index}`,
      );
    }
    for (const [expressionIndex, beforeExpression] of before.expressions.entries()) {
      const afterExpression = after.expressions[expressionIndex];
      if (
        source.slice(beforeExpression.start, beforeExpression.end) !==
        code.slice(afterExpression.start, afterExpression.end)
      ) {
        throw new CssCommentStripError(
          `${filename}: interpolation ${expressionIndex} of css template ${index} changed`,
        );
      }
    }
  }
}

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return javascriptFiles(fullPath);
      return entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
    }),
  );
  return nested.flat();
}

/**
 * Strips CSS comments from the `css` tagged templates of every emitted module under `directory`.
 *
 * Source keeps its comments: several of this library's defects were found because a comment stated
 * an invariant the code was violating. Only the published copy loses them, where they are 28% of
 * emitted style bytes that no consumer can read.
 *
 * @param {string} directory emitted JavaScript root (`dist`)
 */
export async function stripCssComments(directory) {
  const files = await javascriptFiles(directory);
  let filesChanged = 0;
  let templates = 0;
  let removedBytes = 0;
  await Promise.all(
    files.map(async (file) => {
      const source = await readFile(file, 'utf8');
      if (!source.includes('/*')) return;
      const result = stripCssCommentsFromModule(source, path.relative(directory, file));
      templates += result.templates;
      if (result.code === source) return;
      filesChanged += 1;
      removedBytes += result.removedBytes;
      await writeFile(file, result.code);
    }),
  );
  return { files: files.length, filesChanged, templates, removedBytes };
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const directory = process.argv[2] ? path.resolve(process.argv[2]) : path.join(packageDir, 'dist');
  const result = await stripCssComments(directory);
  console.log(
    `Stripped CSS comments from ${result.filesChanged} of ${result.files} modules: ` +
      `${result.removedBytes.toLocaleString('en')} bytes across ` +
      `${result.templates.toLocaleString('en')} css templates.`,
  );
}
