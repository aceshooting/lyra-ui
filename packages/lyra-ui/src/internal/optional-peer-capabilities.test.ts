import { expect } from '@open-wc/testing';
import { createOptionalPeerLoader } from './optional-peer-capabilities.js';

interface Greeter {
  greet(): string;
}

function isGreeter(value: unknown): value is Greeter {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'greet' in value &&
    typeof value.greet === 'function'
  );
}

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

describe('createOptionalPeerLoader', () => {
  const greeter: Greeter = { greet: () => 'hi' };

  it('shares one in-flight load and its successful result across callers', async () => {
    let imports = 0;
    const loader = createOptionalPeerLoader({
      load: () => {
        imports += 1;
        return Promise.resolve({ default: greeter });
      },
      isCapability: isGreeter,
      warningKey: 'lyra-test-peer-shared',
      warning: 'test peer unavailable',
    });
    const [first, second] = await Promise.all([loader.get(), loader.get()]);
    expect(first === greeter && second === greeter).to.equal(true);
    expect((await loader.get()) === greeter).to.equal(true);
    expect(imports).to.equal(1);
    loader.clear();
    await loader.get();
    expect(imports).to.equal(2);
  });

  it('retries after a failed import instead of caching the failure for the page lifetime', async () => {
    let attempt = 0;
    const loader = createOptionalPeerLoader({
      load: () => (++attempt === 1 ? Promise.reject(new Error('chunk offline')) : Promise.resolve(greeter)),
      isCapability: isGreeter,
      warningKey: 'lyra-test-peer-retry',
      warning: 'test peer unavailable',
    });
    const messages = await devWarnings(async () => {
      expect((await loader.get()) === null).to.equal(true);
      expect((await loader.get()) === greeter).to.equal(true);
    });
    expect(messages).to.deep.equal(['test peer unavailable']);
  });

  it('words the warning by failure class: not installed versus failed to load', async () => {
    const make = (key: string, load: () => Promise<unknown>) =>
      createOptionalPeerLoader({
        load,
        isCapability: isGreeter,
        warningKey: key,
        warning: 'install the peer',
        failedWarning: 'the peer failed to load',
      });
    const failed = await devWarnings(async () => {
      await make('lyra-test-peer-class-failed', () => Promise.reject(new Error('chunk offline'))).get();
    });
    const missing = await devWarnings(async () => {
      await make('lyra-test-peer-class-missing', () => Promise.reject(new Error('Failed to resolve module specifier "x"'))).get();
    });
    expect(failed).to.deep.equal(['the peer failed to load']);
    expect(missing).to.deep.equal(['install the peer']);
  });

  it('warns once, without importer details, for a module that lacks the capability', async () => {
    const loader = createOptionalPeerLoader({
      load: () => Promise.resolve({ default: { greet: 'not a function' } }),
      isCapability: isGreeter,
      warningKey: 'lyra-test-peer-shape',
      warning: 'test peer unavailable',
    });
    const messages = await devWarnings(async () => {
      expect((await loader.get()) === null).to.equal(true);
      expect((await loader.loadWith(() => Promise.reject(new Error('secret path /x')))) === null).to.equal(true);
    });
    expect(messages).to.deep.equal(['test peer unavailable']);
  });
  describe('cache: "generation"', () => {
    const options = (load: () => Promise<unknown>, key: string) => ({
      load,
      isCapability: isGreeter,
      warningKey: key,
      warning: 'test peer unavailable',
      cache: 'generation' as const,
    });

    it('retries a transient import failure but keeps a successful load', async () => {
      let attempt = 0;
      const loader = createOptionalPeerLoader(
        options(() => (++attempt === 1 ? Promise.reject(new Error('chunk offline')) : Promise.resolve(greeter)), 'lyra-test-gen-transient'),
      );
      await devWarnings(async () => {
        expect(await loader.load()).to.equal(null);
        expect((await loader.load()) === greeter).to.equal(true);
        expect((await loader.load()) === greeter).to.equal(true);
      });
      expect(attempt).to.equal(2);
    });

    it('caches a module that lacks the capability instead of re-importing it', async () => {
      let imports = 0;
      const loader = createOptionalPeerLoader(
        options(() => {
          imports += 1;
          return Promise.resolve({ default: { greet: 1 } });
        }, 'lyra-test-gen-invalid'),
      );
      await devWarnings(async () => {
        expect(await loader.load()).to.equal(null);
        expect(await loader.load()).to.equal(null);
      });
      expect(imports).to.equal(1);
    });

    it('reset() forgets the cached result and a stale in-flight load cannot repopulate it', async () => {
      let imports = 0;
      let release!: () => void;
      const gate = new Promise<void>((resolve) => (release = resolve));
      const loader = createOptionalPeerLoader(
        options(() => {
          imports += 1;
          return imports === 1 ? gate.then(() => greeter) : Promise.resolve({ greet: () => 'second' });
        }, 'lyra-test-gen-reset'),
      );
      const first = loader.load();
      loader.reset();
      const second = await loader.load();
      release();
      expect((await first) === greeter).to.equal(true);
      expect(second?.greet()).to.equal('second');
      expect((await loader.load()) === second).to.equal(true);
      expect(imports).to.equal(2);
    });
  });

  it('keeps the default success-only behaviour: an invalid module is retried', async () => {
    let imports = 0;
    const loader = createOptionalPeerLoader({
      load: () => {
        imports += 1;
        return Promise.resolve({ default: { greet: 1 } });
      },
      isCapability: isGreeter,
      warningKey: 'lyra-test-peer-default-invalid',
      warning: 'test peer unavailable',
    });
    await devWarnings(async () => {
      await loader.get();
      await loader.get();
    });
    expect(imports).to.equal(2);
  });
});
