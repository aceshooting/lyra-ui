import { expect } from '@open-wc/testing';
import './data-grid.js';
import type { DataGridColumn, DataGridFilterType } from './data-grid-types.js';
import { aggregateValues, columnId, columnValue, filterRows, matchesFilter, pathValue, rowsAsDelimited, searchRows, sortRows } from './data-grid-processing.js';
import { type Person, columns, rows } from '../../../../test/data-grid.js';


it("filters, searches, and stable-sorts client rows with locale-aware comparisons", () => {
  const filtered = filterRows(
    rows,
    columns,
    [{ id: "team", value: "compiler" }],
    "en"
  );
  expect(filtered.map((row) => row.name)).to.deep.equal(["Ada", "Grace"]);
  expect(
    searchRows(rows, columns, "lin", "en", null).map((row) => row.id)
  ).to.deep.equal([2]);
  expect(
    sortRows(rows, columns, [{ id: "score", desc: true }], "en").map(
      (row) => row.id
    )
  ).to.deep.equal([2, 3, 1]);
});

it("supports every filter algorithm, computed search values, and custom matchers", () => {
  interface FilterRow extends Person {
    created: string;
    active: boolean;
  }
  const filterRowsFixture: FilterRow[] = [
    {
      ...rows[0]!,
      created: "2026-01-01T12:00:00Z",
      active: true,
      tags: ["lit", "types"],
    },
    {
      ...rows[1]!,
      created: "2026-01-02T12:00:00Z",
      active: false,
      tags: ["runtime"],
    },
    {
      ...rows[2]!,
      created: "2026-01-03T12:00:00Z",
      active: true,
      tags: ["lit", "a11y"],
    },
  ];
  const byName: DataGridColumn<FilterRow> = {
    field: "name",
    filterType: "equals",
  };
  const byScore: DataGridColumn<FilterRow> = {
    field: "score",
    filterType: "number-range",
  };
  const byDate: DataGridColumn<FilterRow> = {
    field: "created",
    filterType: "date-range",
  };
  const byTeam: DataGridColumn<FilterRow> = {
    field: "team",
    filterType: "set",
  };
  const byAnyTag: DataGridColumn<FilterRow> = {
    field: "tags",
    filterType: "includes-any",
  };
  const byAllTags: DataGridColumn<FilterRow> = {
    field: "tags",
    filterType: "includes-all",
  };
  const custom: DataGridColumn<FilterRow> = {
    field: "active",
    filterFn: (value, filter) => value === filter,
  };

  expect(matchesFilter(filterRowsFixture[0]!, byName, "ADA", "en")).to.equal(
    true
  );
  expect(
    filterRows(
      filterRowsFixture,
      [byScore],
      [{ id: "score", value: [8, 10] }],
      "en"
    ).map((row) => row.id)
  ).to.deep.equal([2, 3]);
  expect(
    filterRows(
      filterRowsFixture,
      [byDate],
      [{ id: "created", value: ["2026-01-02", "2026-01-02"] }],
      "en"
    ).map((row) => row.id)
  ).to.deep.equal([2]);
  expect(
    matchesFilter(filterRowsFixture[1]!, byTeam, new Set(["runtime"]), "en")
  ).to.equal(true);
  expect(
    matchesFilter(filterRowsFixture[2]!, byAnyTag, ["runtime", "a11y"], "en")
  ).to.equal(true);
  expect(
    matchesFilter(filterRowsFixture[0]!, byAllTags, ["types", "lit"], "en")
  ).to.equal(true);
  expect(
    filterRows(
      filterRowsFixture,
      [custom],
      [{ id: "active", value: true }],
      "en"
    ).map((row) => row.id)
  ).to.deep.equal([1, 3]);

  const computed: DataGridColumn<FilterRow>[] = [
    { id: "summary", value: (row) => `${row.team}:${row.score}` },
    { field: "name", searchable: false },
  ];
  expect(
    searchRows(filterRowsFixture, computed, "runtime:10", "en", null).map(
      (row) => row.id
    )
  ).to.deep.equal([2]);
  expect(
    searchRows(
      filterRowsFixture,
      computed,
      "COMPILER:9",
      "en",
      (value, term) =>
        String(value).toLocaleLowerCase("en") === term.toLocaleLowerCase("en")
    ).map((row) => row.id)
  ).to.deep.equal([3]);
});

it("honors sort algorithms, undefined placement, custom comparators, multisort, and stability", () => {
  interface SortRow {
    id: number;
    primary?: number;
    text: string;
    date: string;
  }
  const source: SortRow[] = [
    { id: 1, primary: 2, text: "item 10", date: "2026-02-01" },
    { id: 2, text: "item 2", date: "2026-01-01" },
    { id: 3, primary: 2, text: "item 1", date: "2026-03-01" },
  ];
  const sortColumns: DataGridColumn<SortRow>[] = [
    {
      id: "primary",
      field: "primary",
      sortFn: "basic",
      sortUndefined: "first",
    },
    { id: "text", field: "text", sortFn: "alphanumeric" },
    { id: "date", field: "date", sortFn: "datetime" },
    {
      id: "custom",
      value: (row) => row.id,
      comparator: (left, right) => Number(right) - Number(left),
    },
  ];
  expect(
    sortRows(source, sortColumns, [{ id: "primary", desc: false }], "en").map(
      (row) => row.id
    )
  ).to.deep.equal([2, 1, 3]);
  expect(
    sortRows(source, sortColumns, [{ id: "primary", desc: true }], "en").map(
      (row) => row.id
    )
  ).to.deep.equal([2, 1, 3]);
  expect(
    sortRows(source, sortColumns, [{ id: "text", desc: false }], "en").map(
      (row) => row.id
    )
  ).to.deep.equal([3, 2, 1]);
  expect(
    sortRows(source, sortColumns, [{ id: "date", desc: true }], "en").map(
      (row) => row.id
    )
  ).to.deep.equal([3, 1, 2]);
  expect(
    sortRows(
      source,
      sortColumns,
      [
        { id: "primary", desc: false },
        { id: "text", desc: false },
      ],
      "en"
    ).map((row) => row.id)
  ).to.deep.equal([2, 3, 1]);
  expect(
    sortRows(source, sortColumns, [{ id: "custom", desc: false }], "en").map(
      (row) => row.id
    )
  ).to.deep.equal([3, 2, 1]);
  expect(
    sortRows(source, sortColumns, [], "en").map((row) => row.id)
  ).to.deep.equal([1, 2, 3]);
});

it("supports aggregation and formula-safe CSV export", () => {
  expect(
    aggregateValues(
      "sum",
      rows,
      rows.map((row) => row.score)
    )
  ).to.equal(26);
  const csv = rowsAsDelimited(
    [{ id: 1, name: "=danger", team: "Compiler", score: 7 }],
    columns
  );
  expect(csv).to.equal("Name,Team,Score\r\n'=danger,Compiler,7");
});

describe("data-grid processing helpers", () => {
  const locale = "en";

  it('derives a column id from id or field without positional identity', () => {
    expect(columnId({ id: "explicit", field: "name" }, 0)).to.equal("explicit");
    expect(columnId({ field: "name" }, 0)).to.equal("name");
    expect(columnId({}, 2)).to.equal('');
  });

  it("reads dot paths defensively", () => {
    expect(pathValue({ a: { b: 1 } }, "a.b")).to.equal(1);
    expect(pathValue({ a: { b: 1 } }, "")).to.equal(undefined);
    expect(pathValue({ a: 1 }, "a.b")).to.equal(undefined);
    expect(pathValue(null, "a")).to.equal(undefined);
  });

  it("prefers a column value callback over its field path", () => {
    const row = { name: "Ada" };
    expect(
      columnValue({ value: () => "computed", field: "name" }, row)
    ).to.equal("computed");
    expect(columnValue({ field: "name" }, row)).to.equal("Ada");
    expect(columnValue({}, row)).to.equal(undefined);
  });

  it("compares number and date ranges, including an inclusive end day", () => {
    const numberColumn: DataGridColumn<{ v: unknown }> = {
      field: "v",
      filterType: "number-range",
    };
    expect(
      matchesFilter({ v: 5 }, numberColumn, "not-an-array", locale)
    ).to.equal(true);
    expect(matchesFilter({ v: 5 }, numberColumn, [1, 10], locale)).to.equal(
      true
    );
    expect(matchesFilter({ v: 0 }, numberColumn, [1, 10], locale)).to.equal(
      false
    );
    expect(matchesFilter({ v: 20 }, numberColumn, [1, 10], locale)).to.equal(
      false
    );
    expect(
      matchesFilter({ v: 20 }, numberColumn, [1, undefined], locale)
    ).to.equal(true);
    expect(matchesFilter({ v: "" }, numberColumn, [1, 10], locale)).to.equal(
      false
    );
    expect(matchesFilter({ v: "x" }, numberColumn, [1, 10], locale)).to.equal(
      false
    );

    const dateColumn: DataGridColumn<{ v: unknown }> = {
      field: "v",
      filterType: "date-range",
    };
    const start = new Date(2024, 0, 1);
    const end = new Date(2024, 0, 31);
    expect(
      matchesFilter(
        { v: new Date(2024, 0, 31, 23, 30) },
        dateColumn,
        [start, end],
        locale
      )
    ).to.equal(true);
    expect(
      matchesFilter(
        { v: new Date(2024, 1, 1) },
        dateColumn,
        [start, end],
        locale
      )
    ).to.equal(false);
    expect(
      matchesFilter({ v: "2024-01-15" }, dateColumn, [start, end], locale)
    ).to.equal(true);
    expect(
      matchesFilter(
        { v: new Date(Number.NaN) },
        dateColumn,
        [start, end],
        locale
      )
    ).to.equal(false);
    expect(
      matchesFilter({ v: { nested: true } }, dateColumn, [start, end], locale)
    ).to.equal(false);
  });

  it("matches equality, set, includes-any, includes-all, and free-text filters", () => {
    const row = { tags: ["alpha", "beta"], name: "Ada" };
    const tags = (
      filterType: DataGridFilterType
    ): DataGridColumn<typeof row> => ({ field: "tags", filterType });

    expect(
      matchesFilter(row, { field: "name", filterType: "equals" }, "ada", locale)
    ).to.equal(true);
    expect(
      matchesFilter(row, { field: "name", filterType: "equals" }, "lin", locale)
    ).to.equal(false);

    expect(matchesFilter(row, tags("set"), [], locale)).to.equal(true);
    expect(matchesFilter(row, tags("set"), new Set(["beta"]), locale)).to.equal(
      true
    );
    expect(
      matchesFilter(row, tags("includes-any"), ["gamma", "beta"], locale)
    ).to.equal(true);
    expect(
      matchesFilter(row, tags("includes-all"), ["alpha", "beta"], locale)
    ).to.equal(true);
    expect(
      matchesFilter(row, tags("includes-all"), ["alpha", "gamma"], locale)
    ).to.equal(false);

    expect(matchesFilter(row, { field: "name" }, "AD", locale)).to.equal(true);
    expect(matchesFilter(row, { field: "name" }, "zz", locale)).to.equal(false);
    expect(
      matchesFilter(
        row,
        { field: "name", filterFn: () => true },
        "ignored",
        locale
      )
    ).to.equal(true);

    const scalar = { value: new Set(["x"]) };
    expect(
      matchesFilter(scalar, { field: "value", filterType: "set" }, "x", locale)
    ).to.equal(true);
  });

  it("stringifies exotic values consistently for text comparison and CSV", () => {
    const circular: Record<string, unknown> = {};
    circular["self"] = circular;
    const exotic = [
      { v: new Date(Date.UTC(2024, 0, 2)) },
      { v: new Date(Number.NaN) },
      { v: ["a", "b"] },
      { v: { big: 7n } },
      { v: circular },
      { v: null },
    ];
    const csv = rowsAsDelimited(exotic, [{ field: "v", label: "V" }], {
      includeHeaders: false,
    });
    expect(csv.split("\r\n")).to.deep.equal([
      "2024-01-02T00:00:00.000Z",
      "",
      "a b",
      '"{""big"":""7""}"',
      "",
      "",
    ]);

    const undefinedJson = {
      toJSON(): undefined {
        return undefined;
      },
    };
    expect(
      rowsAsDelimited([{ v: undefinedJson }], [{ field: "v" }], {
        includeHeaders: false,
      })
    ).to.equal("");
  });

  it("treats nullish filters and non-finite numeric dates as empty or unmatched", () => {
    const setColumn: DataGridColumn<{ v: unknown }> = {
      field: "v",
      filterType: "set",
    };
    for (const filter of [null, undefined, ""]) {
      expect(matchesFilter({ v: "kept" }, setColumn, filter, locale)).to.equal(
        true
      );
    }

    const dateColumn: DataGridColumn<{ v: unknown }> = {
      field: "v",
      filterType: "date-range",
    };
    expect(matchesFilter({ v: Infinity }, dateColumn, [0, 1], locale)).to.equal(
      false
    );
  });

  it("ranks missing values by the sortUndefined policy", () => {
    const withHoles = [{ v: 2 }, { v: null }, { v: 1 }];
    const ids = (
      policy: DataGridColumn<{ v: unknown }>["sortUndefined"],
      desc: boolean
    ): unknown[] =>
      sortRows(
        withHoles,
        [{ id: "v", field: "v", sortUndefined: policy }],
        [{ id: "v", desc }],
        locale
      ).map((row) => row.v);

    expect(ids("last", false)).to.deep.equal([1, 2, null]);
    expect(ids("first", false)).to.deep.equal([null, 1, 2]);
    expect(ids(-1, false)).to.deep.equal([null, 1, 2]);
    expect(ids(1, false)).to.deep.equal([1, 2, null]);
    // A numeric policy is direction-aware; the string spellings pin the hole to one end.
    expect(ids(1, true)).to.deep.equal([null, 2, 1]);
    expect(ids("last", true)).to.deep.equal([2, 1, null]);
    expect(
      sortRows(
        withHoles,
        [{ field: "v" }],
        [{ id: "missing", desc: false }],
        locale
      )
    ).to.deep.equal(withHoles);

    expect(ids(undefined, false)).to.deep.equal([1, 2, null]);
  });

  it("honors every sort algorithm and a custom comparator", () => {
    const dated = [{ v: "2024-03-01" }, { v: "2024-01-01" }];
    expect(
      sortRows(
        dated,
        [{ id: "v", field: "v", sortFn: "datetime" }],
        [{ id: "v", desc: false }],
        locale
      )
    ).to.deep.equal([{ v: "2024-01-01" }, { v: "2024-03-01" }]);

    const basic = [{ v: 10 }, { v: 2 }];
    expect(
      sortRows(
        basic,
        [{ id: "v", field: "v", sortFn: "basic" }],
        [{ id: "v", desc: false }],
        locale
      )
    ).to.deep.equal([{ v: 2 }, { v: 10 }]);

    const mixedCase = [{ v: "b" }, { v: "A" }];
    expect(
      sortRows(
        mixedCase,
        [{ id: "v", field: "v", sortFn: "textCaseSensitive" }],
        [{ id: "v", desc: false }],
        locale
      ).map((row) => row.v)
    ).to.deep.equal(["A", "b"]);
    expect(
      sortRows(
        [{ v: "item10" }, { v: "item2" }],
        [{ id: "v", field: "v", sortFn: "alphanumericCaseSensitive" }],
        [{ id: "v", desc: false }],
        locale
      ).map((row) => row.v)
    ).to.deep.equal(["item2", "item10"]);

    expect(
      sortRows(
        [{ v: 1 }, { v: 3 }],
        [
          {
            id: "v",
            field: "v",
            comparator: (left, right) => Number(right) - Number(left),
          },
        ],
        [{ id: "v", desc: false }],
        locale
      ).map((row) => row.v)
    ).to.deep.equal([3, 1]);

    // Non-parsable datetimes fall through to the collator rather than producing NaN ordering.
    expect(
      sortRows(
        [{ v: "zeta" }, { v: "alpha" }],
        [{ id: "v", field: "v", sortFn: "datetime" }],
        [{ id: "v", desc: false }],
        locale
      ).map((row) => row.v)
    ).to.deep.equal(["alpha", "zeta"]);
  });

  it("computes every named aggregation and its empty-input fallbacks", () => {
    const numbers = [1, 2, 3, 4];
    const asRows = numbers.map((value) => ({ value }));
    expect(aggregateValues("count", asRows, numbers)).to.equal(4);
    expect(aggregateValues("sum", asRows, numbers)).to.equal(10);
    expect(aggregateValues("min", asRows, numbers)).to.equal(1);
    expect(aggregateValues("max", asRows, numbers)).to.equal(4);
    expect(aggregateValues("mean", asRows, numbers)).to.equal(2.5);
    expect(aggregateValues("median", asRows, numbers)).to.equal(2.5);
    expect(aggregateValues("median", asRows.slice(0, 3), [1, 2, 3])).to.equal(
      2
    );
    expect(aggregateValues("extent", asRows, numbers)).to.deep.equal([1, 4]);
    expect(aggregateValues("unique", asRows, [1, 1, 2])).to.deep.equal([1, 2]);
    expect(aggregateValues("uniqueCount", asRows, [1, 1, 2])).to.equal(2);
    expect(
      aggregateValues((rows) => rows.length * 2, asRows, numbers)
    ).to.equal(8);

    expect(aggregateValues("sum", [], [])).to.equal(undefined);
    expect(aggregateValues("extent", [], [])).to.deep.equal([]);
    expect(aggregateValues("unique", [], [null, undefined])).to.deep.equal([]);
  });

  it("keeps built-in aggregate results finite for extreme finite inputs", () => {
    const values = [Number.MAX_VALUE, Number.MAX_VALUE];
    const aggregateRows = values.map((value) => ({ value }));

    expect(aggregateValues("sum", aggregateRows, values)).to.equal(undefined);
    expect(aggregateValues("mean", aggregateRows, values)).to.equal(
      Number.MAX_VALUE
    );
    expect(aggregateValues("median", aggregateRows, values)).to.equal(
      Number.MAX_VALUE
    );
    expect(
      aggregateValues("mean", aggregateRows, [
        -Number.MAX_VALUE,
        Number.MAX_VALUE,
      ])
    ).to.equal(0);
    expect(
      aggregateValues("median", aggregateRows, [
        -Number.MAX_VALUE,
        Number.MAX_VALUE,
      ])
    ).to.equal(0);
  });

  it("escapes formulas, delimiters, and quotes when serializing rows", () => {
    const tricky = [
      { text: "=cmd()", other: "a,b", quoted: 'say "hi"', amount: -5 },
    ];
    const cols: DataGridColumn<(typeof tricky)[number]>[] = [
      { field: "text", label: "Text" },
      { field: "other", label: "Other" },
      { field: "quoted", label: "Quoted" },
      { field: "amount", label: "Amount" },
    ];
    expect(rowsAsDelimited(tricky, cols, { includeHeaders: false })).to.equal(
      `'=cmd(),"a,b","say ""hi""",-5`
    );
    expect(
      rowsAsDelimited(tricky, cols, {
        includeHeaders: false,
        escapeFormulas: false,
      })
    ).to.equal(`=cmd(),"a,b","say ""hi""",-5`);
    expect(rowsAsDelimited(tricky, cols, { columnIds: ["other"] })).to.equal(
      'Other\r\n"a,b"'
    );
    expect(
      rowsAsDelimited(tricky, cols, { columnIds: ["amount"], delimiter: "\t" })
    ).to.equal("Amount\r\n-5");
    expect(
      rowsAsDelimited(
        tricky,
        [...cols.slice(0, 1), { field: "other", label: "Other", hidden: true }],
        {}
      )
    ).to.equal(`Text\r\n'=cmd()`);
  });

  it("escapes every unsafe leading character, including whitespace and fullwidth formula sigils", () => {
    // The bare ASCII sigils are only half the attack surface: a spreadsheet strips leading
    // whitespace before parsing, and fullwidth sigils are normalized to their ASCII twins during
    // import -- so both reach the formula parser exactly as `=`/`+`/`-`/`@` would.
    const cols: DataGridColumn<{ v: unknown }>[] = [{ field: "v", label: "V" }];
    const serialize = (v: unknown) =>
      rowsAsDelimited([{ v }], cols, { includeHeaders: false });

    // Prefix-only: none of these contain the delimiter, a quote, CR or LF, so no quoting follows.
    for (const value of ["\tcmd", "＝SUM(A1:A2)", "＋1", "－1+2", "＠cmd"]) {
      expect(serialize(value), `leading ${JSON.stringify(value)}`).to.equal(
        `'${value}`
      );
    }
    // A leading CR/LF is guarded first, then the field still needs quoting because it now
    // contains a bare CR/LF.
    expect(serialize("\rcmd")).to.equal('"\'\rcmd"');
    expect(serialize("\ncmd")).to.equal('"\'\ncmd"');

    // Opting out still opts out, and a real number column is still never text-prefixed.
    expect(
      rowsAsDelimited([{ v: "＝SUM(A1:A2)" }], cols, {
        includeHeaders: false,
        escapeFormulas: false,
      })
    ).to.equal("＝SUM(A1:A2)");
    expect(serialize(-5)).to.equal("-5");
  });
});
