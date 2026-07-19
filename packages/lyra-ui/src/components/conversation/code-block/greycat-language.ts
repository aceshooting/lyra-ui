import type { OptionalPeerApi } from '../../../internal/optional-peer-types.js';

/**
 * A compact TextMate grammar for GreyCat's GCL language.
 *
 * Shiki ships grammars for the common languages, but GCL is maintained here
 * so consumers can highlight GreyCat source without supplying a grammar map.
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
          begin: '"',
          end: '"',
          name: 'string.quoted.double.gcl',
          patterns: [{ match: '\\\\.', name: 'constant.character.escape.gcl' }],
        },
        { begin: "'", end: "'", name: 'string.quoted.single.gcl' },
        { begin: '`', end: '`', name: 'string.quoted.other.gcl' },
      ],
    },
    numbers: {
      patterns: [
        {
          match: '\\b(?:0x[0-9a-fA-F]+|\\d+(?:\\.\\d+)?(?:_us|_ms|_s|_min|_hour|_day)?)\\b',
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
            '\\b(?:async|await|break|case|catch|continue|else|enum|export|extends|fn|for|from|if|import|in|let|match|model|new|return|throw|try|type|var|while)\\b',
          name: 'keyword.control.gcl',
        },
        { match: '\\b(?:true|false|null|nil)\\b', name: 'constant.language.gcl' },
      ],
    },
    types: {
      patterns: [
        {
          match:
            '\\b(?:any|Array|bool|char|Date|duration|float|geo|int|json|Map|node|nodeIndex|nodeList|nodeTime|String|time|uint|void)\\b',
          name: 'storage.type.gcl',
        },
      ],
    },
    functions: {
      patterns: [{ match: '\\b[a-zA-Z_][a-zA-Z0-9_]*(?=\\s*\\()', name: 'entity.name.function.gcl' }],
    },
  },
};
