import { expect, waitUntil } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { LightboxSourceController } from './lightbox-source.js';
import type { LyraLightboxSource, LyraLightboxImage } from './lightbox-types.js';
import type { LyraSourceRecord } from '../../../data-sources.js';

const image = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/%3E';
const record = (src = image): LyraSourceRecord<LyraLightboxImage> => ({ key: 'a', order: 0, value: { src, alt: 'Current image', caption: 'Current caption' } });
function source(value: unknown = record()): LyraLightboxSource {
  return { revision: 1, images: { count: 1, itemAt: () => value as LyraSourceRecord<LyraLightboxImage> } };
}
function setup() {
  const controllers = new Set<ReactiveController>();
  const host = Object.assign(document.createElement('div'), {
    addController: (value: ReactiveController) => controllers.add(value), removeController: (value: ReactiveController) => controllers.delete(value),
    requestUpdate: () => {}, updateComplete: Promise.resolve(true),
  }) satisfies HTMLElement & ReactiveControllerHost;
  document.body.append(host);
  const control = new LightboxSourceController(host, () => {});
  return { control, dispose: () => { host.remove(); controllers.forEach(value => value.hostDisconnected?.()); } };
}

for (const [name, value] of [['null record', null], ['null image', { ...record(), value: null }], ['empty key', { ...record(), key: '' }]] as const) {
  it(`rejects an image source ${name} without starting an image effect`, async () => {
    const test = setup();
    try {
      expect(test.control.update(source(value), 'en')).to.equal(true); test.control.select(0);
      await waitUntil(() => test.control.state === 'error', 'invalid image descriptor is rejected');
      expect(test.control.image).to.equal(undefined);
    } finally { test.dispose(); }
  });
}

it('recovers from an actual image decode error after replacing the provider', async () => {
  const test = setup();
  try {
    test.control.update(source(record('data:image/png;base64,AA==')), 'en'); test.control.select(0);
    await waitUntil(() => test.control.state === 'error', 'invalid image bytes fail decoding');
    expect(test.control.image).to.equal(undefined);
    test.control.update(source(), 'en'); test.control.retry(0);
    await waitUntil(() => test.control.state === 'ready', 'replacement image decodes');
    expect(test.control.image?.src).to.equal(image); expect(test.control.image?.caption).to.equal('Current caption');
    expect(Object.isFrozen(test.control.image)).to.equal(true);
  } finally { test.dispose(); }
});

it('refreshes a zero-count source on retry and admits a later nonempty provider', async () => {
  const test = setup();
  try {
    test.control.update({ revision: 1, images: { count: 0, itemAt: () => { throw new Error('Empty source read'); } } }, 'en');
    test.control.retry(0); expect(test.control.count).to.equal(0); expect(test.control.state).to.equal('empty');
    test.control.update(source(), 'en'); test.control.select(0);
    await waitUntil(() => test.control.state === 'ready', 'nonempty source recovers after retry');
    expect(test.control.count).to.equal(1);
  } finally { test.dispose(); }
});

it('preserves the source installed by a revision getter before reading obsolete images', async () => {
  const test = setup(); const replacement = source(); let obsoleteReads = 0;
  try {
    const obsolete = { get revision() { test.control.update(replacement, 'fr'); return 1; },
      get images() { obsoleteReads++; return replacement.images; } };
    expect(test.control.update(obsolete, 'en')).to.equal(false);
    expect(obsoleteReads).to.equal(0); expect(test.control.count).to.equal(1);
    test.control.select(0); await waitUntil(() => test.control.state === 'ready', 'replacement retains image authority');
    expect(test.control.image?.alt).to.equal('Current image');
  } finally { test.dispose(); }
});

it('rejects a defined primitive source and clears its error when unset', () => {
  const test = setup();
  try {
    expect(test.control.update(7 as unknown as LyraLightboxSource, 'en')).to.equal(true);
    expect(test.control.state).to.equal('error'); expect(test.control.count).to.equal(0);
    expect(test.control.update(undefined, 'en')).to.equal(true);
    expect(test.control.state).to.equal('empty'); expect(test.control.image).to.equal(undefined);
  } finally { test.dispose(); }
});
