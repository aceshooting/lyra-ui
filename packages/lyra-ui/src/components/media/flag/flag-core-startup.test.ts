import { expect, fixture, fixtureCleanup, html, waitUntil } from '@open-wc/testing';
import './flag.js';
import { setFlagUrlResolver } from './flag-url-resolver.js';
import type { LyraFlag } from './flag.class.js';

const imageUrl = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Crect width="8" height="8" fill="blue"/%3E%3C/svg%3E';

it('reports missing startup registration once and recovers mounted country and language flags when a resolver arrives', async () => {
  const warnings: string[] = [];
  const warn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes('because no flag resolver is registered')) warnings.push(args[0]);
    else warn(...args);
  };
  try {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <lr-flag country="fr"></lr-flag>
      <lr-flag language="fr" .strings=${{ flagLoadError: 'Flags are not ready.' }}></lr-flag>
    </div>`);
    const flags = [...wrapper.querySelectorAll<LyraFlag>('lr-flag')];
    await waitUntil(() => flags.every(flag => flag.shadowRoot?.querySelector('[part="error"]') !== null), 'both flags expose the missing resolver');
    expect(flags.map(flag => flag.shadowRoot!.querySelector('[part="error"]')?.textContent))
      .to.deep.equal(['Flag unavailable', 'Flags are not ready.']);
    expect(flags.map(flag => flag.getAttribute('aria-busy'))).to.deep.equal(['false', 'false']);
    expect(warnings.length).to.equal(1);
    expect(warnings[0]).to.include('flag-peer.js');

    const codes: string[] = [];
    setFlagUrlResolver(async code => { codes.push(code); return imageUrl; });
    await waitUntil(() => flags.every(flag => {
      const image = flag.shadowRoot?.querySelector('img:not([hidden])');
      return image instanceof HTMLImageElement && image.naturalWidth === 8 && !flag.loading;
    }), 'existing flags recover after registration');
    expect(codes).to.deep.equal(['fr']);
    expect(flags.map(flag => flag.shadowRoot!.querySelectorAll('[part="error"]').length)).to.deep.equal([0, 0]);
    expect(flags.map(flag => flag.getAttribute('aria-busy'))).to.deep.equal(['false', 'false']);
    expect(warnings.length).to.equal(1);
  } finally {
    fixtureCleanup();
    setFlagUrlResolver(null);
    console.warn = warn;
  }
});

it('renders an already resolved image without a registered peer', async () => {
  const flag = await fixture<LyraFlag>(html`<lr-flag src=${imageUrl} label="France"></lr-flag>`);
  await waitUntil(() => flag.shadowRoot?.querySelector('img:not([hidden])') !== null && !flag.loading, 'direct image loads');
  const image = flag.shadowRoot!.querySelector('img')!;
  expect(image.naturalWidth).to.equal(8);
  expect(image.alt).to.equal('France');
  expect(flag.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(0);
  expect(flag.getAttribute('aria-busy')).to.equal('false');
});
