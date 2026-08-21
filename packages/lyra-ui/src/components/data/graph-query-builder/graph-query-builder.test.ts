import { fixture, expect, html, oneEvent, waitUntil } from '@open-wc/testing';
import './graph-query-builder.js';
import type {
  LyraGraphQueryBuilder,
  GraphQuery,
  GraphQueryTypeOption,
  GraphQuerySavedItem,
} from './graph-query-builder.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

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

  it('projects its unconditional start-anchor requirement to the nested input owner', async () => {
    const el = (await fixture(html`
      <lr-graph-query-builder disabled></lr-graph-query-builder>
    `)) as LyraGraphQueryBuilder;
    const start = el.shadowRoot!.querySelector('[part="start-input"]') as HTMLElement & {
      required: boolean;
      input?: HTMLInputElement;
    };
    await (start as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    expect(start.required).to.be.true;
    expect(start.input?.required).to.be.true;
    expect(start.input?.getAttribute('aria-required')).to.equal('true');
  });

  it('forwards a host click to the first rendered field', async () => {
    const el = (await fixture(html`
      <lr-graph-query-builder></lr-graph-query-builder>
    `)) as LyraGraphQueryBuilder;
    await el.updateComplete;

    el.click();

    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('start-input');
  });

  it('forwards host focus and blur to the live owned field and rejects synchronous disablement', async () => {
    const fieldset = await fixture<HTMLFieldSetElement>(html`
      <fieldset><lr-graph-query-builder></lr-graph-query-builder></fieldset>
    `);
    const el = fieldset.querySelector('lr-graph-query-builder') as LyraGraphQueryBuilder;
    const start = el.shadowRoot!.querySelector('[part="start-input"]') as HTMLElement;

    el.focus({ preventScroll: true });
    expect(el.shadowRoot!.activeElement === start).to.be.true;
    el.blur();
    expect(el.shadowRoot!.activeElement === null).to.be.true;

    fieldset.disabled = true;
    el.focus();
    el.click();
    expect(el.shadowRoot!.activeElement === null).to.be.true;
  });

  it('walks the whole fallback focus-target chain without throwing when focus() runs before the first render populates any control', () => {
    const el = document.createElement('lr-graph-query-builder') as LyraGraphQueryBuilder;
    document.body.appendChild(el);
    try {
      // The shadow root exists (attached in the constructor) but is still empty -- Lit's first
      // render is scheduled as a microtask, not run synchronously here -- so every `||` fallback in
      // focusFirstControl() (end-input, min-hops, max-hops, direction, save-name-input) is walked
      // and comes up empty, landing on a safe no-op instead of throwing.
      expect(() => el.focus()).to.not.throw();
      expect(document.activeElement === el).to.be.false;
    } finally {
      el.remove();
    }
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

  it('emits one host lr-input event for one bubbling child lr-input event', async () => {
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    const startInput = el.shadowRoot!.querySelector('[part="start-input"]') as HTMLElement;
    let count = 0;
    el.addEventListener('lr-input', () => count++);

    startInput.dispatchEvent(
      new CustomEvent('lr-input', {
        detail: { value: 'node-1' },
        bubbles: true,
        composed: true,
      })
    );
    await el.updateComplete;

    expect(count).to.equal(1);
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

  it('keeps the max-hops picker in sync with a value.maxHops beyond the default hop-limit (regression)', async () => {
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    // hop-limit defaults to 6, so a maxHops of 8 (still a valid GraphQuery -- see
    // normalizeGraphQuery's [1, 20] clamp) has no corresponding <lr-option> unless hopOptions()
    // widens itself to include it.
    el.value = query({ maxHops: 8 });
    await el.updateComplete;
    const maxSelect = el.shadowRoot!.querySelector('[part="max-hops"]') as HTMLElement;
    const options = [...maxSelect.querySelectorAll('lr-option')] as (HTMLElement & {
      value: string;
      selected: boolean;
    })[];
    const eight = options.find((o) => o.value === '8');
    expect(eight != null, 'expected an <lr-option value="8"> even though hop-limit defaults to 6').to.equal(true);
    expect(eight!.selected).to.be.true;
  });

  it('adds a relationship type via the picker, renders it as a removable chip, and excludes it from the picker afterwards', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder .relationshipTypeOptions=${RELATIONSHIP_OPTIONS}></lr-graph-query-builder>`
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
    const pickerOptions = (
      el.shadowRoot!.querySelector('[part="relationship-picker"]') as HTMLElement
    ).querySelectorAll('lr-option');
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
      ></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const chip = el.shadowRoot!.querySelector('[part="relationship-chips"] lr-chip') as HTMLElement;
    setTimeout(() => chip.dispatchEvent(new CustomEvent('lr-remove', { detail: { value: 'works_for' } })));
    await oneEvent(el, 'lr-input');
    expect(el.value.relationshipTypes).to.deep.equal(['founded_by']);
  });

  it('moves focus to the adjacent chip when the focused relationship filter is removed', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder
        .relationshipTypeOptions=${RELATIONSHIP_OPTIONS}
        .value=${query({ relationshipTypes: ['works_for', 'founded_by'] })}
      ></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const chips = el.shadowRoot!.querySelectorAll<HTMLElement>('[part="relationship-chips"] lr-chip');
    chips[0]!.focus();
    chips[0]!.dispatchEvent(
      new CustomEvent('lr-remove', {
        bubbles: true,
        composed: true,
        detail: { value: 'works_for' },
      })
    );
    await el.updateComplete;

    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.localName).to.equal('lr-chip');
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute('value')).to.equal('founded_by');
  });

  it('moves focus to the matching picker when the focused final chip is removed', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder
        .nodeTypeOptions=${NODE_TYPE_OPTIONS}
        .value=${query({ nodeTypes: ['person'] })}
      ></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const chip = el.shadowRoot!.querySelector<HTMLElement>('[part="node-type-chips"] lr-chip')!;
    chip.focus();
    chip.dispatchEvent(
      new CustomEvent('lr-remove', {
        bubbles: true,
        composed: true,
        detail: { value: 'person' },
      })
    );
    await el.updateComplete;

    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('node-type-picker');
  });

  it('adds and removes node types the same way as relationship types', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder .nodeTypeOptions=${NODE_TYPE_OPTIONS}></lr-graph-query-builder>`
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
      ></lr-graph-query-builder>`
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
      html`<lr-graph-query-builder
        .value=${query({ startId: 'node-1', minHops: 3, maxHops: 1 })}
      ></lr-graph-query-builder>`
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
      html`<lr-graph-query-builder .value=${query({ startId: 'node-1' })}></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const run = el.shadowRoot!.querySelector('[part="run-button"]') as HTMLElement;
    setTimeout(() => run.click());
    const ev = await oneEvent(el, 'lr-query-run');
    expect(ev.detail.query.startId).to.equal('node-1');
    expect(Object.isFrozen(ev.detail)).to.equal(true);
    expect(Object.isFrozen(ev.detail.query)).to.equal(true);
    expect(Object.isFrozen(ev.detail.query.relationshipTypes)).to.equal(true);
  });

  it('emits one cancelable before phase followed by one noncancelable accepted event for every query action', async () => {
    const saved: GraphQuerySavedItem[] = [
      { id: 'saved-1', name: 'Saved traversal', query: query({ startId: 'saved-node' }) },
    ];
    const el = (await fixture(html`
      <lr-graph-query-builder
        .value=${query({ startId: 'current-node' })}
        .savedQueries=${saved}
      ></lr-graph-query-builder>
    `)) as LyraGraphQueryBuilder;
    await el.updateComplete;

    const order: string[] = [];
    const events: Event[] = [];
    const names = [
      'lr-before-query-run',
      'lr-query-run',
      'lr-before-query-save',
      'lr-query-save',
      'lr-before-query-load',
      'lr-query-load',
      'lr-before-query-delete',
      'lr-query-delete',
    ] as const;
    for (const name of names) {
      el.addEventListener(name, (event) => {
        order.push(name);
        events.push(event);
      });
    }

    (el.shadowRoot!.querySelector('[part="run-button"]') as HTMLButtonElement).click();
    const nameInput = el.shadowRoot!.querySelector('[part="save-name-input"]') as HTMLElement;
    nameInput.dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'Snapshot' } }));
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[part="save-button"]') as HTMLButtonElement).click();
    (el.shadowRoot!.querySelector('[part="saved-load-button"]') as HTMLButtonElement).click();
    (el.shadowRoot!.querySelector('[part="saved-delete-button"]') as HTMLButtonElement).click();

    expect(order).to.deep.equal(names);
    expect(events.filter((event) => event.type.startsWith('lr-before-')).every((event) => event.cancelable)).to.equal(
      true
    );
    expect(events.filter((event) => !event.type.startsWith('lr-before-')).every((event) => !event.cancelable)).to.equal(
      true
    );
    expect(events.every((event) => Object.isFrozen((event as CustomEvent).detail))).to.equal(true);
    for (let index = 0; index < events.length; index += 2) {
      expect(
        (events[index] as CustomEvent).detail === (events[index + 1] as CustomEvent).detail,
        names[index]
      ).to.equal(false);
      const before = (events[index] as CustomEvent).detail;
      const accepted = (events[index + 1] as CustomEvent).detail;
      if ("query" in before) {
        expect(
          before.query === accepted.query,
          `${names[index]} nested query`
        ).to.equal(false);
        expect(Object.isFrozen(before.query)).to.equal(true);
        expect(Object.isFrozen(accepted.query)).to.equal(true);
      }
  }
  });

  it('lets every before-query phase veto its action without an accepted event or local mutation', async () => {
    const saved: GraphQuerySavedItem[] = [
      { id: 'saved-1', name: 'Saved traversal', query: query({ startId: 'saved-node' }) },
    ];
    const el = (await fixture(html`
      <lr-graph-query-builder
        .value=${query({ startId: 'current-node' })}
        .savedQueries=${saved}
      ></lr-graph-query-builder>
    `)) as LyraGraphQueryBuilder;
    await el.updateComplete;

    const accepted = new Map<string, number>();
    for (const action of ['run', 'save', 'load', 'delete'] as const) {
      el.addEventListener(`lr-before-query-${action}`, (event) => event.preventDefault());
      el.addEventListener(`lr-query-${action}`, () => accepted.set(action, (accepted.get(action) ?? 0) + 1));
    }

    (el.shadowRoot!.querySelector('[part="run-button"]') as HTMLButtonElement).click();
    const nameInput = el.shadowRoot!.querySelector('[part="save-name-input"]') as HTMLElement & { value: string };
    nameInput.dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'Needs approval' } }));
    await el.updateComplete;
    (el.shadowRoot!.querySelector('[part="save-button"]') as HTMLButtonElement).click();
    (el.shadowRoot!.querySelector('[part="saved-load-button"]') as HTMLButtonElement).click();
    (el.shadowRoot!.querySelector('[part="saved-delete-button"]') as HTMLButtonElement).click();
    await el.updateComplete;

    expect([...accepted.values()].reduce((sum, count) => sum + count, 0)).to.equal(0);
    expect(el.value.startId).to.equal('current-node');
    expect(nameInput.value).to.equal('Needs approval');
    expect(el.savedQueries.map((item) => item.id)).to.deep.equal(['saved-1']);
  });

  it('disables the save button until a name is entered, then emits lr-query-save and clears the name field', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder .value=${query({ startId: 'node-1' })}></lr-graph-query-builder>`
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
    expect(ev.cancelable).to.equal(false);
    expect(ev.detail.name).to.equal('My saved search');
    expect(ev.detail.query.startId).to.equal('node-1');
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector('[part="save-name-input"]') as HTMLElement & { value: string }).value
    ).to.equal('');
  });

  it('keeps the save-name draft when the cancelable save request is vetoed', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder .value=${query({ startId: 'node-1' })}></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    const nameInput = el.shadowRoot!.querySelector('[part="save-name-input"]') as HTMLElement & { value: string };
    nameInput.dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'Needs approval' } }));
    await el.updateComplete;
    el.addEventListener('lr-before-query-save', (event) => event.preventDefault());
    const requested = oneEvent(el, 'lr-before-query-save');

    (el.shadowRoot!.querySelector('[part="save-button"]') as HTMLButtonElement).click();
    const event = await requested;
    await el.updateComplete;
    expect(event.defaultPrevented).to.equal(true);
    expect((el.shadowRoot!.querySelector('[part="save-name-input"]') as HTMLElement & { value: string }).value)
      .to.equal('Needs approval');
  });

  it('clone-owns and freezes model, option, and saved-query inputs with unique actionable ids', async () => {
    const model = query({ relationshipTypes: ['works_for'], nodeTypes: ['person'] });
    const options: GraphQueryTypeOption[] = [
      { value: '', label: 'Missing identity' },
      { value: '   ', label: 'Blank identity' },
      { value: 'person', label: 'Person' },
    ];
    const saved: GraphQuerySavedItem[] = [
      { id: '', name: 'Missing identity', query: model },
      { id: '   ', name: 'Blank identity', query: model },
      { id: 'same', name: 'First', query: model },
      { id: 'same', name: 'Duplicate', query: query({ startId: 'other' }) },
    ];
    const el = (await fixture(html`
      <lr-graph-query-builder
        .value=${model}
        .nodeTypeOptions=${options}
        .savedQueries=${saved}
      ></lr-graph-query-builder>
    `)) as LyraGraphQueryBuilder;

    (model.relationshipTypes as string[]).push('mutated');
    (options[2] as { label?: string }).label = 'Mutated';
    saved.push({ id: 'later', name: 'Later', query: query() });
    expect(el.value.relationshipTypes).to.deep.equal(['works_for']);
    expect(el.nodeTypeOptions).to.have.length(1);
    expect(el.nodeTypeOptions[0]!.label).to.equal('Person');
    expect(el.savedQueries).to.have.length(1);
    expect(Object.isFrozen(el.value)).to.equal(true);
    expect(Object.isFrozen(el.nodeTypeOptions)).to.equal(true);
    expect(Object.isFrozen(el.nodeTypeOptions[0]!)).to.equal(true);
    expect(Object.isFrozen(el.savedQueries[0]!.query)).to.equal(true);
  });

  it('normalizes malformed option and saved-query collections while retaining unlabeled values', async () => {
    const el = (await fixture(html`
      <lr-graph-query-builder></lr-graph-query-builder>
    `)) as LyraGraphQueryBuilder;
    el.relationshipTypeOptions = [
      null,
      ['nested'],
      { value: 'works_for' },
    ] as unknown as readonly GraphQueryTypeOption[];
    el.savedQueries = [
      null,
      ['nested'],
      { id: 'valid', name: 'Valid query', query: query({ startId: 'node-1' }) },
    ] as unknown as readonly GraphQuerySavedItem[];
    await el.updateComplete;

    expect(el.relationshipTypeOptions).to.deep.equal([{ value: 'works_for' }]);
    expect(el.savedQueries.map((item) => item.id)).to.deep.equal(['valid']);
    expect(
      el.shadowRoot!.querySelector('[part="relationship-picker"] lr-option')!.textContent
    ).to.equal('works_for');

    el.relationshipTypeOptions = null as unknown as readonly GraphQueryTypeOption[];
    el.savedQueries = null as unknown as readonly GraphQuerySavedItem[];
    await el.updateComplete;
    expect(el.relationshipTypeOptions).to.deep.equal([]);
    expect(el.savedQueries).to.deep.equal([]);
  });

  it('ignores an empty array-shaped selection from the single-value type picker', async () => {
    const el = (await fixture(html`
      <lr-graph-query-builder
        .relationshipTypeOptions=${RELATIONSHIP_OPTIONS}
      ></lr-graph-query-builder>
    `)) as LyraGraphQueryBuilder;
    const picker = el.shadowRoot!.querySelector('[part="relationship-picker"]') as HTMLElement & {
      value: string | string[];
    };
    picker.value = [];
    picker.dispatchEvent(new Event('change'));
    await el.updateComplete;
    expect(el.value.relationshipTypes).to.deep.equal([]);
    expect(picker.value).to.equal('');
  });

  it('renders saved queries and loads one on click, replacing the current value', async () => {
    const saved: GraphQuerySavedItem[] = [
      {
        id: 's1',
        name: 'Coworkers',
        query: query({ startId: 'node-9', relationshipTypes: ['works_for'] }),
      },
    ];
    const el = (await fixture(
      html`<lr-graph-query-builder .savedQueries=${saved}></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const loadButton = el.shadowRoot!.querySelector('[part="saved-load-button"]') as HTMLElement;
    expect(loadButton.textContent!.trim()).to.equal('Coworkers');
    setTimeout(() => loadButton.click());
    const ev = await oneEvent(el, 'lr-query-load');
    expect(ev.detail.queryId).to.equal('s1');
    expect(el.value.startId).to.equal('node-9');
    expect(el.value.relationshipTypes).to.deep.equal(['works_for']);
  });

  it('gives each saved-query load button an action-specific accessible name', async () => {
    const saved: GraphQuerySavedItem[] = [{ id: 's1', name: 'Coworkers', query: query() }];
    const el = (await fixture(
      html`<lr-graph-query-builder
        .savedQueries=${saved}
        .strings=${{ graphQueryLoadWithContext: 'Open query {name}' }}
      ></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    const loadButton = el.shadowRoot!.querySelector('[part="saved-load-button"]') as HTMLButtonElement;
    expect(loadButton.getAttribute('aria-label')).to.equal('Open query Coworkers');
  });

  it('emits lr-query-delete without mutating savedQueries itself', async () => {
    const saved: GraphQuerySavedItem[] = [{ id: 's1', name: 'Coworkers', query: query() }];
    const el = (await fixture(
      html`<lr-graph-query-builder .savedQueries=${saved}></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const deleteButton = el.shadowRoot!.querySelector('[part="saved-delete-button"]') as HTMLElement;
    setTimeout(() => deleteButton.click());
    const ev = await oneEvent(el, 'lr-query-delete');
    expect(ev.detail.queryId).to.equal('s1');
    expect(el.savedQueries).to.not.equal(saved);
    expect(el.savedQueries).to.deep.equal(saved);
    expect(el.savedQueries.length).to.equal(1);
  });

  it('moves focus to the stable save input when controlled deletion removes the sole saved query', async () => {
    const saved: GraphQuerySavedItem[] = [{ id: 's1', name: 'Coworkers', query: query() }];
    const el = (await fixture(
      html`<lr-graph-query-builder .savedQueries=${saved}></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    el.addEventListener('lr-query-delete', (event) => {
      el.savedQueries = el.savedQueries.filter((item) => item.id !== event.detail.queryId);
    });
    const deleteButton = el.shadowRoot!.querySelector<HTMLElement>('[part="saved-delete-button"]')!;
    deleteButton.focus();
    deleteButton.click();
    await el.updateComplete;

    expect(el.savedQueries).to.have.lengthOf(0);
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('save-name-input');
  });

  it('moves controlled saved-query deletion focus to the adjacent delete action', async () => {
    const saved: GraphQuerySavedItem[] = [
      { id: 's1', name: 'First', query: query() },
      { id: 's2', name: 'Second', query: query() },
      { id: 's3', name: 'Third', query: query() },
    ];
    const el = (await fixture(
      html`<lr-graph-query-builder .savedQueries=${saved}></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    el.addEventListener('lr-query-delete', (event) => {
      el.savedQueries = el.savedQueries.filter((item) => item.id !== event.detail.queryId);
    });
    const deleteButtons = el.shadowRoot!.querySelectorAll<HTMLElement>('[part="saved-delete-button"]');
    deleteButtons[1]!.focus();
    deleteButtons[1]!.click();
    await el.updateComplete;

    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('saved-delete-button');
    expect(
      (el.shadowRoot!.activeElement as HTMLElement | null)?.closest('[data-query-id]')?.getAttribute('data-query-id')
    ).to.equal('s3');
  });

  it('does not steal external focus when an unfocused saved query is removed', async () => {
    const wrapper = await fixture(html`
      <div>
        <button id="outside-query-builder">Outside</button>
        <lr-graph-query-builder .savedQueries=${[{ id: 's1', name: 'Only', query: query() }]}></lr-graph-query-builder>
      </div>
    `);
    const el = wrapper.querySelector('lr-graph-query-builder') as LyraGraphQueryBuilder;
    wrapper.querySelector<HTMLElement>('#outside-query-builder')!.focus();
    el.savedQueries = [];
    await el.updateComplete;

    expect(el.ownerDocument.activeElement?.id).to.equal('outside-query-builder');
  });

  it('disables every interactive part when disabled', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder disabled></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    expect(
      (
        el.shadowRoot!.querySelector('[part="start-input"]') as HTMLElement & {
          disabled: boolean;
        }
      ).disabled
    ).to.be.true;
    expect((el.shadowRoot!.querySelector('[part="run-button"]') as HTMLButtonElement).disabled).to.be.true;
    expect(
      (el.shadowRoot!.querySelector('[part="relationship-picker"]') as HTMLElement & { disabled: boolean }).disabled
    ).to.be.true;

    let fired = false;
    el.addEventListener('lr-input', () => (fired = true));
    const startInput = el.shadowRoot!.querySelector('[part="start-input"]') as HTMLElement;
    startInput.dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'node-1' } }));
    expect(fired).to.be.false;
  });

  it('resets to its initial normalized value on formResetCallback', async () => {
    const initial = query({
      startId: 'node-1',
      relationshipTypes: ['works_for', 'works_for'],
      minHops: 2,
      maxHops: 4,
    });
    const form = (await fixture(html`
      <form>
        <lr-graph-query-builder name="query" .value=${initial}></lr-graph-query-builder>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-graph-query-builder') as LyraGraphQueryBuilder;
    await el.updateComplete;
    el.value = query({ startId: 'node-2', nodeTypes: ['Document'] });
    await el.updateComplete;
    form.reset();
    await el.updateComplete;
    expect(el.value.startId).to.equal('node-1');
    expect(el.value.relationshipTypes).to.deep.equal(['works_for']);
    expect(el.value.nodeTypes).to.deep.equal([]);
    expect(el.value.minHops).to.equal(2);
    expect(el.value.maxHops).to.equal(4);
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
    const el = (await fixture(
      html`<lr-graph-query-builder hop-limit="3"></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const options = (el.shadowRoot!.querySelector('[part="min-hops"]') as HTMLElement).querySelectorAll('lr-option');
    expect(options.length).to.equal(3);
  });

  it('locale-formats visible hop option labels while preserving machine values', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder locale="ar" hop-limit="3"></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    const options = [
      ...(el.shadowRoot!.querySelector('[part="min-hops"]') as HTMLElement).querySelectorAll('lr-option'),
    ] as Array<HTMLElement & { value: string }>;
    expect(options.map((option) => option.value)).to.deep.equal(['1', '2', '3']);
    expect(options.map((option) => option.textContent)).to.deep.equal(
      [1, 2, 3].map((value) => new Intl.NumberFormat('ar').format(value))
    );
  });

  it('renders a .strings override for graphQueryRun and the shared fieldRequired key', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder
        .strings=${{
          graphQueryRun: 'Lancer',
          fieldRequired: 'Ce champ est requis.',
        }}
      ></lr-graph-query-builder>`
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
      html`<div dir="rtl">
        <lr-graph-query-builder .relationshipTypeOptions=${RELATIONSHIP_OPTIONS}></lr-graph-query-builder>
      </div>`
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
        .value=${query({
          relationshipTypes: ['works_for'],
          nodeTypes: ['person'],
        })}
      ></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    el.reportValidity();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="relationship-chips"] lr-chip').length).to.equal(1);
    expect(el.shadowRoot!.querySelector('[part="saved-item"]')).to.exist;
    await expect(el).to.be.accessible();
  });

  it('exposes the ElementInternals-delegated form-participation getters', async () => {
    const form = (await fixture(html`
      <form>
        <lr-graph-query-builder name="query"></lr-graph-query-builder>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-graph-query-builder') as LyraGraphQueryBuilder;
    await el.updateComplete;
    expect(el.form === form).to.equal(true);
    expect(el.getForm() === form).to.equal(true);
    // Assert labels.length (a number), never the NodeList itself: a *failing* chai assertion whose
    // `actual` is a DOM node/NodeList hangs the whole wtr session (wtr ships `err.actual` verbatim in
    // its session-finished message, which is serialized with structuredClone() -- DataCloneError on
    // any DOM value, so no result is ever reported and the run dies at testsFinishTimeout).
    expect(el.labels.length).to.equal(0);
    expect(el.willValidate).to.be.true;
    // Default value has an empty startId, which computeValidation() flags as missing.
    expect(el.validity.valueMissing).to.be.true;
    expect(el.validity.valid).to.be.false;
    expect(el.validationMessage).to.equal('This field is required.');
  });

  it('detaches from its implicit form owner and reattaches to an explicit one via the form setter', async () => {
    const root = await fixture(html`
      <div>
        <form id="one"></form>
        <lr-graph-query-builder name="query"></lr-graph-query-builder>
      </div>
    `);
    const el = root.querySelector('lr-graph-query-builder') as LyraGraphQueryBuilder;
    const one = root.querySelector('#one') as HTMLFormElement;
    await el.updateComplete;
    expect(el.form === null).to.equal(true);

    el.form = one;
    await el.updateComplete;
    expect(el.form === one).to.equal(true);
    expect(el.getForm() === one).to.equal(true);

    el.form = null;
    await el.updateComplete;
    expect(el.form === null).to.equal(true);
    expect(el.getForm() === null).to.equal(true);
  });

  it('normalizes a nullish name to an empty string, exercising the removeAttribute branch of the name setter', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder name="query"></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    expect(el.name).to.equal('query');
    expect(el.getAttribute('name')).to.equal('query');

    el.name = null as unknown as string;
    // The setter's own synchronous `else this.removeAttribute('name')` branch runs immediately;
    // this component's `name` also carries `reflect: true`, so Lit's own reflection pass on the
    // next update independently re-applies the (now-empty) property value to the attribute.
    expect(el.hasAttribute('name')).to.be.false;
    await el.updateComplete;
    expect(el.name).to.equal('');
    expect(el.getAttribute('name')).to.equal('');
  });

  it('normalizes a null/undefined value assignment to the empty query', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder .value=${query({ startId: 'node-1' })}></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    expect(el.value.startId).to.equal('node-1');
    el.value = null as unknown as GraphQuery;
    await el.updateComplete;
    expect(el.value).to.deep.equal(query());
  });

  it('normalizes away unrelated circular fields before form serialization', async () => {
    const form = (await fixture(html`
      <form>
        <lr-graph-query-builder name="query"></lr-graph-query-builder>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-graph-query-builder') as LyraGraphQueryBuilder;
    await el.updateComplete;
    const circular: Record<string, unknown> = { startId: 'node-1' };
    circular.self = circular;
    el.value = circular as unknown as GraphQuery;
    await el.updateComplete;
    const data = new FormData(form);
    expect(JSON.parse(data.get('query') as string)).to.deep.equal(query({ startId: 'node-1' }));
  });

  it('formStateRestoreCallback restores a JSON-encoded value', async () => {
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    await el.updateComplete;
    el.formStateRestoreCallback(JSON.stringify(query({ startId: 'restored-1', relationshipTypes: ['works_for'] })));
    await el.updateComplete;
    expect(el.value.startId).to.equal('restored-1');
    expect(el.value.relationshipTypes).to.deep.equal(['works_for']);
  });

  it('normalizes adversarial direct and restored value shapes without throwing or retaining malformed fields', async () => {
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    expect(() => {
      el.value = {
        startId: 42,
        endId: null,
        relationshipTypes: 'works_for',
        nodeTypes: [7, 'person'],
        direction: 'sideways',
        minHops: Number.NaN,
        maxHops: Number.POSITIVE_INFINITY,
      } as unknown as GraphQuery;
    }).to.not.throw();
    await el.updateComplete;
    expect(el.value).to.deep.equal({
      startId: '',
      endId: '',
      relationshipTypes: [],
      nodeTypes: ['person'],
      direction: 'both',
      minHops: 1,
      maxHops: 1,
    });

    expect(() =>
      el.formStateRestoreCallback(
        JSON.stringify({
          startId: 7,
          relationshipTypes: 'bad',
          nodeTypes: ['organization'],
        })
      )
    ).to.not.throw();
    await el.updateComplete;
    expect(el.value.startId).to.equal('');
    expect(el.value.relationshipTypes).to.deep.equal([]);
    expect(el.value.nodeTypes).to.deep.equal(['organization']);
  });

  it('normalizes a value whose field accessors throw, falling back to defaults instead of throwing (ownValue)', async () => {
    const hostile = new Proxy(
      { startId: 'node-1' },
      {
        getOwnPropertyDescriptor(target, prop) {
          if (prop === 'endId') throw new Error('hostile getOwnPropertyDescriptor');
          return Reflect.getOwnPropertyDescriptor(target, prop);
        },
      },
    );
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    expect(() => {
      el.value = hostile as unknown as GraphQuery;
    }).to.not.throw();
    await el.updateComplete;
    expect(el.value.startId).to.equal('node-1');
    expect(el.value.endId).to.equal('');
  });

  it('renders complete outer label, hint, and error chrome with matching slots and descriptions', async () => {
    const el = (await fixture(html`
      <lr-graph-query-builder label="Graph path" hint="Choose a path" error-text="Query invalid">
        <span slot="hint"> with care</span>
      </lr-graph-query-builder>
    `)) as LyraGraphQueryBuilder;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;

    expect(label.textContent).to.contain('Graph path');
    expect(hint.textContent).to.contain('Choose a path');
    expect(error.textContent).to.contain('Query invalid');
    expect(base.getAttribute('aria-describedby')).to.include(hint.id);
    expect(base.getAttribute('aria-describedby')).to.include(error.id);
    expect(el.shadowRoot!.querySelector('slot[name="label"]')).to.exist;
    expect(el.shadowRoot!.querySelector('slot[name="hint"]')).to.exist;
    expect(el.shadowRoot!.querySelector('slot[name="error"]')).to.exist;
  });

  it('formStateRestoreCallback falls back to the empty value for malformed JSON', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder .value=${query({ startId: 'node-1' })}></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    el.formStateRestoreCallback('{not valid json');
    await el.updateComplete;
    expect(el.value.startId).to.equal('');
  });

  it('formStateRestoreCallback falls back to the empty value for non-string state (e.g. FormData)', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder .value=${query({ startId: 'node-1' })}></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    el.formStateRestoreCallback(new FormData());
    await el.updateComplete;
    expect(el.value.startId).to.equal('');
  });

  it('formStateRestoreCallback falls back to the empty value when the parsed JSON is not a plain object (e.g. an array)', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder .value=${query({ startId: 'node-1' })}></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    el.formStateRestoreCallback('[1,2,3]');
    await el.updateComplete;
    expect(el.value.startId).to.equal('');
  });

  it('marks the start field as touched on blur, revealing its error only once (already-touched guard)', async () => {
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const startInput = el.shadowRoot!.querySelector('[part="start-input"]') as HTMLElement & { errorText: string };
    expect(startInput.errorText).to.equal('');
    startInput.dispatchEvent(new Event('blur'));
    await el.updateComplete;
    expect(startInput.errorText).to.equal('This field is required.');
    // A second blur hits the already-touched guard and is a no-op.
    startInput.dispatchEvent(new Event('blur'));
    await el.updateComplete;
    expect(startInput.errorText).to.equal('This field is required.');
  });

  it('add pickers ignore an empty selection and an already-active duplicate, for both relationship and node types', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder
        .relationshipTypeOptions=${RELATIONSHIP_OPTIONS}
        .nodeTypeOptions=${NODE_TYPE_OPTIONS}
        .value=${query({
          relationshipTypes: ['works_for'],
          nodeTypes: ['person'],
        })}
      ></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-input', () => (fired = true));

    const relPicker = el.shadowRoot!.querySelector('[part="relationship-picker"]') as HTMLElement & { value: string };
    relPicker.dispatchEvent(new Event('change')); // empty selection (picker left at its placeholder)
    relPicker.value = 'works_for'; // already active
    relPicker.dispatchEvent(new Event('change'));

    const nodePicker = el.shadowRoot!.querySelector('[part="node-type-picker"]') as HTMLElement & { value: string };
    nodePicker.dispatchEvent(new Event('change')); // empty selection
    nodePicker.value = 'person'; // already active
    nodePicker.dispatchEvent(new Event('change'));

    await el.updateComplete;
    expect(fired).to.be.false;
    expect(el.value.relationshipTypes).to.deep.equal(['works_for']);
    expect(el.value.nodeTypes).to.deep.equal(['person']);
  });

  it('guards runQuery/saveQuery/loadQuery/deleteQuery against being invoked while disabled', async () => {
    const saved: GraphQuerySavedItem[] = [{ id: 's1', name: 'Coworkers', query: query({ startId: 'node-9' }) }];
    const el = (await fixture(
      html`<lr-graph-query-builder
        disabled
        .savedQueries=${saved}
        .value=${query({ startId: 'node-1' })}
      ></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;

    let runFired = false;
    let saveFired = false;
    let loadFired = false;
    let deleteFired = false;
    el.addEventListener('lr-query-run', () => (runFired = true));
    el.addEventListener('lr-query-save', () => (saveFired = true));
    el.addEventListener('lr-query-load', () => (loadFired = true));
    el.addEventListener('lr-query-delete', () => (deleteFired = true));

    // These handlers are only reachable through their (correctly disabled) buttons in the UI;
    // called directly here to exercise the defensive effectiveDisabled guard each one starts with.
    const internal = el as unknown as {
      runQuery(): void;
      saveQuery(): void;
      loadQuery(item: GraphQuerySavedItem): void;
      deleteQuery(item: GraphQuerySavedItem): void;
    };
    internal.runQuery();
    internal.saveQuery();
    internal.loadQuery(saved[0]);
    internal.deleteQuery(saved[0]);

    expect(runFired).to.be.false;
    expect(saveFired).to.be.false;
    expect(loadFired).to.be.false;
    expect(deleteFired).to.be.false;
  });

  it('saveQuery no-ops when the save name is blank, even called directly (defensive guard behind the disabled save button)', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder .value=${query({ startId: 'node-1' })}></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-query-save', () => (fired = true));
    (el as unknown as { saveQuery(): void }).saveQuery();
    expect(fired).to.be.false;
  });

  it('dims the disabled run button through the shared disabled-opacity token', async () => {
    const wrapper = (await fixture(
      html`<div style="--lr-theme-opacity-disabled: 0.25">
        <lr-graph-query-builder disabled></lr-graph-query-builder>
      </div>`
    )) as HTMLElement;
    const el = wrapper.querySelector('lr-graph-query-builder') as LyraGraphQueryBuilder;
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="run-button"]') as HTMLButtonElement;
    expect(button.disabled).to.be.true;
    expect(getComputedStyle(button).opacity).to.equal('0.25');
  });

  it('keeps every text action at the shared minimum hit-target height', async () => {
    const saved: GraphQuerySavedItem[] = [{ id: 's1', name: 'Coworkers', query: query() }];
    const el = (await fixture(html`
      <lr-graph-query-builder .savedQueries=${saved}></lr-graph-query-builder>
    `)) as LyraGraphQueryBuilder;
    const nameInput = el.shadowRoot!.querySelector('[part="save-name-input"]') as HTMLElement;
    nameInput.dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'Saved' } }));
    await el.updateComplete;

    for (const part of ['run-button', 'save-button', 'saved-load-button'] as const) {
      const button = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement;
      expect(button.getBoundingClientRect().height, part).to.be.at.least(40);
    }
  });

  it('reveals the max-hops error text after reportValidity when minHops exceeds maxHops', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder
        .value=${query({ startId: 'node-1', minHops: 3, maxHops: 1 })}
      ></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    el.reportValidity();
    await el.updateComplete;
    const maxHopsSelect = el.shadowRoot!.querySelector('[part="max-hops"]') as HTMLElement & { errorText: string };
    expect(maxHopsSelect.errorText).to.equal(el.errors['max-hops']);
    expect(maxHopsSelect.errorText).to.not.equal('');
  });

  it('inherits independent resting action colors from an ancestor', async () => {
    const saved: GraphQuerySavedItem[] = [{ id: 's1', name: 'Coworkers', query: query() }];
    const wrapper = (await fixture(html`
      <div
        style="
          --lr-graph-query-builder-run-bg: rgb(1, 2, 3);
          --lr-graph-query-builder-run-border-color: rgb(4, 5, 6);
          --lr-graph-query-builder-run-color: rgb(7, 8, 9);
          --lr-graph-query-builder-save-bg: rgb(10, 11, 12);
          --lr-graph-query-builder-save-border-color: rgb(13, 14, 15);
          --lr-graph-query-builder-save-color: rgb(16, 17, 18);
          --lr-graph-query-builder-saved-load-color: rgb(19, 20, 21);
          --lr-graph-query-builder-saved-delete-color: rgb(22, 23, 24);
        "
      >
        <lr-graph-query-builder .savedQueries=${saved}></lr-graph-query-builder>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-graph-query-builder') as LyraGraphQueryBuilder;
    await el.updateComplete;
    const run = el.shadowRoot!.querySelector('[part="run-button"]') as HTMLElement;
    const save = el.shadowRoot!.querySelector('[part="save-button"]') as HTMLElement;
    const load = el.shadowRoot!.querySelector('[part="saved-load-button"]') as HTMLElement;
    const remove = el.shadowRoot!.querySelector('[part="saved-delete-button"]') as HTMLElement;

    expect(getComputedStyle(run).backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(run).borderTopColor).to.equal('rgb(4, 5, 6)');
    expect(getComputedStyle(run).color).to.equal('rgb(7, 8, 9)');
    expect(getComputedStyle(save).backgroundColor).to.equal('rgb(10, 11, 12)');
    expect(getComputedStyle(save).borderTopColor).to.equal('rgb(13, 14, 15)');
    expect(getComputedStyle(save).color).to.equal('rgb(16, 17, 18)');
    expect(getComputedStyle(load).color).to.equal('rgb(19, 20, 21)');
    expect(getComputedStyle(remove).color).to.equal('rgb(22, 23, 24)');
  });

  it('inherits independent hover and pressed action colors from an ancestor', async function () {
    this.timeout(15_000);
    const saved: GraphQuerySavedItem[] = [{ id: 's1', name: 'Coworkers', query: query() }];
    const wrapper = (await fixture(html`
      <div
        style="
          --lr-graph-query-builder-run-hover-bg: rgb(31, 32, 33);
          --lr-graph-query-builder-run-active-bg: rgb(34, 35, 36);
          --lr-graph-query-builder-save-hover-bg: rgb(37, 38, 39);
          --lr-graph-query-builder-save-active-bg: rgb(40, 41, 42);
          --lr-graph-query-builder-saved-load-active-bg: rgb(43, 44, 45);
          --lr-graph-query-builder-saved-delete-hover-color: rgb(46, 47, 48);
          --lr-graph-query-builder-saved-delete-active-color: rgb(49, 50, 51);
          --lr-graph-query-builder-saved-delete-active-bg: rgb(52, 53, 54);
        "
      >
        <lr-graph-query-builder .savedQueries=${saved}></lr-graph-query-builder>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-graph-query-builder') as LyraGraphQueryBuilder;
    await el.updateComplete;
    const saveName = el.shadowRoot!.querySelector('[part="save-name-input"]') as HTMLElement;
    saveName.dispatchEvent(new CustomEvent('lr-input', { detail: { value: 'Saved' } }));
    await el.updateComplete;

    const probe = async (
      part: string,
      hovered: { property: 'backgroundColor' | 'color'; value: string } | null,
      active: Array<{ property: 'backgroundColor' | 'color'; value: string }>
    ): Promise<void> => {
      const button = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement;
      button.scrollIntoView();
      const rect = button.getBoundingClientRect();
      try {
        await sendMouse({
          type: 'move',
          position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
        });
        if (hovered) {
          await waitUntil(
            () => getComputedStyle(button)[hovered.property] === hovered.value,
            `${part} hover paint did not settle`,
          );
          expect(getComputedStyle(button)[hovered.property], `${part} hover`).to.equal(hovered.value);
        }
        await sendMouse({ type: 'down' });
        await waitUntil(
          () => {
            const pressedStyle = getComputedStyle(button);
            return active.every(({ property, value }) => pressedStyle[property] === value);
          },
          `${part} active paint did not settle`,
        );
        const pressedStyle = getComputedStyle(button);
        for (const expectation of active) {
          expect(pressedStyle[expectation.property], `${part} active ${expectation.property}`).to.equal(
            expectation.value,
          );
        }
      } finally {
        await sendMouse({ type: 'up' });
        await resetMouse();
      }
    };

    await probe('run-button', { property: 'backgroundColor', value: 'rgb(31, 32, 33)' }, [
      { property: 'backgroundColor', value: 'rgb(34, 35, 36)' },
    ]);
    await probe('save-button', { property: 'backgroundColor', value: 'rgb(37, 38, 39)' }, [
      { property: 'backgroundColor', value: 'rgb(40, 41, 42)' },
    ]);
    await probe('saved-load-button', null, [{ property: 'backgroundColor', value: 'rgb(43, 44, 45)' }]);
    await probe('saved-delete-button', { property: 'color', value: 'rgb(46, 47, 48)' }, [
      { property: 'color', value: 'rgb(49, 50, 51)' },
      { property: 'backgroundColor', value: 'rgb(52, 53, 54)' },
    ]);
  });

  // Asserted through getComputedStyle on a really hovered/pressed element rather than by grepping
  // the stylesheet: the previous version of this test matched `filter: brightness` in the CSS text,
  // which kept passing while proving nothing about what the button actually renders.
  for (const part of ['run-button', 'save-button'] as const) {
    it(`renders a hover fill on ${part}, and a pressed fill distinct from both`, async () => {
      const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement;
      button.scrollIntoView();
      const resting = getComputedStyle(button).backgroundColor;
      const rect = button.getBoundingClientRect();
      const position: [number, number] = [
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.top + rect.height / 2),
      ];
      try {
        await sendMouse({ type: 'move', position });
        await waitUntil(
          () => getComputedStyle(button).backgroundColor !== resting,
          `${part} hover paint did not settle`,
        );
        const hovered = getComputedStyle(button).backgroundColor;
        expect(hovered, 'hovered fill must differ from the resting one').to.not.equal(resting);
        await sendMouse({ type: 'down' });
        await waitUntil(
          () => {
            const current = getComputedStyle(button).backgroundColor;
            return current !== hovered && current !== resting;
          },
          `${part} pressed paint did not settle`,
        );
        const pressed = getComputedStyle(button).backgroundColor;
        expect(pressed, 'pressed fill must differ from the hovered one').to.not.equal(hovered);
        expect(pressed, 'pressed fill must differ from the resting one').to.not.equal(resting);
      } finally {
        await sendMouse({ type: 'up' });
        await resetMouse();
      }
    });
  }

  it('names the role="group" region from its visible localized label when unset', async () => {
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
    expect(base.getAttribute('role')).to.equal('group');
    expect(base.hasAttribute('aria-label')).to.equal(false);
    expect(base.getAttribute('aria-labelledby')).to.equal(label.id);
    expect(label.textContent!.trim()).to.equal('Graph query builder');
  });

  it('names the region from the label property when set and no host aria-label is present', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder label="Path filter"></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
    expect(base.hasAttribute('aria-label')).to.equal(false);
    expect(base.getAttribute('aria-labelledby')).to.equal(label.id);
    expect(label.textContent!.trim()).to.equal('Path filter');
  });

  it('uses slotted visible label content as the group name when no host aria-label exists', async () => {
    const el = (await fixture(html`
      <lr-graph-query-builder><span slot="label">Find related accounts</span></lr-graph-query-builder>
    `)) as LyraGraphQueryBuilder;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
    const slot = label.querySelector('slot') as HTMLSlotElement;
    expect(base.hasAttribute('aria-label')).to.equal(false);
    expect(base.getAttribute('aria-labelledby')).to.equal(label.id);
    expect(slot.assignedNodes({ flatten: true }).map((node) => node.textContent).join('').trim())
      .to.equal('Find related accounts');
  });

  it('a host-level aria-label attribute wins over both the label property and the localized default', async () => {
    const el = (await fixture(
      html`<lr-graph-query-builder aria-label="Custom region name" label="Path filter"></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Custom region name');
  });
});

describe('lifecycle: attachInternals guard', () => {
  it('degrades gracefully instead of throwing when ElementInternals is unavailable', async () => {
    const original = (globalThis as { ElementInternals?: unknown }).ElementInternals;
    // Deliberately simulating an environment (e.g. happy-dom) with no ElementInternals
    // implementation at all.
    delete (globalThis as { ElementInternals?: unknown }).ElementInternals;
    try {
      expect(() => document.createElement('lr-graph-query-builder')).to.not.throw();
      const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
      await el.updateComplete;
      // Rendering and the non-form-associated surface still work in the degraded environment.
      expect(el.shadowRoot!.querySelectorAll('[part="base"]').length).to.equal(1);
      expect(() => el.checkValidity()).to.not.throw();
    } finally {
      (globalThis as { ElementInternals?: unknown }).ElementInternals = original;
    }
  });

  it('degrades gracefully instead of throwing when the native attachInternals() call itself throws', async () => {
    // Scoped to just this tag -- the shadow tree also renders `<lr-select>`/`<lr-input>`, which
    // (out of this bucket's scope to fix) call attachInternals() unguarded in their own
    // constructors too, so a blanket stub would break unrelated children instead of isolating
    // this component's own guard.
    const original = HTMLElement.prototype.attachInternals;
    HTMLElement.prototype.attachInternals = function (this: HTMLElement) {
      if (this.tagName.toLowerCase() === 'lr-graph-query-builder') {
        throw new DOMException('attachInternals is not supported', 'NotSupportedError');
      }
      return original.call(this);
    };
    try {
      expect(() => document.createElement('lr-graph-query-builder')).to.not.throw();
      const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="base"]').length).to.equal(1);
      expect(() => el.checkValidity()).to.not.throw();
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });

  it('still reports the real validity state through the fallback internals, instead of claiming valid', async () => {
    // The whole point of the degraded path: form participation is unavailable, but validity is
    // *computed*, not guessed. A stand-in hardcoding `checkValidity: () => true` silently tells
    // every consumer an anchor-less query is runnable.
    const original = HTMLElement.prototype.attachInternals;
    HTMLElement.prototype.attachInternals = function (this: HTMLElement) {
      if (this.tagName.toLowerCase() === 'lr-graph-query-builder') {
        throw new DOMException('attachInternals is not supported', 'NotSupportedError');
      }
      return original.call(this);
    };
    try {
      const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
      await el.updateComplete;
      // Empty startId -> valueMissing, exactly as with real ElementInternals.
      expect(el.checkValidity(), 'an anchor-less query must not report valid').to.be.false;
      expect(el.reportValidity()).to.be.false;
      expect(el.validity.valueMissing).to.be.true;
      expect(el.validity.valid).to.be.false;
      expect(el.validationMessage).to.equal('This field is required.');

      // Anchored -> valid, proving the flags actually thread through rather than being stuck.
      el.value = query({ startId: 'node-1' });
      await el.updateComplete;
      expect(el.checkValidity()).to.be.true;
      expect(el.validity.valueMissing).to.be.false;
      expect(el.validity.valid).to.be.true;
      expect(el.validationMessage).to.equal('');

      // The other constraint, and setCustomValidity(), reach the same stand-in.
      el.setCustomValidity('Rejected by the server.');
      expect(el.checkValidity()).to.be.false;
      expect(el.validity.customError).to.be.true;
      expect(el.validationMessage).to.equal('Rejected by the server.');
      el.setCustomValidity('');
      expect(el.checkValidity()).to.be.true;

      // Inert form participation is still inert -- that half is genuinely unavailable.
      expect(el.form === null, 'form owner stays null').to.be.true;
      expect(el.labels.length).to.equal(0);
      expect(el.willValidate).to.be.false;
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

describe('validity custom states', () => {
  // Guarded exactly like internal/form-associated.test.ts's own pair: not every engine ships
  // CustomStateSet, and not every engine that does also parses the :state() selector, so an
  // unguarded assertion here would fail on WebKit rather than report a real defect.
  const supportsCustomStates = ((): boolean => {
    try {
      return typeof CustomStateSet === 'function';
    } catch {
      return false;
    }
  })();
  const supportsStateSelector = ((): boolean => {
    try {
      document.createElement('div').matches(':state(x)');
      return true;
    } catch {
      return false;
    }
  })();

  const states = (el: LyraGraphQueryBuilder): CustomStateSet =>
    (el as unknown as { internals: ElementInternals }).internals.states;

  const startInput = (el: LyraGraphQueryBuilder): HTMLElement =>
    el.shadowRoot!.querySelector('[part="start-input"]') as HTMLElement;

  it('publishes required/optional and valid/invalid, kept in sync with validity', async function () {
    if (!supportsCustomStates) this.skip();
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    await el.updateComplete;
    // This control's one constraint never lifts, so `required` is unconditional -- see the class
    // doc's @cssstate block.
    expect(states(el).has('required')).to.be.true;
    expect(states(el).has('optional')).to.be.false;
    expect(states(el).has('invalid'), 'an empty query has no start anchor').to.be.true;
    expect(states(el).has('valid')).to.be.false;

    el.value = query({ startId: 'node-1' });
    await el.updateComplete;
    expect(states(el).has('valid')).to.be.true;
    expect(states(el).has('invalid')).to.be.false;

    el.value = query({ startId: 'node-1', minHops: 3, maxHops: 1 });
    await el.updateComplete;
    expect(states(el).has('invalid'), 'minHops > maxHops is the other constraint').to.be.true;
    expect(states(el).has('valid')).to.be.false;
  });

  it('withholds user-valid/user-invalid until the user has actually interacted', async function () {
    if (!supportsCustomStates) this.skip();
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    await el.updateComplete;
    expect(states(el).has('invalid')).to.be.true;
    expect(states(el).has('user-invalid'), 'a pristine query must not style itself red').to.be.false;
    expect(states(el).has('user-valid')).to.be.false;

    // Leaving the start field is interaction even when nothing was typed.
    startInput(el).dispatchEvent(new Event('blur'));
    await el.updateComplete;
    expect(states(el).has('user-invalid')).to.be.true;
    expect(states(el).has('user-valid')).to.be.false;

    startInput(el).dispatchEvent(
      new CustomEvent('lr-input', {
        detail: { value: 'node-1' },
        bubbles: true,
        composed: true,
      })
    );
    await el.updateComplete;
    expect(states(el).has('user-valid')).to.be.true;
    expect(states(el).has('user-invalid')).to.be.false;
  });

  it('does not count a programmatic value assignment as interaction', async function () {
    if (!supportsCustomStates) this.skip();
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    await el.updateComplete;
    el.value = query({ startId: 'node-1', minHops: 3, maxHops: 1 });
    await el.updateComplete;
    expect(states(el).has('invalid')).to.be.true;
    expect(states(el).has('user-invalid'), 'the host set the value, not the user').to.be.false;
  });

  it('counts a reportValidity() call — what the Run button runs — as interaction', async function () {
    if (!supportsCustomStates) this.skip();
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    await el.updateComplete;
    expect(states(el).has('user-invalid')).to.be.false;
    el.reportValidity();
    await el.updateComplete;
    expect(states(el).has('user-invalid')).to.be.true;
  });

  it('goes pristine again after a form reset', async function () {
    if (!supportsCustomStates) this.skip();
    const form = await fixture<HTMLFormElement>(
      html`<form>
        <lr-graph-query-builder name="q"></lr-graph-query-builder>
      </form>`
    );
    const el = form.querySelector('lr-graph-query-builder') as LyraGraphQueryBuilder;
    await el.updateComplete;
    el.reportValidity();
    expect(states(el).has('user-invalid')).to.be.true;
    form.reset();
    await el.updateComplete;
    expect(states(el).has('invalid'), 'still invalid — reset cleared the value, not the constraint').to.be.true;
    expect(states(el).has('user-invalid'), 'but pristine again, so nothing should be painted red').to.be.false;
  });

  it('publishes neither invalid nor user-invalid while disabled', async function () {
    if (!supportsCustomStates) this.skip();
    // A native `<input required disabled>` matches neither `:valid` nor `:invalid`. This control's
    // one constraint never lifts, so before barring was wired every disabled builder published
    // `invalid` — and, after any reportValidity(), `user-invalid` — painting itself red under the
    // documented `lr-graph-query-builder:state(user-invalid) { ... }` rule.
    const el = (await fixture(
      html`<lr-graph-query-builder disabled></lr-graph-query-builder>`
    )) as LyraGraphQueryBuilder;
    await el.updateComplete;
    expect(el.checkValidity(), 'a barred control reports no violation').to.be.true;
    expect(el.validity.valueMissing).to.be.false;
    expect(states(el).has('invalid')).to.be.false;
    expect(states(el).has('valid'), 'barred matches neither half of the pair').to.be.false;
    expect(states(el).has('required'), 'requiredness describes the attribute, not the outcome').to.be.true;
    el.reportValidity();
    await el.updateComplete;
    expect(states(el).has('user-invalid')).to.be.false;

    el.disabled = false;
    await el.updateComplete;
    expect(el.checkValidity(), 'the constraint returns with the control').to.be.false;
    expect(states(el).has('invalid')).to.be.true;
  });

  it('publishes neither invalid nor user-invalid inside a disabled fieldset', async function () {
    if (!supportsCustomStates) this.skip();
    const form = await fixture<HTMLFormElement>(html`
      <form>
        <fieldset disabled>
          <lr-graph-query-builder name="q"></lr-graph-query-builder>
        </fieldset>
      </form>
    `);
    const el = form.querySelector('lr-graph-query-builder') as LyraGraphQueryBuilder;
    await el.updateComplete;
    expect(el.disabled, 'a fieldset never mutates the control own disabled').to.be.false;
    expect(el.validity.valueMissing, 'fieldset-disabled bars validation exactly like own disabled').to.be.false;
    expect(states(el).has('invalid')).to.be.false;
    el.reportValidity();
    await el.updateComplete;
    expect(states(el).has('user-invalid')).to.be.false;
  });

  it('matches the states through a :state() selector, not just the CustomStateSet', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    await el.updateComplete;
    const host = el as unknown as HTMLElement;
    expect(host.matches(':state(required)')).to.be.true;
    expect(host.matches(':state(optional)')).to.be.false;
    expect(host.matches(':state(invalid)')).to.be.true;
    expect(host.matches(':state(user-invalid)')).to.be.false;
    el.reportValidity();
    await el.updateComplete;
    expect(host.matches(':state(user-invalid)')).to.be.true;
  });
});

describe('setCustomValidity()', () => {
  // Guarded exactly like the validity-custom-states suite above (and internal/form-associated.test.ts):
  // not every engine ships CustomStateSet, and not every engine that does also parses `:state()`.
  const supportsCustomStates = ((): boolean => {
    try {
      return typeof CustomStateSet === 'function';
    } catch {
      return false;
    }
  })();
  const supportsStateSelector = ((): boolean => {
    try {
      document.createElement('div').matches(':state(x)');
      return true;
    } catch {
      return false;
    }
  })();

  it('blocks form submission with a consumer-supplied error, and reports it as validationMessage', async () => {
    const form = await fixture<HTMLFormElement>(
      html`<form>
        <lr-graph-query-builder name="q"></lr-graph-query-builder>
      </form>`
    );
    const el = form.querySelector('lr-graph-query-builder') as LyraGraphQueryBuilder;
    el.value = query({ startId: 'node-1' });
    await el.updateComplete;
    let submits = 0;
    // Registered before any requestSubmit() below, so a successful submission can never navigate
    // the test page.
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submits += 1;
    });
    expect(el.checkValidity(), 'valid before the custom error').to.be.true;

    el.setCustomValidity('No graph is loaded for that tenant.');
    expect(el.validity.customError).to.be.true;
    expect(el.checkValidity()).to.be.false;
    expect(el.validationMessage).to.equal('No graph is loaded for that tenant.');
    expect(form.checkValidity()).to.be.false;
    form.requestSubmit();
    expect(submits, 'a custom error blocks submission').to.equal(0);

    el.setCustomValidity('');
    expect(el.validity.customError).to.be.false;
    expect(el.validationMessage).to.equal('');
    form.requestSubmit();
    expect(submits, 'submission is unblocked once the custom error is cleared').to.equal(1);
  });

  it('publishes effective custom and disabled validity as frozen deduplicated snapshots', async () => {
    const el = (await fixture(html`
      <lr-graph-query-builder .value=${query({ startId: 'node-1' })}></lr-graph-query-builder>
    `)) as LyraGraphQueryBuilder;
    const customEvent = oneEvent(el, 'lr-validity-change');
    el.setCustomValidity('Rejected by policy.');
    const custom = await customEvent;
    expect(custom.detail.valid).to.equal(false);
    expect(custom.detail.errors).to.deep.equal({ base: 'Rejected by policy.' });
    expect(Object.isFrozen(custom.detail)).to.equal(true);
    expect(Object.isFrozen(custom.detail.errors)).to.equal(true);
    expect(el.errors).to.deep.equal({ base: 'Rejected by policy.' });

    const barredEvent = oneEvent(el, 'lr-validity-change');
    el.disabled = true;
    const barred = await barredEvent;
    expect(barred.detail).to.deep.equal({ valid: true, errors: {} });
    expect(el.willValidate).to.equal(false);
  });

  it('emits a cancelable lr-invalid alias and forwards its veto to the native invalid event', async () => {
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    let alias: CustomEvent | undefined;
    el.addEventListener('lr-invalid', (event) => {
      alias = event;
      event.preventDefault();
    });
    const native = new Event('invalid', { cancelable: true });

    expect(el.dispatchEvent(native)).to.equal(false);
    expect(alias?.cancelable).to.equal(true);
    expect(alias?.defaultPrevented).to.equal(true);
    expect(native.defaultPrevented).to.equal(true);
  });

  it('treats an undefined runtime custom-validity message as clearing the prior error', async () => {
    const el = (await fixture(html`
      <lr-graph-query-builder></lr-graph-query-builder>
    `)) as LyraGraphQueryBuilder;
    el.value = query({ startId: 'node-1' });
    await el.updateComplete;

    el.setCustomValidity('No graph is loaded for that tenant.');
    expect(el.validity.customError).to.be.true;

    el.setCustomValidity(undefined as unknown as string);
    expect(el.validity.customError).to.be.false;
    expect(el.validationMessage).to.equal('');
  });

  it('keeps a custom error through an intrinsic revalidation', async () => {
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    await el.updateComplete;
    el.setCustomValidity('Rejected by the server.');
    expect(el.validity.customError).to.be.true;

    // Every value assignment re-runs syncFormState() -- the traffic that would otherwise wipe the
    // consumer's error out on each edit.
    el.value = query({ startId: 'node-1' });
    await el.updateComplete;
    expect(el.validity.valueMissing, 'the intrinsic error cleared').to.be.false;
    expect(el.validity.customError, 'the custom error survived the recomputation').to.be.true;
    expect(el.validationMessage).to.equal('Rejected by the server.');
    expect(el.checkValidity(), 'checkValidity() re-syncs and must not drop it either').to.be.false;
  });

  it('keeps a custom error across a form reset, matching native setCustomValidity semantics', async () => {
    // Native `form.reset()` restores a control's value and pristine-ness, but never clears a
    // consumer-set custom error -- only another `setCustomValidity('')` does. This control matches.
    const form = await fixture<HTMLFormElement>(
      html`<form>
        <lr-graph-query-builder name="q"></lr-graph-query-builder>
      </form>`
    );
    const el = form.querySelector('lr-graph-query-builder') as LyraGraphQueryBuilder;
    el.value = query({ startId: 'node-1' });
    await el.updateComplete;
    el.setCustomValidity('That query is not permitted here.');

    form.reset();
    await el.updateComplete;
    expect(el.value.startId, 'the reset cleared the query').to.equal('');
    expect(el.validity.customError, 'the custom error outlives the reset').to.be.true;
    expect(el.validationMessage).to.equal('That query is not permitted here.');
  });

  it('restores the computed validity when a custom error is cleared, rather than forcing the control valid', async () => {
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    await el.updateComplete;
    expect(el.validity.valueMissing, 'an empty query has no start anchor to begin with').to.be.true;

    el.setCustomValidity('Rejected by the server.');
    expect(el.validity.customError).to.be.true;

    el.setCustomValidity('');
    expect(el.validity.customError).to.be.false;
    expect(el.validity.valueMissing, 'the empty query is still missing its start anchor').to.be.true;
    expect(el.checkValidity(), 'clearing the custom error must not force the control valid').to.be.false;
    expect(el.validationMessage.length, 'the intrinsic message is republished').to.be.greaterThan(0);
  });

  it('publishes a custom error through the validity custom states', async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(html`<lr-graph-query-builder></lr-graph-query-builder>`)) as LyraGraphQueryBuilder;
    el.value = query({ startId: 'node-1' });
    await el.updateComplete;
    const host = el as unknown as HTMLElement;
    expect(host.matches(':state(valid)'), 'valid before the custom error').to.be.true;

    el.setCustomValidity('Rejected by the server.');
    expect(host.matches(':state(invalid)'), 'synchronously, not on the next Lit update').to.be.true;
    expect(host.matches(':state(valid)')).to.be.false;
    expect(host.matches(':state(user-invalid)'), 'still pristine until the user has a turn').to.be.false;

    el.reportValidity();
    expect(host.matches(':state(user-invalid)'), 'a reported validation counts as interaction').to.be.true;

    el.setCustomValidity('');
    expect(host.matches(':state(valid)')).to.be.true;
    expect(host.matches(':state(user-valid)')).to.be.true;
    expect(host.matches(':state(user-invalid)')).to.be.false;
  });
});
