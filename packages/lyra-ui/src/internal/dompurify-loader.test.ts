import { expect } from '@open-wc/testing';
import { expectDevWarning } from '../../test/expected-dev-warnings.js';
import { clearDompurifyCache, loadDompurify } from './dompurify-loader.js';

describe('loadDompurify', () => {
  afterEach(() => clearDompurifyCache());

  it('loads and caches the real sanitizer, shared across every caller', async () => {
    const first = await loadDompurify();
    expect(first !== null).to.equal(true);
    expect(String(first!.sanitize('<img src=x onerror=alert(1)>'))).to.not.contain('onerror');
    expect((await loadDompurify()) === first).to.equal(true);
  });

  it('accepts an injected importer in either module shape and rejects a non-sanitizer', async () => {
    const fake = { sanitize: (input: string) => input };
    expect((await loadDompurify(() => Promise.resolve({ default: fake }))) === fake).to.equal(true);
    expect((await loadDompurify(() => Promise.resolve(fake))) === fake).to.equal(true);
    expectDevWarning('lyra-dompurify-unavailable');
    expect((await loadDompurify(() => Promise.resolve({ default: { sanitize: true } }))) === null).to.equal(true);
  });
});
