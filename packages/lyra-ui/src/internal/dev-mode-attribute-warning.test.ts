import { expect } from '@open-wc/testing';
import {
  deprecationWarningKey,
  warnDeprecatedUsage,
  warnUnknownAttributes,
} from './dev-mode-attribute-warning.js';
import {
  captureDeprecationWarnings,
  expectDeprecatedUsage,
} from '../../test/expected-deprecations.js';

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
    expect(warnStub.calls[0]![0]).to.contain('totally-unrelated-name');
    expect(warnStub.calls[0]![0]).to.not.contain('did you mean');
  });

  it('stays silent for an attribute the element owns without observing', () => {
    withDevMode();
    const host = document.createElement('lr-fake-tag');
    // Self-reflected read-only state, e.g. <lr-animated-image playing>.
    host.setAttribute('playing', '');
    // A CSS-only public attribute, e.g. <lr-page disable-sticky="header">.
    host.setAttribute('disable-sticky', 'header');
    warnUnknownAttributes(host, ['play'], ['playing', 'disable-sticky']);
    expect(warnStub.calls).to.have.length(0);
  });

  it('still warns about a genuine typo sitting alongside a declared unobserved attribute', () => {
    withDevMode();
    const host = document.createElement('lr-fake-tag');
    host.setAttribute('playing', '');
    host.setAttribute('disable-stikcy', 'header');
    warnUnknownAttributes(host, ['play'], ['playing', 'disable-sticky']);
    expect(warnStub.calls).to.have.length(1);
    expect(warnStub.calls[0]![0]).to.contain('disable-stikcy');
  });

  it('treats an omitted knownUnobservedAttributes list as empty', () => {
    withDevMode();
    const host = document.createElement('lr-fake-tag');
    host.setAttribute('playing', '');
    warnUnknownAttributes(host, ['play']);
    expect(warnStub.calls).to.have.length(1);
    expect(warnStub.calls[0]![0]).to.contain('playing');
  });

  it('suggests the closest observed attribute when one is close enough', () => {
    withDevMode();
    const host = document.createElement('lr-fake-tag');
    host.setAttribute('hide-axi', '');
    warnUnknownAttributes(host, ['hide-axis', 'without-value-axis']);
    expect(warnStub.calls).to.have.length(1);
    expect(warnStub.calls[0]![0]).to.contain("did you mean 'hide-axis'");
  });

  it('never suggests a match further than the distance threshold', () => {
    withDevMode();
    const host = document.createElement('lr-fake-tag');
    host.setAttribute('zzzzzzzzzz', '');
    warnUnknownAttributes(host, ['hide-axis']);
    expect(warnStub.calls).to.have.length(1);
    expect(warnStub.calls[0]![0]).to.not.contain('did you mean');
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

  it('exempts Angular emulated-encapsulation scoping attributes (_ngcontent-*/_nghost-*)', () => {
    withDevMode();
    const host = document.createElement('lr-fake-tag');
    // Pre-Ivy-stable and current Angular id shapes, on both content and host markers.
    host.setAttribute('_ngcontent-c0', '');
    host.setAttribute('_ngcontent-ng-c1234567890', '');
    host.setAttribute('_nghost-ng-c1234567890', '');
    warnUnknownAttributes(host, []);
    expect(warnStub.calls).to.have.length(0);
  });

  it('exempts Angular dev-mode input reflection (ng-reflect-*) and ng-version', () => {
    withDevMode();
    const host = document.createElement('lr-fake-tag');
    host.setAttribute('ng-reflect-rows', '3');
    host.setAttribute('ng-version', '18.0.0');
    warnUnknownAttributes(host, []);
    expect(warnStub.calls).to.have.length(0);
  });

  it('exempts Vue scoped-style markers (data-v-*) via the existing data-* prefix', () => {
    withDevMode();
    const host = document.createElement('lr-fake-tag');
    host.setAttribute('data-v-7ba5bd90', '');
    warnUnknownAttributes(host, []);
    expect(warnStub.calls).to.have.length(0);
  });

  it('still warns for a misspelled real attribute and an unrelated underscore attribute', () => {
    withDevMode();
    const host = document.createElement('lr-fake-tag');
    host.setAttribute('kown-attr', '');
    host.setAttribute('_foo', '');
    warnUnknownAttributes(host, ['known-attr']);
    expect(warnStub.calls).to.have.length(2);
    const messages = warnStub.calls.map((call) => call[0]);
    expect(messages.some((message) => message?.includes('kown-attr'))).to.equal(true);
    expect(messages.some((message) => message?.includes('_foo'))).to.equal(true);
  });
});

describe('warnDeprecatedUsage', () => {
  let warnStub: { calls: string[][]; restore(): void };
  let originalStore: Set<string> | undefined;

  beforeEach(() => {
    originalStore = (globalThis as LitWarningGlobal).litIssuedWarnings;
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
    (globalThis as LitWarningGlobal).litIssuedWarnings = originalStore;
    if (originalStore === undefined) clearDevMode();
  });

  it('keys one ledger record per tag', () => {
    expect(deprecationWarningKey('lr-x', 'property', 'observeAttributes')).to.equal(
      'lyra-deprecated:lr-x:property:observeAttributes'
    );
    expect(deprecationWarningKey('lr-x', 'event', 'lr-before-x')).to.equal(
      'lyra-deprecated:lr-x:event:lr-before-x'
    );
  });

  it('does nothing when litIssuedWarnings is absent (production-equivalent)', () => {
    clearDevMode();
    warnDeprecatedUsage(document.createElement('lr-fake-tag'), 'property', 'legacy', 'current');
    expect(warnStub.calls).to.have.length(0);
    expect((globalThis as LitWarningGlobal).litIssuedWarnings).to.equal(undefined);
  });

  it('warns once per tag and record, naming the element, the member and the replacement', () => {
    const warnings = withDevMode();
    const first = document.createElement('lr-fake-tag');
    const second = document.createElement('lr-fake-tag');
    warnDeprecatedUsage(first, 'property', 'legacyMode', 'mode="auto"');
    warnDeprecatedUsage(second, 'property', 'legacyMode', 'mode="auto"');
    expect(warnStub.calls).to.have.length(1);
    const message = warnStub.calls[0]![0]!;
    expect(message).to.contain('<lr-fake-tag>');
    expect(message).to.contain("deprecated property 'legacyMode'");
    expect(message).to.contain('use mode="auto"');
    expect(/\d+\.\d+\.\d+/.test(message), 'the message names no version').to.equal(false);
    expect(warnings.has('lyra-deprecated:lr-fake-tag:property:legacyMode')).to.equal(true);
  });

  it('keys by the live tag name, so another tag or a custom prefix warns separately', () => {
    withDevMode();
    warnDeprecatedUsage(document.createElement('lr-fake-tag'), 'attribute', 'area', 'fill');
    warnDeprecatedUsage(document.createElement('lr-other-tag'), 'attribute', 'area', 'fill');
    warnDeprecatedUsage(document.createElement('acme-fake-tag'), 'attribute', 'area', 'fill');
    warnDeprecatedUsage(document.createElement('lr-fake-tag'), 'property', 'area', 'fill');
    expect(warnStub.calls).to.have.length(4);
    expect(warnStub.calls[2]![0]).to.contain('<acme-fake-tag>');
  });

  it('names the record kind, name and replacement', () => {
    withDevMode();
    const host = document.createElement('lr-fake-tag');
    warnDeprecatedUsage(host, 'component', 'lr-fake-tag', '<lr-real-tag>');
    warnDeprecatedUsage(host, 'event', 'lr-before-thing', 'lr-thing-request');
    warnDeprecatedUsage(host, 'method', 'legacyReset', 'reset()');
    expect(warnStub.calls.map((call) => call[0])).to.deep.equal([
      "<lr-fake-tag>: deprecated component 'lr-fake-tag'; use <lr-real-tag>.",
      "<lr-fake-tag>: deprecated event 'lr-before-thing'; use lr-thing-request.",
      "<lr-fake-tag>: deprecated method 'legacyReset'; use reset().",
    ]);
  });

  it('types out the styling kinds, which no component can observe at runtime', () => {
    clearDevMode();
    const host = document.createElement('lr-fake-tag');
    // @ts-expect-error a deprecated CSS part is never observable, so it never warns
    warnDeprecatedUsage(host, 'part', 'area', '::part(fill)');
    // @ts-expect-error a deprecated CSS custom property is never probed for, so it never warns
    warnDeprecatedUsage(host, 'css-property', '--lr-fake-width', '--line-width');
    // @ts-expect-error a deprecated custom state is never observable, so it never warns
    warnDeprecatedUsage(host, 'css-state', 'legacy', ':state(current)');
    // @ts-expect-error slotted content is never probed for (it would ship in every bundle)
    warnDeprecatedUsage(host, 'slot-content', '', 'slot="header"');
    // @ts-expect-error the key helper shares the narrowed kind set
    deprecationWarningKey('lr-fake-tag', 'part', 'area');
    expect(warnStub.calls).to.have.length(0);
  });
});

describe('expected-deprecations test helpers', () => {
  let originalStore: Set<string> | undefined;
  let originalWarn: typeof console.warn;

  beforeEach(() => {
    originalStore = (globalThis as LitWarningGlobal).litIssuedWarnings;
    originalWarn = console.warn;
  });

  afterEach(() => {
    console.warn = originalWarn;
    (globalThis as LitWarningGlobal).litIssuedWarnings = originalStore;
    if (originalStore === undefined) clearDevMode();
  });

  it('seeds exactly one record key into an existing store and never creates one', () => {
    clearDevMode();
    expectDeprecatedUsage('lr-fake-tag', 'property', 'legacy');
    expect((globalThis as LitWarningGlobal).litIssuedWarnings).to.equal(undefined);

    const warnings = withDevMode();
    expectDeprecatedUsage('lr-fake-tag', 'event', 'lr-before-thing');
    expect([...warnings]).to.deep.equal(['lyra-deprecated:lr-fake-tag:event:lr-before-thing']);
  });

  it('re-arms a seeded record for the body, captures it, then restores the seed', async () => {
    const warnings = withDevMode();
    expectDeprecatedUsage('lr-fake-tag', 'property', 'legacy');
    const host = document.createElement('lr-fake-tag');
    const captured = await captureDeprecationWarnings(
      [{ tag: 'lr-fake-tag', kind: 'property', name: 'legacy' }],
      async () => {
        warnDeprecatedUsage(host, 'property', 'legacy', 'current');
        warnDeprecatedUsage(host, 'property', 'legacy', 'current');
        await Promise.resolve();
      }
    );
    expect(captured.map((entry) => entry.key)).to.deep.equal([
      'lyra-deprecated:lr-fake-tag:property:legacy',
    ]);
    expect(captured[0]!.message).to.contain("deprecated property 'legacy'");
    expect(warnings.has('lyra-deprecated:lr-fake-tag:property:legacy')).to.equal(true);
    expect(console.warn === originalWarn, 'console.warn restored').to.equal(true);
  });

  it('forwards unrelated warnings and forgets deprecations first issued inside the body', async () => {
    const warnings = withDevMode();
    const forwarded: string[] = [];
    console.warn = (...args: unknown[]) => {
      forwarded.push(args.map(String).join(' '));
    };
    const previous = console.warn;
    const host = document.createElement('lr-fake-tag');
    const captured = await captureDeprecationWarnings([], () => {
      console.warn('an unrelated diagnostic');
      warnDeprecatedUsage(host, 'event', 'lr-before-thing', 'lr-thing-request');
    });
    expect(forwarded).to.deep.equal(['an unrelated diagnostic']);
    expect(captured.map((entry) => entry.key)).to.deep.equal([
      'lyra-deprecated:lr-fake-tag:event:lr-before-thing',
    ]);
    expect(warnings.has('lyra-deprecated:lr-fake-tag:event:lr-before-thing')).to.equal(false);
    expect(console.warn === previous, 'console.warn restored').to.equal(true);
  });

  it('enables the diagnostics for the body when no store exists, then removes it', async () => {
    clearDevMode();
    const captured = await captureDeprecationWarnings([], () => {
      warnDeprecatedUsage(document.createElement('lr-fake-tag'), 'property', 'legacy', 'current');
    });
    expect(captured).to.have.length(1);
    expect((globalThis as LitWarningGlobal).litIssuedWarnings).to.equal(undefined);
  });

  it('restores console.warn and the store when the body throws', async () => {
    const warnings = withDevMode();
    expectDeprecatedUsage('lr-fake-tag', 'property', 'legacy');
    let failure = '';
    try {
      await captureDeprecationWarnings(
        [{ tag: 'lr-fake-tag', kind: 'property', name: 'legacy' }],
        () => {
          throw new Error('body failed');
        }
      );
    } catch (error) {
      failure = (error as Error).message;
    }
    expect(failure).to.equal('body failed');
    expect(console.warn === originalWarn, 'console.warn restored').to.equal(true);
    expect(warnings.has('lyra-deprecated:lr-fake-tag:property:legacy')).to.equal(true);
  });
});
