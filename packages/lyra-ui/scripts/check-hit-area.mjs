// Static check for the shared minimum icon-button hit-area convention (see
// src/internal/tokens.styles.ts's `--lyra-icon-button-size`, 2.5rem/40px):
// every independently-interactive, icon-sized control (a literal `<button>`,
// or an element wearing `role="button"`/`tabindex="0"`) must resolve to at
// least that floor via `min-inline-size`/`min-block-size`, either directly or
// through the shared token. <lyra-swatch-picker>'s `[part="swatch"]` (24px)
// and <lyra-emoji-picker>'s `[part="emoji"]` (32px) shipped without that
// floor -- this script catches that class of gap in future components.
//
// This is a heuristic, text-based check (like check-manifest.mjs's own
// part="..." extraction, which it reuses the same balanced-scanning style
// from) -- it cannot resolve arbitrary `calc()`, run a real layout engine, or
// know a bare interpolated value's rendered length. See the header comment
// below the CLI entry point for the false-positive tuning notes and why this
// ships as a hard-fail rather than a warning.
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(packageDir, 'src', 'components');

const FLOOR_PX = 40; // --lyra-icon-button-size == 2.5rem == 40px at the default 16px root.
const REM_PX = 16;
const ICON_BUTTON_TOKEN = '--lyra-icon-button-size';
const ESCAPE_HATCH = 'hit-area-exempt';

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

// Block comments are blanked char-for-char (not removed) so every later byte
// offset -- and therefore every line number computed from it -- still lines
// up with the original source. Whole-line `//` comments are blanked the same
// way; a trailing same-line `// ...` is deliberately left alone since
// distinguishing it from a `//` inside a string/template without a real
// tokenizer isn't worth the complexity here (see check-style-policy.mjs's
// own stripComments(), which only handles block comments for the same
// reason).
function stripComments(source) {
  let out = source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
  out = out
    .split('\n')
    .map((line) => (/^\s*\/\//.test(line) ? line.replace(/./g, ' ') : line))
    .join('\n');
  return out;
}

function lineAt(source, index) {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

// Scans forward from `startIndex` (the character right after an opening
// delimiter already consumed by the caller) for the matching `closeChar`,
// tracking nested `openChar`/`closeChar` pairs. Used for both `${...}` and
// `(...)` so a `>`, `,`, or `)` inside a nested expression never terminates
// the enclosing construct early.
function extractBalanced(text, startIndex, openChar, closeChar) {
  let depth = 1;
  let i = startIndex;
  while (i < text.length) {
    const ch = text[i];
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) return { content: text.slice(startIndex, i), end: i };
    }
    i++;
  }
  return null;
}

// Scans forward from `startIndex` (right after a template literal's opening
// backtick) for the matching closing backtick, skipping over every nested
// `${...}` expression (which may itself contain quotes, parens, or even a
// nested template literal) so a `` ` `` inside one never ends the outer
// template early. Used to pull the full body out of a `const x = html\`...\`
// declared elsewhere in the file, when a candidate's content is just a bare
// `${x}` reference to it (see contentLooksLikeText()'s wholeSource param).
function extractBalancedBacktick(text, startIndex) {
  let i = startIndex;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === '`') return text.slice(startIndex, i);
    if (ch === '$' && text[i + 1] === '{') {
      const balanced = extractBalanced(text, i + 2, '{', '}');
      if (!balanced) return null;
      i = balanced.end + 1;
      continue;
    }
    i++;
  }
  return null;
}

// Walks `source` for HTML-shaped opening tags (`<name ...>`), respecting
// quoted attribute values and `${...}` template expressions so a bare `>`
// inside either (a comparison operator, a nested arrow function, whatever)
// never closes the tag early. This deliberately does not special-case
// TypeScript generics (`Set<string>`, `Array<Map<string, number>>`, ...) --
// they parse as tags with no attributes of interest (their "tag name" is a
// type name, never `button`, and they carry no `part=`/`role=`/`tabindex=`),
// so they fall out of every later filter for free.
function* openTags(source) {
  const n = source.length;
  let i = 0;
  while (i < n) {
    if (source[i] === '<' && source[i + 1] !== '/' && /[a-zA-Z]/.test(source[i + 1] ?? '')) {
      let j = i + 1;
      while (j < n && /[a-zA-Z0-9-]/.test(source[j])) j++;
      const tagName = source.slice(i + 1, j);
      let k = j;
      let quote = null;
      let braceDepth = 0;
      let closed = false;
      while (k < n) {
        const ch = source[k];
        if (quote) {
          if (ch === '\\') { k += 2; continue; }
          if (ch === quote) quote = null;
          k++;
          continue;
        }
        if (ch === '"' || ch === "'" || ch === '`') { quote = ch; k++; continue; }
        if (ch === '$' && source[k + 1] === '{') { braceDepth++; k += 2; continue; }
        if (braceDepth > 0) {
          if (ch === '{') braceDepth++;
          else if (ch === '}') braceDepth--;
          k++;
          continue;
        }
        if (ch === '<') break; // an unclosed '<...' before the next '>' -- not a real tag, bail
        if (ch === '>') { closed = true; break; }
        k++;
      }
      if (closed) {
        yield { tagName, attrText: source.slice(j, k), tagStart: i, contentStart: k + 1 };
        i = k + 1;
        continue;
      }
    }
    i++;
  }
}

// Approximate same-tag-name depth counting to find the closing tag matching
// an opening tag that ended at `contentStart`. Good enough for this
// codebase's Lit templates (no self-closing `<button/>`-style shorthand for
// the tag names this check cares about); a parse failure returns null and
// the caller treats the candidate conservatively (see findCandidates()).
function findMatchingClose(source, tagName, contentStart) {
  const openRe = new RegExp(`<${tagName}\\b`, 'i');
  const closeRe = new RegExp(`<\\/${tagName}\\s*>`, 'i');
  let depth = 1;
  let i = contentStart;
  while (i < source.length) {
    const rest = source.slice(i);
    const openIdx = rest.search(openRe);
    const closeMatch = rest.match(closeRe);
    const closeIdx = closeMatch ? rest.indexOf(closeMatch[0]) : -1;
    if (closeIdx === -1) return null;
    if (openIdx !== -1 && openIdx < closeIdx) {
      depth++;
      i += openIdx + 1;
    } else {
      depth--;
      if (depth === 0) return { start: i + closeIdx, end: i + closeIdx + closeMatch[0].length };
      i += closeIdx + closeMatch[0].length;
    }
  }
  return null;
}

// Reads one attribute's value out of a tag's raw attribute text. Returns
// `{ kind: 'static', value }` for `name="literal"` / `name='literal'`,
// `{ kind: 'dynamic', expr }` for `name=${...}` (expr is the balanced inner
// text), or null if the attribute isn't present at all.
function getAttr(attrText, name) {
  const re = new RegExp(`(?:^|[\\s"'\`}])${name}\\s*=\\s*`, 'g');
  let m;
  while ((m = re.exec(attrText))) {
    const after = attrText.slice(m.index + m[0].length);
    if (after[0] === '"' || after[0] === "'") {
      const quote = after[0];
      const end = after.indexOf(quote, 1);
      if (end === -1) continue;
      return { kind: 'static', value: after.slice(1, end) };
    }
    if (after.startsWith('${')) {
      const balanced = extractBalanced(after, 2, '{', '}');
      if (!balanced) continue;
      return { kind: 'dynamic', expr: balanced.content };
    }
  }
  return null;
}

function isRoleButton(attrText) {
  const role = getAttr(attrText, 'role');
  if (!role) return false;
  if (role.kind === 'static') return role.value === 'button';
  return /['"]button['"]/.test(role.expr);
}

function isTabindexZero(attrText) {
  const tabindex = getAttr(attrText, 'tabindex');
  if (!tabindex) return false;
  if (tabindex.kind === 'static') return tabindex.value === '0';
  // A dynamic roving-tabindex ternary (e.g. `cond ? 0 : -1}` / `cond ? '0' :
  // '-1'`) -- a standalone `0` token (not part of a longer number like `10`
  // or `0.5`) in either branch means this element is focusable in at least
  // one rendered state.
  return /(?<![\w.'"-])0(?!['"]?[\w.-])/.test(tabindex.expr);
}

// Narrows a conditional expression down to just its ternary branch(es),
// dropping the condition itself -- e.g. `direction === 'up' ? 'up-button' :
// 'down-button'` must not let the condition's own `'up'` string literal leak
// in as a spurious extra "part name". Finds the first paren/bracket/brace-
// depth-0 `?` that isn't `?.` (optional chaining) or `??` (nullish
// coalescing) and returns everything after it; a chained/nested ternary in
// the false branch (`a ? b : c ? d : e`) is still covered in full since
// everything from the first top-level `?` onward is kept. Returns null (use
// the whole expression) when there's no top-level ternary at all.
function ternaryBranches(expr) {
  let depth = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if (depth === 0 && ch === '?' && expr[i + 1] !== '.' && expr[i + 1] !== '?' && expr[i - 1] !== '?') {
      return expr.slice(i + 1);
    }
  }
  return null;
}

function collectLiterals(text) {
  const names = new Set();
  for (const m of text.matchAll(/["']([^"']+)["']/g)) {
    for (const token of m[1].trim().split(/\s+/)) if (token) names.add(token);
  }
  return names;
}

// Resolves every literal part name a `part=` attribute could statically
// render as. Mirrors check-manifest.mjs's namesFromTemplates() resolution
// order (ternary-of-literals, a referenced `const/let part = ...`, a typed
// `part: 'a' | 'b'` parameter) but scoped to a single attribute occurrence
// rather than the whole file, since a guard-rule lookup needs to know
// specifically which part name(s) apply to *this* element.
function resolvePartNames(attrText, wholeSource) {
  const part = getAttr(attrText, 'part');
  if (!part) return [];
  if (part.kind === 'static') return [...part.value.trim().split(/\s+/)].filter(Boolean);
  const expr = part.expr.trim();
  // `part=${'a b'}` / `part=${cond ? 'a' : 'b'}` -- every literal in the
  // branch(es), the condition (if any) stripped out first.
  const literalNames = collectLiterals(ternaryBranches(expr) ?? expr);
  if (literalNames.size > 0) return [...literalNames];
  // `part=${identifier}` -- resolve via a `const/let identifier = ...` assignment
  // (ternary-of-literals or a single literal) declared anywhere earlier in the file.
  const identifierMatch = expr.match(/^\s*([A-Za-z_$][\w$]*)\s*$/);
  if (identifierMatch) {
    const identifier = identifierMatch[1];
    const assign = wholeSource.match(new RegExp(`\\b(?:const|let)\\s+${identifier}\\s*=([^;]+);`));
    if (assign) {
      const assignExpr = assign[1].trim();
      return [...collectLiterals(ternaryBranches(assignExpr) ?? assignExpr)];
    }
  }
  return [];
}

// A call to a `*Icon(...)` helper (this codebase's internal/icons.ts naming
// convention -- chevronIcon(), closeIcon(), playIcon(), ...) or `.localize(`
// (this codebase's i18n convention, see localize()'s own gotcha in project
// memory) are the two statically-recognizable "this renders as text/a
// translated label, not a compact glyph" signals. Everything else bare
// (`${item.emoji}`, `${option.icon}`, a plain property/variable reference)
// is deliberately left ambiguous and treated as NOT meaningful text -- see
// the false-positive-rate notes below for why: <lyra-emoji-picker>'s own
// `${item.emoji}` is exactly this shape, and it's the shape this check
// exists to catch.
const ICON_CALL_RE = /\$\{[^{}]*\b\w*Icon\([^)]*\)[^{}]*\}/g;
const TEXT_CALL_RE = /\.localize\(/;

// Determines whether the rendered content of a candidate element (the
// template text strictly between its opening and closing tag) looks like a
// normal-sized, textual/slotted/composite control rather than a compact icon
// toggle. `wholeSource` lets a bare `${identifier}` content expression (no
// markup of its own at the call site) follow that reference back to a
// `const identifier = html\`...\`` declared elsewhere in the same file --
// e.g. <lyra-app-rail-item>'s `[part="base"]`, whose actual composite icon
// + label + tooltip markup lives in a `content` variable built once and
// reused across its `<a>`/`<button>` branches, not inlined at either call
// site.
function contentLooksLikeText(content, wholeSource, depth = 0) {
  if (/<slot\b/.test(content)) return { excluded: true, reason: 'contains a <slot>' };

  const bareIdentifier = content.trim().match(/^\$\{\s*([A-Za-z_$][\w$]*)\s*\}$/);
  if (bareIdentifier && depth < 4 && wholeSource) {
    const identifier = bareIdentifier[1];
    const declMatch = wholeSource.match(new RegExp(`\\b(?:const|let)\\s+${identifier}\\s*=\\s*(?:html|svg)?\\s*\``));
    if (declMatch) {
      const backtickIndex = declMatch.index + declMatch[0].length;
      const balanced = extractBalancedBacktick(wholeSource, backtickIndex);
      if (balanced) return contentLooksLikeText(balanced, wholeSource, depth + 1);
    }
  }

  let working = content;
  // Strip decorative wrappers: elements marked aria-hidden="true" (this
  // codebase's consistent convention for icon-only wrapper spans, e.g.
  // code-block/json-viewer's `<span class="chevron" aria-hidden="true">`)
  // are removed whole (tag + content) before judging what's left.
  for (;;) {
    let strippedAny = false;
    for (const tag of openTags(working)) {
      if (!/aria-hidden\s*=\s*["']true["']/.test(tag.attrText)) continue;
      const close = findMatchingClose(working, tag.tagName, tag.contentStart);
      if (!close) continue;
      working = working.slice(0, tag.tagStart) + working.slice(close.end);
      strippedAny = true;
      break; // indices shifted -- restart the scan over the shrunk string
    }
    if (!strippedAny) break;
  }

  // Any element still standing after decorative stripping means this button
  // wraps a sibling/nested region beyond a single glyph -- a composite row
  // (e.g. <lyra-activity-feed>'s `[part="header"]`, which also carries its
  // own `[part="label"]`/`[part="summary"]` text spans) or a genuinely
  // nested real control (<lyra-data-grid>'s sortable `<th>` wrapping its own
  // `<button>`). Both are "regular-sized", not a bare icon toggle, no matter
  // what text each nested part actually renders.
  for (const _tag of openTags(working)) {
    return { excluded: true, reason: 'contains a non-decorative nested element' };
  }

  // No nested markup left -- content is now plain text and/or bare
  // interpolations. Strip icon-helper calls that were used directly (no
  // wrapping span at all, e.g. <lyra-date-picker>'s `[part="previous"]`).
  working = working.replace(ICON_CALL_RE, '');
  if (TEXT_CALL_RE.test(working)) return { excluded: true, reason: 'renders a this.localize(...) label' };
  // A bare interpolation whose expression reads an obviously text/label-
  // shaped property (`${this.titleText}`, `${test.name}`, ...) is the last
  // static signal available for the genuinely ambiguous "bare interpolation,
  // no wrapping tag" case (see ICON_CALL_RE's doc comment) -- e.g.
  // <lyra-source-card>'s `[part="title"]` button, an auto-width hyperlink-
  // styled heading with neither a flex-grow nor a 100%-width tell. This is
  // a narrower, lower-confidence heuristic than the two calls above, so it
  // only runs after both of them have already come up empty.
  if (/\$\{[^{}]*(?:title|label|name|headline|summary|caption)[^{}]*\}/i.test(working)) {
    return { excluded: true, reason: 'renders a title/label/name-shaped bare interpolation' };
  }
  // A literal text node (not inside any `${...}`) is always meaningful
  // (e.g. <lyra-callout>'s `[part="close-button"]`'s literal "×"). A bare
  // expression body left over after all of the above (`${item.emoji}`,
  // `${line}`, ...) is deliberately left ambiguous -- see the doc comment
  // above ICON_CALL_RE for why it stays a candidate instead.
  const outsideInterpolation = working.replace(/\$\{[^{}]*\}/g, ' ');
  if (/[A-Za-z0-9]/.test(outsideInterpolation)) return { excluded: true, reason: 'literal text content' };
  return { excluded: false };
}

// ---- CSS-side guard lookup -------------------------------------------------

function parseRuleBlocks(css) {
  const blocks = [];
  function parseLevel(from, to) {
    let headerStart = from;
    let j = from;
    while (j < to) {
      if (css[j] === '{') {
        const header = css.slice(headerStart, j).trim();
        let depth = 1;
        let k = j + 1;
        while (k < to && depth > 0) {
          if (css[k] === '{') depth++;
          else if (css[k] === '}') depth--;
          k++;
        }
        const bodyStart = j + 1;
        const bodyEnd = k - 1;
        if (/^@(?:media|supports|container)\b/.test(header)) {
          parseLevel(bodyStart, bodyEnd);
        } else if (!header.startsWith('@') && header) {
          blocks.push({ selector: header, body: css.slice(bodyStart, bodyEnd) });
        }
        j = k;
        headerStart = k;
        continue;
      }
      j++;
    }
  }
  parseLevel(0, css.length);
  return blocks;
}

function splitTopLevel(text, separatorRe) {
  const parts = [];
  let depth = 0;
  let last = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0) {
      separatorRe.lastIndex = i;
      const m = separatorRe.exec(text);
      if (m && m.index === i) {
        parts.push(text.slice(last, i));
        i += Math.max(m[0].length - 1, 0);
        last = i + 1;
      }
    }
  }
  parts.push(text.slice(last));
  return parts;
}

function lastCompound(selector) {
  // Split on combinators (descendant-space, `>`, `+`, `~`) at paren-depth 0,
  // so `:host(:disabled) [part='trigger']` splits into [":host(:disabled)",
  // "[part='trigger']"] rather than being confused by the space inside
  // `:host(...)`. The sibling-combinator `~` must NOT match when it's really
  // the attribute "contains token" operator `~=` (e.g. `[part~='item']`) --
  // otherwise this splits that attribute selector in half and returns just
  // `="item']"` as the "compound", silently failing to match ever again.
  const compounds = splitTopLevel(selector.trim(), /[ \t\n]+|>|\+|~(?!=)/g).map((s) => s.trim()).filter(Boolean);
  return compounds.at(-1) ?? '';
}

function partSelectorMatches(compound, partName) {
  if (compound.includes('::')) return false; // pseudo-element -- a different box than the element itself
  const re = new RegExp(`\\[part(?:~=|=)(['"])${partName}\\1\\]`);
  return re.test(compound);
}

function resolveLength(raw, localVars, depth = 0) {
  const value = raw.trim();
  const varMatch = value.match(/^var\(/);
  if (varMatch) {
    const balanced = extractBalanced(value, 4, '(', ')');
    if (!balanced) return { kind: 'unresolved', px: null };
    const commaIdx = splitTopLevel(balanced.content, /,/g);
    const varName = commaIdx[0].trim();
    const fallback = commaIdx.length > 1 ? commaIdx.slice(1).join(',').trim() : null;
    if (varName === ICON_BUTTON_TOKEN) return { kind: 'token', px: FLOOR_PX };
    const sizeToken = varName.match(/^--lyra-size-(neg-)?([0-9]+(?:-[0-9]+)?)(rem|px|em|ch)$/);
    if (sizeToken) {
      const [, neg, digits, unit] = sizeToken;
      if (neg) return { kind: 'literal', px: -1 };
      if (unit !== 'rem' && unit !== 'px') return { kind: 'unresolved', px: null };
      const num = Number(digits.replace('-', '.'));
      return { kind: 'literal', px: unit === 'rem' ? num * REM_PX : num };
    }
    if (depth < 4 && localVars.has(varName)) return resolveLength(localVars.get(varName), localVars, depth + 1);
    if (fallback && depth < 4) return resolveLength(fallback, localVars, depth + 1);
    return { kind: 'unresolved', px: null };
  }
  const fnMatch = value.match(/^(min|max)\(/);
  if (fnMatch) {
    const balanced = extractBalanced(value, fnMatch[0].length, '(', ')');
    if (!balanced) return { kind: 'unresolved', px: null };
    const args = splitTopLevel(balanced.content, /,/g).map((arg) => resolveLength(arg, localVars, depth + 1));
    if (args.some((arg) => arg.kind === 'unresolved')) return { kind: 'unresolved', px: null };
    const pxValues = args.map((arg) => arg.px);
    const px = fnMatch[1] === 'min' ? Math.min(...pxValues) : Math.max(...pxValues);
    return { kind: 'literal', px };
  }
  const literal = value.match(/^([-+]?(?:\d+(?:\.\d+)?|\.\d+))(rem|px)$/);
  if (literal) {
    const num = Number(literal[1]);
    return { kind: 'literal', px: literal[2] === 'rem' ? num * REM_PX : num };
  }
  return { kind: 'unresolved', px: null };
}

function isCompliant(resolved) {
  return resolved.kind === 'token' || (resolved.kind === 'literal' && resolved.px >= FLOOR_PX);
}

function collectLocalVars(css) {
  const vars = new Map();
  for (const m of css.matchAll(/(--[A-Za-z][\w-]*)\s*:\s*([^;]+);/g)) {
    if (!vars.has(m[1])) vars.set(m[1], m[2]);
  }
  return vars;
}

// A rule that sets `flex-grow`/shorthand `flex` to a positive value
// deliberately grows the element to consume its row's remaining space (e.g.
// <lyra-test-results>'s `[part="test-name"]`, `flex: 1 1 auto` with
// `min-inline-size: 6ch` only as an anti-collapse floor, not its real
// rendered width). That's the opposite of "compact icon toggle" -- every
// actual icon-button reference shape in this codebase (code-block/
// json-viewer's own `[part="toggle"]`) instead pins `flex: 0 0 auto`. A
// bare interpolation with no wrapping tag (this check's ambiguous case, see
// ICON_CALL_RE's doc comment) is exactly what a "grows to fill the row" text
// button looks like structurally, so this is checked as a dedicated escape
// alongside the class-based full-width one above.
function hasPositiveFlexGrow(body) {
  const flexGrowMatch = body.match(/(?:^|;)\s*flex-grow\s*:\s*([^;]+);/);
  if (flexGrowMatch && Number.parseFloat(flexGrowMatch[1]) > 0) return true;
  const flexMatch = body.match(/(?:^|;)\s*flex\s*:\s*([^;]+);/);
  if (flexMatch) {
    const first = Number.parseFloat(flexMatch[1].trim().split(/\s+/)[0]);
    if (!Number.isNaN(first) && first > 0) return true;
  }
  return false;
}

// For a given part name, finds every rule block whose selector's rightmost
// compound targets `[part='name']`/`[part~='name']` directly (not as an
// ancestor of some other descendant -- see lastCompound()) and reports on
// its min-inline-size/min-block-size declarations. A part can legitimately
// be guarded by more than one block (e.g. a base rule plus a `:host([x])`
// contextual override); every matching block's declared sizes are checked,
// so a later, more specific rule that shrinks the box below the floor is
// still caught even when an earlier base rule is compliant.
function guardResultForPart(styleSources, partName) {
  const blocks = [];
  for (const css of styleSources) {
    for (const block of parseRuleBlocks(css)) {
      const selectors = splitTopLevel(block.selector, /,/g);
      if (selectors.some((selector) => partSelectorMatches(lastCompound(selector), partName))) {
        blocks.push(block);
      }
    }
  }
  if (blocks.length === 0) return { found: false, offending: [] };
  if (blocks.some((block) => hasPositiveFlexGrow(block.body))) return { found: true, offending: [], sawInline: true, sawBlock: true };

  const localVars = collectLocalVars(styleSources.join('\n'));
  const offending = [];
  let sawInline = false;
  let sawBlock = false;
  for (const block of blocks) {
    const inlineMatch = block.body.match(/(?:^|;)\s*min-inline-size\s*:\s*([^;]+);/);
    const blockMatch = block.body.match(/(?:^|;)\s*min-block-size\s*:\s*([^;]+);/);
    if (inlineMatch) {
      sawInline = true;
      const resolved = resolveLength(inlineMatch[1], localVars);
      if (!isCompliant(resolved)) offending.push({ selector: block.selector.trim(), property: 'min-inline-size', raw: inlineMatch[1].trim(), resolved });
    }
    if (blockMatch) {
      sawBlock = true;
      const resolved = resolveLength(blockMatch[1], localVars);
      if (!isCompliant(resolved)) offending.push({ selector: block.selector.trim(), property: 'min-block-size', raw: blockMatch[1].trim(), resolved });
    }
  }
  return { found: true, offending, sawInline, sawBlock };
}

// ---- Candidate detection ---------------------------------------------------

// SVG geometry marks (chart bars/points, graph nodes/edges/hulls, minimap
// viewport rects, ...) are frequently `role="button" tabindex="0"` with
// their own `part=` for keyboard-accessible data marks, but their rendered
// "hit area" is their data-driven geometry (a bar's width/height, a point's
// radius) -- not a decorative icon-glyph box a CSS min-inline-size/
// min-block-size floor was ever meant to govern. Forcing every chart mark to
// a 40px minimum would fight the very thing they're drawn to represent, so
// this check scopes itself to HTML boxes and excludes the SVG shape
// elements entirely.
const SVG_GEOMETRY_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line', 'g']);

function resolveClassNames(attrText) {
  const cls = getAttr(attrText, 'class');
  if (!cls) return [];
  if (cls.kind === 'static') return cls.value.trim().split(/\s+/).filter(Boolean);
  const expr = cls.expr.trim();
  return [...collectLiterals(ternaryBranches(expr) ?? expr)];
}

// A narrow, principled escape from the part-based guard search: an element
// whose CLASS (not part) selector explicitly sets `inline-size`/`width:
// 100%` is a deliberately full-width control (e.g. <lyra-code-block>'s
// `button.line` -- an interactive source-code line, sized via its `.line`
// class rather than its `part="line-button"` shadow-part, which exists
// purely for external consumer styling). That is definitionally not the
// "compact icon toggle" shape this check exists to police, regardless of
// what its `part=` guard search finds (or fails to find).
function hasFullWidthClassOverride(styleSources, classNames) {
  for (const className of classNames) {
    for (const css of styleSources) {
      for (const block of parseRuleBlocks(css)) {
        const selectors = splitTopLevel(block.selector, /,/g);
        const matches = selectors.some((selector) => {
          const compound = lastCompound(selector);
          return !compound.includes('::') && new RegExp(`\\.${className}\\b`).test(compound);
        });
        if (matches && /(?:^|;)\s*(?:inline-size|width)\s*:\s*100%\s*(?:;|$)/.test(block.body)) return true;
      }
    }
  }
  return false;
}

// Matches an `inline-size`/`block-size`/`width`/`height` declaration as a
// property name specifically (CSS-string syntax `inline-size:`/`width:` or a
// `styleMap({...})` JS object's `inlineSize:`/`width:` key) -- the
// look-behind character class deliberately excludes a preceding `-`/word
// char so `min-width:`/`border-width:` (a different, unrelated property)
// never false-matches just because they end in the same word.
const INLINE_SIZE_STYLE_RE = /(?:^|[;{,\s'"])(?:inline-size|inlineSize|block-size|blockSize|width|height)\s*:/;

// A candidate whose SAME opening tag sets its own inline-size/block-size (or
// physical width/height) via a `style=` attribute is sized from runtime data
// (a heatmap cell's grid rect, a waterfall span's duration-proportional
// width, ...), not this component's stylesheet -- the same "data
// visualization mark" category the SVG-geometry exclusion above covers, just
// authored as an HTML element with an inline style instead of an SVG shape.
// The 40px floor doesn't apply to a heatmap cell that's deliberately smaller
// because the grid is dense; there's nothing this check can verify here
// regardless (the box size isn't in the stylesheet this check reads at
// all), so it's excluded rather than misreported as either compliant or a
// violation. A swatch/color custom-property assignment (e.g.
// <lyra-swatch-picker>'s `style=${styleMap({'--lyra-swatch-color': ...})}`)
// does NOT match, since that sets no sizing property at all.
function hasInlineSizeStyle(attrText) {
  const style = getAttr(attrText, 'style');
  if (!style) return false;
  return INLINE_SIZE_STYLE_RE.test(style.kind === 'static' ? style.value : style.expr);
}

function findCandidates(strippedSource, styleSources) {
  const candidates = [];
  for (const tag of openTags(strippedSource)) {
    if (SVG_GEOMETRY_TAGS.has(tag.tagName.toLowerCase())) continue;
    const isButton = tag.tagName.toLowerCase() === 'button';
    if (!isButton && !isRoleButton(tag.attrText) && !isTabindexZero(tag.attrText)) continue;
    const partNames = resolvePartNames(tag.attrText, strippedSource);
    if (partNames.length === 0) continue; // no part= on this same opening tag -- nothing to guard-check

    const close = findMatchingClose(strippedSource, tag.tagName, tag.contentStart);
    const content = close ? strippedSource.slice(tag.contentStart, close.start) : '';
    const textCheck = close ? contentLooksLikeText(content, strippedSource) : { excluded: false };
    if (textCheck.excluded) continue;
    if (hasFullWidthClassOverride(styleSources, resolveClassNames(tag.attrText))) continue;
    if (hasInlineSizeStyle(tag.attrText)) continue;

    candidates.push({ tagName: tag.tagName, tagStart: tag.tagStart, partNames });
  }
  return candidates;
}

function resolveStylesSources(classFilePath, classSource) {
  const dir = path.dirname(classFilePath);
  const specifiers = [...classSource.matchAll(/from\s+['"](\.\/[\w-]+\.styles)\.js['"]/g)].map((m) => m[1]);
  const basenames = new Set(specifiers.map((s) => s.replace(/^\.\//, '')));
  if (basenames.size === 0) {
    const fallback = `${path.basename(classFilePath, '.class.ts')}.styles`;
    basenames.add(fallback);
  }
  const sources = [];
  for (const base of basenames) {
    const stylesPath = path.join(dir, `${base}.ts`);
    if (fs.existsSync(stylesPath)) sources.push(fs.readFileSync(stylesPath, 'utf8'));
  }
  return sources;
}

function hasEscapeHatch(rawLines, tagLineNumber) {
  const from = Math.max(0, tagLineNumber - 6);
  for (let i = from; i < tagLineNumber; i++) {
    if (rawLines[i]?.includes(ESCAPE_HATCH)) return true;
  }
  return false;
}

// ---- main -------------------------------------------------------------

const classFiles = walk(sourceDir)
  .filter((file) => file.endsWith('.class.ts'))
  .sort();

const errors = [];
let candidateCount = 0;
let exemptCount = 0;

for (const classFile of classFiles) {
  const rawSource = fs.readFileSync(classFile, 'utf8');
  const strippedSource = stripComments(rawSource);
  const rawLines = rawSource.split('\n');
  const relPath = path.relative(packageDir, classFile).replaceAll(path.sep, '/');

  const styleSources = resolveStylesSources(classFile, rawSource).map(stripComments);
  const candidates = findCandidates(strippedSource, styleSources);
  if (candidates.length === 0) continue;

  for (const candidate of candidates) {
    const tagLine = lineAt(strippedSource, candidate.tagStart);
    candidateCount++;
    if (hasEscapeHatch(rawLines, tagLine)) {
      exemptCount++;
      continue;
    }

    for (const partName of candidate.partNames) {
      const guard = guardResultForPart(styleSources, partName);
      if (!guard.found) {
        errors.push(
          `${relPath}:${tagLine}: <${candidate.tagName} part="${partName}"> has no [part='${partName}'] rule at all ` +
            `in its styles file -- no min-inline-size/min-block-size guard, floor is ${FLOOR_PX}px (${ICON_BUTTON_TOKEN})`,
        );
        continue;
      }
      if (!guard.sawInline || !guard.sawBlock) {
        const missing = [!guard.sawInline && 'min-inline-size', !guard.sawBlock && 'min-block-size'].filter(Boolean).join(' and ');
        errors.push(
          `${relPath}:${tagLine}: <${candidate.tagName} part="${partName}"> is missing ${missing} on its [part='${partName}'] rule(s) -- floor is ${FLOOR_PX}px (${ICON_BUTTON_TOKEN})`,
        );
      }
      for (const offense of guard.offending) {
        errors.push(
          `${relPath}:${tagLine}: <${candidate.tagName} part="${partName}"> -- selector "${offense.selector}" sets ` +
            `${offense.property}: ${offense.raw} (${offense.resolved.kind === 'unresolved' ? 'unresolved, cannot confirm it meets the floor' : `resolves to ${offense.resolved.px}px`}), below the ${FLOOR_PX}px floor (${ICON_BUTTON_TOKEN})`,
        );
      }
    }
  }
}

if (errors.length) {
  console.error(`Hit-area contract failed with ${errors.length} finding(s) (${candidateCount} candidate(s) checked, ${exemptCount} exempted):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Hit-area contract passed: ${candidateCount} icon-button candidate(s) checked across ${classFiles.length} components (${exemptCount} exempted).`);
}
