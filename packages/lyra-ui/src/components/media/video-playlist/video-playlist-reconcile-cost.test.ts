import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { measureElementArrayLookups } from '../../../../test/element-array-lookup-cost.js';
import './video-playlist.js';
import type { LyraVideoPlaylist } from './video-playlist.class.js';
import type { LyraVideo } from '../video/video.class.js';

interface Reconciliation {
  playlistVideos: LyraVideo[];
  activeVideo: LyraVideo | undefined;
  reconcileChildren(): void;
}

it('reconciles video ownership with linear matching while retaining active identity and restoring removed state', async () => {
  const playlist = await fixture<LyraVideoPlaylist>(html`<lr-video-playlist>
    ${Array.from({ length: 32 }, (_, index) => html`<lr-video id=${`video-${index}`} title=${`Video ${index}`} controls="none"></lr-video>`)}
  </lr-video-playlist>`);
  const model = playlist as unknown as Reconciliation;
  await waitUntil(() => model.playlistVideos.length === 32 && Boolean(model.activeVideo));
  const videos = [...model.playlistVideos];
  await Promise.all(videos.map(video => video.updateComplete));
  const active = model.activeVideo!;
  const native = active.getVideoElement();
  const removed = videos.at(-1)!;
  removed.remove();
  const retained = videos.slice(0, -1).reverse();
  playlist.append(...retained);
  const comparisons = measureElementArrayLookups(videos, () => model.reconcileChildren());
  expect(model.playlistVideos.map(video => video.id)).to.deep.equal(retained.map(video => video.id));
  expect(model.activeVideo?.id).to.equal(active.id);
  expect(active.getVideoElement() === native).to.equal(true);
  expect(removed.controls).to.equal('none');
  expect(removed.hidden).to.equal(false);
  expect(retained.filter(video => !video.hidden).map(video => video.id)).to.deep.equal([active.id]);
  expect(comparisons).to.be.at.most(videos.length * 6);
});
