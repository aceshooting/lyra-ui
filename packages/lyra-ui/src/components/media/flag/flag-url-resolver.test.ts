import { expect } from '@open-wc/testing';
import { loadBulkFlagUrl } from './flag-url-resolver.js';

for (const [name, result] of [
  ['missing', undefined], ['null', null], ['object', {}], ['string', 'not a resolver'],
] as const) {
  for (const asynchronous of [false, true]) {
    it(`rejects a ${name} resolver returned by a ${asynchronous ? 'promise-returning' : 'synchronous'} bulk factory`, async () => {
      const warn = console.warn, warnings: string[] = [];
      console.warn = (...args: unknown[]) => {
        if (typeof args[0] === 'string' && args[0].startsWith('<lr-flag>')) warnings.push(args[0]);
        else warn(...args);
      };
      try {
        const resolver = await loadBulkFlagUrl(async () => ({
          createFlagUrlResolver: () => asynchronous ? Promise.resolve(result) : result,
        }));
        expect(resolver).to.equal(null);
        expect(warnings.length).to.equal(1);
        expect(warnings[0]).to.include('createFlagUrlResolver');
        expect(warnings[0]).to.include('version mismatch');
      } finally { console.warn = warn; }
    });
  }
}

it('contains a bulk factory initialization rejection and allows a later successful load', async () => {
  const warn = console.warn, warnings: string[] = [];
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith('<lr-flag>')) warnings.push(args[0]);
    else warn(...args);
  };
  try {
    const rejected = await loadBulkFlagUrl(async () => ({
      createFlagUrlResolver: async () => { throw new Error('Resolver table unavailable'); },
    }));
    expect(rejected).to.equal(null);
    expect(warnings.length).to.equal(1);
    expect(warnings[0]).to.include('version mismatch');
    const resolve = async (code: string): Promise<string> => `/flags/${code}.svg`;
    expect(await loadBulkFlagUrl(async () => ({ createFlagUrlResolver: async () => resolve }))).to.equal(resolve);
    expect(warnings.length).to.equal(1);
  } finally { console.warn = warn; }
});
