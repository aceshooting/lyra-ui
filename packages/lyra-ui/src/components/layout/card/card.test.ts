import { fixture, expect, html, oneEvent, waitUntil } from "@open-wc/testing";
import "./card.js";
import "../../forms/button/button.js";
import type { LyraCard } from "./card.js";
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

function base(el: LyraCard): HTMLElement {
  return el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
}

function key(el: HTMLElement, k: string): KeyboardEvent {
  const ev = new KeyboardEvent("keydown", {
    key: k,
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  el.dispatchEvent(ev);
  return ev;
}

describe("lr-card", () => {

  it("accepts the Shoelace border and padding CSS hooks", async () => {
    const el = (await fixture(html`
      <lr-card style="--border-color: rgb(1, 2, 3); --border-radius: 9px; --border-width: 3px; --padding: 13px">
        body
      </lr-card>
    `)) as LyraCard;
    const root = base(el);
    const body = el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
    const computed = getComputedStyle(root);
    expect(computed.borderTopColor).to.equal("rgb(1, 2, 3)");
    expect(computed.borderTopWidth).to.equal("3px");
    expect(computed.borderRadius).to.equal("9px");
    expect(getComputedStyle(body).paddingTop).to.equal("13px");
  });
  it("renders as a div by default, an <a> when href is set", async () => {
    const plain = (await fixture(html`<lr-card>body</lr-card>`)) as LyraCard;
    expect(plain.shadowRoot!.querySelector('a[part="base"]') == null).to.be.true;
    expect(plain.shadowRoot!.querySelector('div[part="base"]')).to.exist;

    const linked = (await fixture(
      html`<lr-card href="/x">body</lr-card>`
    )) as LyraCard;
    const anchor = linked.shadowRoot!.querySelector(
      'a[part="base"]'
    ) as HTMLAnchorElement;
    expect(anchor != null).to.equal(true);
    expect(anchor.getAttribute("href")).to.equal("/x");
  });

  it('protects the body and slotted header from wrapping mid-word when squeezed by a sibling, avoiding overflow-wrap: anywhere (same defect class as lr-switch/lr-callout)', async () => {
    // [part="body"] and ::slotted([slot="header"]) are both flex items, so they are
    // blockified to display: block -- getClientRects() always returns exactly one rect
    // for a block box no matter how many internal text lines it wraps to (unlike an
    // inline box, which contributes one rect per line fragment), so line count has to
    // be read from height instead, against a dynamically measured single-line reference.
    const label = 'Streaming enabled';

    const reference = (await fixture(html`
      <lr-card style="inline-size: 400px;">${label}</lr-card>
    `)) as LyraCard;
    await reference.updateComplete;
    const lineHeight = reference.shadowRoot!
      .querySelector<HTMLElement>('[part="body"]')!
      .getBoundingClientRect().height;

    // A 250px outer flex row with a non-shrinking 150px sibling leaves the card only
    // ~100px of "fair share" -- well below what its longest word ("Streaming", ~68px
    // unconstrained) needs. min-inline-size: 0 (already present) still lets the card
    // shrink past its content minimum, so the fix is overflow-wrap: break-word instead
    // of overflow-wrap: anywhere -- the label still wraps at the space (2 lines)
    // instead of splitting a word across 3+ lines.
    const wrapper = (await fixture(html`
      <div style="display: flex; inline-size: 250px;">
        <lr-card>${label}</lr-card>
        <div style="flex: 0 0 150px;">sibling</div>
      </div>
    `)) as HTMLDivElement;
    const el = wrapper.querySelector('lr-card') as LyraCard;
    await el.updateComplete;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    const lineCount = Math.round(body.getBoundingClientRect().height / lineHeight);

    expect(
      lineCount,
      'wraps the body at the space between the two words, not mid-syllable inside one'
    ).to.equal(2);
  });

  it('does not inspect an unavailable render root during the server-side first update', () => {
    const el = document.createElement('lr-card') as LyraCard;
    el.actionable = true;
    const access = el as unknown as { willUpdate(changed: Map<PropertyKey, unknown>): void;
    };

    expect(() => access.willUpdate(new Map([['actionable', false]]))).not.to.throw();
  });

  it("preserves focus across link, activation-button, and passive owner replacements", async () => {
    const el = (await fixture(
      html`<lr-card actionable>body</lr-card>`
    )) as LyraCard;
    (el.shadowRoot!.querySelector('[part="activation-button"]') as HTMLElement).focus();

    el.href = "/reports";
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.tagName).to.equal("A");

    el.href = undefined;
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('activation-button');

    el.actionable = false;
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
    expect((el.shadowRoot!.activeElement as HTMLElement | null)?.tabIndex).to.equal(-1);
  });

  it("does not move external focus when its semantic owner changes", async () => {
    const wrapper = await fixture(html`
      <div>
        <button id="outside">Outside</button>
        <lr-card actionable>body</lr-card>
      </div>
    `);
    const el = wrapper.querySelector('lr-card') as LyraCard;
    wrapper.querySelector<HTMLElement>('#outside')!.focus();
    el.href = '/reports';
    await el.updateComplete;
    expect(el.ownerDocument.activeElement?.id).to.equal('outside');
  });

  it("defaults appearance to outlined, actionable to false", async () => {
    const el = (await fixture(html`<lr-card>body</lr-card>`)) as LyraCard;
    expect(el.appearance).to.equal("outlined");
    expect(el.actionable).to.be.false;
    expect(el.hasAttribute("actionable")).to.be.false;
  });

  it("rejects executable navigation schemes", async () => {
    const el = (await fixture(
      html`<lr-card href="java	script:alert(1)">body</lr-card>`
    )) as LyraCard;
    expect(el.shadowRoot!.querySelector('a[part="base"]') == null).to.be.true;
  });

  it('derives rel="noopener noreferrer" whenever target is set on a linked card', async () => {
    const el = (await fixture(
      html`<lr-card href="https://example.com" target="_blank">Body</lr-card>`
    )) as LyraCard;
    const anchor = el.shadowRoot!.querySelector(
      'a[part="base"]'
    ) as HTMLAnchorElement;
    expect(anchor.getAttribute("target")).to.equal("_blank");
    expect(anchor.getAttribute("rel")).to.equal("noopener noreferrer");
  });

  it("omits target/rel entirely when target is unset (unset-regression)", async () => {
    const el = (await fixture(
      html`<lr-card href="https://example.com">Body</lr-card>`
    )) as LyraCard;
    const anchor = el.shadowRoot!.querySelector(
      'a[part="base"]'
    ) as HTMLAnchorElement;
    expect(anchor.hasAttribute("target")).to.be.false;
    expect(anchor.hasAttribute("rel")).to.be.false;
  });

  it("ignores target on a non-linked card, leaving the div root untouched (unset-regression)", async () => {
    const el = (await fixture(
      html`<lr-card target="_blank">Body</lr-card>`
    )) as LyraCard;
    const root = base(el);
    expect(root.tagName).to.equal("DIV");
    expect(root.hasAttribute("target")).to.be.false;
    expect(root.hasAttribute("rel")).to.be.false;
  });

  it("renders header/media/footer/actions slots only when populated", async () => {
    const el = (await fixture(html`
      <lr-card>
        <span slot="header">Title</span>
        <span slot="media">img</span>
        body
        <span slot="footer">Footer</span>
        <span slot="actions">Actions</span>
      </lr-card>
    `)) as LyraCard;
    const header = el.shadowRoot!.querySelector(
      '[part="header"]'
    ) as HTMLElement;
    const media = el.shadowRoot!.querySelector('[part~="media"]') as HTMLElement;
    const footer = el.shadowRoot!.querySelector(
      '[part="footer"]'
    ) as HTMLElement;
    expect(header.hasAttribute("hidden")).to.be.false;
    expect(media.hasAttribute("hidden")).to.be.false;
    expect(footer.hasAttribute("hidden")).to.be.false;
  });

  it("hides header/media/footer when nothing is slotted into them (unpopulated default)", async () => {
    const el = (await fixture(html`<lr-card>body only</lr-card>`)) as LyraCard;
    const header = el.shadowRoot!.querySelector(
      '[part="header"]'
    ) as HTMLElement;
    const media = el.shadowRoot!.querySelector('[part~="media"]') as HTMLElement;
    const footer = el.shadowRoot!.querySelector(
      '[part="footer"]'
    ) as HTMLElement;
    expect(header.hasAttribute("hidden")).to.be.true;
    expect(media.hasAttribute("hidden")).to.be.true;
    expect(footer.hasAttribute("hidden")).to.be.true;
  });

  it("keeps a padded/bordered slotted media child inside the media wrapper's allocation (regression)", async () => {
    const el = (await fixture(html`
      <lr-card style="inline-size: 300px">
        <div slot="media" style="padding: 16px; border: 2px solid">Media</div>
        body
      </lr-card>
    `)) as LyraCard;
    const media = el.shadowRoot!.querySelector('[part~="media"]') as HTMLElement;
    const child = el.querySelector('[slot="media"]') as HTMLElement;
    // box-sizing does not inherit across the slot boundary, so a slotted node keeps the outer
    // tree's value -- the UA's content-box unless the author set otherwise. [part~="media"]
    // ::slotted(*) sets a definite `inline-size: 100%`, which before the fix allocated 100% to
    // the child's CONTENT box and let its own padding/border escape the media wrapper.
    expect(child.getBoundingClientRect().width).to.be.closeTo(media.clientWidth, 0.5);
  });

  it("reflects appearance/actionable as attributes for CSS selectors", async () => {
    const el = (await fixture(
      html`<lr-card appearance="filled" actionable>body</lr-card>`
    )) as LyraCard;
    expect(el.getAttribute("appearance")).to.equal("filled");
    expect(el.hasAttribute("actionable")).to.be.true;
  });

  it("wraps a long header and its actions without overflowing a narrow allocation", async () => {
    const el = (await fixture(html`
      <lr-card style="inline-size: 320px; max-inline-size: 100%;">
        <span slot="header"
          >QuarterlyGenerationForecastWithAnIntentionallyLongUnbrokenTitle</span
        >
        <span slot="actions"
          ><button type="button">Review</button
          ><button type="button">Share</button></span
        >
        Body
      </lr-card>
    `)) as LyraCard;
    const header = el.shadowRoot!.querySelector(
      '[part="header"]'
    ) as HTMLElement;
    const title = el.querySelector('[slot="header"]') as HTMLElement;

    expect(getComputedStyle(header).flexWrap).to.equal("wrap");
    expect(getComputedStyle(title).minInlineSize).to.equal("0px");
    expect(header.scrollWidth).to.be.at.most(header.clientWidth);
  });

  it("preserves an intrinsic inline size inside a shrink-to-fit grid parent", async () => {
    const wrapper = (await fixture(html`
      <div style="display: grid; place-items: center; inline-size: 40rem;">
        <lr-card>
          <div style="min-inline-size: 20rem;">Intrinsic card content</div>
        </lr-card>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector("lr-card") as LyraCard;
    await el.updateComplete;

    expect(el.getBoundingClientRect().width).to.be.at.least(320);
    expect(base(el).getBoundingClientRect().width).to.be.at.least(320);
    expect(wrapper.scrollWidth).to.equal(wrapper.clientWidth);
  });

  it('stretches [part="base"] to fill a CSS Grid row, matching a taller sibling instead of leaving blank space', async () => {
    const wrapper = (await fixture(html`
      <div
        style="display: grid; grid-template-columns: 1fr 1fr; inline-size: 400px;"
      >
        <lr-card>short</lr-card>
        <lr-card
          >much<br />taller<br />content<br />here<br />than<br />the<br />sibling</lr-card
        >
      </div>
    `)) as HTMLElement;
    const [shortCard, tallCard] = Array.from(
      wrapper.querySelectorAll("lr-card")
    ) as [LyraCard, LyraCard];
    await shortCard.updateComplete;
    await tallCard.updateComplete;

    const shortHostRect = shortCard.getBoundingClientRect();
    const tallHostRect = tallCard.getBoundingClientRect();
    // The grid row stretched both hosts to the same height (default align-items: stretch).
    expect(shortHostRect.height).to.equal(tallHostRect.height);

    const shortBase = base(shortCard).getBoundingClientRect();
    // [part="base"] must fill its own host's full measured height, not shrink-wrap to its own
    // (shorter) content and leave visible blank grid-track space below its border.
    expect(shortBase.height).to.be.closeTo(shortHostRect.height, 1);
  });

  it("is accessible", async () => {
    const el = (await fixture(
      html`<lr-card href="/x"><span slot="header">Title</span>body</lr-card>`
    )) as LyraCard;
    await expect(el).to.be.accessible();
  });

  it("keeps a linked card's slotted controls independently operable", async () => {
    const el = (await fixture(html`
      <lr-card href="#card-details">
        <button id="linked-card-action" slot="footer-actions" type="button">Download</button>
        <lr-button id="linked-card-lyra-action" slot="actions">Open</lr-button>
      </lr-card>
    `)) as LyraCard;
    const anchor = el.shadowRoot!.querySelector<HTMLAnchorElement>('a[part="base"]')!;
    const action = el.querySelector<HTMLButtonElement>("#linked-card-action")!;
    const lyraAction = el.querySelector<HTMLElement>("#linked-card-lyra-action")!;
    let anchorClicks = 0;
    let actionClicks = 0;
    let lyraActionClicks = 0;
    anchor.addEventListener("click", (event) => {
      anchorClicks += 1;
      event.preventDefault();
    });
    action.addEventListener("click", () => (actionClicks += 1));
    lyraAction.addEventListener("click", () => (lyraActionClicks += 1));

    expect(
      action.assignedSlot?.closest('a[part~="base"]')?.localName ?? null
    ).to.equal(null);
    expect(
      lyraAction.assignedSlot?.closest('a[part~="base"]')?.localName ?? null
    ).to.equal(null);
    action.scrollIntoView();
    const actionRect = action.getBoundingClientRect();
    try {
      await sendMouse({
        type: "move",
        position: [
          Math.round(actionRect.left + actionRect.width / 2),
          Math.round(actionRect.top + actionRect.height / 2),
        ],
      });
      await sendMouse({ type: "down" });
      await sendMouse({ type: "up" });
    } finally {
      await resetMouse();
    }
    lyraAction.click();

    expect(actionClicks).to.equal(1);
    expect(lyraActionClicks).to.equal(1);
    expect(anchorClicks).to.equal(0);
    await expect(el).to.be.accessible();
  });

  it("keeps rich slotted content as a linked card's accessible name", async () => {
    const el = (await fixture(html`
      <lr-card href="#monthly-report">
        <img alt="Monthly report" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />
      </lr-card>
    `)) as LyraCard;
    const anchor = el.shadowRoot!.querySelector<HTMLAnchorElement>('a[part="base"]')!;
    const content = el.shadowRoot!.querySelector<HTMLElement>(".linked-content")!;

    expect(anchor.getAttribute("aria-labelledby")).to.equal(content.id);
    expect(content.id).to.equal("linked-content");
    await expect(el).to.be.accessible();
  });

  it("gives a linked card's explicit host label precedence over linked content", async () => {
    const el = (await fixture(html`
      <lr-card href="#monthly-report" aria-label="Open monthly report">Monthly report</lr-card>
    `)) as LyraCard;
    const anchor = el.shadowRoot!.querySelector<HTMLAnchorElement>('a[part="base"]')!;

    expect(anchor.getAttribute("aria-label")).to.equal("Open monthly report");
    expect(anchor.hasAttribute("aria-labelledby")).to.be.false;

    el.setAttribute("aria-label", "");
    await el.updateComplete;
    expect(anchor.getAttribute("aria-label")).to.equal("");
    expect(anchor.hasAttribute("aria-labelledby")).to.be.false;

    el.removeAttribute("aria-label");
    await el.updateComplete;
    expect(anchor.hasAttribute("aria-label")).to.be.false;
    expect(anchor.getAttribute("aria-labelledby")).to.equal("linked-content");
  });

  it("follows a linked card for noninteractive slotted content", async () => {
    const el = (await fixture(html`
      <lr-card href="#card-details"><span id="linked-card-content">Open details</span></lr-card>
    `)) as LyraCard;
    const anchor = el.shadowRoot!.querySelector<HTMLAnchorElement>('a[part="base"]')!;
    let anchorClicks = 0;
    anchor.addEventListener("click", (event) => {
      anchorClicks += 1;
      event.preventDefault();
    });

    const content = el.querySelector<HTMLElement>("#linked-card-content")!;
    content.scrollIntoView();
    const contentRect = content.getBoundingClientRect();
    try {
      await sendMouse({
        type: "move",
        position: [
          Math.round(contentRect.left + contentRect.width / 2),
          Math.round(contentRect.top + contentRect.height / 2),
        ],
      });
      await sendMouse({ type: "down" });
      await sendMouse({ type: "up" });
    } finally {
      await resetMouse();
    }

    expect(anchorClicks).to.equal(1);
  });

  it("replaces a proxied content click with exactly one outward native anchor click", async () => {
    const el = (await fixture(html`
      <lr-card href="#card-details"><span id="content">Open details</span></lr-card>
    `)) as LyraCard;
    const anchor = el.shadowRoot!.querySelector<HTMLAnchorElement>('a[part="base"]')!;
    const content = el.querySelector<HTMLElement>("#content")!;
    let outwardClicks = 0;
    let anchorClicks = 0;
    el.addEventListener("click", () => (outwardClicks += 1));
    anchor.addEventListener("click", (event) => {
      anchorClicks += 1;
      event.preventDefault();
    });

    content.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(anchorClicks).to.equal(1);
    expect(outwardClicks).to.equal(1);

    content.addEventListener("click", (event) => event.preventDefault(), { once: true });
    content.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, cancelable: true }));
    expect(anchorClicks).to.equal(1);
    expect(outwardClicks).to.equal(2);
  });

  it("merges author rel tokens with the target security floor and strips opener", async () => {
    const el = (await fixture(html`
      <lr-card href="/report" target="_blank" rel="nofollow sponsored opener">Report</lr-card>
    `)) as LyraCard;
    const anchor = el.shadowRoot!.querySelector<HTMLAnchorElement>('a[part="base"]')!;
    expect(new Set(anchor.rel.split(/\s+/))).to.deep.equal(
      new Set(["nofollow", "sponsored", "noopener", "noreferrer"])
    );

    el.target = undefined;
    await el.updateComplete;
    expect(anchor.rel).to.equal("nofollow sponsored");
  });

  it("gives every linked card action presentation without a redundant actionable flag", async () => {
    const el = (await fixture(html`<lr-card href="/report">Report</lr-card>`)) as LyraCard;
    const anchor = el.shadowRoot!.querySelector<HTMLAnchorElement>('a[part="base"]')!;
    expect(anchor.dataset['actionable']).to.equal("true");
    expect(getComputedStyle(anchor).cursor).to.equal("pointer");
  });

  describe("activation without href", () => {
    // The constraint that rules out `role="button"` on `[part='base']`: a card routinely contains
    // slotted buttons/links, and axe-core's `nested-interactive` rule forbids a focusable
    // descendant of a `role="button"` ancestor. Written first, deliberately.
    it("an actionable card containing a slotted lr-button is still accessible", async () => {
      const el = (await fixture(html`
        <lr-card actionable>
          <span slot="header">Rooftop install No. 4021</span>
          <lr-button slot="actions">Edit</lr-button>
          Body content
          <span slot="footer"><a href="/details">Details</a></span>
        </lr-card>
      `)) as LyraCard;
      await expect(el).to.be.accessible();
    });

    it("renders a named native sibling button and emits lr-card-activate on whole-card click", async () => {
      const el = (await fixture(
        html`<lr-card actionable>body</lr-card>`
      )) as LyraCard;
      const activation = el.shadowRoot!.querySelector(
        '[part="activation-button"]'
      ) as HTMLButtonElement;
      expect(activation.tagName).to.equal("BUTTON");
      expect(activation.getAttribute("aria-label")).to.equal("body");
      expect(activation.getAttribute("tabindex")).to.equal("0");
      expect(getComputedStyle(activation).minInlineSize).to.equal("40px");
      expect(getComputedStyle(activation).minBlockSize).to.equal("40px");
      expect(base(el).hasAttribute("tabindex")).to.be.false;
      expect(base(el).hasAttribute("role")).to.be.false;

      const fired = oneEvent(el, "lr-card-activate");
      base(el).click();
      await fired;
    });

    it("derives its fallback name from aria-labelledby and image alternatives", async () => {
      const el = (await fixture(html`
        <lr-card actionable>
          <span aria-labelledby="card-semantic-name">Visible fallback</span>
          <span id="card-semantic-name" hidden><img alt="Quarterly chart" /></span>
        </lr-card>
      `)) as LyraCard;
      const activation = el.shadowRoot!.querySelector(
        '[part="activation-button"]'
      ) as HTMLButtonElement;

      expect(activation.getAttribute("aria-label")).to.equal("Quarterly chart");
      el.querySelector("img")!.alt = "Annual chart";
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      await el.updateComplete;
      expect(activation.getAttribute("aria-label")).to.equal("Annual chart");
    });

    it("falls back to a non-empty accessible name when the card content has no derivable text", async () => {
      const el = (await fixture(html`
        <lr-card actionable>
          <img slot="image" alt="" />
        </lr-card>
      `)) as LyraCard;
      const activation = el.shadowRoot!.querySelector(
        '[part="activation-button"]'
      ) as HTMLButtonElement;
      expect(activation.getAttribute("aria-label")).to.not.equal("");
      expect(activation.hasAttribute("aria-label")).to.be.true;
      await expect(el).to.be.accessible();
    });

    it("uses the native activation button for keyboard-equivalent activation", async () => {
      const el = (await fixture(
        html`<lr-card actionable>body</lr-card>`
      )) as LyraCard;
      const activation = el.shadowRoot!.querySelector(
        '[part="activation-button"]'
      ) as HTMLButtonElement;
      const fired = oneEvent(el, "lr-card-activate");
      activation.click();
      await fired;
    });

    it("forwards host click() to the native activation button exactly once", async () => {
      const el = (await fixture(
        html`<lr-card actionable>body</lr-card>`
      )) as LyraCard;
      let activations = 0;
      el.addEventListener("lr-card-activate", () => (activations += 1));

      el.click();

      expect(activations).to.equal(1);
    });

    it("forwards host click() to the linked anchor without emitting lr-card-activate", async () => {
      const el = (await fixture(
        html`<lr-card href="/reports">body</lr-card>`
      )) as LyraCard;
      const anchor = el.shadowRoot!.querySelector<HTMLAnchorElement>('a[part="base"]')!;
      let linkActivations = 0;
      let cardActivations = 0;
      anchor.addEventListener("click", (event) => {
        event.preventDefault();
        linkActivations += 1;
      });
      el.addEventListener("lr-card-activate", () => (cardActivations += 1));

      el.click();

      expect(linkActivations).to.equal(1);
      expect(cardActivations).to.equal(0);
    });

    it("keeps host click() inert for a passive card", async () => {
      const el = (await fixture(html`<lr-card>body</lr-card>`)) as LyraCard;
      const root = base(el);
      let rootClicks = 0;
      root.addEventListener("click", () => (rootClicks += 1));

      el.click();

      expect(rootClicks).to.equal(0);
    });

    it("forwards the host aria-label to the native activation owner and keeps it live", async () => {
      const el = (await fixture(
        html`<lr-card actionable aria-label="Open project">body</lr-card>`
      )) as LyraCard;
      const activation = el.shadowRoot!.querySelector(
        '[part="activation-button"]'
      ) as HTMLButtonElement;
      expect(activation.getAttribute("aria-label")).to.equal("Open project");

      el.setAttribute("aria-label", "Open archived project");
      await el.updateComplete;
      expect(activation.getAttribute("aria-label")).to.equal(
        "Open archived project"
      );
    });

    it("retains an explicit empty accessible label before falling back to card content", async () => {
      const el = (await fixture(
        html`<lr-card actionable aria-label="">Monthly report</lr-card>`
      )) as LyraCard;
      const activation = el.shadowRoot!.querySelector(
        '[part="activation-button"]'
      ) as HTMLButtonElement;

      expect(activation.getAttribute("aria-label")).to.equal("");

      el.removeAttribute("aria-label");
      await el.updateComplete;
      expect(activation.getAttribute("aria-label")).to.equal("Monthly report");

      el.accessibleLabel = "";
      await el.updateComplete;
      expect(activation.getAttribute("aria-label")).to.equal("");
    });

    it("refreshes its content-derived activation name after detached text changes", async () => {
      const el = (await fixture(
        html`<lr-card actionable>Original project</lr-card>`
      )) as LyraCard;
      const parent = el.parentElement!;
      el.remove();
      el.textContent = "Renamed while detached";
      parent.append(el);
      await el.updateComplete;

      const activation = el.shadowRoot!.querySelector(
        '[part="activation-button"]'
      ) as HTMLButtonElement;
      expect(activation.getAttribute("aria-label")).to.equal(
        "Renamed while detached"
      );
    });

    it("does not emit when the click originates in a slotted interactive control", async () => {
      const el = (await fixture(html`
        <lr-card actionable>
          <lr-button slot="actions">Edit</lr-button>
          <a href="#x" id="deep-link">Deep link</a>
          <span id="plain">Plain text</span>
        </lr-card>
      `)) as LyraCard;
      let count = 0;
      el.addEventListener("lr-card-activate", () => (count += 1));

      (el.querySelector("lr-button") as HTMLElement).click();
      (el.querySelector("#deep-link") as HTMLElement).click();
      await el.updateComplete;
      expect(count).to.equal(0);

      // A click on non-interactive slotted content still activates the card.
      (el.querySelector("#plain") as HTMLElement).dispatchEvent(
        new MouseEvent("click", { bubbles: true, composed: true })
      );
      await el.updateComplete;
      expect(count).to.equal(1);
    });

    it("uses the adopted owner observer and recognizes a destination-realm nested control", async () => {
      const el = (await fixture(html`<lr-card actionable>body</lr-card>`)) as LyraCard;
      await el.updateComplete;
      el.remove();
      const iframe = document.createElement("iframe");
      document.body.append(iframe);
      const frameDocument = iframe.contentDocument;
      const frameWindow = iframe.contentWindow;
      if (!frameDocument || !frameWindow) {
        iframe.remove();
        throw new Error("The iframe realm was unavailable.");
      }
      const originalMutationObserver = frameWindow.MutationObserver;
      let observations = 0;
      let disconnects = 0;
      class OwnerMutationObserver implements MutationObserver {
        private observesCard = false;
        constructor(_callback: MutationCallback) {}
        observe(target: Node): void {
          if (target === el) {
            this.observesCard = true;
            observations += 1;
          }
        }
        takeRecords(): MutationRecord[] { return []; }
        disconnect(): void { if (this.observesCard) disconnects += 1; }
      }
      frameWindow.MutationObserver = OwnerMutationObserver;

      try {
        frameDocument.body.append(frameDocument.adoptNode(el));
        await el.updateComplete;
        expect(observations, "the destination window observes the card content").to.be.greaterThan(0);
        const button = frameDocument.createElement("button");
        button.textContent = "Edit";
        el.append(button);
        let activations = 0;
        el.addEventListener("lr-card-activate", () => { activations += 1; });
        button.dispatchEvent(new frameWindow.MouseEvent("click", { bubbles: true, composed: true }));
        expect(activations, "the foreign-realm nested button keeps its own click").to.equal(0);

        document.adoptNode(el);
        expect(disconnects, "adoption disconnects the old content observer").to.be.greaterThan(0);
      } finally {
        frameWindow.MutationObserver = originalMutationObserver;
        if (el.ownerDocument !== document) document.adoptNode(el);
        el.remove();
        iframe.remove();
      }
    });

    it("leaves the href path untouched: no tabindex of its own and no lr-card-activate", async () => {
      const el = (await fixture(
        html`<lr-card actionable href="/x">body</lr-card>`
      )) as LyraCard;
      const anchor = base(el);
      expect(anchor.tagName.toLowerCase()).to.equal("a");
      // The <a href> is already natively focusable and natively activated by Enter -- adding a
      // tabindex or a synthetic activation event would double-fire the navigation.
      expect(anchor.hasAttribute("tabindex")).to.be.false;
      expect(el.shadowRoot!.querySelector('[part="activation-button"]') === null).to.be.true;

      let fired = false;
      el.addEventListener("lr-card-activate", () => (fired = true));
      key(anchor, "Enter");
      key(anchor, " ");
      await el.updateComplete;
      expect(fired).to.be.false;
    });

    it("without actionable, renders passive output and never emits", async () => {
      const el = (await fixture(html`<lr-card>body</lr-card>`)) as LyraCard;
      expect(base(el).hasAttribute("tabindex")).to.be.false;
      expect(base(el).hasAttribute("role")).to.be.false;
      expect(el.shadowRoot!.querySelector('[part="activation-button"]') === null).to.be.true;

      let fired = false;
      el.addEventListener("lr-card-activate", () => (fired = true));
      base(el).click();
      key(base(el), "Enter");
      key(base(el), " ");
      await el.updateComplete;
      expect(fired).to.be.false;
    });
  });

  describe("upstream layout surface", () => {
    it("defaults to vertical and keeps every SSR presence hint opt-in", async () => {
      const el = (await fixture(html`<lr-card>body</lr-card>`)) as LyraCard;
      expect(el.orientation).to.equal("vertical");
      expect(el.getAttribute("orientation")).to.equal("vertical");
      expect(el.withHeader).to.be.false;
      expect(el.withHeaderActions).to.be.false;
      expect(el.withMedia).to.be.false;
      expect(el.withFooter).to.be.false;
      expect(el.withFooterActions).to.be.false;
    });

    it("accepts Shoelace image as the same rendered media/image wrapper", async () => {
      const el = (await fixture(html`<lr-card>
        <img slot="image" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />
        body
      </lr-card>`)) as LyraCard;
      const media = el.shadowRoot!.querySelector('[part~="media"]') as HTMLElement;
      expect(media.part.contains("image")).to.be.true;
      expect(media.hidden).to.be.false;
      const imageSlot = media.querySelector('slot[name="image"]') as HTMLSlotElement;
      expect(imageSlot.assignedElements()).to.have.length(1);
    });

    it("renders header-actions and footer-actions alongside their sections", async () => {
      const el = (await fixture(html`<lr-card>
        <strong slot="header">Heading</strong>
        <button slot="header-actions">Settings</button>
        body
        <span slot="footer">Updated today</span>
        <button slot="footer-actions">Share</button>
      </lr-card>`)) as LyraCard;
      const header = el.shadowRoot!.querySelector('[part="header"]') as HTMLElement;
      const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
      const footer = el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement;
      expect(header.hidden).to.be.false;
      expect(actions.hidden).to.be.false;
      expect(footer.hidden).to.be.false;
      expect(
        (actions.querySelector('slot[name="header-actions"]') as HTMLSlotElement).assignedElements()
      ).to.have.length(1);
      expect(
        (footer.querySelector('slot[name="footer-actions"]') as HTMLSlotElement).assignedElements()
      ).to.have.length(1);
    });

    it("uses with-* hints to render empty section wrappers before slot discovery", async () => {
      const el = (await fixture(html`<lr-card
        with-header
        with-header-actions
        with-media
        with-footer
        with-footer-actions
      >body</lr-card>`)) as LyraCard;
      expect((el.shadowRoot!.querySelector('[part~="media"]') as HTMLElement).hidden).to.be.false;
      expect((el.shadowRoot!.querySelector('[part="header"]') as HTMLElement).hidden).to.be.false;
      expect((el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement).hidden).to.be.false;
      expect((el.shadowRoot!.querySelector('[part="footer"]') as HTMLElement).hidden).to.be.false;
    });

    it("lays out a horizontal card side-by-side, then stacks at a narrow allocation", async () => {
      const wide = (await fixture(html`<lr-card orientation="horizontal" style="inline-size: 40rem">
        <span slot="media">media</span>body<span slot="actions">actions</span>
      </lr-card>`)) as LyraCard;
      expect(getComputedStyle(base(wide)).flexDirection).to.equal("row");

      const narrow = (await fixture(html`<lr-card orientation="horizontal" style="inline-size: 20rem">
        <span slot="media">media</span>body<span slot="actions">actions</span>
      </lr-card>`)) as LyraCard;
      expect(getComputedStyle(base(narrow)).flexDirection).to.equal("column");

      const wideLinked = (await fixture(html`<lr-card href="#details" orientation="horizontal" style="inline-size: 40rem">
        <span slot="media">media</span>body<span slot="actions">actions</span>
      </lr-card>`)) as LyraCard;
      expect(
        getComputedStyle(
          wideLinked.shadowRoot!.querySelector<HTMLElement>(".linked-content")!
        ).flexDirection
      ).to.equal("row");

      const narrowLinked = (await fixture(html`<lr-card href="#details" orientation="horizontal" style="inline-size: 20rem">
        <span slot="media">media</span>body<span slot="actions">actions</span>
      </lr-card>`)) as LyraCard;
      expect(
        getComputedStyle(
          narrowLinked.shadowRoot!.querySelector<HTMLElement>(".linked-content")!
        ).flexDirection
      ).to.equal("column");
    });

    it("consumes --spacing for section rhythm", async () => {
      const el = (await fixture(html`<lr-card style="--spacing: 11px">body</lr-card>`)) as LyraCard;
      const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
      expect(getComputedStyle(body).paddingInlineStart).to.equal("11px");
      expect(getComputedStyle(body).paddingBlockStart).to.equal("11px");
    });

    it("is accessible with every vertical action slot populated", async () => {
      const el = (await fixture(html`<lr-card>
        <strong slot="header">Heading</strong>
        <button slot="header-actions">Settings</button>
        Body
        <span slot="footer">Updated today</span>
        <button slot="footer-actions">Share</button>
      </lr-card>`)) as LyraCard;
      await expect(el).to.be.accessible();
    });
  });

  describe("definite-allocation overflow", () => {
    it("clips body content that outgrows a definite allocation, because base overflow is the media corner clip", async () => {
      const tiles = await fixture<HTMLElement>(html`
        <div style="display: grid; grid-template-rows: 160px; inline-size: 20rem">
          <lr-card>
            <div style="block-size: 600px">tall body</div>
          </lr-card>
        </div>
      `);
      const el = tiles.querySelector<LyraCard>('lr-card')!;
      await el.updateComplete;
      const root = base(el);
      const body = el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;

      expect(root.clientHeight).to.be.at.most(160);
      expect(root.scrollHeight > root.clientHeight).to.be.true;
      expect(
        Math.round(body.getBoundingClientRect().bottom - root.getBoundingClientRect().bottom) > 0
      ).to.be.true;
    });

    it("gives the body its own scroll owner through ::part(body), the documented escape hatch", async () => {
      const tiles = await fixture<HTMLElement>(html`
        <div class="tiles" style="display: grid; grid-template-rows: 160px; inline-size: 20rem">
          <style>
            .tiles lr-card::part(body) {
              overflow: auto;
            }
          </style>
          <lr-card>
            <div style="block-size: 600px">tall body</div>
          </lr-card>
        </div>
      `);
      const el = tiles.querySelector<LyraCard>('lr-card')!;
      await el.updateComplete;
      const root = base(el);
      const body = el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;

      expect(body.scrollHeight > body.clientHeight).to.be.true;
      expect(root.scrollHeight).to.equal(root.clientHeight);
      expect(
        Math.round(body.getBoundingClientRect().bottom - root.getBoundingClientRect().bottom) <= 0
      ).to.be.true;
      body.scrollTop = 200;
      expect(body.scrollTop > 0).to.be.true;
    });

    it("keeps the same ::part(body) escape hatch working inside the linked-content twin", async () => {
      const tiles = await fixture<HTMLElement>(html`
        <div class="linked-tiles" style="display: grid; grid-template-rows: 160px; inline-size: 20rem">
          <style>
            .linked-tiles lr-card::part(body) {
              overflow: auto;
            }
          </style>
          <lr-card href="#details">
            <div style="block-size: 600px">tall body</div>
          </lr-card>
        </div>
      `);
      const el = tiles.querySelector<LyraCard>('lr-card')!;
      await el.updateComplete;
      const shell = el.shadowRoot!.querySelector<HTMLElement>('.linked-content')!;
      const body = el.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;

      expect(body.scrollHeight > body.clientHeight).to.be.true;
      expect(shell.scrollHeight).to.equal(shell.clientHeight);
    });
  });
});

describe("linked card border-radius stays in sync with its visible content clip", () => {
  it("keeps a non-linked card's [part=base] following a direct ::part(base) override (unset-regression: only the linked-mode overlay is pinned)", async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div class="plain-radius-probe">
        <style>
          .plain-radius-probe lr-card::part(base) {
            border-radius: 22px;
          }
        </style>
        <lr-card>plain body</lr-card>
      </div>
    `);
    const el = wrapper.querySelector<LyraCard>("lr-card")!;
    await el.updateComplete;
    expect(getComputedStyle(base(el)).borderRadius).to.equal("22px");
  });

  it("keeps a linked card's invisible overlay and visible content clip radius identical through the --border-radius hook", async () => {
    const el = (await fixture(
      html`<lr-card href="/x" style="--border-radius: 17px">body</lr-card>`
    )) as LyraCard;
    const anchor = el.shadowRoot!.querySelector<HTMLElement>('a[part="base"]')!;
    const content = el.shadowRoot!.querySelector<HTMLElement>(".linked-content")!;
    expect(getComputedStyle(anchor).borderRadius).to.equal("17px");
    expect(getComputedStyle(content).borderRadius).to.equal("17px");
  });

  it("never lets a direct ::part(base) override reshape only the invisible overlay (defect: used to mismatch the visible content clip)", async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div class="linked-radius-probe">
        <style>
          .linked-radius-probe lr-card::part(base) {
            border-radius: 31px;
          }
        </style>
        <lr-card href="/x">body</lr-card>
      </div>
    `);
    const el = wrapper.querySelector<LyraCard>("lr-card")!;
    await el.updateComplete;
    const anchor = el.shadowRoot!.querySelector<HTMLElement>('a[part="base"]')!;
    const content = el.shadowRoot!.querySelector<HTMLElement>(".linked-content")!;
    const anchorRadius = getComputedStyle(anchor).borderRadius;
    // The overlay's own radius never drifts from the visible clip's -- a ::part(base) rule alone
    // can no longer reshape one without the other, so there is no radius it can set that produces
    // mismatched corners.
    expect(anchorRadius).to.not.equal("31px");
    expect(getComputedStyle(content).borderRadius).to.equal(anchorRadius);
  });
});

it("restores the declared appearance and orientation defaults when attributes are removed", async () => {
  const el = (await fixture(
    html`<lr-card appearance="accent" orientation="horizontal"></lr-card>`
  )) as LyraCard;
  el.removeAttribute("appearance");
  el.removeAttribute("orientation");
  await el.updateComplete;
  expect(el.appearance).to.equal("outlined");
  expect(el.orientation).to.equal("vertical");
});

it('retunes the accent leading stripe width from the shared border-width-thick token', async () => {
  const el = (await fixture(
    html`<lr-card appearance="accent" style="--lr-theme-border-width-thick: 9px">Accent</lr-card>`
  )) as LyraCard;
  expect(getComputedStyle(base(el)).borderInlineStartWidth).to.equal('9px');
});

it('mirrors the accent leading stripe to the physically opposite edge under dir="rtl"', async () => {
  const ltr = (await fixture(
    html`<lr-card appearance="accent">Accent</lr-card>`
  )) as LyraCard;
  const rtl = (await fixture(
    html`<lr-card appearance="accent" dir="rtl">Accent</lr-card>`
  )) as LyraCard;
  const ltrComputed = getComputedStyle(base(ltr));
  const rtlComputed = getComputedStyle(base(rtl));

  // The thick stripe stays on the *logical* start edge -- physically the left in ltr, the right
  // in rtl -- so it swaps sides between the two fixtures, and each fixture's own two physical
  // sides differ from each other.
  expect(ltrComputed.borderLeftWidth).to.equal(rtlComputed.borderRightWidth);
  expect(ltrComputed.borderLeftWidth).to.not.equal(ltrComputed.borderRightWidth);
  expect(rtlComputed.borderLeftWidth).to.not.equal(rtlComputed.borderRightWidth);
});

it('inherits independent appearance and interactive-state paint from an ancestor', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="
      --lr-transition-fast: 0ms;
      --lr-card-filled-bg: rgb(1, 2, 3);
      --lr-card-filled-outlined-bg: rgb(4, 5, 6);
      --lr-card-accent-border-color: rgb(7, 8, 9);
      --lr-card-interactive-hover-border-color: rgb(10, 11, 12);
      --lr-card-interactive-active-border-color: rgb(13, 14, 15);
      --lr-card-interactive-active-overlay: rgb(16, 17, 18);
    ">
      <lr-card appearance="filled">Filled</lr-card>
      <lr-card appearance="filled-outlined">Filled outlined</lr-card>
      <lr-card appearance="accent">Accent</lr-card>
      <lr-card actionable>Interactive</lr-card>
    </div>
  `);
  const cards = wrapper.querySelectorAll<LyraCard>('lr-card');
  expect(getComputedStyle(base(cards[0]!)).backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(base(cards[1]!)).backgroundColor).to.equal('rgb(4, 5, 6)');
  expect(getComputedStyle(base(cards[2]!)).borderInlineStartColor).to.equal('rgb(7, 8, 9)');

  const target = base(cards[3]!);
  cards[3]!.style.setProperty('--lr-transition-fast', '0ms');
  try {
    await hoverUntilMatched(target, 'the interactive card never reported :hover');
    await waitUntil(
      () => getComputedStyle(target).borderTopColor === 'rgb(10, 11, 12)',
      'target border color never reached its hover value',
    );
    await sendMouse({ type: 'down' });
    await waitUntil(
      () => getComputedStyle(target).borderTopColor === 'rgb(13, 14, 15)',
      'target border color never reached its pressed value',
    );
    const pressed = getComputedStyle(target);
    expect(pressed.backgroundImage).to.include('rgb(16, 17, 18)');
  } finally {
    await resetMouse();
  }
});

describe("a slotted [hidden] media child", () => {
  it("is removed from the rendered box, not just from the accessibility tree", async () => {
    const el = (await fixture(html`
      <lr-card>
        <span id="gone" slot="media" hidden>hidden media</span>
        body
      </lr-card>
    `)) as LyraCard;
    await el.updateComplete;
    const gone = el.querySelector<HTMLElement>("#gone")!;
    expect(getComputedStyle(gone).display).to.equal("none");
    expect(gone.getClientRects().length).to.equal(0);
  });

  it("still lets find-in-page reveal a hidden='until-found' media child", async () => {
    const el = (await fixture(html`
      <lr-card>
        <span id="findable" slot="media" hidden="until-found">collapsed media</span>
        body
      </lr-card>
    `)) as LyraCard;
    await el.updateComplete;
    const findable = el.querySelector<HTMLElement>("#findable")!;
    expect(getComputedStyle(findable).display).to.equal("block");
  });

  it('localizes the activation fallback name and honours a .strings override', async () => {
    // `card.class.ts` falls back to localize('open') for an activatable card whose content has no
    // text of its own (an image-only or chart tile), so that the button still has a non-empty
    // accessible name. That fallback must go through the localization layer, not a hard-coded
    // literal -- a literal would defeat registerLyraLocale() permanently.
    const el = await fixture<LyraCard>(html`<lr-card actionable></lr-card>`);
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="activation-button"]') as HTMLElement;
    expect(button.getAttribute('aria-label')).to.equal('Open');

    el.strings = { open: 'Ouvrir' };
    await el.updateComplete;
    expect(button.getAttribute('aria-label')).to.equal('Ouvrir');
  });
});

describe('--lr-card-shadow / --lr-card-interactive-hover-shadow', () => {
  it('renders no box-shadow when --lr-card-shadow is unset (regression)', async () => {
    const el = (await fixture(html`<lr-card>Body</lr-card>`)) as LyraCard;
    expect(getComputedStyle(base(el)).boxShadow).to.equal('none');
  });

  it('applies a box-shadow through --lr-card-shadow', async () => {
    const el = (await fixture(
      html`<lr-card style="--lr-card-shadow: 0 4px 8px rgba(0, 0, 0, 0.3)">Body</lr-card>`
    )) as LyraCard;
    const probe = document.createElement('span');
    probe.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.3)';
    document.body.appendChild(probe);
    const expected = getComputedStyle(probe).boxShadow;
    document.body.removeChild(probe);
    expect(getComputedStyle(base(el)).boxShadow).to.equal(expected);
  });

  it('keeps the resting shadow on hover when --lr-card-interactive-hover-shadow is unset (regression)', async () => {
    const el = (await fixture(
      html`<lr-card
        actionable
        style="--lr-transition-fast: 0ms; --lr-card-shadow: 0 4px 8px rgba(0, 0, 0, 0.3)"
        >Body</lr-card
      >`
    )) as LyraCard;
    const target = base(el);
    const resting = getComputedStyle(target).boxShadow;
    try {
      await hoverUntilMatched(target, 'the actionable card never reported :hover');
      expect(getComputedStyle(target).boxShadow).to.equal(resting);
    } finally {
      await resetMouse();
    }
  });

  it('overrides the hover shadow independently of the resting one', async () => {
    const el = (await fixture(
      html`<lr-card
        actionable
        style="--lr-transition-fast: 0ms; --lr-card-shadow: none; --lr-card-interactive-hover-shadow: 0 8px 16px rgba(0, 0, 0, 0.4)"
        >Body</lr-card
      >`
    )) as LyraCard;
    const target = base(el);
    expect(getComputedStyle(target).boxShadow).to.equal('none');
    const probe = document.createElement('span');
    probe.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.4)';
    document.body.appendChild(probe);
    const expected = getComputedStyle(probe).boxShadow;
    document.body.removeChild(probe);
    try {
      await hoverUntilMatched(target, 'the actionable card never reported :hover');
      await waitUntil(
        () => getComputedStyle(target).boxShadow === expected,
        'hover shadow override never rendered',
      );
      expect(getComputedStyle(target).boxShadow).to.equal(expected);
    } finally {
      await resetMouse();
    }
  });
});

describe('lr-card focus-repair and observer hardening', () => {
  it('does not steal focus back onto the new owner when something else already holds focus inside the shadow root at repair time', async () => {
    const el = (await fixture(html`<lr-card actionable>body</lr-card>`)) as LyraCard;
    (el.shadowRoot!.querySelector('[part="activation-button"]') as HTMLElement).focus();
    expect(el.ownerDocument.activeElement === el, 'sanity: focus starts inside the card shadow tree').to.equal(true);

    const decoy = document.createElement('button');
    Object.defineProperty(el.shadowRoot!, 'activeElement', { configurable: true, get: () => decoy });
    try {
      el.actionable = false;
      await el.updateComplete;
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(
        el.ownerDocument.activeElement === el,
        'the repair must not re-target the new owner while the decoy fakes ownership of internal focus',
      ).to.equal(false);
    } finally {
      Reflect.deleteProperty(el.shadowRoot!, 'activeElement');
      decoy.remove();
    }
  });

  it('does not arm a content observer for a manually invoked connectedCallback on a detached element', () => {
    const el = document.createElement('lr-card') as LyraCard;
    const access = el as unknown as { connectedCallback(): void };
    expect(() => access.connectedCallback()).not.to.throw();
    expect((el as unknown as { contentObserver?: MutationObserver }).contentObserver).to.equal(undefined);
  });

  it('mounts without a MutationObserver, leaving the initial accessible content sample intact', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'MutationObserver');
    try {
      // @ts-expect-error deliberately removing the global for this assertion
      delete window.MutationObserver;
      const el = (await fixture(html`<lr-card actionable>Report content</lr-card>`)) as LyraCard;
      const activation = el.shadowRoot!.querySelector('[part="activation-button"]') as HTMLElement;
      expect(activation.getAttribute('aria-label')).to.equal('Report content');
    } finally {
      if (descriptor) Object.defineProperty(window, 'MutationObserver', descriptor);
    }
  });
});

describe('lr-card parity pass: default-tier background token, disabled, pressed/current forwarding', () => {
  const activation = (el: LyraCard): HTMLButtonElement =>
    el.shadowRoot!.querySelector('[part="activation-button"]') as HTMLButtonElement;
  const anchor = (el: LyraCard): HTMLAnchorElement =>
    el.shadowRoot!.querySelector('a[part="base"]') as HTMLAnchorElement;

  it('retints the default appearance through --lr-card-outlined-bg', async () => {
    const el = (await fixture(
      html`<lr-card style="--lr-card-outlined-bg: rgb(1, 2, 3)">body</lr-card>`
    )) as LyraCard;
    expect(getComputedStyle(base(el)).backgroundColor).to.equal('rgb(1, 2, 3)');
  });

  it('leaves the default appearance on the shared surface token when --lr-card-outlined-bg is unset', async () => {
    const el = (await fixture(
      html`<lr-card style="--lr-color-surface: rgb(4, 5, 6)">body</lr-card>`
    )) as LyraCard;
    expect(getComputedStyle(base(el)).backgroundColor).to.equal('rgb(4, 5, 6)');
  });

  it('keeps the filled tier reading its own token rather than the new default-tier one', async () => {
    const el = (await fixture(
      html`<lr-card
        appearance="filled"
        style="--lr-card-outlined-bg: rgb(1, 2, 3); --lr-card-filled-bg: rgb(7, 8, 9)"
        >body</lr-card
      >`
    )) as LyraCard;
    expect(getComputedStyle(base(el)).backgroundColor).to.equal('rgb(7, 8, 9)');
  });

  it('defaults disabled to false and leaves the actionable card fully operable', async () => {
    const el = (await fixture(html`<lr-card actionable>body</lr-card>`)) as LyraCard;
    expect(el.disabled).to.equal(false);
    expect(el.hasAttribute('disabled')).to.equal(false);
    expect(activation(el).disabled).to.equal(false);
    expect(getComputedStyle(base(el)).opacity).to.equal('1');
  });

  it('reflects disabled, disables the internal activation button, and removes it from the tab order', async () => {
    const el = (await fixture(html`<lr-card actionable disabled>body</lr-card>`)) as LyraCard;
    expect(el.disabled).to.equal(true);
    expect(el.hasAttribute('disabled')).to.equal(true);
    const button = activation(el);
    expect(button.disabled, 'the native activation button carries disabled').to.equal(true);

    button.focus();
    expect(
      el.shadowRoot!.activeElement === button,
      'a disabled activation button must not take focus',
    ).to.equal(false);
  });

  it('never emits lr-card-activate from a disabled card, by pointer, by the button, or through host click()', async () => {
    const el = (await fixture(html`<lr-card actionable disabled>body</lr-card>`)) as LyraCard;
    let activations = 0;
    el.addEventListener('lr-card-activate', () => (activations += 1));

    base(el).click();
    activation(el).click();
    el.click();
    await el.updateComplete;

    expect(activations).to.equal(0);
  });

  it('resumes emitting once disabled is cleared', async () => {
    const el = (await fixture(html`<lr-card actionable disabled>body</lr-card>`)) as LyraCard;
    el.disabled = false;
    await el.updateComplete;
    let activations = 0;
    el.addEventListener('lr-card-activate', () => (activations += 1));
    base(el).click();
    expect(activations).to.equal(1);
  });

  it('applies the disabled opacity and the not-allowed cursor to a disabled actionable card', async () => {
    const el = (await fixture(
      html`<lr-card actionable disabled style="--lr-opacity-disabled: 0.42">body</lr-card>`
    )) as LyraCard;
    const computed = getComputedStyle(base(el));
    expect(computed.opacity).to.equal('0.42');
    expect(computed.cursor).to.equal('not-allowed');
  });

  it('strips href from a disabled linked card and marks the anchor aria-disabled', async () => {
    const el = (await fixture(
      html`<lr-card href="/reports" disabled style="--lr-opacity-disabled: 0.42">body</lr-card>`
    )) as LyraCard;
    const link = anchor(el);
    expect(link.hasAttribute('href'), 'a disabled link card cannot navigate').to.equal(false);
    expect(link.getAttribute('aria-disabled')).to.equal('true');
    expect(link.getAttribute('tabindex')).to.equal('-1');
    const content = el.shadowRoot!.querySelector('.linked-content') as HTMLElement;
    expect(getComputedStyle(content).opacity).to.equal('0.42');
  });

  it('renders aria-disabled="false" on an enabled linked card and keeps its href', async () => {
    const el = (await fixture(html`<lr-card href="/reports">body</lr-card>`)) as LyraCard;
    const link = anchor(el);
    expect(link.getAttribute('href')).to.equal('/reports');
    expect(link.getAttribute('aria-disabled')).to.equal('false');
    expect(link.hasAttribute('tabindex')).to.equal(false);
  });

  it('does not forward a linked-content click to the anchor while disabled', async () => {
    const el = (await fixture(html`<lr-card href="/reports" disabled>body</lr-card>`)) as LyraCard;
    let anchorClicks = 0;
    anchor(el).addEventListener('click', (event) => {
      event.preventDefault();
      anchorClicks += 1;
    });
    (el.shadowRoot!.querySelector('[part="body"]') as HTMLElement).click();
    expect(anchorClicks).to.equal(0);
  });

  it('forwards host aria-pressed and aria-current reactively onto the activation button', async () => {
    const el = (await fixture(
      html`<lr-card actionable aria-label="Trip 4021" aria-pressed="true" aria-current="page"
        >body</lr-card
      >`
    )) as LyraCard;
    expect(activation(el).getAttribute('aria-pressed')).to.equal('true');
    expect(activation(el).getAttribute('aria-current')).to.equal('page');

    el.setAttribute('aria-pressed', 'false');
    await el.updateComplete;
    expect(activation(el).getAttribute('aria-pressed')).to.equal('false');

    el.removeAttribute('aria-pressed');
    el.removeAttribute('aria-current');
    await el.updateComplete;
    expect(activation(el).hasAttribute('aria-pressed')).to.equal(false);
    expect(activation(el).hasAttribute('aria-current')).to.equal(false);
  });

  it('ignores values outside the aria-pressed/aria-current vocabularies', async () => {
    const el = (await fixture(
      html`<lr-card actionable aria-label="Trip" aria-pressed="yes" aria-current="maybe"
        >body</lr-card
      >`
    )) as LyraCard;
    expect(activation(el).hasAttribute('aria-pressed')).to.equal(false);
    expect(activation(el).hasAttribute('aria-current')).to.equal(false);
  });

  it('forwards aria-current onto a linked card anchor, but never aria-pressed', async () => {
    const el = (await fixture(
      html`<lr-card href="/reports" aria-label="Reports" aria-pressed="mixed" aria-current="page"
        >body</lr-card
      >`
    )) as LyraCard;
    expect(anchor(el).getAttribute('aria-current')).to.equal('page');
    expect(
      anchor(el).hasAttribute('aria-pressed'),
      'a link is not a toggle -- aria-pressed is not in role=link\'s supported set',
    ).to.equal(false);
    await expect(el).to.be.accessible();
  });

  it('keeps the link role explicit on a disabled link, whose dropped href would otherwise drop it', async () => {
    const el = (await fixture(
      html`<lr-card href="/reports" disabled aria-pressed="true" aria-current="page" aria-label="Reports"
        >body</lr-card
      >`
    )) as LyraCard;
    const link = anchor(el);
    expect(link.getAttribute('role'), 'the dropped href must be replaced by an explicit role').to.equal('link');
    expect(link.getAttribute('aria-current')).to.equal('page');
    expect(link.hasAttribute('aria-pressed')).to.equal(false);
    // color-contrast is excluded, not ignored: the whole card paints at --lr-opacity-disabled,
    // and WCAG 1.4.3 exempts text that is part of an inactive user interface component. axe
    // cannot see that exemption here because the opacity sits on a shadow ancestor rather than on
    // the text node's own disabled control.
    await expect(el).to.be.accessible({ ignoredRules: ['color-contrast'] });
  });

  it('restores the forwarded state once a disabled link is re-enabled', async () => {
    const el = (await fixture(
      html`<lr-card href="/reports" disabled aria-current="page" aria-label="Reports">body</lr-card>`
    )) as LyraCard;
    el.disabled = false;
    await el.updateComplete;
    expect(anchor(el).hasAttribute('role'), 'a live link needs no explicit role').to.equal(false);
    expect(anchor(el).getAttribute('href')).to.equal('/reports');
  });

  it('keeps disabled and the forwarded state across a disconnect/reconnect', async () => {
    const el = (await fixture(
      html`<lr-card actionable disabled aria-pressed="true" aria-label="Trip">body</lr-card>`
    )) as LyraCard;
    const host = el.parentNode as HTMLElement;
    el.remove();
    host.appendChild(el);
    await el.updateComplete;
    expect(el.disabled).to.equal(true);
    expect(activation(el).disabled).to.equal(true);
    expect(activation(el).getAttribute('aria-pressed')).to.equal('true');
  });

  it('stays accessible as a disabled, pressed, right-to-left actionable card', async () => {
    const el = (await fixture(html`
      <lr-card actionable disabled dir="rtl" aria-pressed="true" aria-label="بطاقة">
        <span slot="header">عنوان</span>
        محتوى
      </lr-card>
    `)) as LyraCard;
    await expect(el).to.be.accessible();
  });
});
