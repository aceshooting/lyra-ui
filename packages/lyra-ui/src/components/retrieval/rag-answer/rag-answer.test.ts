import { aTimeout, fixture, expect, html, oneEvent } from "@open-wc/testing";
import "./rag-answer.js";
import type { LyraRagAnswer } from "./rag-answer.class.js";
import type { LyraSourceCard } from "../source-card/source-card.class.js";
import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';

// Removed-attribute regression tests below deliberately author these; see the helper.
expectStaleAttribute('lr-rag-answer', 'error');
describe("lr-rag-answer", () => {
  it("renders answer evidence and sources", async () => {
    const el = (await fixture(
      html`<lr-rag-answer
        .strings=${{ ragAnswerLabel: "Answer" }}
        answer="Answer"
        .citations=${[{ id: "c1", sourceId: "d1" }]}
        .sources=${[{ id: "d1", name: "guide.md", mimeType: "text/markdown" }]}
        .assessment=${{ supportedClaims: 1, unsupportedClaims: 0, coverage: 1 }}
      ></lr-rag-answer>`
    )) as LyraRagAnswer;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("lr-markdown")).to.exist;
    const grounding = el.shadowRoot!.querySelector(
      "lr-grounding-summary"
    ) as HTMLElement & {
      updateComplete: Promise<unknown>;
      shadowRoot: ShadowRoot;
    };
    await grounding.updateComplete;
    expect(
      el.shadowRoot!.querySelectorAll(":scope > article > lr-citation-badge")
        .length
    ).to.equal(0);
    expect(
      grounding.shadowRoot.querySelectorAll("lr-citation-badge").length
    ).to.equal(1);
    const sourceList = el.shadowRoot!.querySelector("lr-source-list");
    expect(Boolean(sourceList)).to.be.true;
    const sourceCard = sourceList!.querySelector(
      "lr-source-card"
    ) as LyraSourceCard;
    await sourceCard.updateComplete;
    const chrome = getComputedStyle(
      sourceCard.shadowRoot!.querySelector('[part="base"]') as HTMLElement
    );
    expect(sourceCard.frame).to.equal("plain");
    expect(sourceCard.textContent).to.contain("text/markdown");
    expect(chrome.borderTopWidth).to.equal("0px");
    expect(chrome.backgroundColor).to.equal("rgba(0, 0, 0, 0)");
    expect(chrome.paddingTop).to.equal("0px");
  });

  it("hides the sources section entirely when showSources is false, even with real sources data", async () => {
    const el = (await fixture(html`<lr-rag-answer
      answer="Answer"
      .citations=${[{ id: "c1", sourceId: "d1" }]}
      .sources=${[{ id: "d1", name: "guide.md" }]}
      .showSources=${false}
    ></lr-rag-answer>`)) as LyraRagAnswer;
    await el.updateComplete;
    expect(Boolean(el.shadowRoot!.querySelector('[part="sources"]'))).to.be
      .false;
  });

  it("renders per-instance strings overrides on every localized answer surface", async () => {
    const strings = {
      ragAnswerLabel: "Réponse étayée",
      ragAnswerRetry: "Réessayer la réponse",
      ragAnswerCitations: "Références",
      ragAnswerSources: "Documents",
    };
    const el = (await fixture(html`
      <lr-rag-answer
        error-text="Retrieval failed"
        .citations=${[{ id: "c1", sourceId: "d1" }]}
        .sources=${[{ id: "d1", name: "guide.md" }]}
        .strings=${strings}
      ></lr-rag-answer>
    `)) as LyraRagAnswer;
    const citations = el.shadowRoot!.querySelector(
      '[part="citations"]'
    ) as HTMLElement | null;
    const sources = el.shadowRoot!.querySelector(
      '[part="sources"]'
    ) as HTMLElement | null;
    const sourceList = el.shadowRoot!.querySelector("lr-source-list") as
      | (HTMLElement & { label: string; updateComplete: Promise<unknown> })
      | null;
    await sourceList?.updateComplete;

    expect(
      el.shadowRoot!.querySelector('[part="base"]')?.getAttribute("aria-label")
    ).to.equal("Réponse étayée");
    expect(
      el.shadowRoot!.querySelector('[part="retry"]')?.textContent?.trim()
    ).to.equal("Réessayer la réponse");
    expect(citations?.getAttribute("aria-label")).to.equal("Références");
    expect(
      citations?.querySelector('[part="section-heading"]')?.textContent?.trim()
    ).to.equal("Références");
    expect(sources?.getAttribute("aria-label")).to.equal("Documents");
    expect(
      sources?.querySelector('[part="section-heading"]')?.textContent?.trim()
    ).to.equal("Documents");
    expect(sourceList?.label).to.equal("Documents");

    el.errorText = "";
    el.loading = true;
    await el.updateComplete;
    const spinnerName = el
      .shadowRoot!.querySelector("lr-spinner")
      ?.shadowRoot?.querySelector('[role="progressbar"]')
      ?.getAttribute("aria-label");
    expect(
      el.shadowRoot!.querySelector('[part="base"]')?.getAttribute("aria-label")
    ).to.equal("Réponse étayée");
    expect(spinnerName).to.equal("Loading…");
  });

  it("renders a declarative sources slot without requiring a redundant sources property", async () => {
    const el = (await fixture(html`
      <lr-rag-answer answer="Answer">
        <div slot="sources" data-source>Custom source</div>
      </lr-rag-answer>
    `)) as LyraRagAnswer;
    await el.updateComplete;

    const sourceList = el.shadowRoot!.querySelector("lr-source-list");
    expect(Boolean(sourceList)).to.be.true;
    const slot = sourceList!.querySelector(
      'slot[name="sources"]'
    ) as HTMLSlotElement;
    expect(
      slot
        .assignedElements()
        .map((element) => element.getAttribute("data-source"))
    ).to.deep.equal([""]);
  });

  it("keeps a slotted answer visible while loading even when the answer property is empty", async () => {
    const el = (await fixture(html`
      <lr-rag-answer loading>
        <div slot="answer" data-answer>Partial answer</div>
      </lr-rag-answer>
    `)) as LyraRagAnswer;
    await el.updateComplete;

    expect(Boolean(el.shadowRoot!.querySelector('[part="answer"]'))).to.be.true;
    expect(Boolean(el.shadowRoot!.querySelector('[part="loading"]'))).to.be
      .true;
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-busy")
    ).to.equal("true");
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("data-state")
    ).to.equal("loading");
    const slot = el.shadowRoot!.querySelector(
      'slot[name="answer"]'
    ) as HTMLSlotElement;
    expect(
      slot
        .assignedElements()
        .map((element) => element.getAttribute("data-answer"))
    ).to.deep.equal([""]);
  });

  it("keeps a property answer, spinner, and truthful busy state together while streaming", async () => {
    const el = (await fixture(
      html`<lr-rag-answer
        loading
        answer="A partial property answer"
      ></lr-rag-answer>`
    )) as LyraRagAnswer;
    const article = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(article.getAttribute("data-state")).to.equal("loading");
    expect(article.getAttribute("aria-busy")).to.equal("true");
    expect(el.shadowRoot!.querySelector('[part="loading"]')).to.exist;
    expect(
      (
        el.shadowRoot!.querySelector("lr-markdown") as HTMLElement & {
          content: string;
        }
      ).content
    ).to.equal("A partial property answer");

    el.loading = false;
    await el.updateComplete;
    expect(article.getAttribute("data-state")).to.equal("answer");
    expect(article.getAttribute("aria-busy")).to.equal("false");
    expect(el.shadowRoot!.querySelector('[part="loading"]') === null).to.be.true;
  });

  it("detects a sources slot added after the initial render", async () => {
    const el = (await fixture(
      html`<lr-rag-answer answer="Answer"></lr-rag-answer>`
    )) as LyraRagAnswer;
    expect(Boolean(el.shadowRoot!.querySelector('[part="sources"]'))).to.be
      .false;

    const source = document.createElement("div");
    source.slot = "sources";
    source.textContent = "Late source";
    el.append(source);
    await aTimeout(0);
    await el.updateComplete;

    expect(Boolean(el.shadowRoot!.querySelector('[part="sources"]'))).to.be
      .true;
  });

  it('detects a direct child retargeted into the sources slot', async () => {
    const el = await fixture<LyraRagAnswer>(html`
      <lr-rag-answer answer="Answer"><div data-source>Retargeted source</div></lr-rag-answer>
    `);
    expect(Boolean(el.shadowRoot!.querySelector('[part="sources"]'))).to.equal(false);

    (el.querySelector('[data-source]') as HTMLElement).slot = 'sources';
    await Promise.resolve();
    await el.updateComplete;

    expect(Boolean(el.shadowRoot!.querySelector('[part="sources"]'))).to.equal(true);
  });

  it("settles generated and incremental sources across reconnect without a child change-in-update", async () => {
    const globalWarnings = (globalThis as { litIssuedWarnings?: Set<string> })
      .litIssuedWarnings;
    globalWarnings?.forEach((warning) => {
      if (warning.includes("scheduled an update"))
        globalWarnings.delete(warning);
    });
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) =>
      warnings.push(args.map(String).join(" "));
    try {
      const el = (await fixture(html`<lr-rag-answer
        answer="Answer"
        .sources=${[
          { id: "d1", name: "guide.md" },
          { id: "d2", name: "spec.md" },
        ]}
      ></lr-rag-answer>`)) as LyraRagAnswer;
      const sourceList = el.shadowRoot!.querySelector(
        "lr-source-list"
      ) as HTMLElement & {
        sourceCount: number;
        updateComplete: Promise<boolean>;
      };
      await sourceList.updateComplete;
      await aTimeout(0);
      expect(sourceList.sourceCount).to.equal(2);

      el.sources = [...el.sources, { id: "d3", name: "notes.md" }];
      await el.updateComplete;
      await sourceList.updateComplete;
      await aTimeout(0);
      expect(sourceList.sourceCount).to.equal(3);

      const fixtureParent = el.parentElement!;
      el.remove();
      expect(
        [...sourceList.children].map((child) => child.getAttribute("role"))
      ).to.deep.equal([null, null, null]);
      fixtureParent.append(el);
      await el.updateComplete;
      await aTimeout(0);
      expect(sourceList.sourceCount).to.equal(3);
      expect(
        [...sourceList.children].map((child) => child.getAttribute("role"))
      ).to.deep.equal(["listitem", "listitem", "listitem"]);
    } finally {
      console.warn = originalWarn;
    }

    expect(warnings.some((warning) => warning.includes("scheduled an update")))
      .to.be.false;
  });
  it("is accessible in loading and populated states", async () => {
    await expect(
      (await fixture(
        html`<lr-rag-answer loading></lr-rag-answer>`
      )) as LyraRagAnswer
    ).to.be.accessible();
    await expect(
      (await fixture(
        html`<lr-rag-answer answer="Answer"></lr-rag-answer>`
      )) as LyraRagAnswer
    ).to.be.accessible();
  });
  it("announces only new errors through an assertive light-DOM sink", async () => {
    const el = (await fixture(
      html`<lr-rag-answer error-text="Initial failure"></lr-rag-answer>`
    )) as LyraRagAnswer;
    const sink = () =>
      document.querySelector('[data-lr-live-region="assertive"]')!;
    const visibleError = el.shadowRoot!.querySelector('[part="error"]')!;
    expect(
      visibleError.getAttribute("role"),
      "the visible error is not a shadow live region"
    ).to.be.null;
    expect(
      sink().children.length,
      "initial content is not replayed as an announcement"
    ).to.equal(0);

    el.errorText = "A newer failure";
    await el.updateComplete;
    expect(sink().lastElementChild?.textContent).to.equal("A newer failure");

    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    expect(
      sink().children.length,
      "reconnect does not replay the current error"
    ).to.equal(0);
  });
  // 9.0.0 renamed `error` -> `errorText`/`error-text`, the spelling 25 other components (including
  // this one's own sibling `<lr-retrieval-search>`) already use for exactly this member.
  it("exposes caller-supplied failure text only as errorText; the removed `error` spelling is inert", async () => {
    const el = (await fixture(
      html`<lr-rag-answer error="Legacy failure"></lr-rag-answer>`
    )) as LyraRagAnswer;
    expect("error" in el).to.equal(false);
    expect(el.shadowRoot!.querySelectorAll('[part="error"]').length).to.equal(
      0
    );

    el.errorText = "Current failure";
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="error"]')?.textContent
    ).to.equal("Current failure");
  });
  it("keeps exactly one article owner while retaining the spinner's purpose name", async () => {
    const el = (await fixture(
      html`<lr-rag-answer loading label="Grounded response"></lr-rag-answer>`
    )) as LyraRagAnswer;
    const spinnerLabel = () =>
      el
        .shadowRoot!.querySelector("lr-spinner")!
        .shadowRoot!.querySelector('[role="progressbar"]')!
        .getAttribute("aria-label");

    expect(spinnerLabel()).to.equal("Loading…");
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-label")
    ).to.equal("Grounded response");
    el.setAttribute("aria-label", "Loading quarterly evidence");
    await el.updateComplete;
    expect(el.getAttribute("aria-label")).to.equal("Loading quarterly evidence");
    expect(spinnerLabel()).to.equal("Loading…");
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-label")
    ).to.equal(null);
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("role")
    ).to.equal("presentation");

    el.setAttribute("aria-label", "");
    await el.updateComplete;
    expect(el.getAttribute("aria-label")).to.equal("");
    expect(spinnerLabel()).to.equal("Loading…");
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-label")
    ).to.equal("");
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.getAttribute("role")
    ).to.equal("article");

    el.removeAttribute("aria-label");
    await el.updateComplete;
    expect(el.getAttribute("aria-label")).to.equal(null);
    expect(spinnerLabel()).to.equal("Loading…");
  });
  it("defaults to an unset label", async () => {
    const el = (await fixture(
      html`<lr-rag-answer></lr-rag-answer>`
    )) as LyraRagAnswer;
    expect(el.label).to.be.undefined;
  });
  it("keeps an explicitly empty label genuinely empty instead of falling back to the localized default", async () => {
    const el = (await fixture(
      html`<lr-rag-answer label="" answer="Answer"></lr-rag-answer>`
    )) as LyraRagAnswer;
    await el.updateComplete;
    expect(el.label).to.equal("");
    expect(
      el.shadowRoot!.querySelector('[part="base"]')?.getAttribute("aria-label")
    ).to.equal("");
  });
  it("forwards claim-level visibility to its grounding summary", async () => {
    const assessment = {
      supportedClaims: 1,
      unsupportedClaims: 0,
      coverage: 1,
      claims: [
        {
          id: "claim-1",
          text: "Supported",
          status: "supported" as const,
          citationIds: [],
        },
      ],
    };
    const el = (await fixture(
      html`<lr-rag-answer
        .assessment=${assessment}
        .showClaims=${false}
      ></lr-rag-answer>`
    )) as LyraRagAnswer;
    const summary = el.shadowRoot!.querySelector(
      "lr-grounding-summary"
    ) as HTMLElement & { showClaims: boolean };
    expect(summary.showClaims).to.be.false;
  });
  it("emits lr-retry from the underlying button click contract", async () => {
    const el = (await fixture(
      html`<lr-rag-answer error-text="Retrieval failed"></lr-rag-answer>`
    )) as LyraRagAnswer;
    const pending = oneEvent(el, "lr-retry");
    (el.shadowRoot!.querySelector('[part="retry"]') as HTMLElement)
      .shadowRoot!.querySelector("button")!
      .click();
    expect((await pending).type).to.equal("lr-retry");
  });

  it("re-emits an activated citation as lr-citation-select, and swallows the child event", async () => {
    const citations = [
      { id: "c1", sourceId: "d1", label: "First" },
      { id: "c2", sourceId: "d2", label: "Second" },
    ];
    const el = (await fixture(html`<lr-rag-answer
      answer="Answer"
      .citations=${citations}
      .sources=${[
        { id: "d1", name: "guide.md" },
        { id: "d2", name: "spec.md" },
      ]}
    ></lr-rag-answer>`)) as LyraRagAnswer;
    await el.updateComplete;
    const badges = [...el.shadowRoot!.querySelectorAll("lr-citation-badge")];
    expect(badges.length).to.equal(2);

    let leaked = 0;
    el.addEventListener("lr-citation-activate", () => leaked++);
    const pending = oneEvent(el, "lr-citation-select");
    // The badge's own index is 1-based, so index 2 resolves to citations[1].
    badges[1]!.dispatchEvent(
      new CustomEvent("lr-citation-activate", {
        detail: { index: 2 },
        bubbles: true,
        composed: true,
      })
    );
    const event = await pending;
    expect(
      event.detail as { citation: { id: string }; section: string }
    ).to.deep.equal({
      citation: citations[1],
      section: "answer",
    });
    expect(leaked, "the child's own event does not escape the host").to.equal(
      0
    );
  });

  it('contains and translates citation-open from answer and grounding badges', async () => {
    const citation = { id: 'c1', sourceId: 'd1', label: 'First' };
    const el = (await fixture(html`
      <lr-rag-answer
        answer='Answer'
        .citations=${[citation]}
        .sources=${[{ id: 'd1', name: 'guide.md' }]}
      ></lr-rag-answer>
    `)) as LyraRagAnswer;
    let leaked = 0;
    el.addEventListener('lr-citation-open', () => leaked++);
    const answerPending = oneEvent(el, 'lr-citation-select');
    el.shadowRoot!.querySelector('lr-citation-badge')!.dispatchEvent(
      new CustomEvent('lr-citation-open', {
        detail: { index: 1, sourceId: 'd1' },
        bubbles: true,
        composed: true,
      })
    );
    expect((await answerPending).detail).to.deep.equal({
      citation,
      section: 'answer',
    });
    expect(leaked).to.equal(0);

    el.assessment = {
      supportedClaims: 1,
      unsupportedClaims: 0,
      coverage: 1,
    };
    await el.updateComplete;
    const summary = el.shadowRoot!.querySelector('lr-grounding-summary') as
      | (HTMLElement & { updateComplete: Promise<unknown> })
      | null;
    await summary!.updateComplete;
    const groundingPending = oneEvent(el, 'lr-citation-select');
    summary!.dispatchEvent(
      new CustomEvent('lr-citation-open', {
        detail: { index: 1, sourceId: 'd1' },
        bubbles: true,
        composed: true,
      })
    );
    expect((await groundingPending).detail).to.deep.equal({
      citation,
      section: 'grounding',
    });
    expect(leaked).to.equal(0);
  });

  it("ignores an activation whose index falls outside the citation list", async () => {
    const el = (await fixture(html`<lr-rag-answer
      answer="Answer"
      .citations=${[{ id: "c1", sourceId: "d1" }]}
      .sources=${[{ id: "d1", name: "guide.md" }]}
    ></lr-rag-answer>`)) as LyraRagAnswer;
    await el.updateComplete;
    let selected = 0;
    el.addEventListener("lr-citation-select", () => selected++);
    el.shadowRoot!.querySelector("lr-citation-badge")!.dispatchEvent(
      new CustomEvent("lr-citation-activate", {
        detail: { index: 99 },
        bubbles: true,
        composed: true,
      })
    );
    await el.updateComplete;
    expect(selected).to.equal(0);
  });

  it("keeps one article owner across states and correlates grounding citation actions by section", async () => {
    const citation = { id: "c1", sourceId: "d1", label: "First" };
    const assessment = {
      supportedClaims: 1,
      unsupportedClaims: 0,
      coverage: 1,
    };
    const el = (await fixture(
      html`<lr-rag-answer
        label="Grounded response"
        .citations=${[citation]}
        .assessment=${assessment}
      ></lr-rag-answer>`
    )) as LyraRagAnswer;
    const initialArticle = el.shadowRoot!.querySelector('[part="base"]')!;
    expect(initialArticle.tagName).to.equal("ARTICLE");
    expect(
      el.shadowRoot!.querySelectorAll('[part="citations"]').length
    ).to.equal(0);

    const summary = el.shadowRoot!.querySelector(
      "lr-grounding-summary"
    ) as HTMLElement & {
      updateComplete: Promise<unknown>;
      shadowRoot: ShadowRoot;
    };
    await summary.updateComplete;
    const pending = oneEvent(el, "lr-citation-select");
    (
      summary.shadowRoot.querySelector("lr-citation-badge") as HTMLElement
    ).dispatchEvent(
      new CustomEvent("lr-citation-activate", {
        detail: { sourceId: "d1", index: 1 },
        bubbles: true,
        composed: true,
      })
    );
    expect((await pending).detail).to.deep.equal({
      citation,
      section: "grounding",
    });

    el.loading = true;
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="base"]') === initialArticle
    ).to.equal(true);
    expect(initialArticle.getAttribute("data-state")).to.equal("loading");

    el.errorText = "Failure";
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="base"]') === initialArticle
    ).to.equal(true);
    expect(initialArticle.getAttribute("data-state")).to.equal("error");
    expect(initialArticle.getAttribute("aria-busy")).to.equal("false");
    expect(el.shadowRoot!.querySelector('[part="loading"]') === null).to.be.true;
  });

  it("degrades to no slotted-content tracking instead of throwing in a realm without MutationObserver", () => {
    const el = document.createElement("lr-rag-answer") as LyraRagAnswer;
    const OriginalMutationObserver = window.MutationObserver;
    (
      window as unknown as { MutationObserver?: typeof MutationObserver }
    ).MutationObserver = undefined;
    try {
      expect(() => el.connectedCallback()).to.not.throw();
      const observer = (el as unknown as { slotObserver?: MutationObserver })
        .slotObserver;
      expect(
        observer === undefined,
        "no observer is armed without a constructor to build it from"
      ).to.equal(true);
    } finally {
      el.disconnectedCallback();
      window.MutationObserver = OriginalMutationObserver;
    }
  });

  it('omits blank and later duplicate citation, source, and nested claim ids before composition and actions', async () => {
    const firstCitation = { id: 'citation-1', sourceId: 'source-1' };
    const firstSource = { id: 'source-1', name: 'First source' };
    const firstClaim = {
      id: 'claim-1',
      text: 'First claim',
      status: 'supported' as const,
      citationIds: ['citation-1'],
    };
    const el = (await fixture(
      html`<lr-rag-answer answer="Answer"></lr-rag-answer>`
    )) as LyraRagAnswer;
    el.citations = [
      { ...firstCitation, id: ' ' },
      firstCitation,
      { ...firstCitation, sourceId: 'later-source' },
    ];
    el.sources = [
      { ...firstSource, id: '' },
      firstSource,
      { ...firstSource, name: 'Later source' },
    ];
    el.assessment = {
      supportedClaims: 1,
      unsupportedClaims: 0,
      coverage: 1,
      claims: [
        { ...firstClaim, id: '' },
        firstClaim,
        { ...firstClaim, text: 'Later claim' },
      ],
    };
    await el.updateComplete;

    const summary = el.shadowRoot!.querySelector('lr-grounding-summary') as
      | (HTMLElement & {
          assessment: { claims?: readonly unknown[] };
          citations: readonly unknown[];
          updateComplete: Promise<unknown>;
        })
      | null;
    expect(summary).to.exist;
    expect(summary!.assessment.claims).to.deep.equal([firstClaim]);
    expect(summary!.citations).to.deep.equal([firstCitation]);
    expect(el.shadowRoot!.querySelectorAll('lr-source-card').length).to.equal(1);

    el.assessment = null;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('lr-citation-badge').length).to.equal(1);
    const selected = oneEvent(el, 'lr-citation-select');
    el.shadowRoot!.querySelector<HTMLElement>('lr-citation-badge')!.dispatchEvent(
      new CustomEvent('lr-citation-activate', {
        bubbles: true,
        composed: true,
        detail: { index: 1 },
      })
    );
    expect((await selected).detail).to.deep.equal({
      citation: firstCitation,
      section: 'answer',
    });
  });
});
