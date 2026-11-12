import { expect, waitUntil } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { AvCueSourceController } from './av-player-cue-source-controller.js';
import type { LyraAvCueSource } from './av-cue-source.js';

const cue = { cueId: 'cue-0', start: 0, end: 1, text: 'Matching cue' };
function source(overrides: Partial<LyraAvCueSource> = {}): LyraAvCueSource {
  return { revision: 1, count: 1, getCue: () => cue,
    findCue: () => ({ index: 0, cue }),
    activeAt: () => ({ index: 0, cue, validFrom: 0, validUntil: 1 }),
    search: () => ({ count: 1, getMatch: () => ({ index: 0, cue }) }), ...overrides };
}
function setup(reveal: (index: number, current: () => boolean) => Promise<boolean>) {
  const controllers = new Set<ReactiveController>();
  const host = Object.assign(document.createElement('div'), {
    addController: (controller: ReactiveController) => controllers.add(controller),
    removeController: (controller: ReactiveController) => controllers.delete(controller),
    requestUpdate: () => {}, updateComplete: Promise.resolve(true),
  }) satisfies HTMLElement & ReactiveControllerHost;
  document.body.append(host);
  const control = new AvCueSourceController(host, { locale: () => 'en', changed: () => {},
    activeChanged: () => {}, searchChanged: () => {}, reveal });
  return { control, dispose: () => { control.revoke(); host.remove(); controllers.forEach(controller => controller.hostDisconnected?.()); } };
}

it('fails closed on invalid source admission and rejects out-of-range public cue locations', async () => {
  const test = setup(async () => true);
  try {
    test.control.bind(source({ count: -1 }), () => true);
    expect(test.control.unavailable).to.equal(true);
    expect(test.control.count).to.equal(0);
    expect(await test.control.search('Matching', 'en')).to.equal(0);
    test.control.bind(source({ findCue: () => ({ index: 1, cue }),
      search: () => ({ count: 1, getMatch: () => ({ index: 1, cue }) }) }), () => true);
    expect(test.control.unavailable).to.equal(false);
    expect(test.control.count).to.equal(1);
    expect(await test.control.window.resolveKey('cue-0')).to.equal(null);
    expect(await test.control.search('Matching', 'en')).to.equal(0);
    expect(test.control.searchUnavailable).to.equal(true);
    expect(test.control.selected).to.equal(undefined);
  } finally { test.dispose(); }
});

it('reports an unavailable match when the provider cannot supply its advertised cue', async () => {
  const reveals: number[] = [];
  const test = setup(async index => { reveals.push(index); return true; });
  try {
    let reads = 0;
    test.control.bind(source({ getCue: () => { reads++; return null; } }), () => true);
    expect(await test.control.search('Matching', 'en')).to.equal(0);
    expect(reads).to.equal(1);
    expect(reveals).to.deep.equal([]);
    expect(test.control.unavailable).to.equal(true);
    expect(test.control.searchUnavailable).to.equal(true);
    expect(test.control.searchLoading).to.equal(false);
    expect(test.control.selected).to.equal(undefined);
  } finally { test.dispose(); }
});

it('reports an unavailable match when the host refuses to reveal a supplied cue', async () => {
  const reveals: number[] = [];
  const test = setup(async (index, current) => { expect(current()).to.equal(true); reveals.push(index); return false; });
  try {
    test.control.bind(source(), () => true);
    expect(await test.control.search('Matching', 'en')).to.equal(0);
    expect(reveals).to.deep.equal([0]);
    expect(test.control.unavailable).to.equal(false);
    expect(test.control.searchUnavailable).to.equal(true);
    expect(test.control.searchLoading).to.equal(false);
    expect(test.control.selected).to.equal(undefined);
    expect(await test.control.navigate(1)).to.equal(false);
  } finally { test.dispose(); }
});


for (const withdrawal of ['clear', 'rebind', 'revoke'] as const) {
  for (const outcome of ['unavailable', 'rejected'] as const) {
    it(`ignores a late ${outcome} reveal after ${withdrawal} and lets a fresh search recover`, async () => {
      let finish: (() => void) | undefined, authoritative: (() => boolean) | undefined;
      let reveals = 0;
      const test = setup(async (_index, current) => {
        if (++reveals > 1) return true;
        authoritative = current;
        return new Promise<boolean>((resolve, reject) => {
          finish = outcome === 'unavailable' ? () => resolve(false) : () => reject(new Error('Obsolete reveal failure'));
        });
      });
      try {
        test.control.bind(source(), () => true);
        const pending = test.control.search('Matching', 'en');
        await waitUntil(() => finish !== undefined, 'the first search must reach host reveal');
        expect(authoritative?.()).to.equal(true);
        if (withdrawal === 'clear') expect(await test.control.search('', 'en')).to.equal(0);
        else if (withdrawal === 'rebind') test.control.bind(source({ revision: 2 }), () => true);
        else test.control.revoke();
        expect(await pending).to.equal(0);
        expect(authoritative?.()).to.equal(false);
        expect(test.control.searchLoading).to.equal(false);
        expect(test.control.searchUnavailable).to.equal(false);
        expect(test.control.selected).to.equal(undefined);
        finish!();
        if (withdrawal === 'revoke') test.control.bind(source({ revision: 2 }), () => true);
        expect(await test.control.search('Matching', 'en')).to.equal(1);
        expect(test.control.selected?.cue.cueId).to.equal('cue-0');
        expect(test.control.searchUnavailable).to.equal(false);
        expect(test.control.searchLoading).to.equal(false);
        expect(reveals).to.equal(2);
      } finally { finish?.(); test.dispose(); }
    });
  }
}
