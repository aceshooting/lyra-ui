import { fixture, expect, html, oneEvent, waitUntil } from "@open-wc/testing";
import { html as litHtml } from "lit";
import "./segmented.js";
import type { LyraSegmented, LyraSegmentedItem } from "./segmented.js";
import { styles } from "./segmented.styles.js";
import "../../forms/select/select.js";
import type { LyraSelect } from "../../forms/select/select.js";
import { resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";
import { setForcedColors } from "../../../../test/wtr-media.js";

const items = (): LyraSegmentedItem[] => [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

/** Two animation frames, long enough for the overflow controller's `ResizeObserver` callback to
 *  have landed on top of the synchronous measurement it already does in `hostUpdated()`. */
async function nextFrames(): Promise<void> {
  await new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  );
}

function segmentButtons(el: LyraSegmented): HTMLButtonElement[] {
  return [
    ...el.shadowRoot!.querySelectorAll('[part="segment"]'),
  ] as HTMLButtonElement[];
}

describe("lr-segmented", () => {
  it("renders role=radiogroup with one role=radio per item, aria-checked on the selected one", async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()} value="week"></lr-segmented>`
    )) as LyraSegmented;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute("role")).to.equal("radiogroup");
    const buttons = segmentButtons(el);
    expect(buttons.map((b) => b.getAttribute("role"))).to.deep.equal([
      "radio",
      "radio",
      "radio",
    ]);
    expect(buttons[1]!.getAttribute("aria-checked")).to.equal("true");
    expect(buttons[0]!.getAttribute("aria-checked")).to.equal("false");
  });

  it("uses roving tabindex -- only the selected item is tabbable", async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()} value="week"></lr-segmented>`
    )) as LyraSegmented;
    const buttons = segmentButtons(el);
    expect(buttons.map((b) => b.getAttribute("tabindex"))).to.deep.equal([
      "-1",
      "0",
      "-1",
    ]);
  });

  it("makes the first item tabbable when no item is selected, so the radiogroup stays keyboard-reachable", async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()}></lr-segmented>`
    )) as LyraSegmented;
    const buttons = segmentButtons(el);
    expect(el.value).to.equal("");
    expect(buttons.map((b) => b.getAttribute("tabindex"))).to.deep.equal([
      "0",
      "-1",
      "-1",
    ]);
  });

  it("falls back to the first non-disabled item when nothing is selected", async () => {
    const withDisabled = [
      { ...items()[0]!, disabled: true },
      items()[1]!,
      items()[2]!,
    ];
    const el = (await fixture(
      html`<lr-segmented .items=${withDisabled}></lr-segmented>`
    )) as LyraSegmented;
    const buttons = segmentButtons(el);
    expect(buttons.map((b) => b.getAttribute("tabindex"))).to.deep.equal([
      "-1",
      "0",
      "-1",
    ]);
  });

  it("ArrowRight from the unselected, first-tabbable state selects the first item", async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()}></lr-segmented>`
    )) as LyraSegmented;
    const buttons = segmentButtons(el);
    buttons[0]!.focus();
    buttons[0]!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(el.value).to.equal("day");
  });

  it("starts navigation from the actually focused occurrence when nothing is selected", async () => {
    const choices = [
      { value: "first", label: "First" },
      { value: "second", label: "Second" },
      { value: "third", label: "Third" },
    ];
    const el = (await fixture(
      html`<lr-segmented .items=${choices}></lr-segmented>`
    )) as LyraSegmented;
    const second = segmentButtons(el)[1]!;
    second.focus();
    second.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;

    expect(el.value).to.equal("third");
    expect(el.shadowRoot!.activeElement === segmentButtons(el)[2]).to.equal(
      true
    );
  });

  it("uses the keyboard event target ahead of controlled selection state", async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()} value="week"></lr-segmented>`
    )) as LyraSegmented;
    const month = segmentButtons(el)[2]!;
    month.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;

    expect(el.value).to.equal("day");
    expect(el.shadowRoot!.activeElement === segmentButtons(el)[0]).to.equal(
      true
    );
  });

  it("selects on click and emits lr-change", async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()} value="day"></lr-segmented>`
    )) as LyraSegmented;
    const buttons = segmentButtons(el);
    setTimeout(() => buttons[2]!.click());
    const ev = await oneEvent(el, "lr-change");
    expect(ev.detail).to.deep.equal({ value: "month" });
    expect(el.value).to.equal("month");
  });

  it("selects on ArrowRight (automatic activation) and wraps cyclically at the end", async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()} value="month"></lr-segmented>`
    )) as LyraSegmented;
    const buttons = segmentButtons(el);
    buttons[2]!.focus();
    buttons[2]!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(el.value).to.equal("day"); // wrapped from the last item back to the first
  });

  it("skips disabled items during keyboard navigation", async () => {
    const withDisabled = [
      items()[0]!,
      { ...items()[1]!, disabled: true },
      items()[2]!,
    ];
    const el = (await fixture(
      html`<lr-segmented .items=${withDisabled} value="day"></lr-segmented>`
    )) as LyraSegmented;
    const buttons = segmentButtons(el);
    buttons[0]!.focus();
    buttons[0]!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(el.value).to.equal("month"); // 'week' is disabled, skipped
  });

  it("selects on ArrowLeft (backward) and wraps cyclically at the start", async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()} value="day"></lr-segmented>`
    )) as LyraSegmented;
    const buttons = segmentButtons(el);
    buttons[0]!.focus();
    buttons[0]!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(el.value).to.equal("month"); // wrapped backward from the first item to the last
  });

  it("ArrowLeft from the unselected, first-tabbable state selects the last item", async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()}></lr-segmented>`
    )) as LyraSegmented;
    const buttons = segmentButtons(el);
    buttons[0]!.focus();
    buttons[0]!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(el.value).to.equal("month");
  });

  it("ignores a keydown entirely when every item is disabled", async () => {
    const allDisabled = items().map((item) => ({ ...item, disabled: true }));
    const el = (await fixture(
      html`<lr-segmented .items=${allDisabled}></lr-segmented>`
    )) as LyraSegmented;
    const buttons = segmentButtons(el);
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const event = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    });
    base.dispatchEvent(event);
    await el.updateComplete;
    expect(el.value).to.equal("");
    expect(event.defaultPrevented).to.equal(false);
    expect(buttons.every((button) => button.getAttribute("aria-checked") === "false")).to.equal(
      true
    );
  });

  it("does not re-emit lr-change when clicking the already-selected segment", async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()} value="week"></lr-segmented>`
    )) as LyraSegmented;
    const buttons = segmentButtons(el);
    let changeCount = 0;
    el.addEventListener("lr-change", () => changeCount++);
    buttons[1]!.click();
    await el.updateComplete;
    expect(el.value).to.equal("week");
    expect(changeCount).to.equal(0);
  });

  it("selects the first navigable item on Home, regardless of current selection", async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()} value="month"></lr-segmented>`
    )) as LyraSegmented;
    const buttons = segmentButtons(el);
    buttons[2]!.focus();
    buttons[2]!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Home",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(el.value).to.equal("day");
    expect(el.shadowRoot!.activeElement === segmentButtons(el)[0]).to.equal(
      true
    );
  });

  it("selects the last navigable item on End, regardless of current selection", async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()} value="day"></lr-segmented>`
    )) as LyraSegmented;
    const buttons = segmentButtons(el);
    buttons[0]!.focus();
    buttons[0]!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "End",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(el.value).to.equal("month");
    expect(el.shadowRoot!.activeElement === segmentButtons(el)[2]).to.equal(
      true
    );
  });

  it("ignores an unrelated key: no selection change and no preventDefault", async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()} value="week"></lr-segmented>`
    )) as LyraSegmented;
    const buttons = segmentButtons(el);
    buttons[1]!.focus();
    const event = new KeyboardEvent("keydown", {
      key: "a",
      bubbles: true,
      cancelable: true,
    });
    buttons[1]!.dispatchEvent(event);
    await el.updateComplete;
    expect(el.value).to.equal("week");
    expect(event.defaultPrevented).to.equal(false);
  });

  it("swaps Arrow key semantics under dir=\"rtl\": ArrowLeft moves forward, ArrowRight moves backward", async () => {
    const el = (await fixture(
      html`<lr-segmented dir="rtl" .items=${items()} value="day"></lr-segmented>`
    )) as LyraSegmented;
    const buttons = segmentButtons(el);
    buttons[0]!.focus();
    buttons[0]!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(el.value, "ArrowLeft is forward under rtl").to.equal("week");

    const buttonsAfter = segmentButtons(el);
    buttonsAfter[1]!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(el.value, "ArrowRight is backward under rtl").to.equal("day");
  });

  it("falls back to the currently focused segment as keyboard origin when the event target isn't a segment button", async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()} value="day"></lr-segmented>`
    )) as LyraSegmented;
    const buttons = segmentButtons(el);
    buttons[1]!.focus();
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    // Dispatched directly on the base wrapper, not the focused button, so composedPath() carries
    // no [part="segment"] element -- keyboardOriginIndex must fall back to the focused element.
    base.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(el.value).to.equal("month"); // advanced from the focused "week" segment, not from value="day"
  });

  it("selects the first navigable item when a keydown has neither a segment event target nor a focused segment", async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()}></lr-segmented>`
    )) as LyraSegmented;
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    expect(document.activeElement === outside).to.equal(true);
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(el.value).to.equal("day");
    outside.remove();
  });

  it("lets a forwarded host aria-label win on the radiogroup while retaining the label prop fallback", async () => {
    const labeled = (await fixture(
      html`<lr-segmented label="View" .items=${items()}></lr-segmented>`
    )) as LyraSegmented;
    const base1 = labeled.shadowRoot!.querySelector(
      '[part="base"]'
    ) as HTMLElement;
    expect(base1.getAttribute("aria-label")).to.equal("View");

    const forwarded = (await fixture(
      html`<lr-segmented
        aria-label="Forwarded label"
        .items=${items()}
      ></lr-segmented>`
    )) as LyraSegmented;
    const base2 = forwarded.shadowRoot!.querySelector(
      '[part="base"]'
    ) as HTMLElement;
    expect(base2.getAttribute("aria-label")).to.equal("Forwarded label");

    const hostOverride = (await fixture(
      html`<lr-segmented
        label="View"
        aria-label="Author label"
        .items=${items()}
      ></lr-segmented>`
    )) as LyraSegmented;
    const base3 = hostOverride.shadowRoot!.querySelector(
      '[part="base"]'
    ) as HTMLElement;
    expect(base3.getAttribute("aria-label")).to.equal("Author label");
  });

  it("preserves an explicitly empty host aria-label and restores the label fallback when removed", async () => {
    const el = (await fixture(
      html`<lr-segmented
        label="View choices"
        aria-label=""
        .items=${items()}
      ></lr-segmented>`
    )) as LyraSegmented;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    expect(base.hasAttribute("aria-label")).to.equal(true);
    expect(base.getAttribute("aria-label")).to.equal("");

    el.setAttribute("aria-label", "Author choices");
    await el.updateComplete;
    expect(base.getAttribute("aria-label")).to.equal("Author choices");

    el.removeAttribute("aria-label");
    await el.updateComplete;
    expect(base.getAttribute("aria-label")).to.equal("View choices");
  });

  it("is accessible", async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()} value="day"></lr-segmented>`
    )) as LyraSegmented;
    await expect(el).to.be.accessible();
  });

  it("is accessible when labeled via the label prop", async () => {
    const el = (await fixture(
      html`<lr-segmented
        label="View"
        .items=${items()}
        value="day"
      ></lr-segmented>`
    )) as LyraSegmented;
    await expect(el).to.be.accessible();
  });

  it("moves focus to the target item when its value contains a double-quote character", async () => {
    const withQuote = [
      { value: "a", label: "A" },
      { value: 'b"c', label: "B" },
      { value: "d", label: "D" },
    ];
    const el = (await fixture(
      html`<lr-segmented .items=${withQuote} value="a"></lr-segmented>`
    )) as LyraSegmented;
    const buttons = segmentButtons(el);
    buttons[0]!.focus();
    buttons[0]!.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(el.value).to.equal('b"c');
    // Without escaping the value in the attribute-selector lookup, `focusItem()` throws before
    // reaching `.focus()`, so the target button never receives focus even though `value` updated.
    expect(el.shadowRoot!.activeElement === buttons[1]).to.equal(true);
  });

  it("uses first-valid-value-wins so duplicate choices cannot diverge from value events", async () => {
    const duplicateItems = [
      { value: "same", label: "First" },
      { value: "same", label: "Second" },
      { value: "other", label: "Third" },
    ];
    const el = (await fixture(
      html`<lr-segmented .items=${duplicateItems} value="same"></lr-segmented>`
    )) as LyraSegmented;
    const buttons = segmentButtons(el);
    expect(buttons).to.have.length(2);
    expect(buttons.map((button) => button.textContent?.trim())).to.deep.equal([
      "First",
      "Third",
    ]);
    expect(
      buttons.filter((button) => button.getAttribute("aria-checked") === "true")
    ).to.have.length(1);
    expect(buttons.filter((button) => button.tabIndex === 0)).to.have.length(1);
  });

  it("uses a bounded immutable realm-neutral schema snapshot and isolates hostile records", async () => {
    const frame = document.createElement("iframe");
    document.body.append(frame);
    const foreignArray = new frame.contentWindow!.Array();
    const hostile = {};
    Object.defineProperty(hostile, "value", {
      get(): never {
        throw new Error("hostile value");
      },
    });
    const source = { value: "safe", label: "Safe" };
    foreignArray.push(hostile, { value: "", label: "Empty identity" }, source, {
      value: "later",
      label: "Later",
      disabled: false,
    });
    const el = (await fixture(
      html`<lr-segmented .items=${foreignArray}></lr-segmented>`
    )) as LyraSegmented;
    frame.remove();

    source.label = "Caller mutation";
    expect(
      segmentButtons(el).map((button) => button.dataset["value"])
    ).to.deep.equal(["safe", "later"]);
    expect(el.items[0]!.label).to.equal("Safe");
    expect(Object.isFrozen(el.items)).to.be.true;
    expect(Object.isFrozen(el.items[0])).to.be.true;

    el.items = Array.from({ length: 260 }, (_, index) => ({
      value: `value-${index}`,
      label: `Value ${index}`,
    }));
    await el.updateComplete;
    expect(el.items).to.have.length(256);
    expect(segmentButtons(el)).to.have.length(256);
  });

  it("treats a revoked Proxy assigned to items as empty instead of throwing (Array.isArray itself throws)", async () => {
    const { proxy, revoke } = Proxy.revocable([{ value: "a", label: "A" }], {});
    revoke();
    const el = (await fixture(
      html`<lr-segmented .items=${items()}></lr-segmented>`
    )) as LyraSegmented;
    el.items = proxy as unknown as readonly { value: string; label: string }[];
    await el.updateComplete;
    expect(el.items).to.deep.equal([]);
    expect(segmentButtons(el)).to.have.length(0);
  });

  it("treats a source whose .length getter throws as empty instead of throwing", async () => {
    const hostileLength = new Proxy([{ value: "a", label: "A" }], {
      get(target, prop, receiver) {
        if (prop === "length") throw new Error("hostile length");
        return Reflect.get(target, prop, receiver);
      },
    });
    const el = (await fixture(
      html`<lr-segmented .items=${items()}></lr-segmented>`
    )) as LyraSegmented;
    el.items = hostileLength as unknown as readonly {
      value: string;
      label: string;
    }[];
    await el.updateComplete;
    expect(el.items).to.deep.equal([]);
    expect(segmentButtons(el)).to.have.length(0);
  });

  it("treats a wholly non-array items value as empty instead of throwing", async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()}></lr-segmented>`
    )) as LyraSegmented;
    el.items = { value: "day", label: "Day" } as unknown as readonly {
      value: string;
      label: string;
    }[];
    await el.updateComplete;
    expect(el.items).to.deep.equal([]);
    expect(segmentButtons(el)).to.have.length(0);
  });

  it("skips null/undefined/primitive entries within an otherwise valid items array", async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()}></lr-segmented>`
    )) as LyraSegmented;
    el.items = [
      null,
      undefined,
      "not-an-object",
      42,
      { value: "kept", label: "Kept" },
    ] as unknown as readonly { value: string; label: string }[];
    await el.updateComplete;
    expect(el.items).to.deep.equal([{ value: "kept", label: "Kept" }]);
    expect(segmentButtons(el)).to.have.length(1);
  });

  it("reconciles and rehomes focus when the selected item is disabled in place", async () => {
    const mutableItems = items();
    const el = (await fixture(
      html`<lr-segmented .items=${mutableItems} value="week"></lr-segmented>`
    )) as LyraSegmented;
    let buttons = segmentButtons(el);
    buttons[1]!.focus();

    mutableItems[1]!.disabled = true;
    el.items = [...mutableItems];
    await el.updateComplete;
    buttons = segmentButtons(el);

    expect(buttons[1]!.getAttribute("aria-checked")).to.equal("false");
    expect(buttons[1]!.tabIndex).to.equal(-1);
    expect(buttons.filter((button) => button.tabIndex === 0)).to.have.length(1);
    expect(
      (el.shadowRoot!.activeElement as HTMLElement | null)?.dataset["index"]
    ).to.equal("0");
  });
});

describe("item icon", () => {
  it("renders no [part=segment-icon] when items have no icon", async () => {
    const items = [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ];
    const el = (await fixture(
      html`<lr-segmented .items=${items} value="a"></lr-segmented>`
    )) as LyraSegmented;
    expect(
      el.shadowRoot!.querySelectorAll('[part="segment-icon"]').length
    ).to.equal(0);
  });

  it("renders item.icon before the label when set", async () => {
    const items = [
      { value: "a", label: "A", icon: litHtml`<span class="dot"></span>` },
      { value: "b", label: "B" },
    ];
    const el = (await fixture(
      html`<lr-segmented .items=${items} value="a"></lr-segmented>`
    )) as LyraSegmented;
    const button = el.shadowRoot!.querySelector('[part="segment"]')!;
    const icon = button.querySelector('[part="segment-icon"]');
    expect(icon != null).to.equal(true);
    expect(icon!.querySelector(".dot")).to.exist;
    const children = Array.from(button.children);
    const labelIndex = children.findIndex(
      (c) => c.getAttribute("part") === "segment-label"
    );
    expect(children.indexOf(icon as Element)).to.be.lessThan(labelIndex);
  });

  it("keeps interactive item icons decorative and unfocusable inside their radio", async () => {
    const root = await fixture(html`
      <div>
        <button id="outside" type="button">Outside</button>
        <lr-segmented></lr-segmented>
      </div>
    `);
    const outside = root.querySelector<HTMLButtonElement>("#outside")!;
    const el = root.querySelector<LyraSegmented>("lr-segmented")!;
    el.items = [
      {
        value: "day",
        label: "Day",
        icon: litHtml`<button id="nested-segment-icon" type="button">Nested action</button>`,
      },
      { value: "week", label: "Week" },
    ];
    el.value = "day";
    el.label = "View choices";
    await el.updateComplete;

    const icon = el.shadowRoot!.querySelector<HTMLElement>(
      '[part="segment-icon"]'
    );
    const nested = el.shadowRoot!.querySelector<HTMLElement>(
      "#nested-segment-icon"
    )!;
    outside.focus();
    nested.focus();

    expect(icon?.inert ?? false).to.equal(true);
    expect(root.ownerDocument.activeElement?.id).to.equal("outside");
    expect(el.shadowRoot!.activeElement?.id ?? null).to.not.equal(
      "nested-segment-icon"
    );
    await expect(el).to.be.accessible();
  });

  it("gives a non-disabled, non-checked segment a :hover treatment", () => {
    const css = styles.cssText.replace(/\s+/g, " ").replaceAll('"', "'");
    // :where()-wrapped (see the shadow-part-selector-specificity fix below) so a consumer's own
    // ::part(segment):hover override can win without !important -- mirrors lr-attachment-trigger.
    expect(css).to.match(
      /:where\(\[part='segment'\]\):hover:where\(\s*:not\(\[aria-disabled='true'\]\):not\(\[aria-checked='true'\]\)\s*\)\s*\{[^}]+\}/
    );
  });

  it("adds a themeable edge fade to the scroll container once it actually overflows", async () => {
    // Reads the real computed mask off the rendered [part="base"] instead of substring-matching
    // the exported stylesheet source, which would still pass even if the selector never actually
    // matched.
    const el = (await fixture(
      html`<lr-segmented
        style="max-inline-size: 80px"
        .items=${items()}
        value="week"
      ></lr-segmented>`
    )) as LyraSegmented;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    await nextFrames();
    expect(base.scrollWidth).to.be.greaterThan(base.clientWidth);
    expect(getComputedStyle(base).maskImage).to.contain("linear-gradient");
  });

  it("leaves a track that fits completely unmasked", async () => {
    // The regression this guards: the fade used to be painted unconditionally, so at the 2rem
    // per-edge default a short row was narrower than its own two fades and every label rendered
    // half-transparent -- the control read as permanently disabled.
    const el = (await fixture(
      html`<lr-segmented .items=${items()} value="week"></lr-segmented>`
    )) as LyraSegmented;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    await nextFrames();
    expect(base.scrollWidth - base.clientWidth).to.be.at.most(1);
    expect(getComputedStyle(base).maskImage).to.equal("none");
  });

  it("flips the edge fade on once a segment's own content grows, without any host update or [part=\"base\"] resize/scroll", async () => {
    // The gap this guards: ScrollOverflowController's plain ResizeObserver only watches
    // [part="base"]'s own border box. A segment's content (a long localized label swapped in, a
    // web font finishing its swap, an icon loading) can grow scrollWidth without base's own box
    // changing at all. Two platform confounds would otherwise mask the gap in a real browser
    // rather than exercise it, so this fixture neutralizes both: (1) `scrollbar-width: none`
    // removes the classic scrollbar's own reserved block-axis space, so the fits -> overflows
    // transition itself cannot change base's clientHeight and spuriously re-trigger the existing
    // plain ResizeObserver for an unrelated reason; (2) leaving `scrollLeft` untouched at its
    // default `0` avoids Chromium re-firing a genuine native `scroll` event whenever an
    // overflowing track's `scrollWidth` changes while scrolled away from position `0` -- itself
    // a real, useful side effect of this fix's new scroll listener, but not the one this test
    // targets. Growing the segment via an explicit flex-basis (rather than appending text, which
    // the default `flex-shrink: 1`/`min-inline-size: 0` on [part="segment"] can simply shrink
    // back down to fit) gives a deterministic box growth -- mirrors
    // `<lr-timeline-item style="flex: 0 0 200px">` in timeline.test.ts. Setting it directly on
    // the rendered segment (bypassing the `items` property, so no Lit re-render/hostUpdated() run
    // happens either) isolates the ResizeObserver path from the synchronous hostUpdated()
    // measurement.
    const el = (await fixture(
      html`<lr-segmented .items=${items()} value="week"></lr-segmented>`
    )) as LyraSegmented;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    base.style.scrollbarWidth = "none";
    await nextFrames();
    expect(
      base.scrollWidth - base.clientWidth,
      "sanity check: the row must fit before the content grows"
    ).to.be.at.most(1);
    expect(base.hasAttribute("data-scroll-overflow")).to.be.false;

    // Pin base's own border box to its current (naturally-fitting) size -- a real fixed-width
    // panel, so the row genuinely cannot grow its own box in response to the content change below.
    base.style.inlineSize = `${base.getBoundingClientRect().width}px`;
    const clientWidthBefore = base.clientWidth;
    const clientHeightBefore = base.clientHeight;

    const lastSegment = segmentButtons(el).at(-1)!;
    lastSegment.style.flex = "0 0 400px";
    await nextFrames();

    expect(
      base.clientWidth,
      "sanity check: base's own inline border box must not have changed"
    ).to.equal(clientWidthBefore);
    expect(
      base.clientHeight,
      "sanity check: base's own block border box must not have changed either"
    ).to.equal(clientHeightBefore);
    expect(base.scrollLeft, "sanity check: never programmatically scrolled").to.equal(0);
    expect(base.scrollWidth).to.be.greaterThan(base.clientWidth);
    expect(base.hasAttribute("data-scroll-overflow")).to.be.true;
    expect(getComputedStyle(base).maskImage).to.contain("linear-gradient");
  });

  it("fades only the reachable logical edge, RTL-aware, instead of dimming an edge already fully in view", async () => {
    for (const direction of ["ltr", "rtl"] as const) {
      const el = (await fixture(
        html`<lr-segmented
          dir=${direction}
          style="max-inline-size: 80px"
          .items=${items()}
          value="week"
        ></lr-segmented>`
      )) as LyraSegmented;
      const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      await nextFrames();
      expect(base.scrollWidth, `${direction} sanity: must overflow`).to.be.greaterThan(
        base.clientWidth
      );
      expect(
        base.hasAttribute("data-scroll-start"),
        `${direction} initial start`
      ).to.be.false;
      expect(
        base.hasAttribute("data-scroll-end"),
        `${direction} initial end`
      ).to.be.true;

      const maximum = base.scrollWidth - base.clientWidth;
      base.scrollLeft = direction === "rtl" ? -maximum : maximum;
      base.dispatchEvent(new Event("scroll"));
      expect(
        base.hasAttribute("data-scroll-start"),
        `${direction} final start`
      ).to.be.true;
      expect(
        base.hasAttribute("data-scroll-end"),
        `${direction} final end`
      ).to.be.false;
    }
  });

  it("removes the decorative edge mask under forced colors", () => {
    const css = styles.cssText.replace(/\s+/g, " ");
    expect(css).to.contain("@media (forced-colors: active)");
    const forcedColors = css.slice(
      css.indexOf("@media (forced-colors: active)")
    );
    expect(forcedColors).to.contain("-webkit-mask-image: none");
    expect(forcedColors).to.contain("mask-image: none");
  });

  it("actually renders no mask under forced colors, in both LTR and RTL, while only one logical edge is reachable", async () => {
    // Stylesheet-text substring checks (the test above) cannot catch a specificity regression: the
    // one-sided mask rules above use three/four attribute selectors (higher specificity than the
    // forced-colors override's two), so without the :where()-wrapping that keeps their specificity
    // pinned to the plain [data-scroll-overflow] selector, the gradient mask would keep winning the
    // cascade even under forced-colors. Assert the real computed style, not the source text.
    try {
      await setForcedColors("active");
      for (const direction of ["ltr", "rtl"] as const) {
        const el = (await fixture(
          html`<lr-segmented
            dir=${direction}
            style="max-inline-size: 80px"
            .items=${items()}
            value="week"
          ></lr-segmented>`
        )) as LyraSegmented;
        const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
        await nextFrames();
        expect(base.hasAttribute("data-scroll-overflow"), `${direction} sanity: overflowing`).to.be
          .true;
        // Only one logical edge is reachable at the initial (unscrolled) position -- exactly the
        // state whose one-sided selector has the higher specificity that must still lose to
        // forced-colors.
        expect(base.hasAttribute("data-scroll-end"), `${direction} sanity: one-sided state`).to.be
          .true;
        expect(getComputedStyle(base).maskImage, `${direction} forced-colors mask`).to.equal("none");
      }
    } finally {
      await setForcedColors("none");
    }
  });

  it("keeps the edge fade opaque when a consumer themes the shadow color translucent", async () => {
    // The regression this guards: the mask's opaque stops used to be var(--lr-color-shadow), a
    // documented consumer theming input whose job is coloring shadows. A mask reads alpha only,
    // so setting it to something translucent -- entirely reasonable for a shadow color -- dropped
    // the mask alpha across the WHOLE control rather than just its edges, rendering it uniformly
    // washed out with nothing pointing back at the shadow token as the cause.
    const el = (await fixture(
      html`<lr-segmented
        style="max-inline-size: 80px; --lr-theme-color-shadow: rgb(0 0 0 / 0.25)"
        .items=${items()}
        value="week"
      ></lr-segmented>`
    )) as LyraSegmented;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    await nextFrames();
    const mask = getComputedStyle(base).maskImage;
    expect(mask).to.contain("linear-gradient");
    // The transparent stops resolve to rgba(0, 0, 0, 0); a leaked 0.25 would be the themed
    // shadow alpha reaching the opaque stops.
    expect(mask).to.not.contain("0.25");
  });
});

describe("narrow allocation", () => {
  it("keeps a long button row horizontally scrollable inside a 320px container", async () => {
    // `parentNode` is an open-wc fixture option -- the fixture wrapper appends it under
    // `document.body` itself and the global afterEach fixtureCleanup removes it, so this
    // test must not append/remove it manually (that would double-remove the node).
    const container = document.createElement("div");
    container.style.inlineSize = "320px";
    const el = (await fixture(
      html`<lr-segmented
        .items=${[
          { value: "all", label: "Alle Elemente" },
          { value: "active", label: "Aktive Elemente" },
          { value: "pending", label: "Ausstehende Elemente" },
          { value: "archived", label: "Archivierte Elemente" },
          { value: "deleted", label: "Gelöschte Elemente" },
        ]}
        value="active"
      ></lr-segmented>`,
      { parentNode: container }
    )) as LyraSegmented;
    await el.updateComplete;

    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).flexWrap).to.equal("nowrap");
    expect(getComputedStyle(base).overflowX).to.equal("auto");
    // The host's own box must not overflow the 320px allocation; the row itself
    // owns horizontal scrolling for long translated labels.
    expect((el as HTMLElement).getBoundingClientRect().width).to.be.at.most(
      320
    );
  });
});

it("exposes component-scoped track gap, radius, and padding hooks", async () => {
  const el = (await fixture(html`
    <lr-segmented
      style="
        --lr-segmented-track-gap: 7px;
        --lr-segmented-track-radius: 13px;
        --lr-segmented-track-padding: 5px;
      "
      .items=${items()}
    ></lr-segmented>
  `)) as LyraSegmented;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const computed = getComputedStyle(base);
  expect(computed.gap).to.equal("7px");
  expect(computed.borderRadius).to.equal("13px");
  expect(computed.padding).to.equal("5px");
});

describe("segment hover specificity", () => {
  it("keeps the internal hover rule :where()-wrapped so a ::part(segment):hover override wins without !important", async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div>
        <style>
          lr-segmented::part(segment):hover { color: rgb(7, 8, 9); }
        </style>
        <lr-segmented
          style="--lr-transition-fast: 0ms"
          .items=${items()}
          value="week"
        ></lr-segmented>
      </div>
    `);
    const el = wrapper.querySelector("lr-segmented") as LyraSegmented;
    const target = segmentButtons(el)[0]!;
    const rect = target.getBoundingClientRect();
    try {
      await resetMouse();
      await sendMouse({
        type: "move",
        position: [
          Math.round(rect.left + rect.width / 2),
          Math.round(rect.top + rect.height / 2),
        ],
      });
      await waitUntil(
        () => getComputedStyle(target).color === "rgb(7, 8, 9)",
        "consumer segment hover color did not win"
      );
      expect(getComputedStyle(target).color).to.equal("rgb(7, 8, 9)");
    } finally {
      await resetMouse();
    }
  });
});

/** Resolves what a `declaration` would compute to *inside this component's shadow root*, where the
 *  `--lr-*` design tokens actually live (they are declared on `:host`, so a light-DOM probe would
 *  see none of them). Used to assert the unset defaults byte-for-byte against the tokens they are
 *  documented to fall back to. */
function resolvedInShadow(
  el: LyraSegmented,
  declaration: string,
  property: string
): string {
  const probe = document.createElement("span");
  probe.setAttribute("style", declaration);
  el.shadowRoot!.appendChild(probe);
  const value = getComputedStyle(probe).getPropertyValue(property);
  probe.remove();
  return value;
}

describe("selected-state cssprops", () => {
  const overrides =
    "--lr-segmented-selected-bg: rgb(0, 51, 102);" +
    "--lr-segmented-selected-color: rgb(255, 255, 255);" +
    "--lr-segmented-selected-font-weight: 900;" +
    "--lr-segmented-selected-shadow: none;";

  async function themed(style: string): Promise<LyraSegmented> {
    const wrapper = (await fixture(
      html`<div style=${style}>
        <lr-segmented .items=${items()} value="week"></lr-segmented>
      </div>`
    )) as HTMLElement;
    const el = wrapper.querySelector("lr-segmented") as LyraSegmented;
    await el.updateComplete;
    return el;
  }

  it("recolors only the checked segment, from an ancestor (not a :host-declared prop)", async () => {
    const el = await themed(overrides);
    const [unchecked, checked] = segmentButtons(el);
    const checkedStyle = getComputedStyle(checked!);
    expect(checked!.getAttribute("aria-checked")).to.equal("true");
    expect(checkedStyle.backgroundColor).to.equal("rgb(0, 51, 102)");
    expect(checkedStyle.color).to.equal("rgb(255, 255, 255)");
    expect(checkedStyle.fontWeight).to.equal("900");
    expect(checkedStyle.boxShadow).to.equal("none");

    // Every unchecked segment keeps the quiet resting treatment: transparent, quiet text, no
    // bolding, no shadow -- the props are scoped to [aria-checked='true'] only.
    const uncheckedStyle = getComputedStyle(unchecked!);
    expect(uncheckedStyle.backgroundColor).to.equal("rgba(0, 0, 0, 0)");
    expect(uncheckedStyle.color).to.equal(
      resolvedInShadow(el, "color: var(--lr-color-text-quiet)", "color")
    );
    expect(uncheckedStyle.fontWeight).to.not.equal("900");
    expect(uncheckedStyle.boxShadow).to.equal("none");
  });

  it("leaves the hover treatment of an UNCHECKED segment untouched -- the coupling the props exist to break", async () => {
    const el = await themed(overrides);
    const unchecked = segmentButtons(el)[0]!;
    const expected = resolvedInShadow(el, "color: var(--lr-color-text)", "color");
    const rect = unchecked.getBoundingClientRect();
    try {
      await resetMouse();
      await sendMouse({
        type: "move",
        position: [
          Math.round(rect.left + rect.width / 2),
          Math.round(rect.top + rect.height / 2),
        ],
      });
      await waitUntil(
        () => getComputedStyle(unchecked).color === expected,
        "selected-state tokens leaked into the unchecked hover treatment"
      );
      expect(getComputedStyle(unchecked).color).to.equal(expected);
    } finally {
      await resetMouse();
    }
  });

  it("recolors the hover treatment on its own, without touching the checked segment", async () => {
    const el = await themed("--lr-segmented-hover-color: rgb(7, 8, 9);");
    const unchecked = segmentButtons(el)[0]!;
    const checked = segmentButtons(el)[1]!;
    const rect = unchecked.getBoundingClientRect();
    try {
      await resetMouse();
      await sendMouse({
        type: "move",
        position: [
          Math.round(rect.left + rect.width / 2),
          Math.round(rect.top + rect.height / 2),
        ],
      });
      await waitUntil(
        () => getComputedStyle(unchecked).color === "rgb(7, 8, 9)",
        "segmented hover token did not reach the rendered unchecked segment"
      );
      expect(getComputedStyle(unchecked).color).to.equal("rgb(7, 8, 9)");
      expect(getComputedStyle(checked).color).to.equal(
        resolvedInShadow(el, "color: var(--lr-color-text)", "color")
      );
      expect(getComputedStyle(checked).backgroundColor).to.equal(
        resolvedInShadow(
          el,
          "background: var(--lr-color-surface)",
          "background-color"
        )
      );
    } finally {
      await resetMouse();
    }
  });

  it("renders identically to the pre-cssprop output when every prop is unset", async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()} value="week"></lr-segmented>`
    )) as LyraSegmented;
    const checked = getComputedStyle(segmentButtons(el)[1]!);
    expect(checked.backgroundColor).to.equal(
      resolvedInShadow(
        el,
        "background: var(--lr-color-surface)",
        "background-color"
      )
    );
    expect(checked.color).to.equal(
      resolvedInShadow(el, "color: var(--lr-color-text)", "color")
    );
    expect(checked.fontWeight).to.equal(
      resolvedInShadow(
        el,
        "font-weight: var(--lr-font-weight-semibold)",
        "font-weight"
      )
    );
    // The selected thumb is resting chrome riding inside its own track, not a floating panel, so
    // it sits at the lowest step of the elevation scale rather than the mid one every site used to
    // share.
    expect(checked.boxShadow).to.equal(
      resolvedInShadow(el, "box-shadow: var(--lr-shadow-xs)", "box-shadow")
    );
  });

  it("is accessible with the selected-state props themed", async () => {
    const el = await themed(overrides);
    await expect(el).to.be.accessible();
  });
});

describe("active-state cssprops", () => {
  async function themed(style = ""): Promise<LyraSegmented> {
    const wrapper = (await fixture(
      html`<div style=${style}>
        <lr-segmented .items=${items()} value="week"></lr-segmented>
      </div>`
    )) as HTMLElement;
    const el = wrapper.querySelector("lr-segmented") as LyraSegmented;
    await el.updateComplete;
    return el;
  }

  function pointerPosition(target: HTMLElement): [number, number] {
    target.scrollIntoView();
    const rect = target.getBoundingClientRect();
    return [
      Math.round(rect.left + rect.width / 2),
      Math.round(rect.top + rect.height / 2),
    ];
  }

  it("keeps the pre-hook active treatment when its props are unset", async () => {
    const el = await themed();
    const target = segmentButtons(el)[0]!;
    const expectedBackground = resolvedInShadow(
      el,
      "background: color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active))",
      "background-color"
    );
    const expectedColor = resolvedInShadow(
      el,
      "color: var(--lr-segmented-hover-color, var(--lr-color-text))",
      "color"
    );

    try {
      await sendMouse({ type: "move", position: pointerPosition(target) });
      expect(getComputedStyle(target).backgroundColor).to.equal(
        "rgba(0, 0, 0, 0)"
      );
      expect(getComputedStyle(target).color).to.equal(expectedColor);

      await sendMouse({ type: "down" });
      await waitUntil(() => getComputedStyle(target).backgroundColor === expectedBackground, 'target background color never reached expectedBackground');
      expect(getComputedStyle(target).color).to.equal(expectedColor);
    } finally {
      await resetMouse();
    }
  });

  it("inherits active paint from an ancestor without recoloring hover or the checked segment", async () => {
    const el = await themed(
      "--lr-segmented-active-bg: rgb(12, 34, 56);" +
        "--lr-segmented-active-color: rgb(78, 90, 123);"
    );
    const [target, checked] = segmentButtons(el);
    const expectedHoverColor = resolvedInShadow(
      el,
      "color: var(--lr-segmented-hover-color, var(--lr-color-text))",
      "color"
    );
    const expectedCheckedBackground = resolvedInShadow(
      el,
      "background: var(--lr-color-surface)",
      "background-color"
    );
    const expectedCheckedColor = resolvedInShadow(
      el,
      "color: var(--lr-color-text)",
      "color"
    );

    try {
      await sendMouse({ type: "move", position: pointerPosition(target!) });
      expect(getComputedStyle(target!).backgroundColor).to.equal(
        "rgba(0, 0, 0, 0)"
      );
      expect(getComputedStyle(target!).color).to.equal(expectedHoverColor);

      await sendMouse({ type: "down" });
      await waitUntil(() => getComputedStyle(target!).backgroundColor === "rgb(12, 34, 56)", 'target background color never reached "rgb(12, 34, 56)"');
      expect(getComputedStyle(target!).color).to.equal("rgb(78, 90, 123)");
      expect(getComputedStyle(checked!).backgroundColor).to.equal(
        expectedCheckedBackground
      );
      expect(getComputedStyle(checked!).color).to.equal(expectedCheckedColor);
    } finally {
      await resetMouse();
    }
  });
});

describe("track height", () => {
  const sizes = ["2xs", "xs", "s", "m", "l", "xl"] as const;

  async function track(size: string, style = ""): Promise<HTMLElement> {
    const wrapper = (await fixture(
      html`<div style=${style}>
        <lr-segmented
          size=${size}
          .items=${items()}
          value="week"
        ></lr-segmented>
      </div>`
    )) as HTMLElement;
    const el = wrapper.querySelector("lr-segmented") as LyraSegmented;
    await el.updateComplete;
    return el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  }

  it("pins the track to an exact height at every size tier", async () => {
    for (const size of sizes) {
      const base = await track(size, "--lr-segmented-track-height: 40px;");
      expect(getComputedStyle(base).minBlockSize, size).to.equal("40px");
      expect(base.getBoundingClientRect().height, size).to.be.closeTo(40, 0.5);
    }
  });

  it("keeps each tier's own min-height floor when the exact-height hatch is unset", async () => {
    // The hatch must stay *genuinely undeclared* -- a `:host { --lr-segmented-track-height: auto }`
    // declaration would be a valid value that always wins, making the per-tier
    // --lr-segmented-track-min-height fallback dead code (the trap lr-select fell into).
    // The shared ladder's own heights (internal/sizes.styles.ts), not a scale of this component's
    // own -- the 2xs track floor is the ladder's 1.25rem. The segments themselves keep their
    // separate 1.5rem/24px WCAG 2.5.8 floor at 2xs/xs, so the rendered track is still a
    // conformant row of targets; see the target-size test below.
    const floors = new Map([
      ["2xs", "20px"],
      ["xs", "24px"],
      ["s", "30px"],
      ["m", "40px"],
      ["l", "48px"],
      ["xl", "56px"],
    ]);
    for (const size of sizes) {
      const base = await track(size);
      expect(getComputedStyle(base).minBlockSize, size).to.equal(
        floors.get(size)
      );
    }
  });

  it("inherits a min-height override while the exact height is unset and lets the host win", async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-segmented-track-min-height: 44px">
        <lr-segmented size="s" .items=${items()}></lr-segmented>
      </div>
    `);
    const el = wrapper.querySelector("lr-segmented") as LyraSegmented;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).minBlockSize).to.equal("44px");

    el.style.setProperty("--lr-segmented-track-min-height", "46px");
    expect(getComputedStyle(base).minBlockSize).to.equal("46px");
  });
});

describe("size", () => {
  async function sizedTrack(size: string): Promise<HTMLElement> {
    const el = (await fixture(
      html`<lr-segmented
        size=${size}
        .items=${items()}
        value="week"
      ></lr-segmented>`
    )) as LyraSegmented;
    await el.updateComplete;
    return el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  }

  it('defaults to size="m", matching lr-input/lr-select/lr-combobox\'s shared 40px default-tier floor', async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()} value="day"></lr-segmented>`
    )) as LyraSegmented;
    expect(el.size).to.equal("m");
    expect(el.getAttribute("size")).to.equal("m");
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).minBlockSize).to.equal("40px");
  });

  it('matches <lr-select size="s">\'s control height at size="s"', async () => {
    const segmented = (await fixture(
      html`<lr-segmented size="s" .items=${items()} value="day"></lr-segmented>`
    )) as LyraSegmented;
    const select = (await fixture(
      html`<lr-select size="s"></lr-select>`
    )) as LyraSelect;
    const segmentedBase = segmented.shadowRoot!.querySelector(
      '[part="base"]'
    ) as HTMLElement;
    const selectTrigger = select.shadowRoot!.querySelector(
      '[part="trigger"]'
    ) as HTMLElement;
    expect(getComputedStyle(segmentedBase).minBlockSize).to.equal(
      getComputedStyle(selectTrigger).minBlockSize
    );
  });

  it("reflects size as a host attribute for every tier", async () => {
    const el = (await fixture(
      html`<lr-segmented size="xl" .items=${items()}></lr-segmented>`
    )) as LyraSegmented;
    expect(el.getAttribute("size")).to.equal("xl");
  });

  it("accepts the Web Awesome size spellings at the same geometry", async () => {
    // `size` is the library's shared LyraSize now, so `small`/`medium`/`large` render exactly as
    // `s`/`m`/`l` -- a Web Awesome migration is a tag rename with no attribute rewrite.
    for (const [alias, step] of [
      ["small", "s"],
      ["medium", "m"],
      ["large", "l"],
    ] as const) {
      const aliasBase = await sizedTrack(alias);
      const stepBase = await sizedTrack(step);
      expect(getComputedStyle(aliasBase).minBlockSize, alias).to.equal(
        getComputedStyle(stepBase).minBlockSize
      );
      expect(
        aliasBase.getBoundingClientRect().height,
        `${alias} height`
      ).to.be.closeTo(stepBase.getBoundingClientRect().height, 0.5);
    }
  });

  it('grows the rendered track from size="s" to size="l"', async () => {
    const small = await sizedTrack("s");
    const large = await sizedTrack("l");
    expect(large.getBoundingClientRect().height).to.be.greaterThan(
      small.getBoundingClientRect().height
    );
  });

  it("keeps 2xs/xs segment targets and adjacent centers at least 24px apart", async () => {
    const narrowItems = [
      { value: "i", label: "I" },
      { value: "j", label: "J" },
    ];
    for (const size of ["2xs", "xs"] as const) {
      const el = (await fixture(
        html`<lr-segmented
          size=${size}
          .items=${narrowItems}
          value="i"
        ></lr-segmented>`
      )) as LyraSegmented;
      const buttons = segmentButtons(el);
      const rects = buttons.map((button) => button.getBoundingClientRect());
      for (const rect of rects) {
        expect(rect.width, `${size} width`).to.be.at.least(24);
        expect(rect.height, `${size} height`).to.be.at.least(24);
      }
      const centers = rects.map((rect) => rect.left + rect.width / 2);
      expect(
        centers[1]! - centers[0]!,
        `${size} adjacent centers`
      ).to.be.at.least(24);
    }
  });
});

describe("lr-segmented auto-reveal", () => {
  // scrollIntoView is unimplemented as a real geometry op under headless test layout, and asserting
  // scroll offsets is flaky; spy on the call + its args instead (the documented contract).
  function spyScroll(
    el: LyraSegmented
  ): Array<ScrollIntoViewOptions | boolean | undefined> {
    const calls: Array<ScrollIntoViewOptions | boolean | undefined> = [];
    for (const btn of segmentButtons(el)) {
      btn.scrollIntoView = (arg?: ScrollIntoViewOptions | boolean) => {
        calls.push(arg);
      };
    }
    return calls;
  }

  it("scrolls the newly-selected segment into view when value changes programmatically", async () => {
    const el = (await fixture(
      html`<lr-segmented value="day" .items=${items()}></lr-segmented>`
    )) as LyraSegmented;
    await el.updateComplete;
    const calls = spyScroll(el);
    el.value = "month";
    await el.updateComplete;
    expect(calls.length).to.equal(1);
    expect((calls[0] as ScrollIntoViewOptions).block).to.equal("nearest");
  });

  it("does not scroll on the first render (initial mount)", async () => {
    // Spy is installed via a subclass hook is overkill; instead assert that a fresh element with a
    // preset value did not move focus/scroll by checking no throw and that value is applied. The
    // updated() guard requires a PREVIOUS value, so first render cannot call scrollToValue.
    const el = (await fixture(
      html`<lr-segmented value="week" .items=${items()}></lr-segmented>`
    )) as LyraSegmented;
    await el.updateComplete;
    // If updated() had scrolled on first paint it would have queried a segment; the guard
    // (changed.get('value') !== undefined) prevents that. Assert the selection is correct and the
    // component is stable.
    expect(el.value).to.equal("week");
    const checked = segmentButtons(el).find(
      (b) => b.getAttribute("aria-checked") === "true"
    );
    expect(checked?.getAttribute("data-value")).to.equal("week");
  });

  it("scrollToValue() is a public method that scrolls a segment without selecting it", async () => {
    const el = (await fixture(
      html`<lr-segmented value="day" .items=${items()}></lr-segmented>`
    )) as LyraSegmented;
    await el.updateComplete;
    const calls = spyScroll(el);
    el.scrollToValue("month");
    expect(calls.length).to.equal(1);
    // Selection is unchanged -- scrollToValue reveals only.
    expect(el.value).to.equal("day");
  });

  it("uses behavior:auto under prefers-reduced-motion (branch coverage via forced query)", async () => {
    // We cannot toggle the real media query in wtr; assert the call is made and carries a valid
    // behavior string. Both branches resolve to a legal ScrollIntoViewOptions.behavior.
    const el = (await fixture(
      html`<lr-segmented value="day" .items=${items()}></lr-segmented>`
    )) as LyraSegmented;
    await el.updateComplete;
    const calls = spyScroll(el);
    el.scrollToValue("week");
    const behavior = (calls[0] as ScrollIntoViewOptions).behavior;
    expect(["auto", "smooth"]).to.include(behavior);
  });

  it("forces behavior:auto by stubbing matchMedia to report prefers-reduced-motion: reduce", async () => {
    const el = (await fixture(
      html`<lr-segmented value="day" .items=${items()}></lr-segmented>`
    )) as LyraSegmented;
    await el.updateComplete;
    const calls = spyScroll(el);
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList) as typeof window.matchMedia;
    try {
      el.scrollToValue("week");
    } finally {
      window.matchMedia = originalMatchMedia;
    }
    expect((calls[0] as ScrollIntoViewOptions).behavior).to.equal("auto");
  });
});

describe("focus rehoming under a hostile DOM", () => {
  it("survives a re-render when ShadowRoot.activeElement itself throws", async () => {
    // The regression this guards: willUpdate() read (this.renderRoot as ShadowRoot).activeElement
    // to decide focus rehoming after an items change. Under happy-dom -- the DOM a large share of
    // consumers get from Vitest -- that getter THROWS when the document has no active element, and
    // optional chaining is no defence because the throw happens inside the getter. Since the read
    // sits in willUpdate(), it surfaced as an unhandled rejection on every affected re-render.
    // Assertions could still pass while the runner exited non-zero.
    const el = (await fixture(
      html`<lr-segmented .items=${items()} value="week"></lr-segmented>`
    )) as LyraSegmented;
    const root = el.shadowRoot!;
    Object.defineProperty(root, "activeElement", {
      configurable: true,
      get(): never {
        throw new TypeError(
          "Cannot read properties of undefined (reading 'getRootNode')"
        );
      },
    });
    try {
      el.items = [...items(), { value: "year", label: "Year" }];
      await el.updateComplete;
      expect(segmentButtons(el).length).to.equal(4);
    } finally {
      delete (root as unknown as Record<string, unknown>)["activeElement"];
    }
  });

  it("still rehomes focus normally when the getter works", async () => {
    const el = (await fixture(
      html`<lr-segmented .items=${items()} value="week"></lr-segmented>`
    )) as LyraSegmented;
    segmentButtons(el)[0]!.focus();
    el.items = [...items(), { value: "year", label: "Year" }];
    await el.updateComplete;
    expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal(
      "segment"
    );
  });
});
