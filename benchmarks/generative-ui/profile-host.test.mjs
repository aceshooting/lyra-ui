import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { createProcessServices, createOwnedPage, activateNative } from './profile-host.mjs';

// Synthetic filesystem/browser doubles verify ownership; they are not campaign evidence.
test('independent process services preserve an earlier store and remove only their owned directories', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lyra-profile-host-test-'));
  let first, second;
  try {
    const modulePath = join(directory, 'service.mjs');
    await writeFile(modulePath, `import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
export async function createHostServices({ scratchDirectory }) {
  const file = join(scratchDirectory, 'state.json'); await writeFile(file, '1');
  return { routes: [], services: { dashboard: { url: '/host/dashboard' } },
    read: async () => Number(await readFile(file, 'utf8')), write: value => writeFile(file, String(value)),
    dispose: async () => {} };
}`);
    const args = { hostModules: [{ name: 'dashboard', url: pathToFileURL(modulePath) }], loadLibrary: () => { throw new Error('Unexpected library import.'); }, scratchDirectory: directory,
      baseServices: { chatRecording: { url: '/fixtures/recording.json' } } };
    first = await createProcessServices(args);
    await first.serviceInstances.dashboard.write(4);
    second = await createProcessServices(args);
    assert.equal(await first.serviceInstances.dashboard.read(), 4);
    assert.equal(await second.serviceInstances.dashboard.read(), 1);
    second.services.chatRecording.url = '/changed';
    assert.equal(first.services.chatRecording.url, '/fixtures/recording.json');
    assert.equal(args.baseServices.chatRecording.url, '/fixtures/recording.json');
    await second.close(); await second.close();
    assert.equal(await first.serviceInstances.dashboard.read(), 4);
    await first.close();
    assert.deepEqual(await readdir(directory), ['service.mjs']);
    assert.match(await readFile(modulePath, 'utf8'), /createHostServices/u);
  } finally { await first?.close(); await second?.close(); await rm(directory, { recursive: true, force: true }); }
});

test('a rejected duplicate service cleans the partially initialized process directory', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lyra-profile-host-test-'));
  try {
    const modulePath = join(directory, 'service.mjs');
    await writeFile(modulePath, `export async function createHostServices() { return { routes: [], services: { duplicate: {} }, dispose: async () => {} }; }`);
    const modules = ['one', 'two'].map(name => ({ name, url: pathToFileURL(modulePath) }));
    await assert.rejects(createProcessServices({ hostModules: modules, loadLibrary: () => {}, scratchDirectory: directory }), /Duplicate host service/u);
    assert.deepEqual(await readdir(directory), ['service.mjs']);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

function pageDouble({ failBoot = false } = {}) {
  const calls = [], bindings = {}, handlers = {};
  const host = { origin: 'http://127.0.0.1:1234', assets: ['/', '/main.js'], routes: [{ path: '/host/dashboard', methods: ['POST'] }], receipts: [] };
  const page = {
    setDefaultTimeout: value => calls.push(['timeout', value]), on: (name, handler) => { handlers[name] = handler; },
    exposeBinding: async (name, handler) => { bindings[name] = handler; calls.push(['binding', name]); },
    goto: async (origin, options) => { calls.push(['goto', origin, options]); if (failBoot) throw new Error('boot failed'); },
    waitForFunction: async (_callback, name) => calls.push(['interface', name]),
    evaluate: async callback => runInNewContext(`(${callback.toString()})()`, {
      document: { documentElement: { dataset: { lrMode: 'light' } }, fonts: { ready: Promise.resolve().then(() => calls.push(['fonts'])) } },
      matchMedia: () => ({ matches: true }), URL,
      performance: { getEntriesByType: type => type === 'navigation' ? [{ domContentLoadedEventEnd: 4, loadEventEnd: 8 }] : [] },
    }),
  };
  const context = { route: async (_pattern, handler) => { handlers.route = handler; }, routeWebSocket: async (_pattern, handler) => { handlers.socket = handler; },
    newPage: async () => page, close: async () => calls.push(['close']),
    newCDPSession: async () => { calls.push(['cdp']); return { send: async command => calls.push(['cdp-send', command]) }; } };
  const browser = { newContext: async options => { calls.push(['context', options]); return context; } };
  return { host, page, browser, context, calls, handlers, bindings };
}

test('shared page installs bindings before boot and preserves narrow light/font policy without measuring', async () => {
  const mock = pageDouble();
  const state = await createOwnedPage({ browser: mock.browser, host: mock.host, viewport: { width: 320, height: 900 }, globalName: '__memoryProfile',
    bindings: { __memoryArchive: async () => 'owned' } });
  assert.equal(state.page, mock.page);
  assert.deepEqual(mock.calls[0], ['context', { viewport: { width: 320, height: 900 }, deviceScaleFactor: 1, colorScheme: 'light', reducedMotion: 'reduce', serviceWorkers: 'block', locale: 'en-US', timezoneId: 'UTC' }]);
  assert.ok(mock.calls.findIndex(item => item[0] === 'binding') < mock.calls.findIndex(item => item[0] === 'goto'));
  assert.ok(mock.calls.some(item => item[0] === 'fonts'));
  assert.ok(mock.calls.some(item => item[0] === 'interface' && item[1] === '__memoryProfile'));
  assert.equal(state.cdp, undefined); assert.equal(state.initialDelivery, undefined);
  assert.equal(mock.calls.some(item => item[0] === 'cdp-send'), false);
  let continued = 0, aborted = 0;
  const request = (url, method) => ({ request: () => ({ url: () => url, method: () => method }), continue: async () => continued++, abort: async () => aborted++ });
  await mock.handlers.route(request(`${mock.host.origin}/host/dashboard`, 'POST'));
  await mock.handlers.route(request('https://example.org/main.js', 'GET'));
  mock.handlers.pageerror(); mock.handlers.socket({ close: () => aborted++ });
  assert.equal(continued, 1); assert.equal(aborted, 2); assert.equal(state.blocked, 2); assert.equal(state.errors, 1);
});

test('timing page opts into delivery and receives inert CDP session; boot failures close context', async () => {
  const mock = pageDouble();
  const state = await createOwnedPage({ browser: mock.browser, host: mock.host, viewport: { width: 1280, height: 900 }, globalName: '__genProfile', collectDelivery: true, cdp: true });
  assert.deepEqual(JSON.parse(JSON.stringify(state.initialDelivery)), { resources: [], domContentLoadedMs: 4, loadMs: 8 });
  assert.ok(state.cdp); assert.equal(mock.calls.some(item => item[0] === 'cdp-send'), false);
  const failure = pageDouble({ failBoot: true });
  await assert.rejects(createOwnedPage({ browser: failure.browser, host: failure.host, viewport: { width: 1280, height: 900 }, globalName: '__genProfile' }), /boot failed/u);
  assert.equal(failure.calls.filter(item => item[0] === 'close').length, 1);
});

test('native activation preserves empty fill and refuses duplicate or invisible targets', async () => {
  const calls = [];
  const locator = { count: async () => 1, isVisible: async () => true, isEnabled: async () => true,
    fill: async value => calls.push(['fill', value]), press: async value => calls.push(['press', value]), click: async () => calls.push(['click']) };
  const page = { locator: selector => { assert.equal(selector, '#filter'); return locator; } };
  await activateNative(page, { selector: '#filter', action: 'fill', value: '' });
  await activateNative(page, { selector: '#filter', action: 'press', value: 'Enter' });
  assert.deepEqual(calls, [['fill', ''], ['press', 'Enter']]);
  locator.count = async () => 2;
  await assert.rejects(activateNative(page, { selector: '#filter', action: 'click' }), /exactly one/u);
  locator.count = async () => 1; locator.isVisible = async () => false;
  await assert.rejects(activateNative(page, { selector: '#filter', action: 'click' }), /visible/u);
  assert.equal(calls.length, 2);
});
