import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { sceneSourceHarness } from '../../../../test/map-scene-admission-fixtures.js';

const payload = fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 1, maxLength: 32 });

describe('map scene source ownership properties', () => {
  it('isolates each selected byte range from later caller mutation', () => {
    fc.assert(fc.property(payload, fc.integer({ min: 0, max: 8 }), (values, padding) => {
      const h = sceneSourceHarness(64);
      const backing = new Uint8Array(values.length + padding * 2);
      backing.set(values, padding);
      const source = { format: 'glb' as const, bytes: backing.subarray(padding, padding + values.length) };
      const stage = h.sources.stage([source], h.request());
      backing.fill(255);
      const snapshot = h.sources.snapshot(stage.receipts[0]!);
      if (snapshot.kind !== 'bytes') throw new Error('Expected byte snapshot');
      expect([...snapshot.bytes]).to.deep.equal(values);
      expect(h.liveBytes).to.equal(values.length);
      stage.dispose(); h.sources.dispose(); expect(h.liveBytes).to.equal(0); expect(h.releases).to.equal(1);
    }), propertyRuns());
  });

  it('conserves a retained allocation across arbitrary independent lease releases', () => {
    fc.assert(fc.property(payload, fc.array(fc.boolean(), { minLength: 1, maxLength: 24 }), (values, releaseEarly) => {
      const h = sceneSourceHarness(64);
      const stage = h.sources.stage([{ format: 'glb', bytes: new Uint8Array(values) }], h.request());
      const accepted = h.sources.publish(stage);
      const leases = releaseEarly.map(() => h.sources.retain(stage.receipts[0]!, 'installed'));
      accepted.forEach(lease => lease.release());
      let surviving = leases.length;
      releaseEarly.forEach((early, index) => {
        if (!early) return;
        leases[index]!.release(); leases[index]!.release(); surviving--;
        expect(h.liveBytes).to.equal(surviving === 0 ? 0 : values.length);
      });
      h.sources.dispose();
      expect(h.liveBytes).to.equal(surviving === 0 ? 0 : values.length);
      leases.forEach(lease => lease.release());
      expect(h.liveBytes).to.equal(0); expect(h.allocations).to.equal(1); expect(h.releases).to.equal(1);
    }), propertyRuns());
  });

  it('seals reuse immediately while accounting for old and freshly accepted backing independently', () => {
    fc.assert(fc.property(payload, fc.integer({ min: 1, max: 8 }), (values, iterations) => {
      const h = sceneSourceHarness(1024);
      const source = { format: 'glb' as const, bytes: new Uint8Array(values) };
      const oldLeases: { release(): void }[] = [];
      const ids = new Set<number>();
      for (let index = 0; index < iterations; index++) {
        const stage = h.sources.stage([source], index === 0 ? h.request() : h.next());
        const accepted = h.sources.publish(stage);
        const receipt = stage.receipts[0]!;
        expect(ids.has(receipt.sourceId)).to.equal(false); ids.add(receipt.sourceId);
        oldLeases.push(h.sources.retain(receipt, 'installed'));
        h.sources.sealCurrent(); accepted.forEach(lease => lease.release());
        expect(h.liveBytes).to.equal(values.length * (index + 1));
      }
      h.sources.dispose();
      oldLeases.forEach((lease, index) => {
        lease.release(); expect(h.liveBytes).to.equal(values.length * (iterations - index - 1));
      });
      expect(h.allocations).to.equal(iterations); expect(h.releases).to.equal(iterations);
    }), propertyRuns());
  });
});

describe('map scene source operation model', () => {
  it('matches reference ownership through arbitrary staging, publication, retention, release and sealing', () => {
    const commands = fc.array(fc.constantFrom('stage', 'publish', 'discard', 'retain-candidate', 'retain-installed', 'release', 'seal'), { minLength: 1, maxLength: 40 });
    fc.assert(fc.property(payload, commands, (values, actions) => {
      const h = sceneSourceHarness(2048);
      const source = { format: 'glb' as const, bytes: new Uint8Array(values) };
      type Receipt = ReturnType<typeof h.sources.stage>['receipts'][number];
      type Record = { receipt: Receipt; references: number; sealed: boolean };
      const records: Record[] = [];
      const leases: { runtime: { release(): void }; record: Record }[] = [];
      let reusable: Record | undefined;
      let staged: { runtime: ReturnType<typeof h.sources.stage>; record: Record } | undefined;
      const release = (entry: { runtime: { release(): void }; record: Record }) => {
        entry.runtime.release(); entry.record.references--;
      };
      for (const action of actions) {
        if (action === 'stage' && !staged) {
          const runtime = h.sources.stage([source], h.next());
          let record = reusable && !reusable.sealed && reusable.references > 0 ? reusable : undefined;
          if (record) expect(runtime.receipts[0]!.sourceId).to.equal(record.receipt.sourceId);
          else {
            expect(records.some(previous => previous.receipt.sourceId === runtime.receipts[0]!.sourceId)).to.equal(false);
            record = { receipt: runtime.receipts[0]!, references: 0, sealed: false };
            records.push(record);
          }
          record.references++; staged = { runtime, record };
        } else if (action === 'publish' && staged) {
          const accepted = h.sources.publish(staged.runtime);
          expect(accepted.length).to.equal(1);
          reusable = staged.record;
          leases.push({ runtime: accepted[0]!, record: staged.record });
          staged = undefined;
        } else if (action === 'discard' && staged) {
          staged.runtime.dispose(); staged.record.references--; staged = undefined;
        } else if ((action === 'retain-candidate' || action === 'retain-installed') && reusable && reusable.references > 0 && !reusable.sealed) {
          const runtime = h.sources.retain(reusable.receipt, action === 'retain-candidate' ? 'candidate' : 'installed');
          reusable.references++; leases.push({ runtime, record: reusable });
        } else if (action === 'release' && leases.length > 0) {
          release(leases.shift()!);
        } else if (action === 'seal' && !staged) {
          h.sources.sealCurrent(); records.forEach(record => { record.sealed = true; }); reusable = undefined;
        }
        expect(h.liveBytes).to.equal(records.filter(record => record.references > 0).length * values.length);
        expect(h.allocations).to.equal(records.length);
        expect(h.releases).to.equal(records.filter(record => record.references === 0).length);
      }
      if (staged) { staged.runtime.dispose(); staged.record.references--; }
      leases.forEach(release); h.sources.dispose();
      expect(h.liveBytes).to.equal(0); expect(h.releases).to.equal(records.length);
    }), propertyRuns());
  });
});
