import { fixture, expect, oneEvent, html, waitUntil, aTimeout } from '@open-wc/testing';
import './select.js';
import '../combobox/option.js';
import type { LyraSelect } from './select.js';
import type { LyraOption } from '../combobox/option.js';


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

it("emits a cancelable lr-show/lr-hide pair and non-cancelable after-events", async () => {
  const el = (await fixture(html`
    <lr-select style="--lr-transition-fast: 1ms linear">
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  const events: CustomEvent[] = [];
  for (const type of ["lr-show", "lr-after-show", "lr-hide", "lr-after-hide"]) {
    el.addEventListener(type, (event) => events.push(event as CustomEvent));
  }

  const afterShow = oneEvent(el, 'lr-after-show');
  el.open = true;
  await afterShow;
  const afterHide = oneEvent(el, 'lr-after-hide');
  el.open = false;
  await afterHide;

  expect(events.map((event) => event.type)).to.deep.equal([
    "lr-show",
    "lr-after-show",
    "lr-hide",
    "lr-after-hide",
  ]);
  expect(events.every((event) => event.target === el)).to.be.true;
  // `lr-show`/`lr-hide` are veto points library-wide; the settled after-events are pure
  // notifications and stay non-cancelable.
  expect(
    events
      .filter((event) => event.type.startsWith("lr-after"))
      .every((event) => !event.cancelable)
  ).to.be.true;
  expect(
    events
      .filter((event) => !event.type.startsWith("lr-after"))
      .every((event) => event.cancelable)
  ).to.be.true;
});


it("honours preventDefault() on lr-show, leaving the property and attribute closed", async () => {
  const el = (await fixture(html`
    <lr-select><lr-option value="a">Apple</lr-option></lr-select>
  `)) as LyraSelect;
  el.addEventListener("lr-show", (event) => event.preventDefault());
  let afterShows = 0;
  el.addEventListener("lr-after-show", () => {
    afterShows += 1;
  });

  await el.show();
  await el.updateComplete;
  await aTimeout(60);

  expect(el.open, "a vetoed open never applies").to.be.false;
  expect(
    el.hasAttribute("open"),
    "the reflected attribute agrees with the property"
  ).to.be.false;
  expect(
    afterShows,
    "a transition that never happened has no after-event"
  ).to.equal(0);
  expect(
    el
      .shadowRoot!.querySelector('[part="trigger"]')!
      .getAttribute("aria-expanded")
  ).to.equal("false");
});


it("honours preventDefault() on lr-hide, including a direct `open` assignment", async () => {
  const el = (await fixture(html`
    <lr-select><lr-option value="a">Apple</lr-option></lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  await aTimeout(60);
  expect(el.open).to.be.true;

  el.addEventListener("lr-hide", (event) => event.preventDefault());
  el.open = false;
  await el.updateComplete;
  await aTimeout(60);

  expect(el.open, "a vetoed close stays open").to.be.true;
  expect(el.hasAttribute("open")).to.be.true;
});


it("preserves the active option when lr-hide is vetoed so Enter still selects it", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const button = trigger(el);
  el.open = true;
  await el.updateComplete;
  button.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  button.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(
    el
      .shadowRoot!.querySelector('[part="option"][data-active]')
      ?.textContent?.trim()
  ).to.equal("Banana");

  el.addEventListener("lr-hide", (event) => event.preventDefault());
  await el.hide();
  await el.updateComplete;

  const active = el.shadowRoot!.querySelector<HTMLElement>(
    '[part="option"][data-active]'
  );
  expect(el.open, "a vetoed close stays open").to.be.true;
  expect(active?.textContent?.trim()).to.equal("Banana");
  expect(button.getAttribute("aria-activedescendant")).to.equal(active?.id);

  const changed = oneEvent(el, "change");
  button.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    })
  );
  await changed;
  expect(el.value).to.equal("b");
});


it("resolves show()/hide() promises even when the transition is vetoed", async () => {
  const el = (await fixture(html`
    <lr-select><lr-option value="a">Apple</lr-option></lr-select>
  `)) as LyraSelect;
  el.addEventListener("lr-show", (event) => event.preventDefault());
  // A veto must not strand the caller: the promise settles, it just settles on "nothing changed".
  await el.show();
  expect(el.open).to.be.false;
});


it("drops a stale lr-after-show when closing interrupts the opening transition", async () => {
  const el = (await fixture(html`
    <lr-select style="--lr-transition-fast: 40ms linear">
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  const events: string[] = [];
  for (const type of ["lr-show", "lr-after-show", "lr-hide", "lr-after-hide"]) {
    el.addEventListener(type, () => events.push(type));
  }

  el.open = true;
  await el.updateComplete;
  el.open = false;
  await el.updateComplete;
  // Poll for the terminal event rather than waiting a fixed interval. The fixture pins a 40ms
  // transition and this used to wait a flat 100ms, which is ample on an idle machine and not ample
  // on a CI runner sharing a box with seven other shards -- it failed exactly there, on WebKit,
  // with lr-after-hide simply not yet dispatched. The settle below is then a "nothing further
  // arrived" wait for the negative half of the assertion, which no longer races the transition
  // itself because the transition has demonstrably already finished.
  await waitUntil(
    () => events.includes("lr-after-hide"),
    "lr-after-hide never fired after the interrupted transition",
    { timeout: 5000 },
  );
  await aTimeout(50);

  expect(events).to.deep.equal(["lr-show", "lr-hide", "lr-after-hide"]);
});


it("drops a settleTransition() call that is already stale before its first await settles", async () => {
  const el = (await fixture(html`
    <lr-select><lr-option value="a">Apple</lr-option></lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  let afterShows = 0;
  el.addEventListener("lr-after-show", () => {
    afterShows += 1;
  });

  const settleTransition = (
    el as unknown as {
      settleTransition(event: "lr-after-show" | "lr-after-hide"): Promise<void>;
    }
  ).settleTransition.bind(el);
  const pending = settleTransition("lr-after-show");
  // Bump the token synchronously, before settleTransition's own internal
  // `await this.updateComplete` has a chance to resolve -- guaranteeing it finds itself stale the
  // instant that first await settles, rather than racing a real transition to land the same
  // outcome.
  (el as unknown as { transitionToken: number }).transitionToken++;
  await pending;

  expect(
    afterShows,
    "a call invalidated before its first await never reaches the emit"
  ).to.equal(0);
});


it("tolerates a listbox that reports no animations at all (defensive fallback)", async () => {
  const el = (await fixture(html`
    <lr-select><lr-option value="a">Apple</lr-option></lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  const events: string[] = [];
  el.addEventListener("lr-after-show", () => events.push("after-show"));
  const listbox = el.shadowRoot!.querySelector(
    '[part="listbox"]'
  ) as HTMLElement;
  const original = listbox.getAnimations;
  listbox.getAnimations = (() =>
    undefined) as unknown as typeof listbox.getAnimations;
  try {
    await el.show();
  } finally {
    listbox.getAnimations = original;
  }
  expect(
    events,
    "a getAnimations() call that returns nothing falls back to no animations to await"
  ).to.deep.equal(["after-show"]);
});

function trigger(el: LyraSelect): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
}

function rows(el: LyraSelect): NodeListOf<HTMLElement> {
  return el.shadowRoot!.querySelectorAll('[part="option"]');
}


it("opens the listbox by clicking the trigger, and closes it by clicking again", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  expect(el.open).to.be.false;

  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.true;

  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.false;
});


it("opens the listbox with ArrowDown when closed", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  trigger(el).dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(el.open).to.be.true;
});


it("opens the listbox with ArrowUp when closed", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  trigger(el).dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(el.open).to.be.true;
});


it("selects an option by clicking it and emits change + input", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.open = true;
  await el.updateComplete;

  setTimeout(() => requiredItem(rows(el), 1, 'second option row').click());
  await oneEvent(el, "change");
  expect(el.value).to.equal("b");
  expect(el.open).to.be.false;
});


it("emits input alongside change on selection, matching a native <select>", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.open = true;
  await el.updateComplete;

  let inputFired = false;
  el.addEventListener("input", () => (inputFired = true));
  setTimeout(() => requiredItem(rows(el), 0, 'first option row').click());
  await oneEvent(el, "change");
  expect(inputFired).to.be.true;
});


it("emits exactly one native event pair and typed aliases with the new value", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  const seen: Array<{ type: string; detail: unknown; event: Event }> = [];
  for (const type of ["input", "lr-input", "change", "lr-change"]) {
    el.addEventListener(type, (event) =>
      seen.push({
        type,
        detail: (event as CustomEvent).detail,
        event,
      })
    );
  }
  requiredItem(rows(el), 1, 'second option row').click();
  await el.updateComplete;

  expect(seen.map((s) => s.type)).to.deep.equal([
    "input",
    "lr-input",
    "change",
    "lr-change",
  ]);
  const nativeInput = requiredItem(seen, 0, 'native input event');
  const inputAlias = requiredItem(seen, 1, 'input alias event');
  const nativeChange = requiredItem(seen, 2, 'native change event');
  const changeAlias = requiredItem(seen, 3, 'change alias event');
  expect(nativeInput.detail).to.equal(0);
  expect(inputAlias.detail).to.deep.equal({ value: "b", previousValue: "", data: [undefined] });
  expect(nativeChange.detail).to.be.undefined;
  expect(changeAlias.detail).to.deep.equal({ value: "b", previousValue: "", data: [undefined] });
  expect(Object.isFrozen(inputAlias.detail)).to.equal(true);
  expect(Object.isFrozen(changeAlias.detail)).to.equal(true);
  expect(nativeInput.event instanceof InputEvent).to.be.true;
  expect(nativeChange.event.constructor === Event).to.be.true;
  expect(
    [nativeInput.event, nativeChange.event].every(
      (event) => event.target === el && event.bubbles && event.composed
    )
  ).to.be.true;
  expect(inputAlias.event instanceof CustomEvent).to.be.true;
  expect(changeAlias.event instanceof CustomEvent).to.be.true;
});


it("stays silent on native and prefixed value events for a programmatic value assignment", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  await el.updateComplete;
  let count = 0;
  for (const type of ["input", "lr-input", "change", "lr-change"]) {
    el.addEventListener(type, () => count++);
  }
  el.value = "b";
  await el.updateComplete;
  expect(el.value).to.equal("b");
  expect(count).to.equal(0);
});


it("does not refire change/input when reopening and re-clicking the already-selected row", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.value = "b";
  await el.updateComplete;

  el.open = true;
  await el.updateComplete;

  let changeFired = false;
  let inputFired = false;
  el.addEventListener("change", () => (changeFired = true));
  el.addEventListener("input", () => (inputFired = true));
  requiredItem(rows(el), 1, 'second option row').click();
  await el.updateComplete;

  expect(el.value).to.equal("b");
  expect(el.open).to.be.false;
  expect(changeFired).to.be.false;
  expect(inputFired).to.be.false;
});


it("routes duplicate-valued rows by occurrence and exposes only the activated occurrence as selected", async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="same">First occurrence</lr-option>
      <lr-option value="same">Second occurrence</lr-option>
      <lr-option value="other">Other</lr-option>
    </lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;

  rows(el)[1]!.click();
  await el.updateComplete;

  expect(el.value).to.equal("same");
  expect(trigger(el).textContent).to.contain("Second occurrence");
  expect(
    [...rows(el)].map((row) => row.getAttribute("aria-selected"))
  ).to.deep.equal(["false", "true", "false"]);
  expect(
    [...el.querySelectorAll("lr-option")].map((option) => option.selected)
  ).to.deep.equal([false, true, false]);
  expect(
    [...el.querySelectorAll("lr-option")].map((option) =>
      option.hasAttribute("selected")
    ),
    "live selection never changes declarative defaults"
  ).to.deep.equal([false, false, false]);
});


it("navigates with ArrowDown and selects the active option with Enter", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;

  // First ArrowDown (already open) moves to index 0, second to index 1.
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
  expect(el.value).to.equal("b");
});


it("rehomes an active final row to the nearest survivor when options shrink while open", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;
  for (let index = 0; index < 3; index += 1) {
    btn.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
  }
  expect(
    el
      .shadowRoot!.querySelector('[part="option"][data-active]')
      ?.textContent?.trim()
  ).to.equal("Cherry");

  const slot = el.shadowRoot!.querySelector("slot:not([name])")!;
  const changed = oneEvent(slot, "slotchange");
  el.querySelector<LyraOption>('lr-option[value="c"]')!.remove();
  await changed;
  await el.updateComplete;

  const active = el.shadowRoot!.querySelector<HTMLElement>(
    '[part="option"][data-active]'
  );
  expect(active?.textContent?.trim()).to.equal("Banana");
  expect(btn.getAttribute("aria-activedescendant")).to.equal(active?.id);
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
  expect(el.value).to.equal("b");
});


it("preserves active option identity when light-DOM options reorder while open", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;
  for (let index = 0; index < 2; index += 1) {
    btn.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
  }
  const banana = el.querySelector<LyraOption>('lr-option[value="b"]')!;
  const slot = el.shadowRoot!.querySelector("slot:not([name])")!;
  const changed = oneEvent(slot, "slotchange");
  el.append(banana);
  await changed;
  await el.updateComplete;

  const active = el.shadowRoot!.querySelector<HTMLElement>(
    '[part="option"][data-active]'
  );
  expect(active?.textContent?.trim()).to.equal("Banana");
  expect(btn.getAttribute("aria-activedescendant")).to.equal(active?.id);
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
  expect(el.value).to.equal("b");
});


it("rehomes an active option when it becomes disabled while open", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;
  for (let index = 0; index < 3; index += 1) {
    btn.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
  }
  const cherry = el.querySelector<LyraOption>('lr-option[value="c"]')!;
  cherry.disabled = true;
  await cherry.updateComplete;
  await aTimeout(0);
  await el.updateComplete;

  const active = el.shadowRoot!.querySelector<HTMLElement>(
    '[part="option"][data-active]'
  );
  expect(active?.textContent?.trim()).to.equal("Banana");
  expect(btn.getAttribute("aria-activedescendant")).to.equal(active?.id);
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
  expect(el.value).to.equal("b");
});


it("prefers the following option on an equal-distance rehome and clears the cursor when none remain", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;
  for (let index = 0; index < 2; index += 1) {
    btn.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
  }
  const [apple, banana, cherry] = [
    ...el.querySelectorAll("lr-option"),
  ] as LyraOption[];
  if (!apple || !banana || !cherry) {
    throw new Error('Expected the three basic options.');
  }

  banana.disabled = true;
  await banana.updateComplete;
  await aTimeout(0);
  await el.updateComplete;
  let active = el.shadowRoot!.querySelector<HTMLElement>(
    '[part="option"][data-active]'
  );
  expect(active?.textContent?.trim()).to.equal("Cherry");

  apple.disabled = true;
  cherry.disabled = true;
  await Promise.all([apple.updateComplete, cherry.updateComplete]);
  await aTimeout(0);
  await el.updateComplete;
  active = el.shadowRoot!.querySelector<HTMLElement>(
    '[part="option"][data-active]'
  );
  expect(active === null).to.equal(true);
  expect(trigger(el).getAttribute("aria-activedescendant")).to.equal("");
});


it("selects the active option with Space, same as Enter", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
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
        key: " ",
        bubbles: true,
        cancelable: true,
      })
    )
  );
  await oneEvent(el, "change");
  expect(el.value).to.equal("a");
});


it("closes the listbox on Escape without changing the selection", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.value = "a";
  el.open = true;
  await el.updateComplete;

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
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(el.value).to.equal("a");
});


it("jumps to (and selects) the option whose label starts with a typed character while closed", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  expect(el.open).to.be.false;

  setTimeout(() =>
    btn.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "c",
        bubbles: true,
        cancelable: true,
      })
    )
  );
  await oneEvent(el, "change");
  expect(el.value).to.equal("c");
  expect(el.open).to.be.false;
});


it("type-ahead only moves the active row (no commit) while the listbox is open", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;

  btn.dispatchEvent(
    new KeyboardEvent("keydown", { key: "b", bubbles: true, cancelable: true })
  );
  await el.updateComplete;

  expect(el.value).to.equal("");
  const active = el.shadowRoot!.querySelector('[part="option"][data-active]');
  expect(active?.textContent).to.contain("Banana");
});


it("resets the type-ahead buffer after ~500ms of inactivity", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);

  setTimeout(() =>
    btn.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "b",
        bubbles: true,
        cancelable: true,
      })
    )
  );
  await oneEvent(el, "change");
  expect(el.value).to.equal("b");

  await aTimeout(600);

  // Buffer reset -> 'c' alone (not 'bc') should now match Cherry.
  setTimeout(() =>
    btn.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "c",
        bubbles: true,
        cancelable: true,
      })
    )
  );
  await oneEvent(el, "change");
  expect(el.value).to.equal("c");
});


it("still resets its type-ahead buffer after a disconnect and reconnect", async () => {
  // The buffer reset runs on the shared DebounceController. Teardown must `cancel()` it, never
  // `dispose()` it: a disconnect here may be a re-parent (a drag-drop, a Lit re-key), and a
  // disposed controller silently refuses every later `push()` -- leaving a reconnected select
  // with a buffer that never clears, so "ba" typed a minute apart would narrow as one search.
  const el = (await fixture(basic())) as LyraSelect;
  const parent = el.parentElement!;
  const buffer = (): string =>
    (el as unknown as { typeBuffer: { text: string } }).typeBuffer.text;

  el.remove();
  parent.append(el);
  await el.updateComplete;

  trigger(el).dispatchEvent(
    new KeyboardEvent("keydown", { key: "b", bubbles: true, cancelable: true })
  );
  await el.updateComplete;
  expect(buffer(), "a reconnected select still accumulates").to.equal("b");
  await aTimeout(700);
  expect(buffer(), "and its reset still fires").to.equal("");
});


it("leaves the type-ahead buffer alone when its reset timer fires after being superseded", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  const buffer = (): string =>
    (el as unknown as { typeBuffer: { text: string } }).typeBuffer.text;
  const type = (key: string): void => {
    btn.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
    );
  };

  type("a");
  await el.updateComplete;
  expect(buffer()).to.equal("a");
  // Supersede the first reset with a real second keystroke rather than by poking a private
  // generation counter: the counter now lives inside the shared DebounceController, and the
  // contract this test exists for is the user-visible one -- the first keystroke's reset must not
  // clear a buffer the second keystroke has already taken over.
  await aTimeout(300);
  type("b");
  await el.updateComplete;
  expect(buffer(), "a second keystroke extends the buffer").to.equal("ab");
  await aTimeout(350);
  expect(
    buffer(),
    "a superseded timer must not clear a buffer it no longer owns"
  ).to.equal("ab");
  await aTimeout(400);
  expect(buffer(), "the surviving reset still fires on its own schedule").to.equal("");
});


describe("single-option combobox default (autoCommitSingleOption unset)", () => {
  const single = () => html`
    <lr-select>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `;

  it("keeps the normal combobox/listbox/chevron trigger when only one option is enabled", async () => {
    const el = (await fixture(single())) as LyraSelect;
    expect(el.autoCommitSingleOption).to.be.false;
    const btn = trigger(el);
    expect(btn.getAttribute("role")).to.equal("combobox");
    expect(btn.getAttribute("aria-haspopup")).to.equal("listbox");
    expect(btn.hasAttribute("aria-expanded")).to.be.true;
    expect(btn.hasAttribute("aria-controls")).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="expand-icon"]')).to.exist;
  });

  it("opens the listbox on click instead of committing the sole option directly", async () => {
    const el = (await fixture(single())) as LyraSelect;
    trigger(el).click();
    await el.updateComplete;
    expect(el.open).to.be.true;
    expect(el.value).to.equal("");
  });

  it("opens the listbox on ArrowDown instead of committing the sole option directly", async () => {
    const el = (await fixture(single())) as LyraSelect;
    trigger(el).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(el.open).to.be.true;
    expect(el.value).to.equal("");
  });
});


describe("single-option auto-commit (autoCommitSingleOption)", () => {
  const single = () => html`
    <lr-select auto-commit-single-option>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `;

  it("renders the trigger as a plain button with no chevron/combobox ARIA when only one option is enabled", async () => {
    const el = (await fixture(single())) as LyraSelect;
    const btn = trigger(el);
    expect(btn.getAttribute("role")).to.equal("button");
    expect(btn.hasAttribute("aria-haspopup")).to.be.false;
    expect(btn.hasAttribute("aria-expanded")).to.be.false;
    expect(btn.hasAttribute("aria-controls")).to.be.false;
    expect(btn.hasAttribute("aria-activedescendant")).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="expand-icon"]') == null).to.be
      .true;
  });

  it("commits the sole option on click without ever opening the listbox", async () => {
    const el = (await fixture(single())) as LyraSelect;
    setTimeout(() => trigger(el).click());
    await oneEvent(el, "change");
    expect(el.value).to.equal("a");
    expect(el.open).to.be.false;
  });

  it("commits the sole option on ArrowDown/ArrowUp", async () => {
    const el = (await fixture(single())) as LyraSelect;
    setTimeout(() =>
      trigger(el).dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowDown",
          bubbles: true,
          cancelable: true,
        })
      )
    );
    await oneEvent(el, "change");
    expect(el.value).to.equal("a");
    expect(el.open).to.be.false;
  });

  it("does not refire change/input on a second click once the sole option is already selected", async () => {
    const el = (await fixture(single())) as LyraSelect;
    setTimeout(() => trigger(el).click());
    await oneEvent(el, "change");
    expect(el.value).to.equal("a");

    let changeFired = false;
    let inputFired = false;
    el.addEventListener("change", () => (changeFired = true));
    el.addEventListener("input", () => (inputFired = true));
    trigger(el).click();
    await el.updateComplete;
    expect(el.value).to.equal("a");
    expect(changeFired).to.be.false;
    expect(inputFired).to.be.false;
  });

  it("still opens normally (three-row combobox chrome, no auto-commit) once a second option is enabled", async () => {
    const el = (await fixture(html`
      <lr-select>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `)) as LyraSelect;
    const btn = trigger(el);
    expect(btn.getAttribute("role")).to.equal("combobox");
    expect(el.shadowRoot!.querySelector('[part="expand-icon"]')).to.exist;

    btn.click();
    await el.updateComplete;
    expect(el.open).to.be.true;
    expect(el.value).to.equal("");
  });

  it("treats a single ENABLED option among several disabled ones as single-option too", async () => {
    const el = (await fixture(html`
      <lr-select auto-commit-single-option>
        <lr-option value="a" disabled>Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
        <lr-option value="c" disabled>Cherry</lr-option>
      </lr-select>
    `)) as LyraSelect;
    const btn = trigger(el);
    expect(btn.getAttribute("role")).to.equal("button");

    setTimeout(() => btn.click());
    await oneEvent(el, "change");
    expect(el.value).to.equal("b");
  });

  it("does not auto-select on mount -- a required, unselected single-option select stays invalid", async () => {
    const form = (await fixture(html`
      <form>
        <lr-select name="fruit" required>
          <lr-option value="a">Apple</lr-option>
        </lr-select>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-select") as LyraSelect;
    await el.updateComplete;
    expect(el.value).to.equal("");
    expect(form.reportValidity()).to.be.false;
  });

  it("does not intercept click/keyboard when disabled, even with a single option", async () => {
    const el = (await fixture(html`
      <lr-select disabled auto-commit-single-option>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    trigger(el).click();
    await el.updateComplete;
    expect(el.value).to.equal("");
  });

  it("is accessible with a single enabled option", async () => {
    const el = (await fixture(single())) as LyraSelect;
    el.label = "Fruit";
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});


describe("SingleOption / SingleEnabledAmongDisabled stories actually set auto-commit-single-option", () => {
  it("SingleOption renders the plain-button auto-commit trigger its doc comment describes", async () => {
    const { SingleOption } = await import("./select.stories.js");
    const el = (await fixture(
      SingleOption.render!({}, null as never)
    )) as LyraSelect;
    const btn = trigger(el);
    expect(el.autoCommitSingleOption).to.be.true;
    expect(btn.getAttribute("role")).to.equal("button");
    expect(el.shadowRoot!.querySelector('[part="expand-icon"]') == null).to.be
      .true;
  });

  it("SingleEnabledAmongDisabled renders the plain-button auto-commit trigger its doc comment describes", async () => {
    const { SingleEnabledAmongDisabled } = await import("./select.stories.js");
    const el = (await fixture(
      SingleEnabledAmongDisabled.render!({}, null as never)
    )) as LyraSelect;
    const btn = trigger(el);
    expect(el.autoCommitSingleOption).to.be.true;
    expect(btn.getAttribute("role")).to.equal("button");
    expect(el.shadowRoot!.querySelector('[part="expand-icon"]') == null).to.be
      .true;
  });
});


it("does not auto-commit when auto-commit-single-option is set but more than one option is enabled", async () => {
  const el = (await fixture(html`
    <lr-select auto-commit-single-option>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
    </lr-select>
  `)) as LyraSelect;
  const btn = trigger(el);
  expect(btn.getAttribute("role")).to.equal("combobox");

  btn.click();
  await el.updateComplete;
  expect(el.open).to.be.true;
  expect(el.value).to.equal("");
});


it("ignores a dispatched keydown-driven open attempt while disabled", async () => {
  const el = (await fixture(html`
    <lr-select disabled>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  trigger(el).dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(el.open).to.be.false;
});


it("ignores a dispatched click while disabled, even bypassing native click() gating", async () => {
  const el = (await fixture(html`
    <lr-select disabled>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  trigger(el).dispatchEvent(
    new MouseEvent("click", { bubbles: true, cancelable: true })
  );
  await el.updateComplete;
  expect(el.open).to.be.false;
});


it("does not select a disabled option row via a direct click, even though the row itself has no native disabled semantics", async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b" disabled>Banana</lr-option>
    </lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  const disabledRow = [...rows(el)].find((r) => r.dataset['value'] === "b")!;
  disabledRow.click();
  await el.updateComplete;
  expect(el.value).to.equal("");
  expect(el.open).to.be.true; // selection blocked, listbox stays open
});


describe("type-ahead edge cases", () => {
  it("does nothing when every option is disabled", async () => {
    const el = (await fixture(html`
      <lr-select>
        <lr-option value="a" disabled>Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    trigger(el).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "a",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(el.value).to.equal("");
    expect(el.open).to.be.false;
  });

  it("does nothing when no option label starts with the typed character", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    trigger(el).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "z",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(el.value).to.equal("");
  });
});


describe("ArrowUp keyboard handling", () => {
  it("commits the sole option on ArrowUp too, not just ArrowDown", async () => {
    const el = (await fixture(html`
      <lr-select auto-commit-single-option>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    setTimeout(() =>
      trigger(el).dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowUp",
          bubbles: true,
          cancelable: true,
        })
      )
    );
    await oneEvent(el, "change");
    expect(el.value).to.equal("a");
    expect(el.open).to.be.false;
  });

  it("navigates upward with ArrowUp when already open, decrementing the active index", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const btn = trigger(el);
    el.open = true;
    await el.updateComplete;

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
    await el.updateComplete; // active index -> 1 (Banana)

    btn.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowUp",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;

    const active = el.shadowRoot!.querySelector('[part="option"][data-active]');
    expect(active?.textContent).to.contain("Apple");
  });
});


it("closes the listbox on Enter without selecting anything when no option has been made active yet", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const btn = trigger(el);
  el.open = true;
  await el.updateComplete;

  btn.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;

  expect(el.value).to.equal("");
  expect(el.open).to.be.false;
});


describe("Home/End keyboard handling", () => {
  it("jumps to the first option with Home while open", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const btn = trigger(el);
    el.open = true;
    await el.updateComplete;
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
    await el.updateComplete; // active index -> 1 (Banana)

    btn.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Home",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;

    const active = el.shadowRoot!.querySelector('[part="option"][data-active]');
    expect(active?.textContent).to.contain("Apple");
  });

  it("jumps to the last option with End while open", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const btn = trigger(el);
    el.open = true;
    await el.updateComplete;

    btn.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "End",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;

    const active = el.shadowRoot!.querySelector('[part="option"][data-active]');
    expect(active?.textContent).to.contain("Cherry");
  });

  it("ignores Home/End while the listbox is closed", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    const btn = trigger(el);
    btn.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Home",
        bubbles: true,
        cancelable: true,
      })
    );
    btn.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "End",
        bubbles: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    expect(el.open).to.be.false;
  });
});


it("ignores a listbox click that lands outside any option row (e.g. a group-label or empty padding)", async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a" group="Fruits">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  const listbox = el.shadowRoot!.querySelector(
    '[part="listbox"]'
  ) as HTMLElement;
  const groupLabel = listbox.querySelector(".group-label") as HTMLElement;
  groupLabel.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await el.updateComplete;
  expect(el.value).to.equal("");
  expect(el.open).to.be.true;
});


describe("lr-select activation event", () => {
  const openSelect = async (
    template = html`
      <lr-select value="b">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
        <lr-option value="c">Cherry</lr-option>
      </lr-select>
    `
  ): Promise<LyraSelect> => {
    const el = await fixture<LyraSelect>(template);
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;
    await aTimeout(0);
    return el;
  };

  const row = (el: LyraSelect, value: string): HTMLElement =>
    el.shadowRoot!.querySelector<HTMLElement>(
      `[part="option"][data-value="${value}"]`
    )!;

  it("fires lr-activate without change/lr-change when the already-selected row is picked again", async () => {
    const el = await openSelect();
    const activated: string[] = [];
    let changeCount = 0;
    el.addEventListener("change", () => changeCount++);
    el.addEventListener("lr-change", () => changeCount++);
    el.addEventListener("lr-activate", (e) =>
      activated.push((e as CustomEvent<{ value: string }>).detail.value)
    );
    row(el, "b").click();
    await el.updateComplete;
    expect(activated).to.deep.equal(["b"]);
    expect(el.value).to.equal("b");
    expect(changeCount, "re-picking the current row is not a change").to.equal(0);
  });

  it("emits change and lr-change before lr-activate for a moving pick, and bubbles composed and uncancelable", async () => {
    const el = await openSelect();
    const order: string[] = [];
    const flags: Array<Record<string, boolean>> = [];
    el.addEventListener("change", () => order.push("change"));
    el.addEventListener("lr-change", () => order.push("lr-change"));
    const documentListener = (e: Event): void => {
      order.push("lr-activate");
      flags.push({
        bubbles: e.bubbles,
        cancelable: e.cancelable,
        composed: e.composed,
      });
    };
    document.addEventListener("lr-activate", documentListener);
    try {
      row(el, "c").click();
      await el.updateComplete;
    } finally {
      document.removeEventListener("lr-activate", documentListener);
    }
    expect(el.value).to.equal("c");
    expect(order).to.deep.equal(["change", "lr-change", "lr-activate"]);
    expect(flags).to.deep.equal([
      { bubbles: true, cancelable: false, composed: true },
    ]);
  });

  it("reports the toggled-off row in multiple mode, where every pick is also a change", async () => {
    const el = await openSelect(html`
      <lr-select multiple .value=${["a"]}>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    `);
    const activated: string[] = [];
    el.addEventListener("lr-activate", (e) =>
      activated.push((e as CustomEvent<{ value: string }>).detail.value)
    );
    row(el, "a").click();
    await el.updateComplete;
    expect(el.value).to.deep.equal([]);
    expect(
      activated,
      "deselecting a row is still an activation of that row"
    ).to.deep.equal(["a"]);
  });

  it("stays silent for a disabled option and for a programmatic value assignment", async () => {
    const el = await openSelect(html`
      <lr-select value="a">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b" disabled>Banana</lr-option>
      </lr-select>
    `);
    let activateCount = 0;
    el.addEventListener("lr-activate", () => activateCount++);
    row(el, "b").click();
    await el.updateComplete;
    expect(el.value, "the disabled option never selects").to.equal("a");
    expect(activateCount, "a disabled option activates nothing").to.equal(0);

    el.value = "b";
    await el.updateComplete;
    expect(el.value, "the assignment still lands").to.equal("b");
    expect(
      activateCount,
      "a host writing `value` is not a user activation"
    ).to.equal(0);
  });
});

// Cloned option adornments sit in a centred inline-flex part, so a long text clone was clipped on
// both sides. Each direct child now carries its own shrinkable block with an ellipsis.

it("opens on the committed option, active and scrolled into view, and ArrowDown continues from it", async () => {
  const el = (await fixture(html`
    <lr-select value="35">
      ${Array.from({ length: 40 }, (_, index) => html`<lr-option value=${String(index)}>Item ${index}</lr-option>`)}
    </lr-select>
  `)) as LyraSelect;
  const button = trigger(el);
  const shown = oneEvent(el, "lr-after-show");
  button.click();
  await shown;
  await el.updateComplete;
  const active = () => el.shadowRoot!.querySelector<HTMLElement>('[part="option"][data-active]');
  expect(active()?.dataset["value"]).to.equal("35");
  expect(button.getAttribute("aria-activedescendant")).to.equal(active()?.id);
  const list = el.shadowRoot!.querySelector<HTMLElement>('[part="listbox"]')!;
  await waitUntil(() => active()!.getBoundingClientRect().bottom <= list.getBoundingClientRect().bottom + 1);

  button.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(active()?.dataset["value"]).to.equal("36");

  const empty = (await fixture(basic())) as LyraSelect;
  empty.open = true;
  await empty.updateComplete;
  expect(empty.shadowRoot!.querySelector('[part="option"][data-active]') === null, "nothing committed, nothing active").to.equal(true);
});

it("mounts its option rows the first time the listbox opens", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const count = () => el.shadowRoot!.querySelectorAll('[part="option"]').length;
  expect(count(), "a closed select renders no rows").to.equal(0);
  el.open = true;
  await el.updateComplete;
  expect(count()).to.equal(3);
  el.open = false;
  await el.updateComplete;
  expect(count(), "rows stay mounted once opened").to.equal(3);
});
