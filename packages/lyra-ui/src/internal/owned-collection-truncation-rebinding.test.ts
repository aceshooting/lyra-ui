import { expect, fixture, html } from '@open-wc/testing';
import { property } from 'lit/decorators.js';
import type { PropertyValues, TemplateResult } from 'lit';
import { LyraElement } from './lyra-element.js';
import { collectionSupport, collectionTruncationWarningKey, publicCollectionTruncation } from './collection-snapshot.js';
import { expectDevWarning } from '../../test/expected-dev-warnings.js';
import { tag } from './prefix.js';

class LossRebindingDemo extends LyraElement {
  protected static override collectionSupport = collectionSupport;
  protected static override readonly ownedCollectionProperties = ['rows'];
  protected static override readonly identityCollectionProperties = ['rows'];
  protected static readonly ownedCollectionLimits = { rows: { entries: 2 } };
  @property({ attribute: false }) rows: readonly { label: string }[] = [];
  rowUpdates = 0;
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('rows')) this.rowUpdates++;
  }
  override render(): TemplateResult { return html`<span>${this.rows[0]?.label}</span>`; }
}
class DeepLossRebindingDemo extends LyraElement {
  protected static override collectionSupport = collectionSupport;
  protected static override readonly ownedCollectionProperties = ['rows'];
  protected static readonly ownedCollectionLimits = { rows: { entries: 2 } };
  @property({ attribute: false }) rows: readonly { label: string }[] = [];
  rowUpdates = 0;
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('rows')) this.rowUpdates++;
  }
}
class AccessorLossRebindingDemo extends LyraElement {
  protected static readonly appendOrderedCollectionProperties = ['rows'];
  protected static override collectionSupport = collectionSupport;
  protected static override readonly ownedCollectionProperties = ['rows'];
  protected static override readonly identityCollectionProperties = ['rows'];
  protected static readonly ownedCollectionLimits = { rows: { entries: 2 } };
  private storedRows: { label: string }[] = [];
  @property({ attribute: false })
  get rows(): { label: string }[] { return this.storedRows; }
  set rows(value: readonly { label: string }[]) {
    const previous = this.storedRows;
    this.storedRows = [...value];
    this.requestUpdate('rows', previous);
  }
}
class ObjectPassThroughLossDemo extends LyraElement {
  protected static override collectionSupport = collectionSupport;
  protected static override readonly ownedCollectionProperties = ['rows'];
  protected static override readonly identityCollectionObjectProperties = ['rows'];
  protected static readonly ownedCollectionLimits = { rows: { entries: 2 } };
  @property({ attribute: false }) rows: unknown = [];
}
customElements.define(tag('object-pass-through-loss-demo'), ObjectPassThroughLossDemo);
expectDevWarning(collectionTruncationWarningKey(tag('object-pass-through-loss-demo'), 'rows'));
class ExplicitDeepLossRebindingDemo extends DeepLossRebindingDemo {
  @property({ attribute: false, hasChanged: () => true }) override rows: readonly { label: string }[] = [];
}
customElements.define(tag('explicit-deep-loss-rebinding-demo'), ExplicitDeepLossRebindingDemo);
expectDevWarning(collectionTruncationWarningKey(tag('explicit-deep-loss-rebinding-demo'), 'rows'));
customElements.define(tag('loss-rebinding-demo'), LossRebindingDemo);
customElements.define(tag('deep-loss-rebinding-demo'), DeepLossRebindingDemo);
customElements.define(tag('accessor-loss-rebinding-demo'), AccessorLossRebindingDemo);
for (const name of ['loss-rebinding-demo', 'deep-loss-rebinding-demo', 'accessor-loss-rebinding-demo']) {
  expectDevWarning(collectionTruncationWarningKey(tag(name), 'rows'));
}

it('keeps original loss on an exact owned identity snapshot while refreshing live row content', async () => {
  const host = await fixture<LossRebindingDemo>(html`<lr-loss-rebinding-demo></lr-loss-rebinding-demo>`);
  const source = [{ label: 'before' }, { label: 'second' }, { label: 'omitted' }];
  host.rows = source; await host.updateComplete;
  const snapshot = host.rows;
  const updates = host.rowUpdates;
  source[0]!.label = 'after';
  host.rows = snapshot; await host.updateComplete;
  expect(host.rows === snapshot).to.equal(false);
  expect(host.rowUpdates).to.equal(updates + 1);
  expect(host.shadowRoot!.textContent?.trim()).to.equal('after');
  expect(publicCollectionTruncation(host, 'rows')).to.deep.equal({ source: 3, retained: 2, kept: 'oldest' });
  host.rows = [...host.rows]; await host.updateComplete;
  expect(publicCollectionTruncation(host, 'rows')).to.equal(undefined);
});

it('recomputes provenance for the original mutable source and preserves deep-owned snapshot no-ops', async () => {
  const host = await fixture<LossRebindingDemo>(html`<lr-loss-rebinding-demo></lr-loss-rebinding-demo>`);
  const source = [{ label: 'first' }, { label: 'second' }, { label: 'third' }];
  host.rows = source; await host.updateComplete;
  source.pop(); source[0]!.label = 'current';
  host.rows = source; await host.updateComplete;
  expect(publicCollectionTruncation(host, 'rows')).to.equal(undefined);
  expect(host.shadowRoot!.textContent?.trim()).to.equal('current');
  const deep = await fixture<DeepLossRebindingDemo>(html`<lr-deep-loss-rebinding-demo></lr-deep-loss-rebinding-demo>`);
  deep.rows = [...source, { label: 'third' }]; await deep.updateComplete;
  const snapshot = deep.rows; const updates = deep.rowUpdates;
  deep.rows = snapshot; await deep.updateComplete;
  expect(deep.rows === snapshot).to.equal(true);
  expect(deep.rowUpdates).to.equal(updates);
  expect(publicCollectionTruncation(deep, 'rows')).to.deep.equal({ source: 3, retained: 2, kept: 'oldest' });
});

it('combines original source provenance with newly limited accessor-backed snapshot admission', async () => {
  const host = await fixture<AccessorLossRebindingDemo>(html`<lr-accessor-loss-rebinding-demo></lr-accessor-loss-rebinding-demo>`);
  host.rows = Array.from({ length: 8 }, (_, index) => ({ label: String(index) }));
  await host.updateComplete;
  const snapshot = host.rows;
  snapshot.push({ label: 'new' });
  host.rows = snapshot; await host.updateComplete;
  expect(host.rows.length).to.equal(2);
  expect(publicCollectionTruncation(host, 'rows')).to.deep.equal({ source: 8, retained: 2, kept: 'newest' });
  host.rows.pop(); host.rows = host.rows; await host.updateComplete;
  expect(publicCollectionTruncation(host, 'rows')).to.deep.equal({ source: 8, retained: 1, kept: 'newest' });
});

it('excludes raw object-identity pass-through policy from snapshot provenance inheritance', async () => {
  const host = await fixture<ObjectPassThroughLossDemo>(html`<lr-object-pass-through-loss-demo></lr-object-pass-through-loss-demo>`);
  host.rows = ['first', 'second', 'third']; await host.updateComplete;
  expect(publicCollectionTruncation(host, 'rows')?.source).to.equal(3);
  host.rows = host.rows; await host.updateComplete;
  expect(publicCollectionTruncation(host, 'rows')).to.equal(undefined);
  const object = { mode: 'raw' };
  host.rows = object; await host.updateComplete;
  expect(host.rows === object).to.equal(true);
});

it('preserves rejected-hole retained counts when an explicit deep change detector refreshes an owned snapshot', async () => {
  const host = await fixture<ExplicitDeepLossRebindingDemo>(html`<lr-explicit-deep-loss-rebinding-demo></lr-explicit-deep-loss-rebinding-demo>`);
  let reads = 0;
  const source = [{ label: 'kept' }, { label: 'rejected' }];
  Object.defineProperty(source, 1, { get() { reads++; return { label: 'unsafe' }; } });
  host.rows = source; await host.updateComplete;
  expect(publicCollectionTruncation(host, 'rows')).to.deep.equal({ source: 2, retained: 1, kept: 'oldest' });
  expect(host.rows.length).to.equal(2);
  expect(Object.hasOwn(host.rows, 1)).to.equal(false);
  host.rows = host.rows; await host.updateComplete;
  expect(publicCollectionTruncation(host, 'rows')).to.deep.equal({ source: 2, retained: 1, kept: 'oldest' });
  expect(reads).to.equal(0);
});
