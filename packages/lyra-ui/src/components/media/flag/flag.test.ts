import { fixture, expect, html, waitUntil, aTimeout } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './flag.js';
import './flag-peer.js';
import { loadFlagUrl, __setFlagUrlResolverForTesting } from './flag.js';
import type { LyraFlag } from './flag.js';
import { LyraElement } from '../../../internal/lyra-element.js';

const TEST_FLAG_SRC = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3C/svg%3E';
const TEST_FLAG_SRC_REPLACEMENT =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg"%3E%3Ccircle cx="1" cy="1" r="1"%3E%3C/circle%3E%3C/svg%3E';

async function img(el: LyraFlag): Promise<HTMLImageElement> {
  // Resolving a flag now involves two sequential dynamic imports on a cold start (the
  // `@aceshooting/lyra-flags` peer package, then that specific code's own lazy loader module —
  // see flag.ts's bundle-size note) instead of one, so give this more headroom than the
  // library default (1000ms) to avoid flaking under load. Even 15000ms can be exhausted by the
  // coverage-instrumented 300+ file run before the two cold dynamic imports receive CPU time —
  // same class of issue as lr-graph's setup and code-block.test.ts's Shiki wait.
  await waitUntil(() => el.shadowRoot!.querySelector('img'), 'flag image should render', { timeout: 45_000 });
  return el.shadowRoot!.querySelector('img')!;
}

it('shows a loading skeleton and aria-busy while the flag package loads, and ignores a stale resolution once the code is cleared first', async () => {
  const el = (await fixture(html`<lr-flag country="fr"></lr-flag>`)) as LyraFlag;
  expect(el.getAttribute('aria-busy')).to.equal('true');
  expect(el.shadowRoot!.querySelector('lr-skeleton')).to.exist;
  expect(el.shadowRoot!.querySelector('img')).to.not.exist;

  // Clear the code while the (real, unstubbed) first-ever peer-package
  // resolution for 'fr' is still in flight -- this is the very first fixture
  // in the suite, so `@aceshooting/lyra-flags`'s dynamic import genuinely
  // hasn't settled yet (proven by the aria-busy assertion above).
  el.country = '';
  await el.updateComplete;
  expect(el.hasAttribute('aria-busy')).to.be.false;
  expect(el.shadowRoot!.querySelector('lr-skeleton')).to.not.exist;
  expect(el.shadowRoot!.querySelector('img')).to.not.exist;

  // Give the original 'fr' resolution every chance to land. A correctly
  // token-guarded implementation recognizes it as superseded and no-ops; a
  // buggy one overwrites the cleared state with the stale flag.
  await aTimeout(200);
  expect(el.shadowRoot!.querySelector('img')).to.not.exist;
  expect(el.hasAttribute('aria-busy')).to.be.false;
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
  expect(el.hasAttribute('aria-busy')).to.be.false;
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

it('requests the detailed (pre-optimization) variant for a code that has one', async () => {
  const el = (await fixture(html`<lr-flag country="es" detailed></lr-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('src')).to.contain('/detailed/es.svg');
});

it('falls back to the default variant when detailed is set but the code has none', async () => {
  const el = (await fixture(html`<lr-flag country="fr" detailed></lr-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('src')).to.contain('fr.svg');
  expect(image.getAttribute('src')).to.not.contain('/detailed/');
});

it('re-resolves to the detailed variant when detailed is toggled on an already-mounted element', async () => {
  const el = (await fixture(html`<lr-flag country="es"></lr-flag>`)) as LyraFlag;
  const first = await img(el);
  expect(first.getAttribute('src')).to.not.contain('/detailed/');

  el.detailed = true;
  await waitUntil(
    () => el.shadowRoot!.querySelector('img')?.getAttribute('src')?.includes('/detailed/es.svg'),
    'flag image should update to the detailed variant',
  );
});

it('requests the compact (WebP raster) variant for a code that has one', async () => {
  const el = (await fixture(html`<lr-flag country="es" variant="compact"></lr-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('src')).to.contain('/compact/es.webp');
});

it('falls back to the standard variant when compact is set but the code has none', async () => {
  const el = (await fixture(html`<lr-flag country="fr" variant="compact"></lr-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('src')).to.contain('fr.svg');
  expect(image.getAttribute('src')).to.not.contain('/compact/');
});

it('variant="detailed" resolves the detailed vector, like the deprecated boolean', async () => {
  const el = (await fixture(html`<lr-flag country="es" variant="detailed"></lr-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('src')).to.contain('/detailed/es.svg');
});

it('variant takes precedence over the deprecated detailed boolean', async () => {
  const el = (await fixture(html`<lr-flag country="es" variant="compact" detailed></lr-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('src')).to.contain('/compact/es.webp');
  expect(image.getAttribute('src')).to.not.contain('/detailed/');
});

it('re-resolves to the compact variant when variant is set on an already-mounted element', async () => {
  const el = (await fixture(html`<lr-flag country="es"></lr-flag>`)) as LyraFlag;
  const first = await img(el);
  expect(first.getAttribute('src')).to.not.contain('/compact/');

  el.variant = 'compact';
  await waitUntil(
    () => el.shadowRoot!.querySelector('img')?.getAttribute('src')?.includes('/compact/es.webp'),
    'flag image should update to the compact variant',
  );
});

it('reflects the round attribute', async () => {
  const el = (await fixture(html`<lr-flag country="fr" round></lr-flag>`)) as LyraFlag;
  expect(el.round).to.be.true;
  expect(el.hasAttribute('round')).to.be.true;

  el.round = false;
  await el.updateComplete;
  expect(el.hasAttribute('round')).to.be.false;
});

it('reflects the detailed attribute', async () => {
  const el = (await fixture(html`<lr-flag country="es" detailed></lr-flag>`)) as LyraFlag;
  expect(el.detailed).to.be.true;
  expect(el.hasAttribute('detailed')).to.be.true;

  el.detailed = false;
  await el.updateComplete;
  expect(el.hasAttribute('detailed')).to.be.false;
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
  const image = el.shadowRoot!.querySelector('img') as HTMLImageElement;
  expect(getComputedStyle(el).aspectRatio).to.equal('2 / 1');
  expect(getComputedStyle(image).objectFit).to.equal('contain');
});

it('renders nothing for unknown input', async () => {
  const el = (await fixture(html`<lr-flag></lr-flag>`)) as LyraFlag;
  expect(el.shadowRoot!.querySelector('img')).to.not.exist;
});

describe('src (pre-resolved URL, bypasses the peer-package lookup)', () => {
  it('renders immediately with no loading state, ignoring country/language', async () => {
    const el = (await fixture(
      html`<lr-flag src=${TEST_FLAG_SRC} country="fr" label="Custom"></lr-flag>`,
    )) as LyraFlag;
    // No `await img(el)`/`waitUntil` needed: src bypasses the async peer-package
    // round trip entirely, so the <img> is present on the very first render.
    expect(el.hasAttribute('aria-busy')).to.be.false;
    const image = el.shadowRoot!.querySelector('img');
    expect(image).to.exist;
    expect(image!.getAttribute('src')).to.equal(TEST_FLAG_SRC);
    expect(image!.getAttribute('alt')).to.equal('Custom');
  });

  it('falls back to country/language resolution once src is cleared', async () => {
    const el = (await fixture(html`<lr-flag src=${TEST_FLAG_SRC} country="fr"></lr-flag>`)) as LyraFlag;
    expect(el.shadowRoot!.querySelector('img')!.getAttribute('src')).to.equal(TEST_FLAG_SRC);

    el.src = undefined;
    await el.updateComplete;
    expect(el.hasAttribute('aria-busy')).to.be.true; // now resolving country="fr" via the peer package

    const image = await img(el);
    expect(image.getAttribute('src')).to.contain('fr.svg');
  });

  it('switching src to a new value updates the image with no loading flash', async () => {
    const el = (await fixture(html`<lr-flag src=${TEST_FLAG_SRC} label="A"></lr-flag>`)) as LyraFlag;
    el.src = TEST_FLAG_SRC_REPLACEMENT;
    await el.updateComplete;
    expect(el.hasAttribute('aria-busy')).to.be.false;
    expect(el.shadowRoot!.querySelector('img')!.getAttribute('src')).to.equal(TEST_FLAG_SRC_REPLACEMENT);
  });
});

it('rejects a path-traversal-shaped country value instead of passing it to the flag resolver', async () => {
  const el = (await fixture(html`<lr-flag country="../../etc"></lr-flag>`)) as LyraFlag;
  // Give the (real, unstubbed) peer-package resolver every chance to run —
  // an un-validated `country` would resolve to a live <img> pointing outside
  // the intended flags/ directory; a validated one is treated as unknown and
  // never calls the resolver at all, so no <img> ever appears.
  await aTimeout(50);
  expect(el.shadowRoot!.querySelector('img')).to.not.exist;
  expect(el.hasAttribute('aria-busy')).to.be.false;
});

it('rejects a path-traversal-shaped language region subtag instead of passing it to the flag resolver', async () => {
  const el = (await fixture(html`<lr-flag language="xx-.."></lr-flag>`)) as LyraFlag;
  // Same escape as the country test above, reached via `language`'s region
  // subtag instead: an un-validated region would resolve to a live <img>
  // pointing outside the intended flags/ directory.
  await aTimeout(50);
  expect(el.shadowRoot!.querySelector('img')).to.not.exist;
  expect(el.hasAttribute('aria-busy')).to.be.false;
});

it('uses a human-readable region name as the default alt text', async () => {
  const el = (await fixture(html`<lr-flag country="fr"></lr-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('alt')).to.equal(
    new Intl.DisplayNames([navigator.language], { type: 'region' }).of('FR'),
  );
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
    expect(calls[0][0]).to.contain('@aceshooting/lyra-flags');
  });
});

describe('a rejected resolver (the willUpdate() .catch() handling)', () => {
  // The real `@aceshooting/lyra-flags` peer's `flagUrl(code)` never actually rejects (an unknown
  // code just resolves `undefined`), so `loadFlagUrl()`'s own try/catch -- which only guards the
  // *import* step -- can't be exercised into the "resolver *function* itself rejects" gap this
  // task fixes. `__setFlagUrlResolverForTesting` swaps in a rejecting resolver at the exact seam
  // `willUpdate()` reads through (`loadFlagUrlResolver()`'s cache) so that gap is directly
  // testable without uninstalling the real peer package.
  afterEach(() => {
    // Restore the real cached resolver for every later test in this file/suite.
    __setFlagUrlResolverForTesting(undefined);
  });

  it('does not leave an unhandled promise rejection when the resolver function itself rejects, matching the baseline (peer-missing) behavior of resolving to loading=false', async () => {
    __setFlagUrlResolverForTesting(
      Promise.resolve(async () => {
        throw new Error('network failure');
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
      // Give the rejection every chance to surface as an unhandled rejection before asserting.
      await aTimeout(50);
    } finally {
      window.removeEventListener('unhandledrejection', onUnhandled);
      console.warn = originalWarn;
    }
    expect(caught, 'no unhandledrejection event should have fired').to.be.undefined;
    expect(warnings.join('\n')).to.include('failed to resolve a flag URL for "fr"');
    expect(el.loading).to.be.false;
    expect(el.hasAttribute('aria-busy')).to.be.false;
    expect(el.shadowRoot!.querySelector('img')).to.not.exist;
  });

  it('fails closed with a localized alert when the resolver rejects', async () => {
    __setFlagUrlResolverForTesting(
      Promise.resolve(async () => {
        throw new Error('network failure');
      }),
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
    } finally {
      console.warn = originalWarn;
    }
    const error = el.shadowRoot!.querySelector('[part="error"]')!;
    expect(error.getAttribute('role')).to.equal('alert');
    expect(error.textContent).to.equal('Impossible de charger le drapeau.');
  });

  it('distinguishes a missing resolver from a valid resolver returning no flag', async () => {
    __setFlagUrlResolverForTesting(Promise.resolve(null));
    const missing = (await fixture(html`
      <lr-flag country="fr" .strings=${{ flagLoadError: 'Flags unavailable.' }}></lr-flag>
    `)) as LyraFlag;
    await waitUntil(() => !!missing.shadowRoot!.querySelector('[part="error"]'));
    expect(missing.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal(
      'Flags unavailable.',
    );

    __setFlagUrlResolverForTesting(Promise.resolve(async () => undefined));
    const unknown = (await fixture(html`
      <lr-flag country="zz" .strings=${{ flagLoadError: 'Flags unavailable.' }}></lr-flag>
    `)) as LyraFlag;
    await waitUntil(() => !unknown.loading);
    expect(unknown.shadowRoot!.querySelector('[part="error"]')).to.equal(null);
    expect(unknown.shadowRoot!.querySelector('img')).to.equal(null);
  });

  it('ignores a rejection superseded by a newer country/language/src change (the same resolveToken guard the .then() branch uses), while the still-current call still recovers from its own rejection', async () => {
    const rejecters: Array<(err: unknown) => void> = [];
    __setFlagUrlResolverForTesting(
      Promise.resolve(
        () =>
          new Promise<string | undefined>((_resolve, reject) => {
            rejecters.push(reject);
          }),
      ),
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
      rejecters[0](new Error('stale fr failure'));
      await aTimeout(20);
      expect(el.loading, 'the stale rejection must not touch loading').to.be.true;

      // Now reject the current 'de' call: its own .catch() branch (token === resolveToken) must
      // still fire and recover to loading=false.
      rejecters[1](new Error('de failure'));
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
