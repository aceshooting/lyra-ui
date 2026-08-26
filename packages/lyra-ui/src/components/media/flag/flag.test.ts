import { fixture, expect, html, waitUntil, aTimeout } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './flag.js';
import './flag-peer.js';
import { loadFlagUrl, loadBulkFlagUrl, setFlagUrlResolver } from './flag.js';
import { registerLyraFlagPeer } from './flag-peer.js';
import type { LyraFlag } from './flag.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

const TEST_FLAG_SRC = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E';
const TEST_FLAG_SRC_REPLACEMENT =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3Ccircle cx="1" cy="1" r="1"%3E%3C/circle%3E%3C/svg%3E';

async function captureConsoleWarnings<T>(operation: () => Promise<T>): Promise<{
  result: T;
  warnings: string[];
}> {
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(' '));
  try {
    return { result: await operation(), warnings };
  } finally {
    console.warn = originalWarn;
  }
}

function assertiveAnnouncements(): string[] {
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`,
  );
  return sink ? Array.from(sink.children, (child) => child.textContent ?? '') : [];
}

async function img(el: LyraFlag): Promise<HTMLImageElement> {
  // Resolving a flag now involves two sequential dynamic imports on a cold start (the
  // `@aceshooting/lyra-flags` peer package, then that specific code's own lazy loader module —
  // see flag.ts's bundle-size note) instead of one, so give this more headroom than the
  // library default (1000ms) to avoid flaking under load. Even 15000ms can be exhausted by the
  // coverage-instrumented 300+ file run before the two cold dynamic imports receive CPU time —
  // same class of issue as lr-graph's setup and code-block.test.ts's Shiki wait.
  await waitUntil(
    () => el.shadowRoot!.querySelector('img:not([hidden])'),
    'loaded flag image should render',
    { timeout: 45_000 },
  );
  return el.shadowRoot!.querySelector('img:not([hidden])')!;
}

it('shows a loading skeleton and aria-busy while the flag package loads, and ignores a stale resolution once the code is cleared first', async () => {
  const el = (await fixture(
    html`<lr-flag
      country="fr"
      .strings=${{ loading: 'Chargement du drapeau…' }}
    ></lr-flag>`,
  )) as LyraFlag;
  expect(el.getAttribute('aria-busy')).to.equal('true');
  const skeleton = el.shadowRoot!.querySelector('lr-skeleton')!;
  expect(skeleton !== null).to.be.true;
  const updatedSkeleton = skeleton as HTMLElement & {
    announce: boolean;
    updateComplete: Promise<unknown>;
  };
  await updatedSkeleton.updateComplete;
  expect(el.getAttribute('aria-busy')).to.equal('true');
  expect(updatedSkeleton.announce).to.be.false;
  expect(
    el.shadowRoot!.querySelectorAll('[role="alert"], [role="status"], [aria-live]').length,
  ).to.equal(0);
  expect(
    updatedSkeleton.shadowRoot!.querySelectorAll('[role="alert"], [role="status"], [aria-live]')
      .length,
  ).to.equal(0);
  expect(el.shadowRoot!.querySelector('.sr-only')?.textContent?.trim()).to.equal(
    'Chargement du drapeau…',
  );
  expect((el.shadowRoot!.querySelector('img')) == null).to.equal(true);

  // Clear the code while the (real, unstubbed) first-ever peer-package
  // resolution for 'fr' is still in flight -- this is the very first fixture
  // in the suite, so `@aceshooting/lyra-flags`'s dynamic import genuinely
  // hasn't settled yet (proven by the aria-busy assertion above).
  el.country = '';
  await el.updateComplete;
  expect(el.getAttribute('aria-busy')).to.equal('false');
  expect((el.shadowRoot!.querySelector('lr-skeleton')) == null).to.be.true;
  expect((el.shadowRoot!.querySelector('img')) == null).to.equal(true);

  // Give the original 'fr' resolution every chance to land. A correctly
  // token-guarded implementation recognizes it as superseded and no-ops; a
  // buggy one overwrites the cleared state with the stale flag.
  await aTimeout(200);
  expect((el.shadowRoot!.querySelector('img')) == null).to.equal(true);
  expect(el.getAttribute('aria-busy')).to.equal('false');
});

it('renders an img for a country code', async function () {
  // The first test in this file to await img()'s wait to completion uninterrupted (the very
  // first test above deliberately interrupts mid-resolution instead) -- genuinely exposed to
  // @aceshooting/lyra-flags' cold-start dynamic import latency under full-suite concurrency, the
  // same class of flake img()'s own comment gives its internal wait a coverage-safe margin for.
  // That inner ceiling is moot without also raising this test's own mocha-level timeout past the
  // 6000ms default, which mocha would otherwise still enforce first.
  this.timeout(60_000);
  const el = (await fixture(html`<lr-flag country="fr"></lr-flag>`)) as LyraFlag;
  const el2 = await img(el);
  expect(el2.getAttribute('src')).to.contain('fr.svg');
  expect(el2.getAttribute('alt')).to.equal(
    new Intl.DisplayNames([navigator.language], { type: 'region' }).of('FR'),
  );
  expect(el.getAttribute('aria-busy')).to.equal('false');
});

it('re-resolves the flag when country changes on an already-mounted element', async () => {
  const el = (await fixture(html`<lr-flag country="fr"></lr-flag>`)) as LyraFlag;
  await img(el);
  el.country = 'de';
  await waitUntil(
    () => el.shadowRoot!.querySelector('img')?.getAttribute('src')?.includes('de.svg'),
    'flag image should update to the new country',
  );
  expect(el.shadowRoot!.querySelector('img')!.getAttribute('alt')).to.equal(
    new Intl.DisplayNames([navigator.language], { type: 'region' }).of('DE'),
  );
});

it('country takes precedence over language when both are set', async () => {
  const el = (await fixture(html`<lr-flag country="fr" language="en"></lr-flag>`)) as LyraFlag;
  const el2 = await img(el);
  expect(el2.getAttribute('src')).to.contain('fr.svg');
  expect(el2.getAttribute('alt')).to.equal(
    new Intl.DisplayNames([navigator.language], { type: 'region' }).of('FR'),
  );
});

it('falls back to the standard fidelity when detailed is requested but the code has none', async () => {
  const el = (await fixture(html`<lr-flag country="fr" fidelity="detailed"></lr-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('src')).to.contain('fr.svg');
  expect(image.getAttribute('src')).to.not.contain('/detailed/');
});

it('re-resolves when fidelity is set to detailed on an already-mounted element', async () => {
  const el = (await fixture(html`<lr-flag country="es"></lr-flag>`)) as LyraFlag;
  const first = await img(el);
  expect(first.getAttribute('src')).to.not.contain('/detailed/');

  el.fidelity = 'detailed';
  await waitUntil(
    () => el.shadowRoot!.querySelector('img')?.getAttribute('src')?.includes('/detailed/es.svg'),
    'flag image should update to the detailed fidelity',
  );
});

it('requests the compact (WebP raster) fidelity for a code that has one', async () => {
  const el = (await fixture(html`<lr-flag country="es" fidelity="compact"></lr-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('src')).to.contain('/compact/es.webp');
});

it('falls back to the standard fidelity when compact is set but the code has none', async () => {
  const el = (await fixture(html`<lr-flag country="fr" fidelity="compact"></lr-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('src')).to.contain('fr.svg');
  expect(image.getAttribute('src')).to.not.contain('/compact/');
});

it('fidelity="detailed" resolves the detailed vector', async () => {
  const el = (await fixture(html`<lr-flag country="es" fidelity="detailed"></lr-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('src')).to.contain('/detailed/es.svg');
});

it('ignores a stray `detailed` attribute, which 8.0.0 removed', async () => {
  // The 7.x boolean alias is gone, not silently honoured: a migration that leaves the attribute
  // behind must render the default tier rather than keep working by accident and hide the break.
  const originalWarn = console.warn;
  console.warn = () => {};
  let el: LyraFlag;
  try {
    el = (await fixture(html`<lr-flag country="es" detailed></lr-flag>`)) as LyraFlag;
  } finally {
    console.warn = originalWarn;
  }
  const image = await img(el);
  expect(image.getAttribute('src')).to.not.contain('/detailed/');
});

it('re-resolves to the compact fidelity when fidelity is set on an already-mounted element', async () => {
  const el = (await fixture(html`<lr-flag country="es"></lr-flag>`)) as LyraFlag;
  const first = await img(el);
  expect(first.getAttribute('src')).to.not.contain('/compact/');

  el.fidelity = 'compact';
  await waitUntil(
    () => el.shadowRoot!.querySelector('img')?.getAttribute('src')?.includes('/compact/es.webp'),
    'flag image should update to the compact fidelity',
  );
});

it('reflects and normalizes the shape attribute', async () => {
  const el = (await fixture(html`<lr-flag country="fr" shape="circle"></lr-flag>`)) as LyraFlag;
  expect(el.shape).to.equal('circle');
  expect(el.getAttribute('shape')).to.equal('circle');

  el.shape = 'invalid' as 'circle';
  await el.updateComplete;
  expect(el.shape).to.equal('rect');
  expect(el.getAttribute('shape')).to.equal('rect');
});

it('reads the fidelity attribute into its property', async () => {
  const el = (await fixture(html`<lr-flag country="es" fidelity="detailed"></lr-flag>`)) as LyraFlag;
  expect(el.fidelity).to.equal('detailed');

  el.fidelity = 'compact';
  await el.updateComplete;
  expect(el.fidelity).to.equal('compact');
  expect(el.getAttribute('fidelity')).to.equal('compact');
});

it('normalizes a foreign fidelity value to the standard tier', async () => {
  const el = await fixture<LyraFlag>(html`
    <lr-flag country="es" fidelity="foreign"></lr-flag>
  `);
  expect(el.fidelity).to.equal('standard');
  expect(el.getAttribute('fidelity')).to.equal('standard');
  expect((await img(el)).getAttribute('src')).to.not.contain('/compact/');
  expect(el.shadowRoot!.querySelector('img')!.getAttribute('src')).to.not.contain('/detailed/');
});

it('resolves a language to a representative country flag', async () => {
  const el = (await fixture(html`<lr-flag language="en"></lr-flag>`)) as LyraFlag;
  expect((await img(el)).getAttribute('src')).to.contain('gb.svg');
});

it('resolves a region subtag to its country', async () => {
  const el = (await fixture(html`<lr-flag language="en-US"></lr-flag>`)) as LyraFlag;
  expect((await img(el)).getAttribute('src')).to.contain('us.svg');
});

it('resolves a region subtag past a 4-letter script subtag to its country (zh-Hant-TW -> Taiwan, not the zh base language default of China)', async () => {
  const el = (await fixture(html`<lr-flag language="zh-Hant-TW"></lr-flag>`)) as LyraFlag;
  expect((await img(el)).getAttribute('src')).to.contain('tw.svg');
});

it('honors a custom label for accessibility', async () => {
  const el = (await fixture(html`<lr-flag country="fr" label="Français"></lr-flag>`)) as LyraFlag;
  expect((await img(el)).getAttribute('alt')).to.equal('Français');
});

it('derives region names with the inherited effective locale', async () => {
  const wrapper = await fixture(html`
    <div lang="fr"><lr-flag src=${TEST_FLAG_SRC} country="de"></lr-flag></div>
  `);
  const el = wrapper.querySelector('lr-flag') as LyraFlag;
  const expected = new Intl.DisplayNames(['fr'], { type: 'region' }).of('DE');
  expect(el.shadowRoot!.querySelector('img')!.getAttribute('alt')).to.equal(expected);

  el.locale = 'de';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('img')!.getAttribute('alt')).to.equal(
    new Intl.DisplayNames(['de'], { type: 'region' }).of('DE'),
  );
});

it('prefers a host aria-label over label and the derived region name', async () => {
  const el = (await fixture(html`
    <lr-flag src=${TEST_FLAG_SRC} country="fr" label="France" aria-label="French flag"></lr-flag>
  `)) as LyraFlag;
  expect(el.shadowRoot!.querySelector('img')!.getAttribute('alt')).to.equal('French flag');
});

it('exposes themeable aspect-ratio and object-fit custom properties', async () => {
  const el = (await fixture(html`
    <lr-flag
      src=${TEST_FLAG_SRC}
      label="France"
      style="--lr-flag-aspect-ratio: 2 / 1; --lr-flag-object-fit: contain"
    ></lr-flag>
  `)) as LyraFlag;
  // `<img>` is one of three mutually exclusive branches -- the error branch renders
  // `[part="error"]` and no image at all -- so wait for it rather than assuming it won the race.
  await waitUntil(
    () => !!el.shadowRoot!.querySelector('img'),
    'the flag never committed an <img> to measure',
  );
  const image = el.shadowRoot!.querySelector('img') as HTMLImageElement;
  expect(getComputedStyle(el).aspectRatio).to.equal('2 / 1');
  expect(getComputedStyle(image).objectFit).to.equal('contain');
});

it('renders nothing for unknown input', async () => {
  const el = (await fixture(html`<lr-flag></lr-flag>`)) as LyraFlag;
  expect((el.shadowRoot!.querySelector('img')) == null).to.equal(true);
});

describe('src (pre-resolved URL, bypasses the peer-package lookup)', () => {
  it('loads the direct source without a peer lookup, ignoring country/language', async () => {
    const el = (await fixture(
      html`<lr-flag src=${TEST_FLAG_SRC} country="fr" label="Custom"></lr-flag>`,
    )) as LyraFlag;
    expect(el.getAttribute('aria-busy')).to.equal('true');
    const image = await img(el);
    expect(el.getAttribute('aria-busy')).to.equal('false');
    expect(image.getAttribute('src')).to.equal(TEST_FLAG_SRC);
    expect(image.getAttribute('alt')).to.equal('Custom');
  });

  it('fails visibly for an unsafe pre-resolved src URL', async () => {
    const el = (await fixture(html`<lr-flag src="javascript:alert(1)"></lr-flag>`)) as LyraFlag;
    expect((el.shadowRoot!.querySelector('img')) == null).to.equal(true);
    expect((el.shadowRoot!.querySelector('[part="error"]')) == null).to.be.false;
    expect(el.hasAttribute('data-error')).to.be.true;
    expect(el.getAttribute('aria-busy')).to.equal('false');
    expect(assertiveAnnouncements(), 'initial state is not a live transition').to.deep.equal([]);
  });

  it('falls back to country/language resolution once src is cleared', async () => {
    const el = (await fixture(html`<lr-flag src=${TEST_FLAG_SRC} country="fr"></lr-flag>`)) as LyraFlag;
    expect(el.shadowRoot!.querySelector('img')!.getAttribute('src')).to.equal(TEST_FLAG_SRC);

    el.src = undefined;
    await el.updateComplete;
    expect(el.getAttribute('aria-busy')).to.equal('true'); // now resolving country="fr" via the peer package

    const image = await img(el);
    expect(image.getAttribute('src')).to.contain('fr.svg');
  });

  it('treats an explicitly empty src as absent so it cannot mask country resolution', async () => {
    const el = await fixture<LyraFlag>(html`<lr-flag src="" country="fr"></lr-flag>`);
    expect((await img(el)).getAttribute('src')).to.contain('fr.svg');
  });

  it('switching src to a new value enters a fresh native loading transaction', async () => {
    const el = (await fixture(html`<lr-flag src=${TEST_FLAG_SRC} label="A"></lr-flag>`)) as LyraFlag;
    await img(el);
    el.src = TEST_FLAG_SRC_REPLACEMENT;
    await el.updateComplete;
    expect(el.getAttribute('aria-busy')).to.equal('true');
    expect((await img(el)).getAttribute('src')).to.equal(TEST_FLAG_SRC_REPLACEMENT);
    expect(el.getAttribute('aria-busy')).to.equal('false');
  });
});

it('rejects a path-traversal-shaped country value instead of passing it to the flag resolver', async () => {
  const el = (await fixture(html`<lr-flag country="../../etc"></lr-flag>`)) as LyraFlag;
  // Give the (real, unstubbed) peer-package resolver every chance to run —
  // an un-validated `country` would resolve to a live <img> pointing outside
  // the intended flags/ directory; a validated one is treated as unknown and
  // never calls the resolver at all, so no <img> ever appears.
  await aTimeout(50);
  expect((el.shadowRoot!.querySelector('img')) == null).to.equal(true);
  expect(el.getAttribute('aria-busy')).to.equal('false');
});

it('rejects a path-traversal-shaped language region subtag instead of passing it to the flag resolver', async () => {
  const el = (await fixture(html`<lr-flag language="xx-.."></lr-flag>`)) as LyraFlag;
  // Same escape as the country test above, reached via `language`'s region
  // subtag instead: an un-validated region would resolve to a live <img>
  // pointing outside the intended flags/ directory.
  await aTimeout(50);
  expect((el.shadowRoot!.querySelector('img')) == null).to.equal(true);
  expect(el.getAttribute('aria-busy')).to.equal('false');
});

it('uses a human-readable region name as the default alt text', async () => {
  const el = (await fixture(html`<lr-flag country="fr"></lr-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('alt')).to.equal(
    new Intl.DisplayNames([navigator.language], { type: 'region' }).of('FR'),
  );
});

it('falls back to the uppercase region code when Intl.DisplayNames rejects the code', async () => {
  const original = Intl.DisplayNames.prototype.of;
  Intl.DisplayNames.prototype.of = function (this: Intl.DisplayNames, code: string) {
    if (code === 'FR') throw new RangeError('region data unavailable');
    return original.call(this, code);
  };
  try {
    const el = (await fixture(html`
      <lr-flag country="fr" src=${TEST_FLAG_SRC}></lr-flag>
    `)) as LyraFlag;
    expect((await img(el)).getAttribute('alt')).to.equal('FR');
  } finally {
    Intl.DisplayNames.prototype.of = original;
  }
});

it('still prefers an explicit label over the derived display name', async () => {
  const el = (await fixture(html`<lr-flag country="fr" label="French flag"></lr-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('alt')).to.equal('French flag');
});

it('maps a language-only tag through to its country display name', async () => {
  const el = (await fixture(html`<lr-flag language="en"></lr-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('alt')).to.equal(
    new Intl.DisplayNames([navigator.language], { type: 'region' }).of('GB'),
  );
});

it('is accessible', async () => {
  const el = (await fixture(html`<lr-flag country="de" label="Deutsch"></lr-flag>`)) as LyraFlag;
  await img(el);
  await expect(el).to.be.accessible();
});

describe('loadFlagUrl (uncached, dependency-injectable)', () => {
  it('resolves the real flagUrl function when the peer package loads', async () => {
    const resolve = await loadFlagUrl(() => import('@aceshooting/lyra-flags'));
    expect(resolve).to.be.a('function');
  });

  it('resolves null when the peer package fails to load, e.g. because it is not installed', async () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    let resolve: Awaited<ReturnType<typeof loadFlagUrl>> | undefined;
    try {
      resolve = await loadFlagUrl(() => Promise.reject(new Error('boom')));
    } finally {
      console.warn = originalWarn;
    }
    expect(resolve).to.equal(null);
  });

  it('warns (rather than throwing) when the peer package fails to load', async () => {
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      await loadFlagUrl(() => Promise.reject(new Error('boom')));
    } finally {
      console.warn = originalWarn;
    }
    expect(calls.length).to.equal(1);
    expect(calls[0]![0]).to.contain('@aceshooting/lyra-flags');
  });

  it('accepts a validated default-shaped peer and rejects malformed capabilities', async () => {
    const fallback = async () => TEST_FLAG_SRC;
    expect(await loadFlagUrl(() => Promise.resolve({ default: { flagUrl: fallback } }))).to.equal(
      fallback,
    );
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      expect(await loadFlagUrl(() => Promise.resolve({ flagUrl: 'not callable' }))).to.equal(null);
      expect(await loadFlagUrl(() => Promise.resolve({}))).to.equal(null);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('fails closed when a peer namespace capability getter throws', async () => {
    const hostile = {};
    Object.defineProperty(hostile, 'flagUrl', {
      get(): never {
        throw new Error('hostile getter');
      },
    });
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      expect(await loadFlagUrl(() => Promise.resolve(hostile))).to.equal(null);
    } finally {
      console.warn = originalWarn;
    }
  });

});

describe('loadBulkFlagUrl (uncached, dependency-injectable)', () => {
  it('resolves the real createFlagUrlResolver-backed function when the peer package loads', async () => {
    const resolve = await loadBulkFlagUrl(() => import('@aceshooting/lyra-flags'));
    expect(resolve).to.be.a('function');
  });

  it('the resolved function behaves like a normal flagUrl resolver', async () => {
    const resolve = await loadBulkFlagUrl(() => import('@aceshooting/lyra-flags'));
    const direct = await loadFlagUrl(() => import('@aceshooting/lyra-flags'));
    expect(await resolve?.('fr')).to.equal(await direct?.('fr'));
    expect(await resolve?.('zz-not-a-real-code')).to.equal(undefined);
  });

  it('resolves null when the peer package fails to load, e.g. because it is not installed', async () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    let resolve: Awaited<ReturnType<typeof loadBulkFlagUrl>> | undefined;
    try {
      resolve = await loadBulkFlagUrl(() => Promise.reject(new Error('boom')));
    } finally {
      console.warn = originalWarn;
    }
    expect(resolve).to.equal(null);
  });

  it('warns (rather than throwing) when the peer package fails to load', async () => {
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      await loadBulkFlagUrl(() => Promise.reject(new Error('boom')));
    } finally {
      console.warn = originalWarn;
    }
    expect(calls.length).to.equal(1);
    expect(calls[0]![0]).to.contain('@aceshooting/lyra-flags');
  });

  it('accepts a validated default-shaped peer and rejects malformed capabilities', async () => {
    const fallback = () => async () => TEST_FLAG_SRC;
    const resolve = await loadBulkFlagUrl(() =>
      Promise.resolve({ default: { createFlagUrlResolver: fallback } }),
    );
    expect(await resolve?.('anything')).to.equal(TEST_FLAG_SRC);
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      expect(
        await loadBulkFlagUrl(() => Promise.resolve({ createFlagUrlResolver: 'not callable' })),
      ).to.equal(null);
      expect(await loadBulkFlagUrl(() => Promise.resolve({}))).to.equal(null);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('fails closed when a peer namespace capability getter throws', async () => {
    const hostile = {};
    Object.defineProperty(hostile, 'createFlagUrlResolver', {
      get(): never {
        throw new Error('hostile getter');
      },
    });
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      expect(await loadBulkFlagUrl(() => Promise.resolve(hostile))).to.equal(null);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('fails closed when a validated peer resolver factory throws during initialization', async () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(' '));
    try {
      const resolved = await loadBulkFlagUrl(() => Promise.resolve({
        createFlagUrlResolver(): never {
          throw new Error('resolver table failed to initialize');
        },
      }));
      expect(resolved).to.equal(null);
      expect(warnings.join(' ')).to.contain('createFlagUrlResolver');
      expect(warnings.join(' ')).to.contain('version mismatch');
    } finally {
      console.warn = originalWarn;
    }
  });
});

describe('flag-peer-bulk-standard.js (tier-committed bulk registration entry)', () => {
  afterEach(() => setFlagUrlResolver(registerLyraFlagPeer()));

  it('registers a bulk resolver that agrees with the ./standard tier entry', async () => {
    const { registerLyraFlagStandardBulkPeer } = await import('./flag-peer-bulk-standard.js');
    const resolve = await registerLyraFlagStandardBulkPeer();
    expect(resolve).to.be.a('function');
    const tierEntry = await loadFlagUrl(() => import('@aceshooting/lyra-flags/standard'));
    expect(await resolve!('fr')).to.equal(await tierEntry!('fr'));
    expect(await resolve!('zz-not-a-real-code')).to.equal(undefined);
  });

  it('resolves an emblem code to the standard asset even when fidelity asks for another tier', async () => {
    const { registerLyraFlagStandardBulkPeer } = await import('./flag-peer-bulk-standard.js');
    const resolve = await registerLyraFlagStandardBulkPeer();
    const tierEntry = await loadFlagUrl(() => import('@aceshooting/lyra-flags/standard'));
    const standardUrl = await tierEntry!('es');
    expect(await resolve!('es', { variant: 'detailed' })).to.equal(standardUrl);
    expect(await resolve!('es', { variant: 'compact' })).to.equal(standardUrl);
  });

  it('renders a mounted flag through the registered resolver, without the peer-failure error', async () => {
    const { registerLyraFlagStandardBulkPeer } = await import('./flag-peer-bulk-standard.js');
    setFlagUrlResolver(registerLyraFlagStandardBulkPeer());
    const el = await fixture<LyraFlag>(html`<lr-flag country="es" fidelity="detailed"></lr-flag>`);
    const tierEntry = await loadFlagUrl(() => import('@aceshooting/lyra-flags/standard'));
    expect((await img(el)).getAttribute('src')).to.equal(await tierEntry!('es'));
    expect(el.shadowRoot!.querySelector('[part="error"]') === null).to.be.true;
  });
});

describe('live resolver registration', () => {
  afterEach(() => setFlagUrlResolver(registerLyraFlagPeer()));

  it('recovers a mounted peer-missing flag as soon as a resolver is registered', async () => {
    const { result: el, warnings } = await captureConsoleWarnings(async () => {
      setFlagUrlResolver(null);
      const mounted = await fixture<LyraFlag>(html`<lr-flag country="fr"></lr-flag>`);
      await waitUntil(() => !!mounted.shadowRoot!.querySelector('[part="error"]'));
      return mounted;
    });
    expect(warnings.length).to.equal(1);

    setFlagUrlResolver(async () => TEST_FLAG_SRC);
    const image = await img(el);
    expect(image.getAttribute('src')).to.equal(TEST_FLAG_SRC);
    expect(el.hasAttribute('data-error')).to.be.false;
  });

  it('ignores an old resolver result after a new resolver generation wins', async () => {
    let settleOld: ((value: string) => void) | undefined;
    setFlagUrlResolver(
      () => new Promise<string>((resolve) => {
        settleOld = resolve;
      }),
    );
    const el = await fixture<LyraFlag>(html`<lr-flag country="fr"></lr-flag>`);
    await waitUntil(() => settleOld !== undefined);

    setFlagUrlResolver(async () => TEST_FLAG_SRC_REPLACEMENT);
    expect((await img(el)).getAttribute('src')).to.equal(TEST_FLAG_SRC_REPLACEMENT);
    settleOld!(TEST_FLAG_SRC);
    await aTimeout(20);
    expect(el.shadowRoot!.querySelector('img')!.getAttribute('src')).to.equal(
      TEST_FLAG_SRC_REPLACEMENT,
    );
  });

  it('observes the latest resolver generation after reconnect', async () => {
    const { result: el, warnings } = await captureConsoleWarnings(async () => {
      setFlagUrlResolver(null);
      const mounted = await fixture<LyraFlag>(html`<lr-flag country="fr"></lr-flag>`);
      await waitUntil(() => !!mounted.shadowRoot!.querySelector('[part="error"]'));
      return mounted;
    });
    expect(warnings.length).to.equal(1);
    const parent = el.parentElement!;
    el.remove();
    setFlagUrlResolver(async () => TEST_FLAG_SRC);
    parent.append(el);
    expect((await img(el)).getAttribute('src')).to.equal(TEST_FLAG_SRC);
  });
});

describe('connection-scoped source transactions', () => {
  afterEach(() => setFlagUrlResolver(registerLyraFlagPeer()));

  it('does not resolve a country written while detached and restarts it after reconnect', async () => {
    let calls = 0;
    setFlagUrlResolver(async () => {
      calls++;
      return TEST_FLAG_SRC;
    });
    const el = await fixture<LyraFlag>(html`<lr-flag></lr-flag>`);
    const parent = el.parentElement!;
    el.remove();
    el.country = 'fr';
    await el.updateComplete;
    await aTimeout(0);
    expect(calls).to.equal(0);
    expect(el.shadowRoot!.querySelector('img') === null).to.be.true;

    parent.append(el);
    await waitUntil(() => calls === 1);
    expect((await img(el)).getAttribute('src')).to.equal(TEST_FLAG_SRC);
  });

  it('does not render a direct source written while detached and starts it after reconnect', async () => {
    const el = await fixture<LyraFlag>(html`<lr-flag></lr-flag>`);
    const parent = el.parentElement!;
    el.remove();
    el.src = '/detached-flag.svg';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('img') === null).to.be.true;

    parent.append(el);
    await el.updateComplete;
    const current = el.shadowRoot!.querySelector('img')!;
    expect(current.getAttribute('src')).to.equal('/detached-flag.svg');
    current.dispatchEvent(new Event('load'));
    await el.updateComplete;
    expect(el.getAttribute('aria-busy')).to.equal('false');
  });

  it('ignores a peer result that settles detached and starts a fresh request on reconnect', async () => {
    const resolvers: Array<(value: string) => void> = [];
    setFlagUrlResolver(
      () => new Promise<string>((resolve) => resolvers.push(resolve)),
    );
    const el = await fixture<LyraFlag>(html`<lr-flag country="fr"></lr-flag>`);
    await waitUntil(() => resolvers.length === 1);
    const parent = el.parentElement!;
    el.remove();
    resolvers[0]!(TEST_FLAG_SRC);
    await aTimeout(20);
    expect(el.shadowRoot!.querySelector('img') === null).to.be.true;

    parent.append(el);
    await waitUntil(() => resolvers.length === 2);
    resolvers[1]!(TEST_FLAG_SRC_REPLACEMENT);
    expect((await img(el)).getAttribute('src')).to.equal(TEST_FLAG_SRC_REPLACEMENT);
  });

  it('ignores native terminal events delivered detached and remounts the image on reconnect', async () => {
    const el = await fixture<LyraFlag>(html`<lr-flag src="/pending-flag.svg"></lr-flag>`);
    const firstImage = el.shadowRoot!.querySelector('img')!;
    const parent = el.parentElement!;
    el.remove();
    firstImage.dispatchEvent(new Event('error'));
    expect(el.hasAttribute('data-error')).to.be.false;

    parent.append(el);
    await el.updateComplete;
    const current = el.shadowRoot!.querySelector('img')!;
    expect(current === firstImage).to.be.false;
    current.dispatchEvent(new Event('load'));
    await el.updateComplete;
    expect(el.getAttribute('aria-busy')).to.equal('false');
    expect(current.hasAttribute('hidden')).to.be.false;
  });
});

it('keeps stale native image terminal events from mutating a replacement request', async () => {
  const el = await fixture<LyraFlag>(html`<lr-flag src="/old-flag.svg"></lr-flag>`);
  const oldImage = el.shadowRoot!.querySelector('img')!;
  el.src = TEST_FLAG_SRC;
  await el.updateComplete;
  const replacement = el.shadowRoot!.querySelector('img')!;
  expect(replacement === oldImage).to.be.false;

  oldImage.dispatchEvent(new Event('error'));
  expect(el.hasAttribute('data-error')).to.be.false;
  replacement.dispatchEvent(new Event('load'));
  await el.updateComplete;
  expect(el.getAttribute('aria-busy')).to.equal('false');
  expect(el.shadowRoot!.querySelector('img')!.hasAttribute('hidden')).to.be.false;
});

it('rejects an A-to-B-to-A stale native event even when the source identity repeats', async () => {
  const el = await fixture<LyraFlag>(html`<lr-flag src="/same-flag.svg"></lr-flag>`);
  const firstA = el.shadowRoot!.querySelector('img')!;

  el.src = '/middle-flag.svg';
  await el.updateComplete;
  el.src = '/same-flag.svg';
  await el.updateComplete;
  const currentA = el.shadowRoot!.querySelector('img')!;
  expect(currentA === firstA).to.be.false;

  firstA.dispatchEvent(new Event('error'));
  firstA.dispatchEvent(new Event('load'));
  await el.updateComplete;
  expect(el.hasAttribute('data-error')).to.be.false;
  expect(el.getAttribute('aria-busy')).to.equal('true');
  expect(currentA.hasAttribute('hidden')).to.be.true;

  currentA.dispatchEvent(new Event('load'));
  await el.updateComplete;
  expect(el.getAttribute('aria-busy')).to.equal('false');
  expect(currentA.hasAttribute('hidden')).to.be.false;
});

it('keeps the still-loading image out of the layout instead of painting a second box below the skeleton', async () => {
  const el = await fixture<LyraFlag>(html`<lr-flag src="/pending-flag.svg"></lr-flag>`);
  const image = el.shadowRoot!.querySelector('img')!;
  expect(image.hasAttribute('hidden')).to.be.true;
  // The attribute alone proves nothing: [part='image'] declares display: block unconditionally,
  // and an author-origin declaration outranks the UA stylesheet's own [hidden] { display: none }
  // whatever their specificities. Assert the painted box, which is what a user sees.
  expect(getComputedStyle(image).visibility).to.equal('hidden');
  expect(el.shadowRoot!.querySelectorAll('lr-skeleton').length).to.equal(1);
  const hostBox = el.getBoundingClientRect();
  const loadingBox = image.getBoundingClientRect();
  expect(Math.round(loadingBox.top)).to.equal(Math.round(hostBox.top));
  expect(Math.round(loadingBox.bottom)).to.equal(Math.round(hostBox.bottom));
  // display: none would satisfy every assertion above and still be wrong: the img is
  // loading="lazy", and Chromium never starts a lazy fetch for an element that generates no box,
  // so the load event below would never arrive in a real browser.
  expect(getComputedStyle(image).display).to.equal('block');

  image.dispatchEvent(new Event('load'));
  await el.updateComplete;
  expect(image.hasAttribute('hidden')).to.be.false;
  expect(getComputedStyle(image).visibility).to.equal('visible');
  expect(image.getClientRects().length).to.equal(1);
  const loadedBox = image.getBoundingClientRect();
  expect(Math.round(loadedBox.width)).to.equal(Math.round(hostBox.width));
  expect(Math.round(loadedBox.height)).to.equal(Math.round(hostBox.height));
});

it('turns a current native image failure into the localized contained error state', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <span style="display:inline">before <lr-flag src="/broken.svg"></lr-flag> after</span>
  `);
  const flag = wrapper.querySelector('lr-flag') as LyraFlag;
  flag.shadowRoot!.querySelector('img')!.dispatchEvent(new Event('error'));
  await flag.updateComplete;
  expect(flag.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Flag unavailable');
  expect(flag.getAttribute('aria-busy')).to.equal('false');
  expect(flag.hasAttribute('data-error')).to.be.true;
  expect(getComputedStyle(flag).aspectRatio).to.equal('auto');
  expect(getComputedStyle(flag).lineHeight).to.not.equal('0px');
});

it('grows a circle-shaped flag to contain its error text on both axes instead of clipping it to the fixed circle size', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="inline-size:200px;max-inline-size:100%;">
      before
      <lr-flag src="/broken-circle.svg" shape="circle"></lr-flag>
      after
    </div>
  `);
  const flag = wrapper.querySelector('lr-flag') as LyraFlag;
  flag.shadowRoot!.querySelector('img')!.dispatchEvent(new Event('error'));
  await flag.updateComplete;

  const error = flag.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(error.textContent).to.equal('Flag unavailable');

  const flagRect = flag.getBoundingClientRect();
  const errorRect = error.getBoundingClientRect();
  // The circle sizing rule must not win over the error-state auto sizing: the host's own
  // rendered box has to actually contain its error text on BOTH axes, not just horizontally.
  expect(flagRect.top, 'error text top stays within the host box').to.be.at.most(errorRect.top + 0.5);
  expect(flagRect.bottom, 'error text bottom stays within the host box').to.be.at.least(errorRect.bottom - 0.5);
  expect(flagRect.left, 'error text left stays within the host box').to.be.at.most(errorRect.left + 0.5);
  expect(flagRect.right, 'error text right stays within the host box').to.be.at.least(errorRect.right - 0.5);
});

it('keeps the non-error circle shape a fixed square, unaffected by the error-state sizing fix', async () => {
  const el = await fixture<LyraFlag>(html`<lr-flag src=${TEST_FLAG_SRC} shape="circle"></lr-flag>`);
  await el.updateComplete;
  const style = getComputedStyle(el);
  expect(el.hasAttribute('data-error')).to.be.false;
  // The circle sizing rule pins both axes to the same 1em value directly (not via
  // aspect-ratio), so a fixed, equal block/inline size is the byte-identical behavior to
  // preserve -- unaffected by scoping that rule to the non-error state.
  expect(style.blockSize).to.equal(style.inlineSize);
  expect(style.blockSize).to.not.equal('auto');
});

it('contains long localized error copy at narrow LTR/RTL widths for both shapes', async () => {
  const message = 'Unavailable '.repeat(80);
  for (const direction of ['ltr', 'rtl'] as const) {
    for (const shape of ['rect', 'circle'] as const) {
      const wrapper = await fixture<HTMLElement>(html`
        <div dir=${direction} style="inline-size:319px;max-inline-size:100%;">
          before
          <lr-flag
            src="javascript:blocked"
            shape=${shape}
            .strings=${{ flagLoadError: message }}
          ></lr-flag>
          after
        </div>
      `);
      const flag = wrapper.querySelector('lr-flag') as LyraFlag;
      // The blocked-scheme rejection lands the error branch asynchronously, so wait for it the
      // same way every other error-state test here does. Reading straight through leaves a
      // getComputedStyle(null) TypeError on whichever engine loses the race.
      await waitUntil(
        () => !!flag.shadowRoot!.querySelector('[part="error"]'),
        'the flag never rendered its error branch',
      );
      const error = flag.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
      const wrapperRect = wrapper.getBoundingClientRect();
      const errorRect = error.getBoundingClientRect();
      expect(wrapper.scrollWidth, `${direction}/${shape} wrapper overflow`).to.be.at.most(
        wrapper.clientWidth,
      );
      expect(errorRect.left, `${direction}/${shape} inline start`).to.be.at.least(
        wrapperRect.left - 0.5,
      );
      expect(errorRect.right, `${direction}/${shape} inline end`).to.be.at.most(
        wrapperRect.right + 0.5,
      );
      expect(error.textContent).to.equal(message);
    }
  }
});

describe('a rejected resolver (the willUpdate() .catch() handling)', () => {
  // The real `@aceshooting/lyra-flags` peer's `flagUrl(code)` never actually rejects (an unknown
  // code just resolves `undefined`), so `loadFlagUrl()`'s own try/catch -- which only guards the
  // *import* step -- cannot exercise a resolver function that itself rejects.
  // The public peer-registration seam supplies a rejecting resolver at the exact boundary the
  // component uses, without shipping a test-only runtime export.
  afterEach(() => {
    // Restore the real cached resolver for every later test in this file/suite.
    setFlagUrlResolver(registerLyraFlagPeer());
  });

  it('does not leave an unhandled promise rejection when the resolver function itself rejects, matching the baseline (peer-missing) behavior of resolving to loading=false', async () => {
    setFlagUrlResolver(
      async () => {
        throw new Error('network failure');
      },
    );
    let caught: unknown;
    const onUnhandled = (e: PromiseRejectionEvent) => (caught = e.reason);
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(' '));
    window.addEventListener('unhandledrejection', onUnhandled);
    let el!: LyraFlag;
    try {
      el = (await fixture(html`<lr-flag country="fr"></lr-flag>`)) as LyraFlag;
      // Give the rejection every chance to surface as an unhandled rejection before asserting.
      await aTimeout(50);
    } finally {
      window.removeEventListener('unhandledrejection', onUnhandled);
      console.warn = originalWarn;
    }
    expect(caught, 'no unhandledrejection event should have fired').to.be.undefined;
    expect(warnings.join('\n')).to.include('failed to resolve a flag URL for "fr"');
    expect(el.loading).to.be.false;
    expect(el.getAttribute('aria-busy')).to.equal('false');
    expect((el.shadowRoot!.querySelector('img')) == null).to.equal(true);
  });

  it('fails closed visibly and appends each localized resolver failure to the light-DOM sink', async () => {
    setFlagUrlResolver(
      async () => {
        throw new Error('network failure');
      },
    );
    const originalWarn = console.warn;
    console.warn = () => {};
    let el!: LyraFlag;
    try {
      el = (await fixture(html`
        <lr-flag
          country="fr"
          .strings=${{ flagLoadError: 'Impossible de charger le drapeau.' }}
        ></lr-flag>
      `)) as LyraFlag;
      await waitUntil(() => !!el.shadowRoot!.querySelector('[part="error"]'));
      el.country = 'de';
      await el.updateComplete;
      await waitUntil(() => assertiveAnnouncements().length === 2);
    } finally {
      console.warn = originalWarn;
    }
    const error = el.shadowRoot!.querySelector('[part="error"]')!;
    expect(error.getAttribute('role')).to.equal(null);
    expect(error.textContent).to.equal('Impossible de charger le drapeau.');
    expect(assertiveAnnouncements()).to.deep.equal([
      'Impossible de charger le drapeau.',
      'Impossible de charger le drapeau.',
    ]);
  });

  it('renders a real English sentence, not the raw key name, when no locale is registered', async () => {
    // Every other test here supplies `.strings`, which masked a missing DEFAULT_STRINGS entry:
    // resolveLyraString() falls back to the key itself, so [part="error"] read "flagLoadError".
    const { result: el, warnings } = await captureConsoleWarnings(async () => {
      setFlagUrlResolver(null);
      const mounted = (await fixture(html`<lr-flag country="fr"></lr-flag>`)) as LyraFlag;
      await waitUntil(() => !!mounted.shadowRoot!.querySelector('[part="error"]'));
      return mounted;
    });
    expect(warnings.length).to.equal(1);
    const text = el.shadowRoot!.querySelector('[part="error"]')!.textContent!.trim();
    expect(text).to.not.equal('flagLoadError');
    expect(text).to.equal('Flag unavailable');
  });

  it('distinguishes a missing resolver from a valid resolver returning no flag', async () => {
    const { result: missing, warnings } = await captureConsoleWarnings(async () => {
      setFlagUrlResolver(null);
      const mounted = (await fixture(html`
        <lr-flag country="fr" .strings=${{ flagLoadError: 'Flags unavailable.' }}></lr-flag>
      `)) as LyraFlag;
      await waitUntil(() => !!mounted.shadowRoot!.querySelector('[part="error"]'));
      return mounted;
    });
    expect(warnings.length).to.equal(1);
    expect(missing.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal(
      'Flags unavailable.',
    );

    setFlagUrlResolver(async () => undefined);
    const unknown = (await fixture(html`
      <lr-flag country="zz" .strings=${{ flagLoadError: 'Flags unavailable.' }}></lr-flag>
    `)) as LyraFlag;
    await waitUntil(() => !unknown.loading);
    expect((unknown.shadowRoot!.querySelector('[part="error"]')) === (null)).to.equal(true);
    expect((unknown.shadowRoot!.querySelector('img')) === (null)).to.equal(true);
  });

  it('ignores a rejection superseded by a newer country/language/src change (the same resolveToken guard the .then() branch uses), while the still-current call still recovers from its own rejection', async () => {
    const rejecters: Array<(err: unknown) => void> = [];
    setFlagUrlResolver(
      () =>
        new Promise<string | undefined>((_resolve, reject) => {
          rejecters.push(reject);
        }),
    );
    let caught: unknown;
    const onUnhandled = (e: PromiseRejectionEvent) => (caught = e.reason);
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(' '));
    window.addEventListener('unhandledrejection', onUnhandled);
    let el!: LyraFlag;
    try {
      el = (await fixture(html`<lr-flag country="fr"></lr-flag>`)) as LyraFlag;
      await el.updateComplete;
      expect(el.loading, 'still awaiting the fr resolution').to.be.true;

      // Supersede the in-flight 'fr' resolution before it ever settles -- bumps resolveToken.
      el.country = 'de';
      await el.updateComplete;
      expect(el.loading, 'now awaiting the de resolution').to.be.true;
      expect(rejecters.length).to.equal(2);

      // Reject the stale 'fr' call first: the guard must recognize it as superseded and no-op,
      // leaving the still-in-flight 'de' call's loading state untouched.
      rejecters[0]!(new Error('stale fr failure'));
      await aTimeout(20);
      expect(el.loading, 'the stale rejection must not touch loading').to.be.true;

      // Now reject the current 'de' call: its own .catch() branch (token === resolveToken) must
      // still fire and recover to loading=false.
      rejecters[1]!(new Error('de failure'));
      await aTimeout(20);
    } finally {
      window.removeEventListener('unhandledrejection', onUnhandled);
      console.warn = originalWarn;
    }

    expect(caught, 'no unhandledrejection event should have fired').to.be.undefined;
    expect(warnings.join('\n')).to.not.include('stale fr failure');
    expect(warnings.join('\n')).to.include('failed to resolve a flag URL for "de"');
    expect(el.loading).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('img').length).to.equal(0);
  });
});

it('calls super.willUpdate so a future LyraElement/mixin lifecycle hook stays wired in (regression)', async () => {
  // Monkey-patch LyraElement.prototype.willUpdate (the established pattern, e.g.
  // checkbox.test.ts) to prove LyraFlag's own willUpdate() override actually calls
  // super.willUpdate(...) rather than shadowing it silently.
  const proto = LyraElement.prototype as unknown as { willUpdate: (changed: PropertyValues) => void };
  const original = proto.willUpdate;
  let called = false;
  proto.willUpdate = function (this: LyraElement, changed: PropertyValues): void {
    called = true;
    original.call(this, changed);
  };
  try {
    const el = (await fixture(html`<lr-flag></lr-flag>`)) as LyraFlag;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    proto.willUpdate = original;
  }
});

// Regression coverage for the lifecycle-super-call-omitted defect class -- no user-visible
// symptom today, but a future shared updated() behavior on LyraElement would silently never run
// for <lr-flag> if its own override shadows the base hook instead of calling it. Scoped by
// tagName (not the fixture()-returned element reference): <lr-flag> renders an <lr-skeleton>
// child in its shadow DOM while loading, which itself extends LyraElement directly and overrides
// updated() on its own, so an unscoped check risks conflating a *different* element's own call.
// Mirrors map.test.ts's identical "calls super.updated" test.
it('calls super.updated so a future LyraElement/mixin lifecycle hook stays wired in', async () => {
  const proto = LyraElement.prototype as unknown as { updated: (changed: PropertyValues) => void };
  const original = proto.updated;
  let calledOnSelf = false;
  proto.updated = function (this: LyraElement, changed: PropertyValues): void {
    if (this.tagName === 'LR-FLAG') calledOnSelf = true;
    original.call(this, changed);
  };
  try {
    const el = (await fixture(html`<lr-flag country="fr"></lr-flag>`)) as LyraFlag;
    await el.updateComplete;
    expect(calledOnSelf).to.be.true;
  } finally {
    proto.updated = original;
  }
});

it('calls super.adoptedCallback so owner-realm locale and direction caches are invalidated', async () => {
  const proto = LyraElement.prototype;
  const original = proto.adoptedCallback;
  let calledOnSelf = false;
  proto.adoptedCallback = function (this: LyraElement): void {
    if (this.tagName === 'LR-FLAG') calledOnSelf = true;
    original.call(this);
  };
  try {
    const el = (await fixture(html`<lr-flag></lr-flag>`)) as LyraFlag;
    el.adoptedCallback();
    expect(calledOnSelf).to.be.true;
  } finally {
    proto.adoptedCallback = original;
  }
});

describe('alpha-3 country codes and the unresolved fallback', () => {
  // `registerLyraFlagPeer()` takes no arguments -- it only hands back the already-installed
  // `@aceshooting/lyra-flags` resolver -- so passing it a stub object silently discarded it and
  // left these tests running against the real peer package. `setFlagUrlResolver()` is the actual
  // injection seam (same restore idiom as the describes above).
  afterEach(() => setFlagUrlResolver(registerLyraFlagPeer()));

  // A loadable, code-dependent stub asset: the resolved alpha-2 code is embedded in the SVG's
  // <title>, so two codes that map to the same country produce a byte-identical URL and two that
  // do not cannot collide.
  const stubFlagSrc = (code: string) =>
    `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3Ctitle%3E${code}%3C/title%3E%3C/svg%3E`;

  it('resolves an alpha-3 country to the same flag as its alpha-2', async () => {
    // Length alone disambiguates the two ISO 3166-1 code spaces, so no format hint is needed.
    setFlagUrlResolver(async (code: string) => stubFlagSrc(code));
    const alpha3 = (await fixture(html`<lr-flag country="FRA"></lr-flag>`)) as LyraFlag;
    const alpha2 = (await fixture(html`<lr-flag country="fr"></lr-flag>`)) as LyraFlag;
    await waitUntil(() => alpha3.shadowRoot!.querySelector('img') !== null);
    await waitUntil(() => alpha2.shadowRoot!.querySelector('img') !== null);
    const resolved = alpha3.shadowRoot!.querySelector('img')!.getAttribute('src')!;
    expect(
      resolved,
      'alpha-3 reaches the same asset as alpha-2'
    ).to.equal(alpha2.shadowRoot!.querySelector('img')!.getAttribute('src'));
    // Discriminating: two equal strings prove nothing unless the code that reached the resolver is
    // the alpha-2 form.
    expect(
      decodeURIComponent(resolved).includes('<title>fr</title>'),
      'FRA was mapped to fr before the resolver ever saw it'
    ).to.be.true;
  });

  it('marks a code that cannot resolve as unresolved rather than an error', async () => {
    setFlagUrlResolver(async (code: string) => stubFlagSrc(code));
    // SUN is the withdrawn code for the former Soviet Union: real data in a longitudinal dataset,
    // not a mistake, so it must not render error wording.
    const el = (await fixture(html`<lr-flag country="SUN"></lr-flag>`)) as LyraFlag;
    await el.updateComplete;
    expect(el.hasAttribute('data-unresolved'), 'reflects the unresolved state').to.be.true;
    expect(el.hasAttribute('data-error'), 'and is not an error').to.be.false;
    expect(
      el.shadowRoot!.querySelector('[part="error"]') === null,
      'no localized error wording is rendered'
    ).to.be.true;
  });

  it('renders slotted fallback content in place of the flag', async () => {
    setFlagUrlResolver(async (code: string) => stubFlagSrc(code));
    const el = (await fixture(html`
      <lr-flag country="SUN"><span slot="fallback" id="ph">—</span></lr-flag>
    `)) as LyraFlag;
    await el.updateComplete;
    const slot = el.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="fallback"]');
    expect(slot, 'the fallback slot renders').to.exist;
    expect(
      slot!.assignedElements({ flatten: true }).map((node) => node.id),
      'the placeholder is assigned'
    ).to.deep.equal(['ph']);
  });

  it('renders the fallback property as a placeholder image when no slot content is given', async () => {
    setFlagUrlResolver(async (code: string) => stubFlagSrc(code));
    const el = (await fixture(
      html`<lr-flag country="SUN" fallback="/placeholder.svg"></lr-flag>`
    )) as LyraFlag;
    await el.updateComplete;
    const image = el.shadowRoot!.querySelector<HTMLImageElement>('[part="fallback-image"]');
    expect(image, 'placeholder image renders').to.exist;
    expect(image!.getAttribute('src')).to.equal('/placeholder.svg');
  });

  it('sizes and clips a fallback image exactly like the primary image for both flag shapes', async () => {
    setFlagUrlResolver(async (code: string) => stubFlagSrc(code));

    for (const shape of ['rect', 'circle'] as const) {
      const primary = (await fixture(html`
        <lr-flag
          src=${TEST_FLAG_SRC}
          shape=${shape}
          style="font-size: 30px; --lr-flag-object-fit: contain"
        ></lr-flag>
      `)) as LyraFlag;
      const fallback = (await fixture(html`
        <lr-flag
          country="SUN"
          fallback="/placeholder.svg"
          shape=${shape}
          style="font-size: 30px; --lr-flag-object-fit: contain"
        ></lr-flag>
      `)) as LyraFlag;
      await primary.updateComplete;
      await fallback.updateComplete;
      const primaryImage = primary.shadowRoot!.querySelector<HTMLImageElement>('[part="image"]')!;
      const fallbackImage = fallback.shadowRoot!
        .querySelector<HTMLImageElement>('[part="fallback-image"]')!;
      const primaryStyle = getComputedStyle(primaryImage);
      const fallbackStyle = getComputedStyle(fallbackImage);
      const hostBox = fallback.getBoundingClientRect();
      const imageBox = fallbackImage.getBoundingClientRect();

      expect(fallbackStyle.display, `${shape} display`).to.equal(primaryStyle.display);
      expect(fallbackStyle.objectFit, `${shape} object-fit`).to.equal(primaryStyle.objectFit);
      expect(fallbackStyle.borderRadius, `${shape} clipping`).to.equal(primaryStyle.borderRadius);
      expect(imageBox.width, `${shape} inline size`).to.be.closeTo(hostBox.width, 1);
      expect(imageBox.height, `${shape} block size`).to.be.closeTo(hostBox.height, 1);
    }
  });

  it('leaves a resolvable code untouched, so the fallback is inert by default', async () => {
    setFlagUrlResolver(async (code: string) => stubFlagSrc(code));
    const el = (await fixture(
      html`<lr-flag country="fr" fallback="/placeholder.svg"></lr-flag>`
    )) as LyraFlag;
    await waitUntil(() => el.shadowRoot!.querySelector('img[part="image"]') !== null);
    expect(el.hasAttribute('data-unresolved'), 'a real code is never unresolved').to.be.false;
    expect(
      el.shadowRoot!.querySelector('[part="fallback-image"]') === null,
      'the placeholder stays out of the DOM'
    ).to.be.true;
  });
});

describe('missing-resolver diagnostic', () => {
  let originalWarn: typeof console.warn;
  let warnings: string[];

  beforeEach(() => {
    warnings = [];
    originalWarn = console.warn;
    console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(' '));
  });

  afterEach(() => {
    console.warn = originalWarn;
    setFlagUrlResolver(registerLyraFlagPeer());
  });

  it('warns once, naming the code and the peer entry, when no resolver is registered', async () => {
    setFlagUrlResolver(null);
    const el = await fixture<LyraFlag>(html`<lr-flag country="fr"></lr-flag>`);
    await waitUntil(() => !!el.shadowRoot!.querySelector('[part="error"]'));

    expect(warnings.length, 'exactly one warning').to.equal(1);
    expect(warnings[0]).to.contain('fr');
    expect(warnings[0]).to.contain('flag-peer');
  });

  it('warns once for a whole page of unresolvable flags, not once per element', async () => {
    setFlagUrlResolver(null);
    const host = await fixture<HTMLElement>(html`<div>
      <lr-flag country="fr"></lr-flag>
      <lr-flag country="de"></lr-flag>
      <lr-flag country="it"></lr-flag>
    </div>`);
    const flags = Array.from(host.querySelectorAll<LyraFlag>('lr-flag'));
    await Promise.all(
      flags.map((flag) => waitUntil(() => !!flag.shadowRoot!.querySelector('[part="error"]'))),
    );

    expect(warnings.length, 'one warning for three flags').to.equal(1);
  });

  it('never warns when a working resolver is registered', async () => {
    setFlagUrlResolver(async () => TEST_FLAG_SRC);
    const el = await fixture<LyraFlag>(html`<lr-flag country="fr"></lr-flag>`);
    await img(el);

    expect(warnings, 'a registered resolver is not a fault').to.deep.equal([]);
  });

  it('never warns for a pre-resolved src', async () => {
    setFlagUrlResolver(null);
    const el = await fixture<LyraFlag>(
      html`<lr-flag src=${TEST_FLAG_SRC} label="Test"></lr-flag>`,
    );
    await el.updateComplete;
    await aTimeout(20);

    expect(warnings, 'src bypasses the resolver entirely').to.deep.equal([]);
  });

  it('never warns for a well-formed but unmapped code, which is data rather than a defect', async () => {
    setFlagUrlResolver(null);
    const el = await fixture<LyraFlag>(html`<lr-flag country="ZZZ"></lr-flag>`);
    await el.updateComplete;
    await aTimeout(20);

    expect(el.hasAttribute('data-unresolved'), 'still reflects the unresolved state').to.be.true;
    expect(warnings, 'an unmapped code must stay silent').to.deep.equal([]);
  });
});

// A peer that is INSTALLED but too old to carry the capability is a different failure from a peer
// that is not installed at all, and the two were reported identically: "install it with `pnpm add
// @aceshooting/lyra-flags`" — advice a reader has already followed. That matters more from this
// release on, because the bulk-standard entry point requires `createFlagUrlResolver` on the
// tier-committed subpath, which older peers do not export; a consumer who upgrades lyra-ui while
// pinning the peer lands here, and the generic message sends them to look for the wrong problem.
describe('peer capability diagnostics', () => {
  function captureWarnings(): { calls: unknown[][]; restore: () => void } {
    const calls: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => calls.push(args);
    return { calls, restore: () => { console.warn = originalWarn; } };
  }

  it('distinguishes an absent peer from one that loaded without the bulk capability', async () => {
    const absent = captureWarnings();
    try {
      await loadBulkFlagUrl(() => Promise.reject(new Error('Cannot find module')));
    } finally {
      absent.restore();
    }
    const outdated = captureWarnings();
    try {
      await loadBulkFlagUrl(() => Promise.resolve({ flagUrl: () => '/x.svg' }));
    } finally {
      outdated.restore();
    }

    expect(absent.calls.length).to.equal(1);
    expect(outdated.calls.length).to.equal(1);
    const absentText = String(absent.calls[0]![0]);
    const outdatedText = String(outdated.calls[0]![0]);
    expect(absentText, 'an absent peer is still told to install it').to.contain('install');
    expect(
      outdatedText,
      'an installed-but-incapable peer must not be told to install what it already has',
    ).to.not.contain('install it with');
    expect(outdatedText).to.contain('createFlagUrlResolver');
    expect(outdatedText, 'and must say the package is present').to.contain('installed');
  });

  it('makes the same distinction for the per-code resolver', async () => {
    const outdated = captureWarnings();
    try {
      await loadFlagUrl(() => Promise.resolve({ somethingElse: 1 }));
    } finally {
      outdated.restore();
    }
    expect(outdated.calls.length).to.equal(1);
    expect(String(outdated.calls[0]![0])).to.contain('flagUrl');
    expect(String(outdated.calls[0]![0])).to.not.contain('install it with');
  });
});
