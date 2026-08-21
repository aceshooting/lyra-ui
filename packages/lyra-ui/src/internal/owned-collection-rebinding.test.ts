import { expect, fixture, html } from '@open-wc/testing';
import { property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import { LyraElement } from './lyra-element.js';
import { tag } from './prefix.js';

interface OwnedRow {
  readonly label: string;
  readonly nested: Readonly<{ value: number }>;
}

class OwnedCollectionRebindingDemo extends LyraElement {
  protected static override readonly ownedCollectionProperties = Object.freeze(['rows']);

  @property({ attribute: false }) rows: readonly OwnedRow[] = [];
  rowUpdates = 0;

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('rows')) this.rowUpdates += 1;
  }
}
customElements.define(tag('owned-collection-rebinding-demo'), OwnedCollectionRebindingDemo);

class ExplicitCollectionChangeDemo extends OwnedCollectionRebindingDemo {
  @property({
    attribute: false,
    hasChanged: (value: readonly OwnedRow[], previous: readonly OwnedRow[]) =>
      !Array.isArray(value) ||
      !Array.isArray(previous) ||
      value[0]?.nested.value !== previous[0]?.nested.value,
  })
  override rows: readonly OwnedRow[] = [];
}
customElements.define(tag('explicit-collection-change-demo'), ExplicitCollectionChangeDemo);

class IdentityCollectionRebindingDemo extends LyraElement {
  protected static override readonly ownedCollectionProperties = Object.freeze(['rows']);
  protected static override readonly identityCollectionProperties = Object.freeze(['rows']);

  @property({ attribute: false }) rows: readonly { label: string }[] = [];
  rowUpdates = 0;

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('rows')) this.rowUpdates += 1;
  }
}
customElements.define(tag('identity-collection-rebinding-demo'), IdentityCollectionRebindingDemo);

class AccessorCollectionRebindingDemo extends LyraElement {
  protected static override readonly ownedCollectionProperties = Object.freeze(['rows']);

  private retainedRows: readonly OwnedRow[] = Object.freeze([]);
  writes = 0;

  @property({ attribute: false })
  get rows(): readonly OwnedRow[] {
    return this.retainedRows;
  }
  set rows(value: readonly OwnedRow[]) {
    const previous = this.retainedRows;
    this.writes += 1;
    this.retainedRows = Object.freeze([...value]);
    this.requestUpdate('rows', previous);
  }
}
customElements.define(tag('accessor-collection-rebinding-demo'), AccessorCollectionRebindingDemo);

it('retains one owned snapshot until a distinct caller collection is assigned', async () => {
  const el = await fixture<OwnedCollectionRebindingDemo>(
    html`<lr-owned-collection-rebinding-demo></lr-owned-collection-rebinding-demo>`,
  );
  const source = [{ label: 'first', nested: { value: 1 } }];

  el.rows = source;
  await el.updateComplete;
  const firstSnapshot = el.rows;
  const updatesAfterFirstAssignment = el.rowUpdates;

  el.rows = source;
  await el.updateComplete;

  expect(el.rows, 'an unchanged declarative rebind keeps Lit\'s property identity stable').to.equal(
    firstSnapshot,
  );
  expect(el.rowUpdates).to.equal(updatesAfterFirstAssignment);

  source[0]!.nested.value = 2;
  el.rows = source;
  await el.updateComplete;

  expect(el.rows, 'later mutation of the already-owned source remains isolated').to.equal(
    firstSnapshot,
  );
  expect(el.rows[0]!.nested.value).to.equal(1);
  expect(el.rowUpdates).to.equal(updatesAfterFirstAssignment);

  el.rows = [...source];
  await el.updateComplete;
  expect(el.rows).to.not.equal(firstSnapshot);
  expect(el.rows[0]!.nested.value).to.equal(2);
  expect(el.rowUpdates).to.equal(updatesAfterFirstAssignment + 1);

  const currentSnapshot = el.rows;
  el.rows = el.rows;
  await el.updateComplete;
  expect(el.rows, 'rebinding the getter-returned snapshot is also a no-op').to.equal(currentSnapshot);
  expect(el.rowUpdates).to.equal(updatesAfterFirstAssignment + 1);
});

it('lets an explicit change detector resnapshot a repeated caller identity', async () => {
  const el = await fixture<ExplicitCollectionChangeDemo>(
    html`<lr-explicit-collection-change-demo></lr-explicit-collection-change-demo>`,
  );
  const source = [{ label: 'first', nested: { value: 1 } }];
  el.rows = source;
  await el.updateComplete;
  const updatesAfterFirstAssignment = el.rowUpdates;

  source[0]!.nested.value = 2;
  el.rows = source;
  await el.updateComplete;

  expect(el.rows[0]!.nested.value).to.equal(2);
  expect(el.rowUpdates).to.equal(updatesAfterFirstAssignment + 1);
});

it('recognizes the final snapshot returned by an accessor-backed collection getter', async () => {
  const el = await fixture<AccessorCollectionRebindingDemo>(
    html`<lr-accessor-collection-rebinding-demo></lr-accessor-collection-rebinding-demo>`,
  );
  el.rows = [{ label: 'first', nested: { value: 1 } }];
  await el.updateComplete;
  const retained = el.rows;
  const writesAfterAssignment = el.writes;

  el.rows = retained;
  await el.updateComplete;

  expect(el.rows).to.equal(retained);
  expect(el.writes).to.equal(writesAfterAssignment);
});

it('keeps identity-preserving collections reactive when a retained item mutates', async () => {
  const el = await fixture<IdentityCollectionRebindingDemo>(
    html`<lr-identity-collection-rebinding-demo></lr-identity-collection-rebinding-demo>`,
  );
  const item = { label: 'first' };
  const source = [item];
  el.rows = source;
  await el.updateComplete;
  const firstSnapshot = el.rows;
  const updatesAfterFirstAssignment = el.rowUpdates;

  item.label = 'second';
  el.rows = source;
  await el.updateComplete;

  expect(el.rows).to.not.equal(firstSnapshot);
  expect(el.rows[0]).to.equal(item);
  expect(el.rowUpdates).to.equal(updatesAfterFirstAssignment + 1);
});
