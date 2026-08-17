import { expect } from '@open-wc/testing';
import { warnUnknownAttributes } from './dev-mode-attribute-warning.js';

type LitWarningGlobal = { litIssuedWarnings?: Set<string> };

function withDevMode(): Set<string> {
  const warnings = new Set<string>();
  (globalThis as LitWarningGlobal).litIssuedWarnings = warnings;
  return warnings;
}

function clearDevMode(): void {
  delete (globalThis as LitWarningGlobal).litIssuedWarnings;
}

describe('warnUnknownAttributes', () => {
  let warnStub: { calls: string[][]; restore(): void };

  beforeEach(() => {
    const original = console.warn;
    const calls: string[][] = [];
    console.warn = (...args: unknown[]) => {
      calls.push(args.map(String));
    };
    warnStub = {
      calls,
      restore: () => {
        console.warn = original;
      },
    };
  });

  afterEach(() => {
    warnStub.restore();
    clearDevMode();
  });

  it('does nothing when litIssuedWarnings is absent (production-equivalent)', () => {
    clearDevMode();
    const host = document.createElement('div');
    host.setAttribute('totally-unknown', '');
    warnUnknownAttributes(host, ['known-attr']);
    expect(warnStub.calls).to.have.length(0);
  });

  it('warns once for a genuinely unknown attribute, dev mode on', () => {
    withDevMode();
    const host = document.createElement('lr-fake-tag');
    host.setAttribute('totally-unrelated-name', '');
    warnUnknownAttributes(host, ['known-attr']);
    expect(warnStub.calls).to.have.length(1);
    expect(warnStub.calls[0][0]).to.contain('totally-unrelated-name');
    expect(warnStub.calls[0][0]).to.not.contain('did you mean');
  });

  it('suggests the closest observed attribute when one is close enough', () => {
    withDevMode();
    const host = document.createElement('lr-fake-tag');
    host.setAttribute('hide-axi', '');
    warnUnknownAttributes(host, ['hide-axis', 'without-value-axis']);
    expect(warnStub.calls).to.have.length(1);
    expect(warnStub.calls[0][0]).to.contain("did you mean 'hide-axis'");
  });

  it('never suggests a match further than the distance threshold', () => {
    withDevMode();
    const host = document.createElement('lr-fake-tag');
    host.setAttribute('zzzzzzzzzz', '');
    warnUnknownAttributes(host, ['hide-axis']);
    expect(warnStub.calls).to.have.length(1);
    expect(warnStub.calls[0][0]).to.not.contain('did you mean');
  });

  it('never warns for an attribute already in observedAttributes', () => {
    withDevMode();
    const host = document.createElement('lr-fake-tag');
    host.setAttribute('known-attr', '');
    warnUnknownAttributes(host, ['known-attr']);
    expect(warnStub.calls).to.have.length(0);
  });

  it('exempts data-*, aria-*, and the hardcoded global attribute list', () => {
    withDevMode();
    const host = document.createElement('lr-fake-tag');
    for (const name of [
      'data-testid',
      'aria-expanded',
      'id',
      'hidden',
      'tabindex',
      'title',
      'role',
      'part',
    ]) {
      host.setAttribute(name, '');
    }
    warnUnknownAttributes(host, []);
    expect(warnStub.calls).to.have.length(0);
  });

  it('warns only once per (tag, name) across multiple calls', () => {
    withDevMode();
    const first = document.createElement('lr-fake-tag');
    first.setAttribute('bogus-attr', '');
    const second = document.createElement('lr-fake-tag');
    second.setAttribute('bogus-attr', '');
    warnUnknownAttributes(first, []);
    warnUnknownAttributes(second, []);
    expect(warnStub.calls).to.have.length(1);
  });
});
