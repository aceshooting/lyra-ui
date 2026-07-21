import { expect } from '@open-wc/testing';
import { loadShikiHighlighter, loadShikiLanguage } from './code-loader.js';
import type { ShikiHighlighter } from './code-loader.js';

// The GreyCat (GCL) TextMate grammar (`greycat-language.ts`) is checked here against real GCL
// syntax -- not by analogy to TypeScript/JS -- sourced from the `greycat` skill's reference docs
// and, for the keyword/type/number-literal shapes, the GreyCat compiler's own ground truth
// (`crates/analysis/src/ide/completion.rs`'s `ALL_KEYWORDS`, `crates/core/src/type_arena.rs`'s
// `CORE_TYPE_NAMES`, and `crates/hir/src/lower.rs`'s `classify_and_parse_number`).

type ExplainedToken = { content: string; scopes: string[] };

function tokenize(hl: ShikiHighlighter, code: string): ExplainedToken[] {
  const lines = hl.codeToTokensBase(code, {
    lang: 'gcl',
    theme: 'github-light',
    includeExplanation: true,
  }) as { content: string; explanation?: { scopes: { scopeName: string }[] }[] }[][];
  return lines.flat().map((t) => ({
    content: t.content,
    scopes: (t.explanation ?? []).flatMap((e) => e.scopes.map((s) => s.scopeName)),
  }));
}

/** Every distinct token whose `content` equals `word`, unioning their scopes -- a bare regex
 *  scan can tokenize the same text as more than one adjacent token depending on neighboring
 *  matches, so this asserts against the union rather than assuming exactly one hit. */
function scopesFor(tokens: ExplainedToken[], word: string): string[] {
  const matches = tokens.filter((t) => t.content === word);
  expect(matches, `expected at least one token with content "${word}"`).to.not.be.empty;
  return matches.flatMap((t) => t.scopes);
}

describe('GREYCAT_LANGUAGE (gcl) TextMate grammar', () => {
  let hl: ShikiHighlighter;

  before(async function () {
    this.timeout(20_000);
    hl = (await loadShikiHighlighter())!;
    await loadShikiLanguage(hl, 'greycat');
  });

  it('recognizes every real reserved keyword as keyword.control.gcl', () => {
    const words = [
      'abstract', 'at', 'break', 'breakpoint', 'catch', 'continue', 'do', 'else', 'enum',
      'extends', 'fn', 'for', 'if', 'in', 'native', 'private', 'return', 'static', 'throw',
      'try', 'type', 'var', 'while',
    ];
    const tokens = tokenize(hl, words.join(' '));
    for (const word of words) {
      expect(scopesFor(tokens, word), word).to.include('keyword.control.gcl');
    }
  });

  it('recognizes is/as/typeof as keyword.operator.gcl', () => {
    const tokens = tokenize(hl, 'x is String; y as int; typeof T');
    for (const word of ['is', 'as', 'typeof']) {
      expect(scopesFor(tokens, word), word).to.include('keyword.operator.gcl');
    }
  });

  it('recognizes true/false/null/Infinity/NaN as constant.language.gcl', () => {
    const tokens = tokenize(hl, 'true false null Infinity NaN');
    for (const word of ['true', 'false', 'null', 'Infinity', 'NaN']) {
      expect(scopesFor(tokens, word), word).to.include('constant.language.gcl');
    }
  });

  it('recognizes this as variable.language.gcl', () => {
    const tokens = tokenize(hl, 'this.name');
    expect(scopesFor(tokens, 'this')).to.include('variable.language.gcl');
  });

  it('does not mistake JS/TS-only words for GCL keywords (GCL has no async/await, import/export, new, switch/match, let, or a `model` keyword)', () => {
    const words = ['async', 'await', 'import', 'export', 'from', 'let', 'new', 'case', 'match', 'model', 'nil'];
    const tokens = tokenize(hl, words.join(' '));
    for (const word of words) {
      const matches = tokens.filter((t) => t.content === word);
      const scopes = matches.flatMap((t) => t.scopes);
      expect(scopes, word).to.not.include('keyword.control.gcl');
      expect(scopes, word).to.not.include('constant.language.gcl');
    }
  });

  it('recognizes real core/native/container types as storage.type.gcl', () => {
    const words = [
      'any', 'Array', 'bool', 'Buffer', 'char', 'Date', 'duration', 'field', 'float',
      'function', 'geo', 'int', 'Json', 'Map', 'node', 'nodeGeo', 'nodeIndex', 'nodeList',
      'nodeTime', 'String', 'Table', 'Tensor', 'time', 'Tuple',
    ];
    const tokens = tokenize(hl, words.map((w) => `x: ${w}`).join('; '));
    for (const word of words) {
      expect(scopesFor(tokens, word), word).to.include('storage.type.gcl');
    }
  });

  it('does not treat nonexistent types (void, uint, Date-lookalikes aside, lowercase json, Set) as GCL types', () => {
    const words = ['void', 'uint', 'json', 'Set'];
    const tokens = tokenize(hl, words.map((w) => `x: ${w}`).join('; '));
    for (const word of words) {
      const matches = tokens.filter((t) => t.content === word);
      const scopes = matches.flatMap((t) => t.scopes);
      expect(scopes, word).to.not.include('storage.type.gcl');
    }
  });

  describe('number literals', () => {
    const cases: [label: string, code: string][] = [
      ['plain int', '42'],
      ['visually-grouped int', '1_000_000'],
      ['decimal float', '3.14'],
      ['scientific float (no decimal)', '1e-10'],
      ['scientific float (with decimal, signed exponent)', '3.14e+10'],
      ['duration, no underscore before unit', '60s'],
      ['duration, single-letter unit', '1ms'],
      ['compound duration', '2hour_30min'],
      ['compound duration, no separating underscore', '2hour42s'],
      ['3-part compound duration', '3day_4hour_5min_6s'],
      ['time literal, with underscore', '42_time'],
      ['time literal, no underscore', '42time'],
      ['typed float suffix', '1.79e+308_f'],
    ];

    for (const [label, code] of cases) {
      it(`tokenizes ${label} (\`${code}\`) as a single constant.numeric.gcl token`, () => {
        const tokens = tokenize(hl, code);
        expect(scopesFor(tokens, code), code).to.include('constant.numeric.gcl');
      });
    }

    it('does not extend a numeric duration match into a following unrelated identifier', () => {
      // Regression guard for the "greedy trailing underscore" failure mode: `60s` must not
      // swallow part of `_foo` sitting right after it with no separating whitespace.
      const tokens = tokenize(hl, '60s_foo');
      const numeric = tokens.filter((t) => t.scopes.includes('constant.numeric.gcl'));
      for (const t of numeric) {
        expect(t.content.length, `numeric token "${t.content}" must not include "foo"`).to.be.lessThan('60s_foo'.length);
      }
    });

    it('has no hex integer literal in GCL -- 0x1A is not tokenized as one constant.numeric.gcl match', () => {
      const tokens = tokenize(hl, '0x1A');
      const wholeMatch = tokens.find((t) => t.content === '0x1A' && t.scopes.includes('constant.numeric.gcl'));
      expect(wholeMatch, '0x1A must not be recognized as a single hex numeric literal').to.be.undefined;
    });
  });

  describe('strings', () => {
    it('tokenizes ${...} interpolation inside a double-quoted string as embedded code, distinct from plain string content', () => {
      const tokens = tokenize(hl, '"hello ${name}"');
      // Nothing inside `${name}` matches a more specific sub-pattern (a bare identifier not
      // followed by `(` matches none of keywords/types/functions), so TextMate merges the whole
      // `${name}` span into one token -- assert by substring, not exact content.
      const interpolated = tokens.find((t) => t.content.includes('name'));
      expect(interpolated, 'interpolated content must be tokenized').to.exist;
      // Still nested inside the string's own begin/end block, so string.quoted.double.gcl
      // legitimately stays on the scope stack -- meta.embedded.expression.gcl is what actually
      // distinguishes it from plain string text for a theme/consumer.
      expect(interpolated!.scopes).to.include('meta.embedded.expression.gcl');
    });

    it('does not treat a backtick as a valid GCL string delimiter', () => {
      // No pattern matches inside a backtick-delimited run, so TextMate merges the whole thing
      // into one plain token -- assert no token anywhere carries the (removed) backtick-string scope.
      const tokens = tokenize(hl, '`not a gcl string`');
      const scopes = tokens.flatMap((t) => t.scopes);
      expect(scopes).to.not.include('string.quoted.other.gcl');
    });

    it('highlights an escape sequence inside a single-quoted char literal', () => {
      const tokens = tokenize(hl, "'\\n'");
      const escape = tokens.find((t) => t.content === '\\n');
      expect(escape, 'the \\n escape must be tokenized').to.exist;
      expect(escape!.scopes).to.include('constant.character.escape.gcl');
    });
  });
});
