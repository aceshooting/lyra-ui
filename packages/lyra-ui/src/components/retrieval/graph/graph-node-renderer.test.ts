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

  for (const [name, make] of [
    ['a primitive result', () => false],
    ['a callable result', () => () => mesh()],
    ['missing positions', () => ({ normals: mesh().normals })],
    ['missing normals', () => ({ positions: mesh().positions })],
    ['ordinary position array', () => ({ ...mesh(), positions: Array.from(mesh().positions) })],
    ['double precision positions', () => ({ ...mesh(), positions: new Float64Array(mesh().positions) })],
    ['integer normals', () => ({ ...mesh(), normals: new Uint8Array([0, 0, 1]) })],
    ['data view positions', () => ({ ...mesh(), positions: new DataView(mesh().positions.buffer) })],
    ['proxied positions', () => ({ ...mesh(), positions: new Proxy(mesh().positions, {}) })],
    ['an empty mesh', () => ({ positions: new Float32Array(), normals: new Float32Array() })],
    ['an incomplete triangle', () => ({ ...mesh(), positions: new Float32Array(8) })],
    ['too few normals', () => ({ ...mesh(), normals: new Float32Array(2) })],
    ['too many normals', () => ({ ...mesh(), normals: new Float32Array(6) })],
    ['a typed color tuple', () => ({ ...mesh(), color: new Float32Array([1, 0, 0, 1]) })],
    ['a short color tuple', () => ({ ...mesh(), color: [1, 0, 0] })],
    ['a long color tuple', () => ({ ...mesh(), color: [1, 0, 0, 1, 1] })],
    ['a sparse color tuple', () => ({ ...mesh(), color: [1, , 0, 1] })],
    ['a decorated color tuple', () => ({ ...mesh(), color: Object.assign([1, 0, 0, 1], { label: 'red' }) })],
    ['a color tuple with a symbol in place of a channel', () => {
      const color = [1, , 0, 1]; Object.defineProperty(color, Symbol('channel'), { value: 0 });
      return { ...mesh(), color };
    }],
    ['a color tuple with a named member in place of a channel', () => {
      const color = [1, , 0, 1]; Object.defineProperty(color, 'green', { value: 0 });
      return { ...mesh(), color };
    }],
    ['resizable position storage', () => {
      const buffer = Reflect.construct(ArrayBuffer, [36, { maxByteLength: 72 }]) as ArrayBuffer;
      expect(Reflect.get(buffer, 'resizable')).to.equal(true);
      const positions = new Float32Array(buffer); positions.set(mesh().positions);
      return { ...mesh(), positions };
    }],
  ] as const) {
    it(`rejects ${name} at its node without continuing or poisoning the next admission`, async () => {
      const visited: number[] = [];
      let failure: unknown;
      try {
        await admit((row: { index: number }) => {
          visited.push(row.index);
          return row.index === 1 ? make() : mesh();
        }, 3);
      } catch (error) { failure = error; }
      expect(failure instanceof GraphNodeRendererError).to.equal(true);
      expect((failure as GraphNodeRendererError).reason).to.equal('invalid');
      expect((failure as GraphNodeRendererError).nodeId).to.equal('1');
      expect(visited).to.deep.equal([0, 1]);
      const recovered = await admit(() => mesh());
      expect(Array.from(recovered![0]!.positions)).to.deep.equal(Array.from(mesh().positions));
      expect(Array.from(recovered![0]!.normals)).to.deep.equal([0, 0, 1]);
    });
  }
  it('owns callback bytes before invoking another row', async () => {
    const input = mesh();
    const result = await admit((row: { index: number }) => {
      if (row.index) { input.positions.fill(0); return null; }
      return input;
    }, 2);
    expect(result![0]!.positions[3]).to.equal(0.5);
  });
  it('owns optional RGBA before another callback mutates the application color', async () => {
    const color = [0, 0.25, 0.75, 1];
    const result = await admit((row: { index: number }) => {
      if (row.index) { color.fill(0.5); return null; }
      return { ...mesh(), color };
    }, 2);
    expect(result![0]!.color).to.deep.equal([0, 0.25, 0.75, 1]);
    expect(Object.isFrozen(result) && Object.isFrozen(result![0]) && Object.isFrozen(result![0]!.color)).to.equal(true);
    expect(result![1]).to.equal(null);
  });
  it('rejects nonfinite and out-of-range RGBA channels with the failing node identity', async () => {
    for (let channel = 0; channel < 4; channel++) {
      for (const value of [NaN, Infinity, -0.001, 1.001, '1']) {
        const color: unknown[] = [0, 0.25, 0.75, 1]; color[channel] = value;
        try { await admit(() => ({ ...mesh(), color })); expect.fail('accepted invalid color'); }
        catch (error) {
          expect(error).to.be.instanceOf(GraphNodeRendererError);
          expect((error as GraphNodeRendererError).reason).to.equal('invalid');
          expect((error as GraphNodeRendererError).nodeId).to.equal('0');
        }
      }
    }
  });
  it('contains exceptions from mesh reflection and still admits a subsequent valid batch', async () => {
    for (const traps of [
      { getPrototypeOf() { throw new Error('private metadata'); } },
      { ownKeys() { throw new Error('private metadata'); } },
      { getOwnPropertyDescriptor() { throw new Error('private metadata'); } },
    ]) {
      try { await admit(() => new Proxy(mesh(), traps)); expect.fail('accepted inaccessible mesh'); }
      catch (error) {
        expect(error).to.be.instanceOf(GraphNodeRendererError);
        expect((error as GraphNodeRendererError).reason).to.equal('invalid');
        expect((error as Error).message).not.to.include('private metadata');
      }
    }
    expect((await admit(() => mesh()))?.length).to.equal(1);
  });
  it('refuses invalid row counts before consulting context or renderer callbacks', async () => {
    let contexts = 0, renders = 0;
    for (const count of [-1, 0.5, NaN, Infinity, 200_001]) {
      try {
        await admitGraphNodeRenderer(() => { renders++; return mesh(); }, count,
          index => { contexts++; return context(index); }, () => true, async () => {});
        expect.fail('accepted invalid row count');
      } catch (error) { expect((error as GraphNodeRendererError).reason).to.equal('invalid'); }
    }
    expect([contexts, renders]).to.deep.equal([0, 0]);
    expect(await admit(() => { renders++; return mesh(); }, 0)).to.equal(undefined);
    expect(renders).to.equal(0);
  });
  it('rejects non-unit and nonfinite normals even when triangle winding is valid', async () => {
    for (const normal of [[0, 0, 0], [0, 0, 2], [NaN, 0, 1], [0, Infinity, 1]]) {
      try { await admit(() => ({ ...mesh(), normals: new Float32Array(normal) })); expect.fail('accepted invalid normal'); }
      catch (error) { expect((error as GraphNodeRendererError).reason).to.equal('invalid'); }
    }
  });
  it('refuses buffers detached during a scheduled copy without publishing partial rows', async () => {
    const positions = new Float32Array(64 * 9), normals = new Float32Array(64 * 3);
    for (let face = 0; face < 64; face++) {
      positions.set(mesh().positions, face * 9); normals.set(mesh().normals, face * 3);
    }
    let calls = 0, yields = 0;
    try {
      await admitGraphNodeRenderer(() => { calls++; return { positions, normals }; }, 10, context, () => true, async () => {
        yields++;
        structuredClone(positions.buffer, { transfer: [positions.buffer] });
      });
      expect.fail('published a detached candidate');
    } catch (error) {
      expect(error).to.be.instanceOf(GraphNodeRendererError);
      expect((error as GraphNodeRendererError).reason).to.equal('invalid');
      expect((error as GraphNodeRendererError).nodeId).to.equal('5');
    }
    expect([calls, yields, positions.length]).to.deep.equal([6, 1, 0]);
    expect((await admit(() => mesh()))?.length).to.equal(1);
  });
  it('stops immediately when the scheduler synchronously aborts its own slice', async () => {
    const controller = new AbortController(); let calls = 0;
    try {
      await admitGraphNodeRenderer(() => { calls++; return null; }, 129, context, () => true, async () => {
        controller.abort();
      }, controller.signal);
      expect.fail('admitted an aborted slice');
    } catch (error) { expect((error as Error).name).to.equal('AbortError'); }
    expect(calls).to.equal(128);
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
