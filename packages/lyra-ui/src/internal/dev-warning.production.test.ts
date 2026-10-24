import { expect } from '@open-wc/testing';
import { captureDeprecationWarnings } from '../../test/expected-deprecations.js';
import * as development from './dev-warning.development.js';
import * as production from './dev-warning.production.js';

describe('production diagnostics entry', () => {
  /** Runs `body` while recording every `console.warn`, restoring the real one afterwards. */
  function warningsWhile(body: () => void): string[] {
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
    try {
      body();
    } finally {
      console.warn = original;
    }
    return warnings;
  }

  it('keeps every diagnostic callable and silent, without allocating warning state', () => {
    expect(production.litDevWarnings()).to.equal(undefined);
    const warnings = warningsWhile(() => {
      production.devWarn('message');
      production.devWarnOnce('key', 'message');
      production.warnLocaleFallback('fr', 'key');
      production.warnDeprecatedUsage(document.createElement('div'), 'property', 'legacy', 'modern');
      production.warnDeprecatedUsage('lyra-ui/legacy', 'function', 'legacy', 'modern');
    });
    expect(warnings).to.deep.equal([]);
  });

  it('is silent where the development entry speaks, on the same inputs', () => {
    const warnings = warningsWhile(() => development.devWarn('visible in development'));
    expect(warnings).to.deep.equal(['visible in development']);
  });

  it('names a deprecation exactly as the development entry keys it', async () => {
    const usage = { tag: 'lr-probe', kind: 'attribute', name: 'legacy' } as const;
    const captured = await captureDeprecationWarnings([usage], () => {
      development.warnDeprecatedUsage(document.createElement('lr-probe'), usage.kind, usage.name, 'modern');
    });
    const key = production.deprecationWarningKey(usage.tag, usage.kind, usage.name);
    expect(key).to.equal('lyra-deprecated:lr-probe:attribute:legacy');
    expect(captured.map((warning) => warning.key)).to.deep.equal([key]);
  });
});
