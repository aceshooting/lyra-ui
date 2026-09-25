import { expect } from '@open-wc/testing';
import {
  EMPTY_REDACTION_PATHS,
  MAX_REDACTION_DEPTH,
  MAX_REDACTION_NODES,
  MAX_REDACTION_PATHS,
  MAX_REDACTION_PATH_CHARACTERS,
  TOO_MANY_REDACTION_PATHS,
  projectedRedactionFields,
  redactField,
  redactToolDetail,
} from './tool-redaction.js';

const HIDDEN = 'Value hidden';

function countingProxy<T extends object>(target: T): { proxy: T; reads: () => number } {
  let count = 0;
  const proxy = new Proxy(target, {
    get(object, key, receiver) {
      count++;
      return Reflect.get(object, key, receiver);
    },
    ownKeys(object) {
      count++;
      return Reflect.ownKeys(object);
    },
    getOwnPropertyDescriptor(object, key) {
      count++;
      return Reflect.getOwnPropertyDescriptor(object, key);
    },
    getPrototypeOf(object) {
      count++;
      return Reflect.getPrototypeOf(object);
    },
    has(object, key) {
      count++;
      return Reflect.has(object, key);
    },
  });
  return { proxy, reads: () => count };
}

describe('tool redaction', () => {
  it('keeps the documented ceilings', () => {
    expect([MAX_REDACTION_PATHS, MAX_REDACTION_DEPTH, MAX_REDACTION_NODES, MAX_REDACTION_PATH_CHARACTERS]).to.deep.equal([
      100, 64, 10_000, 4_096,
    ]);
    expect(TOO_MANY_REDACTION_PATHS.length).to.equal(MAX_REDACTION_PATHS + 1);
    expect(Object.isFrozen(EMPTY_REDACTION_PATHS)).to.equal(true);
  });

  it('projects redaction paths through own data descriptors only', () => {
    expect(projectedRedactionFields(undefined)).to.equal(EMPTY_REDACTION_PATHS);
    expect(projectedRedactionFields('args')).to.equal(EMPTY_REDACTION_PATHS);
    expect([...(projectedRedactionFields(['args.apiKey', 'error']) ?? [])]).to.deep.equal(['args.apiKey', 'error']);
    expect(projectedRedactionFields(new Array(101).fill('args'))).to.equal(TOO_MANY_REDACTION_PATHS);

    let accessorRan = false;
    const hostile: string[] = ['args'];
    Object.defineProperty(hostile, 0, {
      get() {
        accessorRan = true;
        return 'args';
      },
    });
    expect(projectedRedactionFields(hostile)).to.equal(undefined);
    expect(accessorRan).to.equal(false);
  });

  it('masks nested fields, walks arrays by index, and leaves dangling paths as no-ops', () => {
    const args = { query: 'lyra', apiKey: 'secret', nested: { keep: 1 } };
    const masked = redactField(args, 'args', ['args.apiKey', 'args.missing.deep'], HIDDEN) as Record<string, unknown>;
    expect(masked['apiKey']).to.equal(HIDDEN);
    expect(masked['query']).to.equal('lyra');
    expect(masked['nested']).to.equal(args.nested);
    expect(Object.getPrototypeOf(masked)).to.equal(null);
    expect(args.apiKey, 'the caller payload is never mutated').to.equal('secret');

    const rows = redactField({ rows: [{ ssn: '1' }, { ssn: '2' }] }, 'result', ['result.rows.1.ssn'], HIDDEN) as {
      rows: Array<Record<string, unknown>>;
    };
    expect(rows.rows[0]?.['ssn']).to.equal('1');
    expect(rows.rows[1]?.['ssn']).to.equal(HIDDEN);

    expect(redactField(args, 'args', ['result.rows'], HIDDEN), 'another root is untouched').to.equal(args);
    expect(redactField('boom', 'error', ['error'], HIDDEN)).to.equal(HIDDEN);
  });

  it('fails closed to the placeholder at every ceiling', () => {
    const value = { a: 1 };
    expect(redactField(value, 'args', new Array(101).fill('args.a'), HIDDEN), '101 paths').to.equal(HIDDEN);
    expect(redactField(value, 'args', [`args.${'x'.repeat(4_092)}`], HIDDEN), '4,097-char path').to.equal(HIDDEN);
    expect(redactField(value, 'args', [`args.${'x'.repeat(4_091)}`], HIDDEN), '4,096-char path is admitted').to.not.equal(
      HIDDEN,
    );
    const deepPath = ['args', ...new Array<string>(65).fill('d')].join('.');
    expect(redactField(value, 'args', [deepPath], HIDDEN), 'depth 65').to.equal(HIDDEN);
    expect(redactField(value, 'args', [7], HIDDEN), 'a non-string path').to.equal(HIDDEN);

    const wide = { items: Array.from({ length: 10_001 }, (_, index) => ({ index })) };
    const masked = redactField(wide, 'args', ['args.items.10000.index'], HIDDEN) as Record<string, unknown>;
    expect(masked['items'], 'a walk past 10,000 nodes masks the branch it was visiting').to.equal(HIDDEN);
  });

  it('memoizes on all five inputs and performs no payload reads on a hit', () => {
    const counted = countingProxy({ apiKey: 'secret', query: 'lyra' });
    const result = { token: 't' };
    const paths = Object.freeze(['args.apiKey', 'result.token']);
    const first = redactToolDetail({ args: counted.proxy, result, error: 'bad' }, paths, HIDDEN);
    expect((first.args as Record<string, unknown>)['apiKey']).to.equal(HIDDEN);
    expect((first.result as Record<string, unknown>)['token']).to.equal(HIDDEN);
    expect(first.error).to.equal('bad');
    expect(Object.isFrozen(first)).to.equal(true);

    const readsAfterFirst = counted.reads();
    expect(readsAfterFirst).to.be.greaterThan(0);
    const hit = redactToolDetail({ args: counted.proxy, result, error: 'bad' }, paths, HIDDEN, first);
    expect(hit === first).to.equal(true);
    expect(counted.reads(), 'a memo hit reads nothing from the payload').to.equal(readsAfterFirst);

    const misses = [
      redactToolDetail({ args: { ...counted.proxy }, result, error: 'bad' }, paths, HIDDEN, first),
      redactToolDetail({ args: counted.proxy, result: { token: 't' }, error: 'bad' }, paths, HIDDEN, first),
      redactToolDetail({ args: counted.proxy, result, error: 'worse' }, paths, HIDDEN, first),
      redactToolDetail({ args: counted.proxy, result, error: 'bad' }, Object.freeze([...paths]), HIDDEN, first),
      redactToolDetail({ args: counted.proxy, result, error: 'bad' }, paths, 'Masqué', first),
    ];
    expect(misses.map((detail) => detail === first)).to.deep.equal([false, false, false, false, false]);
    expect((misses[4]!.args as Record<string, unknown>)['apiKey']).to.equal('Masqué');
  });

  it('passes an undefined result or error through and returns original references when nothing matches', () => {
    const args = { query: 'lyra' };
    const detail = redactToolDetail({ args, result: undefined, error: undefined }, Object.freeze(['result', 'error']), HIDDEN);
    expect(detail.result).to.equal(undefined);
    expect(detail.error).to.equal(undefined);
    expect(detail.args === args).to.equal(true);

    const unredacted = redactToolDetail({ args, result: args, error: 'x' }, EMPTY_REDACTION_PATHS, HIDDEN);
    expect(unredacted.args === args && unredacted.result === args).to.equal(true);
    expect(unredacted.error).to.equal('x');

    const failClosed = redactToolDetail({ args, result: { a: 1 }, error: 'x' }, TOO_MANY_REDACTION_PATHS, HIDDEN);
    expect([failClosed.args, failClosed.result, failClosed.error]).to.deep.equal([HIDDEN, HIDDEN, HIDDEN]);
  });
});
