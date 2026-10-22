import { expect } from '@open-wc/testing';
import { MapHashOwner, type MapHashWindow } from './map-hash-owner.js';

function fixture() {
  const listeners = new Map<string, Set<() => void>>();
  const view: MapHashWindow = {
    location: { hash: '#section&map=4/2/1', pathname: '/map', search: '?a=1' },
    history: { state: { retained: true }, replaceState(_state, _unused, url) { view.location.hash = String(url).slice(String(url).indexOf('#')); } },
    addEventListener(type, fn) { let set = listeners.get(type); if (!set) listeners.set(type, set = new Set()); set.add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
  };
  return { view, fire: () => { for (const fn of [...listeners.get('hashchange') ?? []]) fn(); }, listeners };
}
describe('map named hash ownership', () => {
  it('claims one window/key, leaves collisions inert and never automatically takes over', () => {
    const { view, listeners } = fixture(); const a = new MapHashOwner(), b = new MapHashOwner();
    expect(a.configure(view, true, () => undefined)).to.equal('enabled');
    expect(b.configure(view, true, () => undefined)).to.equal('conflict');
    a.dispose(); expect(listeners.get('hashchange')?.size).to.equal(0); expect(b.read().status).to.equal('disabled');
    expect(b.configure(view, true, () => undefined)).to.equal('conflict');
    b.dispose(); expect(b.configure(view, true, () => undefined)).to.equal('enabled'); b.dispose();
  });
  it('reads current navigation, preserves unrelated fields and releases listeners on disable', () => {
    const { view, fire, listeners } = fixture(); const owner = new MapHashOwner(); let calls = 0;
    owner.configure(view, true, () => { calls++; }); fire(); expect(calls).to.equal(1);
    view.location.hash = '#other&map=5/3/2'; expect(owner.read().status).to.equal('camera');
    expect(owner.write({ zoom: 6, center: [3, 4], bearing: 0, pitch: 0 })).to.equal(true);
    expect(view.location.hash).to.equal('#other&map=6/4/3'); expect(view.history.state).to.deep.equal({ retained: true });
    owner.configure(view, false, () => { calls++; }); fire(); expect(calls).to.equal(1); expect(listeners.get('popstate')?.size).to.equal(0);
  });
  it('preserves malformed and duplicate fields, supports distinct keys and rejects stale callbacks', () => {
    const { view, listeners } = fixture(); const owner = new MapHashOwner(); let calls = 0;
    owner.configure(view, true, () => { calls++; }); const stale = [...listeners.get('hashchange')!][0]!;
    owner.configure(view, 'other', () => { calls++; }); stale(); expect(calls).to.equal(0);
    view.location.hash = '#other=bad&other=1/2/3'; expect(owner.write({ zoom: 6, center: [3, 4], bearing: 0, pitch: 0 })).to.equal(false);
    expect(view.location.hash).to.equal('#other=bad&other=1/2/3'); owner.dispose();
  });
  it('retires registrations that complete after synchronous dispose and tries both removals', () => {
    const { view, listeners } = fixture(); const owner = new MapHashOwner();
    const add = view.addEventListener.bind(view), remove = view.removeEventListener.bind(view);
    view.addEventListener = (type, listener) => { if (type === 'hashchange') owner.dispose(); add(type, listener); };
    expect(owner.configure(view, true, () => undefined)).to.equal('disabled');
    expect(listeners.get('hashchange')?.size).to.equal(0); expect(listeners.get('popstate')?.size ?? 0).to.equal(0);
    view.addEventListener = add; owner.configure(view, true, () => undefined);
    const removed: string[] = []; view.removeEventListener = (type, listener) => { removed.push(type); remove(type, listener); if (type === 'hashchange') throw new Error('Removal failed'); };
    owner.dispose(); expect(removed).to.deep.equal(['hashchange', 'popstate']); expect(owner.read().status).to.equal('disabled');
  });
  it('preserves a newer acquisition when the old second registration reenters and throws', () => {
    const { view, listeners } = fixture(); const owner = new MapHashOwner(); const add = view.addEventListener.bind(view);
    let nested = false, calls = 0;
    view.addEventListener = (type, listener) => {
      if (type === 'popstate' && !nested) { nested = true; owner.configure(view, 'new', () => { calls++; }); add(type, listener); throw new Error('Old registration failed'); }
      add(type, listener);
    };
    expect(owner.configure(view, true, () => undefined)).to.equal('invalid');
    view.location.hash = '#new=3/2/1'; expect(owner.read().status).to.equal('camera');
    for (const callback of listeners.get('popstate') ?? []) callback(); expect(calls).to.equal(1); expect(listeners.get('popstate')?.size).to.equal(1); owner.dispose();
  });
  it('does not overwrite a new owner configured from an old removal callback', () => {
    const { view } = fixture(); const owner = new MapHashOwner(); const remove = view.removeEventListener.bind(view);
    owner.configure(view, true, () => undefined); let nested = false;
    view.removeEventListener = (type, listener) => { remove(type, listener); if (!nested) { nested = true; owner.configure(view, 'new', () => undefined); } };
    owner.configure(view, 'outer', () => undefined); view.location.hash = '#new=3/2/1'; expect(owner.read().status).to.equal('camera'); owner.dispose();
  });
  it('separates windows and does not invoke a callback after cleanup reentry', () => {
    const a = fixture(), b = fixture(), owner = new MapHashOwner(), second = new MapHashOwner();
    expect(owner.configure(a.view, true, () => owner.dispose())).to.equal('enabled');
    expect(second.configure(b.view, true, () => undefined)).to.equal('enabled'); a.fire(); expect(owner.read().status).to.equal('disabled'); second.dispose();
  });
});
