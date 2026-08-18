import { expect } from '@open-wc/testing';
import {
  DEFAULT_MAX_DELIMITED_CELLS,
  DEFAULT_MAX_DELIMITED_ERRORS,
  delimitedCellText,
  delimitedColumnCount,
  parseDelimitedGrid,
  parseDelimitedRecords,
  type DelimitedParseLimits,
} from './delimited-data.js';
import { loadPapaParseCached, type PapaParseApi } from './papaparse-loader.js';
import { LyraResourceLimitError } from './resource-loader.js';

let realParser: PapaParseApi;

before(async () => {
  const parser = await loadPapaParseCached();
  if (!parser) throw new Error('The papaparse test peer was unavailable.');
  realParser = parser;
});

function parserHandle(onAbort: () => void): { abort(): void } {
  return { abort: onAbort };
}

it('normalizes streaming grid configuration and derived dimensions', () => {
  let options: Record<string, unknown> | undefined;
  const parser: PapaParseApi = {
    parse(_text, value) {
      options = value;
      const step = value?.['step'] as ((result: unknown, handle: { abort(): void }) => void) | undefined;
      if (!step) throw new Error('Expected a streaming step callback.');
      const handle = parserHandle(() => {});
      step({ data: ['name'], meta: {}, errors: [] }, handle);
      step({ data: ['Ada'], meta: {}, errors: [{ code: 'sample' }] }, handle);
      return { data: [], meta: {}, errors: [] };
    },
  };

  const result = parseDelimitedGrid(parser, 'name\nAda');
  expect(result.data).to.deep.equal([['name'], ['Ada']]);
  expect(result.errors.map((error) => (error as { code?: string }).code)).to.deep.equal([
    'UndetectableDelimiter',
    'sample',
  ]);
  expect(options?.['delimiter']).to.equal(',');
  expect(options?.['newline']).to.equal('\n');
  expect(options?.['fastMode']).to.be.false;
  expect(options?.['skipEmptyLines']).to.be.true;
  expect(delimitedColumnCount([['a'], ['b', 'c']])).to.equal(2);
  expect(delimitedCellText(null)).to.equal('');
});

it('normalizes streaming header-record parsing and fields', () => {
  const parser: PapaParseApi = {
    parse(_text, options) {
      const step = options?.['step'] as ((result: unknown, handle: { abort(): void }) => void) | undefined;
      if (!step) throw new Error('Expected a streaming step callback.');
      step(
        { data: { name: 'Ada' }, meta: { fields: ['name'] }, errors: [] },
        parserHandle(() => {}),
      );
      return { data: [], meta: { fields: ['name'] }, errors: [] };
    },
  };

  expect(parseDelimitedRecords(parser, 'name\nAda')).to.deep.equal({
    fields: ['name'],
    rows: [{ name: 'Ada' }],
    errors: [{
      type: 'Delimiter',
      code: 'UndetectableDelimiter',
      message: "Unable to auto-detect delimiting character; defaulted to ','",
    }],
  });
});

it('preserves delimiter detection, escaped delimiters, and quoted newlines without flattening rows', () => {
  const grid = parseDelimitedGrid(
    realParser,
    '\ufeff"name";notes\r\nAda;"first; clause\r\nsecond clause"\r\nGrace;plain',
  );
  expect(grid.data).to.deep.equal([
    ['name', 'notes'],
    ['Ada', 'first; clause\r\nsecond clause'],
    ['Grace', 'plain'],
  ]);
  expect(grid.errors).to.deep.equal([]);

  const records = parseDelimitedRecords(
    realParser,
    'name|notes\nAda|"first | clause\nsecond clause"\nGrace|plain',
  );
  expect(records).to.deep.equal({
    fields: ['name', 'notes'],
    rows: [
      { name: 'Ada', notes: 'first | clause\nsecond clause' },
      { name: 'Grace', notes: 'plain' },
    ],
    errors: [],
  });
});

it('matches PapaParse post-quote Unicode whitespace and mixed-newline dialect rules', () => {
  const unicodeWhitespace = parseDelimitedGrid(
    realParser,
    '"name"\u00a0;notes\n"Ada"\u2003;math',
  );
  expect(unicodeWhitespace).to.deep.equal({
    data: [['name', 'notes'], ['Ada', 'math']],
    errors: [],
  });

  const mixedNewlines = parseDelimitedGrid(realParser, 'a,b\r\n1,2\n3,4\n');
  expect(mixedNewlines).to.deep.equal({
    data: [['a', 'b'], ['1', '2\n3', '4\n']],
    errors: [],
  });
});

it('samples the full post-BOM MiB when matching PapaParse newline detection', () => {
  let configuredNewline: unknown;
  const parser: PapaParseApi = {
    parse(text, options) {
      configuredNewline = options?.['newline'];
      return realParser.parse(text, options);
    },
  };
  const mebibyte = 1024 * 1024;
  const boundaryCrLf = `\ufeff${'a'.repeat(mebibyte - 2)}\r\nx,y\r\n1,2`;

  const result = parseDelimitedGrid(parser, boundaryCrLf);
  expect(configuredNewline).to.equal('\r\n');
  expect(result.data[1]).to.deep.equal(['x', 'y']);
  expect(result.data[2]).to.deep.equal(['1', '2']);
});

it('retains quote diagnostics from the header row consumed by PapaParse header mode', () => {
  const result = parseDelimitedRecords(realParser, '\ufeff\n"na"me",role\nAda,Math');

  expect(result.fields).to.deep.equal(['na"me', 'role']);
  expect(result.rows).to.deep.equal([{ 'na"me': 'Ada', role: 'Math' }]);
  expect(result.errors).to.deep.equal([{
    type: 'Quotes',
    code: 'InvalidQuotes',
    message: 'Trailing quote on quoted field is malformed',
    row: 1,
    index: 2,
  }]);
});

it('normalizes streamed quote diagnostics to PapaParse raw row indexes', () => {
  const source = 'a,b\n1,2\n"x"q",z\n3,4';
  for (const result of [
    parseDelimitedGrid(realParser, source),
    parseDelimitedRecords(realParser, source),
  ]) {
    expect(result.errors).to.deep.equal([{
      type: 'Quotes',
      code: 'InvalidQuotes',
      message: 'Trailing quote on quoted field is malformed',
      row: 2,
      index: 9,
    }]);
  }
});

it('retains malformed empty-row quote errors and counts them before parsing', () => {
  const invalidRow = '"a"x",b';
  const atLimitSource = `${Array.from(
    { length: DEFAULT_MAX_DELIMITED_ERRORS - 1 },
    () => invalidRow,
  ).join('\n')}\n"`;
  const atLimit = parseDelimitedGrid(realParser, atLimitSource);
  expect(atLimit.data).to.have.lengthOf(DEFAULT_MAX_DELIMITED_ERRORS - 1);
  expect(atLimit.errors).to.have.lengthOf(DEFAULT_MAX_DELIMITED_ERRORS);
  expect((atLimit.errors.at(-1) as { code?: string }).code).to.equal('MissingQuotes');

  let parseCalls = 0;
  const parser: PapaParseApi = {
    parse(text, options) {
      parseCalls++;
      return realParser.parse(text, options);
    },
  };
  const overLimitSource = `${Array.from(
    { length: DEFAULT_MAX_DELIMITED_ERRORS },
    () => invalidRow,
  ).join('\n')}\n"`;
  expect(() => parseDelimitedGrid(parser, overLimitSource)).to.throw(LyraResourceLimitError);
  expect(parseCalls).to.equal(0);

  const loneQuote = parseDelimitedGrid(realParser, '"');
  expect(loneQuote.data).to.deep.equal([]);
  expect(loneQuote.errors.map((error) => (error as { code?: string }).code)).to.deep.equal([
    'MissingQuotes',
    'UndetectableDelimiter',
  ]);
});

it('preserves empty grid and header-only record results', () => {
  const grid = parseDelimitedGrid(realParser, '');
  expect(grid.data).to.deep.equal([]);
  expect(grid.errors.map((error) => (error as { code?: string }).code)).to.deep.equal([
    'UndetectableDelimiter',
  ]);

  expect(parseDelimitedRecords(realParser, 'name,role')).to.deep.equal({
    fields: ['name', 'role'],
    rows: [],
    errors: [],
  });
});

it('rejects a compact million-row grid before invoking PapaParse', () => {
  let parseCalls = 0;
  const parser: PapaParseApi = {
    parse() {
      parseCalls++;
      return { data: [], errors: [], meta: {} };
    },
  };
  const compactMillionRows = 'x\n'.repeat(1_000_000);

  expect(() => parseDelimitedGrid(parser, compactMillionRows)).to.throw(LyraResourceLimitError);
  expect(parseCalls).to.equal(0);
});

it('rejects an over-wide row before PapaParse can materialize its fields', () => {
  let parseCalls = 0;
  const parser: PapaParseApi = {
    parse() {
      parseCalls++;
      return { data: [], errors: [], meta: {} };
    },
  };
  const overWideRow = Array.from({ length: 1_001 }, () => 'x').join(',');

  expect(() => parseDelimitedGrid(parser, overWideRow)).to.throw(LyraResourceLimitError);
  expect(parseCalls).to.equal(0);
});

it('rejects an over-wide Unicode-post-quote row before invoking the real parser', () => {
  let parseCalls = 0;
  const parser: PapaParseApi = {
    parse(text, options) {
      parseCalls++;
      return realParser.parse(text, options);
    },
  };
  const overWideRow = `"x"\u00a0,${Array.from({ length: 1_000 }, () => 'v').join(',')}`;

  expect(() => parseDelimitedGrid(parser, overWideRow)).to.throw(LyraResourceLimitError);
  expect(parseCalls).to.equal(0);
});

it('rejects aggregate cell work before parsing even when row and column dimensions fit', () => {
  let parseCalls = 0;
  const parser: PapaParseApi = {
    parse() {
      parseCalls++;
      return { data: [], errors: [], meta: {} };
    },
  };
  const columns = 1_000;
  const row = Array.from({ length: columns }, () => '').join(',');
  const rows = Math.floor(DEFAULT_MAX_DELIMITED_CELLS / columns) + 1;
  const compactMillionCellGrid = Array.from({ length: rows }, () => row).join('\n');

  expect(() => parseDelimitedGrid(parser, compactMillionCellGrid)).to.throw(
    LyraResourceLimitError,
  );
  expect(parseCalls).to.equal(0);
});

it('caps field-mismatch diagnostics before PapaParse can retain an oversized error array', () => {
  const malformedRows = Array.from(
    { length: DEFAULT_MAX_DELIMITED_ERRORS + 1 },
    () => 'one,two,extra',
  ).join('\n');

  expect(() => parseDelimitedRecords(realParser, `first,second\n${malformedRows}`)).to.throw(
    LyraResourceLimitError,
  );

  const atLimitRows = Array.from(
    { length: DEFAULT_MAX_DELIMITED_ERRORS },
    () => 'one,two,extra',
  ).join('\n');
  const atLimit = parseDelimitedRecords(realParser, `first,second\n${atLimitRows}`);
  expect(atLimit.rows).to.have.lengthOf(DEFAULT_MAX_DELIMITED_ERRORS);
  expect(atLimit.errors).to.have.lengthOf(DEFAULT_MAX_DELIMITED_ERRORS);
});

it('rejects a malformed quoted field before PapaParse can allocate an oversized error array', () => {
  let parseCalls = 0;
  const parser: PapaParseApi = {
    parse() {
      parseCalls++;
      return { data: [], errors: [], meta: {} };
    },
  };
  const invalidQuoteRun = `"${Array.from(
    { length: DEFAULT_MAX_DELIMITED_ERRORS + 1 },
    () => 'a"x',
  ).join('')}a",tail`;

  expect(() => parseDelimitedGrid(parser, invalidQuoteRun)).to.throw(LyraResourceLimitError);
  expect(parseCalls).to.equal(0);
});

it('aborts a parser that produces more rows than the pre-scan observed', () => {
  let produced = 0;
  let aborted = false;
  const parser: PapaParseApi = {
    parse(_text, options) {
      const step = options?.['step'] as ((result: unknown, handle: { abort(): void }) => void) | undefined;
      if (!step) throw new Error('Expected a streaming step callback.');
      const handle = parserHandle(() => { aborted = true; });
      while (!aborted && produced < 10) {
        produced++;
        step({ data: ['x'], meta: {}, errors: [] }, handle);
      }
      return { data: [], errors: [], meta: { aborted } };
    },
  };
  const limits: DelimitedParseLimits = {
    maxRows: 2,
    maxColumns: 2,
    maxCells: 4,
    maxErrors: 2,
  };

  expect(() => parseDelimitedGrid(parser, 'a,b\nc,d', limits)).to.throw(LyraResourceLimitError);
  expect(produced).to.equal(3);
  expect(aborted).to.be.true;
});

it('aborts when parser diagnostics exceed the retained error budget', () => {
  let produced = 0;
  let aborted = false;
  const parser: PapaParseApi = {
    parse(_text, options) {
      const step = options?.['step'] as ((result: unknown, handle: { abort(): void }) => void) | undefined;
      if (!step) throw new Error('Expected a streaming step callback.');
      const handle = parserHandle(() => { aborted = true; });
      while (!aborted && produced < 10) {
        produced++;
        step({ data: ['x'], meta: {}, errors: [{ code: 'sample' }] }, handle);
      }
      return { data: [], errors: [], meta: { aborted } };
    },
  };
  const limits: DelimitedParseLimits = {
    maxRows: 10,
    maxColumns: 2,
    maxCells: 10,
    maxErrors: 2,
  };

  expect(() => parseDelimitedGrid(parser, 'a,b\nc,d', limits)).to.throw(LyraResourceLimitError);
  expect(produced).to.equal(3);
  expect(aborted).to.be.true;
});

it('detects a bare CR newline dialect when no LF is present', () => {
  const grid = parseDelimitedGrid(realParser, 'a,b\r1,2\r3,4');
  expect(grid.data).to.deep.equal([
    ['a', 'b'],
    ['1', '2'],
    ['3', '4'],
  ]);
  expect(grid.errors).to.deep.equal([]);
});

it('prefers a later delimiter candidate with a strictly higher average field count on a delta tie', () => {
  const grid = parseDelimitedGrid(realParser, 'a,b;c;d\n1,2;3;4\n5,6;7;8');
  expect(grid.data).to.deep.equal([
    ['a,b', 'c', 'd'],
    ['1,2', '3', '4'],
    ['5,6', '7', '8'],
  ]);
  expect(grid.errors).to.deep.equal([]);
});

it('unescapes doubled quotes inside a quoted field without truncating the row', () => {
  const grid = parseDelimitedGrid(realParser, '"a""b",c\n"only""",tail');
  expect(grid.data).to.deep.equal([
    ['a"b', 'c'],
    ['only"', 'tail'],
  ]);
  expect(grid.errors).to.deep.equal([]);
});

it('rejects header/row field-count mismatches from the preflight scan alone, before invoking PapaParse', () => {
  let parseCalls = 0;
  const parser: PapaParseApi = {
    parse() {
      parseCalls++;
      return { data: [], errors: [], meta: {} };
    },
  };
  const text = 'h1,h2\nx\ny\nz';

  expect(() => parseDelimitedRecords(parser, text, { maxErrors: 2 })).to.throw(LyraResourceLimitError);
  expect(parseCalls).to.equal(0);
});

it('rejects a record row whose __parsed_extra entries push it past the column budget in the streaming callback', () => {
  let parseCalls = 0;
  const parser: PapaParseApi = {
    parse(_text, options) {
      parseCalls++;
      const step = options?.['step'] as ((result: unknown, handle: { abort(): void }) => void) | undefined;
      if (!step) throw new Error('Expected a streaming step callback.');
      step(
        { data: { a: '1', b: '2', __parsed_extra: ['x', 'y'] }, meta: { fields: ['a', 'b'] }, errors: [] },
        parserHandle(() => {}),
      );
      return { data: [], meta: { fields: ['a', 'b'] }, errors: [] };
    },
  };

  expect(() => parseDelimitedRecords(parser, 'a,b\n1,2', { maxColumns: 3 })).to.throw(LyraResourceLimitError);
  expect(parseCalls).to.equal(1);
});

it('rejects a peer that reports non-string header fields', () => {
  const parser: PapaParseApi = {
    parse(_text, options) {
      const step = options?.['step'] as ((result: unknown, handle: { abort(): void }) => void) | undefined;
      if (!step) throw new Error('Expected a streaming step callback.');
      step(
        { data: { a: '1' }, meta: { fields: ['a', 42] }, errors: [] },
        parserHandle(() => {}),
      );
      return { data: [], meta: { fields: ['a', 42] }, errors: [] };
    },
  };

  expect(() => parseDelimitedRecords(parser, 'a,b\n1,2')).to.throw(TypeError, 'PapaParse returned invalid fields.');
});

it('rejects a peer that reports a non-array grid row', () => {
  const parser: PapaParseApi = {
    parse(_text, options) {
      const step = options?.['step'] as ((result: unknown, handle: { abort(): void }) => void) | undefined;
      if (!step) throw new Error('Expected a streaming step callback.');
      step({ data: 'not-a-row', meta: {}, errors: [] }, parserHandle(() => {}));
      return { data: [], meta: {}, errors: [] };
    },
  };

  expect(() => parseDelimitedGrid(parser, 'a,b')).to.throw(TypeError, 'PapaParse returned an invalid row.');
});

it('rejects a peer that silently ignores the streaming callback for non-empty input', () => {
  let parseCalls = 0;
  const parser: PapaParseApi = {
    parse() {
      parseCalls++;
      return { data: [['a', 'b']], meta: {}, errors: [] };
    },
  };

  expect(() => parseDelimitedGrid(parser, 'a,b\n1,2')).to.throw(
    TypeError,
    'PapaParse did not honor streaming row callbacks.',
  );
  expect(parseCalls).to.equal(1);
});

it('does not let a throwing abort() handle mask the resource-limit error', () => {
  let aborted = false;
  const parser: PapaParseApi = {
    parse(_text, options) {
      const step = options?.['step'] as ((result: unknown, handle: { abort(): void }) => void) | undefined;
      if (!step) throw new Error('Expected a streaming step callback.');
      const handle = {
        abort: () => {
          aborted = true;
          throw new Error('peer abort() is broken');
        },
      };
      step({ data: ['a'], meta: {}, errors: [] }, handle);
      step({ data: ['b'], meta: {}, errors: [] }, handle);
      step({ data: ['c'], meta: {}, errors: [] }, handle);
      return { data: [], meta: {}, errors: [] };
    },
  };

  expect(() => parseDelimitedGrid(parser, 'a\nb', { maxRows: 2 })).to.throw(LyraResourceLimitError);
  expect(aborted).to.be.true;
});

it('propagates a peer parse error unrelated to any resource limit unchanged', () => {
  const parser: PapaParseApi = {
    parse() {
      throw new Error('peer exploded');
    },
  };

  let caught: unknown;
  try {
    parseDelimitedGrid(parser, 'a,b\n1,2');
  } catch (error) {
    caught = error;
  }
  expect(caught instanceof Error && caught.message).to.equal('peer exploded');
});

it('prefers the resource-limit outcome when the peer also throws after being aborted', () => {
  const parser: PapaParseApi = {
    parse(_text, options) {
      const step = options?.['step'] as ((result: unknown, handle: { abort(): void }) => void) | undefined;
      if (!step) throw new Error('Expected a streaming step callback.');
      const handle = parserHandle(() => {});
      step({ data: ['a'], meta: {}, errors: [] }, handle);
      step({ data: ['b'], meta: {}, errors: [] }, handle);
      step({ data: ['c'], meta: {}, errors: [] }, handle);
      throw new Error('peer rethrew after abort');
    },
  };

  expect(() => parseDelimitedGrid(parser, 'a\nb', { maxRows: 2 })).to.throw(LyraResourceLimitError);
});

it('falls back to defaults for non-positive or non-finite limit overrides', () => {
  const limits: DelimitedParseLimits = {
    maxRows: 0,
    maxColumns: -1,
    maxCells: Number.NaN,
    maxErrors: Number.POSITIVE_INFINITY,
  };
  const result = parseDelimitedGrid(realParser, 'a,b,c\n1,2,3', limits);
  expect(result.data).to.deep.equal([
    ['a', 'b', 'c'],
    ['1', '2', '3'],
  ]);
});

it('detects a bare LF dialect when the first line ending precedes a later CRLF pair', () => {
  const grid = parseDelimitedGrid(realParser, 'a,b\nc,d\r\ne,f');
  expect(grid.data).to.deep.equal([
    ['a', 'b'],
    ['c', 'd\r'],
    ['e', 'f'],
  ]);
  expect(grid.errors).to.deep.equal([]);
});

it('rejects a streamed header wider than the column budget even when the preflight scan saw a narrow header', () => {
  let parseCalls = 0;
  const parser: PapaParseApi = {
    parse(_text, options) {
      parseCalls++;
      const step = options?.['step'] as ((result: unknown, handle: { abort(): void }) => void) | undefined;
      if (!step) throw new Error('Expected a streaming step callback.');
      step(
        { data: { a: '1', b: '2' }, meta: { fields: ['a', 'b'] }, errors: [] },
        parserHandle(() => {}),
      );
      return { data: [], meta: { fields: ['a', 'b'] }, errors: [] };
    },
  };

  expect(() => parseDelimitedRecords(parser, 'a\n1', { maxColumns: 1 })).to.throw(LyraResourceLimitError);
  expect(parseCalls).to.equal(1);
});

it('rejects a streamed header alone exceeding the aggregate cell budget', () => {
  let parseCalls = 0;
  const parser: PapaParseApi = {
    parse(_text, options) {
      parseCalls++;
      const step = options?.['step'] as ((result: unknown, handle: { abort(): void }) => void) | undefined;
      if (!step) throw new Error('Expected a streaming step callback.');
      step(
        { data: { a: '1', b: '2', c: '3' }, meta: { fields: ['a', 'b', 'c'] }, errors: [] },
        parserHandle(() => {}),
      );
      return { data: [], meta: { fields: ['a', 'b', 'c'] }, errors: [] };
    },
  };

  expect(() => parseDelimitedRecords(parser, 'a\n1', { maxColumns: 5, maxCells: 2 })).to.throw(
    LyraResourceLimitError,
  );
  expect(parseCalls).to.equal(1);
});

it('floors a fractional maxRows override before comparing against the row budget', () => {
  const text = 'a\nb\nc';
  expect(() => parseDelimitedGrid(realParser, text, { maxRows: 2.9 })).to.throw(LyraResourceLimitError);
  expect(() => parseDelimitedGrid(realParser, text, { maxRows: 3.9 })).to.not.throw();
});

it('reports zero columns for an empty row set and stringifies non-nullish cell values', () => {
  expect(delimitedColumnCount([])).to.equal(0);
  expect(delimitedCellText(undefined)).to.equal('');
  expect(delimitedCellText(42)).to.equal('42');
});

it('floors a fractional maxErrors override before comparing against the parser error budget', () => {
  const parser: PapaParseApi = {
    parse(_text, options) {
      const step = options?.['step'] as ((result: unknown, handle: { abort(): void }) => void) | undefined;
      if (!step) throw new Error('Expected a streaming step callback.');
      const handle = parserHandle(() => {});
      step({ data: ['a', 'x'], meta: {}, errors: [{ code: 'one' }] }, handle);
      step({ data: ['b', 'y'], meta: {}, errors: [{ code: 'two' }] }, handle);
      step({ data: ['c', 'z'], meta: {}, errors: [{ code: 'three' }] }, handle);
      return { data: [], meta: {}, errors: [] };
    },
  };

  expect(() => parseDelimitedGrid(parser, 'a,x\nb,y\nc,z', { maxErrors: 2.9 })).to.throw(LyraResourceLimitError);
  expect(() => parseDelimitedGrid(parser, 'a,x\nb,y\nc,z', { maxErrors: 3.9 })).to.not.throw();
});
