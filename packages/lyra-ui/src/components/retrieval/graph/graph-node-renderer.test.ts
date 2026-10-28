import { expect, waitUntil } from '@open-wc/testing';
import { admitGraphNodeRenderer, GraphNodeRendererError } from './graph-node-renderer.js';

const mesh = (): { positions: Float32Array; normals: Float32Array } => ({ positions: new Float32Array([0, 0, 0, 0.5, 0, 0, 0, 0.5, 0]), normals: new Float32Array([0, 0, 1]) });
const context = (index: number) => Object.freeze({ id: String(index), index });
const admit = (renderer: unknown, count = 1) => admitGraphNodeRenderer(renderer, count, context, () => true, async () => {});

describe('graph node renderer admission', () => {
  it('keeps reset and all-null batches on the ordinary path', async () => {
    expect(await admit(undefined)).to.equal(undefined);
    expect(await admit(null)).to.equal(undefined);
    expect(await admit(() => null, 200)).to.equal(undefined);
  });
  it('owns callback bytes before invoking another row', async () => {
    const input = mesh();
    const result = await admit((row: { index: number }) => {
      if (row.index) { input.positions.fill(0); return null; }
      return input;
    }, 2);
    expect(result![0]!.positions[3]).to.equal(0.5);
  });
  it('rejects callback failures and malformed descriptors without exposing exceptions', async () => {
    for (const [renderer, reason] of [[() => { throw new Error('secret'); }, 'callback'], [() => Promise.resolve(mesh()), 'invalid'], [() => Object.defineProperty({}, 'positions', { get() { throw new Error('secret'); } }), 'invalid'], [42, 'invalid']] as const) {
      try { await admit(renderer); expect.fail('accepted invalid renderer'); } catch (error) {
        expect(error).to.be.instanceOf(GraphNodeRendererError);
        expect((error as GraphNodeRendererError).reason).to.equal(reason);
        expect((error as Error).message).not.to.contain('secret');
      }
    }
  });
  it('aborts reentrant callbacks before the next row', async () => {
    let current = true, calls = 0;
    try {
      await admitGraphNodeRenderer(() => { calls++; current = false; return mesh(); }, 2, context, () => current, async () => {});
      expect.fail('accepted stale renderer');
    } catch (error) { expect((error as Error).name).to.equal('AbortError'); }
    expect(calls).to.equal(1);
  });
  it('yields at the callback slice boundary', async () => {
    let calls = 0, yields = 0;
    await admitGraphNodeRenderer(() => { calls++; return null; }, 129, context, () => true, async () => { expect(calls).to.equal(128); yields++; });
    expect(yields).to.equal(1);
  });
  it('rejects degenerate triangles, wrong winding and nonfinite values', async () => {
    const inputs = [mesh(), mesh(), mesh()];
    inputs[0]!.positions.fill(0);
    inputs[1]!.normals[2] = -1;
    inputs[2]!.positions[0] = NaN;
    for (const input of inputs) {
      try { await admit(() => input); expect.fail('accepted invalid mesh'); } catch (error) { expect(error).to.be.instanceOf(GraphNodeRendererError); }
    }
  });
  it('checks freshness immediately after descriptor traps', async () => {
    let current = true, calls = 0;
    const input = new Proxy(mesh(), { ownKeys(target) { current = false; return Reflect.ownKeys(target); } });
    try {
      await admitGraphNodeRenderer(() => { calls++; return input; }, 2, context, () => current, async () => {});
      expect.fail('accepted stale descriptors');
    } catch (error) { expect((error as Error).name).to.equal('AbortError'); }
    expect(calls).to.equal(1);
  });
  it('accepts the per-node face limit and refuses its successor', async () => {
    const repeated = (faces: number) => {
      const positions = new Float32Array(faces * 9), normals = new Float32Array(faces * 3);
      for (let face = 0; face < faces; face++) {
        positions.set(mesh().positions, face * 9); normals.set(mesh().normals, face * 3);
      }
      return { positions, normals };
    };
    expect((await admit(() => repeated(64)))![0]!.positions.length).to.equal(576);
    try { await admit(() => repeated(65)); expect.fail('accepted over budget'); }
    catch (error) { expect((error as GraphNodeRendererError).reason).to.equal('budget'); }
  });
  it('keeps copied-float slices bounded', async () => {
    let calls = 0, yields = 0, previous = 0;
    const positions = new Float32Array(64 * 9), normals = new Float32Array(64 * 3);
    for (let face = 0; face < 64; face++) {
      positions.set(mesh().positions, face * 9); normals.set(mesh().normals, face * 3);
    }
    await admitGraphNodeRenderer(() => { calls++; return { positions, normals }; }, 20, context, () => true, async () => {
      // The first pending callback has run but its floats have not yet been copied.
      const completed = calls - 1;
      expect((completed - previous) * 768).to.be.at.most(4096);
      expect((completed - previous + 1) * 768).to.be.greaterThan(4096);
      previous = completed; yields++;
    });
    expect(yields).to.be.greaterThan(0);
  });

  it('rejects inherited fields and color accessors without invoking them', async () => {
    let reads = 0;
    const color = [1, 1, 1, 1];
    Object.defineProperty(color, '0', { get() { reads++; return 1; } });
    const input = mesh();
    for (const value of [Object.create(input) as unknown, { ...input, extra: true }, { ...input, color }]) {
      try { await admit(() => value); expect.fail('accepted unsupported descriptors'); }
      catch (error) { expect((error as GraphNodeRendererError).reason).to.equal('invalid'); }
    }
    expect(reads).to.equal(0);
  });

  it('stops after stale scheduled work before invoking another callback', async () => {
    let current = true, calls = 0;
    try {
      await admitGraphNodeRenderer(() => { calls++; return null; }, 129, context, () => current, async () => { current = false; });
      expect.fail('accepted a superseded slice');
    } catch (error) { expect((error as Error).name).to.equal('AbortError'); }
    expect(calls).to.equal(128);
  });

  it('promptly settles canceled owned candidates while scheduled yields remain held', async () => {
    type AbortableAdmission = (renderer: unknown, nodeCount: number, makeContext: typeof context,
      isCurrent: () => boolean, yieldTask: () => Promise<void>, signal: AbortSignal) => ReturnType<typeof admitGraphNodeRenderer>;
    const admission = admitGraphNodeRenderer as AbortableAdmission;
    const controllers: AbortController[] = [], jobs: Promise<void>[] = [];
    const held = new Promise<void>(() => {});
    let canceled = 0, callbacks = 0, commits = 0;
    for (let generation = 0; generation < 4; generation++) {
      controllers.at(-1)?.abort();
      const controller = new AbortController(); controllers.push(controller);
      jobs.push(admission(() => { callbacks++; return mesh(); }, 129, context, () => true, () => held, controller.signal)
        .then(() => { commits++; }, error => { expect((error as Error).name).to.equal('AbortError'); canceled++; }));
    }
    controllers.at(-1)!.abort();
    await waitUntil(() => canceled === 4, 'all superseded candidates unwind without resolving their scheduled yields');
    await Promise.all(jobs);
    expect(callbacks).to.equal(4 * 128); expect(commits).to.equal(0);
  });

});
