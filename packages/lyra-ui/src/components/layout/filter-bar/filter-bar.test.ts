import { fixture, expect, html, oneEvent, aTimeout } from "@open-wc/testing";
import "./filter-bar.js";
import "../../forms/checkbox/checkbox.js";
import "../../forms/time-range/time-range.js";
import type {
  LyraFilterBar,
  LyraFilterBarFilterDefinition,
  LyraFilterBarInputDetail,
} from "./filter-bar.js";

const basicFilters: LyraFilterBarFilterDefinition[] = [
  {
    filterId: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "open", label: "Open" },
      { value: "closed", label: "Closed" },
    ],
    required: true,
  },
  {
    filterId: "tags",
    label: "Tags",
    type: "combobox",
    multiple: true,
    options: [
      { value: "urgent", label: "Urgent" },
      { value: "billing", label: "Billing" },
    ],
  },
  { filterId: "created", label: "Created", type: "date" },
  { filterId: "range", label: "Active period", type: "date-range" },
];

it("uses filterId as the public filter-definition identity", async () => {
  const filters = [
    {
      filterId: "status",
      label: "Status",
      type: "select",
      options: [{ value: "open", label: "Open" }],
    },
  ] as unknown as LyraFilterBarFilterDefinition[];
  const el = await fixture<LyraFilterBar>(html`
    <lr-filter-bar .filters=${filters}></lr-filter-bar>
  `);

  expect(control(el, "status").localName).to.equal("lr-select");
});

function control(el: LyraFilterBar, filterId: string): HTMLElement {
  return el.shadowRoot!.querySelector(
    `[data-filter-id="${filterId}"]`
  ) as HTMLElement;
}

/** The native `<input>` inside a `'text'` filter's composed `<lr-input>`. */
async function nativeInput(
  el: LyraFilterBar,
  filterId: string
): Promise<HTMLInputElement> {
  const composed = control(el, filterId) as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  await composed.updateComplete;
  return composed.shadowRoot!.querySelector("input") as HTMLInputElement;
}

/** Simulates a user keystroke in a `'text'` filter, driving the real `<lr-input>` input path. */
async function typeInto(
  el: LyraFilterBar,
  filterId: string,
  text: string
): Promise<HTMLInputElement> {
  const native = await nativeInput(el, filterId);
  native.value = text;
  native.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
  return native;
}

it("renders one composed control per filter, matched to its declared type", async () => {
  const el = (await fixture(
    html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
  )) as LyraFilterBar;
  expect(control(el, "status").localName).to.equal("lr-select");
  expect(control(el, "status").querySelectorAll("lr-option").length).to.equal(
    2
  );
  expect(control(el, "tags").localName).to.equal("lr-combobox");
  expect((control(el, "tags") as HTMLElement & { multiple: boolean }).multiple)
    .to.be.true;
  expect(control(el, "created").localName).to.equal("lr-date-input");
  expect(
    (control(el, "created") as HTMLElement & { mode: string }).mode
  ).to.equal("single");
  expect(control(el, "range").localName).to.equal("lr-date-input");
  expect(
    (control(el, "range") as HTMLElement & { mode: string }).mode
  ).to.equal("range");
});

it('treats a foreign boolean false as empty for every built-in filter path', async () => {
  const el = (await fixture(
    html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
  )) as LyraFilterBar;

  el.value = { status: false };
  await el.updateComplete;

  expect(Object.hasOwn(el.value, 'status')).to.be.false;
  expect(el.hasActiveFilters).to.be.false;
  expect(el.invalidFilterIds).to.deep.equal(['status']);
  expect(el.checkValidity()).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="active-filters"]') === null).to.be.true;
});

it("forwards common field and input parts from every built-in composed control", async () => {
  const filters: LyraFilterBarFilterDefinition[] = [
    ...basicFilters.slice(0, 3),
    { filterId: "query", label: "Query", type: "text" },
  ];
  const wrapper = (await fixture(html`
    <div>
      <style>
        lr-filter-bar::part(filter-control-field) {
          outline: 7px solid rgb(1, 2, 3);
        }
        lr-filter-bar::part(filter-control-input) {
          caret-color: rgb(4, 5, 6);
        }
      </style>
      <lr-filter-bar .filters=${filters}></lr-filter-bar>
    </div>
  `)) as HTMLElement;
  const el = wrapper.querySelector("lr-filter-bar") as LyraFilterBar;
  await el.updateComplete;

  const probes = [
    ["status", '[part~="trigger"]'],
    ["tags", '[part~="combobox"]'],
    ["created", '[part~="input-wrapper"]'],
    ["query", '[part~="input-wrapper"]'],
  ] as const;
  for (const [id, selector] of probes) {
    const composed = control(el, id) as HTMLElement & { updateComplete: Promise<unknown> };
    await composed.updateComplete;
    const field = composed.shadowRoot!.querySelector<HTMLElement>(selector);
    expect(field !== null, `${id} field probe`).to.be.true;
    expect(getComputedStyle(field!).outlineWidth, `${id} field alias`).to.equal("7px");
  }

  const inputs = [
    ["status", '[part~="display-input"]'],
    ["tags", '[part~="combobox-input"]'],
    ["created", '[part~="input"]'],
    ["query", '[part~="input"]'],
  ] as const;
  for (const [id, selector] of inputs) {
    const composed = control(el, id);
    const input = composed.shadowRoot!.querySelector<HTMLElement>(selector);
    expect(input !== null, `${id} input probe`).to.be.true;
    expect(getComputedStyle(input!).caretColor, `${id} input alias`).to.equal("rgb(4, 5, 6)");
  }
});

describe("custom filters", () => {
  it("renders an existing control with controlled value, disabled, required, and error state", async () => {
    let renderedFilterId = "";
    const filters: LyraFilterBarFilterDefinition[] = [
      {
        filterId: "archived",
        label: "Include archived",
        type: "custom",
        required: true,
        custom: {
          adapter: {
            valueFromEvent: (event) =>
              (event as CustomEvent<{ checked: boolean }>).detail.checked,
            clearValue: false,
            formatValue: (value) => (value === true ? "Enabled" : "Disabled"),
          },
          render: (context) => {
            renderedFilterId = context.filterId;
            return html`
              <lr-checkbox
                aria-label=${context.label}
                .checked=${context.value === true}
                ?disabled=${context.disabled}
                ?required=${context.required}
                .errorText=${context.errorText}
                @lr-change=${context.onValueChange}
                @focusout=${context.onFocusout}
              ></lr-checkbox>
            `;
          },
        },
      },
    ];
    const el = (await fixture(
      html`<lr-filter-bar .filters=${filters}></lr-filter-bar>`
    )) as LyraFilterBar;
    const wrapper = control(el, "archived");
    const checkbox = wrapper.querySelector("lr-checkbox") as HTMLElement & {
      checked: boolean;
      errorText: string;
    };

    expect(renderedFilterId).to.equal("archived");
    expect(checkbox.checked).to.be.false;
    expect(checkbox.errorText).to.equal("");
    expect(el.invalidFilterIds).to.deep.equal(["archived"]);

    const inputPromise = oneEvent(el, "lr-input");
    checkbox.click();
    const input = (await inputPromise) as CustomEvent<LyraFilterBarInputDetail>;
    expect(input.detail.value).to.deep.equal({ archived: true });
    expect(el.value).to.deep.equal({ archived: true });
    expect(el.shadowRoot!.querySelector('[part="chip"]')!.textContent!.trim()).to.equal(
      "Include archived: Enabled"
    );

    el.value = { archived: false };
    await el.updateComplete;
    expect(checkbox.checked).to.be.false;
    expect(el.hasActiveFilters).to.be.false;

    el.reportValidity();
    await el.updateComplete;
    expect(checkbox.errorText).to.equal("This field is required.");
    expect(el.checkValidity()).to.be.false;

    el.disabled = true;
    await el.updateComplete;
    expect(checkbox.hasAttribute("disabled")).to.be.true;
    el.disabled = false;
    el.value = { archived: true };
    await el.updateComplete;
    el.reset();
    expect(el.value).to.deep.equal({});
  });

  it("adapts a two-handle lr-time-range and clears it through its active chip", async () => {
    const filters: LyraFilterBarFilterDefinition[] = [
      {
        filterId: "window",
        label: "Time window",
        type: "custom",
        custom: {
          adapter: {
            valueFromEvent: (event) => {
              const { start, end } = (
                event as CustomEvent<{ start: number; end: number }>
              ).detail;
              return `${start}/${end}`;
            },
            clearValue: "",
          },
          render: (context) => {
            const [start, end] =
              typeof context.value === "string" && context.value.includes("/")
                ? context.value.split("/").map(Number)
                : [20, 80];
            return html`
              <lr-time-range
                aria-label=${context.label}
                min="0"
                max="100"
                .start=${Number.isFinite(start) ? start : 20}
                .end=${Number.isFinite(end) ? end : 80}
                ?disabled=${context.disabled}
                @lr-change=${context.onChange}
                @focusout=${context.onFocusout}
              ></lr-time-range>
            `;
          },
        },
      },
    ];
    const el = (await fixture(
      html`<lr-filter-bar .filters=${filters}></lr-filter-bar>`
    )) as LyraFilterBar;
    const range = control(el, "window").querySelector("lr-time-range") as HTMLElement & {
      start: number;
      end: number;
    };
    await (range as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete;

    const handle = range.shadowRoot!.querySelector(
      '[part="handle-start"]'
    ) as HTMLElement;
    const inputPromise = oneEvent(el, "lr-input");
    handle.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    handle.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true }));
    const input = (await inputPromise) as CustomEvent<LyraFilterBarInputDetail>;
    expect(input.detail.value.window).to.equal("21/80");
    expect(el.value.window).to.equal("21/80");

    const chip = el.shadowRoot!.querySelector('[part="chip"]') as HTMLElement;
    chip.dispatchEvent(
      new CustomEvent("lr-remove", { bubbles: true, composed: true, detail: {} })
    );
    await el.updateComplete;
    expect(Object.hasOwn(el.value, 'window')).to.equal(false);
    expect(el.hasActiveFilters).to.be.false;
  });

  it("lets an eventless custom control set a string array and uses the default list chip label", async () => {
    const filters: LyraFilterBarFilterDefinition[] = [
      {
        filterId: "reviewers",
        label: "Reviewers",
        type: "custom",
        custom: {
          adapter: { valueFromEvent: () => undefined, clearValue: undefined },
          render: (context) => html`
            <button type="button" @click=${() => context.setValue(["Ada", "Lin"])}>Assign reviewers</button>
          `,
        },
      },
    ];
    const el = (await fixture(
      html`<lr-filter-bar .filters=${filters}></lr-filter-bar>`
    )) as LyraFilterBar;
    const button = control(el, "reviewers").querySelector("button") as HTMLButtonElement;

    const inputPromise = oneEvent(el, "lr-input");
    button.click();
    const input = (await inputPromise) as CustomEvent<LyraFilterBarInputDetail>;
    await el.updateComplete;

    expect(input.detail.filterId).to.equal("reviewers");
    expect(input.detail.value).to.deep.equal({ reviewers: ["Ada", "Lin"] });
    expect(el.value).to.deep.equal({ reviewers: ["Ada", "Lin"] });
    const chip = el.shadowRoot!.querySelector('[part="chip"]') as HTMLElement;
    const display = new Intl.ListFormat(el.effectiveLocale, {
      style: "long",
      type: "conjunction",
    }).format(["Ada", "Lin"]);
    expect(chip.textContent!.trim()).to.equal(`Reviewers: ${display}`);
  });
});

it("forwards each filter definition's label to its composed control's own label prop", async () => {
  const el = (await fixture(
    html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
  )) as LyraFilterBar;
  expect(
    (control(el, "status") as HTMLElement & { label: string }).label
  ).to.equal("Status");
  expect(
    (control(el, "tags") as HTMLElement & { label: string }).label
  ).to.equal("Tags");
});

it("treats a null/undefined filters or value as empty rather than throwing", async () => {
  const el = (await fixture(
    html`<lr-filter-bar></lr-filter-bar>`
  )) as LyraFilterBar;
  expect(el.filters).to.deep.equal([]);
  expect(el.value).to.deep.equal({});
  el.filters = null;
  el.value = null;
  await el.updateComplete;
  expect(el.filters).to.deep.equal([]);
  expect(el.value).to.deep.equal({});
  el.filters = undefined;
  el.value = undefined;
  await el.updateComplete;
  expect(el.filters).to.deep.equal([]);
  expect(el.value).to.deep.equal({});
});

it("keeps the first unique, nonempty, whitespace-stable filterId", async () => {
  const el = await fixture<LyraFilterBar>(html`
    <lr-filter-bar
      .filters=${[
        { filterId: "", label: "Empty", type: "select", options: [] },
        { filterId: " spaced ", label: "Spaced", type: "select", options: [] },
        { filterId: "status", label: "First", type: "select", options: [] },
        { filterId: "status", label: "Duplicate", type: "select", options: [] },
      ] as LyraFilterBarFilterDefinition[]}
    ></lr-filter-bar>
  `);

  expect(el.filters.map((definition) => definition.filterId)).to.deep.equal([
    "status",
  ]);
  expect(
    Array.from(el.shadowRoot!.querySelectorAll("[data-filter-id]"), (field) =>
      field.getAttribute("data-filter-id")
    )
  ).to.deep.equal(["status"]);
});

describe("value getter/setter (URL/state serialization contract)", () => {
  it("round-trips a plain object through value, independent of any prior state", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = { status: "open", tags: ["urgent", "billing"] };
    await el.updateComplete;
    expect(el.value).to.deep.equal({
      status: "open",
      tags: ["urgent", "billing"],
    });
    expect(
      (control(el, "status") as HTMLElement & { value: string }).value
    ).to.equal("open");
    expect(
      (control(el, "tags") as HTMLElement & { value: string[] }).value
    ).to.deep.equal(["urgent", "billing"]);
  });

  it("passes a scalar controlled value through a single-value combobox with an explicit empty catalog", async () => {
    const filters: LyraFilterBarFilterDefinition[] = [
      { filterId: "assignee", label: "Assignee", type: "combobox", options: [] },
    ];
    const el = (await fixture(
      html`<lr-filter-bar .filters=${filters}></lr-filter-bar>`
    )) as LyraFilterBar;

    el.value = { assignee: "unlisted" };
    await el.updateComplete;
    const combo = control(el, "assignee") as HTMLElement & {
      multiple: boolean;
      value: string;
    };

    expect(combo.multiple).to.be.false;
    expect(combo.value).to.equal("unlisted");
    expect(combo.querySelectorAll("lr-option").length).to.equal(0);
    const chip = el.shadowRoot!.querySelector('[part="chip"]') as HTMLElement;
    expect(chip.textContent!.trim()).to.equal("Assignee: unlisted");
  });

  it("returns an immutable value snapshot so external mutation cannot corrupt internal state", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = { status: "open" };
    const snapshot = el.value;
    expect(Object.isFrozen(snapshot)).to.equal(true);
    expect(el.value.status).to.equal("open");
  });

  it("clones string-array fields at setter, getter, and lr-input boundaries", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    const assigned = ["urgent"];

    el.value = { tags: assigned };
    assigned.push("billing");
    expect(el.value.tags).to.deep.equal(["urgent"]);

    const snapshot = el.value;
    expect(Object.isFrozen(snapshot.tags)).to.equal(true);
    expect(el.value.tags).to.deep.equal(["urgent"]);

    const combo = control(el, "tags") as HTMLElement & { value: string[] };
    const inputPromise = oneEvent(el, "lr-input");
    combo.value = ["billing"];
    combo.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    const input = (await inputPromise) as CustomEvent<LyraFilterBarInputDetail>;

    expect(Object.isFrozen(input.detail.value)).to.equal(true);
    expect(Object.isFrozen(input.detail.value.tags)).to.equal(true);
    expect(el.value.tags).to.deep.equal(["billing"]);
  });
});

describe("lr-input (filter edits)", () => {
  it("emits lr-input with the full value object and the changed filterId on a select commit", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    const select = control(el, "status") as HTMLElement & { value: string };

    const promise = oneEvent(el, "lr-input");
    select.value = "open";
    select.dispatchEvent(
      new Event("change", { bubbles: true, composed: true })
    );
    const ev = (await promise) as CustomEvent<LyraFilterBarInputDetail>;
    expect(ev.detail.filterId).to.equal("status");
    expect(ev.detail.value).to.deep.equal({ status: "open" });
    expect(el.value).to.deep.equal({ status: "open" });
  });

  it("emits lr-input with a string array for a multiple combobox commit", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    const combo = control(el, "tags") as HTMLElement & { value: string[] };

    const promise = oneEvent(el, "lr-input");
    combo.value = ["urgent"];
    combo.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    const ev = (await promise) as CustomEvent<LyraFilterBarInputDetail>;
    expect(ev.detail.filterId).to.equal("tags");
    expect(ev.detail.value.tags).to.deep.equal(["urgent"]);
  });

  it("emits lr-input on a committed date-range change, carrying the ISO range string", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    const dateRange = control(el, "range") as HTMLElement & { value: string };

    const promise = oneEvent(el, "lr-input");
    dateRange.value = "2026-01-01/2026-01-31";
    dateRange.dispatchEvent(
      new Event("change", { bubbles: true, composed: true })
    );
    const ev = (await promise) as CustomEvent<LyraFilterBarInputDetail>;
    expect(ev.detail.value.range).to.equal("2026-01-01/2026-01-31");
  });

  for (const [filterId, expectedValue] of [
    ["status", "open"],
    ["tags", ["urgent"]],
  ] as const) {
    it(`keeps ${filterId}'s child aliases inside while retaining native input/change`, async () => {
      const el = (await fixture(
        html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
      )) as LyraFilterBar;
      const composed = control(el, filterId) as HTMLElement & {
        open: boolean;
        updateComplete: Promise<unknown>;
      };
      composed.open = true;
      await composed.updateComplete;

      const filterInputs: LyraFilterBarInputDetail[] = [];
      let childChanges = 0;
      let nativeInputs = 0;
      let nativeChanges = 0;
      el.addEventListener("lr-input", (event) => {
        filterInputs.push((event as CustomEvent<LyraFilterBarInputDetail>).detail);
      });
      el.addEventListener("lr-change", () => {
        childChanges += 1;
      });
      el.addEventListener("input", () => {
        nativeInputs += 1;
      });
      el.addEventListener("change", () => {
        nativeChanges += 1;
      });

      (composed.shadowRoot!.querySelector('[part="option"]') as HTMLElement).click();
      await el.updateComplete;

      expect(filterInputs.length).to.equal(1);
      expect(filterInputs[0].filterId).to.equal(filterId);
      expect(filterInputs[0].value[filterId]).to.deep.equal(expectedValue);
      expect(childChanges).to.equal(0);
      expect(nativeInputs).to.equal(1);
      expect(nativeChanges).to.equal(1);
    });
  }

  it("never mutates value or emits while disabled, even from a directly-dispatched control change", async () => {
    const el = (await fixture(
      html`<lr-filter-bar disabled .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    const select = control(el, "status") as HTMLElement & { value: string };
    let fired = false;
    el.addEventListener("lr-input", () => (fired = true));

    select.value = "open";
    select.dispatchEvent(
      new Event("change", { bubbles: true, composed: true })
    );
    await el.updateComplete;

    expect(fired).to.be.false;
    expect(el.value).to.deep.equal({});
  });
});

describe("active-filter chips", () => {
  it("renders no chip row and no active-filters group while nothing is set", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    expect(el.shadowRoot!.querySelector('[part="active-filters"]') === null).to.be.true;
    expect(el.hasActiveFilters).to.be.false;
  });

  it('renders one removable chip per active filter, labeled "<label>: <display>"', async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = { status: "open", tags: ["urgent", "billing"] };
    await el.updateComplete;

    const chips = Array.from(
      el.shadowRoot!.querySelectorAll('[part="chip"]')
    ) as HTMLElement[];
    expect(chips.length).to.equal(2);
    expect(chips[0].textContent!.trim()).to.equal("Status: Open");
    expect(chips[1].textContent!.trim()).to.equal(
      `Tags: ${new Intl.ListFormat(el.effectiveLocale, {
        style: "long",
        type: "conjunction",
      }).format(["Urgent", "Billing"])}`
    );
    expect(chips.every((c) => c.hasAttribute("removable"))).to.be.true;
    expect(el.hasActiveFilters).to.be.true;
  });

  it("falls back to the raw value for a chip whose value no longer matches a known option", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = { status: "archived" };
    await el.updateComplete;
    const chip = el.shadowRoot!.querySelector('[part="chip"]') as HTMLElement;
    expect(chip.textContent!.trim()).to.equal("Status: archived");
  });

  it("locale-formats date and date-range chip values", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = { created: "2026-02-01", range: "2026-01-01/2026-01-31" };
    await el.updateComplete;
    const chips = Array.from(
      el.shadowRoot!.querySelectorAll('[part="chip"]')
    ) as HTMLElement[];
    const formatter = new Intl.DateTimeFormat(el.effectiveLocale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    expect(chips.map((c) => c.textContent!.trim())).to.deep.equal([
      `Created: ${formatter.format(new Date(Date.UTC(2026, 1, 1)))}`,
      `Active period: ${formatter.formatRange(
        new Date(Date.UTC(2026, 0, 1)),
        new Date(Date.UTC(2026, 0, 31))
      )}`,
    ]);
  });

  it("preserves impossible ISO dates and ranges verbatim instead of normalizing them", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = {
      created: "2026-02-31",
      range: "2026-01-01/2026-13-01",
    };
    await el.updateComplete;
    const labels = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="chip"]')].map(
      (chip) => chip.textContent!.trim()
    );
    expect(labels).to.deep.equal([
      "Created: 2026-02-31",
      "Active period: 2026-01-01/2026-13-01",
    ]);
  });

  it("locale-formats valid four-digit years below 0100 without remapping them to the 1900s", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = { created: "0001-02-03", range: "0099-01-01/0099-01-31" };
    await el.updateComplete;
    const date = (year: number, month: number, day: number): Date => {
      const result = new Date(0);
      result.setUTCHours(0, 0, 0, 0);
      result.setUTCFullYear(year, month - 1, day);
      return result;
    };
    const formatter = new Intl.DateTimeFormat(el.effectiveLocale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
    const labels = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="chip"]')].map(
      (chip) => chip.textContent!.trim()
    );
    expect(labels).to.deep.equal([
      `Created: ${formatter.format(date(1, 2, 3))}`,
      `Active period: ${formatter.formatRange(date(99, 1, 1), date(99, 1, 31))}`,
    ]);
  });

  it("uses the effective locale for list and date-range composition", async () => {
    const el = (await fixture(
      html`<lr-filter-bar lang="de" .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = { tags: ["urgent", "billing"], range: "2026-01-01/2026-01-31" };
    await el.updateComplete;
    const chips = [
      ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="chip"]'),
    ];
    expect(chips[0].textContent).to.contain(
      new Intl.ListFormat(el.effectiveLocale, {
        style: "long",
        type: "conjunction",
      }).format(["Urgent", "Billing"])
    );
    expect(chips[1].textContent).to.contain(
      new Intl.DateTimeFormat(el.effectiveLocale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).formatRange(
        new Date(Date.UTC(2026, 0, 1)),
        new Date(Date.UTC(2026, 0, 31))
      )
    );
  });

  it("clears just the removed filter on lr-remove, leaving the others untouched, and emits lr-input", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = { status: "open", created: "2026-02-01" };
    await el.updateComplete;

    const statusChip = el.shadowRoot!.querySelectorAll(
      '[part="chip"]'
    )[0] as HTMLElement;
    const promise = oneEvent(el, "lr-input");
    statusChip.dispatchEvent(
      new CustomEvent("lr-remove", {
        bubbles: true,
        composed: true,
        detail: { value: "status" },
      })
    );
    const ev = (await promise) as CustomEvent<LyraFilterBarInputDetail>;
    expect(ev.detail.filterId).to.equal("status");
    expect(el.value).to.deep.equal({ created: "2026-02-01" });
  });

  it("does not leak the composed chip's lr-remove event past the host under its own name", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = { status: "open" };
    await el.updateComplete;

    const chip = el.shadowRoot!.querySelector('[part="chip"]') as HTMLElement;
    let count = 0;
    el.addEventListener("lr-remove", () => count++);

    chip.dispatchEvent(
      new CustomEvent("lr-remove", {
        bubbles: true,
        composed: true,
        detail: {},
      })
    );
    await el.updateComplete;

    expect(count).to.equal(0);
  });

  it("omits a cleared multiple combobox filter from the sparse value", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = { tags: ["urgent"] };
    await el.updateComplete;

    const chip = el.shadowRoot!.querySelector('[part="chip"]') as HTMLElement;
    chip.dispatchEvent(
      new CustomEvent("lr-remove", {
        bubbles: true,
        composed: true,
        detail: {},
      })
    );
    await el.updateComplete;
    expect(Object.hasOwn(el.value, 'tags')).to.equal(false);
  });

  it("keeps focus on the nearest remaining chip, or its originating filter control, after focused removal", async () => {
    const filters: LyraFilterBarFilterDefinition[] = [
      {
        filterId: "first",
        label: "First",
        type: "select",
        options: [{ value: "yes", label: "Yes" }],
      },
      {
        filterId: "middle",
        label: "Middle",
        type: "select",
        options: [{ value: "yes", label: "Yes" }],
      },
      {
        filterId: "last",
        label: "Last",
        type: "select",
        options: [{ value: "yes", label: "Yes" }],
      },
    ];
    const el = (await fixture(
      html`<lr-filter-bar .filters=${filters}></lr-filter-bar>`
    )) as LyraFilterBar;

    const removeFocusedChip = async (filterId: string): Promise<void> => {
      const chip = el.shadowRoot!.querySelector(
        `[part="chip"][value="${filterId}"]`
      ) as HTMLElement & { updateComplete: Promise<unknown> };
      await chip.updateComplete;
      chip.focus();
      const remove = chip.shadowRoot!.querySelector(
        '[part="remove-button"]'
      ) as HTMLButtonElement;
      expect(chip.shadowRoot!.activeElement === remove).to.be.true;
      remove.click();
      await el.updateComplete;
    };

    el.value = { first: "yes", middle: "yes", last: "yes" };
    await el.updateComplete;

    await removeFocusedChip("first");
    expect(el.shadowRoot!.activeElement?.localName).to.equal("lr-chip");
    expect(el.shadowRoot!.activeElement?.getAttribute("value")).to.equal(
      "middle"
    );

    // Rebuild the original list so the middle/last cases independently exercise the focus repair.
    el.value = { first: "yes", middle: "yes", last: "yes" };
    await el.updateComplete;
    await removeFocusedChip("middle");
    expect(el.shadowRoot!.activeElement?.localName).to.equal("lr-chip");
    expect(el.shadowRoot!.activeElement?.getAttribute("value")).to.equal(
      "last"
    );

    el.value = { first: "yes", middle: "yes", last: "yes" };
    await el.updateComplete;
    await removeFocusedChip("last");
    expect(el.shadowRoot!.activeElement?.localName).to.equal("lr-chip");
    expect(el.shadowRoot!.activeElement?.getAttribute("value")).to.equal(
      "middle"
    );

    el.value = { first: "yes" };
    await el.updateComplete;
    await removeFocusedChip("first");
    const controlAfterSoleRemoval = control(el, "first") as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    await controlAfterSoleRemoval.updateComplete;
    expect(el.shadowRoot!.activeElement === controlAfterSoleRemoval).to.be.true;
    expect(
      controlAfterSoleRemoval.shadowRoot!.activeElement?.localName
    ).to.equal("button");
  });

  it("moves a sole custom-filter chip's focus to its rendered control after removal", async () => {
    const filters: LyraFilterBarFilterDefinition[] = [
      {
        filterId: "custom",
        label: "Custom",
        type: "custom",
        custom: {
          adapter: { valueFromEvent: () => "", clearValue: "" },
          render: (context) => html`
            <input
              data-custom-filter-input
              ?disabled=${context.disabled}
              @focusout=${context.onFocusout}
            >
          `,
        },
      },
    ];
    const el = (await fixture(
      html`<lr-filter-bar .filters=${filters}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = { custom: "selected" };
    await el.updateComplete;

    const chip = el.shadowRoot!.querySelector('[part="chip"]') as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    await chip.updateComplete;
    chip.focus();
    const remove = chip.shadowRoot!.querySelector(
      '[part="remove-button"]'
    ) as HTMLButtonElement;
    remove.click();
    await el.updateComplete;

    const customInput = control(el, "custom").querySelector(
      "[data-custom-filter-input]"
    ) as HTMLInputElement;
    expect(el.shadowRoot!.activeElement === customInput).to.be.true;
  });

  it("preserves a consumer focus move made by an lr-input listener after focused removal", async () => {
    const filters: LyraFilterBarFilterDefinition[] = [
      {
        filterId: "status",
        label: "Status",
        type: "select",
        options: [{ value: "open", label: "Open" }],
      },
    ];
    const wrapper = await fixture(html`
      <div>
        <input id="consumer-focus-target">
        <lr-filter-bar .filters=${filters}></lr-filter-bar>
      </div>
    `);
    const el = wrapper.querySelector("lr-filter-bar") as LyraFilterBar;
    const consumerTarget = wrapper.querySelector(
      "#consumer-focus-target"
    ) as HTMLInputElement;
    el.value = { status: "open" };
    await el.updateComplete;
    el.addEventListener("lr-input", (event) => {
      if (
        (event as CustomEvent<LyraFilterBarInputDetail>).detail.filterId ===
        "status"
      ) {
        consumerTarget.focus();
      }
    });

    const chip = el.shadowRoot!.querySelector('[part="chip"]') as HTMLElement & {
      updateComplete: Promise<unknown>;
    };
    await chip.updateComplete;
    chip.focus();
    const remove = chip.shadowRoot!.querySelector(
      '[part="remove-button"]'
    ) as HTMLButtonElement;
    remove.click();
    await el.updateComplete;

    expect(el.ownerDocument.activeElement?.id).to.equal(
      "consumer-focus-target"
    );
  });
});

describe("reset()", () => {
  it("keeps the reset action on the same default size tier and rendered height as adjacent fields", async () => {
    const el = (await fixture(html`
      <lr-filter-bar .filters=${basicFilters} .value=${{ status: "open" }}></lr-filter-bar>
    `)) as LyraFilterBar;
    const select = control(el, "status") as HTMLElement & { updateComplete: Promise<unknown> };
    const resetButton = el.shadowRoot!.querySelector('[part="reset-button"]') as HTMLElement & {
      size: string;
      updateComplete: Promise<unknown>;
    };
    await Promise.all([select.updateComplete, resetButton.updateComplete]);
    const selectTrigger = select.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!;
    const buttonBase = resetButton.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;

    expect(resetButton.size).to.equal("m");
    expect(buttonBase.getBoundingClientRect().height).to.be.closeTo(
      selectTrigger.getBoundingClientRect().height,
      1,
    );
  });

  it("disables the reset button until a filter becomes active, and while loading/disabled", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    const resetButton = el.shadowRoot!.querySelector(
      '[part="reset-button"]'
    ) as HTMLElement & { disabled: boolean };
    expect(resetButton.disabled).to.be.true;

    el.value = { status: "open" };
    await el.updateComplete;
    expect(resetButton.disabled).to.be.false;

    el.loading = true;
    await el.updateComplete;
    expect(resetButton.disabled).to.be.true;
    el.loading = false;

    el.disabled = true;
    await el.updateComplete;
    expect(resetButton.disabled).to.be.true;
  });

  it("restores every filter to its own defaultValue (or unset), clears touched state, and emits lr-input then lr-reset", async () => {
    const defaultTags = ["urgent"];
    const filtersWithDefault: LyraFilterBarFilterDefinition[] = [
      { ...basicFilters[0], defaultValue: "open" },
      { ...basicFilters[1], defaultValue: defaultTags },
    ];
    const el = (await fixture(
      html`<lr-filter-bar .filters=${filtersWithDefault}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = { status: "closed", tags: ["urgent"] };
    await el.updateComplete;

    const events: string[] = [];
    el.addEventListener("lr-input", () => events.push("lr-input"));
    el.addEventListener("lr-reset", () => events.push("lr-reset"));
    const resetPromise = oneEvent(el, "lr-reset");
    el.reset();
    const resetEvent = await resetPromise;
    expect(events).to.deep.equal(["lr-input", "lr-reset"]);
    expect(resetEvent.detail.value).to.deep.equal({ status: "open", tags: ["urgent"] });
    expect(el.value).to.deep.equal({ status: "open", tags: ["urgent"] });
    defaultTags.push("billing");
    expect(el.value.tags).to.deep.equal(["urgent"]);
  });

  it("is a no-op while disabled", async () => {
    const el = (await fixture(
      html`<lr-filter-bar disabled .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = { status: "open" };
    let fired = false;
    el.addEventListener("lr-reset", () => (fired = true));
    el.reset();
    expect(fired).to.be.false;
    expect(el.value).to.deep.equal({ status: "open" });
  });
});

describe("loading", () => {
  it("renders the status spinner only while loading", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    expect((el.shadowRoot!.querySelector('[part="status"]')) == null).to.be.true;
    el.loading = true;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="status"]')!.localName).to.equal(
      "lr-spinner"
    );
  });

  it("leaves filter controls interactive while loading", async () => {
    const el = (await fixture(
      html`<lr-filter-bar loading .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    expect(
      (control(el, "status") as HTMLElement & { disabled: boolean }).disabled
    ).to.be.false;
  });
});

describe("disabled", () => {
  it("disables every composed control and the reset button", async () => {
    const el = (await fixture(
      html`<lr-filter-bar disabled .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    expect(
      (control(el, "status") as HTMLElement & { disabled: boolean }).disabled
    ).to.be.true;
    expect(
      (control(el, "tags") as HTMLElement & { disabled: boolean }).disabled
    ).to.be.true;
    expect(
      (control(el, "created") as HTMLElement & { disabled: boolean }).disabled
    ).to.be.true;
    const resetButton = el.shadowRoot!.querySelector(
      '[part="reset-button"]'
    ) as HTMLElement & { disabled: boolean };
    expect(resetButton.disabled).to.be.true;
  });

  it("renders active-filter chips with no remove affordance, instead of a clickable-but-inert one", async () => {
    const el = (await fixture(
      html`<lr-filter-bar
        disabled
        .filters=${basicFilters}
        .value=${{ status: "open" }}
      ></lr-filter-bar>`
    )) as LyraFilterBar;
    const chip = el.shadowRoot!.querySelector(
      '[part="chip"]'
    ) as HTMLElement & {
      removable: boolean;
      updateComplete: Promise<unknown>;
    };
    expect((chip) !== (null)).to.equal(true);
    expect(chip.removable).to.be.false;
    expect(chip.hasAttribute("removable")).to.be.false;
    await chip.updateComplete;
    expect((chip.shadowRoot!.querySelector('[part="remove-button"]')) === (null)).to.equal(
      true
    );
  });

  it("does not treat a disabled focusout as a required filter interaction, but preserves enabled focusout", async () => {
    const builtInTypes: LyraFilterBarFilterDefinition["type"][] = [
      "select",
      "combobox",
      "date",
      "date-range",
      "text",
    ];

    for (const type of builtInTypes) {
      const filters: LyraFilterBarFilterDefinition[] = [
        {
          filterId: "required",
          label: "Required",
          type,
          required: true,
          options: [{ value: "yes", label: "Yes" }],
        },
      ];
      const el = (await fixture(
        html`<lr-filter-bar .filters=${filters}></lr-filter-bar>`
      )) as LyraFilterBar;
      const composed = control(el, "required") as HTMLElement & {
        errorText: string;
        updateComplete: Promise<unknown>;
      };
      await composed.updateComplete;
      const focusTarget = composed.shadowRoot!.querySelector(
        "input, button"
      ) as HTMLElement;
      focusTarget.focus();
      expect(composed.shadowRoot!.activeElement === focusTarget).to.be.true;

      el.disabled = true;
      await el.updateComplete;
      // WebKit does not force-blur every native control shape. Dispatching the same bubbling,
      // composed event makes the bar's disabled-state contract deterministic in all engines.
      composed.dispatchEvent(
        new FocusEvent("focusout", { bubbles: true, composed: true })
      );
      await el.updateComplete;
      expect(composed.errorText, `${type} disabled focusout`).to.equal("");

      el.disabled = false;
      await el.updateComplete;
      expect(composed.errorText, `${type} remains pristine after re-enable`).to.equal("");

      composed.dispatchEvent(
        new FocusEvent("focusout", { bubbles: true, composed: true })
      );
      await el.updateComplete;
      expect(composed.errorText, `${type} enabled focusout`).to.equal(
        "This field is required."
      );
    }
  });

  it("applies the disabled focusout guard to custom controls too", async () => {
    const filters: LyraFilterBarFilterDefinition[] = [
      {
        filterId: "required",
        label: "Required",
        type: "custom",
        required: true,
        custom: {
          adapter: { valueFromEvent: () => "", clearValue: "" },
          render: (context) => html`
            <input
              ?disabled=${context.disabled}
              data-error-text=${context.errorText}
              @focusout=${context.onFocusout}
            >
          `,
        },
      },
    ];
    const el = (await fixture(
      html`<lr-filter-bar .filters=${filters}></lr-filter-bar>`
    )) as LyraFilterBar;
    const input = control(el, "required").querySelector("input") as HTMLInputElement;
    input.focus();
    expect(el.shadowRoot!.activeElement === input).to.be.true;

    el.disabled = true;
    await el.updateComplete;
    input.dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, composed: true })
    );
    await el.updateComplete;
    expect(input.getAttribute("data-error-text")).to.equal("");

    el.disabled = false;
    await el.updateComplete;
    expect(input.getAttribute("data-error-text")).to.equal("");

    input.dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, composed: true })
    );
    await el.updateComplete;
    expect(input.getAttribute("data-error-text")).to.equal(
      "This field is required."
    );
  });
});

describe("validation contract", () => {
  it("reports invalidFilterIds/checkValidity from required-but-unset filters, live (not cached)", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    expect(el.invalidFilterIds).to.deep.equal(["status"]);
    expect(el.checkValidity()).to.be.false;

    el.value = { status: "open" };
    expect(el.invalidFilterIds).to.deep.equal([]);
    expect(el.checkValidity()).to.be.true;
  });

  it("does not reveal an inline error on the composed control until it is touched (focusout)", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    expect(
      (control(el, "status") as HTMLElement & { errorText: string }).errorText
    ).to.equal("");

    control(el, "status").dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, composed: true })
    );
    await el.updateComplete;
    expect(
      (control(el, "status") as HTMLElement & { errorText: string }).errorText
    ).to.equal("This field is required.");
  });

  it("reportValidity() reveals the inline error immediately and returns overall validity", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    expect(el.reportValidity()).to.be.false;
    await el.updateComplete;
    expect(
      (control(el, "status") as HTMLElement & { errorText: string }).errorText
    ).to.equal("This field is required.");

    el.value = { status: "open" };
    expect(el.reportValidity()).to.be.true;
  });

  it("emits lr-validity-change whenever the computed valid/invalidFilterIds actually changes, and not on a no-op edit", async () => {
    const el = document.createElement("lr-filter-bar") as LyraFilterBar;
    el.filters = basicFilters;
    const mountPromise = oneEvent(el, "lr-validity-change");
    document.body.appendChild(el);
    const mountEvent = await mountPromise;
    expect(mountEvent.detail.valid).to.be.false;
    expect(mountEvent.detail.invalidFilterIds).to.deep.equal(["status"]);

    const promise = oneEvent(el, "lr-validity-change");
    el.value = { status: "open" };
    const ev = await promise;
    expect(ev.detail.valid).to.be.true;
    expect(ev.detail.invalidFilterIds).to.deep.equal([]);

    let fired = false;
    el.addEventListener("lr-validity-change", () => (fired = true));
    el.value = { status: "open", created: "2026-01-01" };
    await el.updateComplete;
    expect(
      fired,
      "validity did not actually change, so the event must not re-fire"
    ).to.be.false;

    el.remove();
  });
});

describe("localization", () => {
  it("defaults the reset button and active-filters group label to English with no strings override", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    const resetButton = el.shadowRoot!.querySelector(
      '[part="reset-button"]'
    ) as HTMLElement;
    expect(resetButton.textContent!.trim()).to.equal("Reset filters");

    el.value = { status: "open" };
    await el.updateComplete;
    const group = el.shadowRoot!.querySelector(
      '[part="active-filters"]'
    ) as HTMLElement;
    expect(group.getAttribute("aria-label")).to.equal("Active filters");
  });

  it("honors .strings overrides for filterBarReset/filterBarActiveFilters", async () => {
    const el = (await fixture(
      html`<lr-filter-bar
        .filters=${basicFilters}
        .strings=${{
          filterBarReset: "Réinitialiser",
          filterBarActiveFilters: "Filtres actifs",
        }}
      ></lr-filter-bar>`
    )) as LyraFilterBar;
    const resetButton = el.shadowRoot!.querySelector(
      '[part="reset-button"]'
    ) as HTMLElement;
    expect(resetButton.textContent!.trim()).to.equal("Réinitialiser");

    el.value = { status: "open" };
    await el.updateComplete;
    const group = el.shadowRoot!.querySelector(
      '[part="active-filters"]'
    ) as HTMLElement;
    expect(group.getAttribute("aria-label")).to.equal("Filtres actifs");
  });

  it("reuses the shared fieldRequired key for its own required-error text, honoring its .strings override", async () => {
    const el = (await fixture(
      html`<lr-filter-bar
        .filters=${basicFilters}
        .strings=${{ fieldRequired: "Ce champ est requis." }}
      ></lr-filter-bar>`
    )) as LyraFilterBar;
    el.reportValidity();
    await el.updateComplete;
    expect(
      (control(el, "status") as HTMLElement & { errorText: string }).errorText
    ).to.equal("Ce champ est requis.");
  });
});

describe("label forwarding", () => {
  it("lets a forwarded host aria-label override the label prop on the internal group", async () => {
    const el = (await fixture(
      html`<lr-filter-bar
        label="Report filters"
        aria-label="Author filters"
        .filters=${basicFilters}
      ></lr-filter-bar>`
    )) as LyraFilterBar;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute("aria-label")).to.equal("Author filters");
  });

  it("preserves an explicitly empty host aria-label instead of replacing it with label", async () => {
    const el = (await fixture(
      html`<lr-filter-bar
        label="Report filters"
        aria-label=""
        .filters=${basicFilters}
      ></lr-filter-bar>`
    )) as LyraFilterBar;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.hasAttribute("aria-label")).to.be.true;
    expect(base.getAttribute("aria-label")).to.equal("");
  });

  it("falls back to a forwarded host aria-label when label is unset", async () => {
    const el = (await fixture(
      html`<lr-filter-bar
        aria-label="Dashboard filters"
        .filters=${basicFilters}
      ></lr-filter-bar>`
    )) as LyraFilterBar;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute("aria-label")).to.equal("Dashboard filters");
  });
});

describe("RTL and narrow-allocation layout", () => {
  it('renders correctly under dir="rtl" without throwing, and the controls row still reports :dir(rtl)', async () => {
    const el = (await fixture(
      html`<lr-filter-bar dir="rtl" .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    await el.updateComplete;
    const controlsRow = el.shadowRoot!.querySelector(
      '[part="controls"]'
    ) as HTMLElement;
    expect(controlsRow.matches(":dir(rtl)")).to.be.true;
    expect(
      el.shadowRoot!.querySelectorAll('[part="filter-control"]').length
    ).to.equal(basicFilters.length);
  });

  it("wraps onto multiple lines instead of overflowing a 320px allocation", async () => {
    const el = (await fixture(
      html`<lr-filter-bar
        style="inline-size: 320px"
        .filters=${basicFilters}
      ></lr-filter-bar>`
    )) as LyraFilterBar;
    const controlsRow = el.shadowRoot!.querySelector(
      '[part="controls"]'
    ) as HTMLElement;
    expect(getComputedStyle(controlsRow).flexWrap).to.equal("wrap");
  });

  for (const direction of ["ltr", "rtl"] as const) {
    it(`contains one unbroken active-filter chip inside a 320px ${direction.toUpperCase()} allocation`, async () => {
      const longLabel = "LocalizedFilterValueWithoutBreakOpportunity".repeat(100);
      const filters: LyraFilterBarFilterDefinition[] = [
        {
          filterId: "status",
          label: "Status",
          type: "select",
          options: [{ value: "active", label: longLabel }],
        },
      ];
      const wrapper = await fixture<HTMLElement>(html`
        <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%;">
          <lr-filter-bar
            style="inline-size: 100%;"
            .filters=${filters}
            .value=${{ status: "active" }}
          ></lr-filter-bar>
        </div>
      `);
      const el = wrapper.querySelector("lr-filter-bar") as LyraFilterBar;
      await el.updateComplete;
      const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      const activeFilters = el.shadowRoot!.querySelector<HTMLElement>('[part="active-filters"]')!;
      const chips = el.shadowRoot!.querySelector<HTMLElement>('[part="chips"]')!;
      const chip = el.shadowRoot!.querySelector<HTMLElement>('[part="chip"]')!;
      await Promise.all([
        (chips as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete,
        (chip as HTMLElement & { updateComplete: Promise<unknown> }).updateComplete,
      ]);

      expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
      expect(el.scrollWidth).to.be.at.most(el.clientWidth);
      expect(base.scrollWidth).to.be.at.most(base.clientWidth);
      expect(activeFilters.scrollWidth).to.be.at.most(activeFilters.clientWidth);
      expect(chips.scrollWidth).to.be.at.most(chips.clientWidth);
      expect(chip.getBoundingClientRect().width).to.be.at.most(320);
      expect(getComputedStyle(activeFilters).direction).to.equal(direction);
    });
  }
});

describe("'text' free-text filters", () => {
  const textFilters: LyraFilterBarFilterDefinition[] = [
    { filterId: "q", label: "Search", type: "text", placeholder: "Search logs" },
    {
      filterId: "severity",
      label: "Severity",
      type: "select",
      options: [
        { value: "error", label: "Error" },
        { value: "warn", label: "Warning" },
      ],
    },
  ];
  const debouncedFilters: LyraFilterBarFilterDefinition[] = [
    {
      filterId: "q",
      label: "Search",
      type: "text",
      placeholder: "Search logs",
      debounce: 60,
    },
    textFilters[1],
  ];

  it("composes an lr-input for a text filter, forwarding label/placeholder to its own chrome", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${textFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    const composed = control(el, "q") as HTMLElement & {
      label: string;
      placeholder: string;
    };
    expect(composed.localName).to.equal("lr-input");
    expect(composed.label).to.equal("Search");
    expect(composed.placeholder).to.equal("Search logs");
    // No duplicate chrome: the label/hint/error belong to <lr-input>, never re-rendered here.
    expect((el.shadowRoot!.querySelector("label")) == null).to.equal(true);
    const native = await nativeInput(el, "q");
    expect(native.type).to.equal("text");
  });

  it("emits lr-input with the typed value and the changed filterId, with no debounce declared", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${textFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    const promise = oneEvent(el, "lr-input");
    await typeInto(el, "q", "timeout");
    const ev = (await promise) as CustomEvent<LyraFilterBarInputDetail>;
    expect(ev.detail.filterId).to.equal("q");
    expect(ev.detail.value).to.deep.equal({ q: "timeout" });
    expect(el.value).to.deep.equal({ q: "timeout" });
  });

  it("never leaks the composed lr-input's own lr-input/lr-change events as this component's", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${textFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    const details: unknown[] = [];
    el.addEventListener("lr-input", (e) =>
      details.push((e as CustomEvent).detail)
    );
    let changes = 0;
    el.addEventListener("lr-change", () => (changes += 1));

    const native = await typeInto(el, "q", "abc");
    native.dispatchEvent(
      new Event("change", { bubbles: true, composed: true })
    );
    await el.updateComplete;

    expect(
      details.length,
      "exactly one lr-input, carrying this component's own detail shape"
    ).to.equal(1);
    expect((details[0] as LyraFilterBarInputDetail).value).to.deep.equal({
      q: "abc",
    });
    expect(
      changes,
      "the inner control's lr-change must not escape this shadow root"
    ).to.equal(0);
  });

  it("debounces rapid keystrokes into a single lr-input carrying the final value", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${debouncedFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    const values: string[] = [];
    el.addEventListener("lr-input", (e) =>
      values.push(
        String((e as CustomEvent<LyraFilterBarInputDetail>).detail.value.q)
      )
    );

    await typeInto(el, "q", "t");
    await typeInto(el, "q", "ti");
    await typeInto(el, "q", "tim");
    expect(
      values,
      "nothing is emitted while the debounce is still in flight"
    ).to.deep.equal([]);
    expect(el.value).to.deep.equal({});

    await aTimeout(300);
    expect(values).to.deep.equal(["tim"]);
    expect(el.value).to.deep.equal({ q: "tim" });
  });

  it("flushes a pending debounce on the control's own change (Enter/blur commit)", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${debouncedFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    const native = await typeInto(el, "q", "flush");
    const promise = oneEvent(el, "lr-input");
    native.dispatchEvent(
      new Event("change", { bubbles: true, composed: true })
    );
    const ev = (await promise) as CustomEvent<LyraFilterBarInputDetail>;
    expect(ev.detail.value).to.deep.equal({ q: "flush" });
  });

  it("shows the query verbatim in its chip, never mangling a slash into an en dash", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${textFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = { q: "GET /api/v1" };
    await el.updateComplete;
    const chip = el.shadowRoot!.querySelector('[part="chip"]') as HTMLElement;
    expect(chip.textContent!.trim()).to.equal("Search: GET /api/v1");
  });

  it("mirrors an external value write into the composed input", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${textFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = { q: "from-the-url" };
    await el.updateComplete;
    expect(
      (control(el, "q") as HTMLElement & { value: string }).value
    ).to.equal("from-the-url");
    const native = await nativeInput(el, "q");
    expect(native.value).to.equal("from-the-url");
  });

  it("cancels a pending debounce on reset(), so the stale keystroke never overwrites the reset", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${debouncedFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = { q: "seed" };
    await el.updateComplete;

    let inputs = 0;
    el.addEventListener("lr-input", () => (inputs += 1));
    await typeInto(el, "q", "draft");
    el.reset();
    await aTimeout(300);

    expect(el.value).to.deep.equal({});
    expect(inputs, "only the reset itself emitted").to.equal(1);
    const native = await nativeInput(el, "q");
    expect(
      native.value,
      "the cancelled draft is synced back out of the field"
    ).to.equal("");
  });

  it("cancels a pending debounce when its chip is removed", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${debouncedFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = { q: "seed" };
    await el.updateComplete;

    let inputs = 0;
    el.addEventListener("lr-input", () => (inputs += 1));
    await typeInto(el, "q", "draft");
    const chip = el.shadowRoot!.querySelector('[part="chip"]') as HTMLElement;
    chip.dispatchEvent(
      new CustomEvent("lr-remove", {
        bubbles: true,
        composed: true,
        detail: {},
      })
    );
    await aTimeout(300);

    expect(el.value).to.deep.equal({});
    expect(inputs, "only the chip removal itself emitted").to.equal(1);
    const native = await nativeInput(el, "q");
    expect(native.value).to.equal("");
  });

  it("cancels a pending debounce on disconnect, so a detached bar never emits after teardown", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${debouncedFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    let fired = false;
    el.addEventListener("lr-input", () => (fired = true));
    await typeInto(el, "q", "detached");
    el.remove();
    await aTimeout(300);
    expect(fired).to.be.false;
    expect(el.value).to.deep.equal({});
  });

  it("cancels and visually reverts a pending debounce when disabled mid-edit", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${debouncedFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = { q: "authoritative" };
    await el.updateComplete;
    let inputs = 0;
    el.addEventListener("lr-input", () => (inputs += 1));

    await typeInto(el, "q", "uncommitted draft");
    el.disabled = true;
    await el.updateComplete;
    const native = await nativeInput(el, "q");

    expect(native.value).to.equal("authoritative");
    await aTimeout(300);
    expect(el.value).to.deep.equal({ q: "authoritative" });
    expect(inputs).to.equal(0);
  });

  it("cancels a pending debounce when the filter schema is removed or replaced", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${debouncedFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    const emitted: LyraFilterBarInputDetail[] = [];
    el.addEventListener("lr-input", (event) => {
      emitted.push((event as CustomEvent<LyraFilterBarInputDetail>).detail);
    });
    await typeInto(el, "q", "stale draft");

    el.filters = [
      { filterId: "q", label: "Replacement", type: "select", options: [] },
    ];
    await el.updateComplete;
    await aTimeout(300);

    expect(emitted).to.deep.equal([]);
    expect(el.value).to.deep.equal({});
    expect(control(el, "q").localName).to.equal("lr-select");
  });

  it("restores the authoritative text value after disconnect and reconnect", async () => {
    const container = await fixture<HTMLDivElement>(html`<div>
      <lr-filter-bar
        .filters=${debouncedFilters}
        .value=${{ q: "saved" }}
      ></lr-filter-bar>
    </div>`);
    const el = container.querySelector("lr-filter-bar") as LyraFilterBar;
    const native = await typeInto(el, "q", "uncommitted");

    el.remove();
    container.append(el);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await (
      control(el, "q") as HTMLElement & { updateComplete: Promise<unknown> }
    ).updateComplete;

    expect(el.value).to.deep.equal({ q: "saved" });
    expect(native.value).to.equal("saved");
  });

  it("keeps the caret and the typed text across a re-render triggered mid-typing", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${debouncedFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    const native = await typeInto(el, "q", "abcdef");
    native.setSelectionRange(3, 3);

    // Any unrelated state change re-renders the whole bar while the debounce is still pending;
    // a controlled `.value=` binding would push the stale (empty) model value back into the field.
    el.loading = true;
    await el.updateComplete;
    await (
      control(el, "q") as HTMLElement & { updateComplete: Promise<unknown> }
    ).updateComplete;
    expect(native.value).to.equal("abcdef");
    expect(native.selectionStart).to.equal(3);

    // …and the commit itself, which re-renders again, must not disturb it either.
    await aTimeout(300);
    await el.updateComplete;
    await (
      control(el, "q") as HTMLElement & { updateComplete: Promise<unknown> }
    ).updateComplete;
    expect(el.value).to.deep.equal({ q: "abcdef" });
    expect(native.value).to.equal("abcdef");
    expect(native.selectionStart).to.equal(3);
  });

  it("reveals a required text filter's error on blur, not per keystroke, and flushes first", async () => {
    const requiredText: LyraFilterBarFilterDefinition[] = [
      { filterId: "q", label: "Search", type: "text", required: true, debounce: 400 },
    ];
    const el = (await fixture(
      html`<lr-filter-bar .filters=${requiredText}></lr-filter-bar>`
    )) as LyraFilterBar;
    const composed = control(el, "q") as HTMLElement & { errorText: string };
    expect(composed.errorText).to.equal("");

    await typeInto(el, "q", "hello");
    await el.updateComplete;
    expect(
      composed.errorText,
      "an in-flight debounce must not flash a required error"
    ).to.equal("");

    control(el, "q").dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, composed: true })
    );
    await el.updateComplete;
    expect(el.value, "blur flushes the pending debounce").to.deep.equal({
      q: "hello",
    });
    expect(
      composed.errorText,
      "the flushed value satisfies required, so no error is revealed"
    ).to.equal("");
  });

  it("still reveals the required error on blur when the text filter is genuinely empty", async () => {
    const requiredText: LyraFilterBarFilterDefinition[] = [
      { filterId: "q", label: "Search", type: "text", required: true, debounce: 60 },
    ];
    const el = (await fixture(
      html`<lr-filter-bar .filters=${requiredText}></lr-filter-bar>`
    )) as LyraFilterBar;
    control(el, "q").dispatchEvent(
      new FocusEvent("focusout", { bubbles: true, composed: true })
    );
    await el.updateComplete;
    expect(
      (control(el, "q") as HTMLElement & { errorText: string }).errorText
    ).to.equal("This field is required.");
    expect(el.invalidFilterIds).to.deep.equal(["q"]);
  });

  it("disables the composed text input along with every other control", async () => {
    const el = (await fixture(
      html`<lr-filter-bar disabled .filters=${textFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    expect((control(el, "q") as HTMLElement & { disabled: boolean }).disabled)
      .to.be.true;
    let fired = false;
    el.addEventListener("lr-input", () => (fired = true));
    await typeInto(el, "q", "nope");
    await aTimeout(120);
    expect(fired).to.be.false;
    expect(el.value).to.deep.equal({});
  });

  it("is accessible with a text filter populated, its chip shown, and a revealed required error", async () => {
    const filters: LyraFilterBarFilterDefinition[] = [
      {
        filterId: "q",
        label: "Search",
        type: "text",
        placeholder: "Search logs",
        debounce: 60,
      },
      { ...textFilters[1], required: true },
    ];
    const el = (await fixture(
      html`<lr-filter-bar .filters=${filters}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = { q: "GET /api/v1" };
    el.reportValidity();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="chip"]').length).to.equal(1);
    await expect(el).to.be.accessible();
  });
});

describe("accessibility", () => {
  it("is accessible in the empty (no filters, no active state) default render", async () => {
    const el = (await fixture(
      html`<lr-filter-bar></lr-filter-bar>`
    )) as LyraFilterBar;
    await expect(el).to.be.accessible();
  });

  it("is accessible in a populated state: active filters, loading spinner, and a revealed required error", async () => {
    const el = (await fixture(
      html`<lr-filter-bar .filters=${basicFilters}></lr-filter-bar>`
    )) as LyraFilterBar;
    el.value = {
      status: "open",
      tags: ["urgent", "billing"],
      created: "2026-02-01",
    };
    el.loading = true;
    el.reportValidity();
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll('[part="chip"]').length).to.equal(3);
    expect(el.shadowRoot!.querySelector('[part="status"]')).to.exist;
    await expect(el).to.be.accessible();
  });
});

it("renders an option's optional icon into lr-option's leading start slot for select and combobox", async () => {
  const dot = (tone: string) =>
    html`<span data-tone=${tone} class="option-dot">•</span>`;
  const el = (await fixture(html`<lr-filter-bar
    .filters=${[
      {
        filterId: "status",
        label: "Status",
        type: "select",
        options: [
          { value: "open", label: "Open", icon: dot("open") },
          { value: "closed", label: "Closed" },
        ],
      },
      {
        filterId: "owner",
        label: "Owner",
        type: "combobox",
        options: [{ value: "ada", label: "Ada", icon: dot("ada") }],
      },
    ] as LyraFilterBarFilterDefinition[]}
  ></lr-filter-bar>`)) as LyraFilterBar;
  await el.updateComplete;

  const options = [...el.shadowRoot!.querySelectorAll("lr-option")];
  expect(options.length).to.equal(3);
  const adornments = options.map(
    (option) => option.querySelector('[slot="start"] .option-dot')?.getAttribute("data-tone") ?? null,
  );
  expect(adornments).to.deep.equal(["open", null, "ada"]);
  // The adornment is decorative chrome, never part of the option's accessible name.
  expect(options[0]!.querySelector('[slot="start"]')!.getAttribute("aria-hidden")).to.equal("true");
  expect(options[0]!.textContent?.trim()).to.contain("Open");
});
