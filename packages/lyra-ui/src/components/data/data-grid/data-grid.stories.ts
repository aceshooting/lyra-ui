import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import type {
  DataGridColumn,
  DataGridRequest,
  LyraDataGrid,
} from "./data-grid.js";

interface DemoRow {
  id: number;
  name: string;
  team: string;
  score: number;
  joined: string;
  children?: DemoRow[];
}

const rows: DemoRow[] = [
  {
    id: 1,
    name: "Ada Lovelace",
    team: "Compiler",
    score: 97,
    joined: "2024-01-15",
  },
  {
    id: 2,
    name: "Grace Hopper",
    team: "Compiler",
    score: 94,
    joined: "2024-02-10",
  },
  {
    id: 3,
    name: "Margaret Hamilton",
    team: "Runtime",
    score: 99,
    joined: "2024-03-12",
  },
  {
    id: 4,
    name: "Edsger Dijkstra",
    team: "Runtime",
    score: 91,
    joined: "2024-04-20",
  },
  {
    id: 5,
    name: "Barbara Liskov",
    team: "Types",
    score: 96,
    joined: "2024-05-08",
  },
];

const columns: DataGridColumn<DemoRow>[] = [
  {
    field: "name",
    label: "Name",
    minWidth: 180,
    filterable: true,
    pinned: "left",
  },
  { field: "team", label: "Team", filterable: true },
  { field: "score", label: "Score", align: "end", aggregation: "mean" },
  { field: "joined", label: "Joined", sortFn: "datetime" },
];

const meta: Meta = {
  title: "Data Grid",
  component: "lr-data-grid",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Data grid with client and server processing. Collection inputs and event/state collections are readonly snapshots; `selectedRows` remains writable and maps current source-row objects onto `selectedKeys`.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-data-grid
      label="Engineering roster"
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `,
};

export const FullClientFeatures: Story = {
  render: () => html`
    <lr-data-grid
      label="Engineering roster"
      row-key="id"
      selectable="multiple"
      with-search
      with-column-menu
      with-columns-menu
      resizable
      reorderable
      pinnable
      paginate
      page-size="3"
      striped
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `,
};

export const HonestColumnControls: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Open a column's options button. It discloses a native-control group with distinct pin-to-start, pin-to-end, unpin, and visibility names; Escape closes it and returns focus. Resize separators are separate keyboard stops with complete adjustable values.",
      },
    },
  },
  render: () => html`
    <lr-data-grid
      label="Column controls"
      with-column-menu
      pinnable
      resizable
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `,
};

export const BoundedTreeProjection: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Nested input is cycle-safe and bounded to 64 descendant levels and 10,000 total rows. This 70-level example renders the supported prefix plus the localized `tree-limit` notice.",
      },
    },
  },
  render: () => {
    let root: DemoRow = {
      id: 69,
      name: "Level 69",
      team: "Tree",
      score: 69,
      joined: "2024-01-01",
    };
    for (let id = 68; id >= 0; id -= 1) {
      root = {
        id,
        name: `Level ${id}`,
        team: "Tree",
        score: id,
        joined: "2024-01-01",
        children: [root],
      };
    }
    return html`
      <lr-data-grid
        label="Bounded nested rows"
        row-key="id"
        child-rows="children"
        .expandedKeys=${Array.from({ length: 70 }, (_value, id) => id)}
        .columns=${columns.slice(0, 1)}
        .data=${[root]}
      ></lr-data-grid>
    `;
  },
};

/** An explicit delimiter overrides the comma normally selected by `format: "csv"`. */
export const ExplicitCopyDelimiter: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Calls `copySelectedRows({ format: 'csv', delimiter: ';' })`. The explicit semicolon takes precedence over CSV's usual comma, and the preview uses the same selected columns and delimiter.",
      },
    },
  },
  render: () => {
    const copyWithSemicolons = (event: Event): void => {
      const wrapper = (event.currentTarget as HTMLElement).closest<HTMLElement>(
        "[data-copy-delimiter]"
      );
      const grid =
        wrapper?.querySelector<LyraDataGrid<DemoRow>>("lr-data-grid");
      const output = wrapper?.querySelector<HTMLOutputElement>("output");
      if (!grid || !output) return;

      const preview = grid.getDataAsCsv({
        columnIds: ["name", "score"],
        includeHeaders: false,
        delimiter: ";",
      });
      const cleanup = (): void => {
        grid.removeEventListener("lr-copy", onCopy);
        grid.removeEventListener("lr-copy-error", onCopyError);
      };
      const onCopy = (): void => {
        cleanup();
        output.textContent = `Clipboard write fulfilled:\n${preview}`;
      };
      const onCopyError = (): void => {
        cleanup();
        output.textContent = "Clipboard write failed; no success was reported.";
      };
      grid.addEventListener("lr-copy", onCopy);
      grid.addEventListener("lr-copy-error", onCopyError);
      const requested = grid.copySelectedRows({
        columnIds: ["name", "score"],
        includeHeaders: false,
        format: "csv",
        delimiter: ";",
      });
      output.textContent = `Requested a clipboard write for ${requested} selected rows…`;
    };
    return html`
      <div data-copy-delimiter style="display:grid;gap:var(--lr-space-s)">
        <lr-data-grid
          label="Semicolon copy example"
          row-key="id"
          selectable="multiple"
          .selectedKeys=${[1, 2]}
          .columns=${columns}
          .data=${rows.slice(0, 2)}
        ></lr-data-grid>
        <button type="button" @click=${copyWithSemicolons}>
          Copy selected rows with semicolons
        </button>
        <output aria-live="polite" style="white-space:pre-wrap">
          Copy the preselected rows with
          <code>format: 'csv', delimiter: ';'</code>.
        </output>
      </div>
    `;
  },
};

/** A canceled pointer drag rolls the column back and never reports `finished: true`. */
export const CanceledColumnResize: Story = {
  render: () => {
    const cancelResize = (event: Event): void => {
      const wrapper = (event.currentTarget as HTMLElement).closest<HTMLElement>(
        "[data-cancel-resize]"
      );
      const grid = wrapper?.querySelector<LyraDataGrid>("lr-data-grid");
      const handle = grid?.shadowRoot?.querySelector<HTMLElement>(
        '[part="resize-handle"]'
      );
      if (!handle) return;
      handle.dispatchEvent(
        new PointerEvent("pointerdown", {
          pointerId: 17,
          clientX: 100,
          bubbles: true,
          composed: true,
        })
      );
      handle.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId: 17,
          clientX: 160,
          bubbles: true,
          composed: true,
        })
      );
      handle.dispatchEvent(
        new PointerEvent("pointercancel", {
          pointerId: 17,
          clientX: 160,
          bubbles: true,
          composed: true,
        })
      );
    };
    return html`
      <div data-cancel-resize style="display:grid;gap:var(--lr-space-s)">
        <button type="button" @click=${cancelResize}>
          Simulate canceled resize
        </button>
        <lr-data-grid
          label="Cancelable column resize"
          resizable
          .columns=${columns}
          .data=${rows}
          @lr-column-resize=${(
            event: CustomEvent<{ width: number; finished: boolean }>
          ) => {
            const output = (event.currentTarget as HTMLElement)
              .nextElementSibling;
            if (output instanceof HTMLOutputElement) {
              output.textContent = `${
                event.detail.finished ? "Committed" : "Live or rolled back"
              } width ${Math.round(event.detail.width)}`;
            }
          }}
        ></lr-data-grid>
        <output aria-live="polite">No resize event yet</output>
      </div>
    `;
  },
};

/** Search and column-filter editors relay native focus transitions through the grid host. */
export const EditorFocusEvents: Story = {
  render: () => {
    const report = (event: FocusEvent) => {
      const output = (event.currentTarget as HTMLElement).nextElementSibling;
      if (output)
        output.textContent = `${event.type} relayed from lr-data-grid`;
    };
    return html`
      <div style="display:grid;gap:var(--lr-space-s)">
        <lr-data-grid
          label="Engineering roster"
          with-search
          @focus=${report}
          @blur=${report}
          .columns=${columns}
          .data=${rows}
        ></lr-data-grid>
        <output aria-live="polite"
          >Focus the search field or open a column filter.</output
        >
      </div>
    `;
  },
};

export const Grouped: Story = {
  render: () => html`
    <lr-data-grid
      label="Roster grouped by team"
      group-by="team"
      row-key="id"
      selectable="multiple"
      .expandedKeys=${[
        "group:root:team:string:Compiler",
        "group:root:team:string:Runtime",
      ]}
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `,
};

export const TreeAndDetails: Story = {
  render: () => {
    const treeRows: DemoRow[] = [
      {
        ...rows[0]!,
        children: [
          {
            id: 11,
            name: "Parser",
            team: "Compiler",
            score: 92,
            joined: "2024-06-01",
          },
          {
            id: 12,
            name: "Optimizer",
            team: "Compiler",
            score: 95,
            joined: "2024-06-02",
          },
        ],
      },
    ];
    return html`
      <lr-data-grid
        label="Compiler work tree"
        child-rows="children"
        row-key="id"
        .expandedKeys=${[1]}
        .rowDetail=${(row: DemoRow) =>
          html`<strong>${row.name}</strong> scored ${row.score}.`}
        .columns=${columns}
        .data=${treeRows}
      ></lr-data-grid>
    `;
  },
};

export const ServerData: Story = {
  render: () => html`
    <lr-data-grid
      label="Server roster"
      server
      paginate
      with-search
      page-size="2"
      .columns=${columns}
      .dataSource=${async (request: DataGridRequest) => {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const filtered = rows.filter((row) =>
          row.name.toLowerCase().includes(request.search.toLowerCase())
        );
        const start = request.page * request.pageSize;
        return {
          rows: filtered.slice(start, start + request.pageSize),
          total: filtered.length,
        };
      }}
    ></lr-data-grid>
  `,
};

export const CustomStates: Story = {
  render: () => html`
    <div style="display:grid;gap:var(--lr-space-l)">
      <lr-data-grid label="Empty roster" .columns=${columns} .data=${[]}>
        <p slot="empty">No engineers have been added.</p>
      </lr-data-grid>
      <lr-data-grid
        label="Loading roster"
        loading
        .columns=${columns}
        .data=${rows}
      >
        <strong slot="loading">Refreshing the roster…</strong>
      </lr-data-grid>
      <lr-data-grid
        label="Filtered roster"
        .searchTerm=${"not present"}
        .columns=${columns}
        .data=${rows}
      >
        <p slot="no-results">No engineers match the active filters.</p>
      </lr-data-grid>
    </div>
  `,
};

export const Virtualized: Story = {
  render: () => html`
    <lr-data-grid
      label="Large engineering roster"
      row-key="id"
      .columns=${columns}
      .data=${Array.from({ length: 120 }, (_value, index) => ({
        id: index + 1,
        name: `Engineer ${index + 1}`,
        team: `Team ${(index % 6) + 1}`,
        score: 70 + (index % 30),
        joined: `2024-${String((index % 12) + 1).padStart(2, "0")}-15`,
      }))}
    ></lr-data-grid>
  `,
};

export const NarrowRtl: Story = {
  render: () => html`
    <div dir="rtl" style="inline-size:320px">
      <lr-data-grid
        label="فريق الهندسة"
        with-search
        paginate
        page-size="3"
        .columns=${columns}
        .data=${rows}
      ></lr-data-grid>
    </div>
  `,
};
