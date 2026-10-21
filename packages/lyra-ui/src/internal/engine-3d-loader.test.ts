import { expect } from '@open-wc/testing';
import {
  ENGINE_3D_CONTRACT,
  createEngine3dLoader,
  engine3dContractViolation,
  isEngine3dModule,
  type Engine3dEntryPoint,
  type Engine3dHost,
  type Engine3dInstance,
  type Engine3dLoader,
  type Engine3dLoaderOptions,
  type Engine3dModule,
  type Engine3dPickModifiers,
} from './engine-3d-loader.js';

/** Captures dev-mode warnings with a fresh dedupe store, restoring both globals afterwards. */
async function devWarnings(body: () => Promise<void>): Promise<string[]> {
  const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
  const previousWarnings = runtime.litIssuedWarnings;
  const previousWarn = console.warn;
  const messages: string[] = [];
  runtime.litIssuedWarnings = new Set();
  console.warn = (...args: unknown[]) => messages.push(args.map(String).join(' '));
  try {
    await body();
  } finally {
    console.warn = previousWarn;
    if (previousWarnings === undefined) delete runtime.litIssuedWarnings;
    else runtime.litIssuedWarnings = previousWarnings;
  }
  return messages;
}

function fakeEngine(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const noop = () => undefined;
  return {
    contract: ENGINE_3D_CONTRACT,
    mount: () => Promise.resolve(),
    setData: noop,
    setStyle: noop,
    setCamera: noop,
    resize: noop,
    dispose: noop,
    ...overrides,
  };
}

describe('engine-3d-loader', () => {
  it('recognizes an entry point by its callable createEngine, on the namespace or its default', () => {
    expect(isEngine3dModule({ createEngine: () => fakeEngine() })).to.equal(true);
    expect(isEngine3dModule({ createEngine: 'nope' })).to.equal(false);
    expect(isEngine3dModule(null)).to.equal(false);
  });

  it('names the first contract violation of a created engine', () => {
    expect(engine3dContractViolation(fakeEngine())).to.equal(undefined);
    expect(engine3dContractViolation(fakeEngine({ pick: () => null, fit: () => ({}) }))).to.equal(undefined);
    expect(engine3dContractViolation(fakeEngine({ contract: 2 }))).to.equal('contract');
    expect(engine3dContractViolation(fakeEngine({ contract: '1' }))).to.equal('contract');
    expect(engine3dContractViolation(fakeEngine({ resize: undefined }))).to.equal('resize');
    expect(engine3dContractViolation(fakeEngine({ pick: true }))).to.equal('pick');
    expect(engine3dContractViolation(42)).to.equal('engine object');
  });

  it('creates a validated engine from a default-export module and shares the load', async () => {
    let imports = 0;
    const engine = fakeEngine();
    const loader = createEngine3dLoader({
      entry: 'graph',
      tag: 'lr-graph',
      load: () => {
        imports += 1;
        return Promise.resolve({ default: { createEngine: () => engine } });
      },
    });
    expect(loader.entry).to.equal('graph');
    const [first, second] = await Promise.all([loader.create(), loader.create()]);
    expect(first === (engine as unknown) && second === (engine as unknown)).to.equal(true);
    expect(imports).to.equal(1);
  });

  it('warns once without importer details and retries after a missing companion', async () => {
    let attempt = 0;
    const loader = createEngine3dLoader({
      entry: 'points',
      tag: 'lr-embedding-explorer',
      load: () => (++attempt <= 2
        ? Promise.reject(new Error('Cannot find module /home/someone/app'))
        : Promise.resolve({ createEngine: () => fakeEngine() })),
    });
    const messages = await devWarnings(async () => {
      expect((await loader.create()) === null).to.equal(true);
      expect((await loader.create()) === null).to.equal(true);
      expect((await loader.create()) === null).to.equal(false);
    });
    expect(attempt).to.equal(3);
    expect(messages).to.deep.equal([
      '<lr-embedding-explorer> could not load its optional `@aceshooting/lyra-3d/points` engine — install it with `pnpm add @aceshooting/lyra-3d`.',
    ]);
  });

  it('rejects an engine from another contract version or one whose creation throws', async () => {
    const messages = await devWarnings(async () => {
      const mismatched = createEngine3dLoader({
        entry: 'panorama',
        tag: 'lr-image-viewer',
        load: () => Promise.resolve({ createEngine: () => fakeEngine({ contract: 2 }) }),
      });
      expect((await mismatched.create()) === null).to.equal(true);
      const throwing = createEngine3dLoader({
        entry: 'panorama',
        tag: 'lr-video',
        load: () => Promise.resolve({ createEngine: () => { throw new Error('boom'); } }),
      });
      expect((await throwing.create()) === null).to.equal(true);
    });
    expect(messages).to.deep.equal([
      '<lr-image-viewer> cannot use the installed `@aceshooting/lyra-3d/panorama` engine: it does not implement engine contract 1. Install a matching @aceshooting/lyra-3d version.',
    ]);
  });

  it('reimports after engine creation or contract validation fails', async () => {
    for (const invalid of [
      () => { throw new Error('creation failed'); },
      () => fakeEngine({ contract: 2 }),
      () => Object.defineProperty(fakeEngine(), 'contract', { get() { throw new Error('unreadable contract'); } }),
      () => Object.defineProperty(fakeEngine(), 'resize', { get() { throw new Error('unreadable method'); } }),
    ]) {
      let imports = 0;
      const loader = createEngine3dLoader({
        entry: 'graph',
        tag: 'lr-graph',
        load: () => {
          imports += 1;
          return Promise.resolve({ createEngine: imports === 1 ? invalid : () => fakeEngine() });
        },
      });
      await devWarnings(async () => {
        expect((await loader.create()) === null).to.equal(true);
        expect((await loader.create()) === null).to.equal(false);
      });
      expect(imports).to.equal(2);
    }
  });

  it('keeps a newer import when an older engine fails after clear or override', async () => {
    for (const reset of ['clear', 'override'] as const) {
      let resolveOld!: (module: Engine3dModule) => void;
      let resolveNew!: (module: Engine3dModule) => void;
      const oldModule = new Promise<Engine3dModule>((resolve) => { resolveOld = resolve; });
      const newModule = new Promise<Engine3dModule>((resolve) => { resolveNew = resolve; });
      let oldImports = 0;
      let newImports = 0;
      const loadNew = () => { newImports += 1; return newModule; };
      const loader = createEngine3dLoader({
        entry: 'graph',
        tag: 'lr-graph',
        load: () => (++oldImports === 1 ? oldModule : loadNew()),
      });
      await devWarnings(async () => {
        const oldCreation = loader.create();
        if (reset === 'clear') loader.clear();
        else loader.override(loadNew);
        const newCreation = loader.create();
        resolveOld({ createEngine: () => fakeEngine({ contract: 2 }) });
        expect((await oldCreation) === null).to.equal(true);
        const concurrentCreation = loader.create();
        expect(newImports).to.equal(1);
        resolveNew({ createEngine: () => fakeEngine() });
        expect((await newCreation) === null).to.equal(false);
        expect((await concurrentCreation) === null).to.equal(false);
        expect((await loader.create()) === null).to.equal(false);
        expect(newImports).to.equal(1);
      });
    }
  });

  it('hands the created engine a host and forwards its callbacks', async () => {
    const picks: { item: number | null; modifiers: Engine3dPickModifiers }[] = [];
    const host: Engine3dHost = {
      hover: () => undefined,
      pick: (item, modifiers) => picks.push({ item, modifiers }),
      camera: () => undefined,
      lost: () => undefined,
    };
    let mounted: Engine3dHost | undefined;
    const module: Engine3dModule = {
      createEngine: () => fakeEngine({ mount: (_container: HTMLElement, received: Engine3dHost) => { mounted = received; return Promise.resolve(); } }),
    };
    const entry: Engine3dEntryPoint = 'graph';
    const options: Engine3dLoaderOptions = { entry, tag: 'lr-graph', load: () => Promise.resolve(module) };
    const loader: Engine3dLoader = createEngine3dLoader(options);
    const engine: Engine3dInstance | null = await loader.create();
    expect(engine === null).to.equal(false);
    await engine?.mount(document.createElement('div'), host);
    mounted?.pick(3, { shift: true, ctrl: false, double: false });
    expect(picks).to.deep.equal([{ item: 3, modifiers: { shift: true, ctrl: false, double: false } }]);
    loader.clear();
  });

  it('treats a module without createEngine as unavailable', async () => {
    const loader = createEngine3dLoader({
      entry: 'model',
      tag: 'lr-model-viewer',
      load: () => Promise.resolve({ default: { render: () => undefined } }),
    });
    const messages = await devWarnings(async () => {
      expect((await loader.create()) === null).to.equal(true);
    });
    expect(messages).to.have.length(1);
    expect(messages[0]).to.contain('`@aceshooting/lyra-3d/model`');
  });
});
