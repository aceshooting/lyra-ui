import { expect } from '@open-wc/testing';
import { sceneSourceHarness } from '../../../../test/map-scene-admission-fixtures.js';

describe('map scene source snapshots', () => {
  it('reserves before copying and owns only the selected byte view', () => {
    const h = sceneSourceHarness();
    const backing = new Uint8Array([9, 1, 2, 3, 9]);
    const source = { format: 'glb' as const, bytes: backing.subarray(1, 4) };
    h.hooks.reserve = bytes => { expect(bytes).to.equal(3); source.bytes[0] = 7; };
    const stage = h.sources.stage([source], h.request());
    source.bytes.fill(0);
    const snapshot = h.sources.snapshot(stage.receipts[0]!);
    expect(snapshot.kind).to.equal('bytes');
    if (snapshot.kind !== 'bytes') throw new Error('Expected byte snapshot');
    expect([...snapshot.bytes]).to.deep.equal([7, 2, 3]);
    expect(snapshot.bytes.buffer).not.to.equal(backing.buffer);
    expect(h.liveBytes).to.equal(3);
    stage.dispose(); stage.dispose();
    expect(h.liveBytes).to.equal(0); expect(h.releases).to.equal(1);
  });

  it('accepts ArrayBuffer bytes and releases all provisional copies when a later reservation fails', () => {
    const h = sceneSourceHarness();
    let calls = 0;
    h.hooks.reserve = () => { if (++calls === 2) throw new Error('No capacity'); };
    expect(() => h.sources.stage([
      { format: 'stl', bytes: new Uint8Array([1]).buffer },
      { format: 'glb', bytes: new Uint8Array([2]) },
    ], h.request())).to.throw();
    expect(h.allocations).to.equal(1); expect(h.releases).to.equal(1); expect(h.liveBytes).to.equal(0);
    h.sources.dispose();
  });

  it('does not allocate when reservation rejects and cannot publish after reservation reentry changes the request', () => {
    const denied = sceneSourceHarness();
    denied.hooks.reserve = () => { throw new Error('No capacity'); };
    expect(() => denied.sources.stage([{ format: 'glb', bytes: new Uint8Array([1]) }], denied.request())).to.throw();
    expect(denied.allocations).to.equal(0);
    const stale = sceneSourceHarness();
    stale.hooks.reserve = () => { stale.next(); };
    expect(() => stale.sources.stage([{ format: 'glb', bytes: new Uint8Array([1]) }], stale.request())).to.throw();
    expect(stale.liveBytes).to.equal(0); expect(stale.releases).to.equal(stale.allocations);
    denied.sources.dispose(); stale.sources.dispose();
  });

  it('refuses source metadata replaced during reservation and retires the returned lease', () => {
    for (const change of ['bytes', 'format'] as const) {
      const h = sceneSourceHarness();
      const source = { format: 'glb', bytes: new Uint8Array([1, 2]) };
      h.hooks.reserve = () => {
        if (change === 'bytes') source.bytes = new Uint8Array([9, 9]);
        else source.format = 'stl';
      };
      expect(() => h.sources.stage([source as never], h.request())).to.throw();
      expect(h.allocations).to.equal(1); expect(h.releases).to.equal(1); expect(h.liveBytes).to.equal(0);
      h.sources.dispose();
    }
  });

  it('retires a late returned reservation when its owner is disposed inside reserve', () => {
    const h = sceneSourceHarness();
    h.hooks.reserve = () => h.sources.dispose();
    expect(() => h.sources.stage([{ format: 'glb', bytes: new Uint8Array([1]) }], h.request())).to.throw();
    expect(h.allocations).to.equal(1); expect(h.releases).to.equal(1); expect(h.liveBytes).to.equal(0);
    h.sources.dispose();
  });

  it('counts in-progress reservations before one-shot nested staging can exceed the cap', () => {
    const h = sceneSourceHarness(3); let nestedRejected = false;
    h.hooks.reserve = () => {
      h.hooks.reserve = undefined;
      try {
        const nested = h.sources.stage([{ format: 'glb', bytes: new Uint8Array([3, 4]) }], h.request());
        nested.dispose();
      } catch { nestedRejected = true; }
    };
    const stage = h.sources.stage([{ format: 'glb', bytes: new Uint8Array([1, 2]) }], h.request());
    expect(nestedRejected).to.equal(true); expect(h.allocations).to.equal(1); expect(h.liveBytes).to.equal(2);
    stage.dispose(); h.sources.dispose(); expect(h.liveBytes).to.equal(0);
  });

  it('admits the exact encoded limit, rejects excess overlap, and deduplicates the same record', () => {
    const h = sceneSourceHarness(4);
    const source = { format: 'glb' as const, bytes: new Uint8Array([1, 2, 3, 4]) };
    const stage = h.sources.stage([source, source], h.request());
    expect(stage.receipts.length).to.equal(1); expect(h.allocations).to.equal(1);
    const accepted = h.sources.publish(stage);
    expect(() => h.sources.stage([{ format: 'glb', bytes: new Uint8Array([5]) }], h.request())).to.throw();
    expect(h.liveBytes).to.equal(4);
    accepted.forEach(lease => lease.release());
    expect(h.liveBytes).to.equal(0);
    expect(() => h.sources.stage([{ format: 'glb', bytes: new Uint8Array(5) }], h.request())).to.throw();
    h.sources.dispose();
  });

  it('retains the first admitted bytes across caller mutation and later detachment', () => {
    const h = sceneSourceHarness();
    const bytes = new Uint8Array([1, 2, 3]);
    const source = { format: 'glb' as const, bytes };
    const first = h.sources.stage([source], h.request());
    const accepted = h.sources.publish(first);
    bytes.fill(8);
    structuredClone(bytes.buffer, { transfer: [bytes.buffer] });
    const reused = h.sources.stage([source], h.next());
    expect(reused.receipts[0]).to.equal(first.receipts[0]);
    expect(h.allocations).to.equal(1);
    const snapshot = h.sources.snapshot(reused.receipts[0]!);
    if (snapshot.kind !== 'bytes') throw new Error('Expected byte snapshot');
    expect([...snapshot.bytes]).to.deep.equal([1, 2, 3]);
    reused.dispose(); accepted.forEach(lease => lease.release()); h.sources.dispose();
    expect(h.releases).to.equal(1);
  });

  it('rejects changed record metadata but treats a new record as a new snapshot', () => {
    for (const changed of ['format', 'bytes', 'discriminant'] as const) {
      const h = sceneSourceHarness();
      const source: Record<string, unknown> = { format: 'glb', bytes: new Uint8Array([1, 2]) };
      const first = h.sources.stage([source as never], h.request());
      const accepted = h.sources.publish(first);
      if (changed === 'format') source['format'] = 'stl';
      else if (changed === 'bytes') source['bytes'] = new Uint8Array([1, 2]);
      else { delete source['bytes']; source['src'] = 'model.glb'; }
      expect(() => h.sources.stage([source as never], h.next())).to.throw();
      expect(h.allocations).to.equal(1);
      accepted.forEach(lease => lease.release()); h.sources.dispose();
    }
    const h = sceneSourceHarness();
    const bytes = new Uint8Array([1, 2]);
    const first = h.sources.stage([{ format: 'glb', bytes }], h.request());
    const accepted = h.sources.publish(first);
    const second = h.sources.stage([{ format: 'glb', bytes }], h.next());
    expect(second.receipts[0]).not.to.equal(first.receipts[0]); expect(h.allocations).to.equal(2);
    second.dispose(); accepted.forEach(lease => lease.release()); h.sources.dispose();
  });

  it('rejects initial detached, shared, resizable and fabricated byte containers', () => {
    const h = sceneSourceHarness();
    const detached = new Uint8Array([1]);
    structuredClone(detached.buffer, { transfer: [detached.buffer] });
    const invalid: unknown[] = [detached, new Uint16Array([1]), {}, new Proxy(new Uint8Array([1]), {})];
    if (typeof SharedArrayBuffer !== 'undefined') invalid.push(new Uint8Array(new SharedArrayBuffer(1)));
    invalid.push(new Uint8Array(Reflect.construct(ArrayBuffer, [1, { maxByteLength: 2 }]) as ArrayBuffer));
    for (const bytes of invalid) expect(() => h.sources.stage([{ format: 'glb', bytes } as never], h.request())).to.throw();
    expect(h.allocations).to.equal(0); h.sources.dispose();
  });

  it('does not invoke source getters or accept two source alternatives', () => {
    const h = sceneSourceHarness(); let reads = 0;
    const source = { format: 'glb' };
    Object.defineProperty(source, 'bytes', { enumerable: true, get() { reads++; return new Uint8Array([1]); } });
    expect(() => h.sources.stage([source as never], h.request())).to.throw();
    expect(() => h.sources.stage([{ format: 'glb', src: 'a', bytes: new Uint8Array([1]) } as never], h.request())).to.throw();
    expect(reads).to.equal(0); expect(h.allocations).to.equal(0); h.sources.dispose();
  });

  it('owns a resolved URL request before fetching and retains its initial resolution', () => {
    const h = sceneSourceHarness();
    const source = { format: 'glb' as const, src: 'model.glb' };
    const resolved = { url: 'https://example.invalid/first/model.glb', owner: h.owner };
    h.hooks.resolve = () => resolved;
    const first = h.sources.stage([source], h.request());
    const accepted = h.sources.publish(first);
    resolved.url = 'https://example.invalid/changed.glb';
    h.hooks.resolve = () => ({ url: 'https://example.invalid/new-base/model.glb', owner: h.owner });
    const reuse = h.sources.stage([source], h.next());
    const snapshot = h.sources.snapshot(reuse.receipts[0]!);
    expect(snapshot.kind).to.equal('url');
    if (snapshot.kind !== 'url') throw new Error('Expected URL request');
    expect(snapshot.request.url).to.equal('https://example.invalid/first/model.glb');
    expect(snapshot.request.owner).to.equal(h.owner);
    expect(Object.isFrozen(snapshot.request)).to.equal(true);
    expect(h.resolutions).to.equal(1); expect(h.allocations).to.equal(0);
    source.src = 'changed.glb';
    expect(() => h.sources.stage([source], h.next())).to.throw();
    reuse.dispose(); accepted.forEach(lease => lease.release()); h.sources.dispose();
  });

  it('rolls back URL resolution failure and rejects stale resolver results', () => {
    for (const fail of ['null', 'throw', 'stale'] as const) {
      const h = sceneSourceHarness();
      h.hooks.resolve = () => {
        if (fail === 'throw') throw new Error('Unavailable');
        if (fail === 'null') return null;
        h.next(); return { url: 'https://example.invalid/a.glb', owner: h.owner };
      };
      expect(() => h.sources.stage([{ format: 'glb', src: 'a.glb' }], h.request())).to.throw();
      expect(h.allocations).to.equal(0); h.sources.dispose();
    }
  });

  it('retains installed A alongside accepted B and keeps A eligible for reuse until sealed', () => {
    const h = sceneSourceHarness();
    const a = { format: 'glb' as const, bytes: new Uint8Array([1, 2]) };
    const first = h.sources.stage([a], h.request());
    const acceptedA = h.sources.publish(first);
    const installed = h.sources.retain(first.receipts[0]!, 'installed');
    const second = h.sources.stage([{ format: 'glb', bytes: new Uint8Array([3]) }], h.next());
    const acceptedB = h.sources.publish(second);
    acceptedA.forEach(lease => lease.release());
    const reused = h.sources.stage([a], h.next());
    expect(reused.receipts[0]).to.equal(first.receipts[0]); expect(h.allocations).to.equal(2);
    reused.dispose(); h.sources.sealCurrent();
    expect(() => h.sources.retain(first.receipts[0]!, 'installed')).to.throw();
    const fresh = h.sources.stage([a], h.next());
    expect(fresh.receipts[0]).not.to.equal(first.receipts[0]); expect(h.allocations).to.equal(3);
    expect(h.liveBytes).to.equal(5);
    fresh.dispose(); acceptedB.forEach(lease => lease.release());
    expect(h.liveBytes).to.equal(2);
    h.sources.dispose(); expect(h.liveBytes).to.equal(2);
    installed.release(); installed.release(); expect(h.liveBytes).to.equal(0); expect(h.releases).to.equal(3);
  });

  it('does not admit provisional identity and refuses foreign, stale or consumed stages', () => {
    const h = sceneSourceHarness(); const other = sceneSourceHarness();
    const source = { format: 'glb' as const, bytes: new Uint8Array([1]) };
    const abandoned = h.sources.stage([source], h.request()); abandoned.dispose();
    const stage = h.sources.stage([source], h.next());
    expect(stage.receipts[0]).not.to.equal(abandoned.receipts[0]);
    expect(() => other.sources.publish(stage)).to.throw();
    const accepted = h.sources.publish(stage);
    expect(() => h.sources.publish(stage)).to.throw();
    expect(() => h.sources.snapshot({ sourceId: 1, format: 'glb' } as never)).to.throw();
    const stale = h.sources.stage([{ format: 'glb', bytes: new Uint8Array([2]) }], h.next()); h.next();
    expect(() => h.sources.publish(stale)).to.throw(); stale.dispose();
    accepted.forEach(lease => lease.release()); h.sources.dispose(); other.sources.dispose();
    expect(h.liveBytes).to.equal(0);
  });

  it('attempts every reservation retirement even if one callback throws', () => {
    const h = sceneSourceHarness();
    const stage = h.sources.stage([
      { format: 'glb', bytes: new Uint8Array([1]) }, { format: 'stl', bytes: new Uint8Array([2]) },
    ], h.request());
    let calls = 0; h.hooks.release = () => { if (++calls === 1) throw new Error('Release failed'); };
    stage.dispose();
    expect(h.liveBytes).to.equal(0); expect(h.releases).to.equal(2);
    h.sources.dispose();
  });
});
