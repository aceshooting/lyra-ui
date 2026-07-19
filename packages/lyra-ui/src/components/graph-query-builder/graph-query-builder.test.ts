import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './graph-query-builder.js';
import type {
  LyraGraphQueryBuilder,
  GraphQuery,
  GraphQueryTypeOption,
  GraphQuerySavedItem,
} from './graph-query-builder.js';

const RELATIONSHIP_OPTIONS: GraphQueryTypeOption[] = [
  { value: 'works_for', label: 'Works for' },
  { value: 'founded_by', label: 'Founded by' },
];
const NODE_TYPE_OPTIONS: GraphQueryTypeOption[] = [
  { value: 'person', label: 'Person' },
  { value: 'organization', label: 'Organization' },
];

function query(overrides: Partial<GraphQuery> = {}): GraphQuery {
  return {
    startId: '',
    endId: '',
    relationshipTypes: [],
    nodeTypes: [],
    direction: 'both',
    minHops: 1,
    maxHops: 1,
    ...overrides,
  };
}

describe('lr-graph-query-builder', () => {
  it('renders the path fields, direction select, and an empty saved-queries list', async () => {
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="start-input"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="end-input"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="min-hops"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="max-hops"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="direction"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="saved-empty"]')!.textContent).to.equal('No data');
  });

  it('emits lr-input with the full value when the start-entity input changes', async () => {
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const startInput = el.shadowRoot!.querySelector('[part="start-input"]') as HTMLElement;
    setTimeout(() => startInput.dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'node-1' } })));
    const ev = await oneEvent(el, 'lr-input');
    expect(ev.detail.value.startId).to.equal('node-1');
    expect(el.value.startId).to.equal('node-1');
  });

  it('emits lr-input when the end-entity input changes', async () => {
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const endInput = el.shadowRoot!.querySelector('[part="end-input"]') as HTMLElement;
    setTimeout(() => endInput.dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'node-2' } })));
    const ev = await oneEvent(el, 'lr-input');
    expect(ev.detail.value.endId).to.equal('node-2');
  });

  it('updates minHops/maxHops when the hop selects change', async () => {
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const minSelect = el.shadowRoot!.querySelector('[part="min-hops"]') as HTMLElement & { value: string };
    minSelect.value = '2';
    minSelect.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(el.value.minHops).to.equal(2);

    const maxSelect = el.shadowRoot!.querySelector('[part="max-hops"]') as HTMLElement & { value: string };
    maxSelect.value = '3';
    maxSelect.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(el.value.maxHops).to.equal(3);
  });

  it('adds a relationship type via the picker, renders it as a removable chip, and excludes it from the picker afterwards', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder .relationshipTypeOptions=${RELATIONSHIP_OPTIONS}></lr-graph-query-builder>`,
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const picker = el.shadowRoot!.querySelector('[part="relationship-picker"]') as HTMLElement & { value: string };
    picker.value = 'works_for';
    picker.dispatchEvent(new Event('change'));
    await el.updateComplete;

    expect(el.value.relationshipTypes).to.deep.equal(['works_for']);
    const chips = el.shadowRoot!.querySelectorAll('[part="relationship-chips"] lr-chip');
    expect(chips.length).to.equal(1);
    expect(chips[0].textContent!.trim()).to.equal('Works for');
    const pickerOptions = (el.shadowRoot!.querySelector('[part="relationship-picker"]') as HTMLElement).querySelectorAll(
      'lr-option',
    );
    expect(pickerOptions.length).to.equal(1);
    expect((pickerOptions[0] as HTMLElement).getAttribute('value')).to.equal('founded_by');
    // The picker itself resets back to its placeholder after adding.
    expect(picker.value).to.equal('');
  });

  it('removes a relationship type when its chip is removed', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder
        .relationshipTypeOptions=${RELATIONSHIP_OPTIONS}
        .value=${query({ relationshipTypes: ['works_for', 'founded_by'] })}
      ></lr-graph-query-builder>`,
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const chip = el.shadowRoot!.querySelector('[part="relationship-chips"] lr-chip') as HTMLElement;
    setTimeout(() => chip.dispatchEvent(new CustomEvent('lr-remove', { detail: { value: 'works_for' } })));
    await oneEvent(el, 'lr-input');
    expect(el.value.relationshipTypes).to.deep.equal(['founded_by']);
  });

  it('adds and removes node types the same way as relationship types', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder .nodeTypeOptions=${NODE_TYPE_OPTIONS}></lr-graph-query-builder>`,
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const picker = el.shadowRoot!.querySelector('[part="node-type-picker"]') as HTMLElement & { value: string };
    picker.value = 'person';
    picker.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(el.value.nodeTypes).to.deep.equal(['person']);

    const chip = el.shadowRoot!.querySelector('[part="node-type-chips"] lr-chip') as HTMLElement;
    setTimeout(() => chip.dispatchEvent(new CustomEvent('lr-remove', { detail: { value: 'person' } })));
    await oneEvent(el, 'lr-input');
    expect(el.value.nodeTypes).to.deep.equal([]);
  });

  it('renders an active filter chip for a type value missing from its options list (dangling reference), using the raw value as its label', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder
        .relationshipTypeOptions=${RELATIONSHIP_OPTIONS}
        .value=${query({ relationshipTypes: ['no_longer_offered'] })}
      ></lr-graph-query-builder>`,
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const chip = el.shadowRoot!.querySelector('[part="relationship-chips"] lr-chip') as HTMLElement;
    expect(chip.textContent!.trim()).to.equal('no_longer_offered');
  });

  it('changes direction via the direction select', async () => {
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const direction = el.shadowRoot!.querySelector('[part="direction"]') as HTMLElement & { value: string };
    direction.value = 'out';
    direction.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(el.value.direction).to.equal('out');
  });

  it('is invalid until startId is set, and becomes valid once it is', async () => {
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    await el.updateComplete;
    expect(el.checkValidity()).to.be.false;
    setTimeout(() => {
      el.value = query({ startId: 'node-1' });
    });
    const ev = await oneEvent(el, 'lr-validity-change');
    expect(ev.detail.valid).to.be.true;
  });

  it('is invalid when minHops exceeds maxHops', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder .value=${query({ startId: 'node-1', minHops: 3, maxHops: 1 })}></lr-graph-query-builder>`,
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    expect(el.checkValidity()).to.be.false;
    expect(el.errors['max-hops']).to.exist;
  });

  it('does not emit lr-query-run when invalid, and reveals the start-entity error', async () => {
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const run = el.shadowRoot!.querySelector('[part="run-button"]') as HTMLElement;
    let fired = false;
    el.addEventListener('lr-query-run', () => (fired = true));
    run.click();
    await el.updateComplete;
    expect(fired).to.be.false;
    const startInput = el.shadowRoot!.querySelector('[part="start-input"]') as HTMLElement & { errorText: string };
    expect(startInput.errorText).to.equal('This field is required.');
  });

  it('emits lr-query-run with the current query once valid', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder .value=${query({ startId: 'node-1' })}></lr-graph-query-builder>`,
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const run = el.shadowRoot!.querySelector('[part="run-button"]') as HTMLElement;
    setTimeout(() => run.click());
    const ev = await oneEvent(el, 'lr-query-run');
    expect(ev.detail.query.startId).to.equal('node-1');
  });

  it('disables the save button until a name is entered, then emits lr-query-save and clears the name field', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder .value=${query({ startId: 'node-1' })}></lr-graph-query-builder>`,
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const saveButton = el.shadowRoot!.querySelector('[part="save-button"]') as HTMLButtonElement;
    expect(saveButton.disabled).to.be.true;

    const nameInput = el.shadowRoot!.querySelector('[part="save-name-input"]') as HTMLElement;
    nameInput.dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'My saved search' } }));
    await el.updateComplete;
    expect(saveButton.disabled).to.be.false;

    setTimeout(() => saveButton.click());
    const ev = await oneEvent(el, 'lr-query-save');
    expect(ev.detail.name).to.equal('My saved search');
    expect(ev.detail.query.startId).to.equal('node-1');
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="save-name-input"]') as HTMLElement & { value: string }).value).to.equal('');
  });

  it('renders saved queries and loads one on click, replacing the current value', async () => {
    const saved: GraphQuerySavedItem[] = [
      { id: 's1', name: 'Coworkers', query: query({ startId: 'node-9', relationshipTypes: ['works_for'] }) },
    ];
    const el = (await fixture(
      html`<lr-graph-query-builder .savedQueries=${saved}></lr-graph-query-builder>`,
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const loadButton = el.shadowRoot!.querySelector('[part="saved-load-button"]') as HTMLElement;
    expect(loadButton.textContent!.trim()).to.equal('Coworkers');
    setTimeout(() => loadButton.click());
    const ev = await oneEvent(el, 'lr-query-load');
    expect(ev.detail.id).to.equal('s1');
    expect(el.value.startId).to.equal('node-9');
    expect(el.value.relationshipTypes).to.deep.equal(['works_for']);
  });

  it('emits lr-query-delete without mutating savedQueries itself', async () => {
    const saved: GraphQuerySavedItem[] = [{ id: 's1', name: 'Coworkers', query: query() }];
    const el = (await fixture(
      html`<lr-graph-query-builder .savedQueries=${saved}></lr-graph-query-builder>`,
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const deleteButton = el.shadowRoot!.querySelector('[part="saved-delete-button"]') as HTMLElement;
    setTimeout(() => deleteButton.click());
    const ev = await oneEvent(el, 'lr-query-delete');
    expect(ev.detail.id).to.equal('s1');
    expect(el.savedQueries).to.equal(saved);
    expect(el.savedQueries.length).to.equal(1);
  });

  it('disables every interactive part when disabled', async () => {
    const el = (await fixture(html`<lr-graph-query-builder disabled></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="start-input"]') as HTMLElement & { disabled: boolean }).disabled).to.be.true;
    expect((el.shadowRoot!.querySelector('[part="run-button"]') as HTMLButtonElement).disabled).to.be.true;
    expect((el.shadowRoot!.querySelector('[part="relationship-picker"]') as HTMLElement & { disabled: boolean }).disabled).to
      .be.true;

    let fired = false;
    el.addEventListener('lr-input', () => (fired = true));
    const startInput = el.shadowRoot!.querySelector('[part="start-input"]') as HTMLElement;
    startInput.dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'node-1' } }));
    expect(fired).to.be.false;
  });

  it('resets to the empty value on formResetCallback', async () => {
    const form = (await fixture(html`
      <form>
        <lr-graph-query-builder name="query" .value=${query({ startId: 'node-1' })}></lr-graph-query-builder>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-graph-query-builder') as LyraGraphQueryBuilder;
    await el.updateComplete;
    form.reset();
    await el.updateComplete;
    expect(el.value.startId).to.equal('');
  });

  it('participates in a form: submits the value as JSON under name', async () => {
    const form = (await fixture(html`
      <form>
        <lr-graph-query-builder name="query" .value=${query({ startId: 'node-1' })}></lr-graph-query-builder>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-graph-query-builder') as LyraGraphQueryBuilder;
    await el.updateComplete;
    const data = new FormData(form);
    expect(JSON.parse(data.get('query') as string).startId).to.equal('node-1');
  });

  it('changes hop select option count when hop-limit is set', async () => {
    const el = (await fixture(html`<lr-graph-query-builder hop-limit="3"></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const options = (el.shadowRoot!.querySelector('[part="min-hops"]') as HTMLElement).querySelectorAll('lr-option');
    expect(options.length).to.equal(3);
  });

  it('renders a .strings override for graphQueryRun and the shared fieldRequired key', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder
        .strings=${{ graphQueryRun: 'Lancer', fieldRequired: 'Ce champ est requis.' }}
      ></lr-graph-query-builder>`,
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="run-button"]')!.textContent!.trim()).to.equal('Lancer');
    el.reportValidity();
    await el.updateComplete;
    const startInput = el.shadowRoot!.querySelector('[part="start-input"]') as HTMLElement & { errorText: string };
    expect(startInput.errorText).to.equal('Ce champ est requis.');
  });

  it('renders correctly under dir="rtl"', async () => {
    const el = (await fixture(
      html`<div dir="rtl"><lr-graph-query-builder .relationshipTypeOptions=${RELATIONSHIP_OPTIONS}></lr-graph-query-builder></div>`,
    )) as HTMLElement;
    const builder = el.querySelector('lr-graph-query-builder') as LyraGraphQueryBuilder;
    await builder.updateComplete;
    expect(builder.shadowRoot!.querySelector('[part="base"]')).to.exist;
    expect(builder.effectiveDirection).to.equal('rtl');
  });

  it('registers every composed sibling control as a side effect of importing graph-query-builder.js (regression)', async () => {
    expect(customElements.get('lr-select')).to.exist;
    expect(customElements.get('lr-option')).to.exist;
    expect(customElements.get('lr-input')).to.exist;
    expect(customElements.get('lr-chip')).to.exist;
    expect(customElements.get('lr-chip-group')).to.exist;
  });

  it('is accessible in a populated state (active filters, saved queries, revealed error)', async () => {
    const saved: GraphQuerySavedItem[] = [{ id: 's1', name: 'Coworkers', query: query({ startId: 'node-9' }) }];
    const el = (await fixture(
      html`<lr-graph-query-builder
        .relationshipTypeOptions=${RELATIONSHIP_OPTIONS}
        .nodeTypeOptions=${NODE_TYPE_OPTIONS}
        .savedQueries=${saved}
        .value=${query({ relationshipTypes: ['works_for'], nodeTypes: ['person'] })}
      ></lr-graph-query-builder>`,
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    el.reportValidity();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="relationship-chips"] lr-chip').length).to.equal(1);
    expect(el.shadowRoot!.querySelector('[part="saved-item"]')).to.exist;
    await expect(el).to.be.accessible();
  });
});
