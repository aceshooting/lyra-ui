import { expect } from '@open-wc/testing';
import * as runtime from './localization-runtime.js';
import type { LyraLocaleMeta, LyraLocaleStrings } from './localization-types.js';

const registerDelta = (runtime as unknown as {
  registerLyraLocaleDelta: (locale: string, parent: string, strings: LyraLocaleStrings, meta?: LyraLocaleMeta) => void;
}).registerLyraLocaleDelta;
const hostFor = (locale: string): HTMLElement => {
  const host = document.createElement('div');
  host.lang = locale;
  return host;
};

it('resolves explicit regional parents live without copying their messages into the delta', () => {
  runtime.registerLyraLocale('qaa-Latn', { cancel: 'Parent cancel', close: 'Parent close' }, { dir: 'rtl' });
  registerDelta('qaa-CA', 'qaa-Latn', { close: 'Regional close' });
  const host = hostFor('qaa-CA');
  expect(runtime.resolveLyraString(host, 'cancel')).to.equal('Parent cancel');
  expect(runtime.resolveLyraString(host, 'close')).to.equal('Regional close');
  expect(runtime.getRegisteredLyraLocaleKeys('qaa-CA')).to.deep.equal(['close']);
  expect(runtime.getLyraLocaleDirection('qaa-CA')).to.equal('rtl');
  runtime.registerLyraLocale('qaa-Latn', { cancel: 'Updated cancel' });
  expect(runtime.resolveLyraString(host, 'cancel')).to.equal('Updated cancel');
  runtime.registerLyraLocale('qaa-CA', { retry: 'Regional retry' });
  expect(runtime.resolveLyraString(host, 'cancel')).to.equal('Updated cancel');
});

it('observes a parent registered after its delta and supports a nested parent chain', () => {
  registerDelta('qab-CA', 'qab-Latn', { close: 'Regional close' });
  registerDelta('qab-Latn', 'qab', { retry: 'Script retry' });
  runtime.registerLyraLocale('qab', { cancel: 'Late parent cancel' });
  expect(runtime.resolveLyraString(hostFor('qab-CA'), 'cancel')).to.equal('Late parent cancel');
  expect(runtime.resolveLyraString(hostFor('qab-CA'), 'retry')).to.equal('Script retry');
});

it('rejects identity cycles atomically and preserves the previous parent and messages', () => {
  runtime.registerLyraLocale('qac', { cancel: 'Original parent' });
  registerDelta('qac-CA', 'qac', { close: 'Original regional' });
  expect(() => registerDelta('QAC_ca', 'qac-CA', { close: 'Invalid write' })).to.throw(TypeError);
  expect(() => registerDelta('qac', 'qac-CA', { cancel: 'Invalid cycle write' })).to.throw(TypeError);
  expect(runtime.resolveLyraString(hostFor('qac-CA'), 'cancel')).to.equal('Original parent');
  expect(runtime.resolveLyraString(hostFor('qac-CA'), 'close')).to.equal('Original regional');
});

it('does not let an exact-only regional delta become the generic language fallback', () => {
  runtime.registerLyraLocale('qad', { cancel: 'Base cancel' });
  registerDelta('qad-CA', 'qad', { cancel: 'Regional cancel' });
  expect(runtime.resolveLyraString(hostFor('qad'), 'cancel')).to.equal('Base cancel');
  expect(runtime.resolveLyraString(hostFor('qad-US'), 'cancel')).to.equal('Base cancel');
});

it('does not execute delta message getters', () => {
  let reads = 0;
  runtime.registerLyraLocale('qae', { cancel: 'Safe parent' });
  registerDelta('qae-CA', 'qae', Object.defineProperty({}, 'cancel', {
    enumerable: true,
    get() { reads++; return 'Unsafe getter'; },
  }));
  expect(reads).to.equal(0);
  expect(runtime.resolveLyraString(hostFor('qae-CA'), 'cancel')).to.equal('Safe parent');
});


it('notifies active delta consumers when a parent changes and when its parent is replaced', () => {
  const previous = runtime.getLyraLocale();
  runtime.registerLyraLocale('qag', { cancel: 'First parent' });
  runtime.registerLyraLocale('qah', { cancel: 'Second parent' });
  registerDelta('qaf-CA', 'qag', {});
  runtime.setLyraLocale('qaf-CA');
  let updates = 0;
  const stop = runtime.subscribeLyraLocale(() => { updates++; });
  try {
    runtime.registerLyraLocale('qag', { cancel: 'First updated' });
    expect(updates).to.equal(1);
    registerDelta('qaf-CA', 'qah', {});
    expect(updates).to.equal(2);
    expect(runtime.resolveLyraString(hostFor('qaf-CA'), 'cancel')).to.equal('Second parent');
    runtime.registerLyraLocale('qag', { cancel: 'Former parent updated' });
    expect(updates).to.equal(2);
  } finally {
    stop();
    runtime.setLyraLocale(previous);
  }
});

it('rejects an over-depth parent extension before changing any descendant lookup', () => {
  runtime.registerLyraLocale('x-delta-depth-32', { cancel: 'Deep parent' });
  for (let index = 31; index >= 0; index--)
    registerDelta(`x-delta-depth-${index}`, `x-delta-depth-${index + 1}`, {});
  expect(() => registerDelta('x-delta-depth-32', 'x-delta-depth-33', { cancel: 'Invalid write' })).to.throw(TypeError);
  expect(runtime.resolveLyraString(hostFor('x-delta-depth-0'), 'cancel')).to.equal('Deep parent');
});

it('revalidates the graph after snapshot proxy traps reenter registration', () => {
  let entered = false;
  const messages = new Proxy({ cancel: 'Outer write' }, {
    ownKeys(target) {
      if (!entered) {
        entered = true;
        registerDelta('x-delta-reentrant-b', 'x-delta-reentrant-a', { close: 'Inner write' });
      }
      return Reflect.ownKeys(target);
    },
  });
  expect(() => registerDelta('x-delta-reentrant-a', 'x-delta-reentrant-b', messages)).to.throw(TypeError);
  expect(runtime.getRegisteredLyraLocaleKeys('x-delta-reentrant-a')).to.deep.equal([]);
  expect(runtime.getRegisteredLyraLocaleKeys('x-delta-reentrant-b')).to.deep.equal(['close']);
});

it('updates former active and host dependants when a regional catalog becomes exact-only', () => {
  const previous = runtime.getLyraLocale();
  runtime.registerLyraLocale('en', { cancel: 'English fallback' });
  runtime.registerLyraLocale('qaz-CA', { cancel: 'Regional fallback' });
  runtime.setLyraLocale('qaz');
  let activeUpdates = 0;
  let hostUpdates = 0;
  const host = Object.assign(hostFor('qaz'), { requestUpdate() { hostUpdates++; } });
  document.body.append(host);
  const stopActive = runtime.subscribeLyraLocale(() => { activeUpdates++; });
  const stopHost = runtime.subscribeLyraLocaleForHost(host);
  try {
    expect(runtime.resolveLyraString(host, 'cancel')).to.equal('Regional fallback');
    registerDelta('qaz-CA', 'en', {});
    expect(activeUpdates).to.equal(1);
    expect(hostUpdates).to.equal(1);
    expect(runtime.resolveLyraString(host, 'cancel')).to.equal('English fallback');
  } finally {
    stopActive();
    stopHost();
    host.remove();
    runtime.setLyraLocale(previous);
  }
});
