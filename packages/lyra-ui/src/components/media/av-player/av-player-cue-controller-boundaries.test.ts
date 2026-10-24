import { expect, waitUntil } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { AvCueSourceController } from './av-player-cue-source-controller.js';
import type { LyraAvCueSource } from './av-cue-source.js';
import type { LyraAvCue } from './av-metadata.js';

const cue = (index = 0): LyraAvCue => ({ cueId: `cue-${index}`, start: 0, end: 10, text: `Matching cue ${index}` });
function source(): LyraAvCueSource {
  return { revision: 1, count: 64, getCue: index => cue(index), findCue: id => ({ index: Number(id.slice(4)), cue: cue(Number(id.slice(4))) }),
    activeAt: () => ({ index: 0, cue: cue(), validFrom: 0, validUntil: 10 }),
    search: () => ({ count: 1, getMatch: () => ({ index: 0, cue: cue() }) }),
  };
}
function setup() {
  const controllers = new Set<ReactiveController>(); const changes: (string | null)[] = []; const reveals: number[] = [];
  const host = Object.assign(document.createElement('div'), {
    addController: (value: ReactiveController) => controllers.add(value), removeController: (value: ReactiveController) => controllers.delete(value),
    requestUpdate: () => {}, updateComplete: Promise.resolve(true),
  }) satisfies HTMLElement & ReactiveControllerHost;
  document.body.append(host);
  const control = new AvCueSourceController(host, { locale: () => 'en', changed: () => {},
    activeChanged: id => changes.push(id), searchChanged: () => {}, reveal: async index => { reveals.push(index); return true; } });
  return { control, changes, reveals, dispose: () => { control.revoke(); host.remove(); controllers.forEach(value => value.hostDisconnected?.()); } };
}

for (const conflict of ['changed selected record', 'selected identity at another index'] as const) {
  it(`rejects an active reply with a ${conflict}`, async () => {
    const test = setup(); const provider = source();
    provider.activeAt = () => ({ index: conflict === 'changed selected record' ? 0 : 40,
      cue: conflict === 'changed selected record' ? { ...cue(), text: 'Changed' } : cue(), validFrom: 0, validUntil: 10 });
    try {
      test.control.bind(provider, () => true);
      expect(await test.control.search('Matching', 'en')).to.equal(1);
      expect(test.control.selected?.cue.cueId).to.equal('cue-0');
      test.control.updateTime(1);
      await waitUntil(() => test.control.unavailable, 'contradictory active reply is rejected');
      expect(test.control.active).to.equal(undefined); expect(test.control.selected?.cue.text).to.equal('Matching cue 0');
      expect(test.changes).to.deep.equal([null]);
    } finally { test.dispose(); }
  });
}

it('rejects a lookup that contradicts a cached index identity', async () => {
  const test = setup(); const provider = source();
  provider.findCue = () => ({ index: 0, cue: { ...cue(), cueId: 'replacement' } });
  try {
    test.control.bind(provider, () => true); expect(await test.control.window.ensure(0)).to.equal(true);
    expect(await test.control.window.resolveKey('replacement')).to.equal(null);
    expect(test.control.window.source.keyAt!(0)).to.equal('cue-0');
  } finally { test.dispose(); }
});

it('rejects an active cue that duplicates a cached identity outside the cached page', async () => {
  const test = setup(); const provider = source();
  provider.activeAt = () => ({ index: 40, cue: cue(), validFrom: 0, validUntil: 10 });
  try {
    test.control.bind(provider, () => true); expect(await test.control.window.ensure(0)).to.equal(true);
    test.control.updateTime(1); await waitUntil(() => test.control.unavailable, 'duplicate active identity is rejected');
    expect(test.control.active).to.equal(undefined); expect(test.control.window.source.keyAt!(0)).to.equal('cue-0');
  } finally { test.dispose(); }
});

for (const channel of ['read', 'lookup', 'active', 'search', 'match'] as const) {
  it(`revokes a ${channel} reply during descriptor inspection without committing or reporting a provider failure`, async () => {
    const test = setup(); const provider = source(); let revoked = false;
    const revokeOnField = <T extends object>(value: T, field: PropertyKey): T => new Proxy(value, {
      getOwnPropertyDescriptor(target, key) {
        if (key === field && !revoked) { revoked = true; test.control.revoke(); }
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    if (channel === 'read') provider.getCue = () => revokeOnField(cue(), 'text');
    if (channel === 'lookup') provider.findCue = () => revokeOnField({ index: 0, cue: cue() }, 'cue');
    if (channel === 'active') provider.activeAt = () => revokeOnField({ index: 0, cue: cue(), validFrom: 0, validUntil: 10 }, 'cue');
    if (channel === 'search') provider.search = () => revokeOnField({ count: 1, getMatch: () => ({ index: 0, cue: cue() }) }, 'getMatch');
    if (channel === 'match') provider.search = () => ({ count: 1, getMatch: () => revokeOnField({ index: 0, cue: cue() }, 'cue') });
    try {
      test.control.bind(provider, () => true);
      if (channel === 'read') expect(await test.control.window.ensure(0)).to.equal(false);
      else if (channel === 'lookup') expect(await test.control.window.resolveKey('cue-0')).to.equal(null);
      else if (channel === 'active') { test.control.updateTime(1); await waitUntil(() => revoked, 'active descriptor revokes binding'); }
      else expect(await test.control.search('Matching', 'en')).to.equal(0);
      expect(revoked).to.equal(true); expect(test.control.count).to.equal(0);
      expect(test.control.active).to.equal(undefined); expect(test.control.selected).to.equal(undefined);
      expect(test.control.unavailable).to.equal(false); expect(test.control.searchUnavailable).to.equal(false);
      expect(test.reveals).to.deep.equal([]); expect(test.changes).to.deep.equal([]);
    } finally { test.dispose(); }
  });
}

it('does not publish admission failure after the caller withdraws source authority', () => {
  const test = setup();
  try {
    test.control.bind({ count: -1 }, () => false);
    expect(test.control.unavailable).to.equal(false); expect(test.control.count).to.equal(0);
    test.control.bind(source(), () => false);
    expect(test.control.unavailable).to.equal(false); expect(test.control.count).to.equal(0);
    test.control.bind(source(), () => true);
    expect(test.control.count).to.equal(64); expect(test.control.isCurrent(test.control.epoch)).to.equal(true);
  } finally { test.dispose(); }
});
