import { assertCallsBaseWillUpdate } from '../../../../test/contracts/form-lifecycle.js';
import { assertNativeFocusBlurPair } from '../../../../test/contracts/native-focus-blur.js';
import {
  fixture,
  expect,
  oneEvent,
  html,
  waitUntil,
  aTimeout,
} from "@open-wc/testing";
import { sendKeys } from "@web/test-runner-commands";
import type { PropertyValues } from "lit";
import "./select.js";
import "../combobox/option.js";
// Registered so the `sync` vocabulary can be asserted against its sibling control directly,
// rather than against a restatement of what that control is believed to accept.
import type { LyraSelect } from "./select.js";
import type { LyraOption } from "../combobox/option.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import {
  RESET_OPTION_SELECTED_FROM_OWNER,
  SET_OPTION_SELECTED_FROM_OWNER,
} from "../../../internal/option-selection.js";
import { styles } from "./select.styles.js";
import { registerLyraLocale } from "../../../internal/localization.js";
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import {
  __setAnchoredOverlayRuntimeLoaderForTesting,
  type AnchoredOverlayRuntime,
} from "../../../internal/anchored-overlay-runtime.js";
import { chooseOption } from "../../../testing/interaction-drivers.js";

const basic = () => html`
  <lr-select>
    <lr-option value="a">Apple</lr-option>
    <lr-option value="b">Banana</lr-option>
    <lr-option value="c">Cherry</lr-option>
  </lr-select>
`;

function requiredItem<T>(
  items: ArrayLike<T>,
  index: number,
  description: string
): T {
  const item = items[index];
  if (item === undefined) {
    throw new Error(`Expected ${description} at index ${index}.`);
  }
  return item;
}

function trigger(el: LyraSelect): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
}

function rows(el: LyraSelect): NodeListOf<HTMLElement> {
  return el.shadowRoot!.querySelectorAll('[part="option"]');
}

const multi = () => html`
  <lr-select multiple>
    <lr-option value="a">Apple</lr-option>
    <lr-option value="b">Banana</lr-option>
    <lr-option value="c">Cherry</lr-option>
  </lr-select>
`;

/** Every rendered tag, including the "+N" overflow chip (which carries both part names). */
function tags(el: LyraSelect): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll('[part~="tag"]')] as HTMLElement[];
}

function overflowTag(el: LyraSelect): HTMLElement | null {
  return el.shadowRoot!.querySelector('[part~="tag-overflow"]');
}

function clearButton(el: LyraSelect): HTMLButtonElement | null {
  return el.shadowRoot!.querySelector('[part="clear-button"]');
}


it('keeps a cold-open listbox hidden and defers after-show until placement succeeds', async () => {
  let resolveRuntime!: (runtime: AnchoredOverlayRuntime) => void;
  const pendingRuntime = new Promise<AnchoredOverlayRuntime>((resolve) => {
    resolveRuntime = resolve;
  });
  __setAnchoredOverlayRuntimeLoaderForTesting(() => pendingRuntime);
  try {
    const el = await fixture<LyraSelect>(basic());
    el.style.setProperty('--show-duration', '0ms');
    let afterShow = false;
    el.addEventListener('lr-after-show', () => {
      afterShow = true;
    });

    const shown = el.show();
    await el.updateComplete;
    await aTimeout(50);
    const listbox = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
    expect(getComputedStyle(listbox).visibility).to.equal('hidden');
    expect(afterShow).to.equal(false);

    resolveRuntime({
      place: (_anchor, _popup, options = {}) => {
        queueMicrotask(() => options.onPlaced?.({ placement: options.placement ?? 'bottom-start' }));
        return () => undefined;
      },
      trackRect: () => () => undefined,
    } as AnchoredOverlayRuntime);
    await shown;

    expect(getComputedStyle(listbox).visibility).to.equal('visible');
    expect(afterShow).to.equal(true);
  } finally {
    __setAnchoredOverlayRuntimeLoaderForTesting(undefined);
  }
});

it("collects an option constructed by a same-origin foreign custom-element realm", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameWindow = frame.contentWindow;
  const frameDocument = frame.contentDocument;
  if (!frameWindow || !frameDocument) {
    frame.remove();
    throw new Error("The iframe realm was unavailable.");
  }

  class ForeignOption extends frameWindow.HTMLElement {
    value = "foreign";
    label = "Foreign option";
    selected = true;
    defaultSelected = false;
    disabled = false;

    [SET_OPTION_SELECTED_FROM_OWNER](selected: boolean): void {
      this.selected = selected;
    }

    [RESET_OPTION_SELECTED_FROM_OWNER](selected: boolean): void {
      this.selected = selected;
    }
  }

  frameWindow.customElements.define("lr-option", ForeignOption);
  const foreign = frameDocument.createElement("lr-option");
  const el = await fixture<LyraSelect>(html`<lr-select></lr-select>`);
  try {
    const LocalOption = customElements.get("lr-option")!;
    expect(
      foreign instanceof LocalOption,
      "the fixture must not satisfy the ambient class guard"
    ).to.equal(false);
    el.append(document.adoptNode(foreign));
    await aTimeout(0);
    await el.updateComplete;

    expect(el.value).to.equal("foreign");
  } finally {
    frame.remove();
  }
});

describe('collecting already-slotted options without relying on the initial slotchange', () => {
  it('populates options and lets chooseOption() succeed when the initial slotchange is suppressed (simulating happy-dom)', async () => {
    // happy-dom (through at least 20.14.5) never fires `slotchange` for a slot's INITIAL
    // assignment. This suite runs in a real browser, which DOES fire it -- so to reproduce the
    // happy-dom condition deterministically here, swallow that one event with a capture-phase
    // listener on the render root: capture-phase fires on the way down to the <slot> itself,
    // before the slot's own bubble-phase `@slotchange` binding (`collectOptions`) ever sees it.
    const a = document.createElement('lr-option') as LyraOption;
    a.value = 'a';
    a.textContent = 'Apple';
    const b = document.createElement('lr-option') as LyraOption;
    b.value = 'b';
    b.textContent = 'Banana';
    const el = document.createElement('lr-select') as LyraSelect;
    el.append(a, b);
    document.body.append(el);
    // Synchronously after connect: `renderRoot` already exists (created in the constructor,
    // before the first render), well before the browser can dispatch the initial event.
    let intercepted = 0;
    el.renderRoot!.addEventListener(
      'slotchange',
      (e) => {
        intercepted++;
        e.stopImmediatePropagation();
      },
      { capture: true, once: true }
    );
    try {
      await el.updateComplete;
      // Give a real initial slotchange (queued around slot assignment) time to arrive and be
      // swallowed, so the assertions below only see whatever `firstUpdated()` alone collected.
      await aTimeout(50);
      expect(
        intercepted,
        "a real browser does fire the slot's initial slotchange -- this test suppresses it to reproduce happy-dom, which never fires it at all"
      ).to.equal(1);
      el.open = true;
      await el.updateComplete;
      const values = Array.from(rows(el)).map((row) => row.dataset['value']);
      expect(
        values,
        "firstUpdated() collected the already-slotted options and rendered a row per option, with no slotchange ever reaching the component's own listener"
      ).to.deep.equal(['a', 'b']);
      await chooseOption(el, 'b');
      expect(el.value).to.equal('b');
    } finally {
      el.remove();
    }
  });

  it('is idempotent: a real slotchange landing on top of the firstUpdated() collection does not double-apply declarative selection', async () => {
    // No interception here -- both `firstUpdated()`'s own call and the real, un-suppressed
    // initial `slotchange` fire for the same batch. The diagnostic listener below proves the
    // second (real) firing actually happened, so this test exercises the double-invocation path
    // it claims to, rather than accidentally passing because the browser only fired the event
    // once (or fixture timing let `firstUpdated()` win a race that never actually repeats).
    const a = document.createElement('lr-option') as LyraOption;
    a.value = 'a';
    a.textContent = 'Apple';
    const b = document.createElement('lr-option') as LyraOption;
    b.value = 'b';
    b.textContent = 'Banana';
    b.selected = true;
    const el = document.createElement('lr-select') as LyraSelect;
    el.append(a, b);
    document.body.append(el);
    let realSlotchangeCount = 0;
    el.renderRoot!.addEventListener(
      'slotchange',
      () => realSlotchangeCount++,
      { capture: true }
    );
    try {
      await el.updateComplete;
      await aTimeout(50);
      expect(
        realSlotchangeCount,
        'the real initial slotchange must actually have fired for this to prove anything about double-invocation'
      ).to.be.greaterThan(0);
      // Same outcome as the suppressed-event test above: one seeded selection, no duplicated
      // rows, no thrown error from a second pass over an already-known element set.
      expect(el.value, 'the declaratively-selected option wins, exactly once').to.equal('b');
      el.open = true;
      await el.updateComplete;
      const values = Array.from(rows(el)).map((row) => row.dataset['value']);
      expect(values).to.deep.equal(['a', 'b']);
    } finally {
      el.remove();
    }
  });
});

describe("adoptedCallback", () => {
  it('resolves both public transition promises when adoption supersedes settling', async () => {
    const el = await fixture<LyraSelect>(html`
      <lr-select><lr-option value="a">Apple</lr-option></lr-select>
    `);
    const opened = el.show();
    await el.updateComplete;
    (el as unknown as { adoptedCallback(): void }).adoptedCallback();
    // wait-reason: Bound the pending open transition after adoption cancels its paint.
    expect(await Promise.race([opened.then(() => true), aTimeout(100).then(() => false)])).to.equal(true);

    const closed = el.hide();
    await el.updateComplete;
    (el as unknown as { adoptedCallback(): void }).adoptedCallback();
    // wait-reason: Bound the pending close transition after adoption cancels its paint.
    expect(await Promise.race([closed.then(() => true), aTimeout(100).then(() => false)])).to.equal(true);
  });
  it("tears down positioning cleanup and pending listeners when adopted into another document", async () => {
    const el = (await fixture(
      html`<lr-select open><lr-option value="a">Apple</lr-option></lr-select>`
    )) as LyraSelect;
    await el.updateComplete;
    // Opening while connected sets a live positioning `cleanup` callback (see `updated()`).
    expect(
      (el as unknown as { cleanup?: () => void }).cleanup,
      "a live popup has a cleanup callback"
    ).to.not.equal(undefined);
    (el as unknown as { adoptedCallback(): void }).adoptedCallback();
    expect(
      (el as unknown as { cleanup?: () => void }).cleanup,
      "adoption tears the cleanup down"
    ).to.equal(undefined);
  });

  it("no-ops when adopted with no positioning cleanup pending", () => {
    const el = document.createElement("lr-select") as LyraSelect;
    expect(() =>
      (el as unknown as { adoptedCallback(): void }).adoptedCallback()
    ).to.not.throw();
  });

  it("moves a live overlay between real documents without retaining old stack or listeners", async () => {
    const root = (await fixture(html`
      <div>
        <lr-select open><lr-option value="a">Apple</lr-option></lr-select>
        <iframe title="Adoption target"></iframe>
      </div>
    `)) as HTMLElement;
    const el = root.querySelector("lr-select") as LyraSelect;
    const frame = root.querySelector("iframe") as HTMLIFrameElement;
    await waitUntil(
      () => Boolean(frame.contentDocument?.body),
      "the iframe document never became ready"
    );
    await el.updateComplete;
    const oldHandle = (
      el as unknown as {
        overlayHandle?: { isActive(): boolean; isTopmost(): boolean };
      }
    ).overlayHandle;
    expect(oldHandle?.isActive()).to.be.true;
    expect(oldHandle?.isTopmost()).to.be.true;
    expect(el.style.getPropertyValue("--lr-overlay-stack-index")).to.not.equal(
      ""
    );

    const frameDocument = frame.contentDocument!;
    frameDocument.adoptNode(el);
    await el.updateComplete;
    expect(el.ownerDocument === frameDocument).to.be.true;
    expect(el.open, "real adoption runs the disconnect close invariant").to.be
      .false;
    expect(
      oldHandle?.isActive(),
      "the old document no longer owns a stack entry"
    ).to.be.false;
    expect(
      el.style.getPropertyValue("--lr-overlay-stack-index"),
      "the old stack lease is released"
    ).to.equal("");
    expect(
      (el as unknown as { pointer: { document?: Document } }).pointer
        .document === undefined
    ).to.be.true;

    frameDocument.body.append(el);
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;
    const newHandle = (
      el as unknown as {
        overlayHandle?: { isActive(): boolean; isTopmost(): boolean };
      }
    ).overlayHandle;
    expect(newHandle?.isActive()).to.be.true;
    expect(newHandle?.isTopmost()).to.be.true;
    expect(
      newHandle === oldHandle,
      "reconnect gets a new owner-document stack entry"
    ).to.be.false;
    expect(
      (el as unknown as { pointer: { document?: Document } }).pointer
        .document === frameDocument,
      "the capture listener belongs only to the adopted document"
    ).to.be.true;
    expect(el.style.getPropertyValue("--lr-overlay-stack-index")).to.not.equal(
      ""
    );

    document.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, composed: true })
    );
    await el.updateComplete;
    expect(el.open, "the former owner document has no listener left behind").to
      .be.true;
    frameDocument.dispatchEvent(
      new frame.contentWindow!.PointerEvent("pointerdown", {
        bubbles: true,
        composed: true,
      })
    );
    await el.updateComplete;
    expect(el.open, "the new owner document dismisses the reconnected overlay")
      .to.be.false;
  });
});

it("re-binds positioning after a disconnect+reconnect while open, ending up closed rather than half-open with no listeners", async () => {
  const el = (await fixture(
    html`<lr-select open><lr-option value="x"></lr-option></lr-select>`
  )) as LyraSelect;
  await el.updateComplete;
  const parent = el.parentElement!;
  let teardownHide: CustomEvent | undefined;
  el.addEventListener(
    "lr-hide",
    (event) => (teardownHide = event as CustomEvent)
  );
  el.remove();
  await el.updateComplete;
  expect(teardownHide !== undefined).to.be.true;
  expect(
    teardownHide!.cancelable,
    "a disconnected control cannot honour a hide veto"
  ).to.be.false;
  parent.appendChild(el);
  await el.updateComplete;
  // `disconnectedCallback()` resets `open` to `false` — asserting that directly
  // (not an incidental side effect like a leftover inline `position` style,
  // which is set once at first open and never cleared either way) is what
  // actually distinguishes the fix from the pre-fix bug.
  expect(el.open).to.be.false;
});

describe("reconnectOpenPopup (connectedCallback re-arming)", () => {
  // `disconnectedCallback()` always resets `open` back to `false` (see the test above), so
  // `connectedCallback()`'s `hasUpdated && open` gate for `reconnectOpenPopup()` can only ever be
  // satisfied by flipping `open` back on again *while still detached*, before reconnecting --
  // mirroring a drag-drop reparent that wants the popup to reappear already open.

  it("re-arms positioning when open is restored before reconnecting", async () => {
    const el = (await fixture(
      html`<lr-select open hoist><lr-option value="x">X</lr-option></lr-select>`
    )) as LyraSelect;
    await el.updateComplete;
    const parent = el.parentElement!;
    el.remove();
    await el.updateComplete;
    expect(el.open, "disconnecting closed it").to.be.false;

    el.open = true;
    await el.updateComplete;
    parent.appendChild(el);
    await el.updateComplete;
    await aTimeout(20);

    expect(el.open).to.be.true;
    expect(
      (el as unknown as { cleanup?: () => void }).cleanup,
      "reconnectOpenPopup() re-armed the positioning cleanup"
    ).to.not.equal(undefined);
    el.remove();
  });

  it("tears down and replaces an already-live cleanup when called again while still open", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    await el.show();
    const before = (el as unknown as { cleanup?: () => void }).cleanup;
    expect(before, "show() already set a live cleanup").to.not.equal(undefined);
    (el as unknown as { reconnectOpenPopup(): void }).reconnectOpenPopup();
    const after = (el as unknown as { cleanup?: () => void }).cleanup;
    expect(
      after,
      "reconnectOpenPopup() replaced the live cleanup with a fresh one"
    ).to.not.equal(undefined);
  });

  it("no-ops if the element is disconnected again before its queued microtask runs", async () => {
    const el = (await fixture(
      html`<lr-select open><lr-option value="x">X</lr-option></lr-select>`
    )) as LyraSelect;
    await el.updateComplete;
    const parent = el.parentElement!;
    el.remove();
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;

    parent.appendChild(el);
    el.remove(); // synchronously, before the microtask connectedCallback() just queued can run
    await el.updateComplete;
    await aTimeout(20);

    expect(el.isConnected).to.be.false;
  });

  it("no-ops if open is toggled off again before its queued microtask runs", async () => {
    const el = (await fixture(
      html`<lr-select open><lr-option value="x">X</lr-option></lr-select>`
    )) as LyraSelect;
    await el.updateComplete;
    const parent = el.parentElement!;
    el.remove();
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;

    parent.appendChild(el);
    el.open = false; // synchronously, before the microtask connectedCallback() just queued can run
    await el.updateComplete;
    await aTimeout(20);

    expect(el.open).to.be.false;
    el.remove();
  });
});

it("closes the listbox on a pointerdown outside the element", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  expect(el.open).to.be.true;

  document.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, composed: true })
  );
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it("shares activation-ordered visual stacking and topmost dismissal with sibling selects", async () => {
  const root = (await fixture(html`
    <div>
      <lr-select id="later-in-dom"
        ><lr-option value="b">Banana</lr-option></lr-select
      >
      <lr-select id="earlier-in-dom"
        ><lr-option value="a">Apple</lr-option></lr-select
      >
      <button id="outside" type="button">Outside</button>
    </div>
  `)) as HTMLElement;
  const first = root.querySelector("#earlier-in-dom") as LyraSelect;
  const second = root.querySelector("#later-in-dom") as LyraSelect;
  const outside = root.querySelector("#outside") as HTMLButtonElement;
  outside.addEventListener("pointerdown", (event) => event.stopPropagation());

  first.open = true;
  await first.updateComplete;
  second.open = true;
  await second.updateComplete;
  await aTimeout(0);

  const firstHandle = (
    first as unknown as {
      overlayHandle?: { isActive(): boolean; isTopmost(): boolean };
    }
  ).overlayHandle;
  const secondHandle = (
    second as unknown as {
      overlayHandle?: { isActive(): boolean; isTopmost(): boolean };
    }
  ).overlayHandle;
  expect(firstHandle?.isActive()).to.be.true;
  expect(firstHandle?.isTopmost()).to.be.false;
  expect(secondHandle?.isTopmost()).to.be.true;
  const firstStack = Number.parseInt(
    first.style.getPropertyValue("--lr-overlay-stack-index"),
    10
  );
  const secondStack = Number.parseInt(
    second.style.getPropertyValue("--lr-overlay-stack-index"),
    10
  );
  expect(Number.isFinite(firstStack)).to.be.true;
  expect(
    secondStack,
    "activation order wins over the reverse DOM order"
  ).to.be.greaterThan(firstStack);
  const secondListbox =
    second.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
  expect(Number.parseInt(getComputedStyle(secondListbox).zIndex, 10)).to.equal(
    secondStack
  );

  trigger(first).dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      composed: true,
      cancelable: true,
    })
  );
  await first.updateComplete;
  await second.updateComplete;
  expect(second.open, "one Escape closes only the topmost select").to.be.false;
  expect(first.open, "the older select remains open").to.be.true;

  second.open = true;
  await second.updateComplete;
  outside.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, composed: true })
  );
  await first.updateComplete;
  await second.updateComplete;
  expect(
    second.open,
    "capture-phase ownership survives stopped target bubbling"
  ).to.be.false;
  expect(first.open, "one outside pointer still closes only the topmost select")
    .to.be.true;

  first.open = false;
  await first.updateComplete;
});

describe("bindDocumentPointer (internal, defensive guards)", () => {
  it("no-ops when called while disconnected", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    await el.updateComplete;
    el.remove();
    expect(() =>
      (el as unknown as { bindDocumentPointer(): void }).bindDocumentPointer()
    ).to.not.throw();
  });

  it("is idempotent for an already-bound owner document", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    await el.show();
    const before = (el as unknown as { pointer: { listener?: unknown } })
      .pointer.listener;
    expect(before, "show() already bound a listener").to.not.equal(undefined);
    (el as unknown as { bindDocumentPointer(): void }).bindDocumentPointer();
    const after = (el as unknown as { pointer: { listener?: unknown } })
      .pointer.listener;
    expect(
      after,
      "rebinding for the same document is a no-op, not a fresh listener"
    ).to.equal(before);
  });
});

it("fires lr-show/lr-hide when `open` is set directly, bypassing click/keyboard", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  await el.updateComplete;

  setTimeout(() => {
    el.open = true;
  });
  await oneEvent(el, "lr-show");
  await el.updateComplete;
  expect(el.open).to.be.true;

  setTimeout(() => {
    el.open = false;
  });
  await oneEvent(el, "lr-hide");
  expect(el.open).to.be.false;
});

it("closes the listbox when the trigger blurs (e.g. tabbing away)", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.open = true;
  await el.updateComplete;

  trigger(el).dispatchEvent(new FocusEvent("blur"));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it("lets a real Tab leave the trigger and blur-close without restoring focus into the select", async () => {
  const root = (await fixture(html`
    <div>
      <lr-select><lr-option value="a">Apple</lr-option></lr-select>
      <button id="after" type="button">After</button>
    </div>
  `)) as HTMLElement;
  const el = root.querySelector("lr-select") as LyraSelect;
  const after = root.querySelector("#after") as HTMLButtonElement;
  el.open = true;
  await el.updateComplete;
  el.focus();
  await waitUntil(
    () => el.shadowRoot!.activeElement === trigger(el),
    "the trigger never received focus"
  );

  await sendKeys({ press: "Tab" });
  await el.updateComplete;
  await aTimeout(0);

  expect(el.open, "native focus traversal blur-closes the listbox").to.be.false;
  expect(
    document.activeElement?.id,
    "overlay teardown must not pull focus back to its trigger"
  ).to.equal(after.id);
  expect(el.shadowRoot!.activeElement === null).to.be.true;
});

it("forwards public focus and blur to the trigger", async () => {
  const el = (await fixture(basic())) as LyraSelect;

  el.focus();
  expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal(
    "trigger"
  );
  el.blur();
  expect(el.shadowRoot!.activeElement === null).to.equal(true);
});

it("relays exactly one native trigger focus/blur pair, and never lr-focus/lr-blur", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  const nativeEvents: FocusEvent[] = [];
  const aliases: string[] = [];
  el.addEventListener("focus", (event) =>
    nativeEvents.push(event as FocusEvent)
  );
  el.addEventListener("blur", (event) =>
    nativeEvents.push(event as FocusEvent)
  );
  el.addEventListener("lr-focus", () => aliases.push("lr-focus"));
  el.addEventListener("lr-blur", () => aliases.push("lr-blur"));

  btn.focus();
  btn.blur();

  assertNativeFocusBlurPair(el, nativeEvents, aliases);
});

it("skips a disabled option during click selection and keyboard navigation", async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b" disabled>Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
    </lr-select>
  `)) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;

  // ArrowDown twice from -1 should land on Cherry (index 1 of the 2
  // navigable options), skipping disabled Banana entirely.
  btn.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  btn.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;

  setTimeout(() =>
    btn.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      })
    )
  );
  await oneEvent(el, "change");
  expect(el.value).to.equal("c");
});

describe("host click() forwarding", () => {
  it("forwards host click() to the internal trigger button, opening the listbox", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    expect(el.open).to.be.false;
    el.click();
    await el.updateComplete;
    expect(el.open).to.be.true;
  });

  it("does not forward click() when the trigger is disabled, matching a native disabled <button>", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.disabled = true;
    await el.updateComplete;
    el.click();
    await el.updateComplete;
    expect(el.open).to.be.false;
  });
});

describe("lifecycle super calls", () => {
  const LyraSelectCtor = customElements.get("lr-select")!;

  it("calls super.willUpdate so a future LyraElement/mixin lifecycle hook stays wired in", async () => {
    await assertCallsBaseWillUpdate('lr-select', async () =>
      (await fixture(basic())) as LyraSelect
    );
  });

  it("calls super.updated so a future LyraElement/mixin lifecycle hook stays wired in", async () => {
    const proto = LyraElement.prototype as unknown as {
      updated: (changed: PropertyValues) => void;
    };
    const original = proto.updated;
    let calledOnSelect = false;
    proto.updated = function (
      this: LyraElement,
      changed: PropertyValues
    ): void {
      if (this instanceof LyraSelectCtor) calledOnSelect = true;
      original.call(this, changed);
    };
    try {
      const el = (await fixture(basic())) as LyraSelect;
      await el.updateComplete;
      expect(calledOnSelect).to.be.true;
    } finally {
      proto.updated = original;
    }
  });
});

it("seeds a newly-selected option that is slotted in after the initial collection pass", async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;

  const defaultSlot = el.shadowRoot!.querySelector(
    "slot:not([name])"
  ) as HTMLSlotElement;
  const slotchangePromise = oneEvent(defaultSlot, "slotchange");
  const opt = document.createElement("lr-option");
  opt.setAttribute("value", "b");
  opt.textContent = "Banana";
  opt.toggleAttribute("selected", true);
  el.append(opt);
  await slotchangePromise;
  await el.updateComplete;

  expect(el.value).to.equal("b");
});

describe("multiple", () => {
  /**
   * Regression: `value`'s setter truncates to a single entry while `multiple` is still (or
   * defaults to) `false` -- a `.value=${array}` binding placed before a later `.multiple=${true}`
   * in the same template (Lit commits property bindings in source order) permanently dropped every
   * entry past the first, with no error, event, or recovery path.
   */
  it("resolves an initial multi-value binding set before multiple in the same template", async () => {
    const el = (await fixture(html`
      <lr-select .value=${["a", "c"]} .multiple=${true}>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
        <lr-option value="c">Cherry</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;

    expect(el.value).to.deep.equal(["a", "c"]);
  });

  it("resolves an initial default-value binding set before multiple in the same template", async () => {
    const el = (await fixture(html`
      <lr-select .defaultValue=${["a", "c"]} .multiple=${true}>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
        <lr-option value="c">Cherry</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;

    expect(el.defaultValue).to.deep.equal(["a", "c"]);
    expect(el.value).to.deep.equal(["a", "c"]);
  });

  it("exposes an array value and keeps the listbox open while picking several options", async () => {
    const el = (await fixture(multi())) as LyraSelect;
    expect(el.multiple).to.be.true;
    expect(el.value).to.deep.equal([]);

    el.open = true;
    await el.updateComplete;
    requiredItem(rows(el), 0, 'first option row').click();
    await el.updateComplete;
    expect(el.open, "the listbox stays open in multiple mode").to.be.true;
    requiredItem(rows(el), 2, 'third option row').click();
    await el.updateComplete;

    expect(el.value).to.deep.equal(["a", "c"]);
    expect(
      [...rows(el)].map((row) => row.getAttribute("aria-selected"))
    ).to.deep.equal(["true", "false", "true"]);
  });

  it("toggles a already-selected row back off and emits the new array", async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.value = ["a", "b"];
    el.open = true;
    await el.updateComplete;

    const detail: unknown[] = [];
    el.addEventListener("lr-change", (e) =>
      detail.push((e as CustomEvent).detail)
    );
    requiredItem(rows(el), 0, 'first option row').click();
    await el.updateComplete;

    expect(el.value).to.deep.equal(["b"]);
    expect(detail).to.deep.equal([{ value: ["b"], previousValue: ["a", "b"], data: [undefined] }]);
  });

  it("renders one tag per selected option instead of a single label", async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.value = ["a", "b"];
    await el.updateComplete;
    expect(tags(el).map((tag) => tag.textContent!.trim())).to.deep.equal([
      "Apple",
      "Banana",
    ]);
  });

  it("exposes every selected label once through a genuinely visually-hidden current-value node", async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.maxOptionsVisible = 1;
    el.value = ["a", "b", "c"];
    await el.updateComplete;

    const currentValue = trigger(el).querySelector<HTMLElement>(
      '[part="display-input"]'
    )!;
    expect(currentValue.textContent?.trim()).to.equal("Apple, Banana, Cherry");
    expect(currentValue.classList.contains("sr-only")).to.be.true;
    expect(getComputedStyle(currentValue).visibility).to.equal("visible");
    expect(
      trigger(el).getAttribute("aria-describedby")?.split(/\s+/)
    ).to.include(currentValue.id);
    expect(
      [...el.shadowRoot!.querySelectorAll('[part="tag__content"]')].every(
        (content) => content.getAttribute("aria-hidden") === "true"
      ),
      "painted chips do not duplicate the trigger value in the accessibility tree"
    ).to.be.true;
    expect(overflowTag(el)!.getAttribute("aria-hidden")).to.equal("true");
  });

  it("marks the listbox as multi-selectable, rendering both ARIA states", async () => {
    const single = (await fixture(basic())) as LyraSelect;
    expect(
      single
        .shadowRoot!.querySelector('[part="listbox"]')!
        .getAttribute("aria-multiselectable")
    ).to.equal("false");
    const el = (await fixture(multi())) as LyraSelect;
    expect(
      el
        .shadowRoot!.querySelector('[part="listbox"]')!
        .getAttribute("aria-multiselectable")
    ).to.equal("true");
  });

  it("submits every selected value under the control name", async () => {
    const form = (await fixture(html`
      <form>
        <lr-select name="fruit" multiple>
          <lr-option value="a">Apple</lr-option>
          <lr-option value="b">Banana</lr-option>
        </lr-select>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-select") as LyraSelect;
    el.value = ["a", "b"];
    await el.updateComplete;
    expect(new FormData(form).getAll("fruit")).to.deep.equal(["a", "b"]);
  });

  it("preserves duplicate-valued option occurrences through pick, tags, removal, FormData, and restoration", async () => {
    const form = (await fixture(html`
      <form>
        <lr-select name="fruit" multiple>
          <lr-option value="same">First occurrence</lr-option>
          <lr-option value="same">Second occurrence</lr-option>
        </lr-select>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-select") as LyraSelect;
    const options = [...el.querySelectorAll("lr-option")] as LyraOption[];
    el.open = true;
    await el.updateComplete;
    requiredItem(rows(el), 0, 'first duplicate option row').click();
    requiredItem(rows(el), 1, 'second duplicate option row').click();
    await el.updateComplete;

    expect(el.value).to.deep.equal(["same", "same"]);
    expect(el.selectedOptions).to.deep.equal(options);
    expect(tags(el).map((tag) => tag.textContent!.trim())).to.deep.equal([
      "First occurrence",
      "Second occurrence",
    ]);
    expect(new FormData(form).getAll("fruit")).to.deep.equal(["same", "same"]);

    const removeButtons = [
      ...el.shadowRoot!.querySelectorAll<HTMLButtonElement>(
        '[part~="tag__remove-button"]'
      ),
    ];
    requiredItem(removeButtons, 1, 'second tag remove button').click();
    await el.updateComplete;
    expect(el.value).to.deep.equal(["same"]);
    expect(el.selectedOptions).to.deep.equal([options[0]]);

    el.formStateRestoreCallback('["same","same"]', "restore");
    await el.updateComplete;
    expect(el.value).to.deep.equal(["same", "same"]);
    expect(el.selectedOptions).to.deep.equal(options);
  });

  it("contributes no form entry at all while unnamed", async () => {
    const form = (await fixture(html`
      <form>
        <lr-select multiple>
          <lr-option value="a">Apple</lr-option>
        </lr-select>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-select") as LyraSelect;
    el.value = ["a"];
    await el.updateComplete;
    expect([...new FormData(form).keys()]).to.deep.equal([]);
  });

  it("restores a multiple selection from persisted state, and a plain string in single mode", async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.formStateRestoreCallback('["a","c"]', "restore");
    expect(el.value).to.deep.equal(["a", "c"]);
    expect(() =>
      el.formStateRestoreCallback('{"not":"an array"}', "restore")
    ).to.not.throw();
    expect(el.value).to.deep.equal([]);

    const single = (await fixture(basic())) as LyraSelect;
    single.formStateRestoreCallback("b", "restore");
    expect(single.value).to.equal("b");
  });

  it("restores an empty selection from genuinely malformed (unparsable) persisted state", async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.value = ["a", "b"];
    expect(el.value).to.deep.equal(["a", "b"]);
    // Unlike `{"not":"an array"}` above (valid JSON that simply isn't an array), this string fails
    // `JSON.parse()` itself, exercising the catch clause rather than the array-shape check.
    expect(() =>
      el.formStateRestoreCallback("not valid json{", "restore")
    ).to.not.throw();
    expect(el.value).to.deep.equal([]);
  });

  it("collapses to the first selected value when `multiple` is turned off with several selected", async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.value = ["a", "b", "c"];
    await el.updateComplete;
    expect(el.value).to.deep.equal(["a", "b", "c"]);

    el.multiple = false;
    await el.updateComplete;
    expect(
      el.value,
      "only the first selection survives leaving multiple mode"
    ).to.equal("a");
    expect(el.selectedOptions.map((option) => option.value)).to.deep.equal([
      "a",
    ]);
  });

  it("stays invalid while required and empty, and validates once anything is selected", async () => {
    const el = (await fixture(html`
      <lr-select multiple required>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    expect(el.validity.valueMissing).to.be.true;
    el.value = ["a"];
    expect(el.validity.valueMissing).to.be.false;
  });

  it("seeds every declaratively-selected option and restores them all on form.reset()", async () => {
    const form = (await fixture(html`
      <form>
        <lr-select name="fruit" multiple>
          <lr-option value="a" selected>Apple</lr-option>
          <lr-option value="b">Banana</lr-option>
          <lr-option value="c" selected>Cherry</lr-option>
        </lr-select>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-select") as LyraSelect;
    await el.updateComplete;
    expect(el.value).to.deep.equal(["a", "c"]);

    el.value = ["b"];
    form.reset();
    expect(el.value).to.deep.equal(["a", "c"]);
  });

  it("removes the last selected value with Backspace on the trigger", async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.value = ["a", "b"];
    await el.updateComplete;
    let changes = 0;
    el.addEventListener("change", () => changes++);
    trigger(el).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Backspace",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(el.value).to.deep.equal(["a"]);
    expect(changes).to.equal(1);
  });

  it("ignores removing a value that is not selected, or while disabled", async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.value = ["a", "b"];
    await el.updateComplete;
    const removeValue = (value: string): void => {
      const selected = el.value as string[];
      (el as unknown as { removeValueAt(index: number): void }).removeValueAt(
        selected.indexOf(value)
      );
    };

    el.disabled = true;
    removeValue("a");
    expect(
      el.value,
      "disabled blocks removal even of a selected value"
    ).to.deep.equal(["a", "b"]);

    el.disabled = false;
    removeValue("not-selected");
    expect(el.value, "removing an unselected value is a no-op").to.deep.equal([
      "a",
      "b",
    ]);

    removeValue("a");
    expect(el.value).to.deep.equal(["b"]);
  });

  it("focuses the trigger when removing the last remaining tag leaves no remove buttons behind", async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.value = ["a"];
    await el.updateComplete;
    const removeButton = el.shadowRoot!.querySelector(
      '[part~="tag__remove-button"]'
    ) as HTMLButtonElement;
    removeButton.click();
    await el.updateComplete;
    expect(el.value).to.deep.equal([]);
    expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.contain(
      "trigger"
    );
  });

  it("ignores a stale remove action after the selected values change", async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.value = ["a", "b"];
    await el.updateComplete;
    const stale = el.shadowRoot!.querySelector(
      '[part~="tag__remove-button"]'
    ) as HTMLButtonElement;

    el.value = ["b"];
    stale.click();
    await el.updateComplete;

    expect(el.value).to.deep.equal(["b"]);
  });

  it("never removes an already-selected option through closed-state type-ahead", async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.value = ["a"];
    await el.updateComplete;
    trigger(el).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "A",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(el.value).to.deep.equal(["a"]);

    // Let the ~500ms type-ahead buffer lapse, so the next keystroke starts a fresh search
    // instead of extending this one into 'ab'.
    await aTimeout(600);
    trigger(el).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "B",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(el.value).to.deep.equal(["a", "b"]);
  });

  it("continues closed type-ahead past selected occurrences to the next unselected match", async () => {
    const el = (await fixture(html`
      <lr-select multiple>
        <lr-option value="same">Apple</lr-option>
        <lr-option value="same">Apricot</lr-option>
        <lr-option value="same">Avocado</lr-option>
      </lr-select>
    `)) as LyraSelect;
    el.open = true;
    await el.updateComplete;
    const optionRows = rows(el);
    requiredItem(optionRows, 0, 'first type-ahead option row').click();
    requiredItem(optionRows, 2, 'third type-ahead option row').click();
    el.open = false;
    await el.updateComplete;

    // The last selected occurrence is Avocado, so the bounded circular search first encounters
    // the already-selected Apple before reaching the unselected same-valued Apricot occurrence.
    trigger(el).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "A",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;

    expect(el.value).to.deep.equal(["same", "same", "same"]);
    expect(el.selectedOptions.map((option) => option.label)).to.deep.equal([
      "Apple",
      "Avocado",
      "Apricot",
    ]);
  });

  it("is accessible with tags rendered and the listbox open", async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.label = "Fruit";
    el.value = ["a", "b"];
    el.open = true;
    await el.updateComplete;
    // See the identical comment on the single-select "is accessible while open" test above --
    // `[part='listbox']`'s opacity transition is still running at this point.
    el.shadowRoot!.querySelector('[part="listbox"]')
      ?.getAnimations()
      .forEach((animation) => animation.finish());
    await expect(el).to.be.accessible();
  });
});

describe("max-options-visible", () => {
  const many = async (): Promise<LyraSelect> =>
    (await fixture(html`
      <lr-select multiple>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
        <lr-option value="c">Cherry</lr-option>
        <lr-option value="d">Date</lr-option>
        <lr-option value="e">Elderberry</lr-option>
      </lr-select>
    `)) as LyraSelect;

  it('defaults to three tags and collapses the rest behind a "+N" indicator', async () => {
    const el = await many();
    expect(el.maxOptionsVisible).to.equal(3);
    el.strings = { selectSelectedOverflow: "+{n} more" };
    el.value = ["a", "b", "c", "d", "e"];
    await el.updateComplete;

    expect(tags(el).length).to.equal(4);
    expect(overflowTag(el)!.textContent!.trim()).to.equal("+2 more");
  });

  it("shows every tag with no indicator when set to 0", async () => {
    const el = await many();
    el.maxOptionsVisible = 0;
    el.value = ["a", "b", "c", "d", "e"];
    await el.updateComplete;
    expect(tags(el).length).to.equal(5);
    expect(overflowTag(el) === null).to.equal(true);
  });

  it("falls back to three for a non-finite attribute value", async () => {
    const el = await many();
    el.setAttribute("max-options-visible", "not-a-number");
    await el.updateComplete;
    expect(el.maxOptionsVisible).to.equal(3);
  });

  it("formats the hidden count with the effective locale", async () => {
    expectLocaleFallback('ar-EG', ['select', 'removeWithContext']);
    const el = await many();
    el.locale = "ar-EG";
    el.strings = { selectSelectedOverflow: "+{n}" };
    el.value = ["a", "b", "c", "d", "e"];
    await el.updateComplete;
    expect(overflowTag(el)!.textContent!.trim()).to.equal(
      `+${new Intl.NumberFormat("ar-EG").format(2)}`
    );
  });
});

describe("with-clear", () => {
  it("renders no clear button until there is something to clear", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.withClear = true;
    await el.updateComplete;
    expect(clearButton(el) === null).to.equal(true);

    el.value = "b";
    await el.updateComplete;
    expect(clearButton(el) !== null).to.equal(true);
  });

  it("stays absent while unset, even with a value", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.value = "b";
    await el.updateComplete;
    expect(clearButton(el) === null).to.equal(true);
  });

  it("clear() no-ops while disabled, or with nothing selected", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.withClear = true;
    await el.updateComplete;
    const clear = (): void => (el as unknown as { clear(): void }).clear();
    let clears = 0;
    el.addEventListener("lr-clear", () => clears++);

    clear();
    expect(clears, "nothing selected to begin with").to.equal(0);

    el.value = "a";
    el.disabled = true;
    clear();
    expect(
      clears,
      "disabled blocks clearing even with something selected"
    ).to.equal(0);
    expect(el.value).to.equal("a");

    el.disabled = false;
    clear();
    expect(clears).to.equal(1);
    expect(el.value).to.equal("");
  });

  it("clears the selection and announces it once", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.withClear = true;
    el.value = "b";
    await el.updateComplete;

    const seen: string[] = [];
    for (const type of ["input", "change", "lr-change", "lr-clear"]) {
      el.addEventListener(type, () => seen.push(type));
    }
    clearButton(el)!.click();
    await el.updateComplete;

    expect(el.value).to.equal("");
    expect(seen).to.deep.equal(["input", "change", "lr-change", "lr-clear"]);
    expect(clearButton(el) === null).to.equal(true);
  });

  it("clears every value at once in multiple mode", async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.withClear = true;
    el.value = ["a", "b"];
    await el.updateComplete;
    clearButton(el)!.click();
    await el.updateComplete;
    expect(el.value).to.deep.equal([]);
  });

  it("does not open the listbox when the clear button is pressed", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.withClear = true;
    el.value = "b";
    await el.updateComplete;
    clearButton(el)!.click();
    await el.updateComplete;
    expect(el.open).to.be.false;
  });

  it("carries a localized accessible name and the shared icon-button hit-area floor", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.withClear = true;
    el.value = "b";
    el.strings = { clear: "Alles löschen" };
    await el.updateComplete;

    const button = clearButton(el)!;
    expect(button.getAttribute("aria-label")).to.equal("Alles löschen");
    const box = button.getBoundingClientRect();
    expect(box.width).to.be.at.least(36);
    expect(box.height).to.be.at.least(36);
  });

  it("disables the clear button alongside the rest of the control", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.withClear = true;
    el.value = "b";
    el.disabled = true;
    await el.updateComplete;
    expect(clearButton(el)!.disabled).to.be.true;
  });

  it("reserves an inline-end band on the trigger so its content never runs under the button", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const base = getComputedStyle(trigger(el)).paddingInlineEnd;
    el.withClear = true;
    el.value = "b";
    await el.updateComplete;
    expect(getComputedStyle(trigger(el)).paddingInlineEnd).to.equal("36px");
    expect(base).to.not.equal("40px");
  });

  it("moves the clear button to the trailing edge under RTL", async () => {
    const ltr = (await fixture(basic())) as LyraSelect;
    ltr.withClear = true;
    ltr.value = "b";
    await ltr.updateComplete;
    const ltrTrigger = trigger(ltr).getBoundingClientRect();
    expect(clearButton(ltr)!.getBoundingClientRect().right).to.be.closeTo(
      ltrTrigger.right,
      2
    );

    const wrapper = await fixture(html`
      <div dir="rtl">
        <lr-select with-clear>
          <lr-option value="a">Apple</lr-option>
          <lr-option value="b">Banana</lr-option>
        </lr-select>
      </div>
    `);
    const rtl = wrapper.querySelector("lr-select") as LyraSelect;
    rtl.value = "b";
    await rtl.updateComplete;
    const rtlTrigger = trigger(rtl).getBoundingClientRect();
    expect(clearButton(rtl)!.getBoundingClientRect().left).to.be.closeTo(
      rtlTrigger.left,
      2
    );
  });

  it("gives the clear button a :hover rule alongside its :focus-visible ring", () => {
    const css = styles.cssText.replace(/"/g, "'").replace(/\s+/g, " ");
    expect(css).to.match(/\[part='clear-button'\]:hover\s*\{[^}]*color:/);
    expect(css).to.match(
      /\[part='clear-button'\]:focus-visible\s*\{[^}]*outline:/
    );
  });

  it("is accessible with the clear button rendered", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.label = "Fruit";
    el.withClear = true;
    el.value = "b";
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe("getTag", () => {
  it("renders a consumer-supplied chip per selected option, with its index", async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.getTag = (option, index) =>
      html`<span class="custom" data-index=${index}
        >${option.label.toUpperCase()}</span
      >`;
    el.value = ["a", "b"];
    await el.updateComplete;

    const custom = [
      ...el.shadowRoot!.querySelectorAll(".custom"),
    ] as HTMLElement[];
    expect(custom.map((node) => node.textContent)).to.deep.equal([
      "APPLE",
      "BANANA",
    ]);
    expect(custom.map((node) => node.dataset["index"])).to.deep.equal([
      "0",
      "1",
    ]);
    expect(
      el.shadowRoot!.querySelector('[part="tag-label"]') === null
    ).to.equal(true);
  });

  it("renders a returned string as text, never as markup", async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.getTag = () => "<b>bold</b>";
    el.value = ["a"];
    await el.updateComplete;
    const container = el.shadowRoot!.querySelector(
      '[part="tags"]'
    ) as HTMLElement;
    expect(container.querySelector("b") === null).to.equal(true);
    expect(container.textContent).to.contain("<b>bold</b>");
  });

  it("still collapses past max-options-visible", async () => {
    const el = (await fixture(multi())) as LyraSelect;
    el.getTag = (option) => option.value;
    el.maxOptionsVisible = 1;
    el.strings = { selectSelectedOverflow: "+{n}" };
    el.value = ["a", "b", "c"];
    await el.updateComplete;
    expect(overflowTag(el)!.textContent!.trim()).to.equal("+2");
  });
});

describe("placement", () => {
  it("defaults to mapped bottom and reflects", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    expect(el.placement).to.equal("bottom");
    await el.updateComplete;
    expect(el.getAttribute("placement")).to.equal("bottom");
  });

  it("positions the listbox above the trigger when asked to", async () => {
    const wrapper = await fixture(html`
      <div style="padding-block-start: 320px;">
        <lr-select placement="top-start">
          <lr-option value="a">Apple</lr-option>
          <lr-option value="b">Banana</lr-option>
        </lr-select>
      </div>
    `);
    const el = wrapper.querySelector("lr-select") as LyraSelect;
    el.open = true;
    await el.updateComplete;
    await aTimeout(60);

    const listbox = el
      .shadowRoot!.querySelector('[part="listbox"]')!
      .getBoundingClientRect();
    const anchor = trigger(el).getBoundingClientRect();
    expect(listbox.bottom).to.be.at.most(anchor.top + 1);
  });

  it("refreshes placement and hoist strategy in place while already open", async () => {
    const wrapper = await fixture(html`
      <div style="padding-block: 280px;">
        <lr-select placement="bottom-start">
          <lr-option value="a">Apple</lr-option>
          <lr-option value="b">Banana</lr-option>
        </lr-select>
      </div>
    `);
    const el = wrapper.querySelector("lr-select") as LyraSelect;
    el.open = true;
    await el.updateComplete;
    await aTimeout(40);
    const initialCleanup = (el as unknown as { cleanup?: () => void }).cleanup;
    const overlay = (el as unknown as { overlayHandle?: unknown })
      .overlayHandle;

    el.placement = "top-start";
    await el.updateComplete;
    await aTimeout(40);
    const listbox =
      el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
    expect(listbox.getBoundingClientRect().bottom).to.be.at.most(
      trigger(el).getBoundingClientRect().top + 1
    );
    expect(
      (el as unknown as { cleanup?: () => void }).cleanup !== initialCleanup
    ).to.be.true;
    expect(
      (el as unknown as { overlayHandle?: unknown }).overlayHandle === overlay,
      "refresh does not reorder the stack"
    ).to.be.true;

    const placementCleanup = (el as unknown as { cleanup?: () => void })
      .cleanup;
    el.hoist = true;
    await el.updateComplete;
    await aTimeout(20);
    expect(getComputedStyle(listbox).position).to.equal("fixed");
    expect(
      (el as unknown as { cleanup?: () => void }).cleanup !== placementCleanup
    ).to.be.true;
    expect(
      (el as unknown as { overlayHandle?: unknown }).overlayHandle === overlay
    ).to.be.true;
  });

  it("refreshes live position options when a same-batch close is vetoed", async () => {
    const wrapper = await fixture(html`
      <div style="padding-block: 280px;">
        <lr-select placement="bottom-start">
          <lr-option value="a">Apple</lr-option>
          <lr-option value="b">Banana</lr-option>
        </lr-select>
      </div>
    `);
    const el = wrapper.querySelector("lr-select") as LyraSelect;
    el.open = true;
    await el.updateComplete;
    await aTimeout(40);
    const initialCleanup = (el as unknown as { cleanup?: () => void }).cleanup;
    const overlay = (el as unknown as { overlayHandle?: unknown })
      .overlayHandle;
    el.addEventListener("lr-hide", (event) => event.preventDefault(), {
      once: true,
    });

    // Keep all three writes in one Lit batch. The close is vetoed in willUpdate(), but the two
    // live position options still have to reach the already-open popup during that same update.
    el.open = false;
    el.placement = "top-start";
    el.hoist = true;
    await el.updateComplete;
    await aTimeout(40);

    const listbox =
      el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
    expect(el.open, "the close veto keeps the popup open").to.be.true;
    expect(getComputedStyle(listbox).position).to.equal("fixed");
    expect(listbox.getBoundingClientRect().bottom).to.be.at.most(
      trigger(el).getBoundingClientRect().top + 1
    );
    expect(
      (el as unknown as { cleanup?: () => void }).cleanup !== initialCleanup
    ).to.be.true;
    expect(
      (el as unknown as { overlayHandle?: unknown }).overlayHandle === overlay,
      "position refresh preserves the existing stack lease"
    ).to.be.true;
  });

  it("refreshes logical left/right placement when effective direction changes while open", async () => {
    const el = (await fixture(html`
      <lr-select placement="left-start"
        ><lr-option value="a">Apple</lr-option></lr-select
      >
    `)) as LyraSelect;
    el.open = true;
    await el.updateComplete;
    const before = (el as unknown as { cleanup?: () => void }).cleanup;
    const overlay = (el as unknown as { overlayHandle?: unknown })
      .overlayHandle;

    el.dir = "rtl";
    await el.updateComplete;
    await aTimeout(20);
    expect((el as unknown as { cleanup?: () => void }).cleanup !== before).to.be
      .true;
    expect(
      (el as unknown as { overlayHandle?: unknown }).overlayHandle === overlay
    ).to.be.true;
  });
});

describe("lr-select mapped Select parity surface", () => {
  it("exposes defaultValue and a writable selectedOptions snapshot", async () => {
    const el = (await fixture(html`
      <lr-select default-value="b">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect & {
      defaultValue: string | string[];
      selectedOptions: LyraOption[];
    };
    await el.updateComplete;
    expect(el.defaultValue).to.equal("b");
    expect(el.value).to.equal("b");
    expect(el.selectedOptions.map((option) => option.value)).to.deep.equal([
      "b",
    ]);
    el.value = "a";
    el.formResetCallback();
    expect(el.value).to.equal("b");
  });

  it("exposes selectedData -- the selected option's own opaque data, by reference", async () => {
    const payload = { record: "b" };
    const el = (await fixture(html`
      <lr-select>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect & { selectedData: readonly unknown[] };
    const [, banana] = [...el.querySelectorAll("lr-option")] as LyraOption[];
    banana!.data = payload;
    el.value = "b";
    await el.updateComplete;

    expect(el.selectedData.length).to.equal(1);
    expect(el.selectedData[0]).to.equal(payload);

    el.value = "a";
    await el.updateComplete;
    expect(el.selectedData).to.deep.equal([undefined]);
  });

  it("surfaces the newly selected option's data by reference in lr-input/lr-change details", async () => {
    const payload = { record: "b" };
    const el = (await fixture(html`
      <lr-select>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect;
    const [, banana] = [...el.querySelectorAll("lr-option")] as LyraOption[];
    banana!.data = payload;
    el.open = true;
    await el.updateComplete;

    const seen: unknown[] = [];
    for (const type of ["lr-input", "lr-change"]) {
      el.addEventListener(type, (e) =>
        seen.push((e as CustomEvent<{ data: unknown[] }>).detail.data)
      );
    }
    requiredItem(rows(el), 1, "second option row").click();
    await el.updateComplete;

    expect(seen.length).to.equal(2);
    for (const data of seen) {
      expect((data as unknown[])[0]).to.equal(payload);
    }
  });

  it("keeps selectedData and the lr-change data detail index-aligned with value when a stale committed value has no live option", async () => {
    const payload = { record: "b" };
    const el = (await fixture(html`
      <lr-select multiple>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect & { selectedData: readonly unknown[] };
    const [, banana] = [...el.querySelectorAll("lr-option")] as LyraOption[];
    banana!.data = payload;
    // A stale committed value that currently matches no live option -- see `isUnknownValue()`.
    el.value = ["stale"];
    await el.updateComplete;
    expect(el.selectedData).to.deep.equal([undefined]);

    el.open = true;
    await el.updateComplete;
    const seen: unknown[][] = [];
    for (const type of ["lr-input", "lr-change"]) {
      el.addEventListener(type, (e) =>
        seen.push((e as CustomEvent<{ data: unknown[] }>).detail.data)
      );
    }
    requiredItem(rows(el), 1, "second option row").click();
    await el.updateComplete;

    expect(el.value).to.deep.equal(["stale", "b"]);
    // `data` stays the same length as `value`: the stale value's own slot is `undefined`, never
    // dropped, so `b`'s payload lands at index 1 -- not shifted into index 0.
    expect(el.selectedData.length).to.equal(2);
    expect(el.selectedData[0]).to.equal(undefined);
    expect(el.selectedData[1]).to.equal(payload);
    expect(seen.length).to.equal(2);
    for (const data of seen) {
      expect(data.length).to.equal(2);
      expect(data[0]).to.equal(undefined);
      expect(data[1]).to.equal(payload);
    }
  });

  it("accepts a direct defaultValue property write in both single and multiple shapes", async () => {
    const el = (await fixture(html`
      <lr-select>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect & { defaultValue: string | string[] };
    await el.updateComplete;
    expect(el.defaultValue).to.equal("");

    // Array input in single mode keeps only the first entry.
    el.defaultValue = ["a", "b"];
    await el.updateComplete;
    expect(el.defaultValue).to.equal("a");
    expect(el.value).to.equal("a");

    // Falsy input clears it back to the empty string.
    el.defaultValue = "";
    await el.updateComplete;
    expect(el.defaultValue).to.equal("");
    expect(el.value).to.equal("");

    el.multiple = true;
    await el.updateComplete;
    // A plain string in multiple mode becomes a one-element array.
    el.defaultValue = "b";
    await el.updateComplete;
    expect(el.defaultValue).to.deep.equal(["b"]);
    expect(el.value).to.deep.equal(["b"]);
  });

  it("treats a non-array selectedOptions write as an empty selection", async () => {
    const el = (await fixture(
      html`<lr-select><lr-option value="a">Apple</lr-option></lr-select>`
    )) as LyraSelect;
    await el.updateComplete;
    el.value = "a";
    await el.updateComplete;
    expect(el.value).to.equal("a");

    (el as unknown as { selectedOptions: unknown }).selectedOptions = null;
    await el.updateComplete;
    expect(el.value).to.equal("");
    expect(el.selectedOptions).to.deep.equal([]);
  });

  it("falls back to the raw value when a programmatic value has no matching option", async () => {
    const el = (await fixture(
      html`<lr-select><lr-option value="a">Apple</lr-option></lr-select>`
    )) as LyraSelect;
    await el.updateComplete;
    el.value = "ghost";
    await el.updateComplete;
    const display = el.shadowRoot!.querySelector(
      '[part="display-input"]'
    ) as HTMLElement;
    // The raw value stays reachable in the visible text, but the trigger
    // now also flags it as unknown (a trailing "not in catalog" badge) rather than rendering it as
    // an ordinary, unexplained label -- see the dedicated describe block below for the full contract.
    expect(display.textContent).to.contain("ghost");
    expect(display.hasAttribute("data-unknown-value")).to.be.true;
  });

  it("commits live selectedOptions occurrences silently and keeps returned arrays detached", async () => {
    const el = (await fixture(html`
      <lr-select multiple name="fruit">
        <lr-option value="same">First occurrence</lr-option>
        <lr-option value="same">Second occurrence</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    const [first, second, banana] = [
      ...el.querySelectorAll("lr-option"),
    ] as LyraOption[];
    if (!first || !second || !banana) {
      throw new Error('Expected all selected-options fixtures.');
    }
    const events: string[] = [];
    el.addEventListener("input", () => events.push("input"));
    el.addEventListener("change", () => events.push("change"));

    el.selectedOptions = [second, banana];
    await el.updateComplete;

    expect(el.value).to.deep.equal(["same", "b"]);
    expect(el.selectedOptions).to.deep.equal([second, banana]);
    expect([first.selected, second.selected, banana.selected]).to.deep.equal([
      false,
      true,
      true,
    ]);
    expect(events).to.deep.equal([]);

    const snapshot = el.selectedOptions;
    snapshot.length = 0;
    expect(el.selectedOptions).to.deep.equal([second, banana]);

    const foreign = document.createElement("lr-option") as LyraOption;
    foreign.value = "foreign";
    first.remove();
    el.selectedOptions = [foreign, first];
    await el.updateComplete;
    expect(el.value).to.deep.equal([]);
    expect(el.selectedOptions).to.deep.equal([]);

    el.multiple = false;
    await el.updateComplete;
    el.selectedOptions = [banana, second];
    await el.updateComplete;
    expect(el.value).to.equal("b");
    expect(el.selectedOptions).to.deep.equal([banana]);
  });

  it("renders legal removable multi-value tags with every mapped subpart", async () => {
    const el = (await fixture(html`
      <lr-select multiple .value=${["a", "b"]}>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect & { selectedOptions: LyraOption[] };
    await el.updateComplete;
    const remove = el.shadowRoot!.querySelector(
      '[part~="tag__remove-button"]'
    ) as HTMLButtonElement;
    expect(remove != null).to.equal(true);
    expect(remove.closest('button[part~="trigger"]') === null).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part~="tag__base"]')).to.exist;
    expect(el.shadowRoot!.querySelector('[part~="tag__content"]')).to.exist;
    remove.click();
    await el.updateComplete;
    expect(el.value).to.deep.equal(["b"]);
    expect(el.selectedOptions.map((option) => option.value)).to.deep.equal([
      "b",
    ]);
    expect(
      (el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute("part")
    ).to.contain("tag__remove-button");
  });

  it("accepts hoist/filled/help-text/prefix/suffix aliases and clear/expand icon slots", async () => {
    const el = (await fixture(html`
      <lr-select hoist filled help-text="Alias hint" with-clear value="a">
        <span slot="prefix">P</span><span slot="suffix">S</span>
        <span slot="clear-icon">clear</span
        ><span slot="expand-icon">expand</span>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect & { hoist: boolean; filled: boolean; helpText: string };
    expect(el.hoist).to.be.true;
    expect(el.filled).to.be.true;
    const prefix = el.shadowRoot!.querySelector(
      'slot[part="prefix"]'
    ) as HTMLSlotElement;
    const suffix = el.shadowRoot!.querySelector(
      'slot[part="suffix"]'
    ) as HTMLSlotElement;
    expect(prefix.assignedElements()[0]?.textContent).to.equal("P");
    expect(suffix.assignedElements()[0]?.textContent).to.equal("S");
    expect(el.shadowRoot!.querySelector('[part~="form-control-help-text"]')).to
      .exist;
    expect(
      el.shadowRoot!.querySelector('[part~="hint"]')?.textContent
    ).to.contain("Alias hint");
    const clear = el.shadowRoot!.querySelector(
      'slot[name="clear-icon"]'
    ) as HTMLSlotElement;
    const expand = el.shadowRoot!.querySelector(
      'slot[name="expand-icon"]'
    ) as HTMLSlotElement;
    expect(clear.assignedElements()[0]?.textContent).to.equal("clear");
    expect(expand.assignedElements()[0]?.textContent).to.equal("expand");
    await el.show();
    expect(
      (el.shadowRoot!.querySelector('[part="listbox"]') as HTMLElement).style
        .position
    ).to.equal("fixed");
  });

  it("forwards autofocus/title and reflects the blank custom state", async () => {
    const el = (await fixture(html`
      <lr-select autofocus title="Choose fruit"
        ><lr-option value="a">Apple</lr-option></lr-select
      >
    `)) as LyraSelect;
    const button = trigger(el);
    expect(button.autofocus).to.be.true;
    expect(button.title).to.equal("Choose fruit");
    expect(el.matches(":state(blank)")).to.be.true;
    el.value = "a";
    await el.updateComplete;
    expect(el.matches(":state(blank)")).to.be.false;
  });

  it("returns promises that settle after matching after-events", async () => {
    const el = (await fixture(basic())) as LyraSelect & {
      show(): Promise<void>;
      hide(): Promise<void>;
    };
    const seen: string[] = [];
    el.addEventListener("lr-show", () => seen.push("show"));
    el.addEventListener("lr-after-show", () => seen.push("after-show"));
    await el.show();
    expect(seen).to.deep.equal(["show", "after-show"]);
    el.addEventListener("lr-hide", () => seen.push("hide"));
    el.addEventListener("lr-after-hide", () => seen.push("after-hide"));
    await el.hide();
    expect(seen).to.deep.equal(["show", "after-show", "hide", "after-hide"]);
  });

  it("renders a large option set through the delegated listbox path", async () => {
    const el = document.createElement("lr-select") as LyraSelect;
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 1000; index++) {
      const option = document.createElement("lr-option") as LyraOption;
      option.value = String(index);
      option.textContent = `Option ${index}`;
      fragment.append(option);
    }
    el.append(fragment);
    const started = performance.now();
    document.body.append(el);
    try {
      el.open = true;
      await el.updateComplete;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
      expect(el.shadowRoot!.querySelectorAll('[part="option"]')).to.have.lengthOf(
        1000
      );
      expect(performance.now() - started).to.be.below(3000);
    } finally {
      el.remove();
    }
  });
});

it("renders the required marker from the shared themeable rule", async () => {
  const el = (await fixture(html`
    <lr-select required label="Fruit"
      ><lr-option value="a">Apple</lr-option></lr-select
    >
  `)) as LyraSelect;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector(
    '[part~="form-control-label"]'
  ) as HTMLElement;
  expect(getComputedStyle(label, "::after").content).to.contain("*");

  el.style.setProperty("--lr-form-control-required-content", "''");
  await el.updateComplete;
  expect(getComputedStyle(label, "::after").content).to.not.contain("*");
});

it("skips inert options when moving the active descendant", async () => {
  const el = (await fixture(html`
    <lr-select label="Fruit">
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b" inert>Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
    </lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  const inertRow = requiredItem(rows(el), 1, 'inert option row');
  expect(inertRow.getAttribute("aria-disabled")).to.equal("true");
  let changes = 0;
  el.addEventListener("change", () => {
    changes += 1;
  });
  inertRow.click();
  await el.updateComplete;
  expect(
    el.value,
    "pointer activation cannot commit an unavailable option"
  ).to.equal("");
  expect(el.open, "a refused pointer activation does not dismiss the listbox")
    .to.be.true;
  expect(changes).to.equal(0);
  const trigger = el.shadowRoot!.querySelector(
    '[part~="trigger"]'
  ) as HTMLElement;
  const press = (key: string): void => {
    trigger.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
    );
  };
  // From the pristine -1 index the first ArrowDown lands on Apple; the second must skip the inert
  // Banana entirely rather than making it the active descendant.
  press("ArrowDown");
  await el.updateComplete;
  press("ArrowDown");
  await el.updateComplete;
  press("Enter");
  await el.updateComplete;
  expect(el.value, "the inert option is never a navigation stop").to.equal("c");
});

it("contains the internal lr-option-change notification instead of leaking it past the host", async () => {
  const el = (await fixture(html`
    <lr-select><lr-option value="a">Apple</lr-option></lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  const option = el.querySelector("lr-option") as LyraOption;

  let atOption = 0;
  let pastHost = 0;
  let pastDocument = 0;
  option.addEventListener("lr-option-change", () => atOption++);
  el.addEventListener("lr-option-change", () => pastHost++);
  const onDocument = (): void => {
    pastDocument++;
  };
  document.addEventListener("lr-option-change", onDocument);

  try {
    // A real option-data mutation, not a synthetic dispatch: `updated()` on
    // `<lr-option>` emits `lr-option-change` for a `group` change, so this
    // proves the event genuinely fires before asserting where it stops.
    option.group = "Fruit";
    await option.updateComplete;
    await aTimeout(0);
    await el.updateComplete;
  } finally {
    document.removeEventListener("lr-option-change", onDocument);
  }

  expect(atOption, "the option still emits its own notification").to.equal(1);
  expect(
    pastHost,
    "lr-option-change is <lr-select> implementation detail and must not reach a host listener"
  ).to.equal(0);
  expect(pastDocument, "and must not reach the document either").to.equal(0);
  // Containment must not disable the refresh the notification exists to drive.
  const groupLabels = Array.from(
    el.shadowRoot!.querySelectorAll('[part="group-label"]')
  ).map((node) => node.textContent?.trim() ?? "");
  expect(
    groupLabels,
    "the contained notification still refreshes the rendered rows"
  ).to.deep.equal(["Fruit"]);
});

// An empty-valued <lr-option> must be a stable controlled selection.
// Contract: assigning `undefined`/`null` to `value`/`defaultValue` clears the selection; every
// string, INCLUDING `''`, is a candidate value resolved against the current options instead.
describe('empty-valued option as a stable controlled selection', () => {
  const withEmptyOption = () => html`
    <lr-select>
      <lr-option value="">None</lr-option>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `;

  it('selects the empty-valued option when assigned programmatically', async () => {
    const el = (await fixture(withEmptyOption())) as LyraSelect;
    el.value = 'a';
    await el.updateComplete;
    el.value = '';
    await el.updateComplete;
    expect(el.value, 'the empty-valued option is selected, not cleared').to.equal('');
    expect(el.selectedOptions.length, 'an option actually matched').to.equal(1);
    expect(el.selectedOptions[0]!.value).to.equal('');
    expect(el.matches(':state(blank)'), 'a real selection is not the blank state').to.be.false;
  });

  it('selects the empty-valued option when its row is clicked (pointer path)', async () => {
    const el = (await fixture(withEmptyOption())) as LyraSelect;
    el.open = true;
    await el.updateComplete;
    setTimeout(() => requiredItem(rows(el), 0, 'empty-valued option row').click());
    await oneEvent(el, 'change');
    expect(el.value).to.equal('');
    expect(el.selectedOptions.length, 'the pointer path already worked; the fix must not regress it').to.equal(1);
  });

  it('undefined clears an existing selection, distinct from selecting the empty-valued option', async () => {
    const el = (await fixture(withEmptyOption())) as LyraSelect;
    el.value = 'a';
    await el.updateComplete;
    el.value = undefined;
    await el.updateComplete;
    expect(el.value).to.equal('');
    expect(el.selectedOptions.length, 'no option matched -- this really is a clear').to.equal(0);
    expect(el.matches(':state(blank)')).to.be.true;
  });

  it('null clears an existing selection, distinct from selecting the empty-valued option', async () => {
    const el = (await fixture(withEmptyOption())) as LyraSelect;
    el.value = 'a';
    await el.updateComplete;
    el.value = null;
    await el.updateComplete;
    expect(el.value).to.equal('');
    expect(el.selectedOptions.length).to.equal(0);
    expect(el.matches(':state(blank)')).to.be.true;
  });

  it('multiple mode: an empty string in the array selects the empty-valued occurrence alongside others', async () => {
    const el = (await fixture(html`
      <lr-select multiple>
        <lr-option value="">None</lr-option>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    el.value = ['', 'a'];
    await el.updateComplete;
    expect(el.value).to.deep.equal(['', 'a']);
    expect(el.selectedOptions.map((option) => option.value)).to.deep.equal(['', 'a']);
  });

  it('multiple mode: an empty array still clears, distinct from selecting the empty-valued option', async () => {
    const el = (await fixture(html`
      <lr-select multiple>
        <lr-option value="">None</lr-option>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    el.value = ['', 'a'];
    await el.updateComplete;
    el.value = [];
    await el.updateComplete;
    expect(el.value).to.deep.equal([]);
    expect(el.matches(':state(blank)')).to.be.true;
  });

  it('default-value="" targets the empty-valued option too, and a form reset restores it', async () => {
    const form = (await fixture(html`
      <form>
        <lr-select name="choice" default-value="">
          <lr-option value="">None</lr-option>
          <lr-option value="a">Apple</lr-option>
        </lr-select>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-select') as LyraSelect;
    await el.updateComplete;
    expect(el.value, 'the declared default-value="" selects the empty-valued option').to.equal('');
    expect(el.selectedOptions.length).to.equal(1);

    el.value = 'a';
    await el.updateComplete;
    form.reset();
    expect(el.value).to.equal('');
    expect(
      el.selectedOptions.length,
      'reset restores the matched empty-valued option, not a bare clear'
    ).to.equal(1);
  });
});

// A committed value matching no option must not leak its raw string to
// the trigger with no explanation. Mirrors lr-model-select's dashed/italic "not in catalog"
// treatment (see model-select.class.ts's effectiveEntries), adapted to this component's own
// trigger label and multiple-mode tags. The raw value itself stays fully reachable through
// `value`/`selectedOptions` -- only the presentation changes.
describe('unknown committed value presentation', () => {
  it('flags the trigger label as unknown when the committed value matches no option', async () => {
    const el = (await fixture(html`
      <lr-select value="ghost">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;

    expect(el.value, 'the raw value is still reachable').to.equal('ghost');
    const displayInput = el.shadowRoot!.querySelector('[part="display-input"]')!;
    expect(displayInput.hasAttribute('data-unknown-value')).to.be.true;
    expect(displayInput.textContent).to.contain('ghost');
    const badge = displayInput.querySelector('[part="unknown-value"]');
    expect(badge, 'a distinguishing badge renders next to the raw value').to.exist;
  });

  it('shows the placeholder, not an unknown badge, when a matched value is cleared to an empty string', async () => {
    const el = (await fixture(html`
      <lr-select placeholder="Paragraph style" value="Normal">
        <lr-option value="Normal">Normal</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    el.querySelector('lr-option')!.remove();
    el.value = '';
    await waitUntil(() => {
      const display = el.shadowRoot!.querySelector('[part="display-input"]')!;
      return !display.hasAttribute('data-unknown-value') && !display.querySelector('[part="unknown-value"]') &&
        (display.textContent ?? '').includes('Paragraph style');
    }, 'a cleared value renders the placeholder');
    expect(el.value).to.equal('');
  });

  it('still labels an explicit empty-valued option', async () => {
    const el = (await fixture(html`
      <lr-select value="">
        <lr-option value="">None</lr-option>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    const display = el.shadowRoot!.querySelector('[part="display-input"]')!;
    expect(display.textContent).to.contain('None');
    expect(display.hasAttribute('data-unknown-value')).to.be.false;
  });

  it('retints the open-listbox "not in catalog" badge from --lr-select-option-badge-bg', async () => {
    const el = (await fixture(html`
      <lr-select value="ghost" with-unknown-option style="--lr-select-option-badge-bg: rgb(1, 2, 3);">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;
    const badge = el.shadowRoot!.querySelector('[part="option-badge"]') as HTMLElement;
    expect(badge, 'the synthetic unmatched-value row renders its badge while open').to.exist;
    expect(getComputedStyle(badge).backgroundColor).to.equal('rgb(1, 2, 3)');
  });

  it('renders the shipped English default for the unknown-value badge with no locale registered', async () => {
    const el = (await fixture(html`
      <lr-select value="ghost">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    const displayInput = el.shadowRoot!.querySelector('[part="display-input"]')!;
    const badge = displayInput.querySelector('[part="unknown-value"]');
    expect(badge?.textContent).to.equal('not in catalog');
  });

  it("localizes the unknown-value badge through a .strings override", async () => {
    const el = (await fixture(html`
      <lr-select value="ghost">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    el.strings = { notInCatalog: 'Hors catalogue' };
    await el.updateComplete;
    const displayInput = el.shadowRoot!.querySelector('[part="display-input"]')!;
    const badge = displayInput.querySelector('[part="unknown-value"]');
    expect(badge?.textContent).to.equal('Hors catalogue');
  });

  it('does not flag a value that matches an option', async () => {
    const el = (await fixture(basic())) as LyraSelect;
    el.value = 'a';
    await el.updateComplete;
    const displayInput = el.shadowRoot!.querySelector('[part="display-input"]')!;
    expect(displayInput.hasAttribute('data-unknown-value')).to.be.false;
    expect(displayInput.querySelector('[part="unknown-value"]') === null).to.be.true;
  });

  it('flags only the unmatched tag in multiple mode, not every selected tag', async () => {
    const el = (await fixture(html`
      <lr-select multiple>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    el.value = ['a', 'ghost'];
    await el.updateComplete;

    const tags = el.shadowRoot!.querySelectorAll('[part~="tag"]');
    expect(tags).to.have.length(2);
    expect(
      requiredItem(tags, 0, 'matched tag').hasAttribute('data-unknown-value'),
      'the matched value is not flagged'
    ).to.be.false;
    expect(
      requiredItem(tags, 1, 'unmatched tag').hasAttribute('data-unknown-value'),
      'the unmatched value is flagged'
    ).to.be.true;
    expect(
      requiredItem(tags, 1, 'unmatched tag').querySelector('[part="unknown-value"]'),
      'the unmatched chip carries the badge'
    ).to.exist;
  });
});

// A committed value whose matching <lr-option> just hasn't arrived yet (an async catalog fetch
// still in flight) is not the same state as a genuinely stale value: `loading` renders the
// localized loading placeholder in its place instead of badging it "not in catalog" -- see
// `loading`'s own doc on select.class.ts, and the "unknown committed value presentation" block
// above for the unset (default) behavior this must leave untouched.
describe('loading presentation for a pending value', () => {
  it('defaults to false and leaves the unknown-value badge behavior unchanged when unset', async () => {
    const el = (await fixture(html`
      <lr-select value="ghost">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;

    expect(el.loading, 'loading defaults to false').to.be.false;
    const displayInput = el.shadowRoot!.querySelector('[part="display-input"]')!;
    expect(displayInput.hasAttribute('data-unknown-value')).to.be.true;
    expect(displayInput.textContent).to.contain('ghost');
    const badge = displayInput.querySelector('[part="unknown-value"]');
    expect(badge?.textContent).to.equal('not in catalog');
  });

  it('shows the localized loading placeholder instead of the unknown-value badge while loading', async () => {
    const el = (await fixture(html`
      <lr-select value="ghost" loading>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    await el.updateComplete;

    expect(el.value, 'the raw value is still reachable').to.equal('ghost');
    const displayInput = el.shadowRoot!.querySelector('[part="display-input"]')!;
    expect(displayInput.textContent, 'the raw value is not leaked while loading').to.not.contain(
      'ghost'
    );
    expect(displayInput.textContent).to.contain('Loading');
    expect(
      displayInput.hasAttribute('data-unknown-value'),
      'a pending value is not flagged as unknown'
    ).to.be.false;
    expect(displayInput.querySelector('[part="unknown-value"]') === null).to.be.true;
  });

  it('flags only the unresolved tag as pending in multiple mode, leaving a resolved tag alone', async () => {
    const el = (await fixture(html`
      <lr-select multiple loading>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    el.value = ['a', 'ghost'];
    await el.updateComplete;

    const tags = el.shadowRoot!.querySelectorAll('[part~="tag"]');
    expect(tags).to.have.length(2);
    const resolvedTag = requiredItem(tags, 0, 'resolved tag');
    const pendingTag = requiredItem(tags, 1, 'pending tag');
    expect(resolvedTag.textContent, 'a resolved value still shows its real label').to.contain(
      'Apple'
    );
    expect(resolvedTag.hasAttribute('data-unknown-value')).to.be.false;
    expect(pendingTag.textContent).to.not.contain('ghost');
    expect(pendingTag.textContent).to.contain('Loading');
    expect(
      pendingTag.hasAttribute('data-unknown-value'),
      'the pending tag is not flagged as unknown'
    ).to.be.false;
    expect(pendingTag.querySelector('[part="unknown-value"]') === null).to.be.true;
  });

  it('leaves value untouched by loading and renders the real label once the matching option mounts', async () => {
    const el = (await fixture(
      html`<lr-select value="a" loading></lr-select>`
    )) as LyraSelect;
    await el.updateComplete;
    expect(el.value).to.equal('a');
    let displayInput = el.shadowRoot!.querySelector('[part="display-input"]')!;
    expect(displayInput.textContent).to.contain('Loading');

    const defaultSlot = el.shadowRoot!.querySelector(
      'slot:not([name])'
    ) as HTMLSlotElement;
    const slotchangePromise = oneEvent(defaultSlot, 'slotchange');
    const option = document.createElement('lr-option') as LyraOption;
    option.setAttribute('value', 'a');
    option.textContent = 'Apple';
    el.append(option);
    await slotchangePromise;
    await el.updateComplete;

    expect(el.value, 'no re-assignment of value was needed').to.equal('a');
    displayInput = el.shadowRoot!.querySelector('[part="display-input"]')!;
    expect(displayInput.textContent, 'the real label renders once the option mounts').to.contain(
      'Apple'
    );

    el.loading = false;
    await el.updateComplete;
    expect(el.value).to.equal('a');
    displayInput = el.shadowRoot!.querySelector('[part="display-input"]')!;
    expect(displayInput.textContent).to.contain('Apple');
  });

  // The other half of the same state: a create form whose catalog is still being fetched, or an
  // edit form whose saved selection is legitimately empty. `labelFor()` is never reached there, so
  // the trigger used to fall back to the consumer's own `placeholder` and a consumer had to
  // re-localize a string `<lr-select>` already owns.
  describe('empty selection', () => {
    const displayText = (el: LyraSelect): string =>
      el.shadowRoot!.querySelector('[part="display-input"]')!.textContent!.trim();

    it('renders the localized loading text in place of the placeholder', async () => {
      const el = (await fixture(html`
        <lr-select loading placeholder="Pick a fruit" label="Fruit"></lr-select>
      `)) as LyraSelect;
      await el.updateComplete;

      expect(el.value, 'the selection really is empty').to.equal('');
      expect(displayText(el)).to.equal('Loading…');
      expect(displayText(el), 'the consumer placeholder is not shown').to.not.contain(
        'Pick a fruit'
      );
    });

    it('renders the very same localized string the committed-value path renders', async () => {
      const empty = (await fixture(html`
        <lr-select loading placeholder="Pick a fruit" label="Fruit"></lr-select>
      `)) as LyraSelect;
      const committed = (await fixture(html`
        <lr-select loading value="ghost" placeholder="Pick a fruit" label="Fruit"></lr-select>
      `)) as LyraSelect;
      empty.strings = { loading: 'MARKER-LOADING' };
      committed.strings = { loading: 'MARKER-LOADING' };
      await Promise.all([empty.updateComplete, committed.updateComplete]);

      expect(displayText(empty), 'the override reaches this branch too').to.equal(
        'MARKER-LOADING'
      );
      expect(
        displayText(empty),
        'one string covers both halves of the loading state'
      ).to.equal(displayText(committed));
    });

    it('routes that text through registerLyraLocale rather than a literal fallback', async () => {
      // A literal second-arg fallback on `localize()` outranks every registered catalog forever,
      // so a `.strings` override alone cannot prove this branch is translatable.
      registerLyraLocale('qaa-QA', { loading: 'Chargement…' });
      const el = (await fixture(html`
        <lr-select
          loading
          locale="qaa-QA"
          placeholder="Pick a fruit"
          label="Fruit"
        ></lr-select>
      `)) as LyraSelect;
      await el.updateComplete;

      expect(displayText(el)).to.equal('Chargement…');
    });

    it('unset-regression: loading false renders the consumer placeholder exactly as before', async () => {
      const el = (await fixture(html`
        <lr-select placeholder="Pick a fruit" label="Fruit"></lr-select>
      `)) as LyraSelect;
      await el.updateComplete;

      expect(el.loading).to.be.false;
      expect(displayText(el)).to.equal('Pick a fruit');
      const displayInput = el.shadowRoot!.querySelector('[part="display-input"]')!;
      expect(displayInput.hasAttribute('data-placeholder')).to.be.true;

      // And it comes back the moment loading clears, without a value ever being written.
      el.loading = true;
      await el.updateComplete;
      expect(displayText(el)).to.equal('Loading…');
      el.loading = false;
      await el.updateComplete;
      expect(el.value, 'loading never touches value').to.equal('');
      expect(displayText(el)).to.equal('Pick a fruit');
    });

    it('leaves a committed unresolved value on its own established loading path', async () => {
      const el = (await fixture(html`
        <lr-select loading value="ghost" placeholder="Pick a fruit" label="Fruit">
          <lr-option value="a">Apple</lr-option>
        </lr-select>
      `)) as LyraSelect;
      await el.updateComplete;

      expect(el.value).to.equal('ghost');
      expect(displayText(el)).to.equal('Loading…');
      const displayInput = el.shadowRoot!.querySelector('[part="display-input"]')!;
      expect(
        displayInput.hasAttribute('data-unknown-value'),
        'a pending value is still not flagged as unknown'
      ).to.be.false;
      expect(
        displayInput.hasAttribute('data-placeholder'),
        'a committed value is still not a placeholder rendering'
      ).to.be.false;
    });

    it('keeps the trigger name as the field name, with a host aria-label still winning', async () => {
      const named = (await fixture(html`
        <lr-select loading placeholder="Pick a fruit"></lr-select>
      `)) as LyraSelect;
      await named.updateComplete;
      const namedTrigger = named.shadowRoot!.querySelector('[part="trigger"]')!;
      expect(
        namedTrigger.getAttribute('aria-label'),
        'the loading text is the value; the placeholder still names the field'
      ).to.equal('Pick a fruit');
      expect(displayText(named)).to.equal('Loading…');
      await expect(named).to.be.accessible();

      const hosted = (await fixture(html`
        <lr-select loading aria-label="Sort order" placeholder="Pick a fruit"></lr-select>
      `)) as LyraSelect;
      await hosted.updateComplete;
      expect(
        hosted.shadowRoot!.querySelector('[part="trigger"]')!.getAttribute('aria-label'),
        'a host aria-label still wins over every computed internal name'
      ).to.equal('Sort order');
      expect(displayText(hosted)).to.equal('Loading…');
      await expect(hosted).to.be.accessible();
    });

    it('falls back to the localized Select name when nothing else names the field', async () => {
      const el = (await fixture(html`<lr-select loading></lr-select>`)) as LyraSelect;
      await el.updateComplete;

      expect(
        el.shadowRoot!.querySelector('[part="trigger"]')!.getAttribute('aria-label')
      ).to.equal('Select');
      expect(displayText(el)).to.equal('Loading…');
    });
  });
});

// lr-option documents start/end (and the prefix/suffix aliases)
// adornment slots and matching CSS parts, but lr-select's listbox is built from its own
// [part='option'] rows rather than by exposing the option elements, so none of them rendered at
// all -- mirrors lr-combobox's identical popup-adornment contract (cloneSlot/adornmentsFor,
// renderInertPresentation).
