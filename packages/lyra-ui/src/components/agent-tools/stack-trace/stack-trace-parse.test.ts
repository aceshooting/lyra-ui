import { expect } from '@open-wc/testing';
import {
  parseStackTrace as parseStackTraceResult,
  DEFAULT_INTERNAL_PATTERNS,
  STACK_TRACE_LIMITS,
} from './stack-trace-parse.js';

function parseStackTrace(trace: string, internalPatterns: readonly (string | RegExp)[]) {
  return parseStackTraceResult(trace, { internalPatterns }).groups;
}

const OVERFLOW_LOCATION = '9'.repeat(400);

describe('parseStackTrace', () => {
  it('does not mutate caller-owned stateful RegExp patterns', () => {
    const pattern = /vendor/gy;
    pattern.lastIndex = 3;
    const groups = parseStackTrace(
      ['Error', '    at one (/vendor/a.js:1:1)', '    at two (/vendor/b.js:2:1)'].join('\n'),
      [pattern],
    );
    expect(groups[0]!.frames.map((frame) => frame.internal)).to.deep.equal([true, true]);
    expect(pattern.lastIndex).to.equal(3);
  });

  it('requires a real Python header before selecting the Python grammar', () => {
    const result = parseStackTraceResult([
      'Error: mixed provider output',
      '    at safe (/app/safe.js:1:1)',
      '  File "/app/incidental.py", line 2, in prose',
    ].join('\n'), { internalPatterns: [] });

    expect(result.groups[0]!.frames[0]).to.deep.include({ file: '/app/safe.js', line: 1 });
  });

  it('bounds bytes, lines, and rendered source before parsing', () => {
    const oversizedLine = `Error: ${'x'.repeat(STACK_TRACE_LIMITS.bytes + 10)}`;
    const result = parseStackTraceResult(oversizedLine);

    expect(result.truncated).to.equal(true);
    expect(new TextEncoder().encode(result.source).byteLength).to.be.at.most(STACK_TRACE_LIMITS.bytes);
    expect(result.source.length).to.be.at.most(STACK_TRACE_LIMITS.lineCharacters);
  });
  it('parses a V8/JS trace with function-named frames', () => {
    const trace = [
      'TypeError: Cannot read properties of undefined',
      '    at Object.doThing (/app/src/util.js:10:5)',
      '    at Module._compile (node:internal/modules/cjs/loader:1105:14)',
    ].join('\n');
    const groups = parseStackTrace(trace, DEFAULT_INTERNAL_PATTERNS);
    expect(groups).to.have.lengthOf(1);
    expect(groups[0].message).to.equal('TypeError: Cannot read properties of undefined');
    expect(groups[0].frames).to.have.lengthOf(2);
    expect(groups[0].frames[0]).to.deep.include({
      functionName: 'Object.doThing',
      file: '/app/src/util.js',
      line: 10,
      column: 5,
      internal: false,
    });
    expect(groups[0].frames[1].internal).to.be.true; // node:internal matches the default pattern list
  });

  it('parses a bare (no function name) V8 frame', () => {
    const trace = 'Error: boom\n    at /app/index.js:3:1';
    const groups = parseStackTrace(trace, DEFAULT_INTERNAL_PATTERNS);
    expect(groups[0].frames[0]).to.deep.include({ file: '/app/index.js', line: 3, column: 1 });
    expect(groups[0].frames[0].functionName).to.be.undefined;
  });

  it('parses a Firefox/Safari-style trace (fn@file:line:col)', () => {
    const trace = 'doThing@https://example.com/app.js:12:3\n@https://example.com/app.js:20:1';
    const groups = parseStackTrace(trace, []);
    expect(groups[0].frames[0]).to.deep.include({
      functionName: 'doThing',
      file: 'https://example.com/app.js',
      line: 12,
      column: 3,
    });
    expect(groups[0].frames[1].functionName).to.be.undefined;
  });

  it('starts a new group on a JS "Caused by:" chained-error line', () => {
    const trace = [
      'Error: outer',
      '    at a (/x.js:1:1)',
      'Caused by: Error: inner',
      '    at b (/y.js:2:2)',
    ].join('\n');
    const groups = parseStackTrace(trace, []);
    expect(groups).to.have.lengthOf(2);
    expect(groups[0].message).to.equal('Error: outer');
    expect(groups[1].message).to.equal('Error: inner');
    expect(groups[1].frames[0].file).to.equal('/y.js');
  });

  it('parses a Python traceback, reversing frame order to innermost-first', () => {
    const trace = [
      'Traceback (most recent call last):',
      '  File "/app/main.py", line 10, in <module>',
      '    run()',
      '  File "/app/main.py", line 4, in run',
      '    raise ValueError("bad")',
      'ValueError: bad',
    ].join('\n');
    const groups = parseStackTrace(trace, []);
    expect(groups).to.have.lengthOf(1);
    expect(groups[0].message).to.equal('ValueError: bad');
    expect(groups[0].frames).to.have.lengthOf(2);
    // innermost-first: the `run` frame (deeper, raises the error) comes before `<module>`.
    expect(groups[0].frames[0]).to.deep.include({ file: '/app/main.py', line: 4, functionName: 'run' });
    expect(groups[0].frames[1]).to.deep.include({ file: '/app/main.py', line: 10, functionName: '<module>' });
    expect(groups[0].frames[0].raw).to.include('raise ValueError');
  });

  it('starts a new Python group on a chained "direct cause" separator', () => {
    const trace = [
      'Traceback (most recent call last):',
      '  File "/app/a.py", line 1, in <module>',
      'ValueError: first',
      '',
      'The above exception was the direct cause of the following exception:',
      '',
      'Traceback (most recent call last):',
      '  File "/app/b.py", line 2, in <module>',
      'RuntimeError: second',
    ].join('\n');
    const groups = parseStackTrace(trace, []);
    expect(groups).to.have.lengthOf(2);
    expect(groups[0].message).to.equal('ValueError: first');
    expect(groups[1].message).to.equal('RuntimeError: second');
  });

  it('marks a frame internal when its file matches a string or RegExp pattern', () => {
    const trace = 'Error: x\n    at f (/app/node_modules/dep/index.js:1:1)\n    at g (/app/src/x.js:2:2)';
    const groups = parseStackTrace(trace, ['node_modules/', /^\/app\/src\//]);
    expect(groups[0].frames[0].internal).to.be.true;
    expect(groups[0].frames[1].internal).to.be.true;
  });

  it('falls back to zero groups (verbatim raw rendering upstream) when nothing parses', () => {
    const groups = parseStackTrace('just some unrelated log text\nwith no frames at all', DEFAULT_INTERNAL_PATTERNS);
    expect(groups).to.deep.equal([]);
  });

  it('keeps an unparseable interior line as a raw (file-less) frame entry, not dropped', () => {
    const trace = 'Error: x\n    at f (/app/a.js:1:1)\n  (some tool-injected note)\n    at g (/app/b.js:2:2)';
    const groups = parseStackTrace(trace, []);
    expect(groups[0].frames).to.have.lengthOf(3);
    expect(groups[0].frames[1].file).to.be.undefined;
    expect(groups[0].frames[1].raw.trim()).to.equal('(some tool-injected note)');
  });

  it('preserves 400-digit V8 named, bare, and Firefox locations as raw frames instead of coercing them to Infinity', () => {
    const named = `    at named (/app/named.js:${OVERFLOW_LOCATION}:${OVERFLOW_LOCATION})`;
    const bare = `    at /app/bare.js:${OVERFLOW_LOCATION}:${OVERFLOW_LOCATION}`;
    const firefox = `firefox@https://example.test/firefox.js:${OVERFLOW_LOCATION}:${OVERFLOW_LOCATION}`;
    const groups = parseStackTrace(['Error: unsafe locations', '    at safe (/app/safe.js:1:1)', named, bare, firefox].join('\n'), []);
    const frames = groups[0]!.frames;
    const rawFrames = frames.filter((frame) => frame.file === undefined);

    expect(frames[0]).to.deep.include({ file: '/app/safe.js', line: 1, column: 1 });
    expect(rawFrames.map((frame) => frame.raw)).to.deep.equal([named, bare, firefox]);
    expect(rawFrames.every((frame) => frame.line === undefined && frame.column === undefined)).to.equal(true);
    expect(frames.some((frame) => frame.line === Infinity || frame.column === Infinity)).to.equal(false);
  });

  it('preserves a 400-digit Python location as a raw frame instead of coercing it to Infinity', () => {
    const unsafe = `  File "/app/unsafe.py", line ${OVERFLOW_LOCATION}, in run`;
    const groups = parseStackTrace(
      [
        'Traceback (most recent call last):',
        '  File "/app/safe.py", line 1, in <module>',
        unsafe,
        'RuntimeError: unsafe location',
      ].join('\n'),
      [],
    );
    const frames = groups[0]!.frames;
    const raw = frames.find((frame) => frame.raw.startsWith(unsafe));

    expect((raw) != null).to.equal(true);
    expect(raw!.file).to.be.undefined;
    expect(raw!.line).to.be.undefined;
    expect(frames.some((frame) => frame.line === Infinity)).to.equal(false);
  });

  it('keeps malformed V8, bare, Firefox, and Python location candidates raw', () => {
    const named = '    at named (/app/named.js:line:column)';
    const bare = '    at /app/bare.js:line:column';
    const firefox = 'firefox@https://example.test/firefox.js:line:column';
    const jsGroups = parseStackTrace(['Error: malformed locations', '    at safe (/app/safe.js:1:1)', named, bare, firefox].join('\n'), []);
    const jsRaw = jsGroups[0]!.frames.filter((frame) => frame.file === undefined);

    expect(jsRaw.map((frame) => frame.raw)).to.deep.equal([named, bare, firefox]);

    const python = '  File "/app/unsafe.py", line not-a-number, in run';
    const pythonGroups = parseStackTrace(
      [
        'Traceback (most recent call last):',
        '  File "/app/safe.py", line 1, in <module>',
        python,
        'RuntimeError: malformed location',
      ].join('\n'),
      [],
    );
    const pythonRaw = pythonGroups[0]!.frames.find((frame) => frame.raw.startsWith(python));

    expect(pythonRaw?.file).to.be.undefined;
    expect(pythonRaw?.line).to.be.undefined;
  });

  it('does not mistake malformed Python-like prose in a JavaScript trace for a Python traceback', () => {
    const trace = [
      'Error: JavaScript stack',
      '    at safe (/app/safe.js:1:1)',
      'File "/note", line malformed, in prose',
    ].join('\n');
    const groups = parseStackTrace(trace, []);

    expect(groups[0]!.frames[0]).to.deep.include({ file: '/app/safe.js', line: 1, column: 1 });
    expect(groups[0]!.frames[1]).to.deep.include({ internal: false, raw: 'File "/note", line malformed, in prose' });
  });

  it('accepts the safe-integer boundary but preserves the next integer as raw', () => {
    const safe = Number.MAX_SAFE_INTEGER.toString();
    const unsafe = (Number.MAX_SAFE_INTEGER + 1).toString();
    const trace = [
      'Error: integer boundary',
      `    at safe (/app/safe.js:${safe}:${safe})`,
      `    at unsafe (/app/unsafe.js:${unsafe}:${unsafe})`,
    ].join('\n');
    const frames = parseStackTrace(trace, [])[0]!.frames;

    expect(frames[0]).to.deep.include({ file: '/app/safe.js', line: Number.MAX_SAFE_INTEGER, column: Number.MAX_SAFE_INTEGER });
    expect(frames[1]).to.deep.include({ internal: false, raw: `    at unsafe (/app/unsafe.js:${unsafe}:${unsafe})` });
    expect(frames[1].file).to.be.undefined;
  });

  it('returns no structured groups when every location is unsafe, preserving the complete trace for verbatim fallback', () => {
    const trace = [
      'Traceback (most recent call last):',
      `  File "/app/unsafe.py", line ${OVERFLOW_LOCATION}, in run`,
      'RuntimeError: unsafe location',
    ].join('\n');
    expect(parseStackTrace(trace, [])).to.deep.equal([]);
  });
});
