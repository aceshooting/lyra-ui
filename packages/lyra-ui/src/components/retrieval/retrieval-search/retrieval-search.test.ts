import { fixture, expect, html, oneEvent } from "@open-wc/testing";
import "./retrieval-search.js";
import type { LyraRetrievalSearch } from "./retrieval-search.js";
import type { RetrievalQuery, CancelEventDetail } from "../../../ai/types.js";
import type { RetrievalFiltersChangeDetail } from "./retrieval-search.class.js";

function queryInputOf(el: LyraRetrievalSearch): HTMLElement {
  return el.shadowRoot!.querySelector('[part="query"]') as HTMLElement;
}

function modeOf(el: LyraRetrievalSearch): HTMLElement {
  return el.shadowRoot!.querySelector('[part="mode"]') as HTMLElement;
}

function submitButtonOf(el: LyraRetrievalSearch): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="submit"]') as HTMLButtonElement;
}

/**
 * A browser's real :hover/:active pseudo-classes track the physical pointer and cannot be forced
 * from a dispatched event, so a state rule's value is read off the shipped rule and then *painted*
 * on a probe inside the component's own shadow root. Every assertion below is on the rendered
 * result of that paint -- the custom properties resolve exactly as they do in production -- never on
 * stylesheet text.
 */
function declaredValue(
  root: ShadowRoot,
  selector: string,
  property: string
): string {
  const normalize = (text: string) =>
    text.replace(/"/g, "'").replace(/\s+/g, " ").trim();
  for (const sheet of root.adoptedStyleSheets ?? []) {
    for (const rule of sheet.cssRules) {
      if (
        rule instanceof CSSStyleRule &&
        normalize(rule.selectorText) === normalize(selector)
      ) {
        const value = rule.style.getPropertyValue(property);
        if (value) return value;
      }
    }
  }
  return "";
}

function declaredBackground(root: ShadowRoot, selector: string): string {
  return (
    declaredValue(root, selector, "background") ||
    declaredValue(root, selector, "background-color")
  );
}

function paintProbe(root: ShadowRoot) {
  const measure = (
    apply: (probe: HTMLElement) => void,
    read: (style: CSSStyleDeclaration) => string
  ) => {
    const probe = document.createElement("span");
    apply(probe);
    root.appendChild(probe);
    const computed = read(getComputedStyle(probe));
    probe.remove();
    return computed;
  };
  return {
    /* The zero-percent wrapper forces resting, hovered and pressed through one serialization, so the
       channel distances compared in the tests are apples-to-apples even though the resting value is
       a plain token and the two state values are mixes. */
    render: (value: string) =>
      measure(
        (probe) =>
          (probe.style.backgroundColor = `color-mix(in oklab, ${value}, transparent 0%)`),
        (style) => style.backgroundColor
      ),
    renderFilter: (value: string) =>
      measure(
        (probe) => (probe.style.filter = value),
        (style) => style.filter
      ),
  };
}

function channelDistance(left: string, right: string): number {
  const channels = (color: string) =>
    (color.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const a = channels(left);
  const b = channels(right);
  return Math.hypot(...a.map((value, index) => value - (b[index] ?? 0)));
}

function enterKeydown(init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key: "Enter",
    bubbles: true,
    cancelable: true,
    ...init,
  });
}

it("defaults to an empty query, hybrid mode, no filters/scope, not loading, no error, not empty", async () => {
  const el = (await fixture(
    html`<lr-retrieval-search></lr-retrieval-search>`
  )) as LyraRetrievalSearch;
  expect(el.query).to.equal("");
  expect(el.mode).to.equal("hybrid");
  expect(el.filters).to.deep.equal({});
  expect(el.scope).to.deep.equal([]);
  expect(el.loading).to.be.false;
  expect(el.errorText).to.equal("");
  expect(el.empty).to.be.false;
});

it("renders a query lr-input, a 3-item vector/keyword/hybrid mode segmented, and a submit button", async () => {
  const el = (await fixture(
    html`<lr-retrieval-search></lr-retrieval-search>`
  )) as LyraRetrievalSearch;
  expect(queryInputOf(el).tagName.toLowerCase()).to.equal("lr-input");
  const segmented = modeOf(el) as HTMLElement & {
    items: { value: string; label: string }[];
  };
  expect(segmented.tagName.toLowerCase()).to.equal("lr-segmented");
  expect(segmented.items.map((i) => i.value)).to.deep.equal([
    "vector",
    "keyword",
    "hybrid",
  ]);
  expect(submitButtonOf(el) != null).to.equal(true);
});

it("updates query as the composed lr-input reports user edits", async () => {
  const el = (await fixture(
    html`<lr-retrieval-search></lr-retrieval-search>`
  )) as LyraRetrievalSearch;
  queryInputOf(el).dispatchEvent(
    new CustomEvent("lr-input", {
      detail: { value: "solar inverter faults" },
      bubbles: true,
    })
  );
  await el.updateComplete;
  expect(el.query).to.equal("solar inverter faults");
});

it("suppresses raw child input and mode-change events after consuming them", async () => {
  const el = (await fixture(
    html`<lr-retrieval-search></lr-retrieval-search>`
  )) as LyraRetrievalSearch;
  let inputLeaks = 0;
  let changeLeaks = 0;
  el.addEventListener("lr-input", () => inputLeaks++);
  el.addEventListener("lr-change", () => changeLeaks++);
  queryInputOf(el).dispatchEvent(
    new CustomEvent("lr-input", {
      detail: { value: "solar" },
      bubbles: true,
      composed: true,
    })
  );
  modeOf(el).dispatchEvent(
    new CustomEvent("lr-change", {
      detail: { value: "vector" },
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  expect(inputLeaks).to.equal(0);
  expect(changeLeaks).to.equal(0);
});

it("updates mode as the composed lr-segmented reports a change", async () => {
  const el = (await fixture(
    html`<lr-retrieval-search></lr-retrieval-search>`
  )) as LyraRetrievalSearch;
  modeOf(el).dispatchEvent(
    new CustomEvent("lr-change", { detail: { value: "vector" }, bubbles: true })
  );
  await el.updateComplete;
  expect(el.mode).to.equal("vector");
});

it("Enter in the query field submits, emitting lr-search with the full RetrievalQuery", async () => {
  const el = (await fixture(
    html`<lr-retrieval-search></lr-retrieval-search>`
  )) as LyraRetrievalSearch;
  el.query = "panel degradation";
  el.mode = "keyword";
  el.filters = { type: "pdf" };
  el.scope = ["engineering-docs"];
  await el.updateComplete;

  const listener = oneEvent(el, "lr-search");
  queryInputOf(el).dispatchEvent(enterKeydown());
  const ev = await listener;
  expect(ev.detail).to.deep.equal({
    text: "panel degradation",
    mode: "keyword",
    filters: { type: "pdf" },
    scope: ["engineering-docs"],
  } satisfies RetrievalQuery);
});

it("clicking the submit button while idle also submits", async () => {
  const el = (await fixture(
    html`<lr-retrieval-search query="inverter trip"></lr-retrieval-search>`
  )) as LyraRetrievalSearch;
  const listener = oneEvent(el, "lr-search");
  submitButtonOf(el).click();
  const ev = await listener;
  expect((ev.detail as RetrievalQuery).text).to.equal("inverter trip");
});

it("never treats an IME composition Enter as a submit trigger (isComposing)", async () => {
  const el = (await fixture(
    html`<lr-retrieval-search></lr-retrieval-search>`
  )) as LyraRetrievalSearch;
  let submitted = false;
  el.addEventListener("lr-search", () => (submitted = true));
  queryInputOf(el).dispatchEvent(enterKeydown({ isComposing: true }));
  await el.updateComplete;
  expect(submitted).to.be.false;
});

it("never treats an IME composition Enter as a submit trigger (keyCode 229 fallback)", async () => {
  const el = (await fixture(
    html`<lr-retrieval-search></lr-retrieval-search>`
  )) as LyraRetrievalSearch;
  let submitted = false;
  el.addEventListener("lr-search", () => (submitted = true));
  const ev = enterKeydown();
  Object.defineProperty(ev, "keyCode", { value: 229 });
  queryInputOf(el).dispatchEvent(ev);
  await el.updateComplete;
  expect(submitted).to.be.false;
});

describe("loading / cancellation", () => {
  it("renders a Cancel affordance instead of Search while loading", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    expect(submitButtonOf(el).textContent!.trim()).to.equal("Search");
    el.loading = true;
    await el.updateComplete;
    expect(submitButtonOf(el).textContent!.trim()).to.equal("Cancel");
  });

  it("clicking Cancel while loading emits only lr-cancel, never lr-search", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search loading></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    let searched = false;
    el.addEventListener("lr-search", () => (searched = true));
    const listener = oneEvent(el, "lr-cancel");
    submitButtonOf(el).click();
    const ev = await listener;
    expect((ev.detail as CancelEventDetail).reason).to.be.undefined;
    expect(searched).to.be.false;
  });

  it("submitting again (Enter) while loading supersedes: emits lr-cancel then lr-search", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search loading query="first"></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    const cancelPromise = oneEvent(el, "lr-cancel");
    const searchPromise = oneEvent(el, "lr-search");
    el.query = "second";
    await el.updateComplete;
    queryInputOf(el).dispatchEvent(enterKeydown());
    const [cancelEv, searchEv] = await Promise.all([
      cancelPromise,
      searchPromise,
    ]);
    expect((cancelEv.detail as CancelEventDetail).reason).to.equal(
      "superseded"
    );
    expect((searchEv.detail as RetrievalQuery).text).to.equal("second");
  });
});

describe("active filters/scope chips", () => {
  it("renders no chip-group when there are no filters and no scope", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    expect(el.shadowRoot!.querySelector('[part="filters"]') == null).to.be.true;
  });

  it("renders removable chips for scope entries and filter entries", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    el.scope = ["engineering-docs"];
    el.filters = { type: "pdf" };
    await el.updateComplete;
    const chips = Array.from(
      el.shadowRoot!.querySelectorAll('[part="filters"] lr-chip')
    );
    expect(chips.length).to.equal(2);
    const scopeChip = el.shadowRoot!.querySelector(
      '[part="filters"] lr-chip[value="engineering-docs"]'
    )!;
    expect(scopeChip.textContent!.trim()).to.equal("engineering-docs");
    const filterChip = el.shadowRoot!.querySelector(
      '[part="filters"] lr-chip[value="type"]'
    )!;
    expect(filterChip.textContent!.trim()).to.equal("type: pdf");
  });

  it("removing a scope chip updates scope and emits lr-filters-change with the full next state", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    el.scope = ["engineering-docs", "support-tickets"];
    el.filters = { type: "pdf" };
    await el.updateComplete;
    const chip = el.shadowRoot!.querySelector(
      '[part="filters"] lr-chip[value="engineering-docs"]'
    )!;
    const listener = oneEvent(el, "lr-filters-change");
    chip.dispatchEvent(
      new CustomEvent("lr-remove", {
        detail: { value: "engineering-docs" },
        bubbles: true,
      })
    );
    const ev = await listener;
    expect(el.scope).to.deep.equal(["support-tickets"]);
    expect(ev.detail as RetrievalFiltersChangeDetail).to.deep.equal({
      filters: { type: "pdf" },
      scope: ["support-tickets"],
    });
  });

  it("removing a filter chip updates filters and emits lr-filters-change", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    el.scope = ["engineering-docs"];
    el.filters = { type: "pdf", year: 2025 };
    await el.updateComplete;
    const chip = el.shadowRoot!.querySelector(
      '[part="filters"] lr-chip[value="type"]'
    )!;
    const listener = oneEvent(el, "lr-filters-change");
    chip.dispatchEvent(
      new CustomEvent("lr-remove", { detail: { value: "type" }, bubbles: true })
    );
    const ev = await listener;
    expect(el.filters).to.deep.equal({ year: 2025 });
    expect(ev.detail as RetrievalFiltersChangeDetail).to.deep.equal({
      filters: { year: 2025 },
      scope: ["engineering-docs"],
    });
  });

  it("moves focus to the next surviving chip after keyboard removal", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    el.scope = ["first", "second", "third"];
    await el.updateComplete;
    const chip = el.shadowRoot!.querySelector(
      'lr-chip[value="second"]'
    ) as HTMLElement;
    chip.focus();

    (
      chip.shadowRoot!.querySelector(
        '[part="remove-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;

    expect(el.shadowRoot!.activeElement?.localName).to.equal("lr-chip");
    expect(el.shadowRoot!.activeElement?.getAttribute("value")).to.equal(
      "third"
    );
  });

  it("moves focus to the query field after removing the last chip", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    el.scope = ["only"];
    await el.updateComplete;
    const chip = el.shadowRoot!.querySelector(
      'lr-chip[value="only"]'
    ) as HTMLElement;
    chip.focus();

    (
      chip.shadowRoot!.querySelector(
        '[part="remove-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;

    expect(el.shadowRoot!.activeElement?.localName).to.equal("lr-input");
    expect(queryInputOf(el).shadowRoot?.activeElement?.localName).to.equal(
      "input"
    );
  });

  it("formats a non-string filter value for its chip label", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    el.filters = { verified: true, tags: ["solar", "inverter"] };
    await el.updateComplete;
    const verifiedChip = el.shadowRoot!.querySelector(
      '[part="filters"] lr-chip[value="verified"]'
    )!;
    expect(verifiedChip.textContent!.trim()).to.equal("verified: true");
    const tagsChip = el.shadowRoot!.querySelector(
      '[part="filters"] lr-chip[value="tags"]'
    )!;
    expect(tagsChip.textContent!.trim()).to.equal("tags: solar and inverter");
  });

  it("formats numeric and list filter values with the effective locale", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search lang="ar-u-nu-arab"></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    el.filters = { year: 2025, pages: [1, 2] };
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('lr-chip[value="year"]')!.textContent
    ).to.include("٢٬٠٢٥");
    expect(
      el.shadowRoot!.querySelector('lr-chip[value="pages"]')!.textContent
    ).to.include("١ و٢");
  });

  it("normalizes non-finite numeric filter values before Intl formatting", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    el.filters = { score: Number.NaN, distance: Number.POSITIVE_INFINITY };
    await el.updateComplete;

    expect(
      el.shadowRoot!.querySelector('lr-chip[value="score"]')!.textContent
    ).to.include("score: 0");
    expect(
      el.shadowRoot!.querySelector('lr-chip[value="distance"]')!.textContent
    ).to.include("distance: 0");
  });

  it("formats cyclic, deeply nested, and wide filter values within deterministic bounds", async () => {
    const cycle: Record<string, unknown> = { label: "cycle" };
    cycle.self = cycle;
    let deep: unknown = "leaf";
    for (let index = 0; index < 20; index++) deep = { child: deep };
    const wide = Array.from({ length: 80 }, (_, index) => index);
    const el = (await fixture(
      html`<lr-retrieval-search
        .strings=${{ valueInvalid: "Invalid filter value" }}
      ></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    el.filters = { cycle, deep, wide, long: "x".repeat(400) };
    await el.updateComplete;

    const labels = new Map(
      [
        ...el.shadowRoot!.querySelectorAll<HTMLElement>(
          '[part="filters"] lr-chip'
        ),
      ].map((chip) => [
        chip.getAttribute("value"),
        chip.textContent?.trim() ?? "",
      ])
    );
    expect(labels.get("cycle")).to.include("Invalid filter value");
    expect(labels.get("deep")).to.include("Invalid filter value");
    expect(labels.get("wide")).to.include("Invalid filter value");
    expect(labels.get("long")!.length).to.be.lessThan(300);
    expect(
      [...labels.values()].every((label) => label.length < 1_000)
    ).to.equal(true);

    const first = [...labels.values()];
    el.requestUpdate();
    await el.updateComplete;
    const second = [
      ...el.shadowRoot!.querySelectorAll<HTMLElement>(
        '[part="filters"] lr-chip'
      ),
    ].map((chip) => chip.textContent?.trim() ?? "");
    expect(second).to.deep.equal(first);
  });

  it("suppresses a raw child remove event after consuming it", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    el.scope = ["engineering-docs"];
    await el.updateComplete;
    let leaked = 0;
    el.addEventListener("lr-remove", () => leaked++);
    el.shadowRoot!.querySelector(
      'lr-chip[value="engineering-docs"]'
    )!.dispatchEvent(
      new CustomEvent("lr-remove", {
        detail: { value: "engineering-docs" },
        bubbles: true,
        composed: true,
      })
    );
    await el.updateComplete;
    expect(leaked).to.equal(0);
  });
});

describe("loading / error / empty status region", () => {
  it("keeps explicit-empty and dynamic host naming distinct from the spinner", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search
        loading
        label="Knowledge search"
      ></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    const spinner = el.shadowRoot!.querySelector(
      '[part="spinner"]'
    ) as HTMLElement & {
      updateComplete: Promise<boolean>;
      shadowRoot: ShadowRoot;
    };
    const spinnerLabel = () =>
      spinner.shadowRoot
        .querySelector('[role="progressbar"]')!
        .getAttribute("aria-label");

    expect(spinner != null).to.be.true;
    expect(spinnerLabel()).to.equal("Loading…");
    expect(el.shadowRoot!.querySelector('[part="error"]') == null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="empty"]') == null).to.be.true;

    el.setAttribute("aria-label", "Loading support knowledge");
    await el.updateComplete;
    await spinner.updateComplete;
    expect(el.getAttribute("aria-label")).to.equal("Loading support knowledge");
    expect(spinnerLabel()).to.equal("Loading…");

    el.setAttribute("aria-label", "");
    await el.updateComplete;
    await spinner.updateComplete;
    expect(el.getAttribute("aria-label")).to.equal("");
    expect(spinnerLabel()).to.equal("Loading…");

    el.removeAttribute("aria-label");
    await el.updateComplete;
    await spinner.updateComplete;
    expect(el.getAttribute("aria-label")).to.equal(null);
    expect(spinnerLabel()).to.equal("Loading…");
  });

  it("shows errors neutrally and announces only later failures from light DOM", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search
        error-text="The retrieval service timed out."
      ></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    const error = el.shadowRoot!.querySelector('[part="error"]')!;
    expect(error.getAttribute("role")).to.be.null;
    expect(error.textContent!.trim()).to.equal(
      "The retrieval service timed out."
    );
    const sink = () =>
      document.querySelector('[data-lr-live-region="assertive"]')!;
    expect(
      sink().children.length,
      "initial content is not replayed as an announcement"
    ).to.equal(0);

    el.errorText = "The retry also failed.";
    await el.updateComplete;
    expect(sink().lastElementChild?.textContent).to.equal(
      "The retry also failed."
    );

    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    expect(
      sink().children.length,
      "reconnect does not replay the current error"
    ).to.equal(0);
  });

  it("shows a compact lr-empty when empty is true and there is no error/loading", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search empty></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    const empty = el.shadowRoot!.querySelector('[part="empty"]')!;
    expect(empty != null).to.equal(true);
    expect(empty.tagName.toLowerCase()).to.equal("lr-empty");
  });

  it("prioritizes loading over error and empty", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search
        loading
        error-text="stale error"
        empty
      ></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    expect(el.shadowRoot!.querySelector('[part="spinner"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="error"]') == null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="empty"]') == null).to.be.true;
  });

  it("prioritizes error over empty", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search
        error-text="failed"
        empty
      ></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part="empty"]') == null).to.be.true;
  });
});

describe("accessible naming", () => {
  it('keeps the host as the sole overall owner when it has a non-empty name', async () => {
    const el1 = (await fixture(
      html`<lr-retrieval-search></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    const base1 = el1.shadowRoot!.querySelector('[part="base"]')!;
    expect(base1.getAttribute("role")).to.equal("search");
    expect(base1.getAttribute("aria-label")).to.equal("Retrieval search");

    const el2 = (await fixture(
      html`<lr-retrieval-search
        label="Knowledge base search"
      ></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    expect(
      el2.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-label")
    ).to.equal("Knowledge base search");
    expect(
      el2.shadowRoot!.querySelector('[part="base"]')!.getAttribute("role")
    ).to.equal("search");

    const el3 = (await fixture(
      html`<lr-retrieval-search
        label="Knowledge base search"
        aria-label="Support search"
      ></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    expect(
      el3.shadowRoot!.querySelector('[part="base"]')!.getAttribute("aria-label")
    ).to.equal(null);
    expect(
      el3.shadowRoot!.querySelector('[part="base"]')!.getAttribute("role")
    ).to.equal(null);
    expect(el3.getAttribute("aria-label")).to.equal("Support search");
  });
});

describe("localization", () => {
  it("resolves the mode segmented labels and submit/cancel button text through this.strings overrides", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search
        loading
        .strings=${{
          retrievalModeVector: "Vecteur",
          retrievalModeKeyword: "Mot-clé",
          retrievalModeHybrid: "Hybride",
          cancel: "Annuler",
        }}
      ></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    const segmented = modeOf(el) as HTMLElement & {
      items: { value: string; label: string }[];
    };
    expect(segmented.items.map((i) => i.label)).to.deep.equal([
      "Vecteur",
      "Mot-clé",
      "Hybride",
    ]);
    expect(submitButtonOf(el).textContent!.trim()).to.equal("Annuler");
  });

  it("resolves the filter-chip label template and empty description through this.strings overrides", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search
        empty
        .strings=${{
          retrievalFilterChipLabel: "{key} = {value}",
          retrievalSearchEmptyDescription: "Aucun résultat.",
        }}
      ></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    el.filters = { type: "pdf" };
    await el.updateComplete;
    const chip = el.shadowRoot!.querySelector(
      '[part="filters"] lr-chip[value="type"]'
    )!;
    expect(chip.textContent!.trim()).to.equal("type = pdf");
    const empty = el.shadowRoot!.querySelector(
      '[part="empty"]'
    ) as HTMLElement & { description: string };
    expect(empty.description).to.equal("Aucun résultat.");
  });
});

describe("RTL", () => {
  it('renders and functions correctly under dir="rtl" (mode selection, chip removal)', async () => {
    const el = (await fixture(
      html`<lr-retrieval-search dir="rtl"></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    el.scope = ["engineering-docs"];
    await el.updateComplete;

    modeOf(el).dispatchEvent(
      new CustomEvent("lr-change", {
        detail: { value: "keyword" },
        bubbles: true,
      })
    );
    await el.updateComplete;
    expect(el.mode).to.equal("keyword");

    const chip = el.shadowRoot!.querySelector(
      '[part="filters"] lr-chip[value="engineering-docs"]'
    )!;
    const listener = oneEvent(el, "lr-filters-change");
    chip.dispatchEvent(
      new CustomEvent("lr-remove", {
        detail: { value: "engineering-docs" },
        bubbles: true,
      })
    );
    await listener;
    expect(el.scope).to.deep.equal([]);
  });
});

describe("320px allocation", () => {
  it("can shrink to a 320px allocation without overflowing", async () => {
    const wrapper = await fixture(html`
      <div style="display: flex; inline-size: 320px;">
        <lr-retrieval-search
          style="min-inline-size: 0; flex: 1 1 auto;"
        ></lr-retrieval-search>
      </div>
    `);
    const el = wrapper.querySelector(
      "lr-retrieval-search"
    ) as LyraRetrievalSearch;
    el.scope = ["engineering-docs", "support-tickets", "release-notes"];
    el.filters = { type: "pdf", year: 2025 };
    await el.updateComplete;
    expect(el.getBoundingClientRect().width).to.be.at.most(320);
  });

  it("contains long unbroken filter and scope chip labels", async () => {
    const wrapper = await fixture(html`
      <div style="box-sizing: border-box; inline-size: 320px; overflow: auto;">
        <lr-retrieval-search></lr-retrieval-search>
      </div>
    `);
    const el = wrapper.querySelector(
      "lr-retrieval-search"
    ) as LyraRetrievalSearch;
    const long = `identifier-${"segment".repeat(40)}`;
    el.scope = [long];
    el.filters = { [long]: long };
    await el.updateComplete;
    const filters = el.shadowRoot!.querySelector(
      '[part="filters"]'
    ) as HTMLElement;
    const chips = Array.from(
      filters.querySelectorAll("lr-chip")
    ) as HTMLElement[];

    const firstChip = chips[0]!;
    const chipBase = firstChip.shadowRoot!.querySelector(
      '[part="base"]'
    ) as HTMLElement;
    const chipLabel = firstChip.shadowRoot!.querySelector(
      '[part="label"]'
    ) as HTMLElement;
    const dimensions = {
      wrapper: [wrapper.clientWidth, wrapper.scrollWidth],
      search: [el.clientWidth, el.scrollWidth],
      filters: [filters.clientWidth, filters.scrollWidth],
      chip: [
        firstChip.clientWidth,
        firstChip.scrollWidth,
        getComputedStyle(firstChip).maxInlineSize,
      ],
      chipBase: [chipBase.clientWidth, chipBase.scrollWidth],
      chipLabel: [chipLabel.clientWidth, chipLabel.scrollWidth],
    };
    expect(wrapper.scrollWidth, JSON.stringify(dimensions)).to.be.at.most(
      wrapper.clientWidth
    );
    expect(filters.getBoundingClientRect().width).to.be.at.most(
      el.getBoundingClientRect().width
    );
    for (const chip of chips) {
      expect(chip.getBoundingClientRect().width).to.be.at.most(
        filters.getBoundingClientRect().width
      );
    }
  });
});

describe("hover and pressed treatment", () => {
  it("mixes the submit fill toward the shared partner on hover and further again on press", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search
        query="inverter fault codes"
      ></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    await el.updateComplete;
    const root = el.shadowRoot!;
    const probes = paintProbe(root);

    const resting = probes.render(declaredBackground(root, "[part='submit']"));
    const hovered = probes.render(
      declaredBackground(root, "[part='submit']:hover")
    );
    const pressed = probes.render(
      declaredBackground(root, "[part='submit']:active")
    );

    // Every reading is a real painted colour, and all three come back in the same serialization, so
    // the distances below compare like with like.
    expect(hovered).to.not.equal(resting);
    expect(pressed).to.not.equal(resting);
    // The defect this guards: a pressed rule byte-identical to the hover one.
    expect(pressed).to.not.equal(hovered);
    expect(channelDistance(pressed, resting)).to.be.greaterThan(
      channelDistance(hovered, resting)
    );
  });

  it("leaves the button label alone -- the state lives on the fill, not on a subtree filter", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search
        query="inverter fault codes"
      ></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    await el.updateComplete;
    const root = el.shadowRoot!;
    const probes = paintProbe(root);
    // A filter applies to the whole subtree, so it would have dragged --lr-color-on-brand along with
    // the fill. Rendering whatever the rules declare and reading it back proves none survives.
    expect(
      probes.renderFilter(
        declaredValue(root, "[part='submit']:hover", "filter")
      )
    ).to.equal("none");
    expect(
      probes.renderFilter(
        declaredValue(root, "[part='submit']:active", "filter")
      )
    ).to.equal("none");
  });
});

describe("accessibility", () => {
  it("is accessible in a populated state (query, mode, filters, scope chips)", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search
        query="inverter fault codes"
      ></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    el.mode = "vector";
    el.scope = ["engineering-docs"];
    el.filters = { type: "pdf" };
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelectorAll('[part="filters"] lr-chip').length
    ).to.equal(2);
    await expect(el).to.be.accessible();
  });

  it("is accessible while loading", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search
        loading
        query="inverter fault codes"
      ></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    expect(el.shadowRoot!.querySelector('[part="spinner"]')).to.exist;
    await expect(el).to.be.accessible();
  });

  it("is accessible with an error", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search
        error-text="The retrieval service timed out."
      ></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    await expect(el).to.be.accessible();
  });

  it("is accessible in the empty state", async () => {
    const el = (await fixture(
      html`<lr-retrieval-search
        empty
        query="no matches for this"
      ></lr-retrieval-search>`
    )) as LyraRetrievalSearch;
    await expect(el).to.be.accessible();
  });
});

it("renders the query field, mode selector, and submit button at one flush toolbar height", async () => {
  const el = (await fixture(
    html`<lr-retrieval-search></lr-retrieval-search>`
  )) as LyraRetrievalSearch;
  await el.updateComplete;
  const mode = modeOf(el) as HTMLElement & { updateComplete: Promise<unknown> };
  const query = queryInputOf(el) as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  await mode.updateComplete;
  await query.updateComplete;

  const heights = [query, mode, submitButtonOf(el)].map(
    (control) => control.getBoundingClientRect().height
  );
  expect(
    heights[0],
    "the query field sits on the shared form-control height"
  ).to.be.greaterThan(0);
  expect(heights[1], "the mode selector matches the query field").to.be.closeTo(
    heights[0]!,
    1
  );
  expect(heights[2], "and so does the submit button").to.be.closeTo(
    heights[0]!,
    1
  );
});
