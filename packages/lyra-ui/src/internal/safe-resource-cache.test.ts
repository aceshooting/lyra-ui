import { expect } from '@open-wc/testing';
import { BoundedResourceCache } from './safe-resource-cache.js';

function abortError(): Error {
  const error = new Error('aborted');
  error.name = 'AbortError';
  return error;
}

describe('BoundedResourceCache', () => {
  it('deduplicates concurrent loads and retains successful values', async () => {
    const cache = new BoundedResourceCache<string>(2);
    let calls = 0;
    let resolve!: (value: string) => void;
    const loader = () => {
      calls += 1;
      return new Promise<string>((done) => {
        resolve = done;
      });
    };

    const first = cache.acquire('same', loader);
    const second = cache.acquire('same', loader);
    expect(first.promise === second.promise).to.equal(true);
    expect(calls).to.equal(0, 'loaders start in a microtask');
    await Promise.resolve();
    expect(calls).to.equal(1);
    resolve('sanitized');
    expect(await first.promise).to.equal('sanitized');
    expect(await second.promise).to.equal('sanitized');
    first.release();
    second.release();

    const retained = cache.acquire('same', loader);
    expect(await retained.promise).to.equal('sanitized');
    expect(calls).to.equal(1);
    retained.release();
  });

  it('aborts an in-flight load only after its last subscriber releases it', async () => {
    const cache = new BoundedResourceCache<string>(2);
    let signal!: AbortSignal;
    const loader = (nextSignal?: AbortSignal) => {
      signal = nextSignal!;
      return new Promise<string>((_resolve, reject) => {
        nextSignal?.addEventListener('abort', () => reject(abortError()));
      });
    };

    const first = cache.acquire('same', loader);
    const second = cache.acquire('same', loader);
    await Promise.resolve();
    first.release();
    expect(signal.aborted).to.equal(false);
    second.release();
    expect(signal.aborted).to.equal(true);
    await Promise.allSettled([first.promise, second.promise]);
    expect(cache.size).to.equal(0);
  });

  it('evicts failures so a later subscriber can retry', async () => {
    const cache = new BoundedResourceCache<string>(2);
    let calls = 0;
    const loader = async () => {
      calls += 1;
      if (calls === 1) throw new Error('temporary');
      return 'retried';
    };

    const failed = cache.acquire('retry', loader);
    try {
      await failed.promise;
      throw new Error('expected the first request to fail');
    } catch (error) {
      expect((error as Error).message).to.equal('temporary');
    } finally {
      failed.release();
    }

    const retried = cache.acquire('retry', loader);
    expect(await retried.promise).to.equal('retried');
    expect(calls).to.equal(2);
    retried.release();
  });

  it('uses least-recently-used eviction and never exceeds its settled-entry bound', async () => {
    const cache = new BoundedResourceCache<string>(2);
    const calls = new Map<string, number>();
    const acquire = async (key: string): Promise<void> => {
      const lease = cache.acquire(key, async () => {
        calls.set(key, (calls.get(key) ?? 0) + 1);
        return key;
      });
      await lease.promise;
      lease.release();
    };

    await acquire('a');
    await acquire('b');
    await acquire('a');
    await acquire('c');
    expect(cache.size).to.equal(2);
    await acquire('b');
    expect(calls.get('a')).to.equal(1);
    expect(calls.get('b')).to.equal(2, 'b was least recently used when c arrived');
  });

  it('starts overflow work as no-store when every bounded slot is still active', async () => {
    const cache = new BoundedResourceCache<string>(1);
    const resolvers: Array<(value: string) => void> = [];
    const loader = () =>
      new Promise<string>((resolve) => {
        resolvers.push(resolve);
      });

    const retained = cache.acquire('retained', loader);
    await Promise.resolve();
    const overflow = cache.acquire('overflow', loader);
    await Promise.resolve();
    expect(cache.size).to.equal(1);
    expect(resolvers.length).to.equal(2);

    resolvers[0]!('retained');
    resolvers[1]!('overflow');
    expect(await retained.promise).to.equal('retained');
    expect(await overflow.promise).to.equal('overflow');
    retained.release();
    overflow.release();

    const retry = cache.acquire('overflow', loader);
    await Promise.resolve();
    expect(resolvers.length).to.equal(3, 'overflow was not retained outside the bound');
    resolvers[2]!('retried');
    expect(await retry.promise).to.equal('retried');
    retry.release();
  });

  it('invalidates future lookups without aborting a subscriber already using the entry', async () => {
    const cache = new BoundedResourceCache<string>(2);
    const signals: AbortSignal[] = [];
    const resolvers: Array<(value: string) => void> = [];
    const loader = (signal?: AbortSignal) => {
      signals.push(signal!);
      return new Promise<string>((resolve, reject) => {
        resolvers.push(resolve);
        signal?.addEventListener('abort', () => reject(abortError()));
      });
    };

    const oldLease = cache.acquire('key', loader);
    await Promise.resolve();
    cache.invalidate('key');
    expect(signals[0]!.aborted).to.equal(false);

    const newLease = cache.acquire('key', loader);
    await Promise.resolve();
    expect(signals.length).to.equal(2);
    resolvers[0]!('old');
    resolvers[1]!('new');
    expect(await oldLease.promise).to.equal('old');
    expect(await newLease.promise).to.equal('new');
    oldLease.release();
    newLease.release();
  });

  it('supports a no-store lease that neither deduplicates nor retains', async () => {
    const cache = new BoundedResourceCache<string>(2);
    let calls = 0;
    const loader = async () => String(++calls);

    const first = cache.acquire('same', loader, { cache: false });
    const second = cache.acquire('same', loader, { cache: false });
    expect(await first.promise).to.equal('1');
    expect(await second.promise).to.equal('2');
    first.release();
    second.release();
    expect(cache.size).to.equal(0);
  });
});
