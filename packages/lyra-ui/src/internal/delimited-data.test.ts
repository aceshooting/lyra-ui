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
