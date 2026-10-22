import assert from 'node:assert/strict';
import test from 'node:test';
import { strToU8, zipSync } from 'fflate';
import { performanceFixtureSentinel } from '../test/performance-fixture.mjs';
import { environment, measureDocxPerformance } from './performance.mjs';

const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const TYPED = '01234567890123456789';

/** A saved package whose body holds the given paragraphs followed by `rows` table rows. */
function savedPackage(paragraphs, rows = 0) {
  const body = paragraphs.map(text => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`).join('')
    + (rows ? `<w:tbl>${'<w:tr><w:tc><w:p/></w:tc></w:tr>'.repeat(rows)}</w:tbl>` : '');
  return zipSync({ 'word/document.xml': strToU8(`<w:document xmlns:w="${wordNamespace}"><w:body>${body}</w:body></w:document>`) });
}

/** A machine description with the same shape as the one `environment` reads from Node. */
function fakeHost({ platform = 'linux', files = {}, cpuCount = 2, memory = 8 * 1024 ** 3 } = {}) {
  const reads = [];
  return {
    reads,
    platform: () => platform,
    arch: () => 'x64',
    cpus: () => Array.from({ length: cpuCount }, () => ({ model: 'Fake CPU' })),
    availableParallelism: () => cpuCount,
    totalmem: () => memory,
    readFile: async file => {
      reads.push(file);
      if (file in files) return files[file];
      throw Object.assign(new Error(`ENOENT: ${file}`), { code: 'ENOENT' });
    },
  };
}

const unlimited = {
  '/proc/self/status': 'Name:\tnode\nCpus_allowed_list:\t0-3\n',
  '/sys/fs/cgroup/cpu.max': 'max 100000\n',
  '/sys/fs/cgroup/memory.max': 'max\n',
};

test('the recorded environment reports the visible machine and its container limits', async () => {
  const limited = fakeHost({
    files: { ...unlimited, '/sys/fs/cgroup/cpu.max': '250000 100000\n', '/sys/fs/cgroup/memory.max': '2147483648\n' },
  });
  assert.deepEqual(await environment({ version: () => '1.2.3' }, limited), {
    platform: 'linux', arch: 'x64', node: process.version, cpuModel: 'Fake CPU', logicalCpusVisible: 2,
    processParallelism: 2, cpuAffinity: '0-3', cgroupCpuQuotaCores: 2.5, memoryGiB: 8, cgroupMemoryGiB: 2,
    browserVersion: '1.2.3',
  });
});

test('unlimited, absent or malformed container limits are recorded as no limit', async () => {
  const cases = [
    ['unlimited', unlimited],
    ['unreadable', {}],
    ['a zero period', { ...unlimited, '/sys/fs/cgroup/cpu.max': '100000 0\n' }],
    ['no period', { ...unlimited, '/sys/fs/cgroup/cpu.max': '100000\n' }],
    ['an empty memory limit', { ...unlimited, '/sys/fs/cgroup/memory.max': '\n' }],
  ];
  for (const [name, files] of cases) {
    const record = await environment({ version: () => 'x' }, fakeHost({ files }));
    assert.equal(record.cgroupCpuQuotaCores, null, name);
    assert.equal(record.cgroupMemoryGiB, null, name);
  }
  const unreadable = await environment({ version: () => 'x' }, fakeHost());
  assert.equal(unreadable.cpuAffinity, null, 'a missing process status has no affinity list');
  assert.equal((await environment({ version: () => 'x' }, fakeHost({ files: { '/proc/self/status': 'Name:\tnode\n' } }))).cpuAffinity, null);
});

test('a machine without a listed processor has no CPU model, and only Linux is asked for container files', async () => {
  const bare = await environment({ version: () => 'x' }, fakeHost({ cpuCount: 0 }));
  assert.equal(bare.cpuModel, null);
  assert.equal(bare.logicalCpusVisible, 0);
  const other = fakeHost({ platform: 'darwin', files: unlimited });
  const record = await environment({ version: () => 'x' }, other);
  assert.deepEqual(other.reads, [], 'no Linux-only file is read on another platform');
  assert.deepEqual([record.platform, record.cpuAffinity, record.cgroupCpuQuotaCores, record.cgroupMemoryGiB], ['darwin', null, null, null]);
});

/** A page clock that moves only when the test moves it, so every measured duration is exactly what was scripted. */
function installClock(context) {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'performance');
  const clock = { value: 1000, advance(milliseconds) { clock.value += milliseconds; } };
  Object.defineProperty(globalThis, 'performance', { value: { now: () => clock.value }, configurable: true, writable: true });
  context.after(() => Object.defineProperty(globalThis, 'performance', original));
  return clock;
}

/**
 * One fake browser. Each context gets the page-side world the harness's in-page functions read (the
 * globals plus an editor element); the pages are used strictly one after another, so the globals are
 * installed when a page is created and put back when the test ends.
 */
function fakeBrowser(context, plan = {}) {
  const roles = ['blank', 'large', 'table'];
  const previous = new Map(['window', 'document', 'customElements', 'requestAnimationFrame']
    .map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  context.after(() => {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
  });
  const contexts = [];
  const browser = {
    contexts,
    version: () => 'Fake/1.0',
    async newContext(options) {
      const role = roles[contexts.length];
      const record = { role, options, closed: 0, page: null };
      contexts.push(record);
      return {
        async newPage() { record.page = createPage(role, plan); return record.page; },
        async close() { record.closed++; },
      };
    },
  };
  return browser;

  function createPage(role, plan) {
    const typed = { text: '' };
    const listeners = [];
    let keystrokes = 0;
    const fixture = { children: [], append(node) { this.children.push(node); } };
    const editor = {
      id: '', status: 'idle', revision: { value: 0 }, rows: 19, busy: false, opens: 0,
      async newDocument() { editor.status = 'ready'; return { ok: true }; },
      async open() { editor.opens++; editor.status = 'ready'; return { ok: true }; },
      // While the large document handles a keystroke the engine cannot describe it; the table page always can.
      snapshot: () => editor.busy && role === 'large' ? null
        : { status: editor.status, revision: editor.revision, ...(role === 'table' ? { table: { rows: editor.rows } } : {}) },
      can: () => ({ enabled: true }),
      async execute(action) {
        plan.clock?.advance((action === 'undo' ? plan.durations.undo : plan.durations.execute).shift());
        editor.rows += action === 'undo' ? -1 : 1;
        editor.revision = { value: editor.revision.value + 1 };
        return { ok: true };
      },
      async save() {
        return { ok: true, value: { bytes: role === 'table' ? savedPackage(['T18_19', typed.text], 19) : savedPackage([performanceFixtureSentinel, typed.text]) } };
      },
      addEventListener(type, listener) { if (type === 'beforeinput') listeners.push(listener); },
    };
    plan.tamper?.(editor, role, typed);
    let editorDefined = false;
    const frame = callback => { setImmediate(() => callback(performance.now())); };
    const world = {
      window: { __docxTest: { ready: true, async loadEditor() { editorDefined = true; } } },
      document: {
        createElement: () => editor,
        querySelector: selector => selector === '#fixture' ? fixture : fixture.children.includes(editor) && selector === '#performance-editor' ? editor : null,
      },
      customElements: { get: name => editorDefined && name === 'lr-docx-editor' ? class {} : undefined },
      requestAnimationFrame: frame,
    };
    for (const [name, value] of Object.entries(world)) {
      Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    }
    const page = {
      role, editor, clicks: [], presses: [], visits: [], timeout: null, errorListener: null,
      on(event, listener) { if (event === 'pageerror') page.errorListener = listener; },
      setDefaultTimeout(milliseconds) { page.timeout = milliseconds; },
      async goto(url, options) {
        if (plan.goto) await plan.goto(role);
        page.visits.push([url, options.waitUntil]);
      },
      async waitForFunction(predicate, argument) {
        for (let attempt = 0; attempt < 1000; attempt++) {
          if (predicate(argument)) return;
          await new Promise(resolve => setImmediate(resolve));
        }
        throw new Error('waitForFunction timed out');
      },
      evaluate: async (callback, argument) => callback(argument),
      locator: selector => ({
        async click() { page.clicks.push(selector); },
        getByText: (text, options) => ({ first: () => ({ async click() { page.clicks.push(`${selector} ${text} ${options.exact}`); } }) }),
      }),
      keyboard: {
        async press(key) { page.presses.push(key); },
        async insertText(text) {
          // The engine reports unrelated input first and, for every other keystroke, cannot describe its document
          // while it handles the input.
          editor.busy = keystrokes++ % 2 === 0;
          for (const inputType of ['insertCompositionText', 'insertText']) for (const listener of listeners) listener({ inputType });
          await new Promise(resolve => setImmediate(resolve));
          typed.text += text;
          editor.revision = { value: editor.revision.value + 1 };
          editor.busy = false;
        },
      },
    };
    return page;
  }
}

const URL_UNDER_TEST = 'http://127.0.0.1:1/test/browser.html';

test('a measurement records every figure from three fresh contexts that are all closed afterwards', async context => {
  const browser = fakeBrowser(context);
  const record = await measureDocxPerformance({ browser, url: URL_UNDER_TEST });

  assert.deepEqual(browser.contexts.map(entry => [entry.role, entry.closed]), [['blank', 1], ['large', 1], ['table', 1]]);
  for (const entry of browser.contexts) {
    assert.deepEqual(entry.options, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    assert.deepEqual(entry.page.visits, [[URL_UNDER_TEST, 'networkidle']]);
    assert.equal(entry.page.timeout, 90_000);
  }
  assert.equal(record.environment.browserVersion, 'Fake/1.0');
  assert.equal(record.fixture.paragraphs, 2000);
  assert.equal(record.fixture.compression, 'stored');
  for (const key of ['freshBlankOpenMs', 'freshLargeOpenMs', 'saveMs', 'warmReopenMs']) {
    assert.ok(Number.isFinite(record[key]) && record[key] >= 0, key);
    assert.equal(record[key], Math.round(record[key] * 10) / 10, `${key} is rounded to a tenth of a millisecond`);
  }
  assert.equal(record.savedBytes, savedPackage([performanceFixtureSentinel, TYPED]).length);
  assert.equal(browser.contexts[1].page.editor.opens, 2, 'the large document is opened fresh and then reopened');

  for (const [name, summary] of [['document typing', record.inputToTwoFrames], ['table typing', record.table.inputToTwoFrames]]) {
    assert.equal(summary.count, 20, `${name}: only text insertions are sampled`);
    assert.equal(summary.samplesMs.length, 20, name);
    assert.ok(summary.minMs <= summary.medianMs && summary.medianMs <= summary.p95Ms && summary.p95Ms <= summary.maxMs, `${name}: ordered percentiles`);
  }
  assert.deepEqual({ rows: record.table.rows, columns: record.table.columns, cells: record.table.cells }, { rows: 19, columns: 20, cells: 380 });
  assert.equal(record.table.savedBytes, savedPackage(['T18_19', TYPED], 19).length);
  assert.equal(record.table.execute.count, 10);
  assert.equal(record.table.undo.count, 10);
  assert.ok(Number.isFinite(record.table.advisory1000Ms));
  assert.deepEqual(browser.contexts[2].page.presses, ['ArrowLeft', 'ArrowLeft'], 'the caret is placed inside the table before measuring and before typing');
  assert.equal(browser.contexts[2].page.editor.rows, 19, 'every insertion was undone');
});

test('a summary reports the minimum, the mean of the middle pair, the 95th percentile sample and the maximum, to a tenth of a millisecond', async context => {
  const clock = installClock(context);
  // Sixteenths of a millisecond add up exactly, so the page clock reproduces each duration without rounding noise.
  const durations = { execute: [10, 1, 9, 2, 8, 3, 7, 4, 6, 5], undo: [0.25, 0.3125, 0.375, 0.4375, 0.5, 0.5625, 0.625, 0.0625, 0.125, 0] };
  const browser = fakeBrowser(context, { clock, durations: { execute: [...durations.execute], undo: [...durations.undo] } });
  const record = await measureDocxPerformance({ browser, url: URL_UNDER_TEST });
  assert.deepEqual(record.table.execute, {
    count: 10, minMs: 1, medianMs: 5.5, p95Ms: 10, maxMs: 10, samplesMs: [10, 1, 9, 2, 8, 3, 7, 4, 6, 5],
  });
  assert.deepEqual(record.table.undo, {
    count: 10, minMs: 0, medianMs: 0.3, p95Ms: 0.6, maxMs: 0.6, samplesMs: [0.3, 0.3, 0.4, 0.4, 0.5, 0.6, 0.6, 0.1, 0.1, 0],
  });
});

/** Measure with `tamper` applied to the editor of `role` and expect a refusal that names `message`. */
async function refuses(context, role, tamper, message) {
  const browser = fakeBrowser(context, { tamper: (editor, which, typed) => { if (which === role) tamper(editor, typed); } });
  await assert.rejects(measureDocxPerformance({ browser, url: URL_UNDER_TEST }), message);
  assert.ok(browser.contexts.every(entry => entry.closed === 1), 'every opened context is closed, whatever failed');
  return browser;
}

test('a blank document that does not open, or does not become ready, fails the measurement', async context => {
  const refused = await refuses(context, 'blank', editor => { editor.newDocument = async () => ({ ok: false, code: 'engine-unavailable' }); },
    /Blank open failed: \{"ok":false,"code":"engine-unavailable"\}/u);
  assert.deepEqual(refused.contexts.map(entry => entry.role), ['blank'], 'nothing further was measured');
  await refuses(context, 'blank', editor => { editor.newDocument = async () => ({ ok: true }); },
    /Blank open failed: \{"ok":true\}/u);
});

test('a large document that does not open, or does not become ready, fails the measurement', async context => {
  const refused = await refuses(context, 'large', editor => { editor.open = async () => ({ ok: false, code: 'invalid-document' }); },
    /Large open failed: \{"ok":false,"code":"invalid-document"\}/u);
  assert.deepEqual(refused.contexts.map(entry => entry.role), ['blank', 'large']);
  await refuses(context, 'large', editor => { editor.open = async () => ({ ok: true }); }, /Large open failed/u);
});

test('a saved document that cannot be produced or lacks the edits fails the measurement', async context => {
  await refuses(context, 'large', editor => { editor.save = async () => ({ ok: false, code: 'busy' }); },
    /Save failed: \{"ok":false,"code":"busy"\}/u);
  await refuses(context, 'large', editor => { editor.save = async () => ({ ok: true, value: { bytes: savedPackage(['unrelated text', TYPED]) } }); },
    /Last fixture paragraph missing from saved document/u);
  await refuses(context, 'large', editor => { editor.save = async () => ({ ok: true, value: { bytes: savedPackage([performanceFixtureSentinel]) } }); },
    /Typed sample missing from saved document/u);
});

test('a reopen that fails fails the measurement', async context => {
  await refuses(context, 'large', editor => {
    const open = editor.open;
    editor.open = async bytes => editor.opens >= 1 ? { ok: false, code: 'engine-failed' } : open(bytes);
  }, /Reopen failed: \{"ok":false,"code":"engine-failed"\}/u);
  await refuses(context, 'large', editor => {
    const open = editor.open;
    editor.open = async bytes => {
      const outcome = await open(bytes);
      if (editor.opens > 1) editor.status = 'opening';
      return outcome;
    };
  }, /Reopen failed: \{"ok":true\}/u);
});

test('a page error during the large-document measurement fails it', async context => {
  const browser = fakeBrowser(context);
  const original = browser.newContext;
  browser.newContext = async options => {
    const created = await original.call(browser, options);
    const newPage = created.newPage;
    created.newPage = async () => {
      const page = await newPage.call(created);
      const open = page.editor.open;
      page.editor.open = async bytes => { page.errorListener('Uncaught TypeError: not a function'); return open(bytes); };
      return page;
    };
    return created;
  };
  await assert.rejects(measureDocxPerformance({ browser, url: URL_UNDER_TEST }), /Large-document page error/u);
  assert.ok(browser.contexts.every(entry => entry.closed === 1));
});

test('a context is closed when its page cannot be prepared, and the preparation error is reported', async context => {
  const browser = fakeBrowser(context, { goto: async () => { throw new Error('net::ERR_CONNECTION_REFUSED'); } });
  await assert.rejects(measureDocxPerformance({ browser, url: URL_UNDER_TEST }), /net::ERR_CONNECTION_REFUSED/u);
  assert.deepEqual(browser.contexts.map(entry => [entry.role, entry.closed]), [['blank', 1]]);
});

test('a blank page error fails the measurement before the large document is opened', async context => {
  const browser = fakeBrowser(context);
  const original = browser.newContext;
  browser.newContext = async options => {
    const created = await original.call(browser, options);
    const newPage = created.newPage;
    created.newPage = async () => {
      const page = await newPage.call(created);
      const newDocument = page.editor.newDocument;
      page.editor.newDocument = async () => { page.errorListener('Uncaught ReferenceError: x is not defined'); return newDocument(); };
      return page;
    };
    return created;
  };
  await assert.rejects(measureDocxPerformance({ browser, url: URL_UNDER_TEST }), /Blank-open page error/u);
  assert.deepEqual(browser.contexts.map(entry => entry.role), ['blank']);
});

test('the table measurement refuses a table that does not open', async context => {
  await refuses(context, 'table', editor => { editor.open = async () => ({ ok: false, code: 'invalid-document' }); },
    /"ok":false,"code":"invalid-document"/u);
});

test('the table measurement refuses advisory reads that change or disable the document', async context => {
  await refuses(context, 'table', editor => { editor.can = () => ({ enabled: false }); }, /Advisory read changed document/u);
  await refuses(context, 'table', editor => {
    editor.can = () => { editor.revision = { value: editor.revision.value }; return { enabled: true }; };
  }, /Advisory read changed document/u);
});

test('the table measurement refuses an insertion or an undo that does not do what it reports', async context => {
  const insertions = [
    ['an insertion the document refuses', editor => { editor.execute = async () => ({ ok: false, code: 'busy' }); }],
    ['an insertion that is not one revision', editor => {
      const execute = editor.execute;
      editor.execute = async action => { const outcome = await execute(action); editor.revision = { value: editor.revision.value + 1 }; return outcome; };
    }],
    ['an insertion that adds no row', editor => {
      const execute = editor.execute;
      editor.execute = async action => { const outcome = await execute(action); editor.rows = 19; return outcome; };
    }],
  ];
  for (const [name, tamper] of insertions) await refuses(context, 'table', tamper, /Table insertion failed/u).catch(error => { throw new Error(`${name}: ${error.message}`); });
  const undos = [
    ['an undo the document refuses', editor => {
      const execute = editor.execute;
      editor.execute = async action => action === 'undo' ? { ok: false, code: 'busy' } : execute(action);
    }],
    ['an undo that is not one revision', editor => {
      const execute = editor.execute;
      editor.execute = async action => { const outcome = await execute(action); if (action === 'undo') editor.revision = { value: editor.revision.value + 1 }; return outcome; };
    }],
    ['an undo that leaves the inserted row', editor => {
      const execute = editor.execute;
      editor.execute = async action => { const outcome = await execute(action); if (action === 'undo') editor.rows = 20; return outcome; };
    }],
  ];
  for (const [name, tamper] of undos) await refuses(context, 'table', tamper, /Table undo did not restore 19 rows/u).catch(error => { throw new Error(`${name}: ${error.message}`); });
});

test('the table measurement refuses a saved table that is missing its edits, cells or rows', async context => {
  await refuses(context, 'table', editor => { editor.save = async () => ({ ok: false, code: 'busy' }); },
    /Table save failed: \{"ok":false,"code":"busy"\}/u);
  await refuses(context, 'table', editor => { editor.save = async () => ({ ok: true, value: { bytes: savedPackage(['T18_19'], 19) } }); },
    /Table typing sample missing from saved document/u);
  await refuses(context, 'table', editor => { editor.save = async () => ({ ok: true, value: { bytes: savedPackage([TYPED], 19) } }); },
    /Last table cell missing after operation\/typing samples/u);
  await refuses(context, 'table', editor => { editor.save = async () => ({ ok: true, value: { bytes: savedPackage(['T18_19', TYPED], 0) } }); },
    { name: 'AssertionError', actual: 0, expected: 19 });
});
