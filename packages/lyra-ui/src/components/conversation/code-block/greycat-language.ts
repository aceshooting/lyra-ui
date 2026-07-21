import type { OptionalPeerApi } from '../../../internal/optional-peer-types.js';

// Duration-unit / time / float suffixes GCL's number lexer actually
// recognizes (`us|ms|min|hour|day`, `time`, `f`/`F`) -- the lexer accepts any
// letter run as a suffix and the language server validates it, but these are
// the only ones that mean anything.
const NUMBER_UNIT = '(?:us|ms|min|hour|day|time|s|[fF])';
// One magnitude: digits (with GCL's `_` visual grouping), an optional decimal
// part, an optional scientific exponent, then an optional unit suffix of its
// own (itself preceded by an optional `_`, e.g. `42_time` / `42time`). The
// leading optional `_` lets this same pattern also match a later segment of
// a compound duration, where `_` separates parts (`3day_4hour`) but is
// otherwise fully optional formatting (`2hour42s` is the same value as
// `2hour_42s`).
const NUMBER_SEGMENT = `_?\\d[\\d_]*(?:\\.\\d[\\d_]*)?(?:[eE][+-]?\\d+)?_?${NUMBER_UNIT}?`;
// Compound durations chain several magnitude+unit segments back to back with
// no operator between them (`3day_4hour_5min_6s`) -- GCL has no hex literal.
const NUMBER_PATTERN = `\\b(?:${NUMBER_SEGMENT})+\\b`;

/**
 * A compact TextMate grammar for GreyCat's GCL language.
 *
 * Shiki ships grammars for the common languages, but GCL is maintained here
 * so consumers can highlight GreyCat source without supplying a grammar map.
 *
 * GCL is not TypeScript/JS: no `async`/`await`, no `import`/`export`, no
 * `new`, no `switch`/`match`, no `void`, no `let`. Keyword/type/number-suffix
 * shapes below are sourced from GreyCat's own grammar, not guessed by
 * analogy.
 */
export const GREYCAT_LANGUAGE: OptionalPeerApi = {
  name: 'gcl',
  displayName: 'GreyCat',
  scopeName: 'source.gcl',
  aliases: ['greycat'],
  patterns: [
    { include: '#comments' },
    { include: '#strings' },
    { include: '#numbers' },
    { include: '#annotations' },
    { include: '#keywords' },
    { include: '#types' },
    { include: '#functions' },
  ],
  repository: {
    comments: {
      patterns: [
        { match: '//.*$', name: 'comment.line.double-slash.gcl' },
        { begin: '/\\*', end: '\\*/', name: 'comment.block.gcl' },
      ],
    },
    strings: {
      patterns: [
        {
          // Strings are double-quoted only in GCL; `${...}` interpolation holds an arbitrary
          // expression, so it re-includes the whole grammar rather than staying plain string text.
          begin: '"',
          end: '"',
          name: 'string.quoted.double.gcl',
          patterns: [
            { match: '\\\\.', name: 'constant.character.escape.gcl' },
            {
              begin: '\\$\\{',
              end: '\\}',
              name: 'meta.embedded.expression.gcl',
              patterns: [{ include: '$self' }],
            },
          ],
        },
        // Single quotes are reserved for `char` and `time` literals -- no backtick strings in GCL.
        {
          begin: "'",
          end: "'",
          name: 'string.quoted.single.gcl',
          patterns: [{ match: '\\\\.', name: 'constant.character.escape.gcl' }],
        },
      ],
    },
    numbers: {
      patterns: [
        {
          match: NUMBER_PATTERN,
          name: 'constant.numeric.gcl',
        },
      ],
    },
    annotations: {
      patterns: [{ match: '@[a-zA-Z_][a-zA-Z0-9_]*', name: 'storage.type.annotation.gcl' }],
    },
    keywords: {
      patterns: [
        {
          match:
            '\\b(?:abstract|at|break|breakpoint|catch|continue|do|else|enum|extends|fn|for|if|in|native|private|return|static|throw|try|type|var|while)\\b',
          name: 'keyword.control.gcl',
        },
        // `is`/`as`/`typeof` are type-relational operators, not control-flow keywords.
        { match: '\\b(?:is|as|typeof)\\b', name: 'keyword.operator.gcl' },
        // `Infinity`/`NaN` are always-keyword float identifiers in GCL, not context-dependent
        // (unlike the for-in-only `sampling`/`limit`/`skip` clause words, deliberately not matched
        // here since they're ordinary identifiers everywhere else and a regex can't scope them).
        { match: '\\b(?:true|false|null|Infinity|NaN)\\b', name: 'constant.language.gcl' },
        { match: '\\bthis\\b', name: 'variable.language.gcl' },
      ],
    },
    types: {
      patterns: [
        {
          match:
            '\\b(?:any|Array|bool|Buffer|char|Date|duration|field|float|function|geo|int|Json|Map|node|nodeGeo|nodeIndex|nodeList|nodeTime|String|Table|Tensor|time|Tuple)\\b',
          name: 'storage.type.gcl',
        },
      ],
    },
    functions: {
      patterns: [{ match: '\\b[a-zA-Z_][a-zA-Z0-9_]*(?=\\s*\\()', name: 'entity.name.function.gcl' }],
    },
  },
};
