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
});
