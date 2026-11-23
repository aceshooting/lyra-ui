// Web Awesome / Shoelace utility classes, theme classes, stylesheet and loader specifiers.
//
// The rewrite tables are plain data at the top of this module; the scanners below only locate
// whole class tokens and module specifiers and look them up. Names come from the upstream
// packages' public surface; every target is a class or package subpath that exists in Lyra UI.

const LYRA = '@aceshooting/lyra-ui';

// ---------------------------------------------------------------------------------------------
// Class tables
// ---------------------------------------------------------------------------------------------

/** A scale step that carries the same value under a different name on each side. */
const SPACE_STEPS = Object.freeze([
  // Web Awesome step -> Lyra step with the same rem value (the two scales are offset).
  ['3xs', '2xs'],
  ['2xs', 'xs'],
  ['xs', 's'],
  ['s', 'm'],
  ['m', 'l'],
  ['l', 'xl'],
  ['xl', '2xl'],
  ['3xl', '3xl'],
  ['4xl', '4xl'],
]);
const SIZE_STEPS = Object.freeze(['xs', 's', 'm', 'l', 'xl']);
const FONT_STEPS = Object.freeze([
  ['xs', 'xs'], ['s', 'sm'], ['m', 'base'], ['l', 'lg'], ['xl', 'xl'],
  ['2xl', '2xl'], ['3xl', '3xl'], ['4xl', '4xl'], ['5xl', '5xl'],
]);
const TEXT_STEPS = Object.freeze(['3xs', '2xs', 'xs', 's', 'm', 'l', 'xl', '2xl', '3xl', '4xl', '5xl']);

/**
 * Exact: same behavior, rewritten silently (reported as a change).
 * Keys are whole class tokens, including upstream `:modifier` suffixes.
 */
export const EXACT_CLASS_MAP = Object.freeze({
  // Layout compositions
  'wa-stack': 'lr-stack',
  'wa-cluster': 'lr-cluster',
  'wa-flank': 'lr-flank',
  'wa-flank:start': 'lr-flank',
  'wa-flank:end': 'lr-flank-end',
  'wa-split': 'lr-split',
  'wa-split:row': 'lr-split',
  'wa-split:column': 'lr-split-column',
  'wa-frame': 'lr-frame',
  'wa-frame:square': 'lr-frame-square',
  'wa-frame:landscape': 'lr-frame-landscape',
  'wa-frame:portrait': 'lr-frame-portrait',
  'wa-grid': 'lr-grid-auto',
  'wa-span-grid': 'lr-span-grid',
  // Gaps, mapped by resolved length
  'wa-gap-0': 'lr-gap-0',
  ...Object.fromEntries(SPACE_STEPS.map(([from, to]) => [`wa-gap-${from}`, `lr-gap-${to}`])),
  // Flex alignment and distribution
  'wa-align-items-start': 'lr-items-start',
  'wa-align-items-center': 'lr-items-center',
  'wa-align-items-end': 'lr-items-end',
  'wa-align-items-stretch': 'lr-items-stretch',
  'wa-align-items-baseline': 'lr-items-baseline',
  'wa-align-self-baseline': 'lr-self-baseline',
  'wa-justify-content-space-evenly': 'lr-justify-evenly',
  'wa-flex-wrap-reverse': 'lr-wrap-reverse',
  'wa-text-justify': 'lr-text-justify',
  'wa-font-weight-light': 'lr-font-light',
  'wa-tabular-nums': 'lr-tabular-nums',
  'wa-zebra-rows': 'lr-zebra-rows',
  'wa-hover-rows': 'lr-hover-rows',
  'wa-align-self-start': 'lr-self-start',
  'wa-align-self-center': 'lr-self-center',
  'wa-align-self-end': 'lr-self-end',
  'wa-align-self-stretch': 'lr-self-stretch',
  'wa-justify-content-start': 'lr-justify-start',
  'wa-justify-content-center': 'lr-justify-center',
  'wa-justify-content-end': 'lr-justify-end',
  'wa-justify-content-space-between': 'lr-justify-between',
  'wa-justify-content-space-around': 'lr-justify-around',
  'wa-flex-wrap': 'lr-wrap',
  'wa-flex-nowrap': 'lr-nowrap',
  // Radius
  'wa-border-radius-circle': 'lr-radius-circle',
  'wa-border-radius-pill': 'lr-radius-pill',
  'wa-border-radius-square': 'lr-radius-none',
  // Text
  'wa-text-start': 'lr-text-start',
  'wa-text-center': 'lr-text-center',
  'wa-text-end': 'lr-text-end',
  'wa-text-nowrap': 'lr-text-nowrap',
  'wa-text-wrap-nowrap': 'lr-text-nowrap',
  'wa-text-truncate': 'lr-truncate',
  'wa-text-balance': 'lr-text-balance',
  'wa-text-wrap-balance': 'lr-text-balance',
  'wa-text-pretty': 'lr-text-pretty',
  'wa-text-wrap-pretty': 'lr-text-pretty',
  'wa-text-uppercase': 'lr-uppercase',
  'wa-text-lowercase': 'lr-lowercase',
  'wa-text-capitalize': 'lr-capitalize',
  'wa-font-weight-normal': 'lr-font-normal',
  'wa-font-weight-semibold': 'lr-font-semibold',
  'wa-font-weight-bold': 'lr-font-bold',
  'wa-color-text-quiet': 'lr-text-quiet',
  'wa-link-plain': 'lr-link-plain',
  'wa-list-plain': 'lr-list-plain',
  'wa-prose': 'lr-prose',
  // Helpers
  'wa-visually-hidden': 'lr-visually-hidden',
  'wa-cloak': 'lr-cloak',
  'wa-placeholder': 'lr-placeholder',
  'wa-scroll-lock': 'lr-scroll-lock',
  // Variants and size
  'wa-neutral': 'lr-neutral',
  'wa-brand': 'lr-brand',
  'wa-success': 'lr-success',
  'wa-warning': 'lr-warning',
  'wa-danger': 'lr-danger',
  ...Object.fromEntries(SIZE_STEPS.map((step) => [`wa-size-${step}`, `lr-size-${step}`])),
  // Theme mode scopes
  'wa-dark': 'lr-dark',
  'wa-light': 'lr-light',
  'sl-theme-dark': 'lr-dark',
  'sl-theme-light': 'lr-light',
  'sl-scroll-lock': 'lr-scroll-lock',
});

/**
 * Approximate: the nearest Lyra class, whose resolved value is close but not identical
 * (type and radius scales are not value-aligned). Rewritten, and reported with a review
 * warning so the visual difference is checked.
 */
export const APPROXIMATE_CLASS_MAP = Object.freeze({
  ...Object.fromEntries(FONT_STEPS.map(([from, to]) => [`wa-font-size-${from}`, `lr-text-${to}`])),
  ...Object.fromEntries(FONT_STEPS.map(([from, to]) => [`wa-body-${from}`, `lr-text-${to}`])),
  'wa-border-radius-s': 'lr-radius-xs',
  'wa-border-radius-m': 'lr-radius-m',
});

const typographyReview = (family, hint) =>
  Object.fromEntries(TEXT_STEPS.map((step) => [`wa-${family}-${step}`, hint]));

/**
 * Review: no Lyra class does the same job. Never rewritten; each is reported with the nearest
 * thing to reach for (or the reason there is none).
 */
export const REVIEW_CLASS_MAP = Object.freeze({
  ...typographyReview('heading', 'lr-heading-1 to lr-heading-6 (levels, not sizes) or lr-text-* with lr-font-semibold'),
  ...Object.fromEntries(
    TEXT_STEPS.filter((step) => !FONT_STEPS.some(([from]) => from === step)).flatMap((step) => [
      [`wa-font-size-${step}`, 'lr-text-xs to lr-text-5xl (there is no step this small)'],
      [`wa-body-${step}`, 'lr-text-xs to lr-text-5xl (there is no step this small)'],
    ]),
  ),
  ...typographyReview('caption', 'lr-text-xs or lr-text-sm with lr-text-quiet'),
  ...typographyReview('longform', 'lr-prose, or lr-text-* inside an lr-typography scope'),
  'wa-gap-2xl': 'lr-gap-2xl (2rem) or lr-gap-3xl (3rem); Lyra has no 2.5rem step',
  'wa-gap-5xl': 'lr-gap-4xl (4rem); Lyra has no 5rem step',
  'wa-border-radius-l': 'lr-radius-container, or set border-radius in your own CSS',
  'wa-color-text-normal': 'no equivalent; text colour is inherited from the page',
  'wa-color-text-link': 'no equivalent class; links inside .lr-native and .lr-typography are styled, and lr-link-plain removes the styling',
  'wa-link': 'no equivalent class; links inside .lr-native and .lr-typography are styled',
  'wa-not-prose': 'lr-not-typography leaves an lr-typography scope; lr-prose has no opt-out class',
  'wa-invert': 'no equivalent; use lr-dark or lr-light on the scope',
  'wa-visually-hidden-force': 'lr-visually-hidden (Lyra applies it without a cascade override)',
  'wa-visually-hidden-hint': 'lr-visually-hidden on the hint element',
  'wa-visually-hidden-label': 'lr-visually-hidden on the label element',
  'wa-form-control-label': 'no equivalent; form controls style their own label part',
  'wa-form-control-hint': 'no equivalent; form controls style their own hint part',
  'wa-form-control-value': 'no equivalent; form controls style their own value',
  'wa-form-control-placeholder': 'no equivalent; form controls style their own placeholder',
  'wa-theme-default': 'no class; load @aceshooting/lyra-ui/theme.css (the default theme) once',
  'wa-theme-awesome': 'no equivalent theme; see the look and accent stylesheets (looks/*.css, accents.css)',
  'wa-theme-shoelace': 'no equivalent theme; see the look and accent stylesheets (looks/*.css, accents.css)',
  // native.css opt-in classes
  'wa-button': 'wrap the region in .lr-native, which styles native buttons, or use <lr-button>',
  'wa-filled': 'no equivalent; use <lr-button appearance> or a native control inside .lr-native',
  'wa-outlined': 'no equivalent; use <lr-button appearance> or a native control inside .lr-native',
  'wa-plain': 'no equivalent; use <lr-button appearance> or a native control inside .lr-native',
  'wa-pill': 'lr-radius-pill',
  'wa-accent': 'no equivalent; use the lr-brand variant class on the scope',
  'wa-valid': 'no equivalent; native validity styling comes from .lr-native',
  'wa-invalid': 'no equivalent; native validity styling comes from .lr-native',
  // Shoelace
  'sl-toast-stack': 'no equivalent class; notifications are the <lr-toast> component',
});

const COLOR_NAMES = Object.freeze(['blue', 'cyan', 'gray', 'green', 'indigo', 'orange', 'pink', 'purple', 'red', 'yellow']);
const VARIANT_NAMES = Object.freeze(['brand', 'neutral', 'success', 'warning', 'danger']);
const PALETTE_REVIEW =
  'a hue-pinned variant (hue override of a semantic variant) has no class; set the accent with data-lr-accent or the --lr-color-* tokens';

/** Names the table does not list individually: `wa-brand-blue` and the other 49 variant/hue pairs. */
function isHuePair(token) {
  const match = /^wa-(?<variant>[a-z]+)-(?<hue>[a-z]+)$/.exec(token);
  return Boolean(match && VARIANT_NAMES.includes(match.groups.variant) && COLOR_NAMES.includes(match.groups.hue));
}

const CLASS_TOKEN = /^[A-Za-z_][\w:-]*$/;

/**
 * Looks one whole class token up. Returns null for any name not listed: an unlisted `wa-`/`sl-` name
 * is as likely the project's own class as an upstream one, so it is left alone and unreported.
 * `{ kind: 'exact'|'approximate'|'review', target, hint }`.
 */
export function lookupUpstreamClass(token) {
  if (Object.hasOwn(EXACT_CLASS_MAP, token)) return { kind: 'exact', target: EXACT_CLASS_MAP[token] };
  if (Object.hasOwn(APPROXIMATE_CLASS_MAP, token)) return { kind: 'approximate', target: APPROXIMATE_CLASS_MAP[token] };
  if (Object.hasOwn(REVIEW_CLASS_MAP, token)) return { kind: 'review', hint: REVIEW_CLASS_MAP[token] };
  if (isHuePair(token)) return { kind: 'review', hint: PALETTE_REVIEW };
  return null;
}

// ---------------------------------------------------------------------------------------------
// Class-token scanner
// ---------------------------------------------------------------------------------------------

const MASK = '#';

/** Blanks `${...}` and `{{...}}` interpolations so their contents are never read as tokens. */
function maskInterpolations(value) {
  let out = '';
  for (let index = 0; index < value.length; index += 1) {
    const open = value.startsWith('${', index) ? 2 : value.startsWith('{{', index) ? 2 : 0;
    if (!open) {
      out += value[index];
      continue;
    }
    const close = open === 2 && value[index] === '$' ? '}' : '}}';
    const end = value.indexOf(close, index + open);
    const stop = end === -1 ? value.length : end + close.length;
    out += MASK.repeat(stop - index);
    index = stop - 1;
  }
  return out;
}

/** Whole whitespace-separated tokens of `value`, with absolute offsets from `base`. */
function tokensOf(value, base, out) {
  const masked = maskInterpolations(value);
  for (const match of masked.matchAll(/[^\s]+/g)) {
    if (CLASS_TOKEN.test(match[0])) out.push({ token: match[0], start: base + match.index, end: base + match.index + match[0].length });
  }
}

/** The index just past the string literal starting at `start`, or -1. */
function stringEnd(text, start) {
  const quote = text[start];
  for (let index = start + 1; index < text.length; index += 1) {
    if (text[index] === '\\') index += 1;
    else if (text[index] === quote) return index + 1;
    else if (quote !== '`' && (text[index] === '\n' || text[index] === '\r')) return -1;
  }
  return -1;
}

/** Tokens of every string literal inside `[from, to)`. */
function literalTokens(text, from, to, out) {
  for (let index = from; index < to; index += 1) {
    const char = text[index];
    if (char !== '\'' && char !== '"' && char !== '`') continue;
    const end = stringEnd(text, index);
    if (end === -1 || end > to) continue;
    tokensOf(text.slice(index + 1, end - 1), index + 1, out);
    index = end - 1;
  }
}

/** The index of the bracket closing the one at `open`, skipping string literals, or -1. */
function closingBracket(text, open) {
  const pairs = { '(': ')', '{': '}', '[': ']' };
  const stack = [pairs[text[open]]];
  for (let index = open + 1; index < text.length; index += 1) {
    const char = text[index];
    if (char === '\'' || char === '"' || char === '`') {
      const end = stringEnd(text, index);
      if (end === -1) return -1;
      index = end - 1;
    } else if (pairs[char]) stack.push(pairs[char]);
    else if (char === stack.at(-1)) {
      stack.pop();
      if (!stack.length) return index;
    }
  }
  return -1;
}

/**
 * Every class token the file writes in a class position: static `class=` / `className=` values,
 * framework class bindings (`:class`, `[class]`, `[ngClass]`, `className={...}`, `classMap()`),
 * `classList.add/remove/toggle/contains/replace()` arguments, and `.className =` / `setAttribute('class')`
 * assignments. Strings anywhere else (selectors, prose, other attributes) are never read.
 */
export function scanClassTokens(text, isIgnored = () => false) {
  const found = [];
  const add = (collect) => {
    for (const entry of collect) if (!isIgnored(entry.start)) found.push(entry);
  };

  // Static attribute values: the whole quoted value is class names.
  const staticAttr = /(?<![\w:@.[\]()-])(?:class|className)\s*=\s*(?<quote>["'])/g;
  for (const match of text.matchAll(staticAttr)) {
    const open = match.index + match[0].length - 1;
    const end = text.indexOf(match.groups.quote, open + 1);
    if (end === -1) continue;
    const tokens = [];
    tokensOf(text.slice(open + 1, end), open + 1, tokens);
    add(tokens);
  }

  // Dynamic attribute values: only the string literals inside the expression are class names.
  const dynamicAttr = /(?<![\w])(?::class|v-bind:class|\[class\]|\[ngClass\]|\[ng-class\]|ng-class|:\[class\]|ngClass)\s*=\s*(?<quote>["'])/g;
  for (const match of text.matchAll(dynamicAttr)) {
    const open = match.index + match[0].length - 1;
    const end = text.indexOf(match.groups.quote, open + 1);
    if (end === -1) continue;
    const tokens = [];
    literalTokens(text, open + 1, end, tokens);
    add(tokens);
  }

  // JSX and Lit expression forms.
  for (const match of text.matchAll(/(?<![\w:.-])className\s*=\s*\{/g)) {
    const open = match.index + match[0].length - 1;
    const close = closingBracket(text, open);
    if (close === -1) continue;
    const tokens = [];
    literalTokens(text, open + 1, close, tokens);
    add(tokens);
  }
  for (const match of text.matchAll(/\bclassMap\s*\(/g)) {
    const open = match.index + match[0].length - 1;
    const close = closingBracket(text, open);
    if (close === -1) continue;
    const tokens = [];
    literalTokens(text, open + 1, close, tokens);
    add(tokens);
  }

  // classList.<method>('a', 'b') -- the string-literal arguments.
  for (const match of text.matchAll(/\bclassList\s*(?:\?\.|\.)\s*(?:add|remove|toggle|contains|replace)\s*\(/g)) {
    const open = match.index + match[0].length - 1;
    const close = closingBracket(text, open);
    if (close === -1) continue;
    const tokens = [];
    // Top-level literal arguments only; a call or expression argument is skipped whole.
    let depth = 0;
    for (let index = open + 1; index < close; index += 1) {
      const char = text[index];
      if (char === '\'' || char === '"' || char === '`') {
        const end = stringEnd(text, index);
        if (end === -1) break;
        const before = text.slice(open + 1, index).replace(/\s+/g, '');
        const atArgumentStart = before === '' || before.endsWith(',');
        const after = text.slice(end, close).trimStart();
        if (depth === 0 && atArgumentStart && (after === '' || after.startsWith(','))) {
          tokensOf(text.slice(index + 1, end - 1), index + 1, tokens);
        }
        index = end - 1;
      } else if (char === '(' || char === '[' || char === '{') depth += 1;
      else if (char === ')' || char === ']' || char === '}') depth -= 1;
    }
    add(tokens);
  }

  // el.className = '...' / += '...' and setAttribute('class', '...').
  for (const match of text.matchAll(/\.className\s*\+?=\s*(?<quote>["'`])/g)) {
    const open = match.index + match[0].length - 1;
    const end = stringEnd(text, open);
    if (end === -1) continue;
    const tokens = [];
    tokensOf(text.slice(open + 1, end - 1), open + 1, tokens);
    add(tokens);
  }
  for (const match of text.matchAll(/\bsetAttribute\s*\(\s*(["'])class\1\s*,\s*(?<quote>["'`])/g)) {
    const open = match.index + match[0].length - 1;
    const end = stringEnd(text, open);
    if (end === -1) continue;
    const tokens = [];
    tokensOf(text.slice(open + 1, end - 1), open + 1, tokens);
    add(tokens);
  }

  const seen = new Set();
  return found
    .filter((entry) => !seen.has(entry.start) && seen.add(entry.start))
    .sort((left, right) => left.start - right.start);
}

// ---------------------------------------------------------------------------------------------
// Specifier routes
// ---------------------------------------------------------------------------------------------

/**
 * Subpaths of the upstream packages (after the package name) that are not component registration
 * entries. `kind`:
 *  - `registry`: registers every component (a bare-package equivalent; follows the root rewrite rules)
 *  - `loader`:   the self-starting autoloader; `targets` are Lyra package subpaths
 *  - `style`:    a stylesheet; `targets` are Lyra stylesheet subpaths, written in order
 *  - `none`:     no Lyra counterpart; reported, never rewritten
 */
const ROUTES = Object.freeze([
  { pattern: /^\/dist\/(?:webawesome|shoelace)\.js$/, kind: 'registry' },
  { pattern: /^\/dist\/webawesome\.loader\.js$/, kind: 'loader', targets: [`${LYRA}/autoloader-cdn.js`] },
  { pattern: /^\/dist\/shoelace-autoloader\.js$/, kind: 'loader', targets: [`${LYRA}/autoloader-cdn.js`] },
  {
    pattern: /^\/dist\/utilities\/base-path(?:\.js)?$/,
    kind: 'none',
    note: 'Lyra resolves no asset base path: icons come from registered icon libraries and translations from registerLyraLocale(), so remove setBasePath() and register those explicitly.',
  },
  {
    pattern: /^\/dist\/webawesome\.ssr-loader\.js$/,
    kind: 'none',
    note: 'Lyra server rendering uses @aceshooting/lyra-ui/ssr.js and ssr/all.js; migrate the server entry by hand.',
  },
  {
    pattern: /^\/dist\/styles\/webawesome\.css$/,
    kind: 'style',
    targets: [`${LYRA}/theme.css`, `${LYRA}/native.css`, `${LYRA}/utilities.css`],
    note: 'native.css only styles descendants of an element with the lr-native class; add that class to the regions that relied on the global native styles.',
  },
  {
    pattern: /^\/dist\/styles\/native\.css$/,
    kind: 'style',
    targets: [`${LYRA}/native.css`],
    note: 'native.css only styles descendants of an element with the lr-native class; add that class to the regions that relied on the global native styles.',
  },
  { pattern: /^\/dist\/styles\/utilities\.css$/, kind: 'style', targets: [`${LYRA}/utilities.css`] },
  { pattern: /^\/dist\/styles\/themes\/default\.css$/, kind: 'style', targets: [`${LYRA}/theme.css`] },
  { pattern: /^\/dist\/themes\/light\.css$/, kind: 'style', targets: [`${LYRA}/theme.css`] },
  {
    pattern: /^\/dist\/themes\/dark\.css$/,
    kind: 'style',
    targets: [`${LYRA}/theme.css`],
    note: 'Lyra ships one stylesheet for both modes; put lr-dark (or data-lr-mode="dark") where sl-theme-dark was.',
  },
  {
    pattern: /^\/dist\/styles\/layers\.css$/,
    kind: 'none',
    note: 'Lyra stylesheets declare their own cascade layers (lr-base, lr-theme, lr-utilities, lr-overrides); delete this import.',
  },
  {
    pattern: /^\/dist\/styles\/themes\/(?:awesome|shoelace)\.css$/,
    kind: 'none',
    note: 'Lyra has no counterpart to this theme; start from theme.css and the looks/*.css and accents.css stylesheets.',
  },
  {
    pattern: /^\/dist\/styles\/color\/.+\.css$/,
    kind: 'none',
    note: 'Lyra has no counterpart to this palette stylesheet; see palette.css and accents.css.',
  },
  {
    pattern: /^\/dist\/(?:styles|themes)\/.+\.css$/,
    kind: 'none',
    note: 'No Lyra stylesheet is recorded for this file; compare it with theme.css, native.css and utilities.css.',
  },
]);

/** The route for a package subpath such as `/dist/styles/webawesome.css`, or null. */
export function resolveUpstreamAssetRoute(subpath) {
  return resolveTranslationRoute(subpath) ?? ROUTES.find((route) => route.pattern.test(subpath)) ?? null;
}

// ---------------------------------------------------------------------------------------------
// Translation side-effect imports
// ---------------------------------------------------------------------------------------------

const TRANSLATIONS = '@aceshooting/lyra-translations';

/**
 * Every locale catalog `@aceshooting/lyra-translations` publishes as `<locale>.js` (English is built
 * into Lyra UI and the pseudo-locales stay there). A test keeps this list equal to the catalogs in
 * `src/translations/`, so a route can never name a file the package does not ship.
 */
export const LYRA_TRANSLATION_LOCALES = Object.freeze([
  'am', 'ar', 'bg', 'bho', 'bn', 'ca', 'cs', 'da', 'de', 'de-CH', 'el', 'en-GB', 'es', 'es-419',
  'et', 'fa', 'fa-AF', 'fi', 'fr', 'fr-CA', 'ga', 'gu', 'ha', 'he', 'hi', 'hr', 'hu', 'id', 'ig',
  'it', 'ja', 'jv', 'kk', 'kn', 'ko', 'ln', 'lt', 'lv', 'ml', 'mr', 'ms', 'mt', 'my', 'nb', 'ne',
  'nl', 'nn', 'om', 'or', 'pa', 'pcm', 'pl', 'pnb', 'ps', 'pt-BR', 'pt-PT', 'ro', 'ru', 'sd', 'sk',
  'sl', 'sr', 'sr-Latn', 'su', 'sv', 'sw', 'ta', 'te', 'th', 'tl', 'tr', 'uk', 'ur', 'uz', 'vi',
  'yo', 'zh-CN', 'zh-HK', 'zh-TW', 'zu',
]);
const LOCALE_BY_LOWERCASE = new Map(LYRA_TRANSLATION_LOCALES.map((locale) => [locale.toLowerCase(), locale]));

/**
 * Bare language codes Lyra ships only as regional catalogs. The region is the one CLDR resolves the
 * bare language to (`pt` is Brazilian Portuguese, `zh` is Simplified Chinese as used in China), so
 * the route is a best match that is always reported for review.
 */
const DEFAULT_TRANSLATION_REGIONS = Object.freeze({
  pt: { locale: 'pt-BR', alternative: 'pt-PT' },
  zh: { locale: 'zh-CN', alternative: 'zh-TW or zh-HK' },
});

/**
 * Routes `/dist/translations/<lang>.js` (both upstreams register a locale on import, as Lyra's
 * catalogs do) to `@aceshooting/lyra-translations/<locale>.js`. `kind`:
 *  - `translation`: rewrite to `targets[0]`; a `note` asks for review
 *  - `drop`:        the import has no Lyra counterpart because the locale is built in; remove it
 *  - `none`:        Lyra ships no matching catalog; reported, never rewritten
 * Returns null for any other subpath.
 */
function resolveTranslationRoute(subpath) {
  const match = /^\/dist\/translations\/(?<lang>[A-Za-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*)\.js$/.exec(subpath);
  if (!match) return null;
  const requested = match.groups.lang.replaceAll('_', '-');
  const key = requested.toLowerCase();
  if (key === 'en' || key === 'en-us') {
    return {
      kind: 'drop',
      locale: requested,
      note: 'English is built into Lyra UI, so this translation import has no counterpart and was removed.',
    };
  }
  const exact = LOCALE_BY_LOWERCASE.get(key);
  if (exact) return { kind: 'translation', locale: exact, targets: [`${TRANSLATIONS}/${exact}.js`] };
  const regional = DEFAULT_TRANSLATION_REGIONS[key];
  if (regional) {
    return {
      kind: 'translation',
      locale: regional.locale,
      targets: [`${TRANSLATIONS}/${regional.locale}.js`],
      note: `Lyra ships no bare "${requested}" catalog, so this import now loads ${regional.locale}, the region CLDR resolves "${requested}" to. Switch to ${regional.alternative} if that is the audience, and check that the page lang still selects it.`,
    };
  }
  return {
    kind: 'none',
    locale: requested,
    note: `Lyra ships no "${requested}" catalog; pick the nearest locale from @aceshooting/lyra-ui/locales.json or register your own strings with registerLyraLocale().`,
  };
}

// ---------------------------------------------------------------------------------------------
// Named utility imports
// ---------------------------------------------------------------------------------------------

const ICON_LIBRARY = `${LYRA}/components/utility/icon/icon-library.js`;
const ANIMATION_REGISTRY = `${LYRA}/utilities/animation-registry.js`;
const ANIMATION_NAME_REVIEW =
  'Animation names are keyed by component (for example dialog.show); check each name you set or read against the Lyra component it targets, because an unknown name is ignored silently.';

/**
 * Per-symbol routes for named imports from the upstream `/dist/utilities/*.js` modules. Each
 * target is a granular, side-effect-free Lyra subpath whose export has the same name and accepts
 * the upstream call shape (Lyra may add optional arguments or a return value). A symbol not listed
 * keeps the whole statement in manual review. `review` adds a manual-review note to the rewrite.
 */
export const UTILITY_SYMBOL_ROUTES = Object.freeze({
  serialize: { target: `${LYRA}/utilities/form.js` },
  registerIconLibrary: { target: ICON_LIBRARY },
  unregisterIconLibrary: { target: ICON_LIBRARY },
  setDefaultIconFamily: { target: ICON_LIBRARY },
  getDefaultIconFamily: { target: ICON_LIBRARY },
  getDefaultIconVariant: { target: ICON_LIBRARY },
  allDefined: { target: `${LYRA}/utilities/defined.js` },
  setDefaultAnimation: { target: ANIMATION_REGISTRY, review: ANIMATION_NAME_REVIEW },
  setAnimation: { target: ANIMATION_REGISTRY, review: ANIMATION_NAME_REVIEW },
  getAnimation: { target: ANIMATION_REGISTRY, review: ANIMATION_NAME_REVIEW },
  getAnimationNames: { target: `${LYRA}/components/media/animation/animation.class.js` },
  getEasingNames: { target: `${LYRA}/components/media/animation/animation.class.js` },
});

/** Whether a package subpath is one of the upstream utility modules the symbol table serves. */
export function isUpstreamUtilitySubpath(subpath) {
  return /^\/dist\/utilities\/[a-z][a-z0-9-]*\.js$/.test(subpath);
}

/**
 * Package imports in CSS: `@import '<pkg>/…'` and `@import url('<pkg>/…')`. Returned in the shape
 * `scanImports` produces for JavaScript so one rewrite loop serves both.
 */
export function scanCssUrlImports(text, contract, isIgnored = () => false) {
  const packages = [...contract.packageIdentities.keys()]
    .sort((left, right) => right.length - left.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
  const pattern = new RegExp(
    `@import\\s+url\\(\\s*(?<quote>['"])(?<package>${packages})(?<subpath>\\/[^'"\\s]*)?\\k<quote>\\s*\\)`,
    'g',
  );
  const imports = [];
  for (const match of text.matchAll(pattern)) {
    if (isIgnored(match.index)) continue;
    const identity = contract.packageIdentities.get(match.groups.package);
    const quoteStart = text.indexOf(match.groups.quote, match.index);
    const specifier = `${match.groups.package}${match.groups.subpath ?? ''}`;
    const afterQuote = quoteStart + 1 + specifier.length + 1;
    const close = text.indexOf(')', afterQuote);
    const semicolon = text.indexOf(';', close);
    const lineBreak = text.indexOf('\n', close);
    const lineEnd = lineBreak === -1 ? text.length : lineBreak;
    imports.push({
      sideEffect: true,
      kind: 'css-import',
      ecosystem: identity.ecosystem,
      tiers: identity.tiers,
      packageName: match.groups.package,
      specifier,
      subpath: match.groups.subpath ?? '',
      quote: match.groups.quote,
      start: quoteStart + 1,
      end: quoteStart + 1 + specifier.length,
      statementEnd: semicolon !== -1 && semicolon < lineEnd ? semicolon + 1 : close + 1,
      insertAfter: 'css-import',
    });
  }
  return imports;
}

// ---------------------------------------------------------------------------------------------
// Shoelace validation attributes
// ---------------------------------------------------------------------------------------------

/**
 * The validation data attributes Shoelace form controls reflect, keyed by attribute, valued by the
 * CSS custom state a Lyra form control publishes for the same condition. A selector rewrite uses a
 * state only when the target component documents it in its manifest.
 */
export const SHOELACE_VALIDATION_STATES = Object.freeze({
  'data-required': 'required',
  'data-optional': 'optional',
  'data-valid': 'valid',
  'data-invalid': 'invalid',
  'data-user-valid': 'user-valid',
  'data-user-invalid': 'user-invalid',
});
