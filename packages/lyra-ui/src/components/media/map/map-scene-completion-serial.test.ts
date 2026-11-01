import { expect } from '@open-wc/testing';
import { nextPaintFrameSerial } from './map-scene-owner.js';
import { completionUiFixture } from '../../../../test/map-scene-completion-fixtures.js';
import { sceneViewport } from '../../../../test/map-scene-render-fixtures.js';

describe('connection owned completion serial', () => {
  it('claims increasing serials without state accepted or publication notifications', async () => {
    const h = await completionUiFixture(); let notices = 0;
    const releases = [h.owner.subscribeAccepted(() => { notices++; }), h.owner.state.subscribe(() => { notices++; }),
      h.owner.subscribeRenderPublication(() => { notices++; })];
    try {
      const publication = h.owner.captureRenderPublication(), state = h.owner.state.capture();
      expect(h.owner.claimPaintFrameSerial(publication)).to.equal(1); expect(h.owner.claimPaintFrameSerial(publication)).to.equal(2);
      expect(notices).to.equal(0); expect(h.owner.captureRenderPublication()).to.equal(publication); expect(h.owner.state.capture()).to.equal(state);
    } finally { releases.forEach(release => release()); h.close(); }
  });

  it('refuses pending unavailable stale and closed claims without consuming a serial', async () => {
    const h = await completionUiFixture();
    try {
      const old = h.owner.captureRenderPublication(); expect(h.owner.claimPaintFrameSerial(old)).to.equal(1);
      h.owner.invalidatePresentation(); const pending = h.owner.captureRenderPublication();
      expect(h.owner.claimPaintFrameSerial(pending)).to.equal(undefined); expect(h.owner.claimPaintFrameSerial(old)).to.equal(undefined);
      h.owner.failPresentation(pending); expect(h.owner.claimPaintFrameSerial(h.owner.captureRenderPublication())).to.equal(undefined);
      h.owner.invalidatePresentation(); h.resolve(); expect(h.owner.claimPaintFrameSerial(h.owner.captureRenderPublication())).to.equal(2);
      h.owner.close(); expect(h.owner.claimPaintFrameSerial(h.owner.captureRenderPublication())).to.equal(undefined);
    } finally { h.close(); }
  });

  it('preserves high water across backing and allocation replacement while connections remain independent', async () => {
    const h = await completionUiFixture(), next = await completionUiFixture();
    try {
      expect(h.host.claimPaintSerial(h.host.captureInput())).to.equal(1); h.replaceAdapter();
      h.owner.setViewport(undefined); h.owner.setViewport(sceneViewport());
      expect(h.host.claimPaintSerial(h.host.captureInput())).to.equal(2);
      expect(next.host.claimPaintSerial(next.host.captureInput())).to.equal(1);
    } finally { h.close(); next.close(); }
  });

  it('admits the final safe serial once and never wraps or coerces invalid counters', () => {
    expect(nextPaintFrameSerial(Number.MAX_SAFE_INTEGER - 1)).to.equal(Number.MAX_SAFE_INTEGER);
    for (const value of [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, -1, NaN, Infinity, 1.5]) {
      expect(nextPaintFrameSerial(value)).to.equal(undefined);
    }
    expect(nextPaintFrameSerial(0)).to.equal(1);
  });
});
