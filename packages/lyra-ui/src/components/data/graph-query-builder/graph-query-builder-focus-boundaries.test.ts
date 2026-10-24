import { expect, fixture, html } from '@open-wc/testing';
import './graph-query-builder.js';
import type { GraphQuery, GraphQuerySavedItem, GraphQueryTypeOption, LyraGraphQueryBuilder } from './graph-query-builder.js';

const RELATIONSHIP_OPTIONS: GraphQueryTypeOption[] = [
  { value: 'works_for', label: 'Works for' },
  { value: 'founded_by', label: 'Founded by' },
];
const NODE_TYPE_OPTIONS: GraphQueryTypeOption[] = [
  { value: 'person', label: 'Person' },
  { value: 'organization', label: 'Organization' },
];

function query(overrides: Partial<GraphQuery> = {}): GraphQuery {
  return { startId: '', endId: '', relationshipTypes: [], nodeTypes: [], direction: 'both', minHops: 1, maxHops: 1, ...overrides };
}

function removeChip(chip: HTMLElement, value: string): void {
  chip.focus();
  chip.dispatchEvent(new CustomEvent('lr-remove', { bubbles: true, composed: true, detail: { value } }));
}

describe('lr-graph-query-builder removal focus', () => {
  it('moves focus to the adjacent node-type chip when the focused one is removed', async () => {
    const el = await fixture<LyraGraphQueryBuilder>(html`<lr-graph-query-builder
      .nodeTypeOptions=${NODE_TYPE_OPTIONS} .value=${query({ nodeTypes: ['person', 'organization'] })}></lr-graph-query-builder>`);
    await el.updateComplete;
    removeChip(el.shadowRoot!.querySelectorAll<HTMLElement>('[part="node-type-chips"] lr-chip')[0]!, 'person');
    await el.updateComplete;
    const active = el.shadowRoot!.activeElement as HTMLElement | null;
    expect(active?.localName).to.equal('lr-chip');
    expect(active?.getAttribute('value')).to.equal('organization');
  });

  it('moves focus to the relationship picker when the focused final relationship chip is removed', async () => {
    const el = await fixture<LyraGraphQueryBuilder>(html`<lr-graph-query-builder
      .relationshipTypeOptions=${RELATIONSHIP_OPTIONS} .value=${query({ relationshipTypes: ['works_for'] })}></lr-graph-query-builder>`);
    await el.updateComplete;
    removeChip(el.shadowRoot!.querySelector<HTMLElement>('[part="relationship-chips"] lr-chip')!, 'works_for');
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('relationship-picker');
  });

  it('keeps focus on a saved-query action whose query survives another query being removed', async () => {
    const saved: GraphQuerySavedItem[] = [
      { id: 's1', name: 'First', query: query() },
      { id: 's2', name: 'Second', query: query() },
    ];
    const el = await fixture<LyraGraphQueryBuilder>(html`<lr-graph-query-builder .savedQueries=${saved}></lr-graph-query-builder>`);
    const buttons = el.shadowRoot!.querySelectorAll<HTMLElement>('[part="saved-delete-button"]');
    buttons[0]!.focus();
    el.savedQueries = saved.slice(0, 1);
    await el.updateComplete;
    const active = el.shadowRoot!.activeElement as HTMLElement | null;
    expect(active?.getAttribute('part')).to.equal('saved-delete-button');
    expect(active?.closest('[data-query-id]')?.getAttribute('data-query-id')).to.equal('s1');
  });
});

describe('lr-graph-query-builder lifecycle boundaries', () => {
  it('clears a custom validity message that is passed as nothing', async () => {
    const el = await fixture<LyraGraphQueryBuilder>(html`<lr-graph-query-builder></lr-graph-query-builder>`);
    el.setCustomValidity('Pick a start node');
    expect(el.errors['base']).to.equal('Pick a start node');
    el.setCustomValidity(undefined as unknown as string);
    expect(el.errors['base']).to.equal(undefined);
  });

  it('can be blurred before it is ever connected', () => {
    const el = document.createElement('lr-graph-query-builder') as LyraGraphQueryBuilder;
    expect(() => el.blur()).not.to.throw();
  });
});
