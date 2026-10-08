import { assertCallsBaseWillUpdate } from '../../../../test/contracts/form-lifecycle.js';
import { stubTimeRangePointerGeometry } from '../../../../test/contracts/time-range-pointer.js';
import { assertNativeFocusBlurPair } from '../../../../test/contracts/native-focus-blur.js';
// Focused interaction and event contracts cases. Test bodies and titles were moved intact from the prior suite.
import { fixture, expect, html } from "@open-wc/testing";
import "./time-range.js";
import type { LyraTimeRange, TimeRangePreset } from "./time-range.js";
import { styles } from "./time-range.styles.js";

function beginChangedStartDrag(el: LyraTimeRange, pointerId: number): void {
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const startHandle = el.shadowRoot!.querySelector<HTMLElement>(
    '[part="handle-start"]'
  )!;
  stubTimeRangePointerGeometry(base, startHandle);
  startHandle.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerId, clientX: 40 })
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId, clientX: 100 })
  );
  expect(el.start).to.equal(50);
}

/** Returns the start handle with pointer capture neutralized (synthetic PointerEvents have no real pointer). */
function captureStartHandle(el: LyraTimeRange): HTMLElement {
  const handle = el.shadowRoot!.querySelector<HTMLElement>('[part="handle-start"]')!;
  handle.setPointerCapture = () => {};
  return handle;
}

/** Zero-width layout rect: valueAtPointer()'s division must fall back to ratio 0, never NaN. */
function stubZeroWidthTrack(base: HTMLElement): void {
  base.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
}

const PRESETS = [
  { label: "Last 7 days", start: 0, end: 7 },
  { label: "Last 30 days", start: 0, end: 30 },
  { label: "Last 90 days", start: 0, end: 90 },
];

it("reflects start/end as the range fill width", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  const range = el.shadowRoot!.querySelector('[part="range"]') as HTMLElement;
  expect(range.style.insetInlineStart).to.equal("20%");
  expect(range.style.inlineSize).to.equal("60%");
});

it("moves the start handle with ArrowRight and emits lr-input then lr-change", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="5"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const sequence: Array<{ type: string; event: Event }> = [];
  for (const type of ["input", "lr-input", "change", "lr-change"]) {
    el.addEventListener(type, (event) => sequence.push({ type, event }));
  }
  expect(startHandle.getAttribute("role")).to.equal("slider");
  // lr-input/lr-change are emitted synchronously from the keydown/keyup
  // handlers, so the listener must be attached before dispatch (matches the
  // convention used by lr-multi-split's keyboard-step tests).
  let inputDetail: { start: number; end: number } | undefined;
  el.addEventListener(
    "lr-input",
    (e) => (inputDetail = (e as CustomEvent).detail)
  );
  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(inputDetail!.start).to.equal(25);
  let changeDetail: { start: number; end: number } | undefined;
  el.addEventListener(
    "lr-change",
    (e) => (changeDetail = (e as CustomEvent).detail)
  );
  startHandle.dispatchEvent(
    new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true })
  );
  expect(changeDetail!.start).to.equal(25);
  expect(sequence.map(({ type }) => type)).to.deep.equal([
    "input",
    "lr-input",
    "change",
    "lr-change",
  ]);
  const [nativeInput, aliasInput, nativeChange] = sequence;
  if (!nativeInput || !aliasInput || !nativeChange) {
    throw new Error('The time-range event sequence was incomplete.');
  }
  expect(nativeInput.event.constructor === Event).to.be.true;
  expect(nativeChange.event.constructor === Event).to.be.true;
  expect(nativeInput.event.target === el && nativeChange.event.target === el).to.be.true;
  expect(aliasInput.event instanceof CustomEvent).to.be.true;
  expect((aliasInput.event as CustomEvent).detail).to.deep.equal({
    value: { start: 25, end: 80 },
    start: 25,
    end: 80,
  });
});

it("never lets the start handle pass the end handle", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="78"
      end="80"
      step="5"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  await el.updateComplete;
  expect(el.start).to.equal(80);
});

it("forwards host focus()/blur() to the start handle", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  el.focus();
  expect(el.shadowRoot!.activeElement === startHandle).to.be.true;
  el.blur();
  expect(el.shadowRoot!.activeElement === null).to.equal(true);
});

it('no-ops blur() safely when no handle currently has focus (falls back to the start handle)', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  expect(el.shadowRoot!.activeElement === null).to.be.true;
  // Nothing owns focus here, so blur() takes its fallback branch (querying `[part="handle-start"]`
  // directly) instead of the `activeElementIn(this.shadowRoot)` match used above.
  expect(() => el.blur()).to.not.throw();
  expect(el.shadowRoot!.activeElement === null).to.be.true;
});

it("relays each handle focus/blur as one native pair, and never lr-focus/lr-blur", async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>
    </div>
  `);
  const el = wrapper.querySelector("lr-time-range") as LyraTimeRange;
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;
  const nativeEvents: FocusEvent[] = [];
  const aliases: string[] = [];
  wrapper.addEventListener("focus", (event) =>
    nativeEvents.push(event as FocusEvent)
  );
  wrapper.addEventListener("blur", (event) =>
    nativeEvents.push(event as FocusEvent)
  );
  wrapper.addEventListener("lr-focus", () => aliases.push("lr-focus"));
  wrapper.addEventListener("lr-blur", () => aliases.push("lr-blur"));

  endHandle.focus();
  endHandle.blur();

  assertNativeFocusBlurPair(el, nativeEvents, aliases);
});

it("forwards host click() to the start handle", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  let clicked = false;
  startHandle.addEventListener("click", () => (clicked = true));
  el.click();
  expect(clicked).to.be.true;
});

it("re-clamps when only `end` is set below the current `start` (controlled/two-way binding)", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="50" end="90"></lr-time-range>`
  )) as LyraTimeRange;
  el.end = 10;
  await el.updateComplete;
  // end must never end up left of start: it is pulled up to meet start
  // rather than being left inverted.
  expect(el.end).to.be.at.least(el.start);
  expect(el.end).to.equal(50);
  const range = el.shadowRoot!.querySelector('[part="range"]') as HTMLElement;
  expect(range.style.inlineSize).to.not.include("-");
});

it("re-clamps when only `start` is set above the current `end` (controlled/two-way binding)", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="60"></lr-time-range>`
  )) as LyraTimeRange;
  el.start = 90;
  await el.updateComplete;
  expect(el.start).to.be.at.most(el.end);
  expect(el.start).to.equal(60);
});

it("normalizes a batched controlled endpoint pair atomically without losing either value", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;

  // Both writes join one Lit update. Sequential normalization used to store the new start (90),
  // collapse it against the old end (80), then collapse the new end (10) against that mutation,
  // producing 10/10 and permanently losing 90.
  el.start = 90;
  el.end = 10;
  await el.updateComplete;

  expect(el.start).to.equal(10);
  expect(el.end).to.equal(90);
});

it("does not emit lr-change on keyup of a non-arrow key", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="5"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  let changeFired = false;
  el.addEventListener("lr-change", () => (changeFired = true));
  startHandle.dispatchEvent(
    new KeyboardEvent("keyup", { key: "Tab", bubbles: true })
  );
  expect(changeFired).to.be.false;
});

it("commits a pending keyboard change exactly once when its handle blurs before keyup", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="5"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector<HTMLElement>(
    '[part="handle-start"]'
  )!;
  const endHandle = el.shadowRoot!.querySelector<HTMLElement>(
    '[part="handle-end"]'
  )!;
  const changes: Array<{ value: { start: number; end: number }; start: number; end: number }> = [];
  el.addEventListener("lr-change", (event) => {
    changes.push((event as CustomEvent<{ value: { start: number; end: number }; start: number; end: number }>).detail);
  });

  startHandle.focus();
  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(el.start).to.equal(25);

  endHandle.focus();
  expect(changes).to.deep.equal([{ value: { start: 25, end: 80 }, start: 25, end: 80 }]);

  startHandle.dispatchEvent(
    new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true })
  );
  endHandle.dispatchEvent(
    new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true })
  );
  expect(changes).to.deep.equal([{ value: { start: 25, end: 80 }, start: 25, end: 80 }]);
});

it("removes the window pointermove/pointerup listeners on disconnect so a detached drag cannot leak", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="1"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = captureStartHandle(el);

  // Begin a drag (adds window-level pointermove/pointerup listeners), then
  // remove the element from the DOM without ever delivering a pointerup —
  // mirrors a pointercancel/alt-tab/parent-unmount mid-drag.
  startHandle.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: 40,
    })
  );
  const startBeforeDetach = el.start;
  el.remove();

  let inputFired = false;
  el.addEventListener("lr-input", () => (inputFired = true));
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 100 })
  );
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));

  // If disconnectedCallback hadn't removed the window listeners, the stray
  // pointermove above would still mutate `start` and emit `lr-input` on
  // the now-detached instance.
  expect(inputFired).to.be.false;
  expect(el.start).to.equal(startBeforeDetach);
});

it("tears down the drag on pointercancel even though no pointerup ever arrives", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="1"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = captureStartHandle(el);

  startHandle.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: 40,
    })
  );
  // Per the Pointer Events spec, a cancelled pointer (e.g. an edge-swipe-back
  // gesture, palm rejection, or any system gesture interrupting the touch
  // sequence) never receives a subsequent pointerup. Before the fix, only
  // pointerup tore down the drag, so `this.drags` kept a permanently-stale
  // entry and the window-level pointermove listener stayed attached forever.
  window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 1 }));

  let inputFired = false;
  el.addEventListener("lr-input", () => (inputFired = true));
  const startAfterCancel = el.start;
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 180 })
  );

  // A stray pointermove for the cancelled pointerId must be a no-op: the
  // drag (and its window listeners) should already be gone.
  expect(inputFired).to.be.false;
  expect(el.start).to.equal(startAfterCancel);
});

it("tears down the drag on lostpointercapture even though no pointerup ever arrives", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="1"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = captureStartHandle(el);

  startHandle.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: 40,
    })
  );
  window.dispatchEvent(
    new PointerEvent("lostpointercapture", { pointerId: 1 })
  );

  let inputFired = false;
  el.addEventListener("lr-input", () => (inputFired = true));
  const startAfterLostCapture = el.start;
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 180 })
  );

  expect(inputFired).to.be.false;
  expect(el.start).to.equal(startAfterLostCapture);
});

it("re-clamps start/end into a narrower domain when min/max change after mount", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  // Narrowing `max` (e.g. zooming the time axis) must pull both handles
  // back inside [min, max] instead of leaving `end` (and the range fill)
  // rendered past 100%.
  el.max = 50;
  await el.updateComplete;
  expect(el.start).to.be.within(el.min, el.max);
  expect(el.end).to.be.within(el.min, el.max);
  expect(el.end).to.equal(50);
  expect(el.start).to.equal(20);

  el.min = 30;
  await el.updateComplete;
  expect(el.start).to.be.within(el.min, el.max);
  expect(el.end).to.be.within(el.min, el.max);
  expect(el.start).to.equal(30);
});

it("stops an in-progress drag without mutating start/end once disabled mid-drag", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="1"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  stubTimeRangePointerGeometry(base, startHandle);

  startHandle.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: 40,
    })
  );
  // A drag is now in progress and window-level listeners are attached.
  el.disabled = true;

  let inputFired = false;
  let changeFired = false;
  el.addEventListener("lr-input", () => (inputFired = true));
  el.addEventListener("lr-change", () => (changeFired = true));
  const startBeforeMove = el.start;
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 100 })
  );

  // The already-captured pointer would otherwise keep mutating start/end
  // (pointer capture bypasses `:host([disabled]) { pointer-events: none }`).
  expect(inputFired).to.be.false;
  expect(changeFired).to.be.false;
  expect(el.start).to.equal(startBeforeMove);

  // The drag should also be fully torn down: a further pointermove/up must
  // be no-ops too, and the window listeners must be gone.
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 150 })
  );
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
  expect(inputFired).to.be.false;
  expect(changeFired).to.be.false;
});

it('aborts a still-tracked drag on the next pointermove when :disabled starts matching before formDisabledCallback updates the cached state', async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="1"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  stubTimeRangePointerGeometry(base, startHandle);

  startHandle.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: 40 })
  );
  // liveDisabled ORs in a raw `this.matches(':disabled')` specifically to cover the UA's
  // synchronous fieldset :disabled cascade landing before formDisabledCallback runs (see that
  // getter's own doc comment). Neither `el.disabled = true` nor `formDisabledCallback()` alone
  // reaches onPointerMove's liveDisabled branch, since both already call abortActiveGestures()
  // themselves before any further pointermove can arrive. Stub matches() to force exactly that
  // window instead, the same way other tests here stub getBoundingClientRect/setPointerCapture.
  const originalMatches = el.matches.bind(el);
  const ownMatchesDescriptor = Object.getOwnPropertyDescriptor(el, 'matches');
  Object.defineProperty(el, 'matches', {
    configurable: true,
    value: (selectors: string): boolean =>
      selectors === ":disabled" ? true : originalMatches(selectors),
  });

  let inputFired = false;
  el.addEventListener("lr-input", () => (inputFired = true));
  const startBeforeMove = el.start;
  try {
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 1, clientX: 100 })
    );
  } finally {
    if (ownMatchesDescriptor) Object.defineProperty(el, 'matches', ownMatchesDescriptor);
    else Reflect.deleteProperty(el, 'matches');
  }

  expect(inputFired, "the drag must abort instead of mutating start/end").to.be
    .false;
  expect(el.start).to.equal(startBeforeMove);

  // The drag must also be fully torn down: with matches() restored (liveDisabled false again), a
  // further pointermove must still be a no-op because the drag entry itself is already gone.
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 150 })
  );
  expect(inputFired).to.be.false;
  expect(el.start).to.equal(startBeforeMove);
});

it("does not commit an already-changed drag when directly disabled before pointerup", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  beginChangedStartDrag(el, 101);
  const changes: Array<{ start: number; end: number }> = [];
  el.addEventListener("lr-change", (event) => {
    changes.push((event as CustomEvent<{ start: number; end: number }>).detail);
  });

  el.disabled = true;
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 101 }));
  expect(changes).to.deep.equal([]);
});

it('refuses to start a brand-new drag from a direct handle pointerdown while already disabled', async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="1"
      disabled
    ></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = captureStartHandle(el);
  // The handle's own pointerdown listener is unconditional -- only beginDrag() itself gates on
  // liveDisabled -- so this exercises that guard directly rather than onBasePointerDown's separate
  // top-of-function check (covered by the click-to-seek "ignores a track click while disabled" test).
  startHandle.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerId: 5, clientX: 40 })
  );
  let inputFired = false;
  el.addEventListener("lr-input", () => (inputFired = true));
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 5, clientX: 100 })
  );
  expect(inputFired, "no drag was ever armed").to.be.false;
  expect(el.start).to.equal(20);
});

it("drags the start handle with pointer events and emits lr-input then lr-change on release", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="1"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;

  // Synthetic PointerEvents aren't tied to a real hardware pointer sequence,
  // so setPointerCapture throws "InvalidPointerId" in a real browser; stub
  // it out to exercise the drag math (ratio/clamp/emit) headlessly. Likewise
  // stub the layout rect so the ratio math is deterministic regardless of
  // the test runner's viewport.
  stubTimeRangePointerGeometry(base, startHandle);

  let inputDetail: { start: number; end: number } | undefined;
  el.addEventListener(
    "lr-input",
    (e) => (inputDetail = (e as CustomEvent).detail)
  );
  startHandle.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: 40,
    })
  );
  // Midpoint of the 200px-wide track -> ratio 0.5 -> value 50 on a [0,100] domain.
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 100 })
  );
  expect(inputDetail!.start).to.equal(50);
  expect(inputDetail!.end).to.equal(80);

  let changeDetail: { start: number; end: number } | undefined;
  el.addEventListener(
    "lr-change",
    (e) => (changeDetail = (e as CustomEvent).detail)
  );
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
  expect(changeDetail!.start).to.equal(50);
});

it("keeps an adopted iframe drag on its owner window and releases that window on readoption", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const frameWindow = frame.contentWindow!;
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="1"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  stubTimeRangePointerGeometry(base, startHandle);

  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    startHandle.dispatchEvent(
      new frameWindow.PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 83,
        clientX: 40,
      })
    );
    frameWindow.dispatchEvent(
      new frameWindow.PointerEvent("pointermove", {
        pointerId: 83,
        clientX: 100,
      })
    );
    expect(el.start).to.equal(50);

    document.body.append(document.adoptNode(el));
    await el.updateComplete;
    const adoptedStart = el.start;
    frameWindow.dispatchEvent(
      new frameWindow.PointerEvent("pointermove", {
        pointerId: 83,
        clientX: 140,
      })
    );
    expect(el.start, "the retired iframe listener must be gone").to.equal(
      adoptedStart
    );
  } finally {
    el.remove();
    frame.remove();
  }
});

it("does not arm a drag while disconnected in an ownerless document", async () => {
  const inertDocument = document.implementation.createHTMLDocument("ownerless");
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="1"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  stubTimeRangePointerGeometry(base, startHandle);

  try {
    el.remove();
    inertDocument.adoptNode(el);
    startHandle.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 90,
        clientX: 40,
      })
    );

    document.body.append(document.adoptNode(el));
    await el.updateComplete;
    startHandle.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        pointerId: 91,
        clientX: 40,
      })
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 91, clientX: 100 })
    );
    expect(el.start).to.equal(50);
    window.dispatchEvent(new PointerEvent("pointercancel", { pointerId: 91 }));
  } finally {
    el.remove();
  }
});

it("pointer-maps the midpoint of the full finite number range without overflowing", async () => {
  const el = (await fixture(html`
    <lr-time-range
      min=${-Number.MAX_VALUE}
      max=${Number.MAX_VALUE}
      start=${-Number.MAX_VALUE}
      end=${Number.MAX_VALUE}
      step="0"
    ></lr-time-range>
  `)) as LyraTimeRange;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  stubTimeRangePointerGeometry(base, startHandle);

  startHandle.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 71,
      clientX: 0,
    })
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 71, clientX: 100 })
  );
  expect(el.start).to.equal(0);
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 71 }));
});

it('maps a pointer position to the domain minimum instead of NaN when the track snapshot has zero width', async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="1"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const startHandle = captureStartHandle(el);
  // A zero-width rect, snapshotted at drag start, makes valueAtPointer()'s
  // (clientX - rect.left) / rect.width divide by zero; it must fall back to a raw ratio of 0
  // (the domain minimum) rather than propagating NaN into start/end.
  stubZeroWidthTrack(base);

  startHandle.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: 40 })
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 100 })
  );
  expect(el.start).to.equal(0);
});

it("keeps live values but suppresses lr-change and tears down on pointercancel/lostpointercapture", async () => {
  for (const [index, endType] of (
    ["pointercancel", "lostpointercapture"] as const
  ).entries()) {
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="20"
        end="80"
        step="1"
      ></lr-time-range>`
    )) as LyraTimeRange;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const startHandle = el.shadowRoot!.querySelector(
      '[part="handle-start"]'
    ) as HTMLElement;
    stubTimeRangePointerGeometry(base, startHandle);
    let inputs = 0;
    let changes = 0;
    el.addEventListener("lr-input", () => inputs++);
    el.addEventListener("lr-change", () => changes++);
    const pointerId = 60 + index;

    startHandle.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId, clientX: 40 })
    );
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId, clientX: 100 })
    );
    expect(el.start, endType).to.equal(50);
    expect(inputs, endType).to.equal(1);

    window.dispatchEvent(new PointerEvent(endType, { pointerId }));
    expect(changes, endType).to.equal(0);
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId, clientX: 180 })
    );
    expect(inputs, endType).to.equal(1);
    expect(el.start, endType).to.equal(50);
  }
});

it('mirrors the drag ratio under dir="rtl", since the track is positioned with inset-inline-start', async () => {
  const el = (await fixture(
    html`<lr-time-range
      dir="rtl"
      min="0"
      max="100"
      start="20"
      end="80"
      step="1"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;

  stubTimeRangePointerGeometry(base, startHandle);

  let inputDetail: { start: number; end: number } | undefined;
  el.addEventListener(
    "lr-input",
    (e) => (inputDetail = (e as CustomEvent).detail)
  );
  startHandle.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: 40,
    })
  );
  // Pointer at physical x=160 on a 200px track under RTL: raw=0.8, mirrored
  // to ratio 0.2 -> value 20 on a [0,100] domain (0 renders at the right
  // edge in RTL, so the *left* 20% of physical space is still "near zero").
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 160 })
  );
  expect(el.start).to.equal(20);
  expect(inputDetail).to.equal(undefined);
});

it('mirrors ArrowRight/ArrowLeft under dir="rtl" to keep the physical direction consistent with dragging', async () => {
  const el = (await fixture(
    html`<lr-time-range
      dir="rtl"
      min="0"
      max="100"
      start="20"
      end="80"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;

  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(el.start).to.equal(19);

  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
  );
  expect(el.start).to.equal(20);
});

it("widens the handle hit/drag area past the visible 14px dot via a transparent ::before", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  // The visible dot itself must stay 14px (unchanged design).
  expect(getComputedStyle(startHandle).width).to.equal("14px");
  // The actual hit/drag area (the ::before hit-slop) must be widened well
  // past the visible dot, closer to the ~24-28px minimum touch target size.
  const before = getComputedStyle(startHandle, "::before");
  expect(before.content).to.not.equal("none");
  expect(before.width).to.equal("28px");
  expect(before.height).to.equal("28px");
});

it("uses cursor:not-allowed (not pointer-events:none) when disabled, matching every other lr-* control", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      disabled
    ></lr-time-range>`
  )) as LyraTimeRange;
  const hostStyle = getComputedStyle(el);
  expect(hostStyle.pointerEvents).to.not.equal("none");
  expect(hostStyle.cursor).to.equal("not-allowed");
  expect(hostStyle.opacity).to.equal("0.5");
  // [part^='handle'] sets `cursor: grab` unconditionally, so the
  // disabled-cursor rule must be restated on the handle specifically for it
  // to actually change there too, not just on the track.
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  expect(getComputedStyle(startHandle).cursor).to.equal("not-allowed");
  let delegatedCalls = 0;
  startHandle.click = () => {
    delegatedCalls += 1;
  };
  startHandle.focus = () => {
    delegatedCalls += 1;
  };
  el.click();
  el.focus();
  expect(
    delegatedCalls,
    "fieldset disablement gates host click/focus delegation"
  ).to.equal(0);
});

it("calls super.willUpdate so a future LyraElement/mixin lifecycle hook stays wired in", async () => {
  await assertCallsBaseWillUpdate('lr-time-range', async () =>
    (await fixture(html`<lr-time-range></lr-time-range>`)) as LyraTimeRange
  );
});

it("references the shared focus-ring tokens on the handle focus-visible outline instead of hardcoded literals", () => {
  expect(styles.cssText).to.include(
    "outline: var(--lr-focus-ring-width) solid var(--lr-focus-ring-color)"
  );
  expect(styles.cssText).to.include(
    "outline-offset: var(--lr-focus-ring-offset)"
  );
});

it("does not lock dragging to a fixed value when min > max", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="100"
      max="0"
      start="20"
      end="80"
      step="5"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  stubTimeRangePointerGeometry(base, startHandle);

  startHandle.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: 40,
    })
  );
  // The pointer maps through the normalized [0, 100] domain even though the
  // public min/max attributes are reversed.
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 100 })
  );
  expect(el.start).to.equal(50);
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 180 })
  );
  // The 90% pointer position is 90, but the start handle cannot cross end=80.
  expect(el.start).to.equal(80);
});

it("maps RTL pointer positions through the normalized domain when min > max", async () => {
  const el = (await fixture(
    html`<lr-time-range
      dir="rtl"
      min="100"
      max="0"
      start="20"
      end="80"
      step="1"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  stubTimeRangePointerGeometry(base, startHandle);

  startHandle.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: 40,
    })
  );
  // RTL mirrors raw=.2 to .8, then uses normalized [0,100] math: 80.
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 40 })
  );
  expect(el.start).to.equal(80);
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
});

it("tracks concurrent drags by pointerId so a second pointer cannot hijack the first drag's handle", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="1"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;
  stubTimeRangePointerGeometry(base, startHandle, endHandle);

  // Finger 1 starts dragging handle-start; finger 2 starts dragging
  // handle-end before finger 1 lifts (two-finger touch drag).
  startHandle.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: 40,
    })
  );
  endHandle.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 2,
      clientX: 160,
    })
  );

  // Before the fix, the single `dragging` scalar was overwritten to 'end' by
  // the second pointerdown, so moving finger 1 (pointerId 1) would have
  // mutated `end` instead of `start`.
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 60 })
  );
  expect(el.start).to.equal(30);
  expect(el.end).to.equal(80);

  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 2, clientX: 180 })
  );
  expect(el.end).to.equal(90);
  expect(el.start).to.equal(30);

  // Before the fix, any single pointerup unconditionally cleared `dragging`
  // and tore down both window listeners, silently ending finger 2's
  // still-in-progress drag too.
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 2, clientX: 190 })
  );
  expect(el.end).to.equal(95);
});

it('ignores a stray pointermove for an already-ended pointerId while a second concurrent drag is still live', async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="1"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;
  stubTimeRangePointerGeometry(base, startHandle, endHandle);

  // Two concurrent drags, then only the first (pointerId 1) is released -- the window-level
  // pointermove listener stays attached because pointerId 2's drag is still active, so a further
  // pointermove for the now-untracked pointerId 1 actually reaches onPointerMove() (unlike ending
  // the only drag, which tears the listener down entirely) and must find no tracked entry there.
  startHandle.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: 40 })
  );
  endHandle.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerId: 2, clientX: 160 })
  );
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));

  const startAfterRelease = el.start;
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 180 })
  );
  expect(el.start, "pointerId 1 no longer owns a drag").to.equal(
    startAfterRelease
  );

  // pointerId 2's own drag is unaffected.
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 2, clientX: 190 })
  );
  expect(el.end).to.equal(95);
});

it('ignores a pointerup for an untracked pointerId without disturbing an active drag', async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="1"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  stubTimeRangePointerGeometry(base, startHandle);

  startHandle.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: 40 })
  );
  // A pointerup for a pointerId that never started a drag on this element (e.g. a second, unrelated
  // pointer lifting elsewhere) must be a pure no-op -- endDrag() finds no tracked entry for it and
  // must not disturb the real in-progress drag.
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 999 }));

  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 100 })
  );
  expect(el.start, "the real drag is still live").to.equal(50);
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
});

it("does not poison start/end with NaN when step is 0", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="0"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  await el.updateComplete;
  // Before the fix: Math.round(20 / 0) * 0 === NaN, and NaN then propagates
  // into `start` permanently (and cross-contaminates `end` on the next
  // drag via the sibling-clamp comparison).
  expect(Number.isNaN(el.start)).to.be.false;
  expect(el.start).to.equal(20);
});

it("ignores nonpositive and nonfinite keyboard steps without moving or emitting events", async () => {
  for (const step of [
    0,
    -5,
    Number.NaN,
    Number.NEGATIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ]) {
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="20"
        end="80"
      ></lr-time-range>`
    )) as LyraTimeRange;
    el.step = step;
    await el.updateComplete;
    const startHandle = el.shadowRoot!.querySelector(
      '[part="handle-start"]'
    ) as HTMLElement;
    const events: string[] = [];
    for (const type of ["input", "lr-input", "change", "lr-change"]) {
      el.addEventListener(type, () => events.push(type));
    }

    startHandle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );
    startHandle.dispatchEvent(
      new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true })
    );
    await el.updateComplete;

    expect(el.start, `step=${String(step)}`).to.equal(20);
    expect(events, `step=${String(step)}`).to.deep.equal([]);
  }
});

it("saturates finite Arrow and Page keyboard increments at either domain bound", async () => {
  for (const { key, min, start, expected } of [
    {
      key: "ArrowRight",
      min: 0,
      start: Number.MAX_VALUE / 2,
      expected: Number.MAX_VALUE,
    },
    {
      key: "PageUp",
      min: 0,
      start: Number.MAX_VALUE / 2,
      expected: Number.MAX_VALUE,
    },
    {
      key: "ArrowLeft",
      min: -Number.MAX_VALUE,
      start: -Number.MAX_VALUE / 2,
      expected: -Number.MAX_VALUE,
    },
    {
      key: "PageDown",
      min: -Number.MAX_VALUE,
      start: -Number.MAX_VALUE / 2,
      expected: -Number.MAX_VALUE,
    },
  ] as const) {
    const el = (await fixture(
      html`<lr-time-range></lr-time-range>`
    )) as LyraTimeRange;
    el.min = min;
    el.max = Number.MAX_VALUE;
    el.start = start;
    el.end = Number.MAX_VALUE;
    el.step = Number.MAX_VALUE;
    await el.updateComplete;
    const startHandle = el.shadowRoot!.querySelector(
      '[part="handle-start"]'
    ) as HTMLElement;
    const events: string[] = [];
    for (const type of ["input", "lr-input", "change", "lr-change"]) {
      el.addEventListener(type, () => events.push(type));
    }

    startHandle.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true })
    );
    await el.updateComplete;
    expect(el.start, key).to.equal(expected);
    startHandle.dispatchEvent(
      new KeyboardEvent("keyup", { key, bubbles: true })
    );

    expect(events, key).to.deep.equal([
      "input",
      "lr-input",
      "change",
      "lr-change",
    ]);
  }
});

it("rounds a non-integer step to its own decimal precision instead of accumulating float drift", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="0.1"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  await el.updateComplete;
  expect(el.start).to.equal(20.1);
  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  await el.updateComplete;
  // Before the fix, re-deriving `current + step` from the already-stepped
  // 20.1 produced 20.200000000000003 (Math.round(value / step) * step
  // accumulating IEEE-754 binary drift), not the clean 20.2.
  expect(el.start).to.equal(20.2);
});

it("anchors the step grid at `min` rather than absolute 0, matching native <input type=range>", async () => {
  const el = (await fixture(
    html`<lr-time-range min="3" max="100" start="3" step="10"></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  await el.updateComplete;
  // Before the fix, clamp() snapped 13 (3 + step) to the nearest multiple of
  // 10 from zero (Math.round(13/10)*10 === 10), a +7 jump instead of the
  // expected one-step +10 move off an unaligned `min`.
  expect(el.start).to.equal(13);
});

it("preserves an intentionally empty formatter result instead of treating it as nullish", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="38" start="0" end="38"></lr-time-range>`
  )) as LyraTimeRange;
  el.valueFormatter = (_value, handle) => (handle === "start" ? "" : null);
  await el.updateComplete;

  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;
  expect(startHandle.hasAttribute("aria-valuetext")).to.be.true;
  expect(startHandle.getAttribute("aria-valuetext")).to.equal("");
  expect(endHandle.hasAttribute("aria-valuetext")).to.be.false;
});

it("ignores arrow-key input on a handle that keeps keyboard focus after disabled is set mid-interaction", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="5"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  await el.updateComplete;
  expect(el.start).to.equal(25);

  el.disabled = true;
  let inputFired = false;
  let changeFired = false;
  el.addEventListener("lr-input", () => (inputFired = true));
  el.addEventListener("lr-change", () => (changeFired = true));
  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  expect(el.start).to.equal(25);
  expect(inputFired).to.be.false;
  startHandle.dispatchEvent(
    new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true })
  );
  expect(changeFired).to.be.false;
});

it('toggles tabindex between "0" and "-1" as disabled changes, removing disabled handles from the tab order', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;
  expect(startHandle.getAttribute("tabindex")).to.equal("0");
  expect(endHandle.getAttribute("tabindex")).to.equal("0");

  el.disabled = true;
  await el.updateComplete;
  // aria-disabled alone does not remove an element from the tab order —
  // tabindex="-1" is the actual mechanism making a disabled handle
  // unfocusable.
  expect(startHandle.getAttribute("tabindex")).to.equal("-1");
  expect(endHandle.getAttribute("tabindex")).to.equal("-1");

  el.disabled = false;
  await el.updateComplete;
  expect(startHandle.getAttribute("tabindex")).to.equal("0");
  expect(endHandle.getAttribute("tabindex")).to.equal("0");
});

it("jumps to the reachable min/max with Home/End, capped by the sibling handle", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;

  // The start handle's End target is capped at the current end (80): clamp()
  // already enforces start <= end regardless of what value End aims for.
  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true })
  );
  await el.updateComplete;
  expect(el.start).to.equal(80);

  endHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Home", bubbles: true })
  );
  await el.updateComplete;
  expect(el.end).to.equal(80);
});

it("jumps to the full domain bound with Home/End when unconstrained by the sibling", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;

  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Home", bubbles: true })
  );
  await el.updateComplete;
  expect(el.start).to.equal(0);

  endHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true })
  );
  await el.updateComplete;
  expect(el.end).to.equal(100);
});

it("moves by a larger increment with PageUp/PageDown than a single ArrowUp/ArrowDown step", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="2"
    ></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;

  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "PageUp", bubbles: true })
  );
  await el.updateComplete;
  expect(el.start).to.equal(40);

  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "PageDown", bubbles: true })
  );
  await el.updateComplete;
  expect(el.start).to.equal(20);
});

it("commits lr-change on keyup of Home/End/PageUp/PageDown, mirroring arrow-key commit", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  let changeDetail: { start: number; end: number } | undefined;
  el.addEventListener(
    "lr-change",
    (e) => (changeDetail = (e as CustomEvent).detail)
  );
  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Home", bubbles: true })
  );
  startHandle.dispatchEvent(
    new KeyboardEvent("keyup", { key: "Home", bubbles: true })
  );
  expect(changeDetail!.start).to.equal(0);
});

it("owns a frozen sequence of the caller's preset entries and renders them as assigned", async () => {
  const source = [{ label: "Initial", start: 1, end: 2 }];
  const el = (await fixture(
    html`<lr-time-range .presets=${source}></lr-time-range>`
  )) as LyraTimeRange;
  source[0]!.label = "Forged";
  source.push({ label: "Injected", start: 3, end: 4 });
  el.requestUpdate();
  await el.updateComplete;
  expect(el.presets.length).to.equal(1);
  expect(el.presets[0] === source[0]).to.equal(true);
  expect(Object.isFrozen(el.presets)).to.equal(true);
  const buttons = el.shadowRoot!.querySelectorAll('[part="preset-button"]');
  expect([buttons.length, buttons[0]!.textContent!.trim()]).to.deep.equal([1, "Initial"]);
});

it("reports the caller's own preset object, id included, as appliedPreset", async () => {
  const source: TimeRangePreset[] = [
    { label: 'Tagged', start: 1, end: 2, id: 'tagged-preset' },
    { label: 'Untagged', start: 3, end: 4 },
  ];
  const el = (await fixture(
    html`<lr-time-range .presets=${source}></lr-time-range>`
  )) as LyraTimeRange;
  el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="preset-button"]')[0]!.click();
  expect(el.appliedPreset === source[0]).to.equal(true);
  expect(el.presets[1] === source[1]).to.equal(true);
});

it('drops malformed preset rows while keeping the well-formed ones, in their original relative order', async () => {
  const malformed: unknown[] = [
    { label: "Good one", start: 0, end: 10 },
    null,
    "not an object",
    { label: 42, start: 0, end: 10 },
    { label: "Missing end", start: 0 },
    { label: "Another good one", start: 20, end: 30 },
  ];
  const el = (await fixture(
    html`<lr-time-range
      .presets=${malformed as TimeRangePreset[]}
    ></lr-time-range>`
  )) as LyraTimeRange;
  expect(el.presets).to.deep.equal([
    { label: "Good one", start: 0, end: 10 },
    { label: "Another good one", start: 20, end: 30 },
  ]);
  expect(
    el.shadowRoot!.querySelectorAll('[part="preset-button"]')
  ).to.have.lengthOf(2);
});

it('invalidates only the one preset row whose property getter throws, keeping later rows reachable', async () => {
  const hostile = {
    label: "Hostile",
    start: 0,
    get end(): number {
      throw new Error("boom");
    },
  };
  const el = (await fixture(
    html`<lr-time-range
      .presets=${[hostile, { label: "Safe", start: 5, end: 15 }]}
    ></lr-time-range>`
  )) as LyraTimeRange;
  expect(el.presets).to.deep.equal([{ label: "Safe", start: 5, end: 15 }]);
});

it('clicking a preset exposes its identity before the synchronous input and change events', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  el.presets = PRESETS;
  await el.updateComplete;
  const buttons = el.shadowRoot!.querySelectorAll<HTMLButtonElement>(
    '[part="preset-button"]'
  );

  let changeDetail: { start: number; end: number } | undefined;
  const identities: Array<TimeRangePreset | undefined> = [];
  for (const type of ['input', 'lr-input', 'change'] as const) {
    el.addEventListener(type, () => identities.push(el.appliedPreset));
  }
  el.addEventListener(
    "lr-change",
    (e) => {
      identities.push(el.appliedPreset);
      changeDetail = (e as CustomEvent).detail;
    }
  );
  buttons[1]!.click(); // 'Last 30 days' -> { start: 0, end: 30 }
  await el.updateComplete;

  expect(el.start).to.equal(0);
  expect(el.end).to.equal(30);
  expect(changeDetail).to.deep.equal({ value: { start: 0, end: 30 }, start: 0, end: 30 });
  expect(identities).to.deep.equal([
    el.presets[1],
    el.presets[1],
    el.presets[1],
    el.presets[1],
  ]);
  expect(el.appliedPreset, 'identity remains readable after the event pair').to.equal(
    el.presets[1],
  );
});

it('reports the caller-supplied id of the preset that produced the value', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
  )) as LyraTimeRange;
  el.presets = [
    { label: 'Last 7 days', start: 0, end: 7, id: 'last-7-days' },
    { label: 'Last 30 days', start: 0, end: 30, id: 'last-30-days' },
  ];
  await el.updateComplete;
  const buttons = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="preset-button"]');

  buttons[1]!.click();
  await el.updateComplete;

  expect(el.appliedPreset?.id).to.equal('last-30-days');
});

it('preserves preset identity when the exposed preset snapshot is reassigned unchanged', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
  )) as LyraTimeRange;
  el.presets = [{ label: 'Working window', start: 20, end: 80 }];
  await el.updateComplete;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="preset-button"]')!.click();
  await el.updateComplete;
  const currentPresets = el.presets;
  const selected = el.appliedPreset;

  el.presets = currentPresets;
  await el.updateComplete;

  expect(el.presets, 'reassigning the owned snapshot is a no-op').to.equal(currentPresets);
  expect(el.appliedPreset).to.equal(selected);
  expect(el.appliedPreset).to.equal(currentPresets[0]);
  expect(
    el.shadowRoot!.querySelector('[part="preset-button"]')!.getAttribute('aria-pressed'),
  ).to.equal('true');
});

it('clears preset identity when presets is replaced by an equal-value collection', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
  )) as LyraTimeRange;
  el.presets = [{ label: 'Working window', start: 20, end: 80 }];
  await el.updateComplete;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="preset-button"]')!.click();
  await el.updateComplete;
  const previousPresets = el.presets;

  el.presets = [{ label: 'Working window', start: 20, end: 80 }];
  await el.updateComplete;

  expect(el.presets).to.not.equal(previousPresets);
  expect(el.appliedPreset, 'a replaced collection has no selected object identity').to.equal(
    undefined,
  );
  expect(
    el.shadowRoot!.querySelector('[part="preset-button"]')!.getAttribute('aria-pressed'),
  ).to.equal('false');
});

it('does not infer preset identity from equal values and marks only the clicked identity active', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="0" end="30"></lr-time-range>`
  )) as LyraTimeRange;
  el.presets = PRESETS;
  await el.updateComplete;
  const buttons = el.shadowRoot!.querySelectorAll<HTMLButtonElement>(
    '[part="preset-button"]'
  );

  expect(buttons[0]!.getAttribute("aria-pressed")).to.equal("false");
  expect(buttons[0]!.hasAttribute("data-active")).to.be.false;
  expect(buttons[1]!.getAttribute('aria-pressed')).to.equal('false');
  expect(buttons[1]!.hasAttribute('data-active')).to.be.false;
  expect(buttons[2]!.getAttribute("aria-pressed")).to.equal("false");
  expect(buttons[2]!.hasAttribute("data-active")).to.be.false;
  expect(el.appliedPreset).to.equal(undefined);

  const events: string[] = [];
  el.addEventListener('lr-input', () => events.push('input'));
  el.addEventListener('lr-change', () => events.push('change'));
  buttons[1]!.click();
  await el.updateComplete;
  expect(events, 'selecting an equal-value preset remains event-silent').to.deep.equal([]);
  expect(el.appliedPreset).to.equal(el.presets[1]);
  expect(buttons[1]!.getAttribute('aria-pressed')).to.equal('true');
  expect(buttons[1]!.hasAttribute('data-active')).to.be.true;

  // Clicking a different preset moves the "active" affordance accordingly.
  buttons[2]!.click();
  await el.updateComplete;
  expect(buttons[0]!.getAttribute("aria-pressed")).to.equal("false");
  expect(buttons[1]!.getAttribute("aria-pressed")).to.equal("false");
  expect(buttons[2]!.getAttribute("aria-pressed")).to.equal("true");
  expect(buttons[2]!.hasAttribute("data-active")).to.be.true;
});

it('clears preset identity before a manual drag event and never re-infers it from values', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80" step="1"></lr-time-range>`,
  )) as LyraTimeRange;
  el.presets = [{ label: 'Working window', start: 20, end: 80 }];
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="preset-button"]')!;
  button.click();
  await el.updateComplete;
  expect(el.appliedPreset).to.equal(el.presets[0]);

  let identityInsideInput: TimeRangePreset | undefined = el.appliedPreset;
  el.addEventListener('input', () => {
    identityInsideInput = el.appliedPreset;
  });
  beginChangedStartDrag(el, 104);

  expect(identityInsideInput, 'manual identity clears before the input notification').to.equal(
    undefined,
  );
  expect(el.appliedPreset).to.equal(undefined);

  window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 104, clientX: 40 }));
  window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 104 }));
  await el.updateComplete;
  expect(el.start, 'the drag returned to the preset numeric range').to.equal(20);
  expect(el.end).to.equal(80);
  expect(el.appliedPreset, 'equal values do not recreate historical identity').to.equal(undefined);
  expect(button.getAttribute('aria-pressed')).to.equal('false');
});

it('clears identity after an actual controlled value change but preserves it for no-op writes', async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`,
  )) as LyraTimeRange;
  el.presets = [{ label: 'Working window', start: 20, end: 80 }];
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="preset-button"]')!;
  button.click();
  await el.updateComplete;

  el.start = 20;
  el.end = 80;
  await el.updateComplete;
  expect(el.appliedPreset, 'recommitting the current values is not a new range').to.equal(
    el.presets[0],
  );

  el.start = 25;
  await el.updateComplete;
  expect(el.appliedPreset).to.equal(undefined);
  expect(button.getAttribute('aria-pressed')).to.equal('false');

  el.start = 20;
  await el.updateComplete;
  expect(el.appliedPreset, 'returning to equal values does not infer a preset').to.equal(undefined);
});

it('projects a clicked clamped and reversed preset through normalization before exposing identity', async () => {
  const el = (await fixture(
    html`<lr-time-range min="10" max="90" start="10" end="90"></lr-time-range>`
  )) as LyraTimeRange;
  el.presets = [{ label: "Everything", start: 120, end: -5 }];
  await el.updateComplete;

  const button = el.shadowRoot!.querySelector<HTMLButtonElement>(
    '[part="preset-button"]'
  )!;
  expect(button.getAttribute('aria-pressed')).to.equal('false');
  expect(button.hasAttribute('data-active')).to.be.false;

  const events: string[] = [];
  el.addEventListener("lr-input", () => events.push("input"));
  el.addEventListener("lr-change", () => events.push("change"));
  button.click();
  await el.updateComplete;
  expect(el.start).to.equal(10);
  expect(el.end).to.equal(90);
  expect(el.appliedPreset).to.equal(el.presets[0]);
  expect(button.getAttribute('aria-pressed')).to.equal('true');
  expect(button.hasAttribute('data-active')).to.be.true;
  expect(
    events,
    "an already-active normalized preset is event-silent"
  ).to.deep.equal([]);
});

it("handles a preset that shifts the whole range past the previous end (clamp() cross-reference must not clip it)", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="0" end="10"></lr-time-range>`
  )) as LyraTimeRange;
  el.presets = [{ label: "Far future", start: 60, end: 90 }];
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>(
    '[part="preset-button"]'
  )!;
  button.click();
  await el.updateComplete;
  expect(el.start).to.equal(60);
  expect(el.end).to.equal(90);
});

it("emits exactly one lr-input event from a preset click, already holding the final values", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  el.presets = [{ label: "Far future", start: 60, end: 90 }];
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>(
    '[part="preset-button"]'
  )!;

  const inputDetails: Array<{ start: number; end: number }> = [];
  el.addEventListener("lr-input", (e) =>
    inputDetails.push((e as CustomEvent).detail)
  );
  button.click();

  // Before the fix, applyPreset() routed both handles through setValue()
  // sequentially, so this fired twice: once with the *stale* pre-preset end
  // (80) while start had already moved but end hadn't yet, and only the
  // second carried the true final values -- a caller reacting to the first
  // lr-input would have observed an inconsistent, never-actually-rendered
  // intermediate state.
  expect(inputDetails.length).to.equal(1);
  expect(inputDetails[0]).to.deep.equal({ value: { start: 60, end: 90 }, start: 60, end: 90 });
});

it("lands exactly on preset values that are not aligned to a coarse step, and still shows data-active", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="10"
    ></lr-time-range>`
  )) as LyraTimeRange;
  el.presets = [{ label: "Odd preset", start: 3, end: 47 }];
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>(
    '[part="preset-button"]'
  )!;
  button.click();
  await el.updateComplete;

  // Before the fix, routing preset.start/preset.end through setValue()'s
  // clamp() snapped them to the nearest multiple of `step` from `min` (0 and
  // 50), silently overriding the caller's exact preset numbers and leaving
  // the button's aria-pressed/data-active match permanently false.
  expect(el.start).to.equal(3);
  expect(el.end).to.equal(47);
  expect(button.getAttribute("aria-pressed")).to.equal("true");
  expect(button.hasAttribute("data-active")).to.be.true;
});

it("still supports brush dragging via handle-start/handle-end while presets is set (both interaction modes coexist)", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      step="1"
    ></lr-time-range>`
  )) as LyraTimeRange;
  el.presets = PRESETS;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  stubTimeRangePointerGeometry(base, startHandle);

  let inputDetail: { start: number; end: number } | undefined;
  el.addEventListener(
    "lr-input",
    (e) => (inputDetail = (e as CustomEvent).detail)
  );
  startHandle.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      clientX: 40,
    })
  );
  window.dispatchEvent(
    new PointerEvent("pointermove", { pointerId: 1, clientX: 100 })
  );
  expect(inputDetail!.start).to.equal(50);

  let changeDetail: { start: number; end: number } | undefined;
  el.addEventListener(
    "lr-change",
    (e) => (changeDetail = (e as CustomEvent).detail)
  );
  window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
  expect(changeDetail!.start).to.equal(50);

  // Keyboard interaction on the same handle also still works unmodified.
  const endHandle = el.shadowRoot!.querySelector(
    '[part="handle-end"]'
  ) as HTMLElement;
  endHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
  );
  await el.updateComplete;
  expect(el.end).to.equal(79);
});

it("does not let a disabled preset button be clicked", async () => {
  const el = (await fixture(
    html`<lr-time-range
      min="0"
      max="100"
      start="20"
      end="80"
      disabled
    ></lr-time-range>`
  )) as LyraTimeRange;
  el.presets = PRESETS;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLButtonElement>(
    '[part="preset-button"]'
  )!;
  expect(button.disabled).to.be.true;
  button.click();
  await el.updateComplete;
  expect(el.start).to.equal(20);
  expect(el.end).to.equal(80);
});

it("stays silent when keyboard normalization or a repeated preset leaves the effective range unchanged", async () => {
  const el = (await fixture(html`
    <lr-time-range min="0" max="10" start="0" end="10" step="1"></lr-time-range>
  `)) as LyraTimeRange;
  el.presets = [{ label: "All", start: 0, end: 10 }];
  await el.updateComplete;
  const events: string[] = [];
  el.addEventListener("lr-input", () => events.push("input"));
  el.addEventListener("lr-change", () => events.push("change"));

  const start = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  start.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })
  );
  start.dispatchEvent(
    new KeyboardEvent("keyup", { key: "ArrowLeft", bubbles: true })
  );
  (
    el.shadowRoot!.querySelector('[part="preset-button"]') as HTMLButtonElement
  ).click();

  expect(events).to.deep.equal([]);
});

it("keeps near-overflow domains and tiny steps finite during keyboard interaction", async () => {
  const el = (await fixture(
    html`<lr-time-range></lr-time-range>`
  )) as LyraTimeRange;
  el.min = -Number.MAX_VALUE;
  el.max = Number.MAX_VALUE;
  el.start = 0;
  el.end = Number.MAX_VALUE;
  el.step = Number.MIN_VALUE;
  await el.updateComplete;
  const start = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  start.dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
  );
  await el.updateComplete;

  expect(Number.isFinite(el.start)).to.be.true;
  expect(Number.isFinite(el.end)).to.be.true;
  expect(start.getAttribute("style")).to.not.contain("NaN");
  expect(start.getAttribute("style")).to.not.contain("Infinity");
});

it('keeps a step-rounded value finite by falling back to the raw candidate when candidate*factor itself overflows', async () => {
  const el = (await fixture(
    html`<lr-time-range></lr-time-range>`
  )) as LyraTimeRange;
  el.min = 0;
  el.max = Number.MAX_VALUE;
  el.start = 0;
  el.end = 9e307;
  el.step = 0.7;
  await el.updateComplete;
  const startHandle = el.shadowRoot!.querySelector(
    '[part="handle-start"]'
  ) as HTMLElement;
  // End jumps start straight to the sibling's value (9e307). Rounding that to step's own decimal
  // precision needs `candidate * factor` (factor=10 for a one-decimal-place step), which itself
  // overflows to Infinity at this magnitude -- clamp() must fall back to the raw, unrounded
  // candidate instead of letting that intermediate overflow poison the result.
  startHandle.dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true })
  );
  await el.updateComplete;
  expect(Number.isFinite(el.start)).to.be.true;
  expect(el.start).to.equal(9e307);
});

it("keeps endpoint hit geometry inside a 320px allocation", async () => {
  const el = (await fixture(html`
    <lr-time-range
      style="inline-size:320px"
      start="0"
      end="100"
    ></lr-time-range>
  `)) as LyraTimeRange;
  expect(el.scrollWidth).to.be.at.most(320);
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.scrollWidth).to.be.at.most(base.clientWidth);
});

describe("click-to-seek on the track", () => {
  /** Pins `[part="base"]` to a 200px-wide box at x=0 and neutralizes pointer capture, exactly as
   *  the drag tests above do, so a pointerdown's clientX maps to a known ratio. */
  function pinTrack(el: LyraTimeRange): HTMLElement {
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const handles = ["handle-start", "handle-end"].map(
      (part) => el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement
    );
    stubTimeRangePointerGeometry(base, ...handles);
    return base;
  }

  const seek = (el: LyraTimeRange, clientX: number, pointerId = 1) => {
    pinTrack(el);
    const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
    track.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        composed: true,
        pointerId,
        clientX,
      })
    );
  };

  it("jumps the nearer handle to a click on the track and keeps the gesture draggable", async () => {
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="40"
        end="60"
        step="1"
      ></lr-time-range>`
    )) as LyraTimeRange;
    seek(el, 20); // 10% of a 200px track -> value 10, far nearer `start` (40) than `end` (60)
    expect(el.start).to.equal(10);
    expect(el.end).to.equal(60);
    // The same pointer id continues as a real drag, exactly as if the handle had been grabbed.
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 1, clientX: 60 })
    );
    expect(el.start).to.equal(30);
  });

  it('breaks a tie between equidistant handles toward the handle that can actually travel toward the click', async () => {
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="30"
        end="70"
        step="1"
      ></lr-time-range>`
    )) as LyraTimeRange;
    // value 50 is exactly as far from start (30) as from end (70).
    seek(el, 100);
    expect(el.end, "the tie goes to end since 50 is not less than start").to.equal(
      50
    );
    expect(el.start).to.equal(30);
  });

  it("picks the end handle when the click lands nearer to it", async () => {
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="40"
        end="60"
        step="1"
      ></lr-time-range>`
    )) as LyraTimeRange;
    seek(el, 180); // value 90
    expect(el.end).to.equal(90);
    expect(el.start).to.equal(40);
  });

  it("breaks a tied nearest-handle distance toward the end handle, matching lr-slider's tie rule", async () => {
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="50"
        end="50"
        step="1"
      ></lr-time-range>`
    )) as LyraTimeRange;
    // Both handles rest on the same value (50), and the click lands exactly there too, so the
    // distance to each handle is tied (0). The tie-break picks 'end' whenever the target is not
    // strictly less than 'start' -- see nearestHandle()'s own doc comment.
    seek(el, 100); // 50% of a 200px track -> value 50
    const active = el.shadowRoot!.activeElement as HTMLElement | null;
    expect(active?.getAttribute("part")).to.equal("handle-end");
  });

  it('breaks a tied nearest-handle distance toward the start handle when the click lands to its left', async () => {
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="50"
        end="50"
        step="1"
      ></lr-time-range>`
    )) as LyraTimeRange;
    // Same co-located tie as the "toward the end handle" test above, but the click this time lands
    // strictly LEFT of the shared value -- the other arm of nearestHandle()'s `target < start ?
    // 'start' : 'end'` tie-break ternary, which the "target === start" case above cannot reach
    // since a tied target that is not strictly less than start always falls through to 'end'.
    seek(el, 60); // 30% of a 200px track -> value 30, tied between the two co-located handles
    const active = el.shadowRoot!.activeElement as HTMLElement | null;
    expect(active?.getAttribute("part")).to.equal("handle-start");
    expect(el.start).to.equal(30);
    expect(el.end).to.equal(50);
  });

  it("moves focus to the handle it jumped, so arrow keys continue the same gesture", async () => {
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="40"
        end="60"
        step="1"
      ></lr-time-range>`
    )) as LyraTimeRange;
    seek(el, 20);
    const startHandle = el.shadowRoot!.querySelector(
      '[part="handle-start"]'
    ) as HTMLElement;
    expect(el.shadowRoot!.activeElement === startHandle).to.equal(true);
    startHandle.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })
    );
    expect(el.start).to.equal(11);
  });

  it("emits lr-input during the seek and one lr-change when the pointer is released", async () => {
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="40"
        end="60"
        step="1"
      ></lr-time-range>`
    )) as LyraTimeRange;
    let inputs = 0;
    let changes = 0;
    el.addEventListener("lr-input", () => inputs++);
    el.addEventListener("lr-change", () => changes++);
    seek(el, 20);
    expect(inputs).to.equal(1);
    expect(changes).to.equal(0);
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    expect(changes).to.equal(1);
  });

  it('mirrors the seek ratio under dir="rtl"', async () => {
    const el = (await fixture(
      html`<lr-time-range
        dir="rtl"
        min="0"
        max="100"
        start="40"
        end="60"
        step="1"
      ></lr-time-range>`
    )) as LyraTimeRange;
    // Physical x=180 on a 200px track under RTL: raw 0.9 mirrors to ratio 0.1 -> value 10.
    seek(el, 180);
    expect(el.start).to.equal(10);
    expect(el.end).to.equal(60);
  });

  it("ignores a track click while disabled", async () => {
    const el = (await fixture(
      html`<lr-time-range
        disabled
        min="0"
        max="100"
        start="40"
        end="60"
        step="1"
      ></lr-time-range>`
    )) as LyraTimeRange;
    seek(el, 20);
    expect(el.start).to.equal(40);
    expect(el.end).to.equal(60);
  });

  it('ignores a track click when the track has collapsed to zero width', async () => {
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="40"
        end="60"
        step="1"
      ></lr-time-range>`
    )) as LyraTimeRange;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const track = el.shadowRoot!.querySelector(
      '[part="track"]'
    ) as HTMLElement;
    stubZeroWidthTrack(base);
    track.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        composed: true,
        pointerId: 1,
        clientX: 20,
      })
    );
    expect(el.start).to.equal(40);
    expect(el.end).to.equal(60);
  });

  it("does not mark the gesture changed when a track click lands exactly on the nearer handle's current value", async () => {
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="40"
        end="60"
        step="1"
      ></lr-time-range>`
    )) as LyraTimeRange;
    let inputs = 0;
    let changes = 0;
    el.addEventListener("lr-input", () => inputs++);
    el.addEventListener("lr-change", () => changes++);
    seek(el, 80); // 40% of a 200px track -> value 40, exactly the current start
    expect(el.start).to.equal(40);
    expect(
      inputs,
      "setValue() returned false, so no move was recorded"
    ).to.equal(0);
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    expect(
      changes,
      "an unchanged gesture commits nothing on release"
    ).to.equal(0);
  });

  it("unset-regression: a pointerdown that starts on a handle is still a plain handle drag", async () => {
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="40"
        end="60"
        step="1"
      ></lr-time-range>`
    )) as LyraTimeRange;
    const base = pinTrack(el);
    const endHandle = el.shadowRoot!.querySelector(
      '[part="handle-end"]'
    ) as HTMLElement;
    let inputs = 0;
    el.addEventListener("lr-input", () => inputs++);
    // clientX=20 is nowhere near `end`; if the base handler also ran it would drag `start` (or
    // snap `end` to 10) instead of leaving both handles put until the pointer actually moves.
    endHandle.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        composed: true,
        pointerId: 3,
        clientX: 20,
      })
    );
    expect(el.start).to.equal(40);
    expect(el.end).to.equal(60);
    expect(inputs).to.equal(0);
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 3, clientX: 140 })
    );
    expect(el.end).to.equal(70);
    expect(base.getBoundingClientRect().width).to.equal(200);
  });

  it('refuses a track click that would start a second drag from a different window while one is already active', async () => {
    const el = (await fixture(
      html`<lr-time-range
        min="0"
        max="100"
        start="40"
        end="60"
        step="1"
      ></lr-time-range>`
    )) as LyraTimeRange;
    const base = pinTrack(el);
    const startHandle = el.shadowRoot!.querySelector(
      '[part="handle-start"]'
    ) as HTMLElement;

    // A first drag begins normally, from the real window -- beginDrag() records `this.dragWindow`
    // from it.
    startHandle.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, clientX: 40 })
    );

    // beginDrag()'s cross-window guard (`!firstDrag && this.dragWindow !== dragWindow`) exists to
    // refuse a second concurrent drag arriving from a different window than the one already
    // tracked. In real usage that can only happen after an iframe adoption, but adoptedCallback()
    // itself always clears `this.drags` first (see its own doc comment) -- so with a real adoption
    // `firstDrag` is back to `true` by the time any new pointerdown arrives, and the guard never
    // actually engages. Forcing `[part="base"]`'s reported owner window to differ, without an actual
    // adoption in between, is the only way to exercise this belt-and-suspenders check directly.
    const fakeWindow = {} as unknown as Window;
    Object.defineProperty(base, "ownerDocument", {
      configurable: true,
      get: () => ({ defaultView: fakeWindow }),
    });

    let inputs = 0;
    el.addEventListener("lr-input", () => inputs++);
    const track = el.shadowRoot!.querySelector('[part="track"]') as HTMLElement;
    track.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        composed: true,
        pointerId: 2,
        clientX: 100,
      })
    );

    // onBasePointerDown's own `if (!drag) return;` must refuse the click just as beginDrag() does
    // internally -- neither handle moves and nothing is emitted for the rejected second pointer.
    expect(el.start).to.equal(40);
    expect(el.end).to.equal(60);
    expect(inputs).to.equal(0);

    // The first (real-window) drag is completely unaffected by the refused second one.
    window.dispatchEvent(
      new PointerEvent("pointermove", { pointerId: 1, clientX: 100 })
    );
    expect(el.start).to.equal(50);
    window.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
  });
});

it("relays host focus and blur once per entry and exit, not when focus moves between the handles", async () => {
  const el = (await fixture(
    html`<lr-time-range min="0" max="100" start="20" end="80"></lr-time-range>`
  )) as LyraTimeRange;
  const handle = (part: string) => el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement;
  const seen: string[] = [];
  el.addEventListener("focus", () => seen.push("focus"));
  el.addEventListener("blur", () => seen.push("blur"));
  handle("handle-start").focus();
  handle("handle-end").focus();
  handle("handle-start").focus();
  expect(seen.join(",")).to.equal("focus");
  handle("handle-start").blur();
  expect(seen.join(",")).to.equal("focus,blur");
});
