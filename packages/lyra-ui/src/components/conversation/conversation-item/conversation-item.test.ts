import { fixture, expect, html, oneEvent } from "@open-wc/testing";
import "./conversation-item.js";
import type {
  LyraConversationItem,
  LyraConversationItemEventMap,
} from "./conversation-item.js";

type RenameEvent = LyraConversationItemEventMap["lr-rename"];
const renameCorrelation = (event: RenameEvent): string =>
  `${event.detail.conversationId}:${event.detail.label}`;
void renameCorrelation;

// The selectable region -- `role="button"`, click/keydown handlers, and
// (while not renaming) aria-current/aria-label -- lives on `[part="select-button"]`,
// not `[part="base"]` (a plain layout wrapper). See the class doc's
// nested-interactive note for why the rename button and `actions` slot are
// siblings of this element rather than descendants of it.
function selectButtonEl(el: LyraConversationItem): HTMLElement {
  return el.shadowRoot!.querySelector('[part="select-button"]') as HTMLElement;
}

async function fixtureItem(
  item: import("lit").TemplateResult
): Promise<LyraConversationItem> {
  return (await fixture(item)) as LyraConversationItem;
}

it('defaults to label="", excerpt="", active=false, renamable=true', async () => {
  const el = (await fixture(
    html`<lr-conversation-item></lr-conversation-item>`
  )) as LyraConversationItem;
  expect(el.label).to.equal("");
  expect(el.excerpt).to.equal("");
  expect(el.active).to.be.false;
  expect(el.renamable).to.be.true;
  expect(el.hasAttribute("active")).to.be.false;
  expect(el.hasAttribute("renamable")).to.be.true;
});

it('renders a standalone role="button" and a tabindex of 0', async () => {
  const el = (await fixture(
    html`<lr-conversation-item label="A"></lr-conversation-item>`
  )) as LyraConversationItem;
  const b = selectButtonEl(el);
  expect(b.getAttribute("role")).to.equal("button");
  expect(b.getAttribute("tabindex")).to.equal("0");
});

it('falls back to "Untitled conversation" when label is empty', async () => {
  const el = (await fixture(
    html`<lr-conversation-item></lr-conversation-item>`
  )) as LyraConversationItem;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal(
    "Untitled conversation"
  );
  expect(selectButtonEl(el).getAttribute("aria-label")).to.equal(
    "Untitled conversation"
  );
});

it("localizes the untitled-conversation fallback via this.localize() when .strings overrides untitledConversation", async () => {
  const el = (await fixture(html`
    <lr-conversation-item
      .strings=${{ untitledConversation: "Conversation sans titre" }}
    ></lr-conversation-item>
  `)) as LyraConversationItem;
  expect(el.shadowRoot!.querySelector('[part="label"]')!.textContent).to.equal(
    "Conversation sans titre"
  );
  expect(selectButtonEl(el).getAttribute("aria-label")).to.equal(
    "Conversation sans titre"
  );
});

it("renders label as visible content while preserving native host title semantics", async () => {
  const el = (await fixture(
    html`<lr-conversation-item
      label="Migrating the table component"
      title="Open the conversation menu for more actions"
    ></lr-conversation-item>`
  )) as LyraConversationItem;
  const labelPart = el.shadowRoot!.querySelector(
    '[part="label"]'
  ) as HTMLElement;
  expect(labelPart.textContent).to.equal("Migrating the table component");
  expect(labelPart.hasAttribute("title")).to.be.false;
  expect(el.title).to.equal("Open the conversation menu for more actions");
});

it('forwards a host aria-label onto the inner role="button" element instead of the derived label', async () => {
  const el = (await fixture(
    html`<lr-conversation-item
      label="Internal name"
      aria-label="Custom label"
    ></lr-conversation-item>`
  )) as LyraConversationItem;
  expect(selectButtonEl(el).getAttribute("aria-label")).to.equal(
    "Custom label"
  );

  el.setAttribute("aria-label", "");
  await el.updateComplete;
  expect(selectButtonEl(el).getAttribute("aria-label")).to.equal("");

  el.removeAttribute("aria-label");
  await el.updateComplete;
  expect(selectButtonEl(el).getAttribute("aria-label")).to.equal(
    "Internal name"
  );
});

describe("excerpt", () => {
  it("is hidden when unset", async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="A"></lr-conversation-item>`
    )) as LyraConversationItem;
    expect(
      (el.shadowRoot!.querySelector('[part="excerpt"]') as HTMLElement).hidden
    ).to.be.true;
  });

  it("is rendered when set", async () => {
    const el = (await fixture(
      html`<lr-conversation-item
        label="A"
        excerpt="Sure — I can open a PR for that."
      ></lr-conversation-item>`
    )) as LyraConversationItem;
    expect(
      el.shadowRoot!.querySelector('[part="excerpt"]')!.textContent!.trim()
    ).to.equal("Sure — I can open a PR for that.");
  });
});

describe("meta slot", () => {
  it("hides the meta wrapper until something is slotted", async () => {
    const el = (await fixture(
      html`<lr-conversation-item></lr-conversation-item>`
    )) as LyraConversationItem;
    expect(
      (
        el.shadowRoot!.querySelector('[part="meta"]') as HTMLElement
      ).hasAttribute("hidden")
    ).to.be.true;
  });

  it("shows the meta wrapper once content is slotted", async () => {
    const el = (await fixture(
      html`<lr-conversation-item
        ><span slot="meta">3 requests</span></lr-conversation-item
      >`
    )) as LyraConversationItem;
    expect(
      (
        el.shadowRoot!.querySelector('[part="meta"]') as HTMLElement
      ).hasAttribute("hidden")
    ).to.be.false;
    expect(
      el.shadowRoot!.querySelector('[part="meta"] slot')!.assignedElements()[0]
        .textContent
    ).to.equal("3 requests");
  });
});

describe("start adornment slot", () => {
  it("projects only the canonical start slot and hides its wrapper when empty", async () => {
    const el = (await fixture(html`
      <lr-conversation-item label="Session">
        <span id="start" slot="start">Start icon</span>
      </lr-conversation-item>
    `)) as LyraConversationItem;
    const wrapper =
      el.shadowRoot!.querySelector<HTMLElement>('[part="start"]')!;
    const startSlot =
      el.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="start"]')!;
    expect(wrapper.hidden).to.be.false;
    expect(startSlot.assignedElements().map((item) => item.id)).to.deep.equal([
      "start",
    ]);

    const slotChanged = oneEvent(startSlot, "slotchange");
    el.querySelector("#start")!.remove();
    await slotChanged;
    await el.updateComplete;
    expect(wrapper.hidden).to.be.true;
    expect(el.shadowRoot!.querySelector('slot[name="leading"]') === null).to.be
      .true;
  });
});

describe("excerpt slot (wins over the excerpt property)", () => {
  it('renders the excerpt property in [part="excerpt"] when no slot content is present (unchanged default)', async () => {
    const el = (await fixture(
      html`<lr-conversation-item
        excerpt="plain preview text"
      ></lr-conversation-item>`
    )) as LyraConversationItem;
    const excerptPart = el.shadowRoot!.querySelector(
      '[part="excerpt"]'
    ) as HTMLElement;
    expect(excerptPart.hasAttribute("hidden")).to.be.false;
    expect(excerptPart.textContent!.trim()).to.equal("plain preview text");
  });

  it("renders slotted content instead of the excerpt property when both are set", async () => {
    const el = (await fixture(
      html`<lr-conversation-item excerpt="plain preview text"
        ><mark slot="excerpt">highlighted</mark> hit</lr-conversation-item
      >`
    )) as LyraConversationItem;
    const excerptPart = el.shadowRoot!.querySelector(
      '[part="excerpt"]'
    ) as HTMLElement;
    expect(excerptPart.hasAttribute("hidden")).to.be.false;
    expect(excerptPart.textContent!.trim()).to.not.include(
      "plain preview text"
    );
    // The slotted <mark> is light DOM (a child of the host element), not a descendant of the
    // shadow-tree excerptPart -- slot assignment doesn't reparent it, so it must be queried from
    // `el`, not from `excerptPart`, mirroring the assignedElements()-based query the meta-slot test
    // above uses for the same reason.
    expect(el.querySelector("mark")!.textContent).to.equal("highlighted");
  });

  it('hides [part="excerpt"] entirely when neither the property nor the slot has content', async () => {
    const el = (await fixture(
      html`<lr-conversation-item></lr-conversation-item>`
    )) as LyraConversationItem;
    expect(
      (
        el.shadowRoot!.querySelector('[part="excerpt"]') as HTMLElement
      ).hasAttribute("hidden")
    ).to.be.true;
  });
});

it("isolates caller text and formatted timestamps from an inherited RTL direction", async () => {
  const wrapper = await fixture(html`
    <div dir="rtl">
      <lr-conversation-item
        label="Deploy pipeline investigation"
        excerpt="Can you check the token refresh?"
        .timestamp=${new Date("2026-01-01T11:00:00Z")}
      ></lr-conversation-item>
    </div>
  `);
  const el = wrapper.querySelector(
    "lr-conversation-item"
  ) as LyraConversationItem;
  await el.updateComplete;

  expect(
    el.shadowRoot!.querySelector('[part="label"]')!.getAttribute("dir")
  ).to.equal("auto");
  expect(
    el.shadowRoot!.querySelector('[part="excerpt"]')!.getAttribute("dir")
  ).to.equal("auto");
  expect(
    el.shadowRoot!.querySelector('[part="timestamp"]')!.getAttribute("dir")
  ).to.equal("auto");
});

describe("timestamp", () => {
  it('renders no [part="timestamp"] when unset', async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="A"></lr-conversation-item>`
    )) as LyraConversationItem;
    expect(el.shadowRoot!.querySelector('[part="timestamp"]') == null).to.be
      .true;
  });

  it("normalizes a Date and an ISO string to the same rendered datetime attribute", async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="A"></lr-conversation-item>`
    )) as LyraConversationItem;
    const date = new Date("2024-03-01T10:30:00Z");

    el.timestamp = date;
    await el.updateComplete;
    let time = el.shadowRoot!.querySelector(
      '[part="timestamp"]'
    ) as HTMLElement;
    expect(time.getAttribute("datetime")).to.equal(date.toISOString());

    el.timestamp = "2024-03-01T10:30:00Z";
    await el.updateComplete;
    time = el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement;
    expect(time.getAttribute("datetime")).to.equal(date.toISOString());
  });

  it("treats an invalid timestamp string the same as unset", async () => {
    const el = (await fixture(
      html`<lr-conversation-item
        label="A"
        .timestamp=${"not a date"}
      ></lr-conversation-item>`
    )) as LyraConversationItem;
    expect(el.shadowRoot!.querySelector('[part="timestamp"]') == null).to.be
      .true;
  });

  it("uses the default absolute-time formatter, overridable via formatTimestamp", async () => {
    const date = new Date("2024-03-01T10:30:00Z");
    const el = (await fixture(
      html`<lr-conversation-item
        label="A"
        .timestamp=${date}
      ></lr-conversation-item>`
    )) as LyraConversationItem;
    const time = el.shadowRoot!.querySelector(
      '[part="timestamp"]'
    ) as HTMLElement;
    expect(time.textContent!.trim().length).to.be.greaterThan(0);

    el.formatTimestamp = (d) => `custom:${d.getUTCFullYear()}`;
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector('[part="timestamp"]') as HTMLElement)
        .textContent
    ).to.equal("custom:2024");
  });
});

describe("active", () => {
  it("reflects to the active attribute and to aria-current", async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="A"></lr-conversation-item>`
    )) as LyraConversationItem;
    expect(selectButtonEl(el).getAttribute("aria-current")).to.equal("false");

    el.active = true;
    await el.updateComplete;
    expect(el.hasAttribute("active")).to.be.true;
    expect(selectButtonEl(el).getAttribute("aria-current")).to.equal("true");
  });
});

describe("active indicator", () => {
  it("does not render an indicator while inactive", async () => {
    const el = await fixtureItem(
      html`<lr-conversation-item label="A"></lr-conversation-item>`
    );
    expect(
      el.shadowRoot!.querySelectorAll('[part="active-indicator"]').length
    ).to.equal(0);
  });

  it("renders a decorative indicator with tokenized default geometry while active", async () => {
    const el = await fixtureItem(
      html`<lr-conversation-item label="A" active></lr-conversation-item>`
    );
    const indicator = el.shadowRoot!.querySelector(
      '[part="active-indicator"]'
    ) as HTMLElement;
    const computed = getComputedStyle(indicator);
    expect(indicator.getAttribute("aria-hidden")).to.equal("true");
    expect(computed.position).to.equal("absolute");
    expect(computed.inlineSize).to.equal("2px");
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(
      Math.abs(
        indicator.getBoundingClientRect().left -
          base.getBoundingClientRect().left
      )
    ).to.be.lessThan(1);
    expect(computed.backgroundColor).to.not.equal("");
  });

  it("supports color, width, and logical inline placement tokens", async () => {
    const el = await fixtureItem(html`
      <lr-conversation-item
        label="A"
        active
        style="--lr-conversation-item-active-indicator-color: rgb(1, 2, 3); --lr-conversation-item-active-indicator-width: 7px; --lr-conversation-item-active-indicator-inset-inline: auto 0;"
      ></lr-conversation-item>
    `);
    const indicator = el.shadowRoot!.querySelector(
      '[part="active-indicator"]'
    ) as HTMLElement;
    const computed = getComputedStyle(indicator);
    expect(computed.backgroundColor).to.equal("rgb(1, 2, 3)");
    expect(computed.inlineSize).to.equal("7px");
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(
      Math.abs(
        indicator.getBoundingClientRect().right -
          base.getBoundingClientRect().right
      )
    ).to.be.lessThan(1);
  });

  it('places the default indicator at logical inline-start under dir="rtl"', async () => {
    const el = await fixtureItem(
      html`<lr-conversation-item
        dir="rtl"
        label="A"
        active
      ></lr-conversation-item>`
    );
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const indicator = el.shadowRoot!.querySelector(
      '[part="active-indicator"]'
    ) as HTMLElement;
    expect(
      Math.abs(
        indicator.getBoundingClientRect().right -
          base.getBoundingClientRect().right
      )
    ).to.be.lessThan(1);
  });
});

describe("selection", () => {
  it("fires a bubbling, composed lr-select on click", async () => {
    const el = (await fixture(
      html`<lr-conversation-item
        conversation-id="conversation-a"
        label="A"
      ></lr-conversation-item>`
    )) as LyraConversationItem;
    setTimeout(() => selectButtonEl(el).click());
    const ev = await oneEvent(el, "lr-select");
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
    expect(ev.detail).to.deep.equal({ conversationId: "conversation-a" });
  });

  it("fires lr-select on Enter and on Space keydown, preventing default on Space", async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="A"></lr-conversation-item>`
    )) as LyraConversationItem;

    setTimeout(() =>
      selectButtonEl(el).dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        })
      )
    );
    await oneEvent(el, "lr-select");

    const spaceEvent = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    setTimeout(() => selectButtonEl(el).dispatchEvent(spaceEvent));
    await oneEvent(el, "lr-select");
    expect(spaceEvent.defaultPrevented).to.be.true;
  });

  it("does not fire lr-select for an unrelated key", async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="A"></lr-conversation-item>`
    )) as LyraConversationItem;
    let fired = false;
    el.addEventListener("lr-select", () => (fired = true));
    selectButtonEl(el).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "a",
        bubbles: true,
        cancelable: true,
      })
    );
    expect(fired).to.be.false;
  });

  it("does not fire lr-select when the click originated in the actions slot", async () => {
    const el = (await fixture(html`
      <lr-conversation-item label="A">
        <button slot="actions" id="del">Delete</button>
      </lr-conversation-item>
    `)) as LyraConversationItem;
    let fired = false;
    el.addEventListener("lr-select", () => (fired = true));
    (el.querySelector("#del") as HTMLButtonElement).click();
    expect(fired).to.be.false;
  });
});

describe("inline rename", () => {
  it("keeps rename operable when custom content replaces the built-in display row", async () => {
    const el = (await fixture(html`
      <lr-conversation-item
        conversation-id="conversation-a"
        renamable
        label="Original"
      >
        <span slot="content">Custom conversation layout</span>
      </lr-conversation-item>
    `)) as LyraConversationItem;
    (
      el.shadowRoot!.querySelector(
        '[part="rename-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;

    const input = el.shadowRoot!.querySelector(
      '[part="label-input"]'
    ) as HTMLInputElement;
    expect(input != null).to.equal(true);
    expect(input.value).to.equal("Original");
    expect(
      (el.shadowRoot!.querySelector('slot[name="content"]') as HTMLSlotElement)
        .hidden
    ).to.be.true;

    input.value = "Renamed";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const renamed = oneEvent(el, "lr-rename");
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    expect(((await renamed) as RenameEvent).detail).to.deep.equal({
      conversationId: "conversation-a",
      label: "Renamed",
    });
  });

  it("renders the rename button only while renamable and not already renaming", async () => {
    const renamable = (await fixture(
      html`<lr-conversation-item label="A"></lr-conversation-item>`
    )) as LyraConversationItem;
    expect(renamable.shadowRoot!.querySelector('[part="rename-button"]')).to
      .exist;

    const notEditable = (await fixture(
      html`<lr-conversation-item
        label="A"
        .renamable=${false}
      ></lr-conversation-item>`
    )) as LyraConversationItem;
    expect(
      notEditable.shadowRoot!.querySelector('[part="rename-button"]') == null
    ).to.be.true;
  });

  it('honors a plain renamable="false" attribute (not just a .renamable=${false} property binding)', async () => {
    const el = (await fixture(
      html`<lr-conversation-item
        label="A"
        renamable="false"
      ></lr-conversation-item>`
    )) as LyraConversationItem;
    expect(el.renamable).to.be.false;
    expect(el.hasAttribute("renamable")).to.be.false;
    expect(
      el.shadowRoot!.querySelectorAll('[part="rename-button"]')
    ).to.have.lengthOf(0);
  });

  it("gives the rename button the shared minimum hit area", async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="A"></lr-conversation-item>`
    )) as LyraConversationItem;
    const btn = el.shadowRoot!.querySelector(
      '[part="rename-button"]'
    ) as HTMLElement;
    expect(getComputedStyle(btn).minInlineSize).to.equal("40px");
    expect(getComputedStyle(btn).minBlockSize).to.equal("40px");
  });

  it("swaps the label for a focused, pre-filled input when the rename button is activated", async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="Old name"></lr-conversation-item>`
    )) as LyraConversationItem;
    const btn = el.shadowRoot!.querySelector(
      '[part="rename-button"]'
    ) as HTMLButtonElement;
    btn.click();
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[part="label"]') == null).to.be.true;
    const input = el.shadowRoot!.querySelector(
      '[part="label-input"]'
    ) as HTMLInputElement;
    expect(input != null).to.equal(true);
    expect(input.value).to.equal("Old name");
    expect(el.shadowRoot!.activeElement === input).to.equal(true);
  });

  it("restores rename focus when the same editing row reconnects", async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="Old name"></lr-conversation-item>`
    )) as LyraConversationItem;
    (
      el.shadowRoot!.querySelector(
        '[part="rename-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(
      '[part="label-input"]'
    ) as HTMLInputElement;
    input.value = "Draft survives";
    input.dispatchEvent(new Event("input"));

    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    await Promise.resolve();

    expect(
      el.shadowRoot!.querySelector('[part="label-input"]')?.getAttribute("part")
    ).to.equal("label-input");
    expect((el as unknown as { renaming: boolean }).renaming).to.be.true;
    expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal(
      "label-input"
    );
    expect(input.value).to.equal("Draft survives");
  });

  it("gives the rename input the same row-specific accessible name as the rename button", async () => {
    const el = (await fixture(
      html`<lr-conversation-item
        label="Migrating the table component"
      ></lr-conversation-item>`
    )) as LyraConversationItem;
    const btn = el.shadowRoot!.querySelector(
      '[part="rename-button"]'
    ) as HTMLButtonElement;
    expect(btn.getAttribute("aria-label")).to.equal(
      "Rename Migrating the table component"
    );
    btn.click();
    await el.updateComplete;

    const input = el.shadowRoot!.querySelector(
      '[part="label-input"]'
    ) as HTMLInputElement;
    expect(input.getAttribute("aria-label")).to.equal(
      "Rename Migrating the table component"
    );
  });

  it("does not activate rename when renamable is false", async () => {
    const el = (await fixture(
      html`<lr-conversation-item
        label="A"
        .renamable=${false}
      ></lr-conversation-item>`
    )) as LyraConversationItem;
    expect(el.shadowRoot!.querySelector('[part="label-input"]') == null).to.be
      .true;
  });

  it("cancels an in-progress rename (discarding the draft) when renamable flips to false", async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="Old name"></lr-conversation-item>`
    )) as LyraConversationItem;
    (
      el.shadowRoot!.querySelector(
        '[part="rename-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(
      '[part="label-input"]'
    ) as HTMLInputElement;
    input.value = "Should be discarded";
    input.dispatchEvent(new Event("input"));

    let renameFired = false;
    el.addEventListener("lr-rename", () => (renameFired = true));

    el.renamable = false;
    await el.updateComplete;

    expect(renameFired, "flipping renamable false must not commit the draft").to
      .be.false;
    expect(
      el.shadowRoot!.querySelector('[part="label-input"]') == null,
      "input must be unmounted"
    ).to.be.true;
    expect(
      el.shadowRoot!.querySelector('[part="label"]')!.textContent
    ).to.equal("Old name");
    // The now-renamable=false row must also not silently expose a rename
    // button that could reopen a fresh edit.
    expect(el.shadowRoot!.querySelector('[part="rename-button"]') == null).to.be
      .true;
  });

  it("does not fire lr-select when the rename button is clicked", async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="A"></lr-conversation-item>`
    )) as LyraConversationItem;
    let fired = false;
    el.addEventListener("lr-select", () => (fired = true));
    (
      el.shadowRoot!.querySelector(
        '[part="rename-button"]'
      ) as HTMLButtonElement
    ).click();
    expect(fired).to.be.false;
  });

  it("Enter commits a correlated label request and leaves label unmutated", async () => {
    const el = (await fixture(
      html`<lr-conversation-item
        conversation-id="conversation-a"
        label="Old name"
      ></lr-conversation-item>`
    )) as LyraConversationItem;
    (
      el.shadowRoot!.querySelector(
        '[part="rename-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(
      '[part="label-input"]'
    ) as HTMLInputElement;
    input.value = "  New name  ";
    input.dispatchEvent(new Event("input"));

    setTimeout(() =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        })
      )
    );
    const ev = await oneEvent(el, "lr-rename");
    expect(ev.detail).to.deep.equal({
      conversationId: "conversation-a",
      label: "New name",
    });
    expect(
      el.label,
      "controlled component -- the label prop itself is never mutated"
    ).to.equal("Old name");
    expect(
      el.shadowRoot!.querySelector('[part="label-input"]') == null,
      "editing ends on commit"
    ).to.be.true;
  });

  it("blur while editing commits, same as Enter", async () => {
    const el = (await fixture(
      html`<lr-conversation-item
        conversation-id="conversation-a"
        label="Old name"
      ></lr-conversation-item>`
    )) as LyraConversationItem;
    (
      el.shadowRoot!.querySelector(
        '[part="rename-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(
      '[part="label-input"]'
    ) as HTMLInputElement;
    input.value = "Blurred name";
    input.dispatchEvent(new Event("input"));

    setTimeout(() => input.dispatchEvent(new FocusEvent("blur")));
    const ev = await oneEvent(el, "lr-rename");
    expect(ev.detail).to.deep.equal({
      conversationId: "conversation-a",
      label: "Blurred name",
    });
  });

  it("Escape cancels: reverts to the original label and fires nothing", async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="Old name"></lr-conversation-item>`
    )) as LyraConversationItem;
    (
      el.shadowRoot!.querySelector(
        '[part="rename-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(
      '[part="label-input"]'
    ) as HTMLInputElement;
    input.value = "Should be discarded";
    input.dispatchEvent(new Event("input"));

    let renameFired = false;
    el.addEventListener("lr-rename", () => (renameFired = true));
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;

    expect(renameFired).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="label-input"]') == null).to.be
      .true;
    expect(
      el.shadowRoot!.querySelector('[part="label"]')!.textContent
    ).to.equal("Old name");

    // Re-opening the editor afterward must reseed from the (unchanged)
    // label prop, not from the discarded draft.
    (
      el.shadowRoot!.querySelector(
        '[part="rename-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector('[part="label-input"]') as HTMLInputElement)
        .value
    ).to.equal("Old name");
  });

  it("does not fire lr-rename for an empty or whitespace-only commit (treated as cancel)", async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="Old name"></lr-conversation-item>`
    )) as LyraConversationItem;
    (
      el.shadowRoot!.querySelector(
        '[part="rename-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(
      '[part="label-input"]'
    ) as HTMLInputElement;
    input.value = "   ";
    input.dispatchEvent(new Event("input"));

    let fired = false;
    el.addEventListener("lr-rename", () => (fired = true));
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(fired).to.be.false;
    expect(
      el.shadowRoot!.querySelector('[part="label-input"]') == null,
      "still ends the edit"
    ).to.be.true;
  });

  it("does not fire lr-rename when the committed label is unchanged", async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="Same name"></lr-conversation-item>`
    )) as LyraConversationItem;
    (
      el.shadowRoot!.querySelector(
        '[part="rename-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(
      '[part="label-input"]'
    ) as HTMLInputElement;

    let fired = false;
    el.addEventListener("lr-rename", () => (fired = true));
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(fired).to.be.false;
  });

  it("does not let Escape also trigger a blur-driven commit", async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="Old name"></lr-conversation-item>`
    )) as LyraConversationItem;
    (
      el.shadowRoot!.querySelector(
        '[part="rename-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(
      '[part="label-input"]'
    ) as HTMLInputElement;
    input.value = "Should not commit";
    input.dispatchEvent(new Event("input"));

    let fired = false;
    el.addEventListener("lr-rename", () => (fired = true));
    input.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      })
    );
    input.dispatchEvent(new FocusEvent("blur"));
    await el.updateComplete;
    expect(fired).to.be.false;
  });

  it("keystrokes inside the input do not also fire lr-select", async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="Old name"></lr-conversation-item>`
    )) as LyraConversationItem;
    (
      el.shadowRoot!.querySelector(
        '[part="rename-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(
      '[part="label-input"]'
    ) as HTMLInputElement;
    input.value = "New name";
    input.dispatchEvent(new Event("input"));

    let selectFired = false;
    el.addEventListener("lr-select", () => (selectFired = true));
    setTimeout(() =>
      input.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          bubbles: true,
          cancelable: true,
        })
      )
    );
    await oneEvent(el, "lr-rename");
    expect(selectFired).to.be.false;
  });

  it("clicking inside the row while renaming does not fire lr-select", async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="Old name"></lr-conversation-item>`
    )) as LyraConversationItem;
    (
      el.shadowRoot!.querySelector(
        '[part="rename-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;

    let fired = false;
    el.addEventListener("lr-select", () => (fired = true));
    selectButtonEl(el).click();
    expect(fired).to.be.false;
  });
});

describe("spellcheck/autocapitalize/autocorrect passthrough", () => {
  it("spellcheck defaults to true on the rename input", async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="A"></lr-conversation-item>`
    )) as LyraConversationItem;
    (
      el.shadowRoot!.querySelector(
        '[part="rename-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(
      '[part="label-input"]'
    ) as HTMLInputElement;
    expect(input.spellcheck).to.be.true;
  });

  it("forwards spellcheck=false, autocapitalize, and autocorrect onto the rename input", async () => {
    const el = (await fixture(html`
      <lr-conversation-item
        label="A"
        spellcheck="false"
        autocapitalize="off"
        autocorrect="off"
      ></lr-conversation-item>
    `)) as LyraConversationItem;
    (
      el.shadowRoot!.querySelector(
        '[part="rename-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(
      '[part="label-input"]'
    ) as HTMLInputElement;
    expect(input.spellcheck).to.be.false;
    expect(input.getAttribute("autocapitalize")).to.equal("off");
    expect(input.getAttribute("autocorrect")).to.equal("off");
  });
});

describe("rename input blur/focus bubbling", () => {
  it("re-dispatches a bubbling, composed blur event when the rename input blurs", async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="Old name"></lr-conversation-item>`
    )) as LyraConversationItem;
    (
      el.shadowRoot!.querySelector(
        '[part="rename-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(
      '[part="label-input"]'
    ) as HTMLInputElement;

    setTimeout(() => input.dispatchEvent(new FocusEvent("blur")));
    const ev = await oneEvent(el, "blur");
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it("re-dispatches a bubbling, composed focus event when the rename input focuses", async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="Old name"></lr-conversation-item>`
    )) as LyraConversationItem;
    (
      el.shadowRoot!.querySelector(
        '[part="rename-button"]'
      ) as HTMLButtonElement
    ).click();
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(
      '[part="label-input"]'
    ) as HTMLInputElement;

    setTimeout(() => input.dispatchEvent(new FocusEvent("focus")));
    const ev = await oneEvent(el, "focus");
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });
});

describe("actions slot", () => {
  it("hides the actions part when nothing is slotted", async () => {
    const el = (await fixture(
      html`<lr-conversation-item label="A"></lr-conversation-item>`
    )) as LyraConversationItem;
    expect(
      (el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement).hidden
    ).to.be.true;
  });

  it("shows the actions part once content is slotted", async () => {
    const el = (await fixture(html`
      <lr-conversation-item label="A"
        ><button slot="actions">Pin</button></lr-conversation-item
      >
    `)) as LyraConversationItem;
    expect(
      (el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement).hidden
    ).to.be.false;
  });
});

it("is accessible in the default (empty) state", async () => {
  const el = await fixtureItem(
    html`<lr-conversation-item></lr-conversation-item>`
  );
  await expect(el).to.be.accessible();
});

it("is accessible in a populated, active state with an excerpt, timestamp, and actions slot", async () => {
  const el = await fixtureItem(html`
    <lr-conversation-item
      label="Migrating the table component"
      excerpt="Sure — I can open a PR for that."
      .timestamp=${new Date()}
      active
    >
      <button slot="actions" aria-label="Delete conversation">✕</button>
    </lr-conversation-item>
  `);
  await expect(el).to.be.accessible();
});

it("is accessible while renaming", async () => {
  const el = await fixtureItem(
    html`<lr-conversation-item label="Old name"></lr-conversation-item>`
  );
  (
    el.shadowRoot!.querySelector('[part="rename-button"]') as HTMLButtonElement
  ).click();
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

describe('nested-interactive slot contract (meta/excerpt render inside role="button")', () => {
  // The class doc's @slot meta/@slot excerpt warnings exist specifically because [part="select-button"]
  // carries role="button" (while not renaming) and wraps both slots -- axe-core's nested-interactive
  // rule forbids a focusable descendant of a role="button" ancestor. A consumer who ignores that
  // prose and slots a real focusable control must actually trip the violation, or the documented
  // contract is untested and could silently stop being true.
  it("a focusable element slotted into meta trips axe nested-interactive", async () => {
    const el = await fixtureItem(
      html`<lr-conversation-item label="A"
        ><a slot="meta" href="/session/1">Open</a></lr-conversation-item
      >`
    );
    await expect(el).to.not.be.accessible();
  });

  it("a focusable element slotted into excerpt trips axe nested-interactive", async () => {
    const el = await fixtureItem(
      html`<lr-conversation-item label="A"
        ><button slot="excerpt">Retry</button></lr-conversation-item
      >`
    );
    await expect(el).to.not.be.accessible();
  });
});

describe("active-state cssprop escape hatch", () => {
  // Resolves what `declaration` computes to *inside this component's shadow root*, where the
  // `--lr-*` design tokens are declared (a light-DOM probe would see none of them) -- used to
  // assert the unset defaults byte-for-byte against the tokens they fall back to.
  function resolvedInShadow(
    el: LyraConversationItem,
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

  async function activeItem(style = ""): Promise<LyraConversationItem> {
    const wrapper = (await fixture(html`
      <div style=${style}>
        <lr-conversation-item
          label="Session"
          excerpt="Last message"
          .timestamp=${new Date()}
          active
        ></lr-conversation-item>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector(
      "lr-conversation-item"
    ) as LyraConversationItem;
    await el.updateComplete;
    return el;
  }

  it("recolors the active row background from an ancestor via --lr-conversation-item-active-bg", async () => {
    const el = await activeItem(
      "--lr-conversation-item-active-bg: rgb(0, 51, 102)"
    );
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).backgroundColor).to.equal("rgb(0, 51, 102)");
  });

  it("restores the active excerpt/timestamp text color from an ancestor via --lr-conversation-item-active-color", async () => {
    const el = await activeItem(
      "--lr-conversation-item-active-color: rgb(255, 255, 255)"
    );
    const excerpt = el.shadowRoot!.querySelector(
      '[part="excerpt"]'
    ) as HTMLElement;
    const timestamp = el.shadowRoot!.querySelector(
      '[part="timestamp"]'
    ) as HTMLElement;
    expect(getComputedStyle(excerpt).color).to.equal("rgb(255, 255, 255)");
    expect(getComputedStyle(timestamp).color).to.equal("rgb(255, 255, 255)");
  });

  it("renders both props byte-identical to the pre-hatch tokens when unset", async () => {
    const el = await activeItem();
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const excerpt = el.shadowRoot!.querySelector(
      '[part="excerpt"]'
    ) as HTMLElement;
    expect(getComputedStyle(base).backgroundColor).to.equal(
      resolvedInShadow(
        el,
        "background: var(--lr-color-brand-quiet)",
        "background-color"
      )
    );
    expect(getComputedStyle(excerpt).color).to.equal(
      resolvedInShadow(el, "color: var(--lr-color-text)", "color")
    );
  });

  // Themed with a LIGHT active background on purpose: `[part='label']` keeps `--lr-color-text`
  // unconditionally (only excerpt/timestamp are restored by --lr-conversation-item-active-color), so
  // the documented WCAG-AA dependency covers the label too -- a consumer darkening the background
  // has to darken nothing and lighten nothing, or supply its own label color. See the styles file.
  it("is accessible with the active-state props themed", async () => {
    const el = await activeItem(
      "--lr-conversation-item-active-bg: rgb(255, 243, 205); --lr-conversation-item-active-color: rgb(51, 25, 0)"
    );
    await expect(el).to.be.accessible();
  });
});

describe("compact", () => {
  const rowChrome = (el: LyraConversationItem) => {
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const content = el.shadowRoot!.querySelector(
      '[part="content"]'
    ) as HTMLElement;
    const b = getComputedStyle(base);
    const c = getComputedStyle(content);
    return {
      paddingTop: b.paddingTop,
      paddingBottom: b.paddingBottom,
      paddingLeft: b.paddingLeft,
      paddingRight: b.paddingRight,
      rowGap: b.rowGap,
      columnGap: b.columnGap,
      contentRowGap: c.rowGap,
    };
  };

  const partStyle = (
    el: LyraConversationItem,
    part: string
  ): CSSStyleDeclaration =>
    getComputedStyle(
      el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement
    );

  it("defaults to compact=false with no compact attribute, rendering identically to .compact=${false} restated", async () => {
    const implicit = await fixtureItem(
      html`<lr-conversation-item
        label="Session"
        excerpt="Last message"
        .timestamp=${new Date()}
      ></lr-conversation-item>`
    );
    const explicit = await fixtureItem(
      html`<lr-conversation-item
        label="Session"
        excerpt="Last message"
        .timestamp=${new Date()}
        .compact=${false}
      ></lr-conversation-item>`
    );

    expect(implicit.compact).to.be.false;
    expect(implicit.hasAttribute("compact")).to.be.false;
    expect(rowChrome(explicit)).to.deep.equal(rowChrome(implicit));

    const chrome = rowChrome(implicit);
    expect(chrome.paddingTop).to.equal("8px"); // --lr-space-s
    expect(chrome.paddingLeft).to.equal("12px"); // --lr-space-m
    expect(chrome.columnGap).to.equal("4px"); // --lr-space-xs
    expect(chrome.contentRowGap).to.equal("2px"); // --lr-size-0-125rem
  });

  it("reflects compact and tightens the base padding/gap and the content gap", async () => {
    const el = await fixtureItem(
      html`<lr-conversation-item
        compact
        label="Session"
        excerpt="Last message"
        .timestamp=${new Date()}
      ></lr-conversation-item>`
    );
    expect(el.hasAttribute("compact")).to.be.true;
    const chrome = rowChrome(el);
    expect(chrome.paddingTop).to.equal("4px"); // --lr-space-xs
    expect(chrome.paddingBottom).to.equal("4px");
    expect(chrome.paddingLeft).to.equal("8px"); // --lr-space-s
    expect(chrome.paddingRight).to.equal("8px");
    expect(chrome.columnGap).to.equal("2px"); // --lr-space-2xs
    expect(chrome.rowGap).to.equal("2px");
    expect(chrome.contentRowGap).to.equal("0px");
  });

  it("lets a consumer retune the compact values through --lr-conversation-item-compact-*", async () => {
    const el = await fixtureItem(
      html`<lr-conversation-item
        compact
        label="Session"
        excerpt="Last message"
      ></lr-conversation-item>`
    );
    el.style.setProperty("--lr-conversation-item-compact-padding", "3px 9px");
    el.style.setProperty("--lr-conversation-item-compact-gap", "5px");
    await el.updateComplete;
    const chrome = rowChrome(el);
    expect(chrome.paddingTop).to.equal("3px");
    expect(chrome.paddingLeft).to.equal("9px");
    expect(chrome.columnGap).to.equal("5px");
  });

  it("keeps the rename button at the shared --lr-icon-button-size floor under compact", async () => {
    const comfortable = await fixtureItem(
      html`<lr-conversation-item label="Session"></lr-conversation-item>`
    );
    const el = await fixtureItem(
      html`<lr-conversation-item
        compact
        label="Session"
      ></lr-conversation-item>`
    );
    const floor = getComputedStyle(el)
      .getPropertyValue("--lr-icon-button-size")
      .trim();
    expect(floor).to.equal("2.5rem");

    const compactButton = partStyle(el, "rename-button");
    const comfortableButton = partStyle(comfortable, "rename-button");
    expect(compactButton.minInlineSize).to.equal("40px");
    expect(compactButton.minBlockSize).to.equal("40px");
    // Density must never silently opt a row out of the shared icon target-size floor.
    expect(compactButton.minInlineSize).to.equal(
      comfortableButton.minInlineSize
    );
    expect(compactButton.minBlockSize).to.equal(comfortableButton.minBlockSize);
  });

  it("keeps the active background and the promoted excerpt/timestamp color when compact and active are combined", async () => {
    const ts = new Date();
    const activeOnly = await fixtureItem(
      html`<lr-conversation-item
        label="Session"
        excerpt="Last message"
        .timestamp=${ts}
        active
      ></lr-conversation-item>`
    );
    const compactOnly = await fixtureItem(
      html`<lr-conversation-item
        label="Session"
        excerpt="Last message"
        .timestamp=${ts}
        compact
      ></lr-conversation-item>`
    );
    const both = await fixtureItem(
      html`<lr-conversation-item
        label="Session"
        excerpt="Last message"
        .timestamp=${ts}
        compact
        active
      ></lr-conversation-item>`
    );

    // `:host([compact]) [part='base']` and `:host([active]) [part='base']` have equal specificity,
    // so this asserts the source order that lets `active` keep its statement-of-appearance.
    const bothBg = partStyle(both, "base").backgroundColor;
    expect(bothBg).to.equal(partStyle(activeOnly, "base").backgroundColor);
    expect(bothBg).to.not.equal(partStyle(compactOnly, "base").backgroundColor);

    // The active contrast fix (excerpt/timestamp promoted to full-strength text) still applies.
    const labelColor = partStyle(both, "label").color;
    expect(partStyle(both, "excerpt").color).to.equal(labelColor);
    expect(partStyle(both, "timestamp").color).to.equal(labelColor);
    expect(partStyle(compactOnly, "excerpt").color).to.not.equal(labelColor);

    // ...and compact still tightened the box.
    expect(rowChrome(both).paddingTop).to.equal("4px");
  });

  it("is accessible in a populated compact state", async () => {
    const el = await fixtureItem(html`
      <lr-conversation-item
        compact
        label="Session"
        excerpt="Last message"
        .timestamp=${new Date()}
        active
      >
        <button slot="actions" type="button" aria-label="Delete conversation">
          x
        </button>
      </lr-conversation-item>
    `);
    expect(el.shadowRoot!.querySelectorAll('[part="excerpt"]').length).to.equal(
      1
    );
    expect(
      el.shadowRoot!.querySelectorAll('[part="timestamp"]').length
    ).to.equal(1);
    expect(
      el.shadowRoot!.querySelectorAll('[part="rename-button"]').length
    ).to.equal(1);
    await expect(el).to.be.accessible();
  });
});

it("click() activates the row, and targets the rename input while renaming", async () => {
  const el = (await fixture(
    html`<lr-conversation-item label="Thread"></lr-conversation-item>`
  )) as LyraConversationItem;
  await el.updateComplete;
  let selected = 0;
  el.addEventListener("lr-select", () => selected++);
  el.click();
  await el.updateComplete;
  expect(
    selected,
    "host click() forwards to the internal selection row"
  ).to.equal(1);

  (el as unknown as { renaming: boolean }).renaming = true;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input");
  expect(input != null, "renaming swaps in a text input").to.equal(true);
  el.click();
  await el.updateComplete;
  expect(
    selected,
    "while renaming, click() must not re-select the row"
  ).to.equal(1);
});
