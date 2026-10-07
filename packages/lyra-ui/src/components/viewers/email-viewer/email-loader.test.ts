import { expect } from '@open-wc/testing';
import { clearEmailDepsCache, getEmailDepsIfLoaded, loadEmailAndSanitizer, loadEmailDeps } from './email-loader.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';

afterEach(() => clearEmailDepsCache());

describe('email loader', () => {
  it('loads the real postal-mime and DOMPurify APIs', async () => {
    const deps = await loadEmailDeps();
    expect(deps.PostalMime?.parse).to.exist;
    expect(deps.DOMPurify?.sanitize).to.exist;
  });

  it('caches the resolved object and exposes it synchronously', async () => {
    const first = await loadEmailDeps();
    const second = await loadEmailDeps();
    expect(first).to.equal(second);
    expect(getEmailDepsIfLoaded()).to.equal(second);
  });

  it('accepts a bare module namespace that already satisfies the capability, with no .default wrapper', async () => {
    // postal-mime and DOMPurify both appear as a namespace carrying the named API directly under
    // some bundler/CJS-interop configurations. resolveOptionalPeerCapability() checks that
    // namespace BEFORE `.default`; every other case in this file wraps its fake in
    // `{ default: ... }`, so without this case a regression that only ever read `.default` would
    // leave both peers undefined -- silently disabling .eml parsing and HTML sanitization -- with
    // no test failing.
    const barePostalMime = { parse: () => Promise.resolve({}) };
    const bareSanitizer = { sanitize: (value: string) => value };
    const deps = await loadEmailAndSanitizer(
      () => Promise.resolve(barePostalMime),
      () => Promise.resolve(bareSanitizer),
    );
    expect(deps.PostalMime === barePostalMime).to.equal(true);
    expect(deps.DOMPurify === bareSanitizer).to.equal(true);
  });

  it('loads each peer independently', async () => {
    expectDevWarning('lyra-email-viewer-postal-mime-unavailable');
    const deps = await loadEmailAndSanitizer(
      () => Promise.reject(new Error('postal boom')),
      () => Promise.resolve({ default: { sanitize: (value: string) => value } }),
    );
    expect(deps.PostalMime).to.be.undefined;
    expect(deps.DOMPurify?.sanitize).to.exist;
  });

  it('preserves postal-mime when DOMPurify fails', async () => {
    expectDevWarning('lyra-dompurify-unavailable');
    const deps = await loadEmailAndSanitizer(
      () => Promise.resolve({ default: { parse: () => Promise.resolve({}) } }),
      () => Promise.reject(new Error('purify boom')),
    );
    expect(deps.PostalMime?.parse).to.exist;
    expect(deps.DOMPurify).to.be.undefined;
  });

  it('starts both peer imports together', async () => {
    const started: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const pending = loadEmailAndSanitizer(
      async () => { started.push('postal-mime'); await gate; return { parse: () => Promise.resolve({}) }; },
      async () => { started.push('dompurify'); await gate; return { sanitize: (value: string) => value }; },
    );
    await Promise.resolve();
    expect(started).to.deep.equal(['postal-mime', 'dompurify']);
    release();
    await pending;
  });
});
