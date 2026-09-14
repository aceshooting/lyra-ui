import { isMainModule } from './is-main-module.mjs';

// Fails when a component re-declares a union the shared styling vocabulary already owns.
// Before 8.0.0 the library shipped ten byte-identical copies of
// `'neutral' | 'brand' | 'success' | 'warning' | 'danger'` under ten different names, spelled across
// three different property names (`variant`, `tone`, `kind`). The cost was not the duplication --
// it was that a consumer could not learn the vocabulary once, and that adding a sixth tone meant
// finding ten files. `src/internal/variants.ts` and `src/internal/shared-unions.ts` now own these
// reusable sets; a local copy is a drift vector, so it fails here rather than at review time.
// The check is on the MEMBER SET, not the name or the order: renaming the alias or reordering the
// members is exactly how the copies diverged in the first place.
// Run: node scripts/check-style-vocabulary.mjs

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const componentsRoot = join(packageDir, 'src', 'components');
const vocabularyPaths = [
  join(packageDir, 'src', 'internal', 'variants.ts'),
  join(packageDir, 'src', 'internal', 'shared-unions.ts'),
];

/** Every `export type X = 'a' | 'b';` in a source file, as a name -> sorted member list. */
export function readStringUnions(source) {
  const unions = new Map();
  // Deliberately only single-line unions with string-literal members: a multi-line or computed union
  // is not the shape this rule is about, and matching it loosely would produce false positives.
  for (const match of source.matchAll(/export type ([A-Za-z][\w]*)\s*=\s*((?:\s*'[^']*'\s*\|)+\s*'[^']*')\s*;/g)) {
    const members = [...match[2].matchAll(/'([^']*)'/g)].map((m) => m[1]);
    unions.set(match[1], members);
  }
  return unions;
}

export const key = (members) => [...members].sort().join('|');

const REGEX_MAY_FOLLOW = new Set([
  '', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^',
]);

/** Index just past a string or template literal opened at `start`, honouring backslash escapes. */
function endOfLiteral(source, start, quote) {
  for (let i = start + 1; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '\\') {
      i += 1;
      continue;
    }
    if (ch === quote) return i + 1;
  }
  return source.length;
}

/**
 * Index just past a regular-expression literal opened at `start`, or `start` itself when the text
 * is not one. Character classes are tracked because an unescaped `/` inside one does not close the
 * literal, and a newline rules the literal out entirely.
 */
function endOfRegex(source, start) {
  let inClass = false;
  for (let i = start + 1; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '\n') return start;
    if (ch === '\\') {
      i += 1;
      continue;
    }
    if (ch === '[') inClass = true;
    else if (ch === ']') inClass = false;
    else if (ch === '/' && !inClass) return i + 1;
  }
  return start;
}

/**
 * The same source with every comment replaced by a single space.
 *
 * Both readers below regex raw text, so without this they also read prose. A doc comment that
 * spells a vocabulary out -- "one of 'neutral' | 'brand' | 'success' | 'warning' | 'danger'" -- is
 * documentation, not a re-declaration, but it is textually identical to one, and this is a blocking
 * gate: a false positive here stops a release over a sentence. It also means a commented-out copy no
 * longer counts as a live one.
 *
 * The walk skips string, template and regular-expression literals, so a doubled slash inside a URL
 * string and a slash-star inside a glob cannot open a comment that swallows real code -- a false
 * NEGATIVE, which on a gate is worse than the false positive it was meant to prevent. Each comment
 * becomes one space so that deleting it cannot fuse the tokens on either side into a match nobody
 * wrote. A nested template literal ends the scan early; the tail is then kept verbatim, which can
 * only under-strip, never over-strip.
 */
export function stripComments(source) {
  let out = '';
  let previous = '';
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      out += ' ';
      i = end === -1 ? source.length : end;
      continue;
    }
    if (ch === '/' && next === '*') {
      const end = source.indexOf('*' + '/', i + 2);
      out += ' ';
      i = end === -1 ? source.length : end + 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const end = endOfLiteral(source, i, ch);
      out += source.slice(i, end);
      previous = ch;
      i = end;
      continue;
    }
    if (ch === '/' && REGEX_MAY_FOLLOW.has(previous)) {
      const end = endOfRegex(source, i);
      if (end > i) {
        out += source.slice(i, end);
        previous = '/';
        i = end;
        continue;
      }
    }
    out += ch;
    if (!/\s/.test(ch)) previous = ch;
    i += 1;
  }
  return out;
}

/**
 * Every string-literal union ANYWHERE in a source file, as a list of member lists.
 *
 * `readStringUnions` above only sees `export type X = 'a' | 'b';`, and that shape is exactly the
 * one a component stops using once it knows the rule exists. The same six size steps spelled
 * straight onto the property (`@property() size: '2xs' | 'xs' | ... = 'm'`), hidden in a
 * non-exported local alias, or wrapped across lines by the formatter all re-declare the ladder
 * while sailing past that regex -- which is how a "no component-local duplicates" pass can be
 * simultaneously green and wrong. Members are read per union, so a run of literals separated by
 * anything other than `|` (an array of allowed values, a tuple) is not a union and never matches.
 */
export function readInlineStringUnions(source) {
  const unions = [];
  for (const match of source.matchAll(/'[^'\n]*'(?:\s*\|\s*'[^'\n]*')+/g)) {
    unions.push({ members: [...match[0].matchAll(/'([^']*)'/g)].map((m) => m[1]) });
  }
  return unions;
}

/**
 * Whether a file already imports the canonical name it would otherwise be re-spelling. A file that
 * imports `LyraSizeStep` and then widens it locally (`LyraSizeStep | '3xs'`) is extending the
 * shared vocabulary, not forking it, and that is the difference this predicate draws.
 */
export function importsSharedUnion(source, name) {
  for (const match of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*'([^']*)'/g)) {
    if (!/internal\/(?:variants|shared-unions)(?:\.js)?$/.test(match[2])) continue;
    const imported = match[1]
      .split(',')
      .map((part) => part.replace(/^\s*type\s+/, '').split(/\s+as\s+/)[0].trim());
    if (imported.includes(name)) return true;
  }
  return false;
}

/** Combines canonical union sources while retaining the module a component should import. */
export function buildSharedVocabulary(sources) {
  const owners = new Map();
  for (const { modulePath, source } of sources) {
    for (const [name, members] of readStringUnions(source)) {
      const memberKey = key(members);
      const existing = owners.get(memberKey);
      if (existing) {
        throw new Error(
          `canonical union \`${name}\` in ${modulePath} duplicates \`${existing.name}\` in ${existing.modulePath}`
        );
      }
      owners.set(memberKey, { name, modulePath });
    }
  }
  return owners;
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.(class|types)\.ts$/.test(entry.name) || entry.name.endsWith('-types.ts') ? [file] : [];
  });
}

/**
 * Aliases a component MAY still declare locally, each with the reason. An entry here is a decision,
 * not a suppression: it says the union means something different from the shared one that happens to
 * share its members.
 */
export const ALLOWED = new Map([
  // `kind` on these is a media/content classification, not a semantic tone -- the members merely
  // happen to be short lowercase words. Collapsing them into LyraVariant would be wrong.
]);

/**
 * Inline re-spellings a component MAY still write, keyed `<repo-relative file>:<canonical name>`.
 * Same bar as ALLOWED above: an entry is a recorded decision that the members mean something other
 * than the shared vocabulary, not a way to keep a duplicate.
 */
export const ALLOWED_INLINE = new Map([
  // Empty by design: no component has yet earned an inline copy of a shared member set.
]);

/**
 * Which canonical modules the INLINE rule polices. The alias rule above covers both vocabularies,
 * because `export type X = ...` is always a fork. The inline rule is stricter -- it reads bare
 * annotations on properties, accessors and method parameters -- so it is scoped to the styling
 * vocabulary, where `size`/`variant`/`appearance` re-spelled locally is exactly the drift this file
 * exists to stop.
 *
 * `shared-unions.ts` is deliberately out: its members reach public signatures that mirror a native
 * or upstream contract verbatim -- `setSelectionRange`'s third parameter is spelled
 * `'forward' | 'backward' | 'none'` by the DOM itself -- and the pinned-manifest comparison reads
 * that printed text. Forcing an alias there would trade a cosmetic win for a parity risk. Three
 * such annotations exist today (`lr-input`, `lr-code-editor`, `lr-retrieval-trace`); widening this
 * set is the change that would have to argue with them one at a time.
 */
export const INLINE_RULE_MODULES = new Set(['internal/variants.ts']);

/**
 * Both rules for one file, over a comment-free view of it.
 *
 * The alias rule reports first, and its member sets suppress the inline rule for the same file, so
 * a component that both exports the copy and annotates with it is one finding naming one fix rather
 * than two describing the same line.
 */
export function fileFindings(where, rawSource, sharedByKey) {
  const source = stripComments(rawSource);
  const findings = [];
  const reported = new Set();
  for (const [name, members] of readStringUnions(source)) {
    const owner = sharedByKey.get(key(members));
    if (!owner) continue;
    // Recorded BEFORE the allowlist check, not after: an ALLOWED entry is a decision about the
    // member set, so it has to cover the inline rule too. Otherwise one decision needs a second
    // entry in a second map to stop the same members being reported twice.
    reported.add(key(members));
    if (ALLOWED.has(name)) continue;
    findings.push(
      `${where}: \`${name}\` duplicates \`${owner.name}\` -- import it from ${owner.modulePath} instead`
    );
  }
  for (const { members } of readInlineStringUnions(source)) {
    const memberKey = key(members);
    const owner = sharedByKey.get(memberKey);
    if (!owner || reported.has(memberKey)) continue;
    if (!INLINE_RULE_MODULES.has(owner.modulePath)) continue;
    if (importsSharedUnion(source, owner.name)) continue;
    if (ALLOWED_INLINE.has(`${where}:${owner.name}`)) continue;
    reported.add(memberKey);
    findings.push(
      `${where}: an inline union re-spells every member of \`${owner.name}\` -- import it from ${owner.modulePath} instead`
    );
  }
  return findings;
}

if (isMainModule(import.meta.url)) {
  const sharedByKey = buildSharedVocabulary(
    vocabularyPaths.map((file) => ({
      modulePath: relative(join(packageDir, 'src'), file).replaceAll('\\', '/'),
      source: readFileSync(file, 'utf8'),
    }))
  );
  if (sharedByKey.size === 0) {
    throw new Error('parsed no shared unions from the internal vocabulary modules -- their file shape changed');
  }

  const findings = [];
  for (const file of sourceFiles(componentsRoot)) {
    const where = relative(packageDir, file);
    findings.push(...fileFindings(where, readFileSync(file, 'utf8'), sharedByKey));
  }

  if (findings.length) {
    console.error(`Style-vocabulary contract failed with ${findings.length} finding(s):`);
    for (const finding of findings) console.error(`- ${finding}`);
    console.error(
      '\nShared unions live in src/internal/variants.ts and src/internal/shared-unions.ts. Re-export a local alias when a mirrored manifest contract requires its existing name.'
    );
    process.exitCode = 1;
  } else {
    console.log(`Style-vocabulary contract passed: ${sharedByKey.size} shared unions, no component-local duplicates.`);
  }
}
