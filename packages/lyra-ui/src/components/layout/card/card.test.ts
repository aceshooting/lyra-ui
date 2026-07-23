import { fixture, expect, html, oneEvent } from "@open-wc/testing";
import "./card.js";
import "../../forms/button/button.js";
import type { LyraCard } from "./card.js";

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
  it("renders as a div by default, an <a> when href is set", async () => {
    const plain = (await fixture(html`<lr-card>body</lr-card>`)) as LyraCard;
    expect(plain.shadowRoot!.querySelector('a[part="base"]')).to.not.exist;
    expect(plain.shadowRoot!.querySelector('div[part="base"]')).to.exist;

    const linked = (await fixture(
      html`<lr-card href="/x">body</lr-card>`
    )) as LyraCard;
    const anchor = linked.shadowRoot!.querySelector(
      'a[part="base"]'
    ) as HTMLAnchorElement;
    expect(anchor).to.exist;
    expect(anchor.getAttribute("href")).to.equal("/x");
  });

  it("defaults appearance to outlined, interactive to false", async () => {
    const el = (await fixture(html`<lr-card>body</lr-card>`)) as LyraCard;
    expect(el.appearance).to.equal("outlined");
    expect(el.interactive).to.be.false;
    expect(el.hasAttribute("interactive")).to.be.false;
  });

  it("rejects executable navigation schemes", async () => {
    const el = (await fixture(
      html`<lr-card href="java	script:alert(1)">body</lr-card>`
    )) as LyraCard;
    expect(el.shadowRoot!.querySelector('a[part="base"]')).to.not.exist;
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
    const media = el.shadowRoot!.querySelector('[part="media"]') as HTMLElement;
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
    const media = el.shadowRoot!.querySelector('[part="media"]') as HTMLElement;
    const footer = el.shadowRoot!.querySelector(
      '[part="footer"]'
    ) as HTMLElement;
    expect(header.hasAttribute("hidden")).to.be.true;
    expect(media.hasAttribute("hidden")).to.be.true;
    expect(footer.hasAttribute("hidden")).to.be.true;
  });

  it("reflects appearance/interactive as attributes for CSS selectors", async () => {
    const el = (await fixture(
      html`<lr-card appearance="filled" interactive>body</lr-card>`
    )) as LyraCard;
    expect(el.getAttribute("appearance")).to.equal("filled");
    expect(el.hasAttribute("interactive")).to.be.true;
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
    ) as LyraCard[];
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

  describe("activation without href", () => {
    // The constraint that rules out `role="button"` on `[part='base']`: a card routinely contains
    // slotted buttons/links, and axe-core's `nested-interactive` rule forbids a focusable
    // descendant of a `role="button"` ancestor. Written first, deliberately.
    it("an interactive card containing a slotted lr-button is still accessible", async () => {
      const el = (await fixture(html`
        <lr-card interactive>
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
        html`<lr-card interactive>body</lr-card>`
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

    it("uses the native activation button for keyboard-equivalent activation", async () => {
      const el = (await fixture(
        html`<lr-card interactive>body</lr-card>`
      )) as LyraCard;
      const activation = el.shadowRoot!.querySelector(
        '[part="activation-button"]'
      ) as HTMLButtonElement;
      const fired = oneEvent(el, "lr-card-activate");
      activation.click();
      await fired;
    });

    it("forwards the host aria-label to the native activation owner and keeps it live", async () => {
      const el = (await fixture(
        html`<lr-card interactive aria-label="Open project">body</lr-card>`
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

    it("does not emit when the click originates in a slotted interactive control", async () => {
      const el = (await fixture(html`
        <lr-card interactive>
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

    it("leaves the href path untouched: no tabindex of its own and no lr-card-activate", async () => {
      const el = (await fixture(
        html`<lr-card interactive href="/x">body</lr-card>`
      )) as LyraCard;
      const anchor = base(el);
      expect(anchor.tagName.toLowerCase()).to.equal("a");
      // The <a href> is already natively focusable and natively activated by Enter -- adding a
      // tabindex or a synthetic activation event would double-fire the navigation.
      expect(anchor.hasAttribute("tabindex")).to.be.false;
      expect(el.shadowRoot!.querySelector('[part="activation-button"]')).to.not
        .exist;

      let fired = false;
      el.addEventListener("lr-card-activate", () => (fired = true));
      key(anchor, "Enter");
      key(anchor, " ");
      await el.updateComplete;
      expect(fired).to.be.false;
    });

    it("without interactive, renders exactly today’s passive output and never emits", async () => {
      const el = (await fixture(html`<lr-card>body</lr-card>`)) as LyraCard;
      expect(base(el).hasAttribute("tabindex")).to.be.false;
      expect(base(el).hasAttribute("role")).to.be.false;
      expect(el.shadowRoot!.querySelector('[part="activation-button"]')).to.not
        .exist;

      let fired = false;
      el.addEventListener("lr-card-activate", () => (fired = true));
      base(el).click();
      key(base(el), "Enter");
      key(base(el), " ");
      await el.updateComplete;
      expect(fired).to.be.false;
    });
  });
});
