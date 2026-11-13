import { expect, waitUntil } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { AvCueSourceController } from './av-player-cue-source-controller.js';
import type { LyraAvCueSource } from './av-cue-source.js';
import type { LyraSearchChangeDetail } from '../../../internal/text-viewer-target.js';

const cue = { cueId: 'cue-0', start: 0, end: 1, text: 'Matching cue' };
function source(overrides: Partial<LyraAvCueSource> = {}): LyraAvCueSource {
  return { revision: 1, count: 1, getCue: () => cue,
    findCue: () => ({ index: 0, cue }),
    activeAt: () => ({ index: 0, cue, validFrom: 0, validUntil: 1 }),
    search: () => ({ count: 1, getMatch: () => ({ index: 0, cue }) }), ...overrides };
}
function setup(reveal: (index: number, current: () => boolean) => Promise<boolean>, callbacks: {
  changed?: () => void;
  activeChanged?: (cueId: string | null, index: number) => void;
  searchChanged?: (detail: LyraSearchChangeDetail) => void;
} = {}) {
  const controllers = new Set<ReactiveController>();
  const host = Object.assign(document.createElement('div'), {
    addController: (controller: ReactiveController) => controllers.add(controller),
    removeController: (controller: ReactiveController) => controllers.delete(controller),
    requestUpdate: () => {}, updateComplete: Promise.resolve(true),
  }) satisfies HTMLElement & ReactiveControllerHost;
  document.body.append(host);
  const control = new AvCueSourceController(host, { locale: () => 'en', changed: () => {},
    activeChanged: () => {}, searchChanged: () => {}, ...callbacks, reveal });
  return { control, dispose: () => { control.revoke(); host.remove(); controllers.forEach(controller => controller.hostDisconnected?.()); } };
}

for (const withdrawal of ['clear', 'rebind', 'revoke'] as const) {
  it(`does not announce a match retired by ${withdrawal} during the host update callback`, async () => {
    const changes: LyraSearchChangeDetail[] = [];
    let control: AvCueSourceController | undefined, armed = true;
    const test = setup(async () => true, {
      changed: () => {
        if (!armed || !control?.selected) return;
        armed = false;
        if (withdrawal === 'clear') control.clearSearch();
        else if (withdrawal === 'rebind') control.bind(source({ revision: 2 }), () => true);
        else control.revoke();
      },
      searchChanged: detail => { changes.push(detail); },
    });
    control = test.control;
    try {
      control.bind(source(), () => true);
      expect(await control.search('Matching', 'en')).to.equal(0);
      expect(armed).to.equal(false);
      expect(control.selected).to.equal(undefined);
      expect(control.searchUnavailable).to.equal(false);
      expect(changes.map(change => change.query)).to.deep.equal(withdrawal === 'clear' ? [''] : []);
      if (withdrawal === 'revoke') control.bind(source({ revision: 2 }), () => true);
      expect(await control.search('Matching', 'en')).to.equal(1);
      expect(control.selected?.cue.cueId).to.equal('cue-0');
      expect(changes.filter(change => change.query === 'Matching').length).to.equal(1);
    } finally { test.dispose(); }
  });
}

for (const replacement of ['navigation', 'search'] as const) {
  it(`preserves ${replacement} started by an aborted match callback`, async () => {
    const reveals: number[] = [];
    const test = setup(async index => { reveals.push(index); return true; });
    const location = (index: number) => ({ index, cue: { cueId: `cue-${index}`, start: index,
      end: index + 1, text: `Matching ${index}` } });
    let release: (() => void) | undefined, latest: Promise<boolean | number> | undefined, held = false;
    const provider = source({ count: 3, getCue: index => location(index).cue,
      search: query => ({ count: query === 'Matching 2' ? 1 : 3, getMatch: (ordinal, request) => {
        const index = query === 'Matching 2' ? 2 : ordinal;
        if (index !== 1 || held) return location(index);
        held = true;
        request.signal.addEventListener('abort', () => {
          latest = replacement === 'navigation' ? test.control.navigate(1) : test.control.search('Matching 2', 'en');
        }, { once: true });
        return new Promise(resolve => { release = () => resolve(location(index)); });
      } }),
    });
    try {
      test.control.bind(provider, () => true);
      expect(await test.control.search('Matching', 'en')).to.equal(3);
      const pending = test.control.navigate(1);
      await waitUntil(() => release !== undefined);
      expect(await test.control.navigate(-1)).to.equal(false);
      expect(await pending).to.equal(false);
      expect(latest !== undefined).to.equal(true);
      release!();
      expect(await latest).to.equal(replacement === 'navigation' ? true : 1);
      const index = replacement === 'navigation' ? 1 : 2;
      expect(test.control.selected?.index).to.equal(index);
      expect(reveals).to.deep.equal([0, index]);
      expect(test.control.searchLoading).to.equal(false);
      expect(test.control.searchUnavailable).to.equal(false);
    } finally { release?.(); test.dispose(); }
  });
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
  for (const outcome of ['available', 'unavailable', 'rejected'] as const) {
    it(`ignores a late ${outcome} reveal after ${withdrawal} and lets a fresh search recover`, async () => {
      let finish: (() => void) | undefined, authoritative: (() => boolean) | undefined;
      let reveals = 0;
      const test = setup(async (_index, current) => {
        if (++reveals > 1) return true;
        authoritative = current;
        return new Promise<boolean>((resolve, reject) => {
          finish = outcome === 'rejected' ? () => reject(new Error('Obsolete reveal failure')) : () => resolve(outcome === 'available');
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

for (const withdrawal of ['rebind', 'revoke'] as const) {
  for (const outcome of ['available', 'unavailable', 'rejected'] as const) {
    it(`ignores a late ${outcome} cue read after ${withdrawal} without revealing the retired search`, async () => {
      let finish: (() => void) | undefined, signal: AbortSignal | undefined;
      const reveals: number[] = [], changes: LyraSearchChangeDetail[] = [];
      const test = setup(async index => { reveals.push(index); return true; }, {
        searchChanged: detail => { changes.push(detail); },
      });
      try {
        test.control.bind(source({ getCue: (_index, request) => {
          signal = request.signal;
          return new Promise((resolve, reject) => {
            finish = outcome === 'rejected' ? () => reject(new Error('Retired cue read failed'))
              : () => resolve(outcome === 'available' ? cue : null);
          });
        } }), () => true);
        const pending = test.control.search('Matching', 'en');
        await waitUntil(() => finish !== undefined, 'the first match must request its cue row');
        if (withdrawal === 'revoke') test.control.revoke();
        else test.control.bind(source({ revision: 2 }), () => true);
        expect(await pending).to.equal(0);
        expect(signal?.aborted).to.equal(true);
        expect(reveals).to.deep.equal([]);
        expect(changes.length).to.equal(0);
        expect(test.control.selected).to.equal(undefined);
        if (withdrawal === 'revoke') test.control.bind(source({ revision: 2 }), () => true);
        const recovery = test.control.search('Matching', 'en');
        finish!();
        expect(await recovery).to.equal(1);
        expect(test.control.selected?.cue.cueId).to.equal('cue-0');
        expect(reveals).to.deep.equal([0]);
        expect(changes.map(detail => detail.matchCount)).to.deep.equal([1]);
        expect(test.control.unavailable).to.equal(false);
        expect(test.control.searchUnavailable).to.equal(false);
        expect(test.control.searchLoading).to.equal(false);
      } finally { finish?.(); test.dispose(); }
    });
  }

  it(`keeps a rejected active-cue lookup after ${withdrawal} from clearing the new source`, async () => {
    let reject: ((reason: Error) => void) | undefined, signal: AbortSignal | undefined;
    const changes: [string | null, number][] = [];
    const test = setup(async () => true, { activeChanged: (id, index) => { changes.push([id, index]); } });
    try {
      test.control.bind(source({ activeAt: (_time, request) => {
        signal = request.signal;
        return new Promise((_resolve, fail) => { reject = fail; });
      } }), () => true);
      test.control.updateTime(0);
      await waitUntil(() => reject !== undefined, 'the old source must receive the active-cue request');
      if (withdrawal === 'revoke') test.control.revoke();
      test.control.bind(source({ revision: 2 }), () => true);
      expect(signal?.aborted).to.equal(true);
      test.control.updateTime(0);
      reject!(new Error('Retired active cue failed'));
      await waitUntil(() => test.control.active?.cue.cueId === 'cue-0');
      expect(changes).to.deep.equal([['cue-0', 0]]);
      expect(test.control.unavailable).to.equal(false);
      expect(test.control.count).to.equal(1);
    } finally { reject?.(new Error('Dispose pending active cue')); test.dispose(); }
  });
}
