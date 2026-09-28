import { expect, html } from '@open-wc/testing';
import './data-grid.js';
import type { DataGridColumn, DataGridSort } from './data-grid-types.js';
import { type Person, columns, rows, dataGrid } from '../../../../test/data-grid.js';


it("skips a sort entry whose id accessor throws, keeping valid neighbors", async () => {
  const poisoned = {
    get id(): string {
      throw new Error("boom");
    },
    desc: true,
  };
  const element = await dataGrid(html`
    <lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  element.sort = [poisoned as DataGridSort, { id: "name", desc: false }];
  await element.updateComplete;
  expect(element.sort).to.deep.equal([{ id: "name", desc: false }]);
});

it("clone-owns a plain array filter value as a frozen array, and skips a filter whose id accessor throws", async () => {
  const poisoned = {
    get id(): string {
      throw new Error("boom");
    },
    value: "ignored",
  };
  const element = await dataGrid(html`
    <lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>
  `);
  element.filters = [
    poisoned as unknown as { id: string; value: unknown },
    { id: "team", value: ["Compiler", "Runtime"] },
  ];
  await element.updateComplete;
  expect(element.filters).to.deep.equal([{ id: "team", value: ["Compiler", "Runtime"] }]);
  expect(Object.isFrozen(element.filters[0]!.value)).to.equal(true);
});

it("snapshots column records and array-form grouping synchronously on assignment", async () => {
  const element = await dataGrid();
  const authoredColumns = [{ field: "name", label: "Original" }];
  const authoredGroups = ["team", "score"];

  element.columns = authoredColumns;
  element.groupBy = authoredGroups;
  authoredColumns[0]!.label = "Mutated";
  authoredColumns.push({ field: "team", label: "Later" });
  authoredGroups[0] = "score";
  authoredGroups.push("name");

  expect(element.columns).to.deep.equal([
    { field: "name", label: "Original" },
  ]);
  expect(element.groupBy).to.deep.equal(["team", "score"]);
  expect(Object.isFrozen(element.columns)).to.equal(true);
  expect(Object.isFrozen(element.columns[0])).to.equal(true);
  expect(Object.isFrozen(element.groupBy)).to.equal(true);
});

it("returns detached JSON-safe frozen filter state", async () => {
  const source = new Set(["Compiler"]);
  const element = await dataGrid(html`
    <lr-data-grid
      label="People"
      .columns=${columns}
      .data=${rows}
      .filters=${[{ id: "team", value: source }]}
    ></lr-data-grid>
  `);
  source.add("Runtime");
  const state = element.getState();
  expect(state.filters).to.deep.equal([
    { id: "team", value: ["Compiler"] },
  ]);
  expect(JSON.parse(JSON.stringify(state)).filters).to.deep.equal([
    { id: "team", value: ["Compiler"] },
  ]);
  expect(Object.isFrozen(state)).to.equal(true);
  expect(Object.isFrozen(state.filters)).to.equal(true);
  expect(Object.isFrozen(state.filters![0]!.value)).to.equal(true);
});

it('projects admitted column data descriptors once without invoking source accessors', async () => {
  let accessorReads = 0;
  const formatter = (value: unknown) => `formatted ${String(value)}`;
  const hostileColumn = Object.create(null) as Record<string, unknown>;
  Object.defineProperties(hostileColumn, {
    id: { configurable: true, enumerable: true, value: 'name', writable: true },
    field: { configurable: true, enumerable: true, value: 'name', writable: true },
    formatter: { configurable: true, enumerable: true, value: formatter },
    label: {
      configurable: true,
      enumerable: true,
      get(): string {
        accessorReads += 1;
        return 'Accessor label';
      },
    },
  });

  const element = await dataGrid<Person>();
  element.columns = [hostileColumn as unknown as DataGridColumn<Person>];
  element.data = [rows[0]!];
  await element.updateComplete;

  expect(accessorReads, 'the projection must never execute a source getter').to.equal(0);
  expect(element.columns[0]?.formatter).to.equal(formatter);
  expect(element.shadowRoot!.textContent).to.contain('formatted Ada');

  // A later source write cannot affect the cached projection that all render, sort, and export
  // paths consume.
  hostileColumn['field'] = 'team';
  element.requestUpdate();
  await element.updateComplete;
  expect(element.shadowRoot!.textContent).to.contain('formatted Ada');
  expect(accessorReads).to.equal(0);
});

it('keeps column projections own when Object.prototype supplies a poisoned formatter', async () => {
  const original = Object.getOwnPropertyDescriptor(Object.prototype, 'formatter');
  let inheritedFormatterCalls = 0;
  const element = await dataGrid<Person>();
  try {
    Object.defineProperty(Object.prototype, 'formatter', {
      configurable: true,
      value() {
        inheritedFormatterCalls += 1;
        return 'prototype formatter must not run';
      },
    });
    element.columns = [
      { id: 'plain', field: 'name' },
      {
        id: 'own',
        field: 'name',
        formatter: (value) => `own formatter: ${String(value)}`,
      },
    ];
    element.data = [rows[0]!];
    await element.updateComplete;

    expect(element.columns[0]?.formatter === undefined).to.equal(true);
    expect(inheritedFormatterCalls).to.equal(0);
    expect(element.shadowRoot!.textContent).to.contain('Ada');
    expect(element.shadowRoot!.textContent).to.contain('own formatter: Ada');
  } finally {
    if (original) Object.defineProperty(Object.prototype, 'formatter', original);
    else delete (Object.prototype as Record<string, unknown>)['formatter'];
  }
});

it('retains a safe id while omitting an unsafe optional field and rejects an unsafe id', async () => {
  let fieldReads = 0;
  let idReads = 0;
  const safeIdUnsafeField = Object.create(null) as Record<string, unknown>;
  Object.defineProperties(safeIdUnsafeField, {
    id: { configurable: true, enumerable: true, value: 'safe-id' },
    label: { configurable: true, enumerable: true, value: 'Safe id' },
    value: {
      configurable: true,
      enumerable: true,
      value: (row: Person) => row.name,
    },
    field: {
      configurable: true,
      enumerable: true,
      get(): string {
        fieldReads += 1;
        throw new Error('optional field getter must not run');
      },
    },
  });
  const unsafeId = Object.create(null) as Record<string, unknown>;
  Object.defineProperties(unsafeId, {
    field: { configurable: true, enumerable: true, value: 'name' },
    id: {
      configurable: true,
      enumerable: true,
      get(): string {
        idReads += 1;
        throw new Error('identity getter must reject the record without running');
      },
    },
  });
  const element = await dataGrid<Person>();
  element.columns = [
    safeIdUnsafeField as unknown as DataGridColumn<Person>,
    unsafeId as unknown as DataGridColumn<Person>,
    { id: 'later', field: 'team' },
  ];
  element.data = [rows[0]!];
  await element.updateComplete;

  expect(element.columns.map((column) => column.id)).to.deep.equal([
    'safe-id',
    'later',
  ]);
  expect(element.columns.map((column) => column.field ?? null)).to.deep.equal([
    null,
    'team',
  ]);
  expect(element.shadowRoot!.textContent).to.contain('Ada');
  expect(fieldReads).to.equal(0);
  expect(idReads).to.equal(0);
});

it('omits a malformed field behind a valid id before rendering can call it as a path', async () => {
  const element = await dataGrid<Person>();
  element.columns = [
    {
      id: 'malformed-field',
      field: { not: 'a path' } as unknown as string,
      label: 'Malformed field',
    },
    { id: 'later', field: 'name', label: 'Later valid column' },
  ];
  element.data = [rows[0]!];
  await element.updateComplete;

  expect(element.columns.map((column) => column.field ?? null)).to.deep.equal([
    null,
    'name',
  ]);
  expect(element.shadowRoot!.textContent).to.contain('Ada');
});

it('omits malformed display and aggregation fields without losing safe-id siblings', async () => {
  const element = await dataGrid<Person>();
  element.columns = [
    {
      id: 'malformed-display',
      field: 'name',
      label: Symbol('unsafe label') as unknown as string,
      footer: Symbol('unsafe footer') as unknown as string,
      aggregation: Symbol('unsafe aggregation') as unknown as 'count',
    },
    {
      id: 'later',
      field: 'team',
      label: 'Later valid column',
      footer: 'Teams',
    },
  ];
  element.data = [rows[0]!];
  await element.updateComplete;

  const malformed = element.columns[0]!;
  expect(malformed.id).to.equal('malformed-display');
  expect(malformed.label === undefined).to.equal(true);
  expect(malformed.footer === undefined).to.equal(true);
  expect(malformed.aggregation === undefined).to.equal(true);
  expect(element.columns.map((column) => column.id)).to.deep.equal([
    'malformed-display',
    'later',
  ]);
  expect(element.shadowRoot!.textContent).to.contain('Later valid column');
  expect(element.shadowRoot!.textContent).to.contain('Teams');
});

it('reads hostile column arrays by bounded own indexes instead of their iterator', async () => {
  const source: DataGridColumn<Person>[] = [
    { id: 'first', field: 'name' },
    { id: 'later', field: 'team' },
  ];
  let iteratorReads = 0;
  Object.defineProperty(source, Symbol.iterator, {
    configurable: true,
    get() {
      iteratorReads += 1;
      throw new Error('column iterator must not run');
    },
  });
  const element = await dataGrid<Person>();

  expect(() => {
    element.columns = source;
  }).not.to.throw();
  await element.updateComplete;
  expect(element.columns.map((column) => column.id)).to.deep.equal([
    'first',
    'later',
  ]);
  expect(iteratorReads).to.equal(0);
});

it('skips a hostile column index without losing a later valid index', async () => {
  const source: DataGridColumn<Person>[] = [
    { id: 'first', field: 'name' },
    { id: 'hostile', field: 'score' },
    { id: 'later', field: 'team' },
  ];
  let indexReads = 0;
  Object.defineProperty(source, '1', {
    configurable: true,
    enumerable: true,
    get(): DataGridColumn<Person> {
      indexReads += 1;
      throw new Error('column index getter must not run');
    },
  });
  const element = await dataGrid<Person>();

  expect(() => {
    element.columns = source;
  }).not.to.throw();
  await element.updateComplete;
  expect(element.columns.map((column) => column.id)).to.deep.equal([
    'first',
    'later',
  ]);
  expect(indexReads).to.equal(0);
});

it('contains an unreadable column-array length without trusting a hostile iterator', async () => {
  const source: DataGridColumn<Person>[] = [
    { id: 'first', field: 'name' },
    { id: 'later', field: 'team' },
  ];
  const hostile = new Proxy(source, {
    getOwnPropertyDescriptor(target, property) {
      if (property === 'length') throw new Error('hostile column length');
      return Reflect.getOwnPropertyDescriptor(target, property);
    },
  });
  const element = await dataGrid<Person>();

  expect(() => {
    element.columns = hostile;
  }).not.to.throw();
  await element.updateComplete;
  expect(element.columns.length).to.equal(0);
});
