import { fixture, expect, html, waitUntil } from "@open-wc/testing";
import "./usage-badge.js";
import type { LyraUsageBadge } from "./usage-badge.js";
import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';
import { resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";
import { sendKeys } from "@web/test-runner-commands";

// Removed-attribute regression tests below deliberately author these; see the helper.
expectStaleAttribute('lr-usage-badge', 'compact');

it("defaults to no tokensIn/tokensOut/costText/latencyMs/summary, abbreviate=false", async () => {
  const el = (await fixture(
    html`<lr-usage-badge></lr-usage-badge>`
  )) as LyraUsageBadge;
  expect(el.tokensIn).to.be.undefined;
  expect(el.tokensOut).to.be.undefined;
  expect(el.costText).to.equal("");
  expect(el.latencyMs).to.be.undefined;
  expect(el.summary).to.equal("");
  expect(el.abbreviate).to.be.false;
});

it("no longer carries a compact property, and a stale compact attribute is inert", async () => {
  const el = (await fixture(
    html`<lr-usage-badge tokens-in="12345" compact></lr-usage-badge>`
  )) as LyraUsageBadge;
  expect("compact" in el).to.equal(false);
  // Inert rather than actively wrong: the removed density-colliding name changes nothing.
  expect(
    el.shadowRoot!.querySelector('[part="tokens-in"]')!.textContent!.trim()
  ).to.equal("12,345 in");
});

it("reflects abbreviate to an attribute so a host can style off it", async () => {
  const el = (await fixture(
    html`<lr-usage-badge tokens-in="12345"></lr-usage-badge>`
  )) as LyraUsageBadge;
  expect(el.hasAttribute("abbreviate")).to.equal(false);
  el.abbreviate = true;
  await el.updateComplete;
  expect(el.hasAttribute("abbreviate")).to.equal(true);
});

it("renders nothing when no segment is set", async () => {
  const el = (await fixture(
    html`<lr-usage-badge></lr-usage-badge>`
  )) as LyraUsageBadge;
  expect(el.shadowRoot!.querySelector('[part="tokens-in"]') == null).to.be.true;
  expect(el.shadowRoot!.querySelector('[part="tokens-out"]') == null).to.be
    .true;
  expect(el.shadowRoot!.querySelector('[part="cost"]') == null).to.be.true;
  expect(el.shadowRoot!.querySelector('[part="latency"]') == null).to.be.true;
  expect(
    (el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).hasAttribute(
      "tabindex"
    )
  ).to.be.false;
});

it("renders only the segments that are set, each independently optional", async () => {
  const el = (await fixture(
    html`<lr-usage-badge tokens-in="1204" cost-text="$0.012"></lr-usage-badge>`
  )) as LyraUsageBadge;
  expect(
    el.shadowRoot!.querySelector('[part="tokens-in"]')!.textContent!.trim()
  ).to.equal("1,204 in");
  expect(el.shadowRoot!.querySelector('[part="tokens-out"]') == null).to.be
    .true;
  expect(
    el.shadowRoot!.querySelector('[part="cost"]')!.textContent!.trim()
  ).to.equal("$0.012");
  expect(el.shadowRoot!.querySelector('[part="latency"]') == null).to.be.true;
});

it("formats latency-ms with the shared duration algorithm", async () => {
  const sub = (await fixture(
    html`<lr-usage-badge latency-ms="820"></lr-usage-badge>`
  )) as LyraUsageBadge;
  expect(
    sub.shadowRoot!.querySelector('[part="latency"]')!.textContent!.trim()
  ).to.equal("820ms");
  const over = (await fixture(
    html`<lr-usage-badge latency-ms="1500"></lr-usage-badge>`
  )) as LyraUsageBadge;
  expect(
    over.shadowRoot!.querySelector('[part="latency"]')!.textContent!.trim()
  ).to.equal("1.5s");
  const roundedMilliseconds = (await fixture(
    html`<lr-usage-badge latency-ms="999.6"></lr-usage-badge>`
  )) as LyraUsageBadge;
  expect(
    roundedMilliseconds
      .shadowRoot!.querySelector('[part="latency"]')!
      .textContent!.trim()
  ).to.equal("1,000ms");
  const wholeSeconds = (await fixture(
    html`<lr-usage-badge latency-ms="2000"></lr-usage-badge>`
  )) as LyraUsageBadge;
  expect(
    wholeSeconds
      .shadowRoot!.querySelector('[part="latency"]')!
      .textContent!.trim()
  ).to.equal("2s");
});

it("uses the effective locale when formatting the built-in duration", async () => {
  const el = (await fixture(
    html`<lr-usage-badge locale="ar" latency-ms="1500"></lr-usage-badge>`
  )) as LyraUsageBadge;
  const formatted = new Intl.NumberFormat("ar", {
    maximumFractionDigits: 1,
  }).format(1.5);
  expect(
    el.shadowRoot!.querySelector('[part="latency"]')!.textContent!.trim()
  ).to.equal(`${formatted}s`);
});

it('omits the latency segment for a non-numeric latency-ms, and clamps a negative one to "0ms" instead of a negative reading', async () => {
  const nonFinite = (await fixture(
    html`<lr-usage-badge latency-ms="not-a-number"></lr-usage-badge>`
  )) as LyraUsageBadge;
  expect(Number.isNaN(nonFinite.latencyMs)).to.be.true;
  expect(nonFinite.shadowRoot!.querySelector('[part="latency"]') == null).to.be
    .true;

  const negative = (await fixture(
    html`<lr-usage-badge latency-ms="-50"></lr-usage-badge>`
  )) as LyraUsageBadge;
  expect(
    negative.shadowRoot!.querySelector('[part="latency"]')!.textContent!.trim()
  ).to.equal("0ms");
});

it("lets formatLatency override the built-in duration algorithm in both the visible strip and the tooltip row", async () => {
  const el = (await fixture(
    html`<lr-usage-badge latency-ms="312000"></lr-usage-badge>`
  )) as LyraUsageBadge;
  // Unset: the built-in algorithm has no minutes/hours tier, so a 5m 12s run reads as a bare
  // seconds count -- exactly the gap this hook exists to let a host correct.
  expect(
    el.shadowRoot!.querySelector('[part="latency"]')!.textContent!.trim()
  ).to.equal("312s");

  el.formatLatency = (ms) => {
    const totalSeconds = Math.round(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  };
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="latency"]')!.textContent!.trim()
  ).to.equal("5m 12s");

  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.dispatchEvent(new Event("mouseenter"));
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="tooltip"]')!.textContent
  ).to.include("5m 12s");
});

it("renders abbreviated token notation when abbreviate is set, full grouped figures otherwise", async () => {
  const full = (await fixture(
    html`<lr-usage-badge tokens-in="12345"></lr-usage-badge>`
  )) as LyraUsageBadge;
  expect(
    full.shadowRoot!.querySelector('[part="tokens-in"]')!.textContent!.trim()
  ).to.equal("12,345 in");

  const abbreviated = (await fixture(
    html`<lr-usage-badge tokens-in="12345" abbreviate></lr-usage-badge>`
  )) as LyraUsageBadge;
  expect(
    abbreviated
      .shadowRoot!.querySelector('[part="tokens-in"]')!
      .textContent!.trim()
  ).to.equal("12K in");
});

it('is a focusable non-button group named "Usage" whenever any segment is set', async () => {
  const el = (await fixture(
    html`<lr-usage-badge tokens-in="10"></lr-usage-badge>`
  )) as LyraUsageBadge;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.tagName).to.not.equal("BUTTON");
  expect(base.getAttribute("role")).to.equal("group");
  expect(base.getAttribute("tabindex")).to.equal("0");
  expect(base.getAttribute("aria-label")).to.equal("Usage");
});

it("lets a host-level aria-label rename the group instead of the fixed localized default", async () => {
  const el = (await fixture(
    html`<lr-usage-badge
      tokens-in="10"
      aria-label="Tokens for this reply"
    ></lr-usage-badge>`
  )) as LyraUsageBadge;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute("aria-label")).to.equal("Tokens for this reply");

  el.setAttribute("aria-label", "");
  await el.updateComplete;
  expect(base.getAttribute("aria-label")).to.equal("");

  el.removeAttribute("aria-label");
  await el.updateComplete;
  expect(base.getAttribute("aria-label")).to.equal("Usage");
});

describe("tooltip breakdown", () => {
  it("is hidden until hover/focus, and shows full-precision labeled rows", async () => {
    const el = (await fixture(
      html`<lr-usage-badge
        tokens-in="1204"
        tokens-out="386"
        cost-text="$0.012"
        latency-ms="2350"
        abbreviate
      ></lr-usage-badge>`
    )) as LyraUsageBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(
      (el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden
    ).to.be.true;

    base.dispatchEvent(new Event("mouseenter"));
    await el.updateComplete;
    const tooltip = el.shadowRoot!.querySelector(
      '[part="tooltip"]'
    ) as HTMLElement;
    expect(tooltip.hidden).to.be.false;
    expect(tooltip.textContent).to.include("Input tokens");
    expect(tooltip.textContent).to.include("1,204");
    expect(tooltip.textContent).to.include("Output tokens");
    expect(tooltip.textContent).to.include("386");
    expect(tooltip.textContent).to.include("Total tokens");
    expect(tooltip.textContent).to.include("1,590");
    expect(tooltip.textContent).to.include("Cost");
    expect(tooltip.textContent).to.include("$0.012");
    expect(tooltip.textContent).to.include("Latency");
    expect(tooltip.textContent).to.include("2.4s");

    base.dispatchEvent(new Event("mouseleave"));
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden
    ).to.be.true;
  });

  it("only shows the Total tokens row when both tokensIn and tokensOut are set", async () => {
    const el = (await fixture(
      html`<lr-usage-badge tokens-in="1204"></lr-usage-badge>`
    )) as LyraUsageBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new Event("mouseenter"));
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="tooltip"]')!.textContent
    ).to.not.include("Total tokens");
  });

  it("keeps the tooltip open while hover releases but focus still holds it, and vice versa", async () => {
    const el = (await fixture(
      html`<lr-usage-badge tokens-in="10"></lr-usage-badge>`
    )) as LyraUsageBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new Event("mouseenter"));
    base.dispatchEvent(new Event("focus"));
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden
    ).to.be.false;

    base.dispatchEvent(new Event("mouseleave"));
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden,
      "focus still holds it open"
    ).to.be.false;

    base.dispatchEvent(new Event("blur"));
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden
    ).to.be.true;
  });

  it("dismisses on Escape", async () => {
    const el = (await fixture(
      html`<lr-usage-badge tokens-in="10"></lr-usage-badge>`
    )) as LyraUsageBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new Event("focus"));
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden
    ).to.be.false;
    base.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
    );
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden
    ).to.be.true;
  });

  it("sets aria-describedby on base only while the tooltip is open and has content", async () => {
    const el = (await fixture(
      html`<lr-usage-badge tokens-in="10"></lr-usage-badge>`
    )) as LyraUsageBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.hasAttribute("aria-describedby")).to.be.false;
    base.dispatchEvent(new Event("focus"));
    await el.updateComplete;
    const tooltip = el.shadowRoot!.querySelector(
      '[part="tooltip"]'
    ) as HTMLElement;
    expect(base.getAttribute("aria-describedby")).to.equal(tooltip.id);
  });

  it("closes the tooltip (rather than leaving it frozen open with no positioner) after a disconnect+reconnect while open", async () => {
    const el = (await fixture(
      html`<lr-usage-badge tokens-in="10"></lr-usage-badge>`
    )) as LyraUsageBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new Event("mouseenter"));
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden
    ).to.be.false;

    const parent = el.parentElement!;
    el.remove();
    parent.appendChild(el);
    await el.updateComplete;

    // disconnectedCallback() resets tooltipOpen (and the hovering/focused reasons that could
    // otherwise re-open it) to false -- asserting that directly is what distinguishes the fix
    // from the pre-fix bug (tearing down cleanupPositioner alone leaves the tooltip rendered
    // open at a stale position with no live positioner attached). Mirrors
    // `<lr-tool-call-chip>`'s own reconnect regression test.
    const tooltipAfterReconnect = el.shadowRoot!.querySelector(
      '[part="tooltip"]'
    ) as HTMLElement;
    expect(tooltipAfterReconnect.hidden).to.be.true;
  });

  it("renders extra slotted rows below the built-in breakdown", async () => {
    const el = (await fixture(
      html`<lr-usage-badge tokens-in="10"
        ><div slot="details">Cache-read: 500</div></lr-usage-badge
      >`
    )) as LyraUsageBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new Event("focus"));
    await el.updateComplete;
    // Assigned content stays in the light DOM under Shadow DOM slotting, so it never becomes
    // descendant text of a shadow-tree node -- querying the tooltip's own `.textContent` (as
    // opposed to the slot's `assignedElements()`) would never see it regardless of whether the
    // slot is wired up correctly. Assert through the slot's real assignment instead, the same way
    // `tool-call-chip.test.ts`'s icon-slot-precedence tests do.
    const slot = el.shadowRoot!.querySelector(
      '[part="tooltip"] slot'
    ) as HTMLSlotElement;
    const assigned = slot.assignedElements({ flatten: true });
    expect(assigned).to.have.length(1);
    expect(assigned[0]!.textContent).to.include("Cache-read: 500");
  });

  it("keeps slotted tooltip rows inert even when a host supplies an interactive descendant", async () => {
    const el = (await fixture(
      html`<lr-usage-badge tokens-in="10"
        ><button slot="details" id="tooltip-action">
          Action
        </button></lr-usage-badge
      >`
    )) as LyraUsageBadge;
    const wrapper = el.shadowRoot!.querySelector(
      ".slot-content"
    ) as HTMLElement;
    const action = el.querySelector("#tooltip-action") as HTMLButtonElement;
    expect(wrapper.inert).to.be.true;

    action.focus();
    expect(document.activeElement !== action).to.equal(true);
  });

  it("closes and removes the tooltip focus stop when the last prop-driven row is cleared", async () => {
    const el = (await fixture(
      html`<lr-usage-badge latency-ms="100"></lr-usage-badge>`
    )) as LyraUsageBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new Event("focus"));
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden
    ).to.be.false;

    el.latencyMs = undefined;
    await el.updateComplete;
    expect(
      (
        el.shadowRoot!.querySelector('[part="base"]') as HTMLElement
      ).hasAttribute("tabindex")
    ).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="tooltip"]') === null).to.be
      .true;

    el.latencyMs = 100;
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden
    ).to.be.true;
  });

  it("closes when removing the last slotted tooltip row", async () => {
    const el = (await fixture(
      html`<lr-usage-badge summary="Additional usage"
        ><span slot="details">Cache-read: 500</span></lr-usage-badge
      >`
    )) as LyraUsageBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new Event("focus"));
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector('[part="tooltip"]') as HTMLElement).hidden
    ).to.be.false;

    el.firstElementChild!.remove();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    await el.updateComplete;
    expect(
      (
        el.shadowRoot!.querySelector('[part="base"]') as HTMLElement
      ).hasAttribute("tabindex")
    ).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="tooltip"]') === null).to.be
      .true;
  });

  it("keeps details-only content out of the tab order until an explicit visible summary exists", async () => {
    const el = (await fixture(
      html`<lr-usage-badge
        ><span slot="details">Cache-read: 500</span></lr-usage-badge
      >`
    )) as LyraUsageBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.hasAttribute("tabindex")).to.be.false;
    expect(base.hasAttribute("role")).to.be.false;

    el.summary = "Additional usage";
    await el.updateComplete;
    expect(base.getAttribute("tabindex")).to.equal("0");
    expect(base.getAttribute("role")).to.equal("group");
    expect(
      el.shadowRoot!.querySelector('[part="summary"]')!.textContent!.trim()
    ).to.equal("Additional usage");
    expect(
      (
        el.shadowRoot!.querySelector('[part="summary"]') as HTMLElement
      ).getBoundingClientRect().width
    ).to.be.greaterThan(0);
  });

  it("uses a named summary slot in preference to the summary property", async () => {
    const el = (await fixture(html`
      <lr-usage-badge summary="Property summary">
        <strong slot="summary">Slotted summary</strong>
        <span slot="details">Cache-read: 500</span>
      </lr-usage-badge>
    `)) as LyraUsageBadge;
    const summary = el.shadowRoot!.querySelector(
      'slot[name="summary"]'
    ) as HTMLSlotElement;
    expect(
      summary
        .assignedElements({ flatten: true })
        .map((item) => item.textContent?.trim())
    ).to.deep.equal(["Slotted summary"]);
  });

  it("mirrors bounded details text into the non-inert tooltip description", async () => {
    const el = (await fixture(html`
      <lr-usage-badge summary="Additional usage">
        <span slot="details">Cache-read: 500</span>
      </lr-usage-badge>
    `)) as LyraUsageBadge;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new Event("focus"));
    await el.updateComplete;
    const tooltip = el.shadowRoot!.querySelector(
      '[part="tooltip"]'
    ) as HTMLElement;
    expect(base.getAttribute("aria-describedby")).to.equal(tooltip.id);
    expect(tooltip.querySelector(".sr-only")?.textContent).to.equal(
      "Cache-read: 500"
    );
    expect((tooltip.querySelector(".slot-content") as HTMLElement).inert).to.be
      .true;
  });
});

it("localizes built-in tooltip row labels via .strings", async () => {
  const el = (await fixture(
    html`<lr-usage-badge
      tokens-in="10"
      .strings=${{ usageBadgeTokensInLabel: "Jetons entrée" }}
    ></lr-usage-badge>`
  )) as LyraUsageBadge;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.dispatchEvent(new Event("focus"));
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="tooltip"]')!.textContent
  ).to.include("Jetons entrée");
});

it("is accessible with nothing set", async () => {
  const el = (await fixture(
    html`<lr-usage-badge></lr-usage-badge>`
  )) as LyraUsageBadge;
  await expect(el).to.be.accessible();
});

it("is accessible with every segment set and the tooltip open", async () => {
  const el = (await fixture(
    html`<lr-usage-badge
      tokens-in="1204"
      tokens-out="386"
      cost-text="$0.012"
      latency-ms="2350"
    ></lr-usage-badge>`
  )) as LyraUsageBadge;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.dispatchEvent(new Event("focus"));
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it("contains all badge states with long localized content in an exact 320px RTL allocation", async () => {
  const long = "AnExtremelyLongCostValueWithoutNaturalBreaks".repeat(5);
  const container = (await fixture(html`
    <div dir="rtl" style="display:grid;gap:var(--lr-space-s);inline-size:320px">
      <lr-usage-badge
        style="inline-size:100%"
        tokens-in="1204"
        tokens-out="386"
        cost-text=${long}
        latency-ms="2350"
        .strings=${{
          usageBadgeTokensInLabel: long,
          usageBadgeTokensOutLabel: long,
          usageBadgeCostLabel: long,
          usageBadgeLatencyLabel: long,
        }}
      ></lr-usage-badge>
      <lr-usage-badge
        abbreviate
        style="inline-size:100%"
        tokens-in="1204"
        tokens-out="386"
        cost-text=${long}
        latency-ms="2350"
      ></lr-usage-badge>
    </div>
  `)) as HTMLDivElement;
  const badges = Array.from(
    container.querySelectorAll("lr-usage-badge")
  ) as LyraUsageBadge[];
  expect(Math.round(container.getBoundingClientRect().width)).to.equal(320);
  expect(container.scrollWidth).to.be.at.most(container.clientWidth + 1);

  for (const el of badges) {
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(new Event("focus"));
    await el.updateComplete;
    const tooltip = el.shadowRoot!.querySelector(
      '[part="tooltip"]'
    ) as HTMLElement;
    expect(base.scrollWidth).to.be.at.most(base.clientWidth + 1);
    expect(tooltip.scrollWidth).to.be.at.most(tooltip.clientWidth + 1);
  }
});

it("renders the interactive base hover and keyboard-focus treatment", async () => {
  const el = await fixture<LyraUsageBadge>(html`
    <lr-usage-badge
      tokens-in="1204"
      style="--lr-color-surface-raised: rgb(1, 2, 3); --lr-focus-ring-width: 6px; --lr-focus-ring-color: rgb(4, 5, 6); --lr-focus-ring-offset: 3px"
    ></lr-usage-badge>
  `);
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  base.scrollIntoView({ block: "center" });
  const rect = base.getBoundingClientRect();
  try {
    await sendMouse({
      type: "move",
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
    await waitUntil(
      () => getComputedStyle(base).backgroundColor === "rgb(1, 2, 3)",
      "the usage badge hover background never appeared",
    );
  } finally {
    await resetMouse();
  }

  await sendKeys({ press: "Tab" });
  base.focus();
  await waitUntil(() => {
    const computed = getComputedStyle(base);
    return (
      computed.outlineWidth === "6px" &&
      computed.outlineColor === "rgb(4, 5, 6)" &&
      computed.outlineOffset === "3px"
    );
  }, "the usage badge keyboard focus ring never appeared");
});

/** Render the max-inline-size declared on `selector` (read off the element's own applied stylesheets)
 *  into the component's shadow scope with the viewport-clamp token pinned to a tiny value, returning
 *  its resolved computed value. Wired to --lr-popover-viewport-clamp the min() collapses to that
 *  pinned value; a leftover 92vw/90vw literal would resolve to something else. */
function renderedClamp(el: HTMLElement, selector: string): string {
  const normalize = (text: string) => text.replace(/"/g, "'");
  let declared = "";
  for (const sheet of el.shadowRoot!.adoptedStyleSheets) {
    for (const rule of sheet.cssRules) {
      if (
        rule instanceof CSSStyleRule &&
        normalize(rule.selectorText) === normalize(selector) &&
        rule.style.maxInlineSize
      ) {
        declared = rule.style.maxInlineSize;
      }
    }
  }
  const probe = document.createElement("span");
  probe.style.display = "block";
  probe.style.setProperty("--lr-popover-viewport-clamp", "10px");
  probe.style.maxInlineSize = declared;
  el.shadowRoot!.appendChild(probe);
  const value = getComputedStyle(probe).maxInlineSize;
  probe.remove();
  return value;
}

it("clamps its floating surface width through the shared popover-viewport-clamp token", async () => {
  const el = (await fixture(
    html`<lr-usage-badge></lr-usage-badge>`
  )) as HTMLElement;
  await (el as HTMLElement & { updateComplete?: Promise<unknown> })
    .updateComplete;
  expect(renderedClamp(el, "[part='tooltip']")).to.equal("10px");
});
