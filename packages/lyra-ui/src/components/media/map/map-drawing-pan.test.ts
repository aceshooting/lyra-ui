import { expect } from '@open-wc/testing';
import { acquireMapDrawingPan } from './map-drawing-pan.js';
import { acquireMapDrawingGesture } from './map-drawing-gesture.js';

function fixture(enabled = true) {
  const calls: string[] = []; let active = enabled;
  const handler = { isEnabled() { calls.push('isEnabled'); return active; }, disable() { calls.push('disable'); active = false; }, enable() { calls.push('enable'); active = true; } };
  const peer = { dragPan: handler };
  return { peer, handler, calls, enabled: () => active, externallyEnable: () => { active = true; } };
}
describe('map drawing native pan lease', () => {
  it('disables an initially enabled native handler and restores it exactly once', () => {
    const h = fixture(); const lease = acquireMapDrawingPan(h.peer, { current: () => true });
    expect(lease.accepted).to.equal(true); expect(h.enabled()).to.equal(false); expect(h.calls.filter(call => call === 'disable').length).to.equal(1);
    expect(lease.release()).to.equal(true); expect(h.enabled()).to.equal(true); expect(lease.release()).to.equal(true);
    expect(h.calls.filter(call => call === 'enable').length).to.equal(1);
  });
  it('preserves an initially authored disabled handler without calling disable or enable', () => {
    const h = fixture(false); const lease = acquireMapDrawingPan(h.peer, { current: () => true });
    expect(lease.accepted).to.equal(true); expect(lease.release()).to.equal(true); expect(h.calls).to.deep.equal(['isEnabled']); expect(h.enabled()).to.equal(false);
  });
  it('accepts inherited native capabilities with their original receivers', () => {
    const handler = Object.create({
      isEnabled(this: { active: boolean }) { return this.active; },
      disable(this: { active: boolean }) { this.active = false; },
      enable(this: { active: boolean }) { this.active = true; },
    }) as { active: boolean };
    handler.active = true;
    const peer = Object.create({ dragPan: handler }) as object;
    const lease = acquireMapDrawingPan(peer, { current: () => true }); expect(lease.accepted).to.equal(true); expect(handler.active).to.equal(false); lease.release(); expect(handler.active).to.equal(true);
  });
  it('rejects unavailable, accessor and non-callable capabilities without evaluating getters', () => {
    let reads = 0;
    for (const peer of [undefined, {}, { get dragPan() { reads++; return {}; } },
      { dragPan: { get isEnabled() { reads++; return () => true; }, disable() {}, enable() {} } },
      { dragPan: { isEnabled: true, disable() {}, enable() {} } }]) {
      const lease = acquireMapDrawingPan(peer, { current: () => true }); expect(lease.accepted).to.equal(false); expect(lease.code).to.equal('unavailable'); lease.release();
    }
    expect(reads).to.equal(0);
  });
  it('does not touch native state for a stale or throwing owner predicate', () => {
    for (const current of [() => false, () => { throw new Error('private'); }]) {
      const h = fixture(); const lease = acquireMapDrawingPan(h.peer, { current });
      expect(lease.accepted).to.equal(false); expect(lease.code).to.equal('stale'); expect(h.calls.length).to.equal(0);
    }
  });
  it('does not restore after map/session generation changes or terminal stale cleanup', () => {
    const h = fixture(); let current = true; const lease = acquireMapDrawingPan(h.peer, { current: () => current });
    current = false; expect(lease.release()).to.equal(false); current = true; expect(lease.release()).to.equal(false);
    expect(h.enabled()).to.equal(false); expect(h.calls.filter(call => call === 'enable').length).to.equal(0);
  });
  it('preserves an intervening external enable and retires only its own disable', () => {
    const h = fixture(); const lease = acquireMapDrawingPan(h.peer, { current: () => true }); h.externallyEnable();
    expect(lease.release()).to.equal(true); expect(h.calls.filter(call => call === 'enable').length).to.equal(0);
    const next = acquireMapDrawingPan(h.peer, { current: () => true }); expect(next.accepted).to.equal(true); next.release();
  });
  it('does not restore a replaced native handler on the same peer', () => {
    const h = fixture(); const lease = acquireMapDrawingPan(h.peer, { current: () => true }); const replacement = fixture(false);
    h.peer.dragPan = replacement.handler; expect(lease.release()).to.equal(false); expect(replacement.enabled()).to.equal(false); expect(h.enabled()).to.equal(false);
  });
  it('rejects a handler replaced synchronously inside disable without mutating its successor', () => {
    const h = fixture(), replacement = fixture(); const disable = h.handler.disable;
    h.handler.disable = () => { disable(); h.peer.dragPan = replacement.handler; };
    const lease = acquireMapDrawingPan(h.peer, { current: () => true }); expect(lease.accepted).to.equal(false); expect(lease.code).to.equal('stale');
    expect(replacement.enabled()).to.equal(true); expect(replacement.calls.length).to.equal(0);
  });
  it('best-effort restores a partially mutating disable throw while still current', () => {
    const h = fixture(); const disable = h.handler.disable;
    h.handler.disable = () => { disable(); throw new Error('private native failure'); };
    const lease = acquireMapDrawingPan(h.peer, { current: () => true });
    expect(lease.accepted).to.equal(false); expect(lease.code).to.equal('peer-error'); expect(h.enabled()).to.equal(true); expect(h.calls.filter(call => call === 'enable').length).to.equal(1);
  });
  it('rejects recursive acquisition from disable and allows acquisition after release', () => {
    const h = fixture(); const disable = h.handler.disable; let nested: ReturnType<typeof acquireMapDrawingPan> | undefined;
    h.handler.disable = () => { nested = acquireMapDrawingPan(h.peer, { current: () => true }); disable(); };
    const lease = acquireMapDrawingPan(h.peer, { current: () => true }); expect(nested?.code).to.equal('reentrant'); expect(lease.accepted).to.equal(true); lease.release();
    h.handler.disable = disable; const next = acquireMapDrawingPan(h.peer, { current: () => true }); expect(next.accepted).to.equal(true); next.release();
  });
  it('performs no stale cleanup when disable reentry cancels generation, even after a partial throw', () => {
    for (const throws of [false, true]) {
      const h = fixture(); let current = true; const disable = h.handler.disable;
      h.handler.disable = () => { disable(); current = false; if (throws) throw new Error('private'); };
      const lease = acquireMapDrawingPan(h.peer, { current: () => current }); expect(lease.accepted).to.equal(false); expect(lease.code).to.equal('stale');
      expect(lease.release()).to.equal(false); expect(h.calls.filter(call => call === 'enable').length).to.equal(0);
    }
  });
  it('guards current ownership after isEnabled and rejects invalid or ineffective native methods', () => {
    const h = fixture(); let current = true; h.handler.isEnabled = () => { current = false; return true; };
    expect(acquireMapDrawingPan(h.peer, { current: () => current }).code).to.equal('stale'); expect(h.calls.length).to.equal(0);
    const invalid = fixture(); invalid.handler.isEnabled = () => 'enabled' as unknown as boolean;
    expect(acquireMapDrawingPan(invalid.peer, { current: () => true }).code).to.equal('peer-error');
    const ineffective = fixture(); ineffective.handler.disable = () => undefined;
    expect(acquireMapDrawingPan(ineffective.peer, { current: () => true }).code).to.equal('peer-error');
  });
  it('fails closed if restoration throws and does not retry after terminal release', () => {
    const h = fixture(); h.handler.enable = () => { throw new Error('private'); }; const lease = acquireMapDrawingPan(h.peer, { current: () => true });
    expect(lease.release()).to.equal(false); expect(lease.release()).to.equal(false); expect(h.enabled()).to.equal(false);
  });
  it('reports ineffective restoration and suppresses later mutations after restoration reentry', () => {
    const ineffective = fixture(); ineffective.handler.enable = () => undefined;
    const failed = acquireMapDrawingPan(ineffective.peer, { current: () => true }); expect(failed.release()).to.equal(false);
    const h = fixture(); let current = true; const enable = h.handler.enable;
    h.handler.enable = () => { enable(); current = false; };
    const lease = acquireMapDrawingPan(h.peer, { current: () => current }); expect(lease.release()).to.equal(false);
    current = true; expect(lease.release()).to.equal(false); expect(h.calls.filter(call => call === 'enable').length).to.equal(1);
  });
  it('coexists with the drawing session zoom lease and restores each handler independently', () => {
    const pan = fixture(), zoom = fixture(); const peer = { dragPan: pan.handler, doubleClickZoom: zoom.handler };
    const session = acquireMapDrawingGesture(peer, { current: () => true });
    const vertex = acquireMapDrawingPan(peer, { current: () => true });
    expect(session.accepted && vertex.accepted).to.equal(true);
    expect(pan.enabled() || zoom.enabled()).to.equal(false);
    expect(vertex.release()).to.equal(true); expect(pan.enabled()).to.equal(true); expect(zoom.enabled()).to.equal(false);
    expect(session.release()).to.equal(true); expect(zoom.enabled()).to.equal(true);
  });
  it('does not restore a retired handler replaced by an isEnabled callback during release', () => {
    const h = fixture(), successor = fixture(false); let replace = false;
    const original = h.handler.isEnabled;
    h.handler.isEnabled = () => { if (replace) h.peer.dragPan = successor.handler; return original(); };
    const lease = acquireMapDrawingPan(h.peer, { current: () => true }); replace = true;
    expect(lease.release()).to.equal(false); expect(h.enabled()).to.equal(false);
    expect(h.calls.filter(call => call === 'enable').length).to.equal(0); expect(successor.calls.length).to.equal(0);
  });
  it('bounds recursive release during enable and rejects a second owner during restoration', () => {
    const h = fixture(); const enable = h.handler.enable; let nested: boolean | undefined;
    let admission: ReturnType<typeof acquireMapDrawingPan> | undefined;
    let currentLease: ReturnType<typeof acquireMapDrawingPan>;
    h.handler.enable = () => { nested = currentLease.release(); admission = acquireMapDrawingPan(h.peer, { current: () => true }); enable(); };
    currentLease = acquireMapDrawingPan(h.peer, { current: () => true });
    expect(currentLease.release()).to.equal(true); expect(nested).to.equal(false); expect(admission?.code).to.equal('reentrant');
    expect(h.enabled()).to.equal(true);
  });
  it('rejects a native handler that is not an object', () => {
    for (const value of [null, 5, 'handler']) {
      const lease = acquireMapDrawingPan({ dragPan: value }, { current: () => true });
      expect(lease.accepted, String(value)).to.equal(false); expect(lease.code, String(value)).to.equal('unavailable');
    }
  });
  it('never touches a replacement handler, wherever the swap lands after the lease captured its own', () => {
    for (const authoredEnabled of [true, false]) {
      let rejected = 0, accepted = 0;
      for (let swapAt = 2; swapAt <= 40; swapAt++) {
        const h = fixture(authoredEnabled), replacement = fixture(true); let checks = 0;
        const lease = acquireMapDrawingPan(h.peer, { current: () => { if (++checks === swapAt) h.peer.dragPan = replacement.handler; return true; } });
        if (lease.accepted) accepted++; else { rejected++; expect(lease.code, `swap ${swapAt}`).to.equal('stale'); }
        lease.release();
        expect(replacement.calls, `swap ${swapAt}`).to.deep.equal([]);
      }
      expect(rejected, String(authoredEnabled)).to.be.greaterThan(0); expect(accepted, String(authoredEnabled)).to.be.greaterThan(0);
    }
  });
});
