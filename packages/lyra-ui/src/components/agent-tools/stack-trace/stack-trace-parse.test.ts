import { expect } from '@open-wc/testing';
import { parseStackTrace, DEFAULT_INTERNAL_PATTERNS } from './stack-trace-parse.js';

describe('parseStackTrace', () => {
  it('resets stateful global RegExp patterns before every frame test', () => {
    const groups = parseStackTrace(
      ['Error', '    at one (/vendor/a.js:1:1)', '    at two (/vendor/b.js:2:1)'].join('\n'),
      [/vendor/g],
    );
    expect(groups[0]!.frames.map((frame) => frame.internal)).to.deep.equal([true, true]);
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
});
