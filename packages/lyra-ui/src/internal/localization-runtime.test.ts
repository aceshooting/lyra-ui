import { expect } from '@open-wc/testing';
import {
  canonicalizeLyraLocale,
  enableLyraLocaleCache,
  getLyraLocale,
  getLyraLocaleDirection,
  registerLyraExactLocale,
  registerLyraLocale,
  peekLyraDirection,
  resolveLyraDirection,
  resolveLocalizedParts,
  resolveLyraLocale,
  resolveLyraString,
  setLyraLocale,
} from './localization-runtime.js';

// Most of localization-runtime.ts is already exercised indirectly, at high volume, through every
// component that extends LyraElement (src/internal/lyra-element.test.ts) and through the public
// wrapper's own extensive suites (src/internal/localization.test.ts,
// src/internal/localization-reactivity.test.ts). This file targets the defensive/adversarial-scale
// branches those realistic call sites never reach: resolveLocalizedParts()'s marker-exhaustion
// fallbacks, the catalog message cap, and the bounded identity/candidate caches under pressure.

function localeHost(locale: string): HTMLElement {
  const host = document.createElement('div');
  host.setAttribute('locale', locale);
  return host;
}

it('splits interpolated text around the caller-selected rich value', () => {
  const template = 'Confirm {value}';
  const parts = resolveLocalizedParts(template, (marker) => `Confirm ${marker}!!`);
  expect(parts).to.deep.equal(['Confirm ', '!!']);
});

it('falls back to a general BMP code point when the template exhausts the private-use area', () => {
  // Every private-use code point (0xE000-0xF8FF) is present, so the first marker-selection loop
  // never finds a gap and the function must fall through to the wider 65,536-entry scan.
  const template = Array.from(
    { length: 0xf8ff - 0xe000 + 1 },
    (_, index) => String.fromCharCode(0xe000 + index),
  ).join('');

  const parts = resolveLocalizedParts(template, (marker) => `left${marker}right`);
  expect(parts).to.deep.equal(['left', 'right']);
});

it('falls back to a least-frequent code unit and follower pair when the template exhausts every BMP code unit', () => {
  // Every UTF-16 code unit 0..65535 appears exactly once, so even the wider single-code-point scan
  // finds nothing free and the function must fall back to a two-code-unit least-frequent pair.
  const template = Array.from({ length: 65_536 }, (_, code) => String.fromCharCode(code)).join('');

  const parts = resolveLocalizedParts(template, (marker) => `before☃${marker}after☃`);
  expect(parts).to.deep.equal(['before☃', 'after☃']);
});

it('resolves direction from Intl.Locale text info when no catalog meta declares it', () => {
  // This test file never registers or imports a catalog for 'ar', so getLyraLocaleDirection()
  // cannot take the registered-meta shortcut and must fall through to the Intl.Locale text-info
  // lookup — the one branch every other suite's pre-registered he/fa/ar catalogs short-circuit.
  expect(getLyraLocaleDirection('ar')).to.equal('rtl');
  expect(getLyraLocaleDirection('en')).to.equal('ltr');
});

it('resolves ltr for a structurally invalid tag instead of throwing', () => {
  expect(getLyraLocaleDirection('not a locale !!')).to.equal('ltr');
  expect(getLyraLocaleDirection('')).to.equal('ltr');
});

it('bounds a registered catalog to the maximum retained message count', () => {
  const locale = 'zz-catalog-message-cap';
  const strings: Record<string, string> = {};
  for (let index = 0; index < 4_100; index += 1) strings[`key${index}`] = `value${index}`;
  const ignoredSymbol = Symbol('ignored');
  Object.defineProperty(strings, 'hidden', { enumerable: false, value: 'hidden' });
  const reordered = new Proxy(strings, {
    ownKeys(target) {
      return [ignoredSymbol, 'hidden', ...Reflect.ownKeys(target).filter(
        (key) => key !== ignoredSymbol && key !== 'hidden',
      )];
    },
  });
  registerLyraLocale(locale, reordered);

  const host = localeHost(locale);
  expect(resolveLyraString(host, 'key0')).to.equal('value0');
  expect(resolveLyraString(host, 'key4095')).to.equal('value4095');
  // Well past the 4,096-entry cap: never copied into the snapshot, so lookup falls through to the
  // raw key (no fallback/defaults were supplied).
  expect(resolveLyraString(host, 'key4099')).to.equal('key4099');
});

it('clears the bounded identity/candidate caches under sustained unique-locale pressure without breaking resolution', () => {
  for (let index = 0; index < 140; index += 1) {
    const tag = `zz-cache-pressure-${index}`;
    getLyraLocaleDirection(tag);
  }
  // Re-resolving an early tag after the cache has cleared and refilled several times over must
  // still produce the correct, stable identity.
  expect(canonicalizeLyraLocale('zz-cache-pressure-0')).to.equal('zz-cache-pressure-0');
  expect(canonicalizeLyraLocale('zz-cache-pressure-139')).to.equal('zz-cache-pressure-139');
});

/** Builds `<div lang="x-outer"><div lang=""><span></span></div></div>`, appended to the document
 *  so `:lang()` (which only matches in a rendered tree) can attest to the platform contract. */
function langBlockedTree(): { outer: HTMLElement; blocked: HTMLElement; leaf: HTMLElement } {
  const outer = document.createElement('div');
  outer.setAttribute('lang', 'x-outer');
  const blocked = document.createElement('div');
  blocked.setAttribute('lang', '');
  const leaf = document.createElement('span');
  blocked.append(leaf);
  outer.append(blocked);
  document.body.append(outer);
  return { outer, blocked, leaf };
}

it('matches the platform: lang="" is "language unknown" and blocks inheritance, not an absent attribute', () => {
  // HTML's language-of-a-node algorithm stops at the nearest ancestor carrying `lang` "regardless
  // of its value", and defines the empty string as "the primary language is unknown". CSS
  // `:lang()` matches off that same computation, so the engine itself attests to it here rather
  // than the assertion resting on a quoted spec sentence.
  const { outer, blocked, leaf } = langBlockedTree();
  const previous = getLyraLocale();
  try {
    setLyraLocale('');
    expect(outer.matches(':lang(x-outer)')).to.equal(true);
    expect(blocked.matches(':lang(x-outer)')).to.equal(false);
    expect(leaf.matches(':lang(x-outer)')).to.equal(false);

    // ...and the library resolves the same way: an empty `lang` refuses the ancestor's locale
    // instead of falling through to it.
    expect(resolveLyraLocale(blocked)).to.equal('en');
    expect(resolveLyraLocale(leaf)).to.equal('en');
    expect(resolveLyraLocale(outer)).to.equal('x-outer');
  } finally {
    setLyraLocale(previous);
    outer.remove();
  }
});

it('lets setLyraLocale() supply the locale a lang="" subtree refuses to inherit', () => {
  const { outer, leaf } = langBlockedTree();
  const previous = getLyraLocale();
  try {
    setLyraLocale('x-explicit');
    // `lang=""` withdraws the subtree from DOM language *inheritance*; the app-level locale is not
    // inherited from an ancestor, so it still applies.
    expect(resolveLyraLocale(leaf)).to.equal('x-explicit');
    expect(resolveLyraLocale(outer)).to.equal('x-outer');
  } finally {
    setLyraLocale(previous);
    outer.remove();
  }
});

it('treats an empty `locale` as unset, so that element lang and its ancestors still resolve', () => {
  // `locale` is this library's own attribute and carries no HTML empty-string semantics: an empty
  // one simply declares nothing, and must not block what an absent one would have allowed.
  const outer = document.createElement('div');
  outer.setAttribute('lang', 'x-outer');
  const host = document.createElement('div');
  host.setAttribute('locale', '');
  outer.append(host);
  document.body.append(outer);
  const previous = getLyraLocale();
  try {
    setLyraLocale('');
    expect(resolveLyraLocale(host)).to.equal('x-outer');
    host.setAttribute('lang', 'x-element');
    expect(resolveLyraLocale(host)).to.equal('x-element');
  } finally {
    setLyraLocale(previous);
    outer.remove();
  }
});

it('rejects missing and unbounded registered locale identifiers', () => {
  expect(() => registerLyraLocale('', {})).to.throw(TypeError, 'required');
  expect(() => registerLyraLocale(`x-${'a'.repeat(300)}`, {})).to.throw(TypeError, 'BCP-47');
});

it('contains non-string locale inputs at the public runtime boundary', () => {
  expect(canonicalizeLyraLocale(null as never)).to.equal('en');
  expect(() => registerLyraLocale(null as never, {})).to.throw(TypeError, 'string');
});

it('removes reverse regional fallback when an existing catalog becomes exact-only', () => {
  registerLyraLocale('qaa-AA', { topologyProbe: 'regional' });
  expect(resolveLyraString(localeHost('qaa'), 'topologyProbe')).to.equal('regional');

  registerLyraExactLocale('qaa-AA', { topologyProbe: 'exact' });

  expect(resolveLyraString(localeHost('qaa-AA'), 'topologyProbe')).to.equal('exact');
  expect(resolveLyraString(localeHost('qaa'), 'topologyProbe')).to.equal('topologyProbe');
});

it('snapshots hostile catalogs without invoking accessors or retaining live traps', () => {
  let getterCalls = 0;
  const accessorCatalog = Object.create(null) as Record<string, string>;
  accessorCatalog.retained = 'yes';
  Object.defineProperty(accessorCatalog, 'unsafe', {
    enumerable: true,
    get() {
      getterCalls += 1;
      return 'unsafe';
    },
  });
  registerLyraLocale('x-accessor-catalog', accessorCatalog);
  accessorCatalog.retained = 'mutated';
  expect(resolveLyraString(localeHost('x-accessor-catalog'), 'retained')).to.equal('yes');
  expect(resolveLyraString(localeHost('x-accessor-catalog'), 'unsafe')).to.equal('unsafe');
  expect(getterCalls).to.equal(0);

  const prototypeTrap = new Proxy({}, {
    getPrototypeOf() {
      throw new Error('prototype unavailable');
    },
  });
  registerLyraLocale('x-prototype-trap', prototypeTrap as Record<string, string>);
  expect(resolveLyraString(localeHost('x-prototype-trap'), 'missing')).to.equal('missing');

  const enumerationTrap = new Proxy({ retained: 'yes', unread: 'no' }, {
    getOwnPropertyDescriptor(target, key) {
      if (key === 'unread') throw new Error('descriptor unavailable');
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  registerLyraLocale('x-enumeration-trap', enumerationTrap);
  expect(resolveLyraString(localeHost('x-enumeration-trap'), 'retained')).to.equal('yes');
  expect(resolveLyraString(localeHost('x-enumeration-trap'), 'unread')).to.equal('unread');

  const ownKeysTrap = new Proxy({ unread: 'no' }, {
    ownKeys() {
      throw new Error('enumeration unavailable');
    },
  });
  registerLyraLocale('x-own-keys-trap', ownKeysTrap);
  expect(resolveLyraString(localeHost('x-own-keys-trap'), 'unread')).to.equal('unread');
});

it('follows an assigned-slot direction context and exposes the cached resolution', () => {
  const host = document.createElement('span');
  const slot = document.createElement('slot');
  slot.setAttribute('dir', 'rtl');
  Object.defineProperty(host, 'assignedSlot', { configurable: true, value: slot });
  expect(resolveLyraDirection(host)).to.equal('rtl');

  const directed = document.createElement('div');
  directed.setAttribute('dir', 'rtl');
  enableLyraLocaleCache(directed);
  document.body.append(directed);
  try {
    expect(peekLyraDirection(directed)).to.equal(undefined);
    expect(resolveLyraDirection(directed)).to.equal('rtl');
    expect(peekLyraDirection(directed)).to.equal('rtl');
  } finally {
    directed.remove();
  }
});

it('contains hostile plural and interpolation value lookups', () => {
  const host = localeHost('x-invalid-plural-locale');
  const values = new Proxy({} as Record<string, string | number>, {
    get() {
      throw new Error('value unavailable');
    },
  });
  const result = resolveLyraString(
    host,
    'items',
    { items: { one: 'one {count}', other: 'many {count}' } },
    undefined,
    values,
  );
  expect(result).to.equal('many {count}');
});

it('contains descriptor and enumeration failures inside catalog snapshots', () => {
  let descriptorReads = 0;
  const descriptorTrap = new Proxy({ retained: 'yes' }, {
    getOwnPropertyDescriptor(target, key) {
      descriptorReads += 1;
      if (descriptorReads > 1) throw new Error('second descriptor read unavailable');
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  registerLyraLocale('x-descriptor-trap', descriptorTrap);
  expect(resolveLyraString(localeHost('x-descriptor-trap'), 'retained')).to.equal('yes');
  expect(descriptorReads).to.equal(1);

  const pluralTrap = new Proxy({ other: 'many' }, {
    ownKeys() {
      throw new Error('plural enumeration unavailable');
    },
  });
  registerLyraLocale('x-plural-enumeration-trap', {
    items: pluralTrap,
  } as unknown as Parameters<typeof registerLyraLocale>[1]);
  expect(resolveLyraString(localeHost('x-plural-enumeration-trap'), 'items')).to.equal('items');

  const pluralDescriptorTrap = new Proxy({ other: 'many' }, {
    getOwnPropertyDescriptor() {
      throw new Error('plural descriptor unavailable');
    },
  });
  registerLyraLocale('x-plural-descriptor-trap', {
    items: pluralDescriptorTrap,
  } as unknown as Parameters<typeof registerLyraLocale>[1]);
  expect(resolveLyraString(localeHost('x-plural-descriptor-trap'), 'items')).to.equal('items');
});

it('contains a plural data-descriptor failure after safe enumeration', () => {
  const plural = { other: 'many' };
  const original = Object.getOwnPropertyDescriptor;
  Object.getOwnPropertyDescriptor = ((target: object, key: PropertyKey) => {
    if (target === plural) throw new Error('plural data unavailable');
    return original(target, key);
  }) as typeof Object.getOwnPropertyDescriptor;
  try {
    registerLyraLocale('x-plural-data-trap', {
      items: plural,
    } as unknown as Parameters<typeof registerLyraLocale>[1]);
  } finally {
    Object.getOwnPropertyDescriptor = original;
  }

  expect(resolveLyraString(localeHost('x-plural-data-trap'), 'items')).to.equal('items');
});

it('falls through malformed plural locale candidates and bounds their cache', () => {
  const message = { items: { other: 'many {count}' } };
  for (let index = 0; index < 70; index += 1) {
    const host = localeHost(`zz-plural-cache-${index}`);
    expect(resolveLyraString(host, 'items', message, undefined, { count: index }))
      .to.equal(`many ${index}`);
  }
});

it('does not retain candidate-cache state for an unbounded inherited locale', () => {
  const unbounded = `x-${'a'.repeat(600)}`;
  expect(getLyraLocaleDirection(unbounded)).to.equal('ltr');
  expect(getLyraLocaleDirection(unbounded)).to.equal('ltr');
});
