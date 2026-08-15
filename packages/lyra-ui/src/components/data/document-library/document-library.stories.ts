import { html } from "lit";
import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "./document-library.js";
import type { LibraryDocument } from "./document-library.class.js";

const meta: Meta = {
  title: "DocumentLibrary",
  component: "lr-document-library",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A bounded searchable document inventory with unique nonempty first-wins document ids, controlled searchTerm, canonical sort request/commit events, and detached clone-owned readonly collections (including Date values). Documents, nested tags, selected ids, and tag filters are synchronously capped at 10,000 entries; reassign each collection after changing it. Selection/open events expose documentIds/documentId, and the view is built on lr-table, lr-chip-group, lr-input, lr-combobox, and lr-file-icon.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const documents: LibraryDocument[] = [
  {
    id: "d1",
    name: "Alpha Overview.docx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    version: "v10",
    owner: "Jordan Lee",
    tags: ["onboarding", "handbook"],
    freshness: "fresh",
    updatedAt: "2024-06-01T00:00:00.000Z",
  },
  {
    id: "d2",
    name: "Zeta Runbook.pdf",
    mimeType: "application/pdf",
    version: "v2",
    owner: "Priya Nair",
    tags: ["ops", "runbook"],
    freshness: "stale",
    updatedAt: "2024-01-05T00:00:00.000Z",
  },
  {
    id: "d3",
    name: "Mid Spec.md",
    mimeType: "text/markdown",
    version: "v1",
    owner: "Alex Chen",
    tags: ["spec"],
    freshness: "aging",
    updatedAt: "2024-03-15T00:00:00.000Z",
  },
  {
    id: "d4",
    name: "Quarterly Metrics.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    version: "v5",
    owner: "Jordan Lee",
    tags: ["ops", "metrics"],
    freshness: "fresh",
    updatedAt: "2024-06-10T00:00:00.000Z",
  },
];

export const Default: Story = {
  render: () =>
    html`<lr-document-library .documents=${documents}></lr-document-library>`,
};

export const WithSelection: Story = {
  render: () =>
    html`<lr-document-library
      .documents=${documents}
      .selectedDocumentIds=${["d1", "d4"]}
    ></lr-document-library>`,
};

export const ControlledSearchAndSort: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "The public search-term/sort-key/sort-dir axes drive the initial view. Header activation emits a cancelable lr-sort-request followed by a committed lr-sort carrying the same sortKey/sortDir vocabulary.",
      },
    },
  },
  render: () => {
    const report = (event: CustomEvent): void => {
      const output = (event.currentTarget as HTMLElement).parentElement?.querySelector("output");
      if (output) output.textContent = `${event.type}: ${JSON.stringify(event.detail)}`;
    };
    return html`
      <div style="display:grid;gap:var(--lr-space-s)">
        <lr-document-library
          .documents=${documents}
          search-term="ops"
          sort-key="updatedAt"
          sort-dir="desc"
          @lr-sort-request=${report}
          @lr-sort=${report}
        ></lr-document-library>
        <output aria-live="polite">Activate a sortable header</output>
      </div>
    `;
  },
};

/** Search, tag, and checkbox native/prefixed value events stop inside the component. Interact with
 * the inventory; the log receives only the documented library-level filter and selection events. */
export const TranslatedHostEvents: Story = {
  render: () => {
    const report = (event: Event): void => {
      const output = (event.currentTarget as HTMLElement).querySelector(
        "output"
      );
      if (output) output.textContent = `Received ${event.type}`;
    };
    return html`
      <div
        style="display:grid;gap:var(--lr-space-s)"
        @lr-filter-change=${report}
        @lr-selection-change=${report}
        @input=${report}
        @lr-input=${report}
        @lr-change=${report}
        @change=${report}
      >
        <lr-document-library .documents=${documents}></lr-document-library>
        <output aria-live="polite"
          >Interact with a library filter or checkbox</output
        >
      </div>
    `;
  },
};

export const Empty: Story = {
  render: () => html`<lr-document-library></lr-document-library>`,
};

export const NarrowAllocation: Story = {
  name: "Document inventory at a 320px allocation",
  parameters: {
    docs: {
      description: {
        story:
          "At a 320px allocation, the low-priority tags/freshness/updated columns hide (via lr-table's own priority mechanism) and only select/type/name stay visible, mirroring lr-table's own narrow-container story.",
      },
    },
  },
  render: () => html`
    <div style="inline-size:320px; max-inline-size:100%;">
      <lr-document-library .documents=${documents}></lr-document-library>
    </div>
  `,
};
