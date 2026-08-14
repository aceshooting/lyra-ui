import { html } from "lit";
import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "./drilldown-panel.js";
import type {
  LyraDrilldownCategoryChangeDetail,
  LyraDrilldownEntity,
  LyraDrilldownNode,
  LyraDrilldownPanel,
} from "./drilldown-panel.class.js";

const meta: Meta = {
  title: "Drilldown Panel",
  component: "lr-drilldown-panel",
};
export default meta;
type Story = StoryObj;

const entity: LyraDrilldownEntity = {
  entityId: "entity-1",
  label: "Acme EMEA Holdings",
  type: "org",
  description: "Regional holding entity for EMEA operations.",
  properties: { region: "EMEA", founded: "1998" },
  degree: 7,
};

const types = [
  { id: "org", label: "Organization", color: "var(--lr-color-brand)" },
];

const path: readonly LyraDrilldownNode[] = [
  {
    nodeId: "chart-q3-revenue",
    label: "Q3 revenue",
    evidence: [
      {
        evidenceId: "evidence-1",
        title: "q3_close_summary.pdf",
        page: 4,
        href: "https://example.com/q3_close_summary.pdf",
        excerpt:
          "Q3 revenue grew 12% year over year, driven primarily by EMEA…",
        full: "Q3 revenue grew 12% year over year, driven primarily by EMEA (+18%) offsetting a soft APAC quarter (-3%).",
      },
    ],
  },
  {
    nodeId: "emea-region",
    label: "EMEA region",
    evidence: [
      {
        evidenceId: "evidence-2",
        title: "regional_notes.txt",
        excerpt: "Anomaly flagged by the finance team on 2026-07-14.",
      },
    ],
    documents: [
      {
        documentId: "document-1",
        name: "emea_contract_renewal.pdf",
        mimeType: "application/pdf",
        uri: "https://example.com/emea_contract_renewal.pdf",
      },
    ],
    entities: [entity],
  },
];

function acceptCategory(
  event: CustomEvent<LyraDrilldownCategoryChangeDetail>
): void {
  (event.currentTarget as LyraDrilldownPanel).activeCategory =
    event.detail.category;
}

export const Default: Story = {
  render: () => html`<lr-drilldown-panel
    .path=${path}
    .types=${types}
    @lr-drilldown-category-change=${acceptCategory}
  ></lr-drilldown-panel>`,
};

export const SingleCategoryNoTabs: Story = {
  render: () =>
    html`<lr-drilldown-panel .path=${[path[0]]}></lr-drilldown-panel>`,
};

/** A present host `aria-label` names the actual category owner: the sole region without tabs or
 * the nested tab strip with multiple categories. An explicitly empty value is preserved too. */
export const AccessibleNamePrecedence: Story = {
  render: () => html`
    <div style="display:grid;gap:var(--lr-space-l)">
      <lr-drilldown-panel
        aria-label="Related evidence"
        .path=${[path[0]]}
      ></lr-drilldown-panel>
      <lr-drilldown-panel
        aria-label="Related content"
        .path=${path}
        .types=${types}
        @lr-drilldown-category-change=${acceptCategory}
      ></lr-drilldown-panel>
    </div>
  `,
};

export const WithAgentRuns: Story = {
  render: () => html`
    <lr-drilldown-panel
      .path=${path}
      .types=${types}
      active-category="runs"
      @lr-drilldown-category-change=${acceptCategory}
    >
      <div slot="runs">
        <p>Run #42 — completed in 4.2s, 3 tool calls, no errors.</p>
      </div>
    </lr-drilldown-panel>
  `,
};

/** Only eight previews are mounted for the active page; the localized range remains truthful. */
export const BoundedDocumentPage: Story = {
  render: () => html`
    <lr-drilldown-panel
      active-category="documents"
      .path=${[
        {
          nodeId: "document-set",
          label: "Quarterly documents",
          documents: Array.from({ length: 24 }, (_, index) => ({
            documentId: `document-${index + 1}`,
            name: `quarter-${index + 1}.pdf`,
            mimeType: "application/pdf",
          })),
        },
      ]}
    ></lr-drilldown-panel>
  `,
};

export const EmptySelection: Story = {
  render: () => html`<lr-drilldown-panel></lr-drilldown-panel>`,
};

export const NoContentForCurrentNode: Story = {
  render: () => html`<lr-drilldown-panel
    .path=${[{ nodeId: "datum-empty", label: "Datum with no related content" }]}
  ></lr-drilldown-panel>`,
};

export const Narrow: Story = {
  render: () => html`
    <div style="max-width: 320px;">
      <lr-drilldown-panel
        .path=${path}
        .types=${types}
        @lr-drilldown-category-change=${acceptCategory}
      ></lr-drilldown-panel>
    </div>
  `,
};

export const RTL: Story = {
  render: () => html`
    <div dir="rtl">
      <lr-drilldown-panel
        .path=${path}
        .types=${types}
        @lr-drilldown-category-change=${acceptCategory}
      ></lr-drilldown-panel>
    </div>
  `,
};
