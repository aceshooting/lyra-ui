import { fixture, expect, html, waitUntil, aTimeout } from '@open-wc/testing';
import './flag.js';
import { loadFlagUrl } from './flag.js';
import type { LyraFlag } from './flag.js';

async function img(el: LyraFlag): Promise<HTMLImageElement> {
  // Resolving a flag now involves two sequential dynamic imports on a cold start (the
  // `@aceshooting/lyra-flags` peer package, then that specific code's own lazy loader module —
  // see flag.ts's bundle-size note) instead of one, so give this more headroom than the
  // library default (1000ms) to avoid flaking under load.
  await waitUntil(() => el.shadowRoot!.querySelector('img'), 'flag image should render', { timeout: 3000 });
  return el.shadowRoot!.querySelector('img')!;
}

it('shows a loading skeleton and aria-busy while the flag package loads, and ignores a stale resolution once the code is cleared first', async () => {
  const el = (await fixture(html`<lyra-flag country="fr"></lyra-flag>`)) as LyraFlag;
  expect(el.getAttribute('aria-busy')).to.equal('true');
  expect(el.shadowRoot!.querySelector('lyra-skeleton')).to.exist;
  expect(el.shadowRoot!.querySelector('img')).to.not.exist;

  // Clear the code while the (real, unstubbed) first-ever peer-package
  // resolution for 'fr' is still in flight -- this is the very first fixture
  // in the suite, so `@aceshooting/lyra-flags`'s dynamic import genuinely
  // hasn't settled yet (proven by the aria-busy assertion above).
  el.country = '';
  await el.updateComplete;
  expect(el.hasAttribute('aria-busy')).to.be.false;
  expect(el.shadowRoot!.querySelector('lyra-skeleton')).to.not.exist;
  expect(el.shadowRoot!.querySelector('img')).to.not.exist;

  // Give the original 'fr' resolution every chance to land. A correctly
  // token-guarded implementation recognizes it as superseded and no-ops; a
  // buggy one overwrites the cleared state with the stale flag.
  await aTimeout(200);
  expect(el.shadowRoot!.querySelector('img')).to.not.exist;
  expect(el.hasAttribute('aria-busy')).to.be.false;
});

it('renders an img for a country code', async () => {
  const el = (await fixture(html`<lyra-flag country="fr"></lyra-flag>`)) as LyraFlag;
  const el2 = await img(el);
  expect(el2.getAttribute('src')).to.contain('fr.svg');
  expect(el2.getAttribute('alt')).to.equal(
    new Intl.DisplayNames([navigator.language], { type: 'region' }).of('FR'),
  );
  expect(el.hasAttribute('aria-busy')).to.be.false;
});

it('re-resolves the flag when country changes on an already-mounted element', async () => {
  const el = (await fixture(html`<lyra-flag country="fr"></lyra-flag>`)) as LyraFlag;
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
  const el = (await fixture(html`<lyra-flag country="fr" language="en"></lyra-flag>`)) as LyraFlag;
  const el2 = await img(el);
  expect(el2.getAttribute('src')).to.contain('fr.svg');
  expect(el2.getAttribute('alt')).to.equal(
    new Intl.DisplayNames([navigator.language], { type: 'region' }).of('FR'),
  );
});

it('requests the detailed (pre-optimization) variant for a code that has one', async () => {
  const el = (await fixture(html`<lyra-flag country="es" detailed></lyra-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('src')).to.contain('/detailed/es.svg');
});

it('falls back to the default variant when detailed is set but the code has none', async () => {
  const el = (await fixture(html`<lyra-flag country="fr" detailed></lyra-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('src')).to.contain('fr.svg');
  expect(image.getAttribute('src')).to.not.contain('/detailed/');
});

it('re-resolves to the detailed variant when detailed is toggled on an already-mounted element', async () => {
  const el = (await fixture(html`<lyra-flag country="es"></lyra-flag>`)) as LyraFlag;
  const first = await img(el);
  expect(first.getAttribute('src')).to.not.contain('/detailed/');

  el.detailed = true;
  await waitUntil(
    () => el.shadowRoot!.querySelector('img')?.getAttribute('src')?.includes('/detailed/es.svg'),
    'flag image should update to the detailed variant',
  );
});

it('requests the compact (WebP raster) variant for a code that has one', async () => {
  const el = (await fixture(html`<lyra-flag country="es" variant="compact"></lyra-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('src')).to.contain('/compact/es.webp');
});

it('falls back to the standard variant when compact is set but the code has none', async () => {
  const el = (await fixture(html`<lyra-flag country="fr" variant="compact"></lyra-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('src')).to.contain('fr.svg');
  expect(image.getAttribute('src')).to.not.contain('/compact/');
});

it('variant="detailed" resolves the detailed vector, like the deprecated boolean', async () => {
  const el = (await fixture(html`<lyra-flag country="es" variant="detailed"></lyra-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('src')).to.contain('/detailed/es.svg');
});

it('variant takes precedence over the deprecated detailed boolean', async () => {
  const el = (await fixture(html`<lyra-flag country="es" variant="compact" detailed></lyra-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('src')).to.contain('/compact/es.webp');
  expect(image.getAttribute('src')).to.not.contain('/detailed/');
});

it('re-resolves to the compact variant when variant is set on an already-mounted element', async () => {
  const el = (await fixture(html`<lyra-flag country="es"></lyra-flag>`)) as LyraFlag;
  const first = await img(el);
  expect(first.getAttribute('src')).to.not.contain('/compact/');

  el.variant = 'compact';
  await waitUntil(
    () => el.shadowRoot!.querySelector('img')?.getAttribute('src')?.includes('/compact/es.webp'),
    'flag image should update to the compact variant',
  );
});

it('reflects the round attribute', async () => {
  const el = (await fixture(html`<lyra-flag country="fr" round></lyra-flag>`)) as LyraFlag;
  expect(el.round).to.be.true;
  expect(el.hasAttribute('round')).to.be.true;

  el.round = false;
  await el.updateComplete;
  expect(el.hasAttribute('round')).to.be.false;
});

it('reflects the detailed attribute', async () => {
  const el = (await fixture(html`<lyra-flag country="es" detailed></lyra-flag>`)) as LyraFlag;
  expect(el.detailed).to.be.true;
  expect(el.hasAttribute('detailed')).to.be.true;

  el.detailed = false;
  await el.updateComplete;
  expect(el.hasAttribute('detailed')).to.be.false;
});

it('resolves a language to a representative country flag', async () => {
  const el = (await fixture(html`<lyra-flag language="en"></lyra-flag>`)) as LyraFlag;
  expect((await img(el)).getAttribute('src')).to.contain('gb.svg');
});

it('resolves a region subtag to its country', async () => {
  const el = (await fixture(html`<lyra-flag language="en-US"></lyra-flag>`)) as LyraFlag;
  expect((await img(el)).getAttribute('src')).to.contain('us.svg');
});

it('honors a custom label for accessibility', async () => {
  const el = (await fixture(html`<lyra-flag country="fr" label="Français"></lyra-flag>`)) as LyraFlag;
  expect((await img(el)).getAttribute('alt')).to.equal('Français');
});

it('renders nothing for unknown input', async () => {
  const el = (await fixture(html`<lyra-flag></lyra-flag>`)) as LyraFlag;
  expect(el.shadowRoot!.querySelector('img')).to.not.exist;
});

describe('src (pre-resolved URL, bypasses the peer-package lookup)', () => {
  it('renders immediately with no loading state, ignoring country/language', async () => {
    const el = (await fixture(
      html`<lyra-flag src="/custom/flag.svg" country="fr" label="Custom"></lyra-flag>`,
    )) as LyraFlag;
    // No `await img(el)`/`waitUntil` needed: src bypasses the async peer-package
    // round trip entirely, so the <img> is present on the very first render.
    expect(el.hasAttribute('aria-busy')).to.be.false;
    const image = el.shadowRoot!.querySelector('img');
    expect(image).to.exist;
    expect(image!.getAttribute('src')).to.equal('/custom/flag.svg');
    expect(image!.getAttribute('alt')).to.equal('Custom');
  });

  it('falls back to country/language resolution once src is cleared', async () => {
    const el = (await fixture(html`<lyra-flag src="/custom/flag.svg" country="fr"></lyra-flag>`)) as LyraFlag;
    expect(el.shadowRoot!.querySelector('img')!.getAttribute('src')).to.equal('/custom/flag.svg');

    el.src = undefined;
    await el.updateComplete;
    expect(el.hasAttribute('aria-busy')).to.be.true; // now resolving country="fr" via the peer package

    const image = await img(el);
    expect(image.getAttribute('src')).to.contain('fr.svg');
  });

  it('switching src to a new value updates the image with no loading flash', async () => {
    const el = (await fixture(html`<lyra-flag src="/a.svg" label="A"></lyra-flag>`)) as LyraFlag;
    el.src = '/b.svg';
    await el.updateComplete;
    expect(el.hasAttribute('aria-busy')).to.be.false;
    expect(el.shadowRoot!.querySelector('img')!.getAttribute('src')).to.equal('/b.svg');
  });
});

it('rejects a path-traversal-shaped country value instead of passing it to the flag resolver', async () => {
  const el = (await fixture(html`<lyra-flag country="../../etc"></lyra-flag>`)) as LyraFlag;
  // Give the (real, unstubbed) peer-package resolver every chance to run —
  // an un-validated `country` would resolve to a live <img> pointing outside
  // the intended flags/ directory; a validated one is treated as unknown and
  // never calls the resolver at all, so no <img> ever appears.
  await aTimeout(50);
  expect(el.shadowRoot!.querySelector('img')).to.not.exist;
  expect(el.hasAttribute('aria-busy')).to.be.false;
});

it('rejects a path-traversal-shaped language region subtag instead of passing it to the flag resolver', async () => {
  const el = (await fixture(html`<lyra-flag language="xx-.."></lyra-flag>`)) as LyraFlag;
  // Same escape as the country test above, reached via `language`'s region
  // subtag instead: an un-validated region would resolve to a live <img>
  // pointing outside the intended flags/ directory.
  await aTimeout(50);
  expect(el.shadowRoot!.querySelector('img')).to.not.exist;
  expect(el.hasAttribute('aria-busy')).to.be.false;
});

it('uses a human-readable region name as the default alt text', async () => {
  const el = (await fixture(html`<lyra-flag country="fr"></lyra-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('alt')).to.equal(
    new Intl.DisplayNames([navigator.language], { type: 'region' }).of('FR'),
  );
});

it('still prefers an explicit label over the derived display name', async () => {
  const el = (await fixture(html`<lyra-flag country="fr" label="French flag"></lyra-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('alt')).to.equal('French flag');
});

it('maps a language-only tag through to its country display name', async () => {
  const el = (await fixture(html`<lyra-flag language="en"></lyra-flag>`)) as LyraFlag;
  const image = await img(el);
  expect(image.getAttribute('alt')).to.equal(
    new Intl.DisplayNames([navigator.language], { type: 'region' }).of('GB'),
  );
});

it('is accessible', async () => {
  const el = (await fixture(html`<lyra-flag country="de" label="Deutsch"></lyra-flag>`)) as LyraFlag;
  await img(el);
  await expect(el).to.be.accessible();
});

describe('loadFlagUrl (uncached, dependency-injectable)', () => {
  it('resolves the real flagUrl function when the peer package loads', async () => {
    const resolve = await loadFlagUrl();
    expect(resolve).to.be.a('function');
  });

  it('resolves null when the peer package fails to load, e.g. because it is not installed', async () => {
    const resolve = await loadFlagUrl(() => Promise.reject(new Error('boom')));
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
