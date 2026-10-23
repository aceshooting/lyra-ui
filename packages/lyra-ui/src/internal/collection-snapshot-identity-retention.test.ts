import { expect, fixture, html } from '@open-wc/testing';
import { property } from 'lit/decorators.js';
import { collectionSupport, publicCollectionTruncation } from './collection-snapshot.js';
import { LyraElement } from './lyra-element.js';
import { tag } from './prefix.js';

const ENTRY_LIMIT = 10_000;

class IdentityRetention extends LyraElement {
  protected static override collectionSupport = collectionSupport;
  protected static override readonly ownedCollectionProperties = ['registry', 'members'];
  protected static override readonly identityCollectionProperties = ['registry', 'members'];

  @property({ attribute: false }) registry: ReadonlyMap<number, object> = new Map();
  @property({ attribute: false }) members: ReadonlySet<object> = new Set();
}
customElements.define(tag('identity-retention-test'), IdentityRetention);

class RefreshableIdentityRetention extends LyraElement {
  protected static override collectionSupport = collectionSupport;
  protected static override readonly ownedCollectionProperties = ['registry', 'members'];
  protected static override readonly identityCollectionProperties = ['registry', 'members'];
  protected static readonly ownedCollectionLimits = {
    registry: { entries: 2 }, members: { entries: 2 },
  };

  @property({ attribute: false, hasChanged: () => true }) registry: ReadonlyMap<number, object> = new Map();
  @property({ attribute: false, hasChanged: () => true }) members: ReadonlySet<object> = new Set();
}
customElements.define(tag('refreshable-identity-retention-test'), RefreshableIdentityRetention);

/** Runs `action` with `console.warn` captured (the dev truncation notice) and restores it. */
function withCapturedWarnings(action: () => void): string[] {
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (...args: unknown[]) => { warnings.push(args.map(String).join(' ')); };
  try {
    action();
  } finally {
    console.warn = original;
  }
  return warnings;
}

describe('identity collection retention after a truncated assignment', () => {
  it('preserves source loss when a custom change detector refreshes retained Map and Set snapshots', () => {
    const el = new RefreshableIdentityRetention();
    const rows = [{ value: 1 }, { value: 2 }, { value: 3 }];
    withCapturedWarnings(() => {
      el.registry = new Map(rows.map((row, index) => [index, row]));
      el.members = new Set(rows);
    });
    const registry = el.registry;
    const members = el.members;
    rows[0]!.value = 4;
    withCapturedWarnings(() => {
      el.registry = registry;
      el.members = members;
    });
    expect(el.registry === registry).to.equal(false);
    expect(el.members === members).to.equal(false);
    expect(el.registry.get(0) === rows[0]).to.equal(true);
    expect(el.members.has(rows[0]!)).to.equal(true);
    expect([...el.registry.values()]).to.deep.equal(rows.slice(0, 2));
    expect([...el.members]).to.deep.equal(rows.slice(0, 2));
    for (const property of ['registry', 'members']) {
      expect(publicCollectionTruncation(el, property)).to.deep.equal({
        kept: 'oldest', retained: 2, source: 3,
      });
    }
  });
  it('keeps reporting the original Map size when the retained snapshot is reassigned', async () => {
    const el = await fixture<IdentityRetention>(html`<lr-identity-retention-test></lr-identity-retention-test>`);
    const source = new Map<number, object>();
    for (let index = 0; index <= ENTRY_LIMIT; index += 1) source.set(index, {});
    const warnings = withCapturedWarnings(() => { el.registry = source; });
    expect(warnings).to.have.length(1);
    expect(publicCollectionTruncation(el, 'registry')).to.deep.equal({
      kept: 'oldest', retained: ENTRY_LIMIT, source: ENTRY_LIMIT + 1,
    });
    expect(el.registry.size).to.equal(ENTRY_LIMIT);

    // Declarative renderers round-trip the getter's value; the loss disclosure must survive it.
    withCapturedWarnings(() => { el.registry = el.registry; });
    const report = publicCollectionTruncation(el, 'registry');
    expect(report?.source).to.equal(ENTRY_LIMIT + 1);
    expect(report?.retained).to.equal(ENTRY_LIMIT);
    expect(el.registry.size).to.equal(ENTRY_LIMIT);
  });

  it('keeps reporting the original Set size when the retained snapshot is reassigned', async () => {
    const el = await fixture<IdentityRetention>(html`<lr-identity-retention-test></lr-identity-retention-test>`);
    const source = new Set<object>();
    for (let index = 0; index <= ENTRY_LIMIT; index += 1) source.add({});
    withCapturedWarnings(() => { el.members = source; });
    expect(publicCollectionTruncation(el, 'members')?.source).to.equal(ENTRY_LIMIT + 1);
    expect(el.members.size).to.equal(ENTRY_LIMIT);

    withCapturedWarnings(() => { el.members = el.members; });
    const report = publicCollectionTruncation(el, 'members');
    expect(report?.source).to.equal(ENTRY_LIMIT + 1);
    expect(report?.retained).to.equal(ENTRY_LIMIT);
    expect(el.members.size).to.equal(ENTRY_LIMIT);
  });
});
