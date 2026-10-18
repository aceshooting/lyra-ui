import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './video-playlist.js';
import type { LyraVideoPlaylist } from './video-playlist.class.js';
it('does not inspect obsolete seed metadata after direct children take ownership', async () => {
  let reads = 0;
  const seed = Array.from({ length: 12000 }, () => ({ title: 'Seed' }));
  const items = new Proxy(seed, { get(target, key, receiver) { if (typeof key === 'string' && /^\d+$/.test(key)) reads++; return Reflect.get(target, key, receiver); } });
  const host = await fixture<LyraVideoPlaylist>(html`<lr-video-playlist .items=${items}><lr-video title="Live"></lr-video></lr-video-playlist>`);
  await nextFrame(); await host.updateComplete; reads = 0;
  host.requestUpdate(); await host.updateComplete;
  expect(reads).to.equal(0);
  expect(host.shadowRoot!.querySelectorAll('[part="playlist-item"]').length).to.equal(1);
  recordScaleMeasurement('lr-video-playlist', 'n=12000 inactive seed render', { reads, mounted: host.shadowRoot!.querySelectorAll('[part="playlist-item"]').length });
  host.querySelector('lr-video')!.remove(); await nextFrame(); await host.updateComplete;
  expect(host.shadowRoot!.querySelectorAll('[part="playlist-item"]').length).to.equal(0);
});
