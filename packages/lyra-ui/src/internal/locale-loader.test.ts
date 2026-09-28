import { expect } from '@open-wc/testing';
import * as loaderModule from './locale-loader.js';

const createLoader = (loaderModule as unknown as {
  createLocaleLoader: (loaders: Readonly<Record<string, () => Promise<unknown>>>) => (locale: string) => Promise<void>;
}).createLocaleLoader;

it('shares canonical in-flight and completed catalog loads without selecting the locale', async () => {
  let calls = 0;
  let settle!: () => void;
  const load = createLoader({ 'pt-BR': () => { calls++; return new Promise<void>((resolve) => { settle = resolve; }); } });
  const first = load('pt_br');
  const second = load('PT-BR');
  expect(first === second).to.equal(true);
  await Promise.resolve();
  expect(calls).to.equal(1);
  settle();
  await first;
  expect(load('pt-BR') === first).to.equal(true);
});

it('evicts both synchronous callback failures and rejected imports so retry is possible', async () => {
  let calls = 0;
  const load = createLoader({ fr: () => {
    calls++;
    if (calls === 1) throw new Error('sync failure');
    if (calls === 2) return Promise.reject(new Error('async failure'));
    return Promise.resolve();
  } });
  for (let index = 0; index < 2; index++) {
    let rejected = false;
    await load('fr').catch(() => { rejected = true; });
    expect(rejected).to.equal(true);
  }
  await load('fr');
  expect(calls).to.equal(3);
});

it('handles only exact shipped canonical tags and treats English as an immediate no-op', async () => {
  let calls = 0;
  const load = createLoader({ fr: () => { calls++; return Promise.resolve(); } });
  await load('EN');
  for (const locale of ['fr-CA', 'en-GB', '__proto__', '', '!', null as never]) {
    let rejected = false;
    await load(locale).catch(() => { rejected = true; });
    expect(rejected, String(locale)).to.equal(true);
  }
  expect(calls).to.equal(0);
});
