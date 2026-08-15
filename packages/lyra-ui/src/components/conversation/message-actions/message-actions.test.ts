import {
  aTimeout,
  fixture,
  expect,
  html,
  oneEvent,
  waitUntil,
} from "@open-wc/testing";
import "./message-actions.js";
import "../branch-picker/branch-picker.js";
import type { LyraMessageActions } from "./message-actions.js";
import type { LyraToolbarAction } from "./toolbar-actions.js";

class ClosedToolbarProvider extends HTMLElement {
  private readonly trigger: HTMLButtonElement;
  private unavailable = false;
  readonly action: LyraToolbarAction;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "closed" });
    this.trigger = document.createElement("button");
    this.trigger.textContent = "Closed action";
    root.append(this.trigger);
    const host = this;
    this.action = {
      id: "closed-action",
      get disabled() {
        return host.unavailable;
      },
      focus(options) {
        host.trigger.focus(options);
      },
      setTabIndex(tabIndex) {
        host.trigger.tabIndex = tabIndex;
      },
      matchesEventPath(path) {
        return path.includes(host.trigger);
      },
    };
  }

  getToolbarActions(): readonly LyraToolbarAction[] {
    return [this.action];
  }

  get actionTabIndex(): number {
    return this.trigger.tabIndex;
  }

  get actionFocused(): boolean {
    return (
      this.trigger.getRootNode() instanceof ShadowRoot &&
      (this.trigger.getRootNode() as ShadowRoot).activeElement === this.trigger
    );
  }

  setUnavailable(value: boolean): void {
    this.unavailable = value;
    this.dispatchEvent(
      new CustomEvent("lr-toolbar-actions-change", {
        bubbles: true,
        composed: true,
      })
    );
  }
}

if (!customElements.get("test-closed-toolbar-provider")) {
  customElements.define("test-closed-toolbar-provider", ClosedToolbarProvider);
}

it("does not apply inline-size containment that collapses intrinsic inline layout", async () => {
  const el = (await fixture(
    html`<lr-message-actions
      style="inline-size: 160px;"
      .controls=${["regenerate", "edit"]}
    ></lr-message-actions>`
  )) as LyraMessageActions;
  expect(getComputedStyle(el).containerType).to.equal("normal");
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.scrollWidth).to.be.at.most(el.clientWidth);
});

it("normalizes duplicate built-in controls before rendering and activation", async () => {
  const el = (await fixture(html`<lr-message-actions
    .controls=${["edit", "edit", "regenerate", "regenerate"]}
  ></lr-message-actions>`)) as LyraMessageActions;
  expect(el.shadowRoot!.querySelectorAll('[part="edit-button"]')).to.have.lengthOf(1);
  expect(el.shadowRoot!.querySelectorAll('[part="regenerate-button"]')).to.have.lengthOf(1);

  let edits = 0;
  el.addEventListener("lr-edit", () => edits++);
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="edit-button"]')!.click();
  expect(edits).to.equal(1);
});

it("renders no built-ins by default and no copy button without copyText", async () => {
  const el = (await fixture(
    html`<lr-message-actions></lr-message-actions>`
  )) as LyraMessageActions;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.children.length
  ).to.equal(1); // just the <slot>

  const withCopyControlOnly = (await fixture(
    html`<lr-message-actions .controls=${["copy"]}></lr-message-actions>`
  )) as LyraMessageActions;
  expect(
    withCopyControlOnly.shadowRoot!.querySelector("lr-copy-button") == null
  ).to.be.true;
});

it("renders built-ins in the order controls lists them", async () => {
  const el = (await fixture(
    html`<lr-message-actions
      copy-text="hello"
      .controls=${["feedback", "copy", "regenerate"]}
    ></lr-message-actions>`
  )) as LyraMessageActions;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  const order = [...base.children].map((c) => c.tagName.toLowerCase());
  expect(order).to.deep.equal([
    "lr-message-feedback",
    "lr-copy-button",
    "button",
    "slot",
  ]);
});

it("lr-copy bubbles from the embedded copy button, exactly once", async () => {
  const el = (await fixture(
    html`<lr-message-actions
      copy-text="hi there"
      .controls=${["copy"]}
    ></lr-message-actions>`
  )) as LyraMessageActions;
  const originalClipboard = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard"
  );
  let count = 0;
  let detail: { ok: true; text: string } | undefined;
  el.addEventListener("lr-copy", (e) => {
    count++;
    detail = (e as CustomEvent).detail;
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: () => Promise.resolve() },
  });
  try {
    const copied = oneEvent(el, "lr-copy");
    (el.shadowRoot!.querySelector("lr-copy-button") as HTMLElement)
      .shadowRoot!.querySelector("button")!
      .click();
    await copied;
    expect(count).to.equal(1);
    expect(detail).to.deep.equal({ ok: true, text: "hi there" });
    expect(Object.isFrozen(detail)).to.be.true;
  } finally {
    if (originalClipboard) {
      Object.defineProperty(navigator, "clipboard", originalClipboard);
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  }
});

it("surfaces the embedded copy button's complete clipboard failure contract", async () => {
  const el = (await fixture(
    html`<lr-message-actions
      copy-text="restricted"
      .controls=${["copy"]}
    ></lr-message-actions>`
  )) as LyraMessageActions;
  const originalClipboard = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard"
  );
  const error = new DOMException("denied", "NotAllowedError");
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: () => Promise.reject(error) },
  });
  try {
    const genericFailure = oneEvent(el, "lr-error");
    const detailedFailure = oneEvent(el, "lr-copy-error");
    (el.shadowRoot!.querySelector("lr-copy-button") as HTMLElement)
      .shadowRoot!.querySelector("button")!
      .click();
    const [genericEvent, detailedEvent] = await Promise.all([
      genericFailure,
      detailedFailure,
    ]);
    expect(genericEvent.detail).to.equal(null);
    expect(detailedEvent.detail.ok).to.be.false;
    expect(detailedEvent.detail.text).to.equal("restricted");
    expect(detailedEvent.detail.reason).to.equal("denied");
    expect(detailedEvent.detail.error === error).to.be.true;
    expect(Object.isFrozen(detailedEvent.detail)).to.be.true;
  } finally {
    if (originalClipboard) {
      Object.defineProperty(navigator, "clipboard", originalClipboard);
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  }
});

it("localizes the regenerate/edit buttons and the toolbar accessible name with the built-in English fallback and via .strings override", async () => {
  const el = (await fixture(
    html`<lr-message-actions
      .controls=${["regenerate", "edit"]}
    ></lr-message-actions>`
  )) as LyraMessageActions;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  const regenerate = el.shadowRoot!.querySelector(
    '[part~="regenerate-button"]'
  )!;
  const edit = el.shadowRoot!.querySelector('[part~="edit-button"]')!;
  expect(base.getAttribute("aria-label")).to.equal("Message actions");
  expect(regenerate.getAttribute("aria-label")).to.equal("Regenerate response");
  expect(edit.getAttribute("aria-label")).to.equal("Edit message");

  el.strings = {
    messageActionsLabel: "Actions sur le message",
    regenerateResponse: "Régénérer la réponse",
    editMessage: "Modifier le message",
  };
  await el.updateComplete;
  expect(base.getAttribute("aria-label")).to.equal("Actions sur le message");
  expect(regenerate.getAttribute("aria-label")).to.equal(
    "Régénérer la réponse"
  );
  expect(edit.getAttribute("aria-label")).to.equal("Modifier le message");
});

it("fires lr-regenerate and lr-edit with no detail", async () => {
  const el = (await fixture(
    html`<lr-message-actions
      .controls=${["regenerate", "edit"]}
    ></lr-message-actions>`
  )) as LyraMessageActions;
  const regeneratePromise = oneEvent(el, "lr-regenerate");
  (
    el.shadowRoot!.querySelector(
      '[part~="regenerate-button"]'
    ) as HTMLButtonElement
  ).click();
  // CustomEventInit's `detail` defaults to null; passing `detail: undefined` through to the
  // constructor (this.emit()'s call site here passes no detail argument at all) is normalized to
  // that same default by the platform -- matches this codebase's existing no-detail-event
  // assertions (e.g. attachment-trigger.test.ts, menu-item.test.ts) rather than `undefined`.
  expect((await regeneratePromise).detail).to.be.null;

  const editPromise = oneEvent(el, "lr-edit");
  (
    el.shadowRoot!.querySelector('[part~="edit-button"]') as HTMLButtonElement
  ).click();
  expect((await editPromise).detail).to.be.null;
});

it("the feedback built-in is thumbs-only: no detail configuration is forwarded", async () => {
  const el = (await fixture(
    html`<lr-message-actions .controls=${["feedback"]}></lr-message-actions>`
  )) as LyraMessageActions;
  const feedback = el.shadowRoot!.querySelector(
    "lr-message-feedback"
  ) as HTMLElement & {
    detail?: unknown;
  };
  expect(feedback.detail).to.be.undefined;
  expect(feedback.shadowRoot!.querySelector('[part="panel"]') == null).to.be
    .true;
});

it("forwards feedbackRating to the embedded feedback built-in", async () => {
  const el = (await fixture(
    html`<lr-message-actions
      .controls=${["feedback"]}
      feedback-rating="up"
    ></lr-message-actions>`
  )) as LyraMessageActions;
  const feedback = el.shadowRoot!.querySelector(
    "lr-message-feedback"
  ) as HTMLElement & { rating: string };
  expect(feedback.rating).to.equal("up");
});

it("the built-in feedback owns wrapper-domain change and terminal submit events", async () => {
  const el = (await fixture(
    html`<lr-message-actions .controls=${["feedback"]}></lr-message-actions>`
  )) as LyraMessageActions;
  const changePromise = oneEvent(el, "lr-feedback-change");
  const submitPromise = oneEvent(el, "lr-feedback-submit");
  // `[part="down-button"]` lives inside the embedded lr-message-feedback's own shadow root, one
  // level deeper than lr-message-actions' -- a shadow-piercing part selector needs the extra hop.
  const feedback = el.shadowRoot!.querySelector(
    "lr-message-feedback"
  ) as HTMLElement;
  (
    feedback.shadowRoot!.querySelector(
      '[part="down-button"]'
    ) as HTMLButtonElement
  ).click();
  expect((await changePromise).detail).to.deep.equal({ rating: "down" });
  expect((await submitPromise).detail).to.deep.equal({
    rating: "down",
    reasonIds: [],
    comment: "",
  });
});

it("contains colliding feedback events from slotted children at the slot boundary", async () => {
  const el = (await fixture(html`
    <lr-message-actions>
      <button id="custom-feedback-source">Custom action</button>
    </lr-message-actions>
  `)) as LyraMessageActions;
  const child = el.querySelector("#custom-feedback-source")!;
  let direct = 0;
  let wrapper = 0;
  child.addEventListener("lr-feedback-change", () => direct++);
  el.addEventListener("lr-feedback-change", () => wrapper++);
  child.dispatchEvent(
    new CustomEvent("lr-feedback-change", {
      detail: { unrelated: true },
      bubbles: true,
      composed: true,
    })
  );
  expect(direct).to.equal(1);
  expect(wrapper).to.equal(0);
});

it('is role="toolbar" with a localized default label, or a custom label override', async () => {
  const el = (await fixture(
    html`<lr-message-actions></lr-message-actions>`
  )) as LyraMessageActions;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute("role")).to.equal("toolbar");
  expect(base.getAttribute("aria-label")).to.equal("Message actions");

  const labeled = (await fixture(
    html`<lr-message-actions
      label="Assistant reply actions"
    ></lr-message-actions>`
  )) as LyraMessageActions;
  expect(
    labeled
      .shadowRoot!.querySelector('[part="base"]')!
      .getAttribute("aria-label")
  ).to.equal("Assistant reply actions");
});

it("forwards a host aria-label to the toolbar, winning over label", async () => {
  const el = (await fixture(
    html`<lr-message-actions
      aria-label="Reply toolbar"
      label="Assistant reply actions"
    ></lr-message-actions>`
  )) as LyraMessageActions;
  expect(el.accessibleLabel).to.equal("Reply toolbar");
  expect(
    el.shadowRoot!.querySelector('[role="toolbar"]')!.getAttribute("aria-label")
  ).to.equal("Reply toolbar");

  el.accessibleLabel = "";
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[role="toolbar"]')!.getAttribute("aria-label")
  ).to.equal("");

  el.accessibleLabel = null;
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[role="toolbar"]')!.getAttribute("aria-label")
  ).to.equal("Assistant reply actions");
});

it("roving tabindex: only the active plain-button stop is tabbable, and ArrowRight/ArrowLeft move it", async () => {
  const el = (await fixture(
    html`<lr-message-actions
      .controls=${["regenerate", "edit"]}
    ></lr-message-actions>`
  )) as LyraMessageActions;
  await el.updateComplete;
  const regenerate = el.shadowRoot!.querySelector(
    '[part~="regenerate-button"]'
  ) as HTMLButtonElement;
  const edit = el.shadowRoot!.querySelector(
    '[part~="edit-button"]'
  ) as HTMLButtonElement;
  expect(regenerate.tabIndex).to.equal(0);
  expect(edit.tabIndex).to.equal(-1);

  el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  expect(regenerate.tabIndex).to.equal(-1);
  expect(edit.tabIndex).to.equal(0);
  expect(el.shadowRoot!.activeElement === edit).to.equal(true);
});

it("reconciles the roving stop when a non-active action receives direct focus without interaction reveal", async () => {
  const el = (await fixture(
    html`<lr-message-actions
      .controls=${["regenerate", "edit"]}
    ></lr-message-actions>`
  )) as LyraMessageActions;
  const regenerate = el.shadowRoot!.querySelector(
    '[part~="regenerate-button"]'
  ) as HTMLButtonElement;
  const edit = el.shadowRoot!.querySelector(
    '[part~="edit-button"]'
  ) as HTMLButtonElement;

  edit.focus();
  await el.updateComplete;

  expect(edit.tabIndex).to.equal(0);
  expect(regenerate.tabIndex).to.equal(-1);
  el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      composed: true,
    })
  );
  expect(el.shadowRoot!.activeElement === regenerate).to.equal(true);
});

it("keeps one sequential Tab stop after composite children finish their own updates", async () => {
  const el = (await fixture(
    html`<lr-message-actions
      copy-text="hello"
      .controls=${["copy", "feedback", "regenerate"]}
    ></lr-message-actions>`
  )) as LyraMessageActions;
  const copy = el.shadowRoot!.querySelector("lr-copy-button") as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  const feedback = el.shadowRoot!.querySelector(
    "lr-message-feedback"
  ) as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  await Promise.all([copy.updateComplete, feedback.updateComplete]);
  await Promise.resolve();

  const controls = [
    copy.shadowRoot!.querySelector("button") as HTMLButtonElement,
    ...(feedback.shadowRoot!.querySelectorAll(
      "button"
    ) as NodeListOf<HTMLButtonElement>),
    el.shadowRoot!.querySelector(
      '[part~="regenerate-button"]'
    ) as HTMLButtonElement,
  ];
  expect(controls.filter((control) => control.tabIndex === 0).length).to.equal(
    1
  );
});

it("treats every nested feedback action as its own toolbar stop", async () => {
  const el = (await fixture(
    html`<lr-message-actions
      .controls=${["feedback", "regenerate"]}
    ></lr-message-actions>`
  )) as LyraMessageActions;
  const feedback = el.shadowRoot!.querySelector(
    "lr-message-feedback"
  ) as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  await feedback.updateComplete;
  await Promise.resolve();
  const [up, down] = [
    ...feedback.shadowRoot!.querySelectorAll<HTMLButtonElement>("button"),
  ];
  const regenerate = el.shadowRoot!.querySelector<HTMLButtonElement>(
    '[part~="regenerate-button"]'
  )!;

  expect([up!.tabIndex, down!.tabIndex, regenerate.tabIndex]).to.deep.equal([
    0, -1, -1,
  ]);
  up!.focus();
  up!.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      composed: true,
    })
  );
  expect(feedback.shadowRoot!.activeElement === down).to.equal(true);
  expect([up!.tabIndex, down!.tabIndex, regenerate.tabIndex]).to.deep.equal([
    -1, 0, -1,
  ]);

  down!.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      composed: true,
    })
  );
  expect(el.shadowRoot!.activeElement === regenerate).to.equal(true);
  expect([up!.tabIndex, down!.tabIndex, regenerate.tabIndex]).to.deep.equal([
    -1, -1, 0,
  ]);
});

it("treats both enabled controls inside a slotted composite as distinct toolbar stops", async () => {
  const el = (await fixture(html`
    <lr-message-actions .controls=${["regenerate"]}>
      <lr-branch-picker index="1" count="3"></lr-branch-picker>
    </lr-message-actions>
  `)) as LyraMessageActions;
  const picker = el.querySelector("lr-branch-picker") as HTMLElement & {
    updateComplete: Promise<unknown>;
  };
  await picker.updateComplete;
  await Promise.resolve();
  const [previous, next] = [
    ...picker.shadowRoot!.querySelectorAll<HTMLButtonElement>("button"),
  ];
  const regenerate = el.shadowRoot!.querySelector<HTMLButtonElement>(
    '[part~="regenerate-button"]'
  )!;

  regenerate.focus();
  regenerate.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      composed: true,
    })
  );
  expect(picker.shadowRoot!.activeElement === previous).to.equal(true);
  previous!.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      composed: true,
    })
  );
  expect(picker.shadowRoot!.activeElement === next).to.equal(true);
});

it("navigates a closed-shadow custom composite only through the logical-action protocol", async () => {
  const el = (await fixture(html`
    <lr-message-actions .controls=${["regenerate"]}>
      <test-closed-toolbar-provider></test-closed-toolbar-provider>
    </lr-message-actions>
  `)) as LyraMessageActions;
  const provider = el.querySelector(
    "test-closed-toolbar-provider"
  ) as ClosedToolbarProvider;
  const regenerate = el.shadowRoot!.querySelector<HTMLButtonElement>(
    '[part~="regenerate-button"]'
  )!;
  await waitUntil(
    () => regenerate.tabIndex === 0 && provider.actionTabIndex === -1
  );

  regenerate.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      composed: true,
    })
  );
  expect(provider.actionFocused).to.be.true;
  expect(provider.actionTabIndex).to.equal(0);

  provider.setUnavailable(true);
  await waitUntil(() => regenerate.tabIndex === 0);
  expect(provider.actionTabIndex).to.equal(-1);
});

it('omits provider actions with blank identities before roving focus', async () => {
  const el = (await fixture(html`
    <lr-message-actions .controls=${['regenerate']}>
      <test-closed-toolbar-provider></test-closed-toolbar-provider>
    </lr-message-actions>
  `)) as LyraMessageActions;
  const provider = el.querySelector('test-closed-toolbar-provider') as ClosedToolbarProvider;
  (provider.action as { id: string }).id = '   ';
  provider.setUnavailable(false);
  await el.updateComplete;

  const regenerate = el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="regenerate-button"]')!;
  regenerate.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  expect(el.shadowRoot!.activeElement === regenerate).to.equal(true);
  expect(provider.actionFocused).to.equal(false);
});

it("ArrowLeft/ArrowRight swap under RTL", async () => {
  const el = (await fixture(
    html`<lr-message-actions
      dir="rtl"
      .controls=${["regenerate", "edit"]}
    ></lr-message-actions>`
  )) as LyraMessageActions;
  await el.updateComplete;
  const regenerate = el.shadowRoot!.querySelector(
    '[part~="regenerate-button"]'
  ) as HTMLButtonElement;
  const edit = el.shadowRoot!.querySelector(
    '[part~="edit-button"]'
  ) as HTMLButtonElement;
  el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  expect(regenerate.tabIndex).to.equal(-1);
  expect(edit.tabIndex).to.equal(0);
});

it("Home/End jump roving tabindex to the first/last stop", async () => {
  const el = (await fixture(
    html`<lr-message-actions
      copy-text="x"
      .controls=${["copy", "regenerate", "edit"]}
    ></lr-message-actions>`
  )) as LyraMessageActions;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  base.dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true, composed: true })
  );
  await el.updateComplete;
  expect(
    (el.shadowRoot!.querySelector('[part~="edit-button"]') as HTMLButtonElement)
      .tabIndex
  ).to.equal(0);

  base.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Home", bubbles: true, composed: true })
  );
  await el.updateComplete;
  const copy = el.shadowRoot!.querySelector("lr-copy-button") as HTMLElement;
  expect(
    (copy.shadowRoot!.querySelector("button") as HTMLButtonElement).tabIndex
  ).to.equal(0);
  expect(
    (
      el.shadowRoot!.querySelector(
        '[part~="regenerate-button"]'
      ) as HTMLButtonElement
    ).tabIndex
  ).to.equal(-1);
});

it("slotted controls participate in arrow-key navigation", async () => {
  const el = (await fixture(
    html`<lr-message-actions .controls=${["regenerate"]}
      ><lr-branch-picker index="0" count="3"></lr-branch-picker
    ></lr-message-actions>`
  )) as LyraMessageActions;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  base.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      composed: true,
    })
  );
  await el.updateComplete;
  const branchPicker = el.querySelector("lr-branch-picker")!;
  expect(branchPicker.shadowRoot!.activeElement != null).to.equal(true);
});

it("excludes inert slotted controls and keeps exactly one usable roving fallback", async () => {
  const el = (await fixture(html`
    <lr-message-actions>
      <button id="inert-message-action" inert>Unavailable</button>
      <button id="usable-message-action">Available</button>
    </lr-message-actions>
  `)) as LyraMessageActions;
  await el.updateComplete;
  await Promise.resolve();

  const usable = el.querySelector<HTMLButtonElement>("#usable-message-action")!;
  expect(usable.tabIndex).to.equal(0);
  el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Home", bubbles: true, composed: true })
  );
  expect(el.ownerDocument.activeElement === usable).to.be.true;
});

it("rejects decorative and aria-hidden slotted roots instead of accepting their focus method", async () => {
  const el = (await fixture(html`
    <lr-message-actions>
      <span id="decorative-message-action">Decoration</span>
      <span aria-hidden=" TRUE "
        ><button id="hidden-message-action">Hidden</button></span
      >
      <button id="visible-message-action">Visible</button>
    </lr-message-actions>
  `)) as LyraMessageActions;
  await el.updateComplete;
  await Promise.resolve();

  const visible = el.querySelector<HTMLButtonElement>(
    "#visible-message-action"
  )!;
  expect(visible.tabIndex).to.equal(0);
  el.shadowRoot!.querySelector('[part="base"]')!.dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true, composed: true })
  );
  expect(el.ownerDocument.activeElement === visible).to.be.true;
});

it("live-reconciles every authored availability and actionability change without stale tab stops", async () => {
  const el = (await fixture(html`
    <lr-message-actions>
      <button id="first-live-message-action">First</button>
      <button id="second-live-message-action">Second</button>
      <span id="promoted-live-message-action">Promoted</span>
    </lr-message-actions>
  `)) as LyraMessageActions;
  const first = el.querySelector<HTMLButtonElement>(
    "#first-live-message-action"
  )!;
  const second = el.querySelector<HTMLButtonElement>(
    "#second-live-message-action"
  )!;
  const promoted = el.querySelector<HTMLElement>(
    "#promoted-live-message-action"
  )!;
  await waitUntil(() => first.tabIndex === 0);

  first.disabled = true;
  await waitUntil(() => second.tabIndex === 0);
  expect(first.tabIndex, "a newly disabled former stop is cleared").to.equal(
    -1
  );

  second.setAttribute("aria-disabled", " TRUE ");
  await waitUntil(() => second.tabIndex === -1);
  expect(second.tabIndex, "an aria-disabled former stop is cleared").to.equal(
    -1
  );

  first.disabled = false;
  second.removeAttribute("aria-disabled");
  await waitUntil(() => first.tabIndex === 0);
  first.hidden = true;
  await waitUntil(() => second.tabIndex === 0);
  second.inert = true;
  await waitUntil(() => second.tabIndex === -1);
  expect(second.tabIndex, "an inert former stop is cleared").to.equal(-1);

  promoted.setAttribute("tabindex", "-1");
  await waitUntil(() => promoted.tabIndex === 0);
  promoted.removeAttribute("tabindex");
  await waitUntil(() => promoted.tabIndex === -1);
  expect(
    promoted.tabIndex,
    "a node that stops being actionable is cleared"
  ).to.equal(-1);
});

it("drops a role-only action when its authored actionability is removed", async () => {
  const el = (await fixture(html`
    <lr-message-actions>
      <span id="role-only-message-action" role="button">Role action</span>
      <button id="native-message-fallback">Native fallback</button>
    </lr-message-actions>
  `)) as LyraMessageActions;
  const roleAction = el.querySelector<HTMLElement>(
    "#role-only-message-action"
  )!;
  const fallback = el.querySelector<HTMLButtonElement>(
    "#native-message-fallback"
  )!;
  await waitUntil(() => roleAction.tabIndex === 0);

  roleAction.removeAttribute("role");
  await waitUntil(() => fallback.tabIndex === 0);

  expect(roleAction.tabIndex).to.equal(-1);
  expect(fallback.tabIndex).to.equal(0);
});

it("repairs focus after a focused slotted action is removed or becomes unavailable", async () => {
  const el = (await fixture(html`
    <lr-message-actions>
      <button id="removed-live-message-action">Removed</button>
      <button id="surviving-live-message-action">Survivor</button>
    </lr-message-actions>
  `)) as LyraMessageActions;
  const removed = el.querySelector<HTMLButtonElement>(
    "#removed-live-message-action"
  )!;
  const survivor = el.querySelector<HTMLButtonElement>(
    "#surviving-live-message-action"
  )!;
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  await waitUntil(() => removed.tabIndex === 0);

  removed.focus();
  removed.remove();
  await waitUntil(() => el.ownerDocument.activeElement === survivor);
  expect(survivor.tabIndex).to.equal(0);

  survivor.setAttribute("aria-disabled", "true");
  await waitUntil(() => el.shadowRoot!.activeElement === base);
  expect(survivor.tabIndex).to.equal(-1);
});

it("does not steal newer external focus while live action availability reconciles", async () => {
  const wrapper = await fixture(html`
    <div>
      <lr-message-actions
        ><button id="invalidated-message-action">
          Action
        </button></lr-message-actions
      >
      <button id="outside-message-actions">Outside</button>
    </div>
  `);
  const el = wrapper.querySelector("lr-message-actions") as LyraMessageActions;
  const action = wrapper.querySelector<HTMLButtonElement>(
    "#invalidated-message-action"
  )!;
  const outside = wrapper.querySelector<HTMLButtonElement>(
    "#outside-message-actions"
  )!;
  await waitUntil(() => action.tabIndex === 0);

  action.focus();
  action.hidden = true;
  outside.focus();
  await aTimeout(0);
  await aTimeout(0);

  expect(el.ownerDocument.activeElement === outside).to.equal(true);
});

it("reveal-on-interaction binds to the closest lr-chat-message ancestor", async () => {
  const host = document.createElement("div");
  host.innerHTML =
    "<lr-chat-message><lr-message-actions reveal-on-interaction></lr-message-actions></lr-chat-message>";
  document.body.appendChild(host);
  try {
    const message = host.querySelector("lr-chat-message")!;
    const actions = host.querySelector(
      "lr-message-actions"
    ) as LyraMessageActions;
    await actions.updateComplete;
    expect(actions.hasAttribute("data-revealed")).to.be.false;
    expect(getComputedStyle(actions).opacity).to.equal("0");
    message.dispatchEvent(
      new PointerEvent("pointerenter", { bubbles: true, composed: true })
    );
    await actions.updateComplete;
    expect(actions.hasAttribute("data-revealed")).to.be.true;
    // The opacity change is driven by a CSS transition (--lr-transition-fast); reading
    // getComputedStyle() immediately after the triggering DOM mutation observes a mid-transition
    // value rather than the settled end value (the same class of race app-rail.test.ts documents
    // for its own transitioned transform), so wait past the transition duration first.
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(getComputedStyle(actions).opacity).to.equal("1");
    message.dispatchEvent(
      new PointerEvent("pointerleave", { bubbles: true, composed: true })
    );
    await actions.updateComplete;
    expect(actions.hasAttribute("data-revealed")).to.be.false;
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(getComputedStyle(actions).opacity).to.equal("0");
  } finally {
    host.remove();
  }
});

it("gives the regenerate/edit built-in buttons the shared minimum hit area", async () => {
  const el = (await fixture(
    html`<lr-message-actions
      .controls=${["regenerate", "edit"]}
    ></lr-message-actions>`
  )) as LyraMessageActions;
  const regenerate = el.shadowRoot!.querySelector(
    '[part~="regenerate-button"]'
  ) as HTMLElement;
  const edit = el.shadowRoot!.querySelector(
    '[part~="edit-button"]'
  ) as HTMLElement;

  expect(getComputedStyle(regenerate).minInlineSize).to.equal("40px");
  expect(getComputedStyle(regenerate).minBlockSize).to.equal("40px");
  expect(getComputedStyle(edit).minInlineSize).to.equal("40px");
  expect(getComputedStyle(edit).minBlockSize).to.equal("40px");
});

it("is accessible with every built-in enabled", async () => {
  const el = (await fixture(
    html`<lr-message-actions
      copy-text="hello"
      .controls=${["copy", "regenerate", "edit", "feedback"]}
    ></lr-message-actions>`
  )) as LyraMessageActions;
  await expect(el).to.be.accessible();
});

it("includes foreign-realm slotted controls and awaits their update promises", async () => {
  const el = (await fixture(
    html`<lr-message-actions .controls=${["regenerate"]}></lr-message-actions>`
  )) as LyraMessageActions;
  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  try {
    const foreignWindow = iframe.contentWindow!;
    const control = iframe.contentDocument!.createElement("button");
    control.id = "foreign-action";
    el.append(control);
    await el.updateComplete;

    expect(
      control instanceof HTMLElement,
      "fixture really crosses constructor realms"
    ).to.equal(false);
    const access = el as unknown as {
      reconcileStopsAfterChildren(): Promise<void>;
    };
    const base = el.shadowRoot!.querySelector('[part="base"]')!;
    base.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "End",
        bubbles: true,
        composed: true,
      })
    );
    expect(control.tabIndex).to.equal(0);
    expect(el.ownerDocument.activeElement === control).to.be.true;

    let release!: () => void;
    const foreignUpdate = new foreignWindow.Promise<void>((resolve) => {
      release = resolve;
    });
    Object.defineProperty(control, "updateComplete", {
      configurable: true,
      value: foreignUpdate,
    });
    const reconciliation = access.reconcileStopsAfterChildren();
    const first = await Promise.race([
      reconciliation.then(() => "complete"),
      new Promise<"pending">((resolve) =>
        setTimeout(() => resolve("pending"), 0)
      ),
    ]);
    expect(first).to.equal("pending");
    release();
    await reconciliation;
  } finally {
    iframe.remove();
  }
});

it("rebinds live action observation to the current realm after adoption", async () => {
  const el = (await fixture(html`
    <lr-message-actions>
      <button id="adopted-first-message-action">First</button>
      <button id="adopted-second-message-action">Second</button>
    </lr-message-actions>
  `)) as LyraMessageActions;
  const first = el.querySelector<HTMLButtonElement>(
    "#adopted-first-message-action"
  )!;
  const second = el.querySelector<HTMLButtonElement>(
    "#adopted-second-message-action"
  )!;
  await waitUntil(() => first.tabIndex === 0);
  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  const frameWindow = iframe.contentWindow!;
  const NativeObserver = frameWindow.MutationObserver;
  let observerConstructions = 0;
  frameWindow.MutationObserver = class extends NativeObserver {
    constructor(callback: MutationCallback) {
      observerConstructions++;
      super(callback);
    }
  };
  try {
    iframe.contentDocument!.body.append(iframe.contentDocument!.adoptNode(el));
    await aTimeout(0);
    first.disabled = true;
    await waitUntil(() => second.tabIndex === 0);

    expect(observerConstructions).to.be.greaterThan(0);
    expect(first.tabIndex).to.equal(-1);
  } finally {
    frameWindow.MutationObserver = NativeObserver;
    el.remove();
    iframe.remove();
  }
});
