// Versioned Lyra rename and semantic-review transformations.

import {
  VOID_HTML_TAGS,
  camelCase,
  commentRanges,
  finalizeEdits,
  findTagEnd,
  kebabCase,
  lineStarts,
  localMigrationKey,
  locationAt,
  memberStyle,
  moduleSpecifierContext,
  parseNamedModuleBindings,
  parseTagAttributes,
  regexEscape,
  reportEntry,
  scanAllOpeningTags,
  scanLocalMigrationHazards,
  serializeLocalDefault,
  skipBalanced,
} from './migration-analysis.mjs';
import { invariant } from './migration-contract.mjs';
import { htmlCommentEnd } from './html-comments.mjs';


// ---------------------------------------------------------------------------------------------
// Lyra-to-Lyra rename and module-review profiles.
//
// Lyra-only names are short and shared: `open`, `base`, `lr-close` and many `--lr-*` properties
// each belong to several components, so a rewrite must never change what a site reaches.
//
// - Attributes, properties and slots are rewritten on a proven owner: the element carrying the
//   binding, the type selector in front of `[attr]`, or a `querySelector('lr-*')`-rooted call.
// - `::part()` is rewritten only when its compound selector names the owning component; a part
//   reached through a class, a foreign element or an `exportparts` forward is reported.
// - Events bubble and custom properties inherit, so ownership alone does not bound their reach.
//   A listener moves to the new name only when no other component already dispatches it, and an
//   unowned listener or any custom-property occurrence only when, in addition, every component
//   exposing the old name renamed it to that one target.
// - A boolean replaced by its inverse is rewritten only from a static attribute that reaches the
//   element as an attribute (HTML files and Lit templates); frameworks that assign properties
//   would receive the string.
//
// Everything else is reported with a location. During the alias window an old name keeps working,
// so a report avoids an unsafe rewrite. Already retired aliases get a separate removal report,
// without a promise that the old name still works. A report is acknowledged in place with a
// `lyra-migrate-reviewed: CODE:name` comment, which keeps `--check` usable as a CI gate.
// ---------------------------------------------------------------------------------------------

const RENAME_REVIEW = 'RENAME_REVIEW';
const RENAME_TARGET_SHARED_REVIEW = 'RENAME_TARGET_SHARED_REVIEW';
const NAME_GAINED_OWNER_REVIEW = 'NAME_GAINED_OWNER_REVIEW';
const POLARITY_REVIEW = 'POLARITY_REVIEW';
const DETAIL_SHAPE_REVIEW = 'DETAIL_SHAPE_REVIEW';
const DETAIL_FIELD_REVIEW = 'DETAIL_FIELD_REVIEW';
const DEPRECATED_MEMBER_REVIEW = 'DEPRECATED_MEMBER_REVIEW';
const DEPRECATED_CONTENT_REVIEW = 'DEPRECATED_CONTENT_REVIEW';
const RENAME_CONFLICT_REVIEW = 'RENAME_CONFLICT_REVIEW';
const UNUSED_ACKNOWLEDGEMENT = 'UNUSED_ACKNOWLEDGEMENT';
const REVIEW_ACKNOWLEDGEMENT = /lyra-migrate-reviewed:\s*([^\n]*)/g;
const ACKNOWLEDGEMENT_TOKEN = /^([A-Z][A-Z0-9_]*):(\S+)$/;
const DEFAULT_SLOT_LABEL = '#default';
const LISTENER_CALL_BEFORE = /(?:\b(?:add|remove)EventListener|\bHostListener)\s*\(\s*$/;
// The receiver of `receiver.addEventListener(` / `removeEventListener(`: a member chain whose
// segments may be calls with flat arguments (`document.querySelector('lr-x')`, `this.#card!`).
const LISTENER_RECEIVER_BEFORE =
  /([A-Za-z_$][\w$]*(?:\s*(?:\?\.|\.)\s*#?[A-Za-z_$][\w$]*|\s*\([^()\n]*\)|\s*!(?!=))*)\s*(?:\?\.|\.)\s*(?:add|remove)EventListener\s*\(\s*$/;
// A handler argument that is a plain reference. A function expression creates a new function on
// every call, so only a reference can make two registrations the same listener.
const LISTENER_HANDLER_AFTER = /^\s*,\s*([A-Za-z_$][\w$]*(?:\s*(?:\?\.|\.)\s*#?[A-Za-z_$][\w$]*)*)\s*[,)]/;
// An application that constructs a Lyra event itself (tests, adapters, re-dispatch) keeps sending
// the name it wrote; moving that name's listeners anywhere in the scanned set would disconnect them.
const EVENT_CONSTRUCTION = /\bnew\s+(?:CustomEvent|Event)\s*(?:<[^>\n]+>)?\(\s*(['"`])(lr-[a-z0-9]+(?:-[a-z0-9]+)*)\1/g;
const TAG_API_CALL_BEFORE =
  /(?:\b(?:createElement|querySelector(?:All)?|closest|matches|unsafeStatic|literal)|\bcustomElements\s*\.\s*(?:get|whenDefined|define))\s*(?:<[^>\n]+>)?\(\s*$/;
const ANCHORED_MEMBER =
  /\b(?:querySelector|closest|createElement)\s*(?:<[^>\n]+>)?\(\s*(['"`])(lr-[a-z0-9]+(?:-[a-z0-9]+)*)\1\s*\)\s*!?\s*(?:\?\.|\.)\s*([A-Za-z_$][\w$]*)/g;
const ATTRIBUTE_METHODS = new Set(['setAttribute', 'getAttribute', 'hasAttribute', 'removeAttribute', 'toggleAttribute']);
const LISTENER_METHODS = new Set(['addEventListener', 'removeEventListener']);
const STYLESHEET_FILE = /\.(?:css|scss|sass|less|pcss|styl)$/i;
const MARKUP_FILE = /\.(?:html?|xhtml|md|markdown|vue|svelte)$/i;
// Static attribute strings reach the element as attributes only in plain HTML (including Angular
// templates and Markdown) and in Lit `html` templates. React 19, Vue and Svelte assign a string to
// a same-named property, where "false" is truthy.
const ATTRIBUTE_SEMANTICS_FILE = /\.(?:html?|xhtml|md|markdown)$/i;
const LIT_TEMPLATE_FILE = /\.(?:[cm]?[jt]s)$/i;
const SELECTOR_LOOKBEHIND = 256;

const ackName = (member) => (member === '' ? DEFAULT_SLOT_LABEL : String(member));

function mergeRanges(ranges) {
  const merged = [];
  for (const [start, end] of [...ranges].sort((left, right) => left[0] - right[0])) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/** A logarithmic membership test over merged, sorted ranges. */
function rangeTester(merged) {
  return (offset) => {
    let low = 0;
    let high = merged.length - 1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (merged[middle][1] <= offset) low = middle + 1;
      else if (merged[middle][0] > offset) high = middle - 1;
      else return true;
    }
    return false;
  };
}

/** Index just past the template literal whose opening backtick is at `open`, including nested `${}`. */
function templateLiteralEnd(text, open) {
  let index = open + 1;
  while (index < text.length) {
    const character = text[index];
    if (character === '\\') index += 2;
    else if (character === '`') return index + 1;
    else if (character === '$' && text[index + 1] === '{') index = templateExpressionEnd(text, index + 2);
    else index += 1;
  }
  return text.length;
}

function templateExpressionEnd(text, index) {
  let depth = 1;
  while (index < text.length) {
    const character = text[index];
    if (character === '`') {
      index = templateLiteralEnd(text, index);
      continue;
    }
    if (character === '"' || character === "'") {
      index += 1;
      while (index < text.length && text[index] !== character && text[index] !== '\n') index += text[index] === '\\' ? 2 : 1;
      index += 1;
      continue;
    }
    if (character === '{') depth += 1;
    else if (character === '}' && --depth === 0) return index + 1;
    index += 1;
  }
  return text.length;
}

/** Top-level template literals in a script, skipping comments and quoted strings. */
function templateLiteralRanges(text, inComment) {
  const ranges = [];
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (inComment(index)) index += 1;
    else if (character === '`') {
      const end = templateLiteralEnd(text, index);
      ranges.push([index, end]);
      index = end;
    } else if (character === '"' || character === "'") {
      index += 1;
      while (index < text.length && text[index] !== character && text[index] !== '\n') index += text[index] === '\\' ? 2 : 1;
      index += 1;
    } else index += 1;
  }
  return ranges;
}

/** [start, end] of every `tag`-tagged template literal body (Lit `html`, `svg` or `css`). */
function taggedTemplateRanges(text, tags, inComment) {
  const ranges = [];
  for (const match of text.matchAll(new RegExp(`\\b(?:${tags.join('|')})\\s*\``, 'g'))) {
    if (inComment(match.index)) continue;
    const open = match.index + match[0].length - 1;
    ranges.push([open, templateLiteralEnd(text, open)]);
  }
  return mergeRanges(ranges);
}

/**
 * Comment ranges for the rename profile: the shared scanner's, plus HTML comments it cannot see --
 * every `<!-- -->` in a markup file, and those inside template literals (Lit `html` templates,
 * inline Angular templates) in a script. Names inside them are never rewritten, and they can carry
 * acknowledgements.
 */
function renameIgnoredRanges(text, file) {
  const base = mergeRanges(commentRanges(text));
  const inBase = rangeTester(base);
  const extra = [];
  const addHtmlComments = (start, end) => {
    let index = text.indexOf('<!--', start);
    while (index >= 0 && index < end) {
      const finish = htmlCommentEnd(text, index, end);
      if (!inBase(index)) extra.push([index, finish]);
      index = text.indexOf('<!--', finish);
    }
  };
  if (MARKUP_FILE.test(file)) addHtmlComments(0, text.length);
  else if (!STYLESHEET_FILE.test(file)) for (const [start, end] of templateLiteralRanges(text, inBase)) addHtmlComments(start, end);
  return mergeRanges([...base, ...extra]);
}

/**
 * Acknowledgement comments. A `lyra-migrate-reviewed: CODE:name` token covers the comment's own
 * lines; a comment alone on its line (a JSX `{/* ... *\/}` counts) also covers the next line; and a
 * comment followed only by whitespace and an opening tag covers every line of that tag, so a
 * reviewed element whose attributes wrap still takes a single comment.
 */
function scanReviewAcknowledgements(text, ignoredRanges, starts, openingTokens) {
  const tokenAt = new Map(openingTokens.map((token) => [token.start, token]));
  const records = [];
  const byLine = new Map();
  const cover = (line, record) => {
    const list = byLine.get(line) ?? [];
    if (!list.includes(record)) list.push(record);
    byLine.set(line, list);
  };
  for (const [start, end] of ignoredRanges) {
    const body = text.slice(start, end);
    if (!body.includes('lyra-migrate-reviewed:')) continue;
    const firstLine = locationAt(starts, start).line;
    const lastLine = locationAt(starts, Math.max(start, end - 1)).line;
    let next = end;
    while (next < text.length && /[\s}]/.test(text[next])) next += 1;
    const followingTag = tokenAt.get(next);
    const standalone = /^\s*\{?\s*$/.test(text.slice(starts[firstLine - 1], start));
    for (const match of body.matchAll(REVIEW_ACKNOWLEDGEMENT)) {
      const tokens = match[1].replace(/(?:\*\/|--!?>)[\s\S]*$/, '').split(/[\s,]+/).filter(Boolean);
      const record = {
        offset: start + match.index,
        entries: tokens.map((token) => {
          const parsed = ACKNOWLEDGEMENT_TOKEN.exec(token);
          return { token, code: parsed?.[1] ?? null, name: parsed?.[2] ?? null, used: false };
        }),
      };
      records.push(record);
      for (let line = firstLine; line <= lastLine; line += 1) cover(line, record);
      if (standalone) cover(lastLine + 1, record);
      if (followingTag) {
        const tagLast = locationAt(starts, followingTag.end).line;
        for (let line = locationAt(starts, followingTag.start).line; line <= tagLast; line += 1) cover(line, record);
      }
    }
  }
  return {
    consume(line, code, member) {
      const name = ackName(member);
      for (const record of byLine.get(line) ?? []) {
        const entry = record.entries.find((candidate) => candidate.code === code && candidate.name === name);
        if (entry) {
          entry.used = true;
          return true;
        }
      }
      return false;
    },
    unused: () => records.flatMap((record) => record.entries.filter((entry) => !entry.used).map((entry) => ({ offset: record.offset, entry }))),
  };
}

/** Single- and double-quoted string literals outside comments; template literals stay opaque. */
function quotedStringRanges(text, inComment) {
  const ranges = [];
  let index = 0;
  while (index < text.length) {
    const quote = text[index];
    if (inComment(index) || (quote !== '"' && quote !== "'" && quote !== '`')) {
      index += 1;
      continue;
    }
    const start = index;
    index += 1;
    while (index < text.length && text[index] !== quote && (quote === '`' || text[index] !== '\n')) {
      if (text[index] === '\\') index += 1;
      index += 1;
    }
    index += 1;
    if (quote !== '`') ranges.push([start, index]);
  }
  return ranges;
}

function stylesheetRanges(text, file, inComment) {
  if (STYLESHEET_FILE.test(file)) return [[0, text.length]];
  const ranges = [];
  for (const match of text.matchAll(/<style(?:\s[^>]*)?>[\s\S]*?<\/style\s*>/gi)) {
    ranges.push([match.index, match.index + match[0].length]);
  }
  return mergeRanges([...ranges, ...taggedTemplateRanges(text, ['css'], inComment)]);
}

/** The type selector of the compound selector that ends at `index`, lowercased, or null. */
function compoundTypeBefore(text, index) {
  let start = index;
  let brackets = 0;
  let parens = 0;
  const limit = Math.max(0, index - SELECTOR_LOOKBEHIND);
  while (start > limit) {
    const character = text[start - 1];
    if (character === ']') brackets += 1;
    else if (character === '[') {
      if (brackets === 0) break;
      brackets -= 1;
    } else if (character === ')') parens += 1;
    else if (character === '(') {
      if (parens === 0) break;
      parens -= 1;
    } else if (brackets === 0 && parens === 0 && /[\s,>+~{};'"`]/.test(character)) break;
    start -= 1;
  }
  if (start === limit && limit > 0) return null;
  const compound = text.slice(start, index);
  // Svelte scopes a component selector as `:global(lr-x)::part(y)`.
  return (/^:global\(\s*([A-Za-z][\w-]*)\s*\)$/.exec(compound) ?? /^([A-Za-z][\w-]*)/.exec(compound))?.[1].toLowerCase() ?? null;
}

function mentionedTags(text, tags, inComment) {
  const found = new Set();
  for (const tag of tags) {
    for (const match of text.matchAll(new RegExp(`(?<![\\w-])${tag}(?![\\w-])`, 'g'))) {
      if (!inComment(match.index)) {
        found.add(tag);
        break;
      }
    }
  }
  return found;
}

function elementPairs(text, tag, inComment) {
  const pairs = [];
  const stack = [];
  for (const match of text.matchAll(new RegExp(`<(/)?${tag}(?=[\\s/>])`, 'g'))) {
    if (inComment(match.index)) continue;
    const end = findTagEnd(text, match.index + match[0].length);
    if (end < 0) continue;
    if (match[1]) {
      const opening = stack.pop();
      if (opening) pairs.push({ opening, closingStart: match.index });
    } else if (!/\/\s*>$/.test(text.slice(match.index, end + 1))) {
      stack.push({ start: match.index, end });
    }
  }
  return pairs;
}

function directChildTokens(text, start, end, inComment) {
  const children = [];
  const stack = [];
  const pattern = /<(\/)?([A-Za-z][\w.:-]*)(?=[\s/>])/g;
  pattern.lastIndex = start;
  for (let match = pattern.exec(text); match && match.index < end; match = pattern.exec(text)) {
    if (inComment(match.index)) continue;
    const tokenEnd = findTagEnd(text, match.index + match[0].length);
    if (tokenEnd < 0 || tokenEnd >= end) break;
    const name = match[2].toLowerCase();
    if (match[1]) {
      const index = stack.lastIndexOf(name);
      if (index >= 0) stack.length = index;
    } else {
      const nameStart = match.index + 1;
      if (stack.length === 0) children.push({ tag: name, start: match.index, nameStart, nameEnd: nameStart + match[2].length, end: tokenEnd });
      const selfClosing = /\/\s*>$/.test(text.slice(match.index, tokenEnd + 1));
      if (!selfClosing && !VOID_HTML_TAGS.has(name)) stack.push(name);
    }
    pattern.lastIndex = tokenEnd + 1;
  }
  return children;
}

/** `{...}` groups at attribute-name position in an opening tag: JSX/Svelte spreads and Svelte shorthands. */
function openingTagBraceGroups(text, token) {
  const groups = [];
  let index = token.nameEnd;
  let quote = null;
  while (index < token.end) {
    const character = text[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = null;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '{') {
      const end = skipBalanced(text, index, '{', '}');
      if (!/=\s*$/.test(text.slice(token.nameEnd, index)) && text[index - 1] !== '$') {
        groups.push({ start: index, end, body: text.slice(index + 1, end - 1).trim() });
      }
      index = end;
      continue;
    }
    index += 1;
  }
  return groups;
}

/** An event listener binding in any supported template syntax, or null. */
function markupEventName(rawName) {
  if (/^\(lr-[a-z0-9-]+\)$/.test(rawName)) return { name: rawName.slice(1, -1), offset: 1 };
  if (/^onlr-/.test(rawName)) return { name: rawName.slice(2).replace(/Capture$/, ''), offset: 2 };
  for (const [prefix, separator] of [['@', '.'], ['v-on:', '.'], ['on:', '|']]) {
    if (rawName.startsWith(prefix)) return { name: rawName.slice(prefix.length).split(separator)[0], offset: prefix.length };
  }
  return null;
}

/**
 * An attribute or property binding: `form` is `attribute`, `property`, or `member` (Vue's `:x`,
 * which binds a property when the element has one and an attribute otherwise).
 */
function markupMemberBinding(attribute) {
  const raw = attribute.rawName;
  let match;
  if (raw.startsWith('?')) return { form: 'attribute', offset: 1, name: raw.slice(1), dynamic: true };
  if ((match = /^\[attr\.([^\]]+)\]$/.exec(raw))) return { form: 'attribute', offset: 6, name: match[1], dynamic: true };
  if ((match = /^\[([A-Za-z_$][\w$]*)\]$/.exec(raw))) return { form: 'property', offset: 1, name: match[1], dynamic: true };
  if (raw.startsWith('.')) return { form: 'property', offset: 1, name: raw.slice(1), dynamic: true };
  if (raw.startsWith('bind:')) return { form: 'property', offset: 5, name: raw.slice(5).split('|')[0], dynamic: true };
  for (const prefix of ['v-bind:', ':']) {
    if (raw.startsWith(prefix)) return { form: 'member', offset: prefix.length, name: raw.slice(prefix.length).split('.')[0], dynamic: true };
  }
  if (!/^[A-Za-z][\w-]*$/.test(raw) || /^onlr-/.test(raw)) return null;
  const dynamic = attribute.valueKind === 'expression' || /\$\{|\{\{/.test(attribute.value ?? '');
  return { form: /[A-Z]/.test(raw) ? 'property' : 'attribute', offset: 0, name: raw, dynamic };
}

function attributeEnd(text, attribute) {
  if (attribute.valueEnd === null) return attribute.nameEnd;
  const quote = text[attribute.valueStart - 1];
  return (quote === '"' || quote === "'") && text[attribute.valueEnd] === quote ? attribute.valueEnd + 1 : attribute.valueEnd;
}

function boundMemberNames(attributes) {
  const names = new Set();
  for (const attribute of attributes) {
    const binding = markupMemberBinding(attribute);
    if (binding) names.add(kebabCase(binding.name));
  }
  return names;
}

function sortReportEntries(entries, codeKey) {
  return entries.sort((left, right) =>
    left.line - right.line || left.column - right.column || String(left[codeKey]).localeCompare(String(right[codeKey])));
}

/**
 * Module migrations are semantic reviews, never edits. Imports establish ownership for named
 * exports; window events and root attributes have global reach and need no local module import.
 * Namespace/dynamic imports remain explicit review sites because a text scanner cannot follow
 * all aliases, destructuring, callback arguments or re-exports across application modules.
 */
function reportModuleReviews(text, file, reviews, openingTokens, inComment, warn) {
  if (!reviews.length) return;
  const packageName = '@aceshooting/lyra-ui';
  const specifierOf = (subpath) => `${packageName}${subpath.slice(1)}`;
  const named = reviews.filter((entry) => ['function', 'type', 'constant', 'class'].includes(entry.kind));
  const report = (offset, review, context = '') => warn(offset, {
    member: review.name,
    code: 'DEPRECATED_MODULE_REVIEW',
    target: review.replacement,
    message: `${context}${review.kind} ${review.module ? `${review.module}#` : ''}${review.name} ${review.removedIn ? `was removed in ${review.removedIn}` : `is deprecated and scheduled for removal in ${review.removalNotBefore}`}; review ${review.replacement}.`,
  });
  const namedFor = (specifier) => named.filter((entry) => specifier === packageName || specifier === specifierOf(entry.module));
  const strings = quotedStringRanges(text, inComment);
  const templates = templateLiteralRanges(text, inComment);
  const stringStarts = new Set([...strings, ...templates.filter(([start, end]) => !text.slice(start, end).includes('${'))].map(([start]) => start));
  const inString = rangeTester(strings);
  const inLiteral = rangeTester(mergeRanges([...strings, ...templates]));
  const inCss = rangeTester(stylesheetRanges(text, file, inComment));
  const inMarkup = (offset) => openingTokens.some((token) => offset >= token.nameEnd && offset < token.end);
  const opaque = (offset, specifier, entries) => {
    if (!entries.length) return;
    warn(offset, {
      member: specifier,
      code: 'MODULE_NAMESPACE_REVIEW',
      target: [...new Set(entries.map((entry) => entry.replacement))].join('; '),
      message: `Review the namespace or dynamic import of ${specifier} for deprecated exports ${entries.map((entry) => entry.name).join(', ')}. They cannot be safely renamed through aliases; the earliest removal is ${entries.map((entry) => entry.removalNotBefore).sort()[0]}.`,
    });
  };

  // Static named imports and re-exports, including import/export type and per-binding type.
  const bindings = /\b(?:import|export)\s+(?:type\s+)?(?:[$A-Z_a-z][$\w]*\s*,\s*)?\{(?<bindings>[^{};]*)\}\s*from\s*(?<quote>['"])(?<source>@aceshooting\/lyra-ui(?:\/[^'"\s]+)?)\k<quote>/g;
  const handledSpecifiers = new Set();
  for (const match of text.matchAll(bindings)) {
    if (inComment(match.index) || inLiteral(match.index)) continue;
    const available = namedFor(match.groups.source);
    const bodyStart = match.index + match[0].indexOf('{') + 1;
    for (const binding of parseNamedModuleBindings(match.groups.bindings)) {
      const review = available.find((entry) => entry.name === binding.imported);
      if (!review) continue;
      const member = [...match.groups.bindings.matchAll(new RegExp(`(?<![$\\w])${regexEscape(binding.imported)}(?![$\\w])`, 'g'))]
        .find((candidate) => !inComment(bodyStart + candidate.index));
      if (member) report(bodyStart + member.index, review);
    }
    handledSpecifiers.add(match.index + match[0].lastIndexOf(match.groups.source) - 1);
  }

  for (const match of text.matchAll(/(['"])(@aceshooting\/lyra-ui(?:\/[^'"\s]+)?)\1/g)) {
    if (inComment(match.index)) continue;
    const markup = inMarkup(match.index);
    const css = inCss(match.index);
    if (!stringStarts.has(match.index) && !markup && !css) continue;
    const before = text.slice(Math.max(0, match.index - 500), match.index);
    const context = moduleSpecifierContext(text, match.index);
    const cssImport = css && /@import\s+(?:url\(\s*)?$/.test(before);
    const resource = markup && /\b(?:href|src)\s*=\s*$/.test(before);
    if (!context && !cssImport && !resource) continue;
    const specifier = match[2];
    for (const review of reviews) {
      if ((review.kind === 'entry-point' || review.kind === 'stylesheet') && specifier === specifierOf(review.name)) {
        report(match.index + 1, review);
      }
    }
    if (handledSpecifiers.has(match.index) || !context || context.sideEffect) continue;
    const available = namedFor(specifier);
    if (context.kind === 'binding' && /\bexport\s+(?:type\s+)?\*\s*(?:as\s+[$A-Z_a-z][$\w]*\s*)?from\s*$/.test(before)) {
      for (const review of available) report(match.index + 1, review, 'This re-export includes ');
    } else {
      opaque(match.index + 1, specifier, available);
    }
  }

  // CSS permits unquoted url() in @import. Other URLs are ordinary caller data.
  for (const match of text.matchAll(/@import\s+url\(\s*(@aceshooting\/lyra-ui\/[^\s)'";]+)\s*\)/g)) {
    if (inComment(match.index) || !inCss(match.index)) continue;
    for (const review of reviews) {
      if (review.kind === 'stylesheet' && match[1] === specifierOf(review.name)) {
        report(match.index + match[0].indexOf(match[1]), review);
      }
    }
  }

  for (const review of reviews) {
    if (review.kind === 'window-event') {
      for (const match of text.matchAll(new RegExp(`(['"\\x60])(${regexEscape(review.name)})\\1`, 'g'))) {
        if (inComment(match.index)) continue;
        const before = text.slice(Math.max(0, match.index - 200), match.index);
        if (LISTENER_CALL_BEFORE.test(before) || /\bnew\s+(?:CustomEvent|Event)\s*(?:<[^>\n]+>)?\(\s*$/.test(before)) {
          if (stringStarts.has(match.index)) report(match.index + 1, review);
        }
      }
    } else if (review.kind === 'root-attribute') {
      const attributeOffsets = new Set();
      for (const token of openingTokens) {
        for (const attribute of parseTagAttributes(text, token)) {
          const name = attribute.rawName.replace(/^\[attr\.(.+)\]$/, '$1').replace(/^(?:v-bind:|bind:|[?:])/, '');
          if (name === review.name && !inString(attribute.nameStart)) {
            attributeOffsets.add(attribute.nameStart + attribute.rawName.indexOf(review.name));
          }
        }
      }
      for (const match of text.matchAll(new RegExp(`(?<![\\w-])${regexEscape(review.name)}(?![\\w-])`, 'g'))) {
        if (inComment(match.index)) continue;
        const offset = match.index;
        const before = text.slice(Math.max(0, offset - 180), offset);
        const after = text.slice(offset + review.name.length);
        const literalApi = /\b(?:getAttribute|setAttribute|hasAttribute|removeAttribute|toggleAttribute)\s*\(\s*['"`]$/.test(before);
        const selector = /\[\s*$/.test(before) && /^\s*(?:[~|^$*]?=|\])/.test(after);
        const markup = attributeOffsets.has(offset);
        if ((literalApi && stringStarts.has(offset - 1)) || (selector && (inCss(offset) || inString(offset))) || markup) report(offset, review);
      }
      const datasetName = review.name.slice(5).replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
      const dataset = new RegExp(`\\bdataset\\s*(?:\\.\\s*${regexEscape(datasetName)}\\b|\\[\\s*(['"])${regexEscape(datasetName)}\\1\\s*\\])`, 'g');
      for (const match of text.matchAll(dataset)) {
        if (!inComment(match.index) && !inLiteral(match.index)) report(match.index, review);
      }
    }
  }
}

const GLOBAL_REVIEW = 'GLOBAL_REVIEW';
const LYRA_PACKAGE = '@aceshooting/lyra-ui';
const NODE_MODULES_LEAD = /(?:^|\/)node_modules\/$/;
const JSON_FILE = /\.json$/i;
const IDENTIFIER = '[$A-Za-z_][$\\w]*';

/**
 * Profile `globals`: entries no `lr-*` tag owns. A `module` entry rewrites a package specifier where
 * it is provably a specifier (import/export-from, dynamic import, require, CSS @import, `<link href>`
 * and `<script src>`, a `node_modules/...` path, any string in a JSON file) and reports it anywhere
 * else. An `export` entry rewrites a root-barrel named import or re-export to `New as Old` (or
 * `New as Local` when already aliased), so no scope analysis is needed, and reports every other use.
 * A `locale-key` entry only reports.
 */
function applyGlobals(text, file, entries, { inComment, inCss, openingTokens, rewrite, warn }) {
  const modules = entries.filter((entry) => entry.kind === 'module');
  const exported = entries.filter((entry) => entry.kind === 'export');
  const localeKeys = entries.filter((entry) => entry.kind === 'locale-key');
  const review = (offset, entry, member, message) =>
    warn(offset, { member, code: GLOBAL_REVIEW, target: entry.to, message });

  if (modules.length) {
    const inMarkup = (offset) => openingTokens.some((token) => offset >= token.nameEnd && offset < token.end);
    const handle = (entry, specifierStart, specifier, safe) => {
      if (safe) {
        rewrite(specifierStart, specifierStart + entry.from.length, entry.to, {
          tag: null, member: specifier, action: 'rewrite-module', target: entry.to,
          message: `Rewrite ${entry.from} to ${entry.to}: ${entry.summary}`,
        });
      } else {
        review(specifierStart, entry, specifier,
          `${specifier} is not provably a module specifier here (or is computed): ${entry.summary} Use ${entry.to}${entry.prefix ? '...' : ''} instead.`);
      }
    };
    const entryFor = (specifier) => modules.find((entry) => entry.prefix
      ? specifier.startsWith(entry.from) && !(entry.except ?? []).some((prefix) => specifier.startsWith(prefix))
      : specifier === entry.from);
    for (const match of text.matchAll(/(['"`])([^'"`\n]*?@aceshooting\/lyra-ui\/[^'"`\n]*)\1/g)) {
      if (inComment(match.index)) continue;
      const at = match[2].indexOf('@aceshooting/');
      const lead = match[2].slice(0, at);
      if (lead && !NODE_MODULES_LEAD.test(lead)) continue;
      const specifier = match[2].slice(at);
      const entry = entryFor(specifier);
      if (!entry) continue;
      const specifierStart = match.index + 1 + at;
      const before = text.slice(Math.max(0, match.index - 500), match.index);
      const context = moduleSpecifierContext(text, match.index);
      const cssImport = inCss(match.index) && /@import\s+(?:url\(\s*)?$/.test(before);
      const resource = inMarkup(match.index) && /\b(?:href|src)\s*=\s*$/.test(before);
      const safe = !specifier.includes('${') && Boolean(lead || JSON_FILE.test(file) || context || cssImport || resource);
      handle(entry, specifierStart, specifier, safe);
    }
    for (const match of text.matchAll(/@import\s+url\(\s*(@aceshooting\/lyra-ui\/[^\s)'";]+)\s*\)/g)) {
      const entry = entryFor(match[1]);
      if (inComment(match.index) || !inCss(match.index) || !entry) continue;
      handle(entry, match.index + match[0].indexOf(match[1]), match[1], true);
    }
  }

  if (exported.length) {
    const bindingsPattern = new RegExp(
      `\\b(?:import|export)\\s+(?:type\\s+)?(?:${IDENTIFIER}\\s*,\\s*)?\\{(?<body>[^{};]*)\\}\\s*from\\s*(?<quote>['"])(?<source>${regexEscape(LYRA_PACKAGE)}(?:\\/[^'"\\s]+)?)\\k<quote>`, 'g');
    const segment = new RegExp(`^(\\s*(?:type\\s+)?)(${IDENTIFIER})(\\s+as\\s+${IDENTIFIER})?\\s*$`, 'd');
    for (const match of text.matchAll(bindingsPattern)) {
      if (inComment(match.index)) continue;
      const bodyStart = match.index + match[0].indexOf('{') + 1;
      for (const part of match.groups.body.matchAll(/[^,]+/g)) {
        const parsed = segment.exec(part[0]);
        const entry = parsed && exported.find((candidate) => candidate.from === parsed[2]);
        if (!entry) continue;
        const nameStart = bodyStart + part.index + parsed.indices[2][0];
        if (inComment(nameStart)) continue;
        if (match.groups.source === LYRA_PACKAGE) {
          rewrite(nameStart, nameStart + entry.from.length, parsed[3] ? entry.to : `${entry.to} as ${entry.from}`, {
            tag: null, member: entry.from, action: 'rewrite-export', target: entry.to,
            message: `${entry.from} no longer exists; import ${entry.to}${parsed[3] ? '' : ` as ${entry.from}`}: ${entry.summary}`,
          });
        } else {
          review(nameStart, entry, entry.from,
            `${entry.from} is not exported by ${match.groups.source} any more: ${entry.summary} Import ${entry.to} from ${LYRA_PACKAGE}.`);
        }
      }
    }
    const aliases = [...text.matchAll(new RegExp(`import\\s+(?:type\\s+)?\\*\\s+as\\s+(${IDENTIFIER})\\s+from\\s*(['"])${regexEscape(LYRA_PACKAGE)}\\2`, 'g'))].map((match) => match[1]);
    const receivers = [...aliases.map(regexEscape), `import\\(\\s*['"]${regexEscape(LYRA_PACKAGE)}['"]\\s*\\)`];
    for (const entry of exported) {
      for (const match of text.matchAll(new RegExp(`(?<![$\\w.])(?:${receivers.join('|')})\\s*\\.\\s*${entry.from}(?![$\\w])`, 'g'))) {
        if (!inComment(match.index)) review(match.index + match[0].lastIndexOf(entry.from), entry, entry.from, `${entry.from} no longer exists: ${entry.summary} Use ${entry.to}.`);
      }
    }
  }

  for (const entry of entries.filter((candidate) => candidate.kind === 'css-property')) {
    const pattern = new RegExp(`${regexEscape(entry.from)}${entry.prefix ? '[\\w-]*' : '(?![\\w-])'}`, 'g');
    for (const match of text.matchAll(pattern)) {
      if (inComment(match.index)) continue;
      review(match.index, entry, match[0], `The custom property ${match[0]} was removed: ${entry.summary} Use ${entry.to}.`);
    }
  }
  const parts = entries.filter((candidate) => candidate.kind === 'part');
  if (parts.length) {
    for (const match of text.matchAll(/::part\(([^)]*)\)/g)) {
      if (inComment(match.index)) continue;
      const names = match[1].trim().split(/\s+/);
      const type = compoundTypeBefore(text, match.index);
      for (const entry of parts) {
        if (!names.includes(entry.from) || !(type === entry.tag || (!type && text.includes(entry.tag)))) continue;
        review(match.index + match[0].indexOf(entry.from), entry, entry.from, `The ${entry.tag} part ${entry.from} changed: ${entry.summary} ${entry.to}`);
      }
    }
  }

  if (localeKeys.length && /registerLyraLocale|bridgeLyraLocale|\.strings\b|@aceshooting\/lyra-ui/.test(text)) {
    for (const entry of localeKeys) {
      for (const match of text.matchAll(new RegExp(`(?<![$\\w.-])${entry.from}(?![$\\w-])`, 'g'))) {
        const before = text[match.index - 1] ?? '';
        const after = text.slice(match.index + entry.from.length, match.index + entry.from.length + 12);
        const quoted = /['"`]/.test(before) && /^['"`]/.test(after);
        if (inComment(match.index) || !(quoted || /^\s*:/.test(after))) continue;
        review(match.index, entry, entry.from, `The localization key ${entry.from} was removed; use ${entry.to}: ${entry.summary}`);
      }
    }
  }
}

export function migrateRenameText(original, contract, options) {
  const file = options.file ?? '<memory>';
  const origin = options.origin;
  const profile = contract.renameProfiles.get(origin);
  invariant(profile, `unknown migration origin ${String(origin)}`);
  const result = {
    content: original,
    changes: [],
    warnings: [],
    acknowledged: 0,
    usage: {
      webawesome: { automatic: 0, manual: 0 },
      shoelace: { automatic: 0, manual: 0 },
    },
    blockedMappings: new Set(),
    blockedEcosystems: new Set(),
    bareImportEcosystems: new Set(),
    blockedLocalMigrations: new Set(),
    constructedEvents: new Set(),
  };
  if (profile.isEmpty) return result;

  const starts = lineStarts(original);
  const ignoredRanges = renameIgnoredRanges(original, file);
  const inComment = rangeTester(ignoredRanges);
  const openingTokens = scanAllOpeningTags(original, ignoredRanges, inComment);
  const acknowledgements = scanReviewAcknowledgements(original, ignoredRanges, starts, openingTokens);
  const litTemplates = LIT_TEMPLATE_FILE.test(file) ? rangeTester(taggedTemplateRanges(original, ['html', 'svg'], inComment)) : () => false;
  const inLiteral = rangeTester(mergeRanges([
    ...quotedStringRanges(original, inComment),
    ...templateLiteralRanges(original, inComment),
  ]));
  const inCss = rangeTester(stylesheetRanges(original, file, inComment));
  const attributeSemantics = (offset) => ATTRIBUTE_SEMANTICS_FILE.test(file) || litTemplates(offset);
  const release = `Lyra ${profile.toMajor}`;
  const removal = `${profile.aliasRemovalMajor}.0.0`;
  for (const match of original.matchAll(EVENT_CONSTRUCTION)) {
    if (!inComment(match.index) && profile.renamesNamed('event', match[2]).length) result.constructedEvents.add(match[2]);
  }
  const constructedEvents = new Set([...(options.constructedEvents ?? []), ...result.constructedEvents]);
  // Listener calls by receiver and handler text. One handler added for both an old name and its
  // new name on one receiver runs twice per activation while both names fire; renamed, the DOM
  // keeps only one of the two identical registrations and the handler would silently run once.
  const listenerIdentity = (quote, name) => {
    const receiver = LISTENER_RECEIVER_BEFORE.exec(original.slice(Math.max(0, quote - 200), quote))?.[1];
    const handler = LISTENER_HANDLER_AFTER.exec(original.slice(quote + name.length + 2, quote + name.length + 202))?.[1];
    return receiver && handler ? `${receiver.replace(/\s+/g, '')}\u0000${handler.replace(/\s+/g, '')}` : null;
  };
  const listenedNames = new Map();
  if (profile.data.renames.some((entry) => entry.kind === 'event')) {
    for (const match of original.matchAll(/(['"`])(lr-[a-z0-9]+(?:-[a-z0-9]+)*)\1/g)) {
      if (inComment(match.index) || !LISTENER_CALL_BEFORE.test(original.slice(Math.max(0, match.index - 120), match.index))) continue;
      const identity = listenerIdentity(match.index, match[2]);
      if (identity) listenedNames.set(identity, new Set([...(listenedNames.get(identity) ?? []), match[2]]));
    }
  }
  /** Whether this listener call's receiver already adds or removes the same handler for a new name of `name`. */
  const sameHandlerListens = (quote, name) => {
    if (!listenedNames.size) return false;
    const names = listenedNames.get(listenerIdentity(quote, name));
    return Boolean(names) && profile.renamesNamed('event', name).some((entry) => names.has(entry.to));
  };
  const edits = [];
  const seenWarnings = new Set();
  const handledStrings = new Set();
  const handledMembers = new Set();
  const unique = (values) => [...new Set(values)];
  const list = (values) => unique(values).join(', ');
  const soleTag = (entries) => (unique(entries.map((entry) => entry.tag)).length === 1 ? entries[0].tag : null);
  const hint = (code, member) => `After review, mark the site with a "lyra-migrate-reviewed: ${code}:${ackName(member)}" comment.`;

  const rewrite = (start, end, replacement, { tag, member, action, target, message }) => {
    edits.push({ start, end, replacement });
    result.changes.push(reportEntry({
      textStarts: starts,
      file,
      offset: start,
      origin,
      upstreamTag: tag,
      upstreamMember: member,
      action,
      target,
      message,
    }));
  };
  const warn = (offset, { tag = null, member, code, target = null, message }) => {
    const key = `${offset}:${code}:${member}`;
    if (seenWarnings.has(key)) return;
    seenWarnings.add(key);
    if (acknowledgements.consume(locationAt(starts, offset).line, code, member)) {
      result.acknowledged += 1;
      return;
    }
    result.warnings.push(reportEntry({
      textStarts: starts,
      file,
      offset,
      origin,
      upstreamTag: tag,
      upstreamMember: member,
      action: 'manual-review',
      target,
      warningCode: code,
      message: `${message} ${hint(code, member)}`,
    }));
  };
  const reviewMessage = (review) => {
    const subject = review.kind === 'component'
      ? `<${review.tag}>`
      : review.kind === 'slot' && review.name === ''
        ? `Content in the default slot of ${review.tag}`
        : `The ${review.tag} ${review.kind} ${review.name}`;
    return `${subject} ${review.removedIn ? `was removed in ${review.removedIn}` : `is deprecated and scheduled for removal in ${review.removalNotBefore}`}; migrate to ${review.replacement} by hand.`;
  };
  const reportReview = (offset, review) =>
    warn(offset, { tag: review.tag, member: review.name, code: DEPRECATED_MEMBER_REVIEW, target: review.replacement, message: reviewMessage(review) });
  const reportPropertyChange = (offset, entry) => warn(offset, {
    tag: entry.tag, member: entry.property, code: 'PROPERTY_CHANGE_REVIEW', target: entry.property,
    message: `Review ${entry.tag}.${entry.property} for ${release}: ${entry.summary}`,
  });
  reportModuleReviews(original, file, profile.data.moduleReviews, openingTokens, inComment, warn);
  applyGlobals(original, file, profile.data.globals, { inComment, inCss, openingTokens, rewrite, warn });
  const unownedReviews = (kind, name, offset, owner) => {
    const own = owner ? profile.reviewFor(owner, kind, name) : null;
    if (own) reportReview(offset, own);
    else if (!profile.exposes(kind, name, owner)) {
      for (const review of profile.reviewsNamed(kind, name)) reportReview(offset, review);
    }
  };
  const label = (kind) => (kind === 'css-property' ? 'custom property' : kind);
  const detailNote = (name) => {
    const details = profile.detailsNamed(name);
    return details.length ? ` Its ${release} detail also changed: ${details.map((entry) => `${entry.tag}: ${entry.summary}`).join(' ')}` : '';
  };

  /**
   * An old name at a site that does not bound its reach: an unowned listener, a listener on an
   * element that does not dispatch it, or any custom-property occurrence. Rewrites only a global
   * rename; otherwise reports which components moved and which did not.
   */
  const unownedMove = ({ kind, name, start, context, rewritable, action }) => {
    const renames = profile.renamesNamed(kind, name);
    const targets = unique(renames.map((entry) => entry.to));
    const constructed = kind === 'event' && constructedEvents.has(name);
    if (rewritable && !constructed && profile.isGlobal(kind, name)) {
      rewrite(start, start + name.length, targets[0], {
        tag: soleTag(renames),
        member: name,
        action,
        target: targets[0],
        message: `Rename ${name} to ${targets[0]}; every component exposing it renamed it, and no other component uses ${targets[0]}.`,
      });
      return targets[0];
    }
    const sourceKeepers = unique(targets.flatMap((to) => profile.sourceKeepers(kind, name, to)))
      .filter((tag) => !renames.some((entry) => entry.tag === tag));
    const targetKeepers = unique(targets.flatMap((to) => profile.targetKeepers(kind, name, to)));
    const shared = targets.length === 1 && !sourceKeepers.length && targetKeepers.length > 0 && !renames.some((entry) => entry.polarity);
    warn(start, {
      tag: soleTag(renames),
      member: name,
      code: shared ? RENAME_TARGET_SHARED_REVIEW : RENAME_REVIEW,
      target: targets.join(' | '),
      message:
        (kind === 'css-property'
          ? 'Custom properties inherit into nested components. '
          : context === 'listener'
            ? 'This listener does not prove which element it listens to. '
            : 'This string may name an event of any component. ') +
        `${list(renames.map((entry) => entry.tag))} renamed the ${label(kind)} ${name} to ${targets.join(' or ')}` +
        (sourceKeepers.length ? `, while ${list(sourceKeepers)} still ${sourceKeepers.length === 1 ? 'uses' : 'use'} ${name}` : '') +
        (targetKeepers.length ? `; ${list(targetKeepers)} already ${targetKeepers.length === 1 ? 'uses' : 'use'} ${targets.join(' and ')}, which this site would start reaching` : '') +
        (constructed ? `; the scanned code also dispatches ${name} itself, so its listeners and dispatches must move together` : '') +
        `. Update it by hand for the components it is meant for; ${name} keeps working until ${removal}.` +
        (kind === 'event' ? detailNote(targets[0]) : ''),
    });
    return null;
  };

  /** What an event listener on `owner` (or an unowned listener) would be rewritten to, without side effects. */
  const eventMove = (name, owner, rewritable = true) => {
    if (constructedEvents.has(name)) return null;
    const own = owner ? profile.renameFor(owner, 'event', name) : null;
    if (own) return profile.targetKeepers('event', name, own.to).length ? null : own.to;
    if (!rewritable || !profile.renamesNamed('event', name).length || profile.exposes('event', name, owner)) return null;
    return profile.isGlobal('event', name) ? profile.renamesNamed('event', name)[0].to : null;
  };

  /**
   * `conflict` is true when the element binds the new name too, and `'same-handler'` when the
   * listener call's receiver already adds or removes this same handler for the new name.
   */
  const conflictMessage = (conflict, subject, to) =>
    conflict === 'same-handler'
      ? `${subject} already listens to ${to} with this same handler; renamed, the two identical registrations would ` +
        `collapse into one, so the handler would run once per activation instead of twice. Rename or remove this ` +
        `call, and its add or remove counterpart, together by hand.`
      : `${subject} already listens to ${to}; merge the two handlers by hand.`;

  const eventSite = ({ name, start, owner, context, rewritable = true, conflict = false }) => {
    const retired = owner ? profile.retiredEventFor(owner, name) : null;
    const retiredCandidates = retired ? [retired] : profile.exposes('event', name, owner) ? [] : profile.retiredEventsNamed(name);
    if (retiredCandidates.length) {
      warn(start, {
        tag: retired ? owner : soleTag(retiredCandidates),
        member: name,
        code: 'RETIRED_EVENT_REVIEW',
        target: unique(retiredCandidates.map((entry) => entry.replacement)).join(', '),
        message: `${name} is no longer dispatched by ${list(retiredCandidates.map((entry) => entry.tag))} in ${release}. ` +
          retiredCandidates.map((entry) => `${entry.tag}: use ${entry.replacement}. ${entry.summary}`).join(' ') +
          ' Review this listener and its matching removal together; keep unrelated events with the same spelling, ' +
          'check nested event targets, and merge any existing canonical listener without dropping or duplicating handler calls.',
      });
    }
    const own = owner ? profile.renameFor(owner, 'event', name) : null;
    let current = name;
    if (own) {
      const keepers = profile.targetKeepers('event', name, own.to);
      if (constructedEvents.has(name)) {
        warn(start, {
          tag: owner,
          member: name,
          code: RENAME_REVIEW,
          target: own.to,
          message:
            `Not renamed: the scanned code dispatches ${name} itself, so this listener would stop hearing it. Rename the ` +
            `dispatch and its listeners to ${own.to} together; ${name} keeps working until ${removal}.${detailNote(own.to)}`,
        });
      } else if (keepers.length) {
        warn(start, {
          tag: owner,
          member: name,
          code: RENAME_TARGET_SHARED_REVIEW,
          target: own.to,
          message:
            `Not renamed: ${list(keepers)} also ${keepers.length === 1 ? 'dispatches' : 'dispatch'} ${own.to}, so this listener would ` +
            `start receiving their events when they are nested inside this ${owner}. Rename it by hand and ignore events whose ` +
            `target is not this ${owner}; ${name} keeps working until ${removal}.${detailNote(own.to)}`,
        });
      } else if (conflict) {
        warn(start, {
          tag: owner,
          member: name,
          code: RENAME_CONFLICT_REVIEW,
          target: own.to,
          message: `${conflictMessage(conflict, `This ${owner}`, own.to)} ${name} keeps working until ${removal}.`,
        });
      } else {
        const narrowed = profile.sourceKeepers('event', name, own.to).filter((tag) => tag !== owner);
        rewrite(start, start + name.length, own.to, {
          tag: owner,
          member: name,
          action: 'rewrite-event',
          target: own.to,
          message:
            `Rename the ${owner} event ${name} to ${own.to}.` +
            (narrowed.length
              ? ` ${list(narrowed)} still ${narrowed.length === 1 ? 'dispatches' : 'dispatch'} ${name}; this listener stops hearing theirs from nested elements.`
              : ''),
        });
        current = own.to;
      }
    } else if (profile.renamesNamed('event', name).length && !profile.exposes('event', name, owner)) {
      if (conflict) {
        warn(start, {
          tag: soleTag(profile.renamesNamed('event', name)),
          member: name,
          code: RENAME_CONFLICT_REVIEW,
          target: profile.renamesNamed('event', name)[0].to,
          message: conflictMessage(conflict, conflict === 'same-handler' ? 'This receiver' : 'This element', profile.renamesNamed('event', name)[0].to),
        });
      } else {
        current = unownedMove({ kind: 'event', name, start, context, rewritable, action: 'rewrite-event' }) ?? name;
      }
    }
    const details = profile.detailsNamed(current);
    const ownDetail = owner ? profile.detailFor(owner, current) : null;
    if (ownDetail || (details.length && !profile.exposes('event', current, owner))) {
      const affected = ownDetail ? [ownDetail] : details;
      warn(start, {
        tag: ownDetail ? owner : soleTag(affected),
        member: current,
        code: DETAIL_SHAPE_REVIEW,
        target: current,
        message:
          `The ${current} event detail changed in ${release} and cannot be aliased: ` +
          affected.map((entry) => `${entry.tag}: ${entry.summary}`).join(' ') +
          ` Update this handler if it reads the detail of ${ownDetail ? `the ${owner} event` : 'one of these components'}.`,
      });
    }
    const gained = current === name ? profile.gainedOwners('event', name) : [];
    if (gained.length && !profile.exposes('event', name, owner)) {
      warn(start, {
        tag: soleTag(gained.map((tag) => ({ tag }))),
        member: name,
        code: NAME_GAINED_OWNER_REVIEW,
        target: name,
        message:
          `In ${release}, ${list(gained)} also ${gained.length === 1 ? 'dispatches' : 'dispatch'} ${name}. This ${context} does not prove ` +
          'which element it listens to, so it may start receiving those events; ignore them by event target if it should not.',
      });
    }
    unownedReviews('event', name, start, owner);
  };

  const reportedDetailFieldOffsets = new Set();
  const detailFieldAccess = /\b([A-Za-z_$][\w$]*)\s*(?:\?\.|\.)\s*detail\s*(?:\?\.|\.)\s*(open|collapsed)\b/g;
  const reportDetailField = (field, start, owner = null, event = null) => {
    if (reportedDetailFieldOffsets.has(start)) return;
    const exact = owner && event ? profile.detailFieldFor(owner, event) : null;
    if (exact && exact.field === field) {
      const target = exact.relation === 'equal' ? 'detail.expanded' : '!detail.expanded';
      const relation = exact.relation === 'equal' ? 'carries the same value as' : 'is the inverse of';
      const removal = exact.removedIn
        ? ` It was removed in ${exact.removedIn}.`
        : ' This notice does not assert that the field was removed.';
      warn(start, {
        tag: owner,
        member: field,
        code: DETAIL_FIELD_REVIEW,
        target,
        message: `The ${owner} ${event} detail field ${field} is deprecated: it ${relation} detail.expanded (${exact.notice}). Read ${target} in this handler by hand; no field rewrite was applied.${removal}`,
      });
      reportedDetailFieldOffsets.add(start);
      return;
    }
    const candidates = event ? profile.detailFieldsNamed(event).filter((entry) => entry.field === field) : [];
    const possible = candidates.length ? candidates : (profile.data.detailFields ?? []).filter((entry) => entry.field === field);
    if (!possible.length) return;
    const possibilities = [...new Set(possible.map((entry) => `${entry.tag}/${entry.event} (${entry.relation})`))];
    warn(start, {
      tag: null,
      member: field,
      code: DETAIL_FIELD_REVIEW,
      target: null,
      message: `This detail.${field} read has no proven Lyra tag and event. Matching published field contracts are ${possibilities.join(', ')}; identify the runtime detail type and migrate it by hand. No field rewrite was applied.`,
    });
    reportedDetailFieldOffsets.add(start);
  };
  const inspectMarkupDetailFields = (owner, event, attribute) => {
    if (attribute.valueStart === null || attribute.valueEnd === null) return;
    const value = original.slice(attribute.valueStart, attribute.valueEnd);
    for (const match of value.matchAll(detailFieldAccess)) {
      const start = attribute.valueStart + match.index + match[0].lastIndexOf(match[2]);
      reportDetailField(match[2], start, owner, event);
    }
  };
  // Inspect every event binding, including owners/events that have no rename or shape-migration
  // row. These are precisely the cases where the field report must preserve ownership ambiguity.
  for (const token of openingTokens) {
    const owner = token.tag.toLowerCase();
    for (const attribute of parseTagAttributes(original, token)) {
      const event = markupEventName(attribute.rawName);
      if (event && /^lr-/u.test(event.name)) inspectMarkupDetailFields(owner, event.name, attribute);
    }
  }

  const memberSite = ({ owner, kind, name, start, forms, dynamic, removal: removalRange }) => {
    const propertyChange = forms.filter(([candidateKind]) => candidateKind === 'property')
      .map(([, candidate]) => profile.propertyChangeFor(owner, candidate)).find(Boolean);
    if (propertyChange) reportPropertyChange(start, propertyChange);
    const review = forms.map(([candidateKind, candidate]) => profile.reviewFor(owner, candidateKind, candidate)).find(Boolean);
    if (review) reportReview(start, review);
    const rule = forms.map(([candidateKind, candidate]) => profile.renameFor(owner, candidateKind, candidate)).find(Boolean);
    if (!rule) return null;
    if (rule.polarity === 'inverted' && (dynamic || !removalRange)) {
      const target = kind === 'binding' ? memberStyle(name, rule.to) : rule.to;
      warn(start, {
        tag: owner,
        member: rule.from,
        code: POLARITY_REVIEW,
        target: rule.to,
        message:
          `${target} is the inverse of ${name} on ${owner}, and this ${kind === 'binding' ? 'binding' : kind === 'property' ? 'property access' : 'attribute binding'} ` +
          'is not a static attribute. ' +
          `Bind the negated value to ${target} by hand; ${name} keeps working until ${removal}.`,
      });
      return null;
    }
    return rule;
  };
  const renamedMembers = (owner) => unique([
    ...profile.data.renames.filter((entry) => entry.tag === owner && ['attribute', 'property', 'event'].includes(entry.kind)).map((entry) => entry.from),
    ...profile.data.reviews.filter((entry) => entry.tag === owner && ['attribute', 'property', 'event'].includes(entry.kind)).map((entry) => entry.name),
    ...profile.data.retiredEvents.filter((entry) => entry.tag === owner).map((entry) => entry.event),
    ...profile.data.propertyChanges.filter((entry) => entry.tag === owner).flatMap((entry) => [entry.property, ...(entry.former ? [entry.former] : [])]),
  ]);

  // --- Markup: event listeners on any element; attributes, properties, spreads and exportparts on the owner.
  const defaultTokens = [];
  for (const token of openingTokens) {
    const owner = token.tag.toLowerCase();
    const attributes = parseTagAttributes(original, token);
    const lyraOwner = profile.tags.has(owner);
    const bound = lyraOwner ? boundMemberNames(attributes) : null;

    // Plan first: a rename that binds one name twice on an element breaks the template (Lit throws
    // on duplicate bindings, Vue and Svelte refuse to compile, TSX reports a duplicate prop).
    const finalNames = new Map();
    const planned = attributes.map((attribute) => {
      const event = markupEventName(attribute.rawName);
      let finalRaw = attribute.rawName;
      if (event && /^lr-/.test(event.name)) {
        const to = eventMove(event.name, owner);
        if (to) finalRaw = attribute.rawName.slice(0, event.offset) + to + attribute.rawName.slice(event.offset + event.name.length);
      } else if (lyraOwner) {
        const binding = markupMemberBinding(attribute);
        const rule = binding && !binding.form.startsWith('member') && profile.renameFor(owner, binding.form, binding.name);
        if (rule && !rule.polarity) finalRaw = attribute.rawName.slice(0, binding.offset) + rule.to + attribute.rawName.slice(binding.offset + binding.name.length);
      }
      const key = finalRaw.toLowerCase();
      finalNames.set(key, (finalNames.get(key) ?? 0) + 1);
      return { attribute, event, key, renamed: finalRaw !== attribute.rawName };
    });

    if (lyraOwner && renamedMembers(owner).length) {
      for (const group of openingTagBraceGroups(original, token)) {
        const shorthand = /^[A-Za-z_$][\w$]*$/.exec(group.body)?.[0];
        if (!shorthand) {
          warn(group.start, {
            tag: owner,
            member: owner,
            code: 'DYNAMIC_VALUE_REVIEW',
            target: null,
            message: `This spread on ${owner} may carry renamed or deprecated members (${list(renamedMembers(owner))}); rename them where the object is built.`,
          });
          continue;
        }
        const forms = [['property', camelCase(shorthand)], ['attribute', kebabCase(shorthand)]];
        const review = forms.map(([kind, name]) => profile.reviewFor(owner, kind, name)).find(Boolean);
        if (review) reportReview(group.start + 1, review);
        const propertyChange = profile.propertyChangeFor(owner, camelCase(shorthand));
        if (propertyChange) reportPropertyChange(group.start + 1, propertyChange);
        const rule = forms.map(([kind, name]) => profile.renameFor(owner, kind, name)).find(Boolean);
        if (rule) {
          warn(group.start + 1, {
            tag: owner,
            member: rule.from,
            code: rule.polarity ? POLARITY_REVIEW : RENAME_REVIEW,
            target: rule.to,
            message: `The shorthand {${shorthand}} binds the deprecated ${owner} ${rule.kind} ${rule.from}; write ${memberStyle(shorthand, rule.to)}={${rule.polarity ? `!${shorthand}` : shorthand}} by hand.`,
          });
        }
      }
    }

    for (const { attribute, event, key, renamed } of planned) {
      if (event) {
        if (/^lr-/.test(event.name)) {
          inspectMarkupDetailFields(owner, event.name, attribute);
          eventSite({
            name: event.name,
            start: attribute.nameStart + event.offset,
            owner,
            context: 'listener',
            conflict: renamed && finalNames.get(key) > 1,
          });
        }
        continue;
      }
      if (!lyraOwner) continue;
      // A Lit element binding other than ref() may be a spread directive that sets members.
      if (/^v-(?:bind|on)$/.test(attribute.rawName) || (attribute.rawName.startsWith('${') && !/^\$\{\s*ref\s*\(/.test(attribute.rawName))) {
        if (renamedMembers(owner).length) {
          warn(attribute.nameStart, {
            tag: owner,
            member: owner,
            code: 'DYNAMIC_VALUE_REVIEW',
            target: null,
            message: `This object binding on ${owner} may carry renamed or deprecated members (${list(renamedMembers(owner))}); rename them where the object is built.`,
          });
        }
        continue;
      }
      if (attribute.rawName === 'exportparts') {
        if (attribute.valueKind !== 'literal' || /\$\{|\{\{/.test(attribute.value ?? '')) continue;
        for (const match of (attribute.value ?? '').matchAll(/([^,\s:]+)(\s*:\s*[^,\s]+)?/g)) {
          const inner = match[1];
          const start = attribute.valueStart + match.index;
          const review = profile.reviewFor(owner, 'part', inner);
          if (review) reportReview(start, review);
          const rule = profile.renameFor(owner, 'part', inner);
          if (!rule) continue;
          rewrite(start, start + inner.length, match[2] ? rule.to : `${rule.to}:${inner}`, {
            tag: owner,
            member: inner,
            action: 'rewrite-part',
            target: rule.to,
            message: match[2]
              ? `Forward the renamed ${owner} part ${rule.to} under the same exported name.`
              : `Forward the renamed ${owner} part ${rule.to} under its previous exported name ${inner}.`,
          });
        }
        continue;
      }
      const binding = markupMemberBinding(attribute);
      if (!binding) continue;
      const forms = binding.form === 'member'
        ? [['property', camelCase(binding.name)], ['attribute', kebabCase(binding.name)]]
        : [[binding.form, binding.name]];
      const start = attribute.nameStart + binding.offset;
      const staticAttribute = binding.form === 'attribute' && binding.offset === 0 && !binding.dynamic;
      const rule = memberSite({
        owner,
        kind: binding.form === 'member' ? 'binding' : binding.form,
        name: binding.name,
        start,
        forms,
        dynamic: binding.dynamic,
        removal: staticAttribute,
      });
      if (!rule) continue;
      if (bound.has(kebabCase(rule.to)) || (renamed && finalNames.get(key) > 1)) {
        warn(start, {
          tag: owner,
          member: rule.from,
          code: RENAME_CONFLICT_REVIEW,
          target: rule.to,
          message: `This ${owner} already binds ${rule.to}; remove the deprecated ${rule.from} binding by hand.`,
        });
        continue;
      }
      if (rule.polarity === 'inverted') {
        if (!attributeSemantics(token.start)) {
          warn(start, {
            tag: owner,
            member: rule.from,
            code: POLARITY_REVIEW,
            target: rule.to,
            message:
              `${rule.to} is the inverse of ${rule.from}. In this template syntax a static value may be assigned to the ` +
              `${camelCase(rule.from)} property as a string, where "false" is truthy, so set ${rule.to} by hand.`,
          });
          continue;
        }
        if (profile.preservedDefaultsFor(owner).some((entry) => entry.attribute === rule.to && entry.value === true)) {
          warn(start, {
            tag: owner,
            member: rule.from,
            code: POLARITY_REVIEW,
            target: rule.to,
            message:
              `${rule.from} has a preserved absent default, so removing an explicit attribute would let a later run insert ${rule.to}. ` +
              `Review this value using the old converter (a presence boolean treats even "false" as true), then migrate it by hand ` +
              'after the default migration is complete.',
          });
          continue;
        }
        // The true-defaulting converter recognizes only the exact literal 'false'. Trimming or
        // folding case here would invert values that the component still treats as true.
        const value = attribute.value ?? '';
        const end = attributeEnd(original, attribute);
        if (value === '' || value === 'true' || value === rule.from) {
          let removeFrom = attribute.nameStart;
          while (removeFrom > 0 && /\s/.test(original[removeFrom - 1])) removeFrom -= 1;
          rewrite(removeFrom, end, '', {
            tag: owner,
            member: rule.from,
            action: 'remove-attribute',
            target: rule.to,
            message: `Remove ${rule.from}: it restated the ${owner} default, and ${rule.to} is off by default.`,
          });
        } else if (value === 'false') {
          rewrite(attribute.nameStart, end, rule.to, {
            tag: owner,
            member: rule.from,
            action: 'rewrite-attribute',
            target: rule.to,
            message: `Replace ${rule.from}="false" with the presence of ${rule.to}.`,
          });
        } else {
          warn(start, {
            tag: owner,
            member: rule.from,
            code: POLARITY_REVIEW,
            target: rule.to,
            message: `${rule.from}="${attribute.value}" is not a boolean literal; set ${rule.to} to its inverse by hand.`,
          });
        }
        continue;
      }
      const target = binding.form === 'member' ? memberStyle(binding.name, rule.to) : rule.to;
      rewrite(start, start + binding.name.length, target, {
        tag: owner,
        member: rule.from,
        action: `rewrite-${rule.kind}`,
        target: rule.to,
        message: `Rename the ${owner} ${rule.kind} ${rule.from} to ${rule.to}.`,
      });
    }
    if (lyraOwner && profile.defaultsFor(owner).length) defaultTokens.push({ token, owner, bound });
  }

  // --- Slots: named-slot renames and reviews, default-slot reviews and deprecated slot content,
  // on the direct children of the owning element.
  const slotTags = [...profile.tags].filter((tag) =>
    profile.slotContentFor(tag).length ||
    [...profile.data.renames, ...profile.data.reviews].some((entry) => entry.tag === tag && entry.kind === 'slot'));
  for (const tag of slotTags) {
    for (const pair of elementPairs(original, tag, inComment)) {
      for (const child of directChildTokens(original, pair.opening.end + 1, pair.closingStart, inComment)) {
        let slot = '';
        let start = child.nameStart;
        for (const attribute of parseTagAttributes(original, child)) {
          if (attribute.rawName === 'slot') {
            slot = attribute.valueKind === 'literal' ? attribute.value ?? '' : null;
            start = attribute.valueStart ?? attribute.nameStart;
          } else if (attribute.rawName === 'v-slot') {
            slot = '';
          } else {
            const prefix = ['v-slot:', '#'].find((candidate) => attribute.rawName.startsWith(candidate));
            if (prefix) {
              slot = attribute.rawName.slice(prefix.length);
              start = attribute.nameStart + prefix.length;
              if (slot === 'default') slot = '';
            }
          }
        }
        if (slot === null) continue;
        const review = profile.reviewFor(tag, 'slot', slot);
        if (review) reportReview(start, review);
        const rule = slot === '' ? null : profile.renameFor(tag, 'slot', slot);
        if (rule) {
          rewrite(start, start + slot.length, rule.to, {
            tag,
            member: slot,
            action: 'rewrite-slot',
            target: rule.to,
            message: `Rename the ${tag} slot ${slot} to ${rule.to}.`,
          });
        }
        if (child.tag === 'template') continue;
        for (const content of profile.slotContentFor(tag)) {
          if (content.slot !== slot) continue;
          const listed = (content.report ?? content.allow).includes(child.tag);
          if (content.report ? !listed : listed) continue;
          warn(child.nameStart, {
            tag,
            member: child.tag,
            code: DEPRECATED_CONTENT_REVIEW,
            target: null,
            message: `<${child.tag}> in ${slot === '' ? 'the default slot' : `the ${slot} slot`} of ${tag}: ${content.summary}`,
          });
        }
      }
    }
  }

  // --- Stylesheets: `::part()`, custom properties, attribute selectors and custom states.
  for (const match of original.matchAll(/::part\(([^)]*)\)/g)) {
    if (inComment(match.index)) continue;
    const owner = compoundTypeBefore(original, match.index);
    const listStart = match.index + '::part('.length;
    for (const nameMatch of match[1].matchAll(/\S+/g)) {
      const name = nameMatch[0];
      const start = listStart + nameMatch.index;
      const own = owner ? profile.renameFor(owner, 'part', name) : null;
      if (own) {
        rewrite(start, start + name.length, own.to, {
          tag: owner,
          member: name,
          action: 'rewrite-part',
          target: own.to,
          message: `Rename the ${owner} part ${name} to ${own.to}.`,
        });
      } else if (profile.renamesNamed('part', name).length && !profile.exposes('part', name, owner)) {
        const renames = profile.renamesNamed('part', name);
        const keepers = profile.exposers('part', name).filter((tag) => !renames.some((entry) => entry.tag === tag));
        warn(start, {
          tag: soleTag(renames),
          member: name,
          code: RENAME_REVIEW,
          target: list(renames.map((entry) => entry.to)),
          message:
            `This ::part() selector does not name the component that owns the part. ${list(renames.map((entry) => entry.tag))} ` +
            `renamed the part ${name} to ${list(renames.map((entry) => entry.to))}` +
            (keepers.length ? `, while ${list(keepers)} still ${keepers.length === 1 ? 'exposes' : 'expose'} ${name}` : '') +
            '. Rename it where the selector reaches a renamed component directly; a part forwarded through exportparts keeps its exported name.',
        });
      } else if (profile.gainedOwners('part', name).length && !owner?.startsWith('lr-')) {
        const gained = profile.gainedOwners('part', name);
        warn(start, {
          tag: soleTag(gained.map((tag) => ({ tag }))),
          member: name,
          code: NAME_GAINED_OWNER_REVIEW,
          target: name,
          message: `In ${release}, ${list(gained)} also ${gained.length === 1 ? 'exposes' : 'expose'} the part ${name}, so this selector may start matching it.`,
        });
      }
      unownedReviews('part', name, start, owner);
    }
  }

  const cssNames = new Set([
    ...profile.data.renames.filter((entry) => entry.kind === 'css-property').flatMap((entry) => [entry.from, entry.to]),
    ...profile.data.reviews.filter((entry) => entry.kind === 'css-property').map((entry) => entry.name),
  ]);
  if (cssNames.size) {
    for (const match of original.matchAll(/(?<![\w-])--[A-Za-z0-9_-]+/g)) {
      const name = match[0];
      if (!cssNames.has(name) || inComment(match.index)) continue;
      if (profile.renamesNamed('css-property', name).length) {
        unownedMove({ kind: 'css-property', name, start: match.index, context: 'custom property', rewritable: true, action: 'rewrite-css-property' });
      }
      const declaration = /^\s*['"]?\s*:/.test(original.slice(match.index + name.length, match.index + name.length + 16)) ||
        /setProperty\s*\(\s*['"`]$/.test(original.slice(Math.max(0, match.index - 24), match.index));
      const gained = profile.gainedOwners('css-property', name);
      if (declaration && gained.length) {
        warn(match.index, {
          tag: soleTag(gained.map((tag) => ({ tag }))),
          member: name,
          code: NAME_GAINED_OWNER_REVIEW,
          target: name,
          message: `In ${release}, ${list(gained)} also ${gained.length === 1 ? 'reads' : 'read'} ${name}, so this declaration now reaches them when they are nested below it.`,
        });
      }
      for (const review of profile.reviewsNamed('css-property', name)) reportReview(match.index, review);
    }
  }

  for (const match of original.matchAll(/\[\s*([A-Za-z_][\w-]*)(?=\s*(?:[~|^$*]?=|\]))/g)) {
    if (inComment(match.index)) continue;
    const owner = compoundTypeBefore(original, match.index);
    if (!owner || !profile.tags.has(owner)) continue;
    const name = match[1];
    const start = match.index + match[0].length - name.length;
    const review = profile.reviewFor(owner, 'attribute', name);
    if (review) reportReview(start, review);
    const rule = profile.renameFor(owner, 'attribute', name);
    if (!rule) continue;
    if (rule.polarity === 'inverted') {
      warn(start, {
        tag: owner,
        member: name,
        code: POLARITY_REVIEW,
        target: rule.to,
        message: `${rule.to} is the inverse of ${name}; rewrite this ${owner} selector to test the opposite state (for example :not([${rule.to}])).`,
      });
      continue;
    }
    if (!rule.reflects) {
      warn(start, {
        tag: owner,
        member: name,
        code: RENAME_REVIEW,
        target: rule.to,
        message:
          `${owner} does not reflect ${rule.to}, so [${rule.to}] matches only where markup sets it. Rename this selector once every ` +
          `place that sets ${name} (markup, setAttribute) sets ${rule.to} instead.`,
      });
      continue;
    }
    rewrite(start, start + name.length, rule.to, {
      tag: owner,
      member: name,
      action: 'rewrite-attribute',
      target: rule.to,
      message: `Rename the ${owner} attribute selector [${name}] to [${rule.to}]; ${owner} reflects ${rule.to}.`,
    });
  }

  for (const match of original.matchAll(/:state\(\s*([a-z][a-z0-9-]*)\s*\)/g)) {
    if (inComment(match.index)) continue;
    const owner = compoundTypeBefore(original, match.index);
    const review = owner ? profile.reviewFor(owner, 'css-state', match[1]) : null;
    if (review) reportReview(match.index + match[0].indexOf(match[1]), review);
  }

  for (const review of profile.data.reviews.filter((entry) => entry.kind === 'component')) {
    for (const match of original.matchAll(new RegExp(`(?<![\\w-])${review.tag}(?![\\w-])`, 'g'))) {
      if (inComment(match.index) || original.slice(match.index - 2, match.index) === '</') continue;
      reportReview(match.index, review);
    }
  }

  // Deprecated detail fields are never textually rewritten. A template binding proves its owner
  // and event above; direct script reads are matched to an anchored querySelector listener when
  // that shape is visible. Everything else stays an explicit ownership/type review.
  const anchoredDetailListener = /(?:document\.)?querySelector\(\s*(['"])(lr-[a-z0-9-]+)\1\s*\)\s*!?\s*\.\s*addEventListener\(\s*(['"])(lr-[a-z0-9-]+)\3\s*,/g;
  const unownedDetailListener = /[A-Za-z_$][\w$]*\s*\.\s*addEventListener\(\s*(['"])(lr-[a-z0-9-]+)\1\s*,/g;
  const scriptListenerAt = (offset) => {
    const start = Math.max(0, offset - 4096);
    const prefix = original.slice(start, offset);
    let result = null;
    for (const pattern of [anchoredDetailListener, unownedDetailListener]) {
      pattern.lastIndex = 0;
      for (const match of prefix.matchAll(pattern)) {
        const event = pattern === anchoredDetailListener ? match[4] : match[2];
        const callbackStart = match.index + match[0].length;
        const callback = prefix.slice(callbackStart);
        if (!/=>|\bfunction\b/u.test(callback) || /\)\s*;/u.test(callback)) continue;
        if (!result || match.index >= result.index) result = { owner: pattern === anchoredDetailListener ? match[2] : null, event, index: match.index };
      }
    }
    return result;
  };
  for (const match of original.matchAll(detailFieldAccess)) {
    const offset = match.index + match[0].lastIndexOf(match[2]);
    if (reportedDetailFieldOffsets.has(offset) || inComment(offset) || inLiteral(offset) || inCss(offset)) continue;
    const listener = scriptListenerAt(offset);
    reportDetailField(match[2], offset, listener?.owner ?? null, listener?.event ?? null);
  }

  // --- Scripts: calls rooted at querySelector/closest/createElement('lr-*') prove their element.
  for (const match of original.matchAll(ANCHORED_MEMBER)) {
    if (inComment(match.index)) continue;
    const owner = match[2];
    const member = match[3];
    const start = match.index + match[0].length - member.length;
    const after = start + member.length;
    handledMembers.add(start);
    if (LISTENER_METHODS.has(member) || ATTRIBUTE_METHODS.has(member)) {
      const call = /^\s*\(\s*(['"`])([^'"`\n]+)\1/.exec(original.slice(after, after + 200));
      if (!call) continue;
      const valueStart = after + call[0].length - 1 - call[2].length;
      handledStrings.add(valueStart - 1);
      if (LISTENER_METHODS.has(member)) {
        eventSite({ name: call[2], start: valueStart, owner, context: 'listener', conflict: sameHandlerListens(valueStart - 1, call[2]) && 'same-handler' });
        continue;
      }
      const rule = memberSite({ owner, kind: 'attribute', name: call[2], start: valueStart, forms: [['attribute', call[2]]], dynamic: true });
      if (rule) {
        rewrite(valueStart, valueStart + call[2].length, rule.to, {
          tag: owner,
          member: rule.from,
          action: 'rewrite-attribute',
          target: rule.to,
          message: `Rename the ${owner} attribute ${rule.from} to ${rule.to}.`,
        });
      }
      continue;
    }
    if (!profile.tags.has(owner)) continue;
    if (/^\s*\(/.test(original.slice(after, after + 64))) {
      const review = profile.reviewFor(owner, 'method', member);
      if (review) reportReview(start, review);
      continue;
    }
    const rule = memberSite({ owner, kind: 'property', name: member, start, forms: [['property', member]], dynamic: true });
    if (rule) {
      rewrite(start, after, rule.to, {
        tag: owner,
        member: rule.from,
        action: 'rewrite-property',
        target: rule.to,
        message: `Rename the ${owner} property ${rule.from} to ${rule.to}.`,
      });
    }
  }

  // Event names held in string literals outside an anchored call. A listener call on an unproven
  // receiver -- including Angular's `@HostListener('document:lr-…')` -- may be rewritten globally;
  // any other string (a constant, an event map key) is only reported, because the same text can
  // be a tag name passed to a DOM API.
  const eventNameMatters = (name) =>
    profile.renamesNamed('event', name).length || profile.detailsNamed(name).length || profile.retiredEventsNamed(name).length ||
    profile.reviewsNamed('event', name).length || profile.gainedOwners('event', name).length;
  for (const match of original.matchAll(/(['"`])(?:(window|document|body):)?(lr-[a-z0-9]+(?:-[a-z0-9]+)*)\1/g)) {
    const name = match[3];
    if (handledStrings.has(match.index) || inComment(match.index) || !eventNameMatters(name)) continue;
    const before = original.slice(Math.max(0, match.index - 120), match.index);
    if (!match[2] && TAG_API_CALL_BEFORE.test(before)) continue;
    const listener = LISTENER_CALL_BEFORE.test(before);
    eventSite({
      name,
      start: match.index + 1 + (match[2] ? match[2].length + 1 : 0),
      owner: null,
      context: listener ? 'listener' : 'event name string',
      rewritable: listener,
      conflict: listener && !match[2] && sameHandlerListens(match.index, name) && 'same-handler',
    });
  }

  // Member access on an unproven receiver, only in files that use a component renaming it.
  const mentioned = mentionedTags(original, profile.tags, inComment);
  const accessRules = new Map();
  const addAccess = (name, candidate) => accessRules.set(name, [...(accessRules.get(name) ?? []), candidate]);
  for (const entry of profile.data.renames) {
    if (entry.kind === 'property' && mentioned.has(entry.tag)) addAccess(entry.from, { tag: entry.tag, rule: entry, call: false });
  }
  for (const entry of profile.data.reviews) {
    if ((entry.kind === 'property' || entry.kind === 'method') && mentioned.has(entry.tag)) {
      addAccess(entry.name, { tag: entry.tag, review: entry, call: entry.kind === 'method' });
    }
  }
  for (const entry of profile.data.propertyChanges) {
    if (!mentioned.has(entry.tag)) continue;
    for (const name of [entry.property, ...(entry.former ? [entry.former] : [])]) addAccess(name, { tag: entry.tag, propertyChange: entry, call: false });
  }
  if (accessRules.size) {
    const inString = rangeTester(mergeRanges(quotedStringRanges(original, inComment)));
    const inStylesheet = rangeTester(stylesheetRanges(original, file, inComment));
    const inToken = rangeTester(mergeRanges(openingTokens.map((token) => [token.start + 1, token.end])));
    for (const match of original.matchAll(/(?<=[\w$)\]])\s*(?:\?\.|!?\.)\s*([A-Za-z_$][\w$]*)/g)) {
      const name = match[1];
      const candidates = accessRules.get(name);
      if (!candidates) continue;
      const start = match.index + match[0].length - name.length;
      // A reported event-detail field belongs to the event payload, not the mentioned host's
      // property surface; its owner-aware field review already names the right replacement.
      if (handledMembers.has(start) || reportedDetailFieldOffsets.has(start) || inComment(start) || inString(start) || inStylesheet(start) || inToken(start)) continue;
      const call = /^\s*\(/.test(original.slice(start + name.length, start + name.length + 64));
      for (const candidate of candidates) {
        if (candidate.call !== call) continue;
        if (candidate.propertyChange) {
          reportPropertyChange(start, candidate.propertyChange);
          continue;
        }
        if (candidate.review) {
          reportReview(start, candidate.review);
          continue;
        }
        const { rule } = candidate;
        warn(start, {
          tag: rule.tag,
          member: name,
          code: rule.polarity ? POLARITY_REVIEW : RENAME_REVIEW,
          target: rule.to,
          message:
            `If this reads or writes an ${rule.tag}, ${rule.polarity ? `use the inverse property .${rule.to}` : `rename .${name} to .${rule.to}`}; ` +
            `.${name} keeps working until ${removal}.`,
        });
      }
    }
  }

  for (const match of original.matchAll(/\.\s*(?:set|get|has|remove|toggle)Attribute\s*\(\s*(['"`])([a-z][a-z0-9-]*)\1/g)) {
    const name = match[2];
    const start = match.index + match[0].length - 1 - name.length;
    if (handledStrings.has(start - 1) || inComment(match.index)) continue;
    for (const tag of mentioned) {
      const review = profile.reviewFor(tag, 'attribute', name);
      if (review) reportReview(start, review);
      const rule = profile.renameFor(tag, 'attribute', name);
      if (!rule) continue;
      warn(start, {
        tag,
        member: name,
        code: rule.polarity ? POLARITY_REVIEW : RENAME_REVIEW,
        target: rule.to,
        message:
          `If this element is an ${tag}, ${rule.polarity ? `use the inverse attribute ${rule.to}` : `rename ${name} to ${rule.to}`}; ` +
          `${name} keeps working until ${removal}.`,
      });
    }
  }

  // --- Defaults that changed in the target release: insert the previous value when absent,
  // exactly as the Lyra 7 profile does, blocked by the same alias and spread hazards.
  if (profile.data.defaults.length) {
    const defaultProfiles = new Map(
      [...new Set(profile.data.defaults.map((entry) => entry.tag))].map((tag) => [
        tag,
        {
          origin,
          tag,
          defaults: profile.defaultsFor(tag).map((entry) => ({ member: entry.attribute, value: entry.value })),
        },
      ]),
    );
    const hazards = scanLocalMigrationHazards(
      original,
      defaultProfiles,
      ignoredRanges,
      defaultTokens.map(({ token }) => ({ ...token, tag: token.tag.toLowerCase() })),
    );
    const blocked = new Set([...(options.blockedLocalMigrations ?? []), ...hazards.blocked]);
    result.blockedLocalMigrations = hazards.blocked;
    for (const use of hazards.uses) {
      warn(use.offset, { tag: use.tag, member: use.tag, code: use.warningCode, target: use.tag, message: use.message });
    }
    for (const { token, owner, bound } of defaultTokens) {
      const missing = profile.defaultsFor(owner).filter((entry) =>
        !profile.defaultAliasesFor(owner, entry.attribute).some((name) => bound.has(name)),
      );
      if (!missing.length) continue;
      if (blocked.has(localMigrationKey(origin, owner))) {
        warn(token.nameStart, {
          tag: owner,
          member: owner,
          code: 'MAPPING_REVIEW_BLOCKED',
          target: owner,
          message:
            `${owner} did not receive its Lyra ${profile.fromMajor} defaults ` +
            `(${missing.map((entry) => `${entry.attribute}=${String(entry.value)}`).join(', ')}) because the scanned target set ` +
            'accesses it through a DOM alias or an opaque attribute spread. Add them by hand where the previous default matters.',
        });
        continue;
      }
      const insertions = [];
      for (const entry of missing) {
        insertions.push(serializeLocalDefault({ member: entry.attribute, value: entry.value }));
        result.changes.push(reportEntry({
          textStarts: starts,
          file,
          offset: token.end,
          origin,
          upstreamTag: owner,
          upstreamMember: entry.attribute,
          action: 'insert-default',
          target: `${entry.attribute}=${String(entry.value)}`,
          message: `Insert ${entry.attribute} to preserve the Lyra ${profile.fromMajor} default.`,
        }));
      }
      if (insertions.length) {
        const insertionOffset = original[token.end - 1] === '/' ? token.end - 1 : token.end;
        // `<lr-x a={b} />` gains `a={b} size="s" />`, not a doubled space before the slash.
        const replacement = /\s/.test(original[insertionOffset - 1])
          ? `${insertions.join(' ')} `
          : ` ${insertions.join(' ')}`;
        edits.push({ start: insertionOffset, end: insertionOffset, replacement });
      }
    }
  }

  // An acknowledgement that matches nothing is stale or malformed; report it so it cannot hide a
  // later report of a different kind. Entries withheld for an older installed release would make
  // their acknowledgements look stale, so that run skips the check.
  if (!profile.skipped.length) {
    for (const { offset, entry } of acknowledgements.unused()) {
      const key = `${offset}:${UNUSED_ACKNOWLEDGEMENT}:${entry.token}`;
      if (seenWarnings.has(key)) continue;
      seenWarnings.add(key);
      result.warnings.push(reportEntry({
        textStarts: starts,
        file,
        offset,
        origin,
        upstreamTag: null,
        upstreamMember: entry.token,
        action: 'manual-review',
        target: null,
        warningCode: UNUSED_ACKNOWLEDGEMENT,
        message: entry.code
          ? `The acknowledgement ${entry.token} matches no report on the lines it covers; remove it.`
          : `The acknowledgement ${entry.token} is not of the form CODE:name, for example DETAIL_SHAPE_REVIEW:lr-close.`,
      }));
    }
  }

  result.content = finalizeEdits(original, edits);
  sortReportEntries(result.changes, 'action');
  sortReportEntries(result.warnings, 'warningCode');
  return result;
}
