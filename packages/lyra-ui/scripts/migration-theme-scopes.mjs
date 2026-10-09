// The `theme-scopes` structural migration rule (RFC 0002). Lyra 27 declares the shared --lr-*
// layer once per document and re-derives it only at theme scopes, so an element whose inline style
// sets a --lr-theme-* input that the layer consumes has to become a scope for the components below
// it to follow that input, as they did on every host before.
//
//  - Markup (HTML, Lit templates, JSX, Vue/Svelte templates): such an element gets the marker
//    `data-lr-theme-scope` (`=""` in JSX, where React would stringify a bare `true`), and so does an
//    element whose inline style sets a shared output that other outputs derive from
//    (`--lr-transition-fast` feeds `--lr-transition-interactive`): only a scope re-derives them. A marker
//    changes nothing where no unscoped input or output sits above it: with the inherited mode
//    switches a redundant scope re-derives the same values in any mode.
//  - Markers added inside a repeated template are reported, because every rendered element then
//    becomes a scope of ~250 declarations; move the inputs to a common ancestor where possible.
//  - Dynamic inputs (`style.setProperty('--lr-theme-…')`) and spread style objects are reported, not
//    rewritten.
//  - CSS (stylesheets and css`` templates): every rule that declares a layer-consumed input on a
//    selector outside the scope list, `:host` and `::slotted()` included, is reported with file,
//    line and selector. Every declaration of a shared output outside a scope is reported too.
//
// Dependency-free and filesystem-free: this module is copied beside migrate-wa.mjs into dist/cli.

import { THEME_SCOPE_VOCABULARY } from './theme-scope-vocabulary.generated.mjs';
import { readDeclarations, splitTopLevel } from './css-declarations.mjs';

export const THEME_SCOPE_RULE = 'theme-scopes';
const THEME_SCOPE_MARKER = 'data-lr-theme-scope';

const CONSUMED = new Set(THEME_SCOPE_VOCABULARY.consumedInputs);
const OUTPUTS = new Set(THEME_SCOPE_VOCABULARY.outputs);
const FEEDING = new Set(THEME_SCOPE_VOCABULARY.feedingOutputs);
const SCOPE_ATTRIBUTE = new RegExp(
  `(?:^|[\\s/])[?.:@]?(?:${THEME_SCOPE_VOCABULARY.scopeAttributes.join('|')})(?=[\\s=/>]|$)`,
);
const SCOPE_CLASS = new RegExp(`(?:^|[\\s"'\`{])(?:${THEME_SCOPE_VOCABULARY.scopeClasses.join('|')})(?=[\\s"'\`}]|$)`);
const MARKUP_EXTENSIONS = new Set(['html', 'htm', 'js', 'mjs', 'cjs', 'ts', 'mts', 'cts', 'jsx', 'tsx', 'vue', 'svelte', 'astro']);
const CSS_EXTENSIONS = new Set(['css', 'scss', 'less', 'pcss', 'postcss']);
const JSX_EXTENSIONS = new Set(['jsx', 'tsx']);

const extensionOf = (file) => /\.([a-z0-9]+)$/i.exec(file)?.[1]?.toLowerCase() ?? '';

function lineColumn(text, offset) {
  let line = 1;
  let lineStart = 0;
  for (let index = text.indexOf('\n'); index !== -1 && index < offset; index = text.indexOf('\n', index + 1)) {
    line += 1;
    lineStart = index + 1;
  }
  return { line, column: offset - lineStart + 1 };
}

/** Every start tag, skipping quoted values and `${…}` / `{…}` expressions inside the tag. */
function* startTags(text) {
  let index = 0;
  while ((index = text.indexOf('<', index)) !== -1) {
    const name = /^<([a-zA-Z][\w:-]*)/.exec(text.slice(index, index + 80));
    if (!name) {
      index += 1;
      continue;
    }
    let end = index + name[0].length;
    let quote = '';
    let braces = 0;
    for (; end < text.length; end++) {
      const character = text[end];
      if (quote) {
        if (character === '\\') end += 1;
        else if (character === quote) quote = '';
        continue;
      }
      if (braces) {
        if (character === '{') braces += 1;
        else if (character === '}') braces -= 1;
        else if (character === '"' || character === "'" || character === '`') quote = character;
        continue;
      }
      if (character === '"' || character === "'") quote = character;
      else if (character === '{') braces = 1;
      else if (character === '>' || character === '<') break;
    }
    if (text[end] !== '>') {
      index += 1;
      continue;
    }
    yield { start: index, tag: name[1], attributesStart: index + name[0].length, attributes: text.slice(index + name[0].length, end) };
    index = end + 1;
  }
}

/** The text of the tag's style binding value, or null (static, Lit, Vue and JSX forms). */
function styleValue(attributes) {
  const match = /(?:^|\s)[.:]?style\s*=\s*/.exec(attributes);
  if (!match) return null;
  const rest = attributes.slice(match.index + match[0].length);
  const opener = rest[0];
  if (opener === '"' || opener === "'") return rest.slice(1, rest.indexOf(opener, 1) === -1 ? undefined : rest.indexOf(opener, 1));
  const start = opener === '$' && rest[1] === '{' ? 2 : opener === '{' ? 1 : -1;
  if (start < 0) return rest.split(/\s/)[0];
  let depth = 1;
  for (let index = start; index < rest.length; index++) {
    if (rest[index] === '{') depth += 1;
    else if (rest[index] === '}' && --depth === 0) return rest.slice(start, index);
  }
  return rest.slice(start);
}

/** Custom properties a style value DECLARES (`--x: …` or a `'--x': …` object key), not ones it reads. */
const declaredIn = (value) => [...value.matchAll(/(--lr-(?:theme-)?[a-z0-9-]+)\s*['"`]?\s*:/g)].map((match) => match[1]);
const consumedIn = (value) => [...new Set(declaredIn(value).filter((name) => CONSUMED.has(name)))];
const feedingIn = (value) => [...new Set(declaredIn(value).filter((name) => FEEDING.has(name)))];

/** A repeated template: the tag sits inside a list-rendering construct that has not closed yet. */
function insideRepeat(text, offset) {
  const before = text.slice(Math.max(0, offset - 600), offset);
  return /\.map\(\s*(?:\([^)]*\)|[\w$]+)\s*=>|\brepeat\(|\bv-for=|\*ngFor=|\{#each\b|\.forEach\(/.test(before);
}

function selectorIsScope(selector) {
  return isThemeScopeSelector(selector);
}

/** Removes every `:not(...)` group: a negated scope fragment does not make a selector a scope. */
function withoutNegations(selector) {
  let output = '';
  for (let index = 0; index < selector.length; index++) {
    if (selector.startsWith(':not(', index)) {
      let depth = 0;
      for (index += 4; index < selector.length; index++) {
        if (selector[index] === '(') depth += 1;
        else if (selector[index] === ')' && --depth === 0) break;
      }
      continue;
    }
    output += selector[index];
  }
  return output;
}

/** The subject compound of a complex selector (after its last top-level combinator). */
function subjectCompound(selector) {
  let depth = 0;
  let start = 0;
  for (let index = 0; index < selector.length; index++) {
    const character = selector[index];
    if (character === '(' || character === '[') depth += 1;
    else if (character === ')' || character === ']') depth -= 1;
    else if (depth === 0 && /[\s>+~]/.test(character)) start = index + 1;
  }
  return selector.slice(start);
}

const SCOPE_FRAGMENTS = [':root', 'html', ...THEME_SCOPE_VOCABULARY.scopeClasses.map((name) => `.${name}`),
  ...THEME_SCOPE_VOCABULARY.scopeAttributes.map((name) => `[${name}`)];

/** True when `selector` only ever matches theme scopes. */
export function isThemeScopeSelector(selector) {
  const trimmed = withoutNegations(selector.trim());
  const subject = subjectCompound(trimmed);
  if (SCOPE_FRAGMENTS.some((fragment) => subject.includes(fragment))) return true;
  // A look's scoped mode aliases: `.light` / `.dark` inside (or on) a [data-lr-look] boundary.
  return /\.(?:light|dark)\b/.test(subject) && trimmed.includes('[data-lr-look');
}

function cssReports(css, offset, text, file, warn) {
  for (const declaration of readDeclarationsWithOffsets(css)) {
    if (!declaration.selector) continue;
    const selectors = splitTopLevel(declaration.selector, ',').map((selector) => selector.trim()).filter((selector) => !selectorIsScope(selector));
    if (!selectors.length) continue;
    const position = lineColumn(text, offset + declaration.offset);
    if (CONSUMED.has(declaration.property)) {
      warn(position, {
        code: 'THEME_SCOPE_CSS_INPUT_REVIEW',
        member: declaration.property,
        target: THEME_SCOPE_MARKER,
        message: `${selectors.join(', ')} sets ${declaration.property}, which the Lyra token layer consumes, but is not a theme scope: mark the matched elements with ${THEME_SCOPE_MARKER} (a :host or ::slotted() rule means the host or slotted element).`,
      });
    } else if (OUTPUTS.has(declaration.property)) {
      warn(position, {
        code: 'THEME_SCOPE_OUTPUT_REVIEW',
        member: declaration.property,
        target: THEME_SCOPE_MARKER,
        message: FEEDING.has(declaration.property)
          ? `${selectors.join(', ')} sets the shared output ${declaration.property}: it now reaches deeper (until the next theme scope), and the outputs derived from it no longer follow it. Set its --lr-theme-* input on a theme scope, or mark the element with ${THEME_SCOPE_MARKER}.`
          : `${selectors.join(', ')} sets the shared output ${declaration.property}: it now reaches deeper, until the next theme scope, instead of stopping at the first Lyra component.`,
      });
    }
  }
}

/** `readDeclarations` with each declaration's offset into `css` (approximate: the property name). */
function readDeclarationsWithOffsets(css) {
  const declarations = readDeclarations(css);
  let cursor = 0;
  return declarations.map((declaration) => {
    const found = css.indexOf(declaration.property, cursor);
    const offset = found === -1 ? cursor : found;
    cursor = found === -1 ? cursor : found + declaration.property.length;
    return { ...declaration, offset };
  });
}

/**
 * Analyzes one file's text without editing it. Returns `{ insertions, warnings, marker }`: each
 * insertion is `{ offset, change }` (insert `marker` at `offset`), and entries follow the migration
 * report schema (`file`, `line`, `column`, `action`, ...). Shared by the standalone rule and the
 * `rules` of a migration profile.
 */
export function analyzeThemeScopes(text, { file = 'input' } = {}) {
  const extension = extensionOf(file);
  const warnings = [];
  const marker = JSX_EXTENSIONS.has(extension) ? ` ${THEME_SCOPE_MARKER}=""` : ` ${THEME_SCOPE_MARKER}`;
  const warn = (position, { code, tag = null, member = null, target = null, message }) => warnings.push({
    file, ...position, rule: THEME_SCOPE_RULE, upstreamTag: tag, upstreamMember: member,
    action: 'manual-review', target, warningCode: code, message,
  });

  if (CSS_EXTENSIONS.has(extension)) {
    cssReports(text, 0, text, file, warn);
    return { insertions: [], warnings, marker };
  }
  if (!MARKUP_EXTENSIONS.has(extension) && extension !== '') return { insertions: [], warnings, marker };

  const insertions = [];
  for (const tag of startTags(text)) {
    const value = styleValue(tag.attributes);
    if (value === null) continue;
    const inputs = consumedIn(value);
    const feeding = feedingIn(value);
    if (!inputs.length && !feeding.length) {
      if (/\.\.\.\s*[\w$.]+/.test(value) && /style/.test(tag.attributes)) {
        warn(lineColumn(text, tag.start), {
          code: 'THEME_SCOPE_DYNAMIC_INPUT_REVIEW',
          target: THEME_SCOPE_MARKER,
          message: `<${tag.tag}> spreads a style object; if it can carry a --lr-theme-* input the Lyra token layer consumes, mark the element with ${THEME_SCOPE_MARKER}.`,
        });
      }
      continue;
    }
    // `data-lr-not-a-scope` documents a deliberate negative control (a test that proves a plain wrapper is not a scope).
    if (/\sdata-lr-not-a-scope(?=[\s=>]|$)/.test(tag.attributes)) continue;
    if (tag.tag.toLowerCase() === 'html' || SCOPE_ATTRIBUTE.test(tag.attributes) || SCOPE_CLASS.test(classValue(tag.attributes))) continue;
    const position = lineColumn(text, tag.start);
    const members = [...inputs, ...feeding];
    insertions.push({ offset: tag.attributesStart, change: {
      file, ...position, rule: THEME_SCOPE_RULE, upstreamTag: tag.tag, upstreamMember: members.join(' '),
      action: 'insert-theme-scope', target: THEME_SCOPE_MARKER,
      message: inputs.length
        ? `Mark <${tag.tag}> with ${THEME_SCOPE_MARKER}: its inline ${inputs.join(', ')} must re-derive the Lyra token layer for the components below it.`
        : `Mark <${tag.tag}> with ${THEME_SCOPE_MARKER}: other shared outputs derive from its inline ${feeding.join(', ')}, and only a theme scope re-derives them.`,
    } });
    if (insideRepeat(text, tag.start)) {
      warn(position, {
        code: 'THEME_SCOPE_REPEATED_REVIEW',
        tag: tag.tag,
        target: THEME_SCOPE_MARKER,
        message: `<${tag.tag}> is rendered in a loop: each instance is now a theme scope that re-derives the whole token layer. Prefer setting ${members.join(', ')} once on a common ancestor scope.`,
      });
    }
  }
  for (const match of text.matchAll(/\.setProperty\(\s*(['"`])(--lr-[a-z0-9-]+)\1/g)) {
    if (!CONSUMED.has(match[2]) && !FEEDING.has(match[2])) continue;
    warn(lineColumn(text, match.index), {
      code: 'THEME_SCOPE_DYNAMIC_INPUT_REVIEW',
      member: match[2],
      target: THEME_SCOPE_MARKER,
      message: CONSUMED.has(match[2])
        ? `setProperty('${match[2]}') sets an input the Lyra token layer consumes: make sure the element is a theme scope (${THEME_SCOPE_MARKER}).`
        : `setProperty('${match[2]}') sets a shared output that other outputs derive from: they follow it only on a theme scope (${THEME_SCOPE_MARKER}).`,
    });
  }
  for (const match of text.matchAll(/\bcss`([^`]*)`/g)) cssReports(match[1], match.index + 4, text, file, warn);
  if (extension === 'html' || extension === 'htm' || extension === 'vue' || extension === 'svelte' || extension === 'astro') {
    for (const match of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
      cssReports(match[1], match.index + match[0].indexOf('>') + 1, text, file, warn);
    }
  }

  return { insertions, warnings, marker };
}

/**
 * Applies the rule to one file's text. Returns `{ content, changes, warnings }`, where entries
 * follow the migration report schema (`file`, `line`, `column`, `action`, ...).
 */
export function migrateThemeScopes(text, { file = 'input' } = {}) {
  const { insertions, warnings, marker } = analyzeThemeScopes(text, { file });
  let content = text;
  for (const { offset } of [...insertions].sort((left, right) => right.offset - left.offset)) {
    content = `${content.slice(0, offset)}${marker}${content.slice(offset)}`;
  }
  return { content, changes: insertions.map(({ change }) => change), warnings };
}

/** The text of the tag's class/className binding, or '' (any form). */
function classValue(attributes) {
  const match = /(?:^|\s)[.:]?(?:class|className)\s*=\s*/.exec(attributes);
  if (!match) return '';
  return attributes.slice(match.index + match[0].length, match.index + match[0].length + 400);
}
