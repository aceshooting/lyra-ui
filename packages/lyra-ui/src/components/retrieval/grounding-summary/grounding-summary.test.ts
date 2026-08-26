import { fixture, expect, html, oneEvent } from "@open-wc/testing";
import "./grounding-summary.js";
import type { LyraGroundingSummary } from "./grounding-summary.js";
import type { Citation, GroundingAssessment } from "../../../ai/types.js";

const ASSESSMENT: GroundingAssessment = {
  supportedClaims: 8,
  unsupportedClaims: 1,
  coverage: 0.89,
  confidence: 0.72,
  warnings: ["One claim could not be matched to a source."],
};

const CITATIONS: Citation[] = [
  {
    id: "cite-1",
    sourceId: "doc-1",
    label: "[1]",
    span: { start: 0, end: 42 },
  },
  { id: "cite-2", sourceId: "doc-2" },
];

function stats(el: LyraGroundingSummary): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll("lr-stat")] as HTMLElement[];
}

it("renders the groundingSummaryEmpty state when assessment is null (the default)", async () => {
  const el = (await fixture(
    html`<lr-grounding-summary></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  expect(el.assessment).to.equal(null);
  expect(el.shadowRoot!.querySelector("lr-empty")).to.exist;
  expect(el.shadowRoot!.querySelectorAll("lr-stat").length).to.equal(0);
});

it("keeps an explicitly empty label distinct from an omitted one", async () => {
  const omitted = (await fixture(
    html`<lr-grounding-summary></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  expect(omitted.label).to.be.undefined;
  expect(
    omitted.shadowRoot!.querySelector('[part~="base"]')!.getAttribute("aria-label")
  ).to.equal("Grounding summary");

  const explicitEmpty = (await fixture(
    html`<lr-grounding-summary label=""></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  expect(explicitEmpty.label).to.equal("");
  expect(
    explicitEmpty.shadowRoot!.querySelector('[part~="base"]')!.getAttribute("aria-label")
  ).to.equal("");
});

it("renders supported/unsupported/coverage as lr-stat, omitting confidence when unset", async () => {
  const el = (await fixture(
    html`<lr-grounding-summary></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  el.assessment = { supportedClaims: 8, unsupportedClaims: 1, coverage: 0.89 };
  await el.updateComplete;

  const rows = stats(el);
  expect(rows.length).to.equal(3);
  expect(rows[0]!.getAttribute("value")).to.equal("8");
  expect(rows[1]!.getAttribute("value")).to.equal("1");
  expect(rows[2]!.getAttribute("value")).to.equal("89%");
});

it('fails closed when assessment warnings are not a string array', async () => {
  const el = (await fixture(
    html`<lr-grounding-summary></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  (el as unknown as { assessment: unknown }).assessment = {
    supportedClaims: 1,
    unsupportedClaims: 0,
    coverage: 1,
    warnings: 'not-an-array',
  };
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="warnings"]') != null).to.equal(false);
  expect(el.shadowRoot!.querySelectorAll('lr-stat')).to.have.length(3);
});

it("renders a fourth confidence lr-stat when assessment.confidence is set", async () => {
  const el = (await fixture(
    html`<lr-grounding-summary></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  el.assessment = ASSESSMENT;
  await el.updateComplete;

  const rows = stats(el);
  expect(rows.length).to.equal(4);
  expect(rows[3]!.getAttribute("value")).to.equal("72%");
});

it("renders claim-level evidence when claims are supplied and allows it to be hidden explicitly", async () => {
  const el = (await fixture(
    html`<lr-grounding-summary></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  el.assessment = {
    supportedClaims: 1,
    unsupportedClaims: 0,
    coverage: 1,
    claims: [
      {
        id: "claim-1",
        text: "A supported claim",
        status: "supported",
        citationIds: ["cite-1"],
      },
    ],
  };
  el.citations = CITATIONS;
  await el.updateComplete;
  const claims = el.shadowRoot!.querySelector("lr-claim-evidence")!;
  expect(claims.claims.length).to.equal(1);

  el.showClaims = false;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector("lr-claim-evidence") == null).to.be.true;
});

it("exposes the bubbled lr-claim-select contract with the complete claim detail", async () => {
  const claim = {
    id: "claim-1",
    text: "A supported claim",
    status: "supported" as const,
    citationIds: ["cite-1"],
  };
  const el = (await fixture(
    html`<lr-grounding-summary></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  el.assessment = {
    supportedClaims: 1,
    unsupportedClaims: 0,
    coverage: 1,
    claims: [claim],
  };
  el.citations = CITATIONS;
  await el.updateComplete;
  const claims = el.shadowRoot!.querySelector(
    "lr-claim-evidence"
  ) as HTMLElement & {
    updateComplete: Promise<unknown>;
    shadowRoot: ShadowRoot;
  };
  await claims.updateComplete;

  const pending = oneEvent(el, "lr-claim-select");
  (
    claims.shadowRoot.querySelector(
      '[part="claim-trigger"]'
    ) as HTMLButtonElement
  ).click();
  expect((await pending).detail).to.deep.equal({ claim });
});

it("formats large claim counts through the effective locale", async () => {
  const el = (await fixture(
    html`<lr-grounding-summary locale="de-DE"></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  el.assessment = {
    supportedClaims: 1234,
    unsupportedClaims: 0,
    coverage: 0.5,
  };
  await el.updateComplete;

  expect(stats(el)[0]!.getAttribute("value")).to.equal("1.234");
});

it("tones the supported/unsupported stats success/danger only when their count is positive, neutral at zero", async () => {
  const el = (await fixture(
    html`<lr-grounding-summary></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  el.assessment = { supportedClaims: 0, unsupportedClaims: 0, coverage: 0.9 };
  await el.updateComplete;
  let rows = stats(el);
  expect(rows[0]!.getAttribute("variant")).to.equal("neutral");
  expect(rows[1]!.getAttribute("variant")).to.equal("neutral");

  el.assessment = { supportedClaims: 3, unsupportedClaims: 2, coverage: 0.9 };
  await el.updateComplete;
  rows = stats(el);
  expect(rows[0]!.getAttribute("variant")).to.equal("success");
  expect(rows[1]!.getAttribute("variant")).to.equal("danger");
});

it("tones coverage/confidence via thresholds: >= high is success, >= medium is warning, below is danger", async () => {
  const el = (await fixture(
    html`<lr-grounding-summary></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  el.assessment = {
    supportedClaims: 1,
    unsupportedClaims: 0,
    coverage: 0.85,
    confidence: 0.6,
  };
  await el.updateComplete;
  let rows = stats(el);
  expect(rows[2]!.getAttribute("variant")).to.equal("success"); // coverage 0.85 >= default high 0.8
  expect(rows[3]!.getAttribute("variant")).to.equal("warning"); // confidence 0.6 >= default medium 0.5

  el.assessment = {
    supportedClaims: 1,
    unsupportedClaims: 0,
    coverage: 0.2,
    confidence: 0.2,
  };
  await el.updateComplete;
  rows = stats(el);
  expect(rows[2]!.getAttribute("variant")).to.equal("danger");
  expect(rows[3]!.getAttribute("variant")).to.equal("danger");
});

it("applies a custom thresholds override to the coverage/confidence tone", async () => {
  const el = (await fixture(
    html`<lr-grounding-summary></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  el.thresholds = { high: 0.95, medium: 0.9 };
  el.assessment = { supportedClaims: 1, unsupportedClaims: 0, coverage: 0.92 };
  await el.updateComplete;
  expect(stats(el)[2]!.getAttribute("variant")).to.equal("warning");
});

it("clamps negative/NaN claim counts and an out-of-range coverage instead of rendering invalid output", async () => {
  const el = (await fixture(
    html`<lr-grounding-summary></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  el.assessment = {
    supportedClaims: -5,
    unsupportedClaims: NaN,
    coverage: 1.5,
  };
  await el.updateComplete;
  const rows = stats(el);
  expect(rows[0]!.getAttribute("value")).to.equal("0");
  expect(rows[1]!.getAttribute("value")).to.equal("0");
  expect(rows[2]!.getAttribute("value")).to.equal("100%");
});

it("omits the warnings section when there are none, and renders each warning verbatim (as caller data, not localized) when present", async () => {
  const el = (await fixture(
    html`<lr-grounding-summary></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  el.assessment = { supportedClaims: 1, unsupportedClaims: 0, coverage: 1 };
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="warnings"]') == null).to.be.true;

  el.assessment = ASSESSMENT;
  await el.updateComplete;
  const warningsEl = el.shadowRoot!.querySelector('[part="warnings"]')!;
  expect(warningsEl != null).to.equal(true);
  expect(
    el.shadowRoot!.querySelector('[part="warnings-count"]')!.textContent
  ).to.equal("1");
  const items = el.shadowRoot!.querySelectorAll('[part="warning"]');
  expect(items.length).to.equal(1);
  expect(items[0]!.textContent).to.equal(
    "One claim could not be matched to a source."
  );
});

it("omits the evidence section when citations is empty, and renders one lr-citation-badge per citation, 1-indexed, with source-id carried through", async () => {
  const el = (await fixture(
    html`<lr-grounding-summary></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  el.assessment = ASSESSMENT;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="evidence"]') == null).to.be.true;

  el.citations = CITATIONS;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="evidence-count"]')!.textContent
  ).to.equal("2");
  const badges = el.shadowRoot!.querySelectorAll("lr-citation-badge");
  expect(badges.length).to.equal(2);
  expect(badges[0]!.getAttribute("index")).to.equal("1");
  expect(badges[0]!.getAttribute("source-id")).to.equal("doc-1");
  expect(badges[1]!.getAttribute("index")).to.equal("2");
  expect(badges[1]!.getAttribute("source-id")).to.equal("doc-2");
});

it("renders a citation's label and formatted span next to its badge, omitting evidence-span when span is unset", async () => {
  const el = (await fixture(
    html`<lr-grounding-summary></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  el.assessment = ASSESSMENT;
  el.citations = CITATIONS;
  await el.updateComplete;

  const labels = el.shadowRoot!.querySelectorAll('[part="evidence-label"]');
  const spans = el.shadowRoot!.querySelectorAll('[part="evidence-span"]');
  expect(labels.length).to.equal(1);
  expect(labels[0]!.textContent).to.equal("[1]");
  expect(spans.length).to.equal(1);
  expect(spans[0]!.textContent).to.equal("Characters 0–42");
});

it("emits only the richer lr-citation-select event when a badge is activated", async () => {
  const el = (await fixture(
    html`<lr-grounding-summary></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  el.assessment = ASSESSMENT;
  el.citations = CITATIONS;
  await el.updateComplete;

  let genericActivations = 0;
  el.addEventListener("lr-citation-activate", () => genericActivations++);
  const selectListener = oneEvent(el, "lr-citation-select");
  const badge = el
    .shadowRoot!.querySelector("lr-citation-badge")!
    .shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
  badge.click();

  const selectEvent = await selectListener;
  expect(selectEvent.detail).to.deep.equal({ citation: CITATIONS[0] });
  expect(genericActivations).to.equal(0);
});

it("uses real configurable headings and native lists for warnings and evidence", async () => {
  const el = (await fixture(
    html`<lr-grounding-summary heading-level="2"></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  el.assessment = ASSESSMENT;
  el.citations = CITATIONS;
  await el.updateComplete;

  expect(
    el.shadowRoot!.querySelector('[part="warnings-heading"]')!.tagName
  ).to.equal("H2");
  expect(
    el.shadowRoot!.querySelector('[part="evidence-heading"]')!.tagName
  ).to.equal("H2");
  expect(
    el.shadowRoot!.querySelector('[part="warnings-list"]')!.tagName
  ).to.equal("UL");
  expect(
    el.shadowRoot!.querySelector('[part="evidence-list"]')!.tagName
  ).to.equal("UL");
  expect(
    el.shadowRoot!.querySelector('[part="evidence-list"]')!.getAttribute('role')
  ).to.equal('list');
  expect(
    [...el.shadowRoot!.querySelectorAll('[part="warning"]')].every(
      (item) => item.tagName === "LI"
    )
  ).to.equal(true);
  expect(
    [...el.shadowRoot!.querySelectorAll('[part="evidence-item"]')].every(
      (item) => item.tagName === "LI"
    )
  ).to.equal(true);

  el.headingLevel = 'outside-range' as LyraGroundingSummary['headingLevel'];
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="warnings-heading"]')!.tagName
  ).to.equal('H3');
});

it('supports the shared \'none\' heading-level opt-out, rendering no heading semantics', async () => {
  const el = (await fixture(
    html`<lr-grounding-summary heading-level="none"></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  el.assessment = ASSESSMENT;
  el.citations = CITATIONS;
  await el.updateComplete;

  const warningsHeading = el.shadowRoot!.querySelector(
    '[part="warnings-heading"]'
  )!;
  const evidenceHeading = el.shadowRoot!.querySelector(
    '[part="evidence-heading"]'
  )!;
  expect(warningsHeading.tagName).to.not.match(/^H[1-6]$/);
  expect(evidenceHeading.tagName).to.not.match(/^H[1-6]$/);
  expect(warningsHeading.getAttribute('role')).to.equal(null);
  expect(evidenceHeading.getAttribute('role')).to.equal(null);
});

it("names the inner group from label or the localized default without duplicating a host name", async () => {
  const withDefault = (await fixture(
    html`<lr-grounding-summary></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  expect(
    withDefault
      .shadowRoot!.querySelector('[part="base"]')!
      .getAttribute("aria-label")
  ).to.equal("Grounding summary");

  const withLabel = (await fixture(
    html`<lr-grounding-summary label="Answer grounding"></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  expect(
    withLabel
      .shadowRoot!.querySelector('[part="base"]')!
      .getAttribute("aria-label")
  ).to.equal("Answer grounding");

  const withAria = (await fixture(
    html`<lr-grounding-summary
      aria-label="Custom"
      label="Answer grounding"
    ></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  expect(
    withAria
      .shadowRoot!.querySelector('[part="base"]')!
      .getAttribute("aria-label")
  ).to.equal(null);
  expect(withAria.getAttribute("aria-label")).to.equal("Custom");
});

it("keeps exactly one overall owner across explicit-empty and dynamic host naming", async () => {
  const el = (await fixture(
    html`<lr-grounding-summary
      label="Answer grounding"
      aria-label=""
    ></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  const group = () =>
    el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;

  expect(el.hasAttribute("aria-label")).to.equal(true);
  expect(el.getAttribute("aria-label")).to.equal("");
  expect(group().getAttribute("aria-label")).to.equal("");
  expect(group().getAttribute("role")).to.equal("group");

  el.setAttribute("aria-label", "Author grounding");
  await el.updateComplete;
  expect(el.getAttribute("aria-label")).to.equal("Author grounding");
  expect(group().getAttribute("aria-label")).to.equal(null);
  expect(group().getAttribute("role")).to.equal(null);

  el.removeAttribute("aria-label");
  await el.updateComplete;
  expect(el.getAttribute("aria-label")).to.equal(null);
  expect(group().getAttribute("aria-label")).to.equal("Answer grounding");
  expect(group().getAttribute("role")).to.equal("group");
});

describe("localization", () => {
  it("localizes the empty-state heading via .strings overriding groundingSummaryEmpty", async () => {
    const el = (await fixture(
      html`<lr-grounding-summary
        .strings=${{ groundingSummaryEmpty: "Rien à afficher" }}
      ></lr-grounding-summary>`
    )) as LyraGroundingSummary;
    expect(
      el.shadowRoot!.querySelector("lr-empty")!.getAttribute("heading")
    ).to.equal("Rien à afficher");
  });

  it("localizes stat labels via .strings overriding groundingSummarySupportedLabel/groundingSummaryUnsupportedLabel/groundingSummaryCoverageLabel", async () => {
    const el = (await fixture(html`
      <lr-grounding-summary
        .strings=${{
          groundingSummarySupportedLabel: "Réclamations étayées",
          groundingSummaryUnsupportedLabel: "Réclamations non étayées",
          groundingSummaryCoverageLabel: "Couverture des citations",
        }}
      ></lr-grounding-summary>
    `)) as LyraGroundingSummary;
    el.assessment = { supportedClaims: 1, unsupportedClaims: 0, coverage: 1 };
    await el.updateComplete;
    const rows = stats(el);
    expect(rows[0]!.getAttribute("label")).to.equal("Réclamations étayées");
    expect(rows[1]!.getAttribute("label")).to.equal("Réclamations non étayées");
    expect(rows[2]!.getAttribute("label")).to.equal("Couverture des citations");
  });

  it("localizes the warnings heading via .strings overriding groundingSummaryWarningsHeading", async () => {
    const el = (await fixture(
      html`<lr-grounding-summary
        .strings=${{ groundingSummaryWarningsHeading: "Avertissements" }}
      ></lr-grounding-summary>`
    )) as LyraGroundingSummary;
    el.assessment = ASSESSMENT;
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="warnings-heading"]')!.textContent
    ).to.equal("Avertissements");
  });

  it("localizes the evidence span template via .strings overriding groundingSummaryEvidenceSpan, reordering its placeholders", async () => {
    const el = (await fixture(
      html`<lr-grounding-summary
        .strings=${{ groundingSummaryEvidenceSpan: "{end}–{start} sipnoc" }}
      ></lr-grounding-summary>`
    )) as LyraGroundingSummary;
    el.assessment = ASSESSMENT;
    el.citations = CITATIONS;
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="evidence-span"]')!.textContent
    ).to.equal("42–0 sipnoc");
  });
});

it("is accessible in the empty state", async () => {
  const el = (await fixture(
    html`<lr-grounding-summary></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  await expect(el).to.be.accessible();
});

it("is accessible fully populated with stats, warnings, and evidence", async () => {
  const el = (await fixture(
    html`<lr-grounding-summary></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  el.assessment = ASSESSMENT;
  el.citations = CITATIONS;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('renders correctly under dir="rtl" fully populated, with no leftover physical-side styling assumptions', async () => {
  const el = (await fixture(
    html`<lr-grounding-summary dir="rtl"></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  el.assessment = ASSESSMENT;
  el.citations = CITATIONS;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;
  expect(el.shadowRoot!.querySelectorAll("lr-stat").length).to.equal(4);
  expect(el.shadowRoot!.querySelectorAll("lr-citation-badge").length).to.equal(
    2
  );
  await expect(el).to.be.accessible();
});

it("can shrink to a 320px allocation fully populated", async () => {
  const wrapper = await fixture(html`
    <div style="display: flex; inline-size: 320px;">
      <lr-grounding-summary></lr-grounding-summary>
    </div>
  `);
  const el = wrapper.querySelector(
    "lr-grounding-summary"
  ) as LyraGroundingSummary;
  el.assessment = ASSESSMENT;
  el.citations = CITATIONS;
  await el.updateComplete;

  expect(getComputedStyle(el).minInlineSize).to.equal("0px");
  expect(el.getBoundingClientRect().width).to.be.at.most(320);
});

it("formats the evidence span offsets with the effective locale, not as raw JavaScript numbers", async () => {
  const el = (await fixture(
    html`<lr-grounding-summary lang="ar-u-nu-arab"></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  el.assessment = ASSESSMENT;
  el.citations = [
    { id: "cite-1", sourceId: "doc-1", span: { start: 0, end: 1234 } },
  ];
  await el.updateComplete;

  const spanText =
    el.shadowRoot!.querySelector('[part="evidence-span"]')!.textContent ?? "";
  expect(spanText, "the offsets use the locale digit system").to.include(
    "١٬٢٣٤"
  );
  expect(spanText).to.include("٠");
  expect(
    spanText.includes("1234"),
    "no raw Latin-digit offset survives"
  ).to.equal(false);
});

it('accepts the plain show-claims="false" attribute form, not only a JS property assignment', async () => {
  const el = (await fixture(
    html`<lr-grounding-summary show-claims="false"></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  expect(el.showClaims).to.equal(false);

  el.assessment = {
    supportedClaims: 1,
    unsupportedClaims: 0,
    coverage: 1,
    claims: [
      {
        id: "claim-1",
        text: "A supported claim",
        status: "supported",
        citationIds: ["cite-1"],
      },
    ],
  };
  el.citations = CITATIONS;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll("lr-claim-evidence").length).to.equal(
    0
  );
});

it("formats warning and evidence counts with the effective locale", async () => {
  const el = (await fixture(
    html`<lr-grounding-summary lang="ar-u-nu-arab"></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  el.assessment = {
    ...ASSESSMENT,
    warnings: Array.from({ length: 12 }, () => "Warning"),
  };
  el.citations = Array.from({ length: 12 }, (_, index) => ({
    id: `citation-${index}`,
    sourceId: "source",
  }));
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="warnings-count"]')!.textContent
  ).to.equal("١٢");
  expect(
    el.shadowRoot!.querySelector('[part="evidence-count"]')!.textContent
  ).to.equal("١٢");
});

it('omits blank and later duplicate claim and citation ids before composition, counts, and events', async () => {
  const firstClaim = {
    id: 'claim-1',
    text: 'First claim',
    status: 'supported' as const,
    citationIds: ['citation-1'],
  };
  const firstCitation: Citation = {
    id: 'citation-1',
    sourceId: 'source-1',
    label: 'First citation',
  };
  const el = (await fixture(
    html`<lr-grounding-summary></lr-grounding-summary>`
  )) as LyraGroundingSummary;
  el.assessment = {
    supportedClaims: 1,
    unsupportedClaims: 0,
    coverage: 1,
    claims: [
      { ...firstClaim, id: ' ' },
      firstClaim,
      { ...firstClaim, text: 'Later duplicate' },
    ],
  };
  el.citations = [
    { ...firstCitation, id: '' },
    firstCitation,
    { ...firstCitation, label: 'Later duplicate' },
  ];
  await el.updateComplete;

  const claims = el.shadowRoot!.querySelector('lr-claim-evidence') as
    | (HTMLElement & {
        claims: readonly unknown[];
        citations: readonly unknown[];
        updateComplete: Promise<unknown>;
      })
    | null;
  expect(claims).to.exist;
  expect(claims!.claims).to.deep.equal([firstClaim]);
  expect(claims!.citations).to.deep.equal([firstCitation]);
  expect(
    el.shadowRoot!.querySelector('[part="evidence-count"]')!.textContent
  ).to.equal('1');
  expect(
    el.shadowRoot!.querySelectorAll('[part="evidence-item"]').length
  ).to.equal(1);

  const selected = oneEvent(el, 'lr-citation-select');
  el.shadowRoot!.querySelector<HTMLElement>('lr-citation-badge')!.dispatchEvent(
    new CustomEvent('lr-citation-activate', {
      bubbles: true,
      composed: true,
      detail: { index: 1, sourceId: 'source-1' },
    })
  );
  expect((await selected).detail).to.deep.equal({ citation: firstCitation });
});
