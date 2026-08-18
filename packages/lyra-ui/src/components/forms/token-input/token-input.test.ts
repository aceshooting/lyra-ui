import { fixture, expect, html, oneEvent, waitUntil } from "@open-wc/testing";
import type { PropertyValues } from "lit";
import "./token-input.js";
import "../button/button.js";
import type { LyraTokenInput } from "./token-input.js";
import { styles } from "./token-input.styles.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";

const RULE = "Bash(git status:*)";

function tokenLabels(el: LyraTokenInput): HTMLElement[] {
  return Array.from(
    el.shadowRoot!.querySelectorAll('[part="token-label"]')
  ) as HTMLElement[];
}
function editor(el: LyraTokenInput): HTMLInputElement | null {
  return el.shadowRoot!.querySelector(
    '[part="token-editor"]'
  ) as HTMLInputElement | null;
}
function removeButtons(el: LyraTokenInput): HTMLButtonElement[] {
  return Array.from(
    el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="remove"]')
  );
}
function typeInto(field: HTMLInputElement, next: string): void {
  field.value = next;
  field.dispatchEvent(new Event("input", { bubbles: true }));
}
function press(target: HTMLElement, key: string): KeyboardEvent {
  // `composed: true` matches a real key event: without it nothing dispatched inside the shadow root
  // could ever reach a document listener, which would make the Escape-containment test vacuous.
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    composed: true,
  });
  target.dispatchEvent(event);
  return event;
}

it("adds and removes tokens with the keyboard", async () => {
  const el = (await fixture(
    html`<lr-token-input></lr-token-input>`
  )) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.value = "alpha";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(el.value).to.deep.equal(["alpha"]);
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Backspace",
      bubbles: true,
      cancelable: true,
    })
  );
  expect(el.value).to.deep.equal([]);
});

it('moves focus to the draft input when a focused sole-token remove button removes itself', async () => {
  const el = (await fixture(
    html`<lr-token-input .value=${['alpha']}></lr-token-input>`
  )) as LyraTokenInput;
  const remove = removeButtons(el)[0]!;
  remove.focus();
  expect(el.shadowRoot!.activeElement === remove).to.equal(true);

  remove.click();
  await el.updateComplete;

  expect(el.value).to.deep.equal([]);
  expect((el.shadowRoot!.activeElement as HTMLElement | null)?.id).to.equal(
    'input'
  );
});

it('moves focus to the nearest surviving remove action when a focused tail removes itself', async () => {
  const el = (await fixture(
    html`<lr-token-input .value=${['alpha', 'beta']}></lr-token-input>`
  )) as LyraTokenInput;
  const focused = removeButtons(el)[1]!;
  focused.focus();

  focused.click();
  await el.updateComplete;

  expect(el.value).to.deep.equal(['alpha']);
  expect(el.shadowRoot!.activeElement === removeButtons(el)[0]).to.equal(true);
});

it('retains focused-token repair through a synchronous controlled value echo', async () => {
  const el = (await fixture(
    html`<lr-token-input .value=${['alpha', 'beta']}></lr-token-input>`
  )) as LyraTokenInput;
  el.addEventListener(
    'input',
    () => {
      el.value = [...el.value];
    },
    { once: true }
  );
  const focused = removeButtons(el)[1]!;
  focused.focus();

  focused.click();
  await el.updateComplete;

  expect(el.value).to.deep.equal(['alpha']);
  expect(el.shadowRoot!.activeElement === removeButtons(el)[0]).to.equal(true);
});

it("contains composed draft events while preserving its single public event sequence", async () => {
  const parent = (await fixture(
    html`<div><lr-token-input></lr-token-input></div>`
  )) as HTMLDivElement;
  const el = parent.querySelector("lr-token-input") as LyraTokenInput;
  const input = el.shadowRoot!.querySelector("#input") as HTMLInputElement;
  let inputs = 0;
  let changes = 0;
  let focuses = 0;
  let blurs = 0;
  const inputDetails: unknown[] = [];
  parent.addEventListener("input", (event) => {
    inputs += 1;
    expect(event instanceof InputEvent).to.be.true;
  });
  parent.addEventListener("lr-input", (event) =>
    inputDetails.push((event as CustomEvent).detail)
  );
  parent.addEventListener("change", () => (changes += 1));
  parent.addEventListener("focus", () => (focuses += 1));
  parent.addEventListener("blur", () => (blurs += 1));

  input.value = "alpha";
  input.dispatchEvent(
    new InputEvent("input", { bubbles: true, composed: true })
  );
  input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  input.dispatchEvent(
    new FocusEvent("focus", { bubbles: true, composed: true })
  );
  press(input, "Enter");
  await el.updateComplete;
  input.dispatchEvent(
    new FocusEvent("blur", { bubbles: true, composed: true })
  );

  expect(el.value).to.deep.equal(["alpha"]);
  expect(inputs).to.equal(1);
  expect(inputDetails).to.deep.equal([{ value: ["alpha"] }]);
  expect(changes).to.equal(1);
  expect(focuses).to.equal(1);
  expect(blurs).to.equal(1);
});

it("contains composed inline-editor events while relaying its public focus lifecycle once", async () => {
  const parent = (await fixture(html`
    <div><lr-token-input editable .value=${["alpha"]}></lr-token-input></div>
  `)) as HTMLDivElement;
  const el = parent.querySelector("lr-token-input") as LyraTokenInput;
  tokenLabels(el)[0]!.click();
  await el.updateComplete;
  const field = editor(el)!;
  let inputs = 0;
  let changes = 0;
  let focuses = 0;
  let blurs = 0;
  const inputDetails: unknown[] = [];
  const lifecycleEvents: Event[] = [];
  parent.addEventListener("input", (event) => {
    inputs += 1;
    expect(event instanceof InputEvent).to.be.true;
  });
  parent.addEventListener("lr-input", (event) =>
    inputDetails.push((event as CustomEvent).detail)
  );
  parent.addEventListener("change", () => (changes += 1));
  parent.addEventListener("focus", (event) => {
    focuses += 1;
    lifecycleEvents.push(event);
  });
  parent.addEventListener("blur", (event) => {
    blurs += 1;
    lifecycleEvents.push(event);
  });

  field.value = "beta";
  field.dispatchEvent(
    new FocusEvent("focus", { bubbles: true, composed: true })
  );
  field.dispatchEvent(
    new InputEvent("input", { bubbles: true, composed: true })
  );
  field.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
  field.dispatchEvent(
    new FocusEvent("blur", { bubbles: true, composed: true })
  );
  await Promise.resolve();
  await el.updateComplete;

  expect(el.value).to.deep.equal(["beta"]);
  expect(inputs).to.equal(1);
  expect(inputDetails).to.deep.equal([{ value: ["beta"] }]);
  expect(changes).to.equal(1);
  expect(focuses).to.equal(1);
  expect(blurs).to.equal(1);
  expect(
    lifecycleEvents.every((event) => event instanceof FocusEvent)
  ).to.equal(true);
  expect(lifecycleEvents.every((event) => event.target === el)).to.equal(true);
  expect(
    lifecycleEvents.every((event) => event.bubbles && event.composed)
  ).to.equal(true);
});

it("relays an inline-editor focus and blur once through the host", async () => {
  const parent = (await fixture(html`
    <div>
      <lr-token-input editable .value=${["alpha"]}></lr-token-input>
      <button type="button">Outside</button>
    </div>
  `)) as HTMLDivElement;
  const el = parent.querySelector("lr-token-input") as LyraTokenInput;
  const outside = parent.querySelector("button") as HTMLButtonElement;
  const lifecycleEvents: Event[] = [];
  parent.addEventListener("focus", (event) => lifecycleEvents.push(event));
  parent.addEventListener("blur", (event) => lifecycleEvents.push(event));

  tokenLabels(el)[0]!.click();
  await el.updateComplete;
  outside.focus();
  await Promise.resolve();
  await el.updateComplete;

  expect(lifecycleEvents.map((event) => event.type)).to.deep.equal([
    "focus",
    "blur",
  ]);
  expect(
    lifecycleEvents.every((event) => event instanceof FocusEvent)
  ).to.equal(true);
  expect(lifecycleEvents.every((event) => event.target === el)).to.equal(true);
  expect(
    lifecycleEvents.every((event) => event.bubbles && event.composed)
  ).to.equal(true);
});

it("skips a draft token that duplicates an existing one unless allowDuplicates is set", async () => {
  const el = (await fixture(
    html`<lr-token-input .value=${["alpha"]}></lr-token-input>`
  )) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector("#input") as HTMLInputElement;
  let added = 0;
  el.addEventListener("lr-add", () => added++);
  typeInto(input, "alpha");
  press(input, "Enter");
  await el.updateComplete;
  expect(
    el.value,
    "the duplicate draft must be skipped, not appended"
  ).to.deep.equal(["alpha"]);
  expect(added, "no lr-add for a skipped duplicate").to.equal(0);

  el.allowDuplicates = true;
  await el.updateComplete;
  typeInto(input, "alpha");
  press(input, "Enter");
  await el.updateComplete;
  expect(
    el.value,
    "allowDuplicates lets the same token in twice"
  ).to.deep.equal(["alpha", "alpha"]);
  expect(added).to.equal(1);
});

it("normalizes foreign array members at every public value boundary", async () => {
  const el = (await fixture(
    html`<lr-token-input name="tags"></lr-token-input>`
  )) as LyraTokenInput;
  (el as unknown as { value: unknown }).value = [null, "alpha", 42, "beta", {}];
  expect(el.value).to.deep.equal(["alpha", "beta"]);

  (el as unknown as { defaultValue: unknown }).defaultValue = ["default", null];
  el.formResetCallback();
  expect(el.value).to.deep.equal(["default"]);
});

it('normalizes a non-array value write and clears the reflected default attribute when set to null', async () => {
  const el = (await fixture(
    html`<lr-token-input value='["alpha"]'></lr-token-input>`
  )) as LyraTokenInput;
  expect(el.getAttribute('value')).to.equal('["alpha"]');

  (el as unknown as { value: unknown }).value = 'not-an-array';
  expect(
    el.value,
    'a non-array value write must normalize to an empty list'
  ).to.deep.equal([]);

  (el as unknown as { defaultValue: unknown }).defaultValue = null;
  expect(
    el.hasAttribute('value'),
    'assigning a null default must clear the reflected attribute'
  ).to.equal(false);
  expect(el.defaultValue).to.deep.equal([]);
});

it('falls back to an empty value when iterating a poisoned array throws mid-normalization', async () => {
  const el = (await fixture(
    html`<lr-token-input .value=${['alpha']}></lr-token-input>`
  )) as LyraTokenInput;
  const poisoned = new Proxy(['one', 'two'], {
    get(target, prop, receiver) {
      if (prop === '0') throw new Error('boom');
      return Reflect.get(target, prop, receiver);
    },
  });
  (el as unknown as { value: unknown }).value = poisoned;
  expect(
    el.value,
    'a throwing iterator must degrade to empty rather than propagate'
  ).to.deep.equal([]);
});

it("owns readonly value snapshots and freezes emitted collection details", async () => {
  const source = ["alpha"];
  const el = (await fixture(
    html`<lr-token-input .value=${source}></lr-token-input>`
  )) as LyraTokenInput;
  source.push("forged");
  expect(el.value).to.deep.equal(["alpha"]);
  expect(Object.isFrozen(el.value)).to.be.true;

  const input = el.shadowRoot!.querySelector("#input") as HTMLInputElement;
  const inputEvent = oneEvent(el, "lr-input") as Promise<
    CustomEvent<{ value: readonly string[] }>
  >;
  typeInto(input, "beta");
  press(input, "Enter");
  const detail = (await inputEvent).detail;
  expect(detail.value).to.deep.equal(["alpha", "beta"]);
  expect(Object.isFrozen(detail)).to.be.true;
  expect(Object.isFrozen(detail.value)).to.be.true;
  expect(() => (detail.value as string[]).push("forged")).to.throw(TypeError);
  expect(el.value).to.deep.equal(["alpha", "beta"]);
});

it("commits a delimiter batch as one value transaction and one batched add event", async () => {
  const el = (await fixture(
    html`<lr-token-input></lr-token-input>`
  )) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector("#input") as HTMLInputElement;
  let inputs = 0;
  let changes = 0;
  const additions: Array<{ value: string; values: readonly string[] }> = [];
  el.addEventListener("input", () => {
    inputs += 1;
  });
  el.addEventListener("change", () => {
    changes += 1;
  });
  el.addEventListener("lr-add", (event) => {
    additions.push(event.detail);
  });

  typeInto(input, "alpha,beta,alpha,gamma");
  press(input, "Enter");

  expect(el.value).to.deep.equal(["alpha", "beta", "gamma"]);
  expect(inputs).to.equal(1);
  expect(changes).to.equal(1);
  expect(additions).to.deep.equal([
    {
      value: "gamma",
      values: ["alpha", "beta", "gamma"],
    },
  ]);
});

it("ignores keystrokes on the draft input while disabled, leaving the draft uncommitted", async () => {
  const el = (await fixture(
    html`<lr-token-input disabled></lr-token-input>`
  )) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector("#input") as HTMLInputElement;
  typeInto(input, "alpha");
  press(input, "Enter");
  await el.updateComplete;
  expect(
    el.value,
    "a disabled control must not commit a draft on Enter"
  ).to.deep.equal([]);
});

it("discards an uncommitted draft on blur while disabled instead of adding it", async () => {
  const el = (await fixture(
    html`<lr-token-input disabled></lr-token-input>`
  )) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector("#input") as HTMLInputElement;
  typeInto(input, "alpha");
  const blurred = oneEvent(el, "blur");
  input.dispatchEvent(new Event("blur"));
  await blurred;
  await el.updateComplete;
  expect(
    el.value,
    "a disabled control must not commit a draft on blur either"
  ).to.deep.equal([]);
});

it("does not mark touched from a blur the platform forces when the control becomes disabled while focused", async () => {
  // Regression test: disabling a focused native control blurs it as
  // plain platform behavior (nothing to do with custom elements specifically) -- that blur is not a
  // real user interaction and must not flip `touched`, which could otherwise reenter an in-flight
  // Lit update and trip its dev-mode "scheduled an update after an update completed" warning.
  const el = (await fixture(
    html`<lr-token-input></lr-token-input>`
  )) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector("#input") as HTMLInputElement;
  input.focus();
  expect(
    el.shadowRoot!.activeElement === input,
    "must actually be focused before disabling it"
  ).to.be.true;
  el.disabled = true;
  await el.updateComplete;
  expect(
    (el as unknown as { touched: boolean }).touched,
    "a disable-forced blur is not user interaction"
  ).to.be.false;
});

it("still marks touched on a real user blur", async () => {
  const el = (await fixture(
    html`<lr-token-input></lr-token-input>`
  )) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector("#input") as HTMLInputElement;
  input.dispatchEvent(new Event("blur"));
  expect(
    (el as unknown as { touched: boolean }).touched,
    "a real blur must still count as interaction"
  ).to.be.true;
});

it("is form-associated and validates required values", async () => {
  const el = (await fixture(
    html`<lr-token-input required></lr-token-input>`
  )) as LyraTokenInput;
  expect(el.checkValidity()).to.be.false;
  el.value = ["ready"];
  await el.updateComplete;
  expect(el.checkValidity()).to.be.true;
});

it("exposes native form validity/focus APIs and resets transient token state with the form", async () => {
  const form = (await fixture(html`
    <form>
      <lr-token-input name="tags" required .value=${["alpha"]}></lr-token-input>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-token-input") as LyraTokenInput;
  const input = el.shadowRoot!.querySelector("#input") as HTMLInputElement;

  expect(el.form === form).to.equal(true);
  expect(el.validity.valid).to.be.true;
  expect(el.validationMessage).to.equal("");
  expect(el.willValidate).to.be.true;
  expect(el.reportValidity()).to.be.true;

  el.focus({ preventScroll: true });
  expect(el.shadowRoot!.activeElement?.id).to.equal("input");
  el.blur();
  expect(el.shadowRoot!.activeElement === null).to.equal(true);

  typeInto(input, "pending");
  await el.updateComplete;
  form.reset();
  await el.updateComplete;
  expect(el.value).to.deep.equal([]);
  expect(input.value).to.equal("");
  expect(el.validity.valueMissing).to.be.true;
  expect(el.validationMessage.length).to.be.greaterThan(0);
  expect(el.reportValidity()).to.be.false;
});

it('associates with a remote form by id through the settable form property, and exposes native labels', async () => {
  const wrapper = (await fixture(html`
    <div>
      <form id="remote-form"></form>
      <label for="remote-input">Recipients</label>
      <lr-token-input id="remote-input"></lr-token-input>
    </div>
  `)) as HTMLDivElement;
  const el = wrapper.querySelector('lr-token-input') as LyraTokenInput;
  expect(el.form === null, 'not associated until the form attribute is set').to
    .equal(true);
  expect(el.labels.length, 'a matching <label for> is exposed').to.equal(1);
  expect((el.labels[0] as HTMLElement).textContent).to.equal('Recipients');

  (el as unknown as { form: string | HTMLFormElement | null }).form =
    'remote-form';
  expect(el.getAttribute('form')).to.equal('remote-form');
  expect(
    el.form?.id,
    'the settable form property resolves the remote-by-id form owner'
  ).to.equal('remote-form');

  (el as unknown as { form: string | HTMLFormElement | null }).form = null;
  expect(
    el.hasAttribute('form'),
    'assigning null clears the form association'
  ).to.equal(false);
  expect(el.form === null).to.equal(true);
});

it("forwards the native draft selection and range-editing APIs without emitting user events", async () => {
  const beforeRender = document.createElement(
    "lr-token-input"
  ) as LyraTokenInput;
  expect(beforeRender.selectionStart).to.equal(null);
  expect(beforeRender.selectionEnd).to.equal(null);
  expect(beforeRender.selectionDirection).to.equal(null);

  const el = (await fixture(
    html`<lr-token-input></lr-token-input>`
  )) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector("#input") as HTMLInputElement;
  typeInto(input, "alpha beta");
  let inputs = 0;
  let changes = 0;
  el.addEventListener("input", () => (inputs += 1));
  el.addEventListener("change", () => (changes += 1));

  el.select();
  expect(el.selectionStart).to.equal(0);
  expect(el.selectionEnd).to.equal("alpha beta".length);

  el.selectionStart = 2;
  el.selectionEnd = 7;
  el.selectionDirection = "backward";
  expect(input.selectionStart).to.equal(2);
  expect(input.selectionEnd).to.equal(7);
  expect(el.selectionDirection).to.equal("backward");

  el.setSelectionRange(0, 5, "forward");
  expect(el.selectionStart).to.equal(0);
  expect(el.selectionEnd).to.equal(5);
  expect(el.selectionDirection).to.equal("forward");

  el.setRangeText("gamma", 0, 5, "select");
  expect(input.value).to.equal("gamma beta");
  expect(el.selectionStart).to.equal(0);
  expect(el.selectionEnd).to.equal(5);
  expect(inputs, "programmatic range editing stays event-silent").to.equal(0);
  expect(changes).to.equal(0);

  // The native optional-argument overload uses the current selection. Its null-capable
  // selection properties also preserve the native input's safe zero/none fallbacks.
  el.selectionStart = null;
  el.selectionEnd = null;
  el.selectionDirection = null;
  expect(el.selectionStart).to.equal(0);
  expect(el.selectionEnd).to.equal(0);
  // Native inputs may normalize a collapsed selection's `none` direction to
  // a concrete direction. The public contract is that the nullish write is
  // forwarded without throwing, not that the browser preserves its spelling.
  expect(["none", "forward", "backward"]).to.include(el.selectionDirection);

  el.setSelectionRange(0, 5);
  el.setRangeText("delta");
  expect(input.value).to.equal("delta beta");
  expect(
    inputs,
    "the optional range-edit overload also stays event-silent"
  ).to.equal(0);
  expect(changes).to.equal(0);

  press(input, "Enter");
  await el.updateComplete;
  expect(
    el.value,
    "the next draft commit must use the range-edited native value"
  ).to.deep.equal(["delta beta"]);
});

it('normalizes an explicit null selection direction argument to "none", distinct from omitting it', async () => {
  const el = (await fixture(
    html`<lr-token-input></lr-token-input>`
  )) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector('#input') as HTMLInputElement;
  typeInto(input, 'alpha beta');

  // An explicit `null` bypasses the parameter default (defaults only apply to `undefined`), so
  // this exercises the function body's own `selectionDirection ?? 'none'` fallback.
  el.setSelectionRange(0, 5, null);
  expect(el.selectionStart).to.equal(0);
  expect(el.selectionEnd).to.equal(5);
  expect(['none', 'forward', 'backward']).to.include(el.selectionDirection);
});

it('is a no-op for setRangeText before the draft input has ever rendered', () => {
  const el = document.createElement('lr-token-input') as LyraTokenInput;
  expect(() => el.setRangeText('x')).to.not.throw();
  expect(() => el.setRangeText('x', 0, 1)).to.not.throw();
  expect(el.selectionStart, 'never rendered, so nothing was mutated').to.equal(
    null
  );
});

it("is accessible", async () => {
  const el = await fixture(
    html`<lr-token-input label="Recipients"></lr-token-input>`
  );
  await expect(el).to.be.accessible();
});

it("interpolates the remove button accessible name with the token label", async () => {
  const el = (await fixture(
    html`<lr-token-input .value=${["alpha"]}></lr-token-input>`
  )) as LyraTokenInput;
  const removeBtn = el.shadowRoot!.querySelector(
    '[part="remove"]'
  ) as HTMLButtonElement;
  expect(removeBtn.getAttribute("aria-label")).to.equal("Remove alpha");
});

it("localizes the remove button accessible name via .strings", async () => {
  const el = (await fixture(
    html`<lr-token-input
      .value=${["alpha"]}
      .strings=${{ removeWithContext: "Retirer {label}" }}
    ></lr-token-input>`
  )) as LyraTokenInput;
  const removeBtn = el.shadowRoot!.querySelector(
    '[part="remove"]'
  ) as HTMLButtonElement;
  expect(removeBtn.getAttribute("aria-label")).to.equal("Retirer alpha");
});

it("fires lr-remove as cancelable and removes the token when not prevented", async () => {
  const el = (await fixture(
    html`<lr-token-input .value=${["alpha", "beta"]}></lr-token-input>`
  )) as LyraTokenInput;
  const listener = oneEvent(el, "lr-remove");
  (
    el.shadowRoot!.querySelector('[part="remove"]') as HTMLButtonElement
  ).click();
  const event = await listener;
  expect(event.cancelable).to.be.true;
  expect(event.detail).to.deep.equal({ value: "alpha", index: 0 });
  expect(el.value).to.deep.equal(["beta"]);
});

it('ignores a stale remove-button click whose bound index no longer exists after a synchronous removal', async () => {
  const el = (await fixture(
    html`<lr-token-input .value=${['alpha']}></lr-token-input>`
  )) as LyraTokenInput;
  const removeBtn = removeButtons(el)[0]!;
  let removeEvents = 0;
  el.addEventListener('lr-remove', () => removeEvents++);

  removeBtn.click(); // removes 'alpha' synchronously; Lit has not yet re-rendered the button out
  removeBtn.click(); // same stale button, still bound to index 0, now out of range

  expect(el.value).to.deep.equal([]);
  expect(
    removeEvents,
    'a stale out-of-range index must not fire a second lr-remove for a token that is not there'
  ).to.equal(1);
});

it("keeps the token in place when a host calls preventDefault() on lr-remove", async () => {
  const el = (await fixture(
    html`<lr-token-input .value=${["alpha", "beta"]}></lr-token-input>`
  )) as LyraTokenInput;
  el.addEventListener("lr-remove", (e) => e.preventDefault());
  (
    el.shadowRoot!.querySelector('[part="remove"]') as HTMLButtonElement
  ).click();
  await el.updateComplete;
  expect(el.value).to.deep.equal(["alpha", "beta"]);
});

it("rejects a stale remove-button activation in the same task that disablement starts", async () => {
  const fieldset = await fixture<HTMLFieldSetElement>(html`
    <fieldset>
      <lr-token-input .value=${["alpha", "beta"]}></lr-token-input>
    </fieldset>
  `);
  const el = fieldset.querySelector("lr-token-input") as LyraTokenInput;
  const directButton = el.shadowRoot!.querySelector(
    '[part="remove"]'
  ) as HTMLButtonElement;

  el.disabled = true;
  directButton.click();
  expect(el.value, "direct disabled write").to.deep.equal(["alpha", "beta"]);

  el.disabled = false;
  await el.updateComplete;
  const fieldsetButton = el.shadowRoot!.querySelector(
    '[part="remove"]'
  ) as HTMLButtonElement;
  fieldset.disabled = true;
  fieldsetButton.click();
  expect(el.value, "same-task fieldset cascade").to.deep.equal([
    "alpha",
    "beta",
  ]);
});

it('contains a stale native focus on the draft input in the same task that disablement starts', async () => {
  const el = (await fixture(
    html`<lr-token-input></lr-token-input>`
  )) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector('#input') as HTMLInputElement;
  let hostFocuses = 0;
  el.addEventListener('focus', () => hostFocuses++);

  // Synchronous disablement flips `effectiveDisabled` before Lit re-renders the native
  // `disabled` attribute, so the input can still be focused directly in this same task.
  el.disabled = true;
  input.dispatchEvent(new FocusEvent('focus', { bubbles: true, composed: true }));
  expect(
    hostFocuses,
    'a same-task disabled focus must not relay through the host'
  ).to.equal(0);
});

it('defaults to size "m" and reflects a size attribute', async () => {
  const defaultEl = (await fixture(
    html`<lr-token-input></lr-token-input>`
  )) as LyraTokenInput;
  expect(defaultEl.size).to.equal("m");
  const el = (await fixture(
    html`<lr-token-input size="s"></lr-token-input>`
  )) as LyraTokenInput;
  expect(el.getAttribute("size")).to.equal("s");
  expect(el.size).to.equal("s");
});

it("matches lr-input's own row height at every shared size tier when empty", async () => {
  const expected: Record<string, string> = {
    "2xs": "20px",
    xs: "24px",
    s: "30px",
    m: "40px",
    l: "48px",
    xl: "56px",
  };
  for (const [size, px] of Object.entries(expected)) {
    const el = await fixture(
      html`<lr-token-input size=${size}></lr-token-input>`
    );
    const wrapper = el.shadowRoot!.querySelector(
      '[part="input-wrapper"]'
    ) as HTMLElement;
    expect(getComputedStyle(wrapper).minBlockSize, `size=${size}`).to.equal(px);
  }
});

// Literal pixels, not a relative comparison, and deliberately the SAME six numbers the
// min-block-size test above asserts: the row's laid-out height must be decided by the shared
// ladder's floor at every tier, never by its own content. Content wins only if the draft input's
// text box plus this row's block padding plus its border outgrows the floor, and that text box is
// `line-height: normal` -- a metric of whatever font family system-ui resolves to on the machine
// running the test. These numbers used to read 25/52/63 at xs/l/xl precisely because content was
// winning there; that made the assertion a fingerprint of one machine's installed fonts (a CI
// runner rendered 24 at xs) and, worse, put the row 1-7px out of line with the lr-input beside it.
it("renders the laid-out row box at the ladder floor, not the ambient font metrics, at every tier", async () => {
  const expected: ReadonlyArray<readonly [string, number]> = [
    ["2xs", 20],
    ["xs", 24],
    ["s", 30],
    ["m", 40],
    ["l", 48],
    ["xl", 56],
  ];
  for (const [size, px] of expected) {
    const el = await fixture(
      html`<lr-token-input size=${size}></lr-token-input>`
    );
    const wrapper = el.shadowRoot!.querySelector(
      '[part="input-wrapper"]'
    ) as HTMLElement;
    expect(
      wrapper.getBoundingClientRect().height,
      `laid-out height at size=${size}`
    ).to.equal(px);
  }
});

it("accepts the Web Awesome size spellings, rendering small/medium/large as s/m/l", async () => {
  const pairs: ReadonlyArray<readonly [string, string]> = [
    ["small", "s"],
    ["medium", "m"],
    ["large", "l"],
  ];
  for (const [alias, step] of pairs) {
    const aliasEl = await fixture(
      html`<lr-token-input size=${alias}></lr-token-input>`
    );
    const stepEl = await fixture(
      html`<lr-token-input size=${step}></lr-token-input>`
    );
    const row = (el: Element) =>
      el.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;
    expect(
      getComputedStyle(row(aliasEl)).minBlockSize,
      `min-block-size for ${alias}`
    ).to.equal(getComputedStyle(row(stepEl)).minBlockSize);
    expect(
      row(aliasEl).getBoundingClientRect().height,
      `laid-out height for ${alias}`
    ).to.equal(row(stepEl).getBoundingClientRect().height);
  }
});

it("rounds the token row and its tokens to a pill without a ::part() rule", async () => {
  const plain = (await fixture(
    html`<lr-token-input .value=${["alpha"]}></lr-token-input>`
  )) as LyraTokenInput;
  const pill = (await fixture(
    html`<lr-token-input pill .value=${["alpha"]}></lr-token-input>`
  )) as LyraTokenInput;
  const radius = (el: LyraTokenInput, part: string) =>
    getComputedStyle(
      el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLElement
    ).borderStartStartRadius;
  expect(pill.pill).to.be.true;
  expect(Number.parseFloat(radius(pill, "input-wrapper"))).to.be.greaterThan(
    Number.parseFloat(radius(plain, "input-wrapper"))
  );
  expect(Number.parseFloat(radius(pill, "token"))).to.be.greaterThan(
    Number.parseFloat(radius(plain, "token"))
  );
});

it("scales token-chip padding with the token-input size tier", async () => {
  const small = (await fixture(
    html`<lr-token-input size="2xs" .value=${["alpha"]}></lr-token-input>`
  )) as LyraTokenInput;
  const large = (await fixture(
    html`<lr-token-input size="xl" .value=${["alpha"]}></lr-token-input>`
  )) as LyraTokenInput;
  const smallToken = small.shadowRoot!.querySelector(
    '[part="token"]'
  ) as HTMLElement;
  const largeToken = large.shadowRoot!.querySelector(
    '[part="token"]'
  ) as HTMLElement;
  expect(
    parseFloat(getComputedStyle(largeToken).paddingInlineStart)
  ).to.be.greaterThan(
    parseFloat(getComputedStyle(smallToken).paddingInlineStart)
  );
});

it("keeps the remove-button hit-area fixed across every size tier", async () => {
  const sizes = ["2xs", "xs", "s", "m", "l", "xl"];
  for (const size of sizes) {
    const el = (await fixture(
      html`<lr-token-input size=${size} .value=${["alpha"]}></lr-token-input>`
    )) as LyraTokenInput;
    const remove = el.shadowRoot!.querySelector(
      '[part="remove"]'
    ) as HTMLElement;
    expect(getComputedStyle(remove).minBlockSize, `size=${size}`).to.equal(
      "40px"
    );
  }
});

it("gives the per-token remove button the shared minimum hit area", async () => {
  const el = (await fixture(
    html`<lr-token-input .value=${["alpha"]}></lr-token-input>`
  )) as LyraTokenInput;
  const removeBtn = el.shadowRoot!.querySelector(
    '[part="remove"]'
  ) as HTMLElement;
  expect(getComputedStyle(removeBtn).minInlineSize).to.equal("40px");
  expect(getComputedStyle(removeBtn).minBlockSize).to.equal("40px");
});

it("renders label/hint/error content passed through named slots", async () => {
  const el = (await fixture(html`
    <lr-token-input>
      <span slot="label">Recipients</span>
      <span slot="hint">Press enter to add</span>
      <span slot="error">Required</span>
    </lr-token-input>
  `)) as LyraTokenInput;
  const labelPart = el.shadowRoot!.querySelector(
    '[part="form-control-label"]'
  ) as HTMLElement;
  const hintPart = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  const errorPart = el.shadowRoot!.querySelector(
    '[part="error"]'
  ) as HTMLElement;
  expect(labelPart.hidden).to.be.false;
  expect(hintPart.hidden).to.be.false;
  expect(errorPart.hidden).to.be.false;
  const labelSlot = labelPart.querySelector(
    'slot[name="label"]'
  ) as HTMLSlotElement;
  const hintSlot = hintPart.querySelector(
    'slot[name="hint"]'
  ) as HTMLSlotElement;
  const errorSlot = errorPart.querySelector(
    'slot[name="error"]'
  ) as HTMLSlotElement;
  expect((labelSlot.assignedElements()[0] as HTMLElement).textContent).to.equal(
    "Recipients"
  );
  expect((hintSlot.assignedElements()[0] as HTMLElement).textContent).to.equal(
    "Press enter to add"
  );
  expect((errorSlot.assignedElements()[0] as HTMLElement).textContent).to.equal(
    "Required"
  );
});

it("lets an explicit aria-label win over the computed aria-labelledby", async () => {
  const el = (await fixture(
    html`<lr-token-input
      label="Recipients"
      aria-label="Choose recipients"
    ></lr-token-input>`
  )) as LyraTokenInput;
  const wrapper = el.shadowRoot!.querySelector(
    '[part="input-wrapper"]'
  ) as HTMLElement;
  expect(wrapper.getAttribute("aria-label")).to.equal("Choose recipients");
  expect(
    wrapper.hasAttribute("aria-labelledby"),
    "an explicit aria-label must suppress the computed labelledby id"
  ).to.be.false;
});

it("preserves an explicitly empty host aria-label over a visible label", async () => {
  const el = (await fixture(
    html`<lr-token-input label="Recipients" aria-label=""></lr-token-input>`
  )) as LyraTokenInput;
  const wrapper = el.shadowRoot!.querySelector(
    '[part="input-wrapper"]'
  ) as HTMLElement;
  const input = el.shadowRoot!.querySelector("#input") as HTMLInputElement;
  for (const owner of [wrapper, input]) {
    expect(owner.hasAttribute("aria-label")).to.equal(true);
    expect(owner.getAttribute("aria-label")).to.equal("");
    expect(owner.hasAttribute("aria-labelledby")).to.equal(false);
  }
});

it("applies the host name and field descriptions to the actual draft textbox", async () => {
  const el = (await fixture(html`
    <lr-token-input
      aria-label="Choose recipients"
      hint="Separate names with commas"
      error-text="At least one recipient is required"
    ></lr-token-input>
  `)) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector("#input") as HTMLInputElement;
  expect(input.getAttribute("aria-label")).to.equal("Choose recipients");
  const described = input.getAttribute("aria-describedby")!.split(" ");
  expect(described).to.include(
    el.shadowRoot!.querySelector('[part="hint"]')!.id
  );
  expect(described).to.include(
    el.shadowRoot!.querySelector('[part="error"]')!.id
  );
});

it("forwards editing-assistance attributes to the draft input and inline token editor", async () => {
  const el = (await fixture(html`
    <lr-token-input
      editable
      spellcheck="false"
      autocapitalize="off"
      autocorrect="off"
      .value=${["alpha"]}
    ></lr-token-input>
  `)) as LyraTokenInput;
  const draft = el.shadowRoot!.querySelector("#input") as HTMLInputElement;
  expect(el.spellcheck).to.be.false;
  expect(el.autocapitalize).to.equal("off");
  expect(el.autocorrect).to.be.false;
  expect("autoCorrect" in el).to.be.false;
  expect(draft.spellcheck).to.be.false;
  expect(draft.getAttribute("autocapitalize")).to.equal("off");
  expect(draft.getAttribute("autocorrect")).to.equal("off");

  tokenLabels(el)[0].click();
  await el.updateComplete;
  const tokenEditor = editor(el)!;
  expect(tokenEditor.spellcheck).to.be.false;
  expect(tokenEditor.getAttribute("autocapitalize")).to.equal("off");
  expect(tokenEditor.getAttribute("autocorrect")).to.equal("off");
});

it("normalizes boolean and string autocorrect writes through the lowercase native IDL", async () => {
  const el = (await fixture(
    html`<lr-token-input></lr-token-input>`
  )) as LyraTokenInput;
  const draft = el.shadowRoot!.querySelector("#input") as HTMLInputElement;
  expect(el.autocorrect).to.be.true;
  expect(draft.hasAttribute("autocorrect")).to.be.false;

  el.autocorrect = "false";
  await el.updateComplete;
  expect(el.autocorrect).to.be.false;
  expect(draft.getAttribute("autocorrect")).to.equal("off");

  el.autocorrect = "on";
  await el.updateComplete;
  expect(el.autocorrect).to.be.true;
  expect(draft.hasAttribute("autocorrect")).to.be.false;
});

it('renders the explicit "on" attribute vocabulary on both the draft input and an open token editor', async () => {
  const el = (await fixture(html`
    <lr-token-input editable autocorrect="on" .value=${['alpha']}></lr-token-input>
  `)) as LyraTokenInput;
  const draft = el.shadowRoot!.querySelector('#input') as HTMLInputElement;
  expect(el.autocorrect).to.be.true;
  expect(
    draft.getAttribute('autocorrect'),
    'an explicit markup attribute must render the "on" value, not omit the attribute'
  ).to.equal('on');

  tokenLabels(el)[0].click();
  await el.updateComplete;
  expect(editor(el)!.getAttribute('autocorrect')).to.equal('on');
});

it("closes positional edit state rather than transferring it to a reordered replacement", async () => {
  const el = (await fixture(html`
    <lr-token-input editable .value=${["alpha", "beta"]}></lr-token-input>
  `)) as LyraTokenInput;
  (
    el.shadowRoot!.querySelectorAll('[part="token-label"]')[0] as HTMLElement
  ).click();
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelectorAll('[part="token-editor"]').length
  ).to.equal(1);

  el.value = ["beta", "alpha"];
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelectorAll('[part="token-editor"]').length
  ).to.equal(0);
});

it("contains a single unbroken token inside a 320px allocation", async () => {
  const el = (await fixture(html`
    <lr-token-input
      style="inline-size:320px"
      .value=${["x".repeat(120)]}
    ></lr-token-input>
  `)) as LyraTokenInput;
  const token = el.shadowRoot!.querySelector('[part="token"]') as HTMLElement;
  expect(token.scrollWidth).to.be.at.most(token.clientWidth);
  expect(el.scrollWidth).to.be.at.most(320);
});

it("grows by default and uses an explicit block scrollport only when exact height caps wrapping", async () => {
  const many = Array.from({ length: 12 }, (_, index) => `token-${index + 1}`);
  const growing = (await fixture(html`
    <lr-token-input style="inline-size:320px" .value=${many}></lr-token-input>
  `)) as LyraTokenInput;
  const growingWrapper = growing.shadowRoot!.querySelector(
    '[part="input-wrapper"]'
  ) as HTMLElement;
  expect(
    growingWrapper.scrollHeight,
    "the uncapped wrapped row grows with its content"
  ).to.equal(growingWrapper.clientHeight);

  const capped = (await fixture(html`
    <lr-token-input
      editable
      style="inline-size:320px; --lr-token-input-control-height:40px"
      .value=${many}
    ></lr-token-input>
  `)) as LyraTokenInput;
  const cappedWrapper = capped.shadowRoot!.querySelector(
    '[part="input-wrapper"]'
  ) as HTMLElement;
  const overflow = getComputedStyle(cappedWrapper);
  expect(overflow.overflowX, "inline overflow is clipped explicitly").to.equal(
    "hidden"
  );
  expect(
    overflow.overflowY,
    "an exact-height cap deliberately preserves tokens by block scrolling"
  ).to.equal("auto");
  expect(
    cappedWrapper.scrollWidth,
    "wrapped tokens do not create inline scroll extent"
  ).to.equal(cappedWrapper.clientWidth);
  expect(cappedWrapper.scrollHeight).to.be.greaterThan(
    cappedWrapper.clientHeight
  );

  const labels = [
    ...capped.shadowRoot!.querySelectorAll<HTMLElement>('[part="token-label"]'),
  ];
  labels[0]!.focus();
  labels[0]!.dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true })
  );
  await capped.updateComplete;
  expect(
    (capped.shadowRoot!.activeElement as HTMLElement | null)?.textContent
  ).to.equal("token-12");
  expect(
    cappedWrapper.scrollTop,
    "keyboard focus scrolls the final wrapped token into view"
  ).to.be.greaterThan(0);

  const single = (await fixture(html`
    <lr-token-input
      style="inline-size:320px; --lr-token-input-control-height:40px"
      .value=${["one-token-with-a-remove-action"]}
    ></lr-token-input>
  `)) as LyraTokenInput;
  const singleWrapper = single.shadowRoot!.querySelector(
    '[part="input-wrapper"]'
  ) as HTMLElement;
  expect(singleWrapper.scrollWidth).to.equal(singleWrapper.clientWidth);
  expect(
    singleWrapper.scrollHeight,
    "the exact cap scrolls rather than clipping the hit-area floor"
  ).to.be.greaterThan(singleWrapper.clientHeight);
});

it("marks the draft input aria-invalid once touched with a validation failure, and clears it once valid", async () => {
  const el = (await fixture(
    html`<lr-token-input required></lr-token-input>`
  )) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector("#input") as HTMLInputElement;
  expect(input.getAttribute("aria-invalid"), "untouched so far").to.equal(
    "false"
  );
  input.dispatchEvent(new Event("blur"));
  await el.updateComplete;
  expect(
    input.getAttribute("aria-invalid"),
    "touched and still empty/invalid"
  ).to.equal("true");
  el.value = ["alpha"];
  await el.updateComplete;
  expect(input.getAttribute("aria-invalid"), "touched but now valid").to.equal(
    "false"
  );
});

it("applies the label styling to the actual rendered form-control-label part", async () => {
  const el = (await fixture(
    html`<lr-token-input label="Recipients"></lr-token-input>`
  )) as LyraTokenInput;
  const label = el.shadowRoot!.querySelector(
    '[part="form-control-label"]'
  ) as HTMLElement;
  expect(getComputedStyle(label).fontWeight).to.equal("600");
});

it("cascades disabled state from an ancestor fieldset without mutating the disabled property", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-token-input></lr-token-input>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-token-input") as LyraTokenInput;
  const fieldset = form.querySelector("fieldset") as HTMLFieldSetElement;
  await el.updateComplete;
  expect(el.effectiveDisabled).to.be.false;
  expect(getComputedStyle(el).opacity, "not yet fieldset-disabled").to.equal(
    "1"
  );

  fieldset.disabled = true;
  await el.updateComplete;
  expect(el.disabled, "fieldset state must not mutate the public property").to
    .be.false;
  expect(el.effectiveDisabled).to.be.true;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  expect(input.disabled).to.be.true;
  // `:host(:disabled)` (the native FACE pseudo-class), not `:host([disabled])`, must dim the host
  // purely from the fieldset cascade even though the component's own `disabled` attribute/property
  // was never touched -- otherwise the control looks fully active while every internal control is
  // functionally inert.
  expect(
    getComputedStyle(el).opacity,
    "fieldset-only disabled must still dim the host"
  ).to.equal("0.5");

  fieldset.disabled = false;
  await el.updateComplete;
  expect(el.effectiveDisabled).to.be.false;
  expect(input.disabled).to.be.false;
  expect(getComputedStyle(el).opacity).to.equal("1");
});

it("gives the editable token-label a hover state matching its focus-visible ring and pointer cursor", async () => {
  const css = styles.cssText.replace(/"/g, "'").replace(/\s+/g, " ");
  expect(css).to.match(/\[part='token-label'\]:hover\s*\{[^}]*background:/);
});

it("focuses the draft input on host click(), mirroring lr-combobox's click forwarding", async () => {
  const el = (await fixture(
    html`<lr-token-input></lr-token-input>`
  )) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector("#input") as HTMLInputElement;
  expect(el.shadowRoot!.activeElement === null, "nothing focused yet").to.equal(
    true
  );
  el.click();
  expect(
    el.shadowRoot!.activeElement!.id,
    "host click() must forward focus to the draft input"
  ).to.equal(input.id);
});

it("does not focus the draft input on host click() while disabled", async () => {
  const el = (await fixture(
    html`<lr-token-input disabled></lr-token-input>`
  )) as LyraTokenInput;
  el.click();
  expect(el.shadowRoot!.activeElement === null).to.equal(true);
});

it("does not focus the still-rendered draft in the same task that direct disablement begins", async () => {
  const el = (await fixture(
    html`<lr-token-input></lr-token-input>`
  )) as LyraTokenInput;
  el.disabled = true;
  el.focus();
  expect(
    el.shadowRoot!.activeElement === null,
    "focus() must consult synchronous host state instead of waiting for the native disabled render"
  ).to.be.true;
});

it("does not focus the still-rendered draft in the same task that fieldset disablement begins", async () => {
  const fieldset = (await fixture(html`
    <fieldset>
      <lr-token-input></lr-token-input>
    </fieldset>
  `)) as HTMLFieldSetElement;
  const el = fieldset.querySelector("lr-token-input") as LyraTokenInput;
  fieldset.disabled = true;
  el.focus();
  expect(
    el.shadowRoot!.activeElement === null,
    "focus() must honor the synchronous FACE fieldset cascade before the next render"
  ).to.be.true;
});

describe("ElementInternals availability", () => {
  it("does not throw when constructed in an environment without a real ElementInternals implementation (e.g. a downstream Vitest + happy-dom suite)", () => {
    const original = HTMLElement.prototype.attachInternals;
    // @ts-expect-error -- simulating an environment that lacks ElementInternals entirely
    delete HTMLElement.prototype.attachInternals;
    try {
      let el: LyraTokenInput | undefined;
      expect(() => {
        el = document.createElement("lr-token-input") as LyraTokenInput;
      }).to.not.throw();
      expect(el!.checkValidity()).to.be.true;
      expect(el!.form === null).to.equal(true);
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });

  it("falls back to no-op internals when attachInternals() throws (e.g. already attached)", () => {
    const original = HTMLElement.prototype.attachInternals;
    HTMLElement.prototype.attachInternals =
      function attachInternals(): ElementInternals {
        throw new DOMException(
          "ElementInternals for the specified element was already attached",
          "InvalidStateError"
        );
      };
    try {
      let el: LyraTokenInput | undefined;
      expect(() => {
        el = document.createElement("lr-token-input") as LyraTokenInput;
      }).to.not.throw();
      expect(el!.checkValidity()).to.be.true;
      expect(el!.reportValidity()).to.be.true;
      expect(el!.form === null).to.equal(true);
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

it("calls super.willUpdate so a future LyraElement/mixin lifecycle hook stays wired in", async () => {
  const proto = LyraElement.prototype as unknown as {
    willUpdate: (changed: PropertyValues) => void;
  };
  const original = proto.willUpdate;
  let called = false;
  proto.willUpdate = function (
    this: LyraElement,
    changed: PropertyValues
  ): void {
    called = true;
    original.call(this, changed);
  };
  try {
    const el = (await fixture(
      html`<lr-token-input></lr-token-input>`
    )) as LyraTokenInput;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    proto.willUpdate = original;
  }
});

it("calls super.updated so a future LyraElement/mixin lifecycle hook stays wired in", async () => {
  const proto = LyraElement.prototype as unknown as {
    updated: (changed: PropertyValues) => void;
  };
  const original = proto.updated;
  let called = false;
  proto.updated = function (this: LyraElement, changed: PropertyValues): void {
    called = true;
    original.call(this, changed);
  };
  try {
    const el = (await fixture(
      html`<lr-token-input></lr-token-input>`
    )) as LyraTokenInput;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    proto.updated = original;
  }
});

it("submits under a programmatically assigned name in the same tick", async () => {
  const form = (await fixture(html`
    <form><lr-token-input .value=${["alpha", "beta"]}></lr-token-input></form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-token-input") as LyraTokenInput;

  el.name = "tags";
  expect(el.getAttribute("name")).to.equal("tags");
  expect(new FormData(form).getAll("tags")).to.deep.equal(["alpha", "beta"]);

  el.name = "labels";
  const renamed = new FormData(form);
  expect(renamed.has("tags"), "the old name must not still hold entries").to.be
    .false;
  expect(renamed.getAll("labels")).to.deep.equal(["alpha", "beta"]);

  el.name = "";
  expect(el.hasAttribute("name")).to.be.false;
  expect(el.name).to.equal("");
  expect(new FormData(form).has("labels")).to.be.false;

  el.setAttribute("name", "from-attribute");
  expect(el.name).to.equal("from-attribute");
  expect(new FormData(form).getAll("from-attribute")).to.deep.equal([
    "alpha",
    "beta",
  ]);
  el.removeAttribute("name");
  expect(el.name).to.equal("");
  expect(new FormData(form).has("from-attribute")).to.be.false;
});

describe("form state restoration", () => {
  it("restores repeated FormData values and updates submission without user events", async () => {
    const form = (await fixture(html`
      <form>
        <lr-token-input name="tags" .value=${["stale"]}></lr-token-input>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-token-input") as LyraTokenInput;
    let changes = 0;
    el.addEventListener("input", () => changes++);
    el.addEventListener("change", () => changes++);
    const state = new FormData();
    state.append("tags", "alpha");
    state.append("tags", "beta");

    el.formStateRestoreCallback(state, "restore");

    expect(el.value).to.deep.equal(["alpha", "beta"]);
    expect(new FormData(form).getAll("tags")).to.deep.equal(["alpha", "beta"]);
    expect(changes, "browser restoration is not a user edit").to.equal(0);
  });

  it("retains an early FormData restore through connection and first update", async () => {
    const form = document.createElement("form");
    const el = document.createElement("lr-token-input") as LyraTokenInput;
    el.name = "tags";
    const state = new FormData();
    state.append("tags", "early");
    el.formStateRestoreCallback(state, "restore");
    form.append(el);
    document.body.append(form);
    try {
      await el.updateComplete;
      expect(el.value).to.deep.equal(["early"]);
      expect(new FormData(form).getAll("tags")).to.deep.equal(["early"]);
    } finally {
      form.remove();
    }
  });

  it("clears to a safe empty value for malformed non-FormData state", async () => {
    const el = (await fixture(
      html`<lr-token-input .value=${["stale"]}></lr-token-input>`
    )) as LyraTokenInput;
    expect(() =>
      el.formStateRestoreCallback("not FormData", "restore")
    ).not.to.throw();
    expect(el.value).to.deep.equal([]);
  });
});

it("separates its live token array from the reflected JSON current default", async () => {
  const form = (await fixture(html`
    <form>
      <lr-token-input name="tags" value='["alpha","beta"]'></lr-token-input>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-token-input") as LyraTokenInput;
  expect(el.value).to.deep.equal(["alpha", "beta"]);
  expect(el.defaultValue).to.deep.equal(["alpha", "beta"]);

  el.value = ["dirty"];
  el.setAttribute("value", '["next"]');
  expect(el.defaultValue).to.deep.equal(["next"]);
  expect(
    el.value,
    "attribute mutation cannot overwrite dirty live state"
  ).to.deep.equal(["dirty"]);

  form.reset();
  expect(el.value).to.deep.equal(["next"]);
  el.defaultValue = ["pristine"];
  expect(el.getAttribute("value")).to.equal('["pristine"]');
  expect(
    el.value,
    "after reset the live value is pristine again"
  ).to.deep.equal(["pristine"]);
});

it("normalizes JSON reset defaults through the same string-only boundary as property writes", async () => {
  for (const [serialized, normalized] of [
    ["not JSON", []],
    ['["alpha", 2]', ["alpha"]],
  ] as const) {
    const form = (await fixture(html`
      <form>
        <lr-token-input name="tags" value=${serialized}></lr-token-input>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-token-input") as LyraTokenInput;

    expect(el.defaultValue, serialized).to.deep.equal(normalized);
    expect(el.value, serialized).to.deep.equal(normalized);

    el.value = ["draft"];
    form.reset();
    await el.updateComplete;
    expect(el.value, `form reset after ${serialized}`).to.deep.equal(
      normalized
    );
  }
});

it("updates validity synchronously when required changes, with no await", async () => {
  const el = (await fixture(
    html`<lr-token-input></lr-token-input>`
  )) as LyraTokenInput;
  expect(el.checkValidity()).to.be.true;

  el.required = true;
  expect(el.hasAttribute("required")).to.be.true;
  expect(el.checkValidity()).to.be.false;

  el.value = ["ready"];
  expect(el.checkValidity()).to.be.true;

  el.value = [];
  el.required = false;
  expect(el.checkValidity()).to.be.true;
});

it("applies and removes explicit disabled form state synchronously, with no await", async () => {
  const form = (await fixture(html`
    <form>
      <lr-token-input name="tags" .value=${["alpha"]}></lr-token-input>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-token-input") as LyraTokenInput;
  expect(new FormData(form).getAll("tags")).to.deep.equal(["alpha"]);

  el.disabled = true;
  expect(
    el.hasAttribute("disabled"),
    "the host attribute must be set synchronously"
  ).to.be.true;
  expect(el.effectiveDisabled).to.be.true;
  expect(
    new FormData(form).has("tags"),
    "a disabled control must be omitted from FormData"
  ).to.be.false;

  el.disabled = false;
  expect(el.hasAttribute("disabled")).to.be.false;
  expect(el.effectiveDisabled).to.be.false;
  expect(new FormData(form).getAll("tags")).to.deep.equal(["alpha"]);
});

it("commits the draft on Tab without trapping focus for an extra keystroke", async () => {
  const el = (await fixture(
    html`<lr-token-input></lr-token-input>`
  )) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.value = "alpha";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  const event = new KeyboardEvent("keydown", {
    key: "Tab",
    bubbles: true,
    cancelable: true,
  });
  input.dispatchEvent(event);
  await el.updateComplete;
  expect(el.value).to.deep.equal(["alpha"]);
  expect(
    event.defaultPrevented,
    "Tab must not be prevented so native focus-advance still happens"
  ).to.be.false;
});

describe("editable tokens", () => {
  it("renders byte-identical token markup while editable is unset", async () => {
    const el = (await fixture(
      html`<lr-token-input .value=${["alpha"]}></lr-token-input>`
    )) as LyraTokenInput;
    expect(el.editable, "editable must default to false").to.be.false;
    const token = el.shadowRoot!.querySelector('[part="token"]') as HTMLElement;
    // Today's markup: <span part="token"><span>alpha</span><button part="remove" …></button></span>
    expect(token.getAttributeNames()).to.deep.equal(["part"]);
    const label = token.querySelector("span") as HTMLElement;
    expect(
      label.getAttributeNames(),
      "the plain label span must gain no attributes"
    ).to.deep.equal([]);
    expect(label.textContent).to.equal("alpha");
    expect(
      tokenLabels(el).length,
      "token-label is an editable-only part"
    ).to.equal(0);
    expect(
      editor(el) === null,
      "token-editor is an editable-only part"
    ).to.equal(true);
    expect(
      el
        .shadowRoot!.querySelector('[part="input-wrapper"]')!
        .getAttribute("role"),
      "the row role is unchanged"
    ).to.equal("group");
  });

  it("opens a focused editor holding the full token when a token is clicked", async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${[RULE]}></lr-token-input>`
    )) as LyraTokenInput;
    const [label] = tokenLabels(el);
    expect(label.textContent).to.equal(RULE);
    label.click();
    await el.updateComplete;
    const field = editor(el)!;
    expect(field != null, "clicking a token opens its editor").to.equal(true);
    expect(
      field.value,
      "the editor holds the whole token, not a delimiter-split fragment"
    ).to.equal(RULE);
    expect(el.shadowRoot!.activeElement!.getAttribute("part")).to.equal(
      "token-editor"
    );
  });

  it("opens the editor from the keyboard with Enter, Space, and F2", async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${["alpha"]}></lr-token-input>`
    )) as LyraTokenInput;
    for (const key of ["Enter", " ", "F2"]) {
      const event = press(tokenLabels(el)[0], key);
      await el.updateComplete;
      expect(editor(el) != null, `${key} must open the editor`).to.equal(true);
      expect(event.defaultPrevented, `${key} must not also scroll or submit`).to
        .be.true;
      press(editor(el)!, "Escape");
      await el.updateComplete;
    }
  });

  it("commits an edit on Enter and reports the previous value", async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${[RULE, "other"]}></lr-token-input>`
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    const field = editor(el)!;
    typeInto(field, "Bash(git diff:*)");
    const edited = oneEvent(el, "lr-token-edit");
    press(field, "Enter");
    const event = await edited;
    expect(event.detail).to.deep.equal({
      value: "Bash(git diff:*)",
      previousValue: RULE,
      index: 0,
    });
    await el.updateComplete;
    expect(el.value).to.deep.equal(["Bash(git diff:*)", "other"]);
    expect(editor(el) === null, "the editor closes on commit").to.equal(true);
    expect(
      el.shadowRoot!.activeElement!.getAttribute("part"),
      "focus returns to the token"
    ).to.equal("token-label");
  });

  it("emits exactly one change for a committed edit, even though the editor blurs in the same tick", async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${["alpha"]}></lr-token-input>`
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    const field = editor(el)!;
    let changes = 0;
    let inputs = 0;
    el.addEventListener("change", () => changes++);
    el.addEventListener("input", () => inputs++);
    typeInto(field, "beta");
    press(field, "Enter");
    // The editor is torn down while focused; a late blur must not commit a second time.
    field.dispatchEvent(new Event("blur"));
    await el.updateComplete;
    expect(el.value).to.deep.equal(["beta"]);
    expect(changes, "one commit is one change").to.equal(1);
    expect(inputs).to.equal(1);
  });

  it("commits an inline edit before relaying its native blur, and never lr-blur", async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${["alpha"]}></lr-token-input>`
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    const field = editor(el)!;
    typeInto(field, "beta");
    const order: string[] = [];
    el.addEventListener("input", (event) => {
      expect(event instanceof InputEvent).to.be.true;
      order.push("input");
    });
    el.addEventListener("lr-input", (event) => {
      expect((event as CustomEvent).detail).to.deep.equal({ value: ["beta"] });
      order.push("lr-input");
    });
    el.addEventListener("change", (event) => {
      expect(event instanceof CustomEvent).to.be.false;
      order.push("change");
    });
    el.addEventListener("lr-change", () => order.push("lr-change"));
    el.addEventListener("blur", (event) => {
      expect(event instanceof FocusEvent).to.be.true;
      order.push("blur");
    });
    el.addEventListener("lr-blur", () => order.push("lr-blur"));

    field.dispatchEvent(new FocusEvent("blur"));
    await el.updateComplete;
    expect(order).to.deep.equal([
      "input",
      "lr-input",
      "change",
      "lr-change",
      "blur",
    ]);
    // v9 dropped the v8 lr-focus/lr-blur compatibility aliases -- only the native pair remains.
    expect(order).to.not.include("lr-blur");
  });

  it("discards transient edits and drafts without user-change events when disabling the control", async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${["alpha"]}></lr-token-input>`
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    typeInto(editor(el)!, "beta");
    const main = el.shadowRoot!.querySelector("#input") as HTMLInputElement;
    typeInto(main, "pending-new-token");
    let emitted = 0;
    for (const name of ["input", "change", "lr-token-edit"])
      el.addEventListener(name, () => emitted++);

    el.disabled = true;
    await el.updateComplete;

    expect(el.value).to.deep.equal(["alpha"]);
    expect(editor(el) === null, "the inline editor is torn down").to.equal(
      true
    );
    expect(main.value, "an uncommitted new-token draft is discarded").to.equal(
      ""
    );
    expect(emitted, "a lifecycle transition is not a user edit").to.equal(0);
  });

  it("discards an inline edit without emitting when editable is turned off", async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${["alpha"]}></lr-token-input>`
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    typeInto(editor(el)!, "beta");
    let emitted = 0;
    for (const name of ["input", "change", "lr-token-edit"])
      el.addEventListener(name, () => emitted++);

    el.editable = false;
    await el.updateComplete;

    expect(el.value).to.deep.equal(["alpha"]);
    expect(editor(el) === null).to.equal(true);
    expect(emitted).to.equal(0);
  });

  it("discards transient edits and drafts across fieldset disablement and disconnect", async () => {
    const form = (await fixture(html`
      <form>
        <fieldset>
          <lr-token-input editable .value=${["alpha"]}></lr-token-input>
        </fieldset>
      </form>
    `)) as HTMLFormElement;
    const fieldset = form.querySelector("fieldset") as HTMLFieldSetElement;
    const el = form.querySelector("lr-token-input") as LyraTokenInput;
    let emitted = 0;
    for (const name of ["input", "change", "lr-token-edit"])
      el.addEventListener(name, () => emitted++);

    tokenLabels(el)[0].click();
    await el.updateComplete;
    typeInto(editor(el)!, "fieldset-edit");
    fieldset.disabled = true;
    await el.updateComplete;
    expect(el.value).to.deep.equal(["alpha"]);
    expect(editor(el) === null).to.equal(true);

    fieldset.disabled = false;
    await el.updateComplete;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    typeInto(editor(el)!, "disconnect-edit");
    typeInto(
      el.shadowRoot!.querySelector("#input") as HTMLInputElement,
      "stale-draft"
    );
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;

    expect(el.value).to.deep.equal(["alpha"]);
    expect(editor(el) === null).to.equal(true);
    expect(
      (el.shadowRoot!.querySelector("#input") as HTMLInputElement).value
    ).to.equal("");
    expect(emitted).to.equal(0);
  });

  it("commits the main draft and opens the editor without doubling change events", async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${["alpha"]}></lr-token-input>`
    )) as LyraTokenInput;
    const main = el.shadowRoot!.querySelector("#input") as HTMLInputElement;
    let changes = 0;
    el.addEventListener("change", () => changes++);
    typeInto(main, "gamma");
    main.dispatchEvent(new Event("blur"));
    tokenLabels(el)[0].click();
    await el.updateComplete;
    expect(el.value).to.deep.equal(["alpha", "gamma"]);
    expect(
      changes,
      "only the draft commit emitted change; opening an editor emits nothing"
    ).to.equal(1);
    expect(editor(el) != null).to.equal(true);
  });

  it("reverts on Escape without emitting", async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${["alpha"]}></lr-token-input>`
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    const field = editor(el)!;
    let emitted = 0;
    for (const name of ["input", "change", "lr-token-edit"])
      el.addEventListener(name, () => emitted++);
    typeInto(field, "beta");
    const event = press(field, "Escape");
    await el.updateComplete;
    expect(el.value).to.deep.equal(["alpha"]);
    expect(emitted, "a reverted edit emits nothing").to.equal(0);
    expect(editor(el) === null).to.equal(true);
    expect(event.defaultPrevented).to.be.true;
    expect(el.shadowRoot!.activeElement!.getAttribute("part")).to.equal(
      "token-label"
    );
  });

  it("keeps Escape inside an open editor from reaching an enclosing dismissible layer", async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${["alpha"]}></lr-token-input>`
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    let outer = 0;
    const onKeyDown = (): void => void outer++;
    document.addEventListener("keydown", onKeyDown);
    try {
      press(editor(el)!, "Escape");
    } finally {
      document.removeEventListener("keydown", onKeyDown);
    }
    expect(outer, "the editor consumes its own Escape").to.equal(0);
  });

  it("discards an edit that would duplicate an existing token unless allowDuplicates is set", async () => {
    const el = (await fixture(
      html`<lr-token-input
        editable
        .value=${["alpha", "beta"]}
      ></lr-token-input>`
    )) as LyraTokenInput;
    tokenLabels(el)[1].click();
    await el.updateComplete;
    let emitted = 0;
    for (const name of ["input", "change", "lr-token-edit"])
      el.addEventListener(name, () => emitted++);
    typeInto(editor(el)!, "alpha");
    press(editor(el)!, "Enter");
    await el.updateComplete;
    expect(
      el.value,
      "the colliding edit is discarded, like a duplicate draft"
    ).to.deep.equal(["alpha", "beta"]);
    expect(emitted).to.equal(0);
    expect(editor(el) === null, "the editor still closes").to.equal(true);

    el.allowDuplicates = true;
    await el.updateComplete;
    tokenLabels(el)[1].click();
    await el.updateComplete;
    typeInto(editor(el)!, "alpha");
    press(editor(el)!, "Enter");
    await el.updateComplete;
    expect(el.value).to.deep.equal(["alpha", "alpha"]);
  });

  it("treats an emptied editor as a cancel rather than a removal", async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${["alpha"]}></lr-token-input>`
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    typeInto(editor(el)!, "   ");
    press(editor(el)!, "Enter");
    await el.updateComplete;
    expect(el.value).to.deep.equal(["alpha"]);
    expect(editor(el) === null).to.equal(true);
  });

  it("gives the token row a roving tabindex that clamps when the token list shrinks", async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${["a", "b", "c"]}></lr-token-input>`
    )) as LyraTokenInput;
    expect(tokenLabels(el).map((label) => label.tabIndex)).to.deep.equal([
      0, -1, -1,
    ]);

    press(tokenLabels(el)[0], "ArrowRight");
    await el.updateComplete;
    press(tokenLabels(el)[1], "ArrowRight");
    await el.updateComplete;
    expect(tokenLabels(el).map((label) => label.tabIndex)).to.deep.equal([
      -1, -1, 0,
    ]);
    expect(el.shadowRoot!.activeElement!.textContent).to.equal("c");

    el.value = ["a"];
    await el.updateComplete;
    expect(
      tokenLabels(el).map((label) => label.tabIndex),
      "the roving index must clamp instead of leaving no tab stop"
    ).to.deep.equal([0]);
  });

  it('moves real focus to the nearest token when a controlled value shrink removes the focused tail', async () => {
    const el = (await fixture(html`
      <lr-token-input
        editable
        .value=${['alpha', 'beta', 'gamma']}
      ></lr-token-input>
    `)) as LyraTokenInput;
    tokenLabels(el)[2]!.focus();
    expect(el.shadowRoot!.activeElement === tokenLabels(el)[2]).to.equal(true);

    el.value = ['alpha', 'beta'];
    await el.updateComplete;

    expect(el.shadowRoot!.activeElement === tokenLabels(el)[1]).to.equal(true);
    expect(tokenLabels(el)[1]!.textContent).to.equal('beta');
  });

  it('moves real focus to the nearest remove action when a pristine default shrinks', async () => {
    const el = (await fixture(html`
      <lr-token-input
        editable
        value='["alpha","beta","gamma"]'
      ></lr-token-input>
    `)) as LyraTokenInput;
    const focused = removeButtons(el)[2]!;
    focused.focus();
    expect(el.shadowRoot!.activeElement === focused).to.equal(true);

    el.defaultValue = ['alpha', 'beta'];
    await el.updateComplete;

    expect(el.value).to.deep.equal(['alpha', 'beta']);
    expect(el.shadowRoot!.activeElement === removeButtons(el)[1]).to.equal(
      true
    );
  });

  it('falls back to the surviving remove action when the captured token-label surface stops existing because editable was turned off before the repair applied', async () => {
    const el = (await fixture(html`
      <lr-token-input editable .value=${['alpha', 'beta']}></lr-token-input>
    `)) as LyraTokenInput;
    tokenLabels(el)[1]!.focus();
    expect(el.shadowRoot!.activeElement === tokenLabels(el)[1]).to.equal(true);

    // Both synchronous, same task: the shrink captures a 'label' repair target, then editable
    // turns off before that repair is applied in `updated()`, so no token-label part exists
    // anywhere once the row re-renders.
    el.value = ['alpha'];
    el.editable = false;
    await el.updateComplete;

    expect(el.value).to.deep.equal(['alpha']);
    expect(
      (el.shadowRoot!.activeElement as HTMLElement | null)?.getAttribute(
        'part'
      ),
      'focus must land on the remaining remove action instead of being lost to the body'
    ).to.equal('remove');
  });

  it('does not reclaim focus moved outside after a controlled shrink', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        <lr-token-input
          editable
          .value=${['alpha', 'beta']}
        ></lr-token-input>
        <button type="button">Outside</button>
      </div>
    `);
    const el = wrapper.querySelector('lr-token-input') as LyraTokenInput;
    const outside = wrapper.querySelector('button')!;
    tokenLabels(el)[1]!.focus();

    el.value = ['alpha'];
    outside.focus();
    await el.updateComplete;

    expect(el.ownerDocument.activeElement === outside).to.equal(true);
  });

  it('swaps the roving arrow keys under dir="rtl"', async () => {
    const wrapper = await fixture(html`
      <div dir="rtl">
        <lr-token-input editable .value=${["a", "b"]}></lr-token-input>
      </div>
    `);
    const el = wrapper.querySelector("lr-token-input") as LyraTokenInput;
    await el.updateComplete;
    press(tokenLabels(el)[0], "ArrowLeft");
    await el.updateComplete;
    expect(tokenLabels(el).map((label) => label.tabIndex)).to.deep.equal([
      -1, 0,
    ]);
    press(tokenLabels(el)[1], "ArrowRight");
    await el.updateComplete;
    expect(tokenLabels(el).map((label) => label.tabIndex)).to.deep.equal([
      0, -1,
    ]);
  });

  it("navigates back with plain ArrowLeft, and jumps with Home/End, outside rtl", async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${["a", "b", "c"]}></lr-token-input>`
    )) as LyraTokenInput;
    press(tokenLabels(el)[0], "ArrowRight");
    await el.updateComplete;
    expect(tokenLabels(el).map((label) => label.tabIndex)).to.deep.equal([
      -1, 0, -1,
    ]);

    const back = press(tokenLabels(el)[1], "ArrowLeft");
    await el.updateComplete;
    expect(back.defaultPrevented).to.be.true;
    expect(tokenLabels(el).map((label) => label.tabIndex)).to.deep.equal([
      0, -1, -1,
    ]);
    expect(el.shadowRoot!.activeElement!.textContent).to.equal("a");

    const end = press(tokenLabels(el)[0], "End");
    await el.updateComplete;
    expect(end.defaultPrevented).to.be.true;
    expect(tokenLabels(el).map((label) => label.tabIndex)).to.deep.equal([
      -1, -1, 0,
    ]);
    expect(el.shadowRoot!.activeElement!.textContent).to.equal("c");

    const home = press(tokenLabels(el)[2], "Home");
    await el.updateComplete;
    expect(home.defaultPrevented).to.be.true;
    expect(tokenLabels(el).map((label) => label.tabIndex)).to.deep.equal([
      0, -1, -1,
    ]);
    expect(el.shadowRoot!.activeElement!.textContent).to.equal("a");
  });

  it("removes disabled token labels from focus, exposes state, and restores one roving stop", async () => {
    const el = (await fixture(
      html`<lr-token-input
        editable
        disabled
        .value=${["alpha", "beta"]}
      ></lr-token-input>`
    )) as LyraTokenInput;
    expect(
      tokenLabels(el).map((label) => label.hasAttribute("tabindex"))
    ).to.deep.equal([false, false]);
    expect(
      tokenLabels(el).map((label) => label.getAttribute("aria-disabled"))
    ).to.deep.equal(["true", "true"]);
    tokenLabels(el)[0].focus();
    expect(
      el.shadowRoot!.activeElement?.getAttribute("part") ?? ""
    ).to.not.equal("token-label");
    press(tokenLabels(el)[0], "Enter");
    await el.updateComplete;
    expect(
      editor(el) === null,
      "Enter must not open an editor while disabled"
    ).to.equal(true);
    press(tokenLabels(el)[0], "ArrowRight");
    await el.updateComplete;
    expect(
      tokenLabels(el).map((label) => label.hasAttribute("tabindex"))
    ).to.deep.equal([false, false]);

    el.disabled = false;
    await el.updateComplete;
    expect(tokenLabels(el).map((label) => label.tabIndex)).to.deep.equal([
      0, -1,
    ]);
    expect(
      tokenLabels(el).map((label) => label.getAttribute("aria-disabled"))
    ).to.deep.equal(["false", "false"]);

    tokenLabels(el)[1].focus();
    await el.updateComplete;
    el.disabled = true;
    await el.updateComplete;
    expect(
      el.shadowRoot!.activeElement?.getAttribute("part") ?? ""
    ).to.not.equal("token-label");
    expect(
      tokenLabels(el).map((label) => label.hasAttribute("tabindex"))
    ).to.deep.equal([false, false]);
  });

  it("applies the same token focus contract to live fieldset disablement", async () => {
    const form = (await fixture(html`
      <form>
        <fieldset>
          <lr-token-input editable .value=${["alpha", "beta"]}></lr-token-input>
        </fieldset>
      </form>
    `)) as HTMLFormElement;
    const fieldset = form.querySelector("fieldset") as HTMLFieldSetElement;
    const el = form.querySelector("lr-token-input") as LyraTokenInput;
    tokenLabels(el)[1].focus();
    await el.updateComplete;

    fieldset.disabled = true;
    await el.updateComplete;
    expect(
      tokenLabels(el).map((label) => label.hasAttribute("tabindex"))
    ).to.deep.equal([false, false]);
    expect(
      tokenLabels(el).map((label) => label.getAttribute("aria-disabled"))
    ).to.deep.equal(["true", "true"]);
    expect(
      el.shadowRoot!.activeElement?.getAttribute("part") ?? ""
    ).to.not.equal("token-label");

    fieldset.disabled = false;
    await el.updateComplete;
    expect(tokenLabels(el).map((label) => label.tabIndex)).to.deep.equal([
      -1, 0,
    ]);
    expect(
      tokenLabels(el).map((label) => label.getAttribute("aria-disabled"))
    ).to.deep.equal(["false", "false"]);
  });

  it("does not paint enabled hover feedback on a disabled editable token", async () => {
    const el = (await fixture(html`
      <lr-token-input
        editable
        style="--lr-token-input-action-hover-bg: rgb(1, 2, 3)"
        .value=${["alpha"]}
      ></lr-token-input>
    `)) as LyraTokenInput;
    const label = tokenLabels(el)[0];
    const rect = label.getBoundingClientRect();
    try {
      await sendMouse({
        type: "move",
        position: [
          Math.round(rect.left + rect.width / 2),
          Math.round(rect.top + rect.height / 2),
        ],
      });
      expect(getComputedStyle(label).backgroundColor).to.equal("rgb(1, 2, 3)");

      el.disabled = true;
      await el.updateComplete;
      expect(getComputedStyle(label).backgroundColor).to.equal(
        "rgba(0, 0, 0, 0)"
      );
    } finally {
      await resetMouse();
    }
  });

  it("themes edit and remove hover/pressed surfaces independently", async function () {
    // Four live pointer surfaces require several Playwright browser-command round-trips. Keep
    // their full-sweep contention budget scoped to this rendered contract.
    this.timeout(15_000);
    const el = (await fixture(html`
      <lr-token-input
        editable
        style="
          --lr-token-input-edit-hover-bg: rgb(1, 2, 3);
          --lr-token-input-edit-pressed-bg: rgb(4, 5, 6);
          --lr-token-input-remove-hover-bg: rgb(7, 8, 9);
          --lr-token-input-remove-pressed-bg: rgb(10, 11, 12);
        "
        .value=${["alpha"]}
      ></lr-token-input>
    `)) as LyraTokenInput;
    const label = tokenLabels(el)[0];
    let remove = el.shadowRoot!.querySelector('[part="remove"]') as HTMLElement;
    const center = (target: HTMLElement): [number, number] => {
      const rect = target.getBoundingClientRect();
      return [
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.top + rect.height / 2),
      ];
    };
    try {
      await sendMouse({ type: "move", position: center(label) });
      // A remote mouse command completing is not a paint barrier in Firefox. Poll each live
      // pseudo-class surface while its pointer state is still held instead of snapshotting once.
      await waitUntil(
        () => getComputedStyle(label).backgroundColor === "rgb(1, 2, 3)",
        "the edit hover surface never painted"
      );
      await sendMouse({ type: "down" });
      await waitUntil(
        () => getComputedStyle(label).backgroundColor === "rgb(4, 5, 6)",
        "the edit pressed surface never painted"
      );
      await sendMouse({ type: "move", position: [0, 0] });
      await sendMouse({ type: "up" });

      await el.updateComplete;
      const openedEditor = editor(el);
      if (openedEditor) {
        press(openedEditor, "Escape");
        await el.updateComplete;
      }
      remove = el.shadowRoot!.querySelector('[part="remove"]') as HTMLElement;
      await sendMouse({ type: "move", position: center(remove) });
      await waitUntil(
        () => getComputedStyle(remove).backgroundColor === "rgb(7, 8, 9)",
        "the remove hover surface never painted"
      );
      await sendMouse({ type: "down" });
      await waitUntil(
        () => getComputedStyle(remove).backgroundColor === "rgb(10, 11, 12)",
        "the remove pressed surface never painted"
      );
      await sendMouse({ type: "up" });
    } finally {
      await resetMouse();
    }
  });

  it("closes an open editor and discards its draft when a different token is removed out from under it", async () => {
    const el = (await fixture(
      html`<lr-token-input
        editable
        .value=${["alpha", "beta", "gamma"]}
      ></lr-token-input>`
    )) as LyraTokenInput;
    tokenLabels(el)[1].click(); // open the editor on 'beta'
    await el.updateComplete;
    typeInto(editor(el)!, "uncommitted-edit");
    const removeButtons = el.shadowRoot!.querySelectorAll('[part="remove"]');
    (removeButtons[0] as HTMLButtonElement).click(); // remove 'alpha' while 'beta' is mid-edit
    await el.updateComplete;
    expect(
      el.value,
      "alpha is removed and beta's uncommitted edit is discarded rather than committed against a stale index"
    ).to.deep.equal(["beta", "gamma"]);
    expect(
      editor(el) === null,
      "the editor must close rather than keep editing a reindexed token"
    ).to.equal(true);
  });

  it("is a no-op when Escape is pressed twice on the same already-closing editor", async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${["alpha"]}></lr-token-input>`
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    const field = editor(el)!;
    press(field, "Escape"); // closes the editor (state updates synchronously; DOM not yet re-rendered)
    const second = press(field, "Escape"); // same stale node; cancelEdit() is already a no-op
    await el.updateComplete;
    expect(
      second.defaultPrevented,
      "Escape is still consumed even once the editor state is already closed"
    ).to.be.true;
    expect(el.value).to.deep.equal(["alpha"]);
    expect(editor(el) === null).to.equal(true);
    expect(el.shadowRoot!.activeElement!.getAttribute("part")).to.equal(
      "token-label"
    );
  });

  it("ignores a stale click on a token label whose index no longer exists after a synchronous removal", async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${["alpha"]}></lr-token-input>`
    )) as LyraTokenInput;
    const label = tokenLabels(el)[0];
    const removeBtn = el.shadowRoot!.querySelector(
      '[part="remove"]'
    ) as HTMLButtonElement;
    removeBtn.click(); // synchronously empties `value`; Lit has not yet re-rendered the stale `label` out
    label.click(); // stale DOM node still bound to index 0, now out of range
    await el.updateComplete;
    expect(el.value, "the token stays removed").to.deep.equal([]);
    expect(
      editor(el) === null,
      "an out-of-range stale click must not open an editor"
    ).to.equal(true);
  });

  it("ignores a stale arrow-key press on a token label removed via a synchronous update", async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${["alpha"]}></lr-token-input>`
    )) as LyraTokenInput;
    const label = tokenLabels(el)[0];
    el.value = []; // synchronous mutation; the stale `label` node is still live in the shadow DOM
    press(label, "ArrowRight"); // must not throw or resurrect a roving index into an empty list
    await el.updateComplete;
    expect(el.value).to.deep.equal([]);
    expect(tokenLabels(el).length, "no tokens left to roam").to.equal(0);
  });

  it("does not remove the last token when Backspace is pressed inside an open editor", async () => {
    const el = (await fixture(
      html`<lr-token-input
        editable
        .value=${["alpha", "beta"]}
      ></lr-token-input>`
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    typeInto(editor(el)!, "");
    press(editor(el)!, "Backspace");
    await el.updateComplete;
    expect(el.value).to.deep.equal(["alpha", "beta"]);
  });

  it("keeps focus() and the validity anchor on the main input while an editor is open", async () => {
    const el = (await fixture(
      html`<lr-token-input
        editable
        required
        .value=${["alpha"]}
      ></lr-token-input>`
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    expect(editor(el) != null).to.equal(true);
    typeInto(editor(el)!, "beta");
    el.focus();
    expect(
      el.shadowRoot!.activeElement!.id,
      "focus() must reach the main input, not the editor"
    ).to.equal("input");
    await el.updateComplete;
    // A blur commit applies the edit but must not pull focus back onto the token.
    expect(el.value).to.deep.equal(["beta"]);
    expect(el.shadowRoot!.activeElement!.id).to.equal("input");
  });

  it("does not open an editor while disabled", async () => {
    const el = (await fixture(
      html`<lr-token-input
        editable
        disabled
        .value=${["alpha"]}
      ></lr-token-input>`
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    expect(editor(el) === null).to.equal(true);
  });

  it('discards a stale keyboard commit whose Enter lands in the same task disablement starts', async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${['alpha']}></lr-token-input>`
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    const field = editor(el)!;
    typeInto(field, 'beta');
    let emitted = 0;
    for (const name of ['input', 'change', 'lr-token-edit'])
      el.addEventListener(name, () => emitted++);

    // Synchronous disablement; the stale editor is still rendered until the next Lit update.
    el.disabled = true;
    press(field, 'Enter');
    expect(
      el.value,
      'a same-task disabled Enter must not commit the edit'
    ).to.deep.equal(['alpha']);
    expect(emitted).to.equal(0);
  });

  it('contains a stale native focus on the token editor in the same task that disablement starts', async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${['alpha']}></lr-token-input>`
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    const field = editor(el)!;
    let hostFocuses = 0;
    el.addEventListener('focus', () => hostFocuses++);

    el.disabled = true;
    field.dispatchEvent(new FocusEvent('focus', { bubbles: true, composed: true }));
    expect(
      hostFocuses,
      'a same-task disabled editor focus must not relay through the host'
    ).to.equal(0);
  });

  it("localizes the token edit accessible name via .strings", async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${["alpha"]}></lr-token-input>`
    )) as LyraTokenInput;
    expect(tokenLabels(el)[0].getAttribute("aria-label")).to.equal(
      "Edit alpha"
    );
    el.strings = { tokenInputEditWithContext: "Modifier {label}" };
    await el.updateComplete;
    expect(tokenLabels(el)[0].getAttribute("aria-label")).to.equal(
      "Modifier alpha"
    );
  });

  it("is accessible with an open token editor", async () => {
    const el = (await fixture(
      html`<lr-token-input
        editable
        label="Permissions"
        .value=${[RULE, "other"]}
      ></lr-token-input>`
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    expect(
      editor(el) != null,
      "the axe run must cover the open-editor state"
    ).to.equal(true);
    await expect(el).to.be.accessible();
  });
});

describe("delimiter", () => {
  it("inserts a literal comma instead of committing when delimiter is null", async () => {
    const el = (await fixture(
      html`<lr-token-input .delimiter=${null}></lr-token-input>`
    )) as LyraTokenInput;
    const main = el.shadowRoot!.querySelector("#input") as HTMLInputElement;
    typeInto(main, "a,b");
    const comma = press(main, ",");
    expect(
      comma.defaultPrevented,
      "a comma is just a character when delimiter is null"
    ).to.be.false;
    expect(el.value).to.deep.equal([]);
    press(main, "Enter");
    await el.updateComplete;
    expect(el.value, "a null delimiter must not split the draft").to.deep.equal(
      ["a,b"]
    );
  });

  it('maps delimiter="none" and delimiter="" to a null delimiter from an attribute', async () => {
    const el = (await fixture(
      html`<lr-token-input delimiter="none"></lr-token-input>`
    )) as LyraTokenInput;
    expect(el.delimiter).to.equal(null);
    const main = el.shadowRoot!.querySelector("#input") as HTMLInputElement;
    typeInto(main, "a,b");
    press(main, "Enter");
    await el.updateComplete;
    expect(el.value).to.deep.equal(["a,b"]);

    el.setAttribute("delimiter", "");
    expect(
      el.delimiter,
      "an empty delimiter must not explode the draft into characters"
    ).to.equal(null);
    el.setAttribute("delimiter", ";");
    expect(el.delimiter).to.equal(";");
    el.removeAttribute("delimiter");
    expect(
      el.delimiter,
      "removing the attribute restores the default"
    ).to.equal(",");
  });
});

it("colors placeholder text on both editable fields and gives the remove button hover/focus", () => {
  const css = styles.cssText.replace(/"/g, "'").replace(/\s+/g, " ");
  expect(css).to.match(
    /\[part='input'\]::placeholder\s*\{[^}]*color:\s*var\(--lr-color-text-quiet\)/
  );
  expect(css).to.match(
    /\[part='token-editor'\]::placeholder\s*\{[^}]*color:\s*var\(--lr-color-text-quiet\)/
  );
  expect(css).to.match(/\[part='remove'\]:hover\s*\{[^}]*background:/);
  expect(css).to.match(/\[part='remove'\]:focus-visible\s*\{[^}]*outline:/);
});

// -- Degraded-DOM form-association fallback ---------------------------------

describe("ElementInternals fallback", () => {
  /** Mirrors a DOM implementation without form-association support: token edits must still work
   *  and the internals writes must degrade to no-ops instead of throwing. */
  const withoutAttachInternals = async (
    impl: undefined | (() => never),
    assertion: (el: LyraTokenInput) => void | Promise<void>
  ): Promise<void> => {
    const proto = HTMLElement.prototype as unknown as {
      attachInternals?: unknown;
    };
    const original = proto.attachInternals;
    if (impl === undefined) delete proto.attachInternals;
    else proto.attachInternals = impl;
    try {
      const el = (await fixture(
        html`<lr-token-input .value=${["alpha"]}></lr-token-input>`
      )) as LyraTokenInput;
      await el.updateComplete;
      await assertion(el);
    } finally {
      proto.attachInternals = original;
    }
  };

  it("still accepts token changes when attachInternals is missing", async () => {
    await withoutAttachInternals(undefined, async (el) => {
      el.value = ["alpha", "beta"];
      await el.updateComplete;
      expect(el.value).to.deep.equal(["alpha", "beta"]);
    });
  });

  it("still accepts token changes when attachInternals throws", async () => {
    await withoutAttachInternals(
      () => {
        throw new DOMException("unsupported");
      },
      async (el) => {
        el.value = ["gamma"];
        await el.updateComplete;
        expect(el.value).to.deep.equal(["gamma"]);
      }
    );
  });
});

// `CustomStateSet` and the `:state()` selector ship separately from each other and from the rest
// of `ElementInternals` -- these two guards are why the same block passes on WebKit, where a
// missing `CustomStateSet` would otherwise throw on the very first assertion.
const supportsCustomStates = (() => {
  try {
    return typeof CustomStateSet === "function";
  } catch {
    return false;
  }
})();
const supportsStateSelector = (() => {
  try {
    document.createElement("div").matches(":state(x)");
    return true;
  } catch {
    return false;
  }
})();

describe("validity custom states", () => {
  it("publishes required/optional and valid/invalid from the first update", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-token-input required name="tags"></lr-token-input>`
    )) as LyraTokenInput;
    await el.updateComplete;
    expect(el.matches(":state(required)"), "required").to.be.true;
    expect(el.matches(":state(optional)"), "optional").to.be.false;
    expect(el.matches(":state(invalid)"), "invalid").to.be.true;
    expect(el.matches(":state(valid)"), "valid").to.be.false;

    el.value = ["alpha"];
    await el.updateComplete;
    expect(el.matches(":state(valid)"), "valid once a token exists").to.be.true;
    expect(el.matches(":state(invalid)"), "invalid once a token exists").to.be
      .false;

    el.required = false;
    await el.updateComplete;
    expect(el.matches(":state(optional)"), "optional after clearing required")
      .to.be.true;
    expect(el.matches(":state(required)"), "required after clearing required")
      .to.be.false;
  });

  it("keeps user-valid/user-invalid off a pristine control and turns them on at first interaction", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-token-input required name="tags"></lr-token-input>`
    )) as LyraTokenInput;
    await el.updateComplete;
    expect(el.matches(":state(invalid)"), "invalid while pristine").to.be.true;
    expect(el.matches(":state(user-invalid)"), "user-invalid while pristine").to
      .be.false;
    expect(el.matches(":state(user-valid)"), "user-valid while pristine").to.be
      .false;

    const input = el.shadowRoot!.querySelector(
      '[part="input"]'
    ) as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("blur"));
    await el.updateComplete;
    expect(el.matches(":state(user-invalid)"), "user-invalid after blur").to.be
      .true;

    el.value = ["alpha"];
    await el.updateComplete;
    expect(el.matches(":state(user-valid)"), "user-valid once satisfied").to.be
      .true;
    expect(el.matches(":state(user-invalid)"), "user-invalid once satisfied").to
      .be.false;
  });

  it("counts a reportValidity() call as interaction, and a form reset as going pristine again", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const form = (await fixture(
      html`<form><lr-token-input required name="tags"></lr-token-input></form>`
    )) as HTMLFormElement;
    const el = form.querySelector("lr-token-input") as LyraTokenInput;
    await el.updateComplete;
    expect(el.matches(":state(user-invalid)"), "user-invalid before reporting")
      .to.be.false;
    el.reportValidity();
    await el.updateComplete;
    expect(el.matches(":state(user-invalid)"), "user-invalid after reporting")
      .to.be.true;

    form.reset();
    await el.updateComplete;
    expect(el.matches(":state(user-invalid)"), "user-invalid after reset").to.be
      .false;
    expect(el.matches(":state(invalid)"), "invalid after reset").to.be.true;
  });
});

describe("lr-token-input setCustomValidity()", () => {
  it("blocks form submission with a consumer-supplied error, and reports it as validationMessage", async () => {
    const form = (await fixture(html`
      <form><lr-token-input name="tags" label="Tags"></lr-token-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-token-input") as LyraTokenInput;
    await el.updateComplete;
    let submits = 0;
    // Registered before any requestSubmit() below, so a successful submission can never navigate
    // the test page.
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submits += 1;
    });
    expect(el.checkValidity(), "valid before the custom error").to.be.true;

    el.setCustomValidity("That tag is reserved.");
    expect(el.validity.customError).to.be.true;
    expect(el.checkValidity()).to.be.false;
    expect(el.validationMessage).to.equal("That tag is reserved.");
    form.requestSubmit();
    expect(submits, "a custom error blocks submission").to.equal(0);

    el.setCustomValidity("");
    expect(el.validity.customError).to.be.false;
    expect(el.validationMessage).to.equal("");
    form.requestSubmit();
    expect(
      submits,
      "submission is unblocked once the custom error is cleared"
    ).to.equal(1);
  });

  it("keeps a custom error through an intrinsic revalidation", async () => {
    const el = (await fixture(
      html`<lr-token-input required label="Tags"></lr-token-input>`
    )) as LyraTokenInput;
    await el.updateComplete;
    el.setCustomValidity("Rejected by the server.");

    // Adding a token re-runs syncValidity(), the traffic that would otherwise wipe the custom
    // error out on every edit.
    el.value = ["alpha"];
    await el.updateComplete;
    expect(el.validity.valueMissing, "the intrinsic error cleared").to.be.false;
    expect(
      el.validity.customError,
      "the custom error survived the recomputation"
    ).to.be.true;
    expect(el.validationMessage).to.equal("Rejected by the server.");
    expect(el.checkValidity()).to.be.false;
  });

  it("keeps a custom error across a form reset, matching native setCustomValidity semantics", async () => {
    // Native `form.reset()` restores value and pristine-ness but never clears a consumer-set
    // custom error -- only another `setCustomValidity('')` does. This control matches.
    const form = (await fixture(html`
      <form><lr-token-input name="tags" label="Tags"></lr-token-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-token-input") as LyraTokenInput;
    await el.updateComplete;
    el.value = ["alpha"];
    el.setCustomValidity("That list was already submitted.");

    form.reset();
    await el.updateComplete;
    expect(el.value.length, "the reset emptied the token list").to.equal(0);
    expect(el.validity.customError, "the custom error outlives the reset").to.be
      .true;
    expect(el.validationMessage).to.equal("That list was already submitted.");
    expect(el.checkValidity()).to.be.false;
  });

  it("restores the computed validity when cleared, rather than forcing the control valid", async () => {
    const el = (await fixture(
      html`<lr-token-input required label="Tags"></lr-token-input>`
    )) as LyraTokenInput;
    await el.updateComplete;
    expect(el.validity.valueMissing, "required and empty to begin with").to.be
      .true;

    el.setCustomValidity("Rejected by the server.");
    expect(el.validity.customError).to.be.true;

    el.setCustomValidity("");
    expect(el.validity.customError).to.be.false;
    expect(
      el.validity.valueMissing,
      "an empty required control is still missing a value"
    ).to.be.true;
    expect(el.checkValidity(), "clearing must not force the control valid").to
      .be.false;
    expect(
      el.validationMessage.length,
      "the intrinsic message is republished"
    ).to.be.greaterThan(0);
  });

  it("publishes the custom error through the validity custom states", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-token-input label="Tags"></lr-token-input>`
    )) as LyraTokenInput;
    await el.updateComplete;
    expect(el.matches(":state(valid)"), "valid before the custom error").to.be
      .true;

    el.setCustomValidity("Rejected by the server.");
    expect(
      el.matches(":state(invalid)"),
      "invalid synchronously, not on the next Lit update"
    ).to.be.true;
    expect(el.matches(":state(valid)")).to.be.false;
    expect(
      el.matches(":state(user-invalid)"),
      "still pristine until the user has a turn"
    ).to.be.false;

    el.reportValidity();
    expect(
      el.matches(":state(user-invalid)"),
      "a reported validation counts as interaction"
    ).to.be.true;

    el.setCustomValidity("");
    expect(el.matches(":state(valid)")).to.be.true;
    expect(el.matches(":state(user-valid)")).to.be.true;
    expect(el.matches(":state(user-invalid)")).to.be.false;
  });

  it('treats a nullish message the same as clearing the custom error with an empty string', async () => {
    const el = (await fixture(
      html`<lr-token-input label="Tags"></lr-token-input>`
    )) as LyraTokenInput;
    await el.updateComplete;
    el.setCustomValidity("Rejected by the server.");
    expect(el.validity.customError).to.be.true;

    // A caller outside TypeScript's own guarantees may pass no message at all -- the public
    // `setCustomValidity` a consumer actually calls, exactly like the native platform allows.
    (
      el as unknown as { setCustomValidity: (message?: string) => void }
    ).setCustomValidity(undefined);
    expect(
      el.validity.customError,
      "a nullish message must clear the custom error, not throw or set it to the literal string 'undefined'"
    ).to.be.false;
    expect(el.validationMessage).to.equal("");
  });
});

describe("lr-token-input implicit form submission", () => {
  const draftInput = (el: LyraTokenInput): HTMLInputElement =>
    el.shadowRoot!.querySelector("#input") as HTMLInputElement;
  const enterOn = (el: LyraTokenInput, init: KeyboardEventInit = {}) =>
    draftInput(el).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        composed: true,
        cancelable: true,
        ...init,
      })
    );
  async function typeDraft(el: LyraTokenInput, text: string): Promise<void> {
    const input = draftInput(el);
    input.value = text;
    input.dispatchEvent(
      new InputEvent("input", { bubbles: true, composed: true })
    );
    await el.updateComplete;
  }

  it("submits the ancestor form when Enter is pressed with an empty draft", async () => {
    const form = (await fixture(html`
      <form><lr-token-input name="tags" label="Tags"></lr-token-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-token-input") as LyraTokenInput;
    await el.updateComplete;
    let submits = 0;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submits += 1;
    });
    enterOn(el);
    expect(submits).to.equal(1);
  });

  it("commits the draft instead of submitting while there is one to commit", async () => {
    const form = (await fixture(html`
      <form><lr-token-input name="tags" label="Tags"></lr-token-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-token-input") as LyraTokenInput;
    await el.updateComplete;
    let submits = 0;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submits += 1;
    });
    await typeDraft(el, "alpha");
    enterOn(el);
    await el.updateComplete;
    expect(el.value.join(","), "the draft became a token").to.equal("alpha");
    expect(submits, "committing a token is not implicit submission").to.equal(
      0
    );

    // The draft is empty again, so the next Enter is a submission.
    enterOn(el);
    expect(submits).to.equal(1);
  });

  it("submits through an lr-button submitter, which requestSubmit() itself would reject", async () => {
    const form = (await fixture(html`
      <form>
        <lr-token-input name="tags" label="Tags"></lr-token-input>
        <lr-button type="submit" name="action" value="save">Go</lr-button>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-token-input") as LyraTokenInput;
    await el.updateComplete;
    let submits = 0;
    let submitterName = "";
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submits += 1;
      submitterName =
        ((e as SubmitEvent).submitter as HTMLButtonElement | null)?.name ?? "";
    });
    enterOn(el);
    expect(submits).to.equal(1);
    expect(submitterName, "the lr-button was the submitter").to.equal("action");
  });

  it("never submits on a held modifier, during IME composition, or after a veto", async () => {
    const form = (await fixture(html`
      <form><lr-token-input name="tags" label="Tags"></lr-token-input></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-token-input") as LyraTokenInput;
    await el.updateComplete;
    let submits = 0;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submits += 1;
    });
    enterOn(el, { shiftKey: true });
    enterOn(el, { ctrlKey: true });
    enterOn(el, { altKey: true });
    enterOn(el, { metaKey: true });
    enterOn(el, { isComposing: true });
    expect(submits).to.equal(0);

    // Capture on the host runs before the internal input's own listener.
    const veto = (e: Event): void => e.preventDefault();
    el.addEventListener("keydown", veto, true);
    enterOn(el);
    el.removeEventListener("keydown", veto, true);
    expect(submits).to.equal(0);

    enterOn(el);
    expect(submits, "a bare Enter still submits").to.equal(1);
  });
});

it("bars constraint validation while disabled, like a native disabled required control", async () => {
  const el = (await fixture(
    html`<lr-token-input required disabled label="Tags"></lr-token-input>`
  )) as LyraTokenInput;
  await el.updateComplete;
  expect(el.validity.valueMissing, "a barred control raises no violation").to.be
    .false;
  expect(el.checkValidity()).to.be.true;

  el.disabled = false;
  await el.updateComplete;
  expect(
    el.validity.valueMissing,
    "the violation returns once it is enforceable again"
  ).to.be.true;
});

it("renders the required marker from the shared themeable rule, not a literal span", async () => {
  const el = (await fixture(html`
    <lr-token-input required label="Tags"></lr-token-input>
  `)) as LyraTokenInput;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector(
    '[part~="form-control-label"]'
  ) as HTMLElement;
  expect(getComputedStyle(label, "::after").content).to.contain("*");
  expect(
    label.querySelector("span[aria-hidden]") === null,
    "no hand-rolled glyph element"
  ).to.equal(true);

  el.style.setProperty("--lr-form-control-required-content", "''");
  await el.updateComplete;
  expect(getComputedStyle(label, "::after").content).to.not.contain("*");
});

describe("start/end adornment slots", () => {
  const part = (el: LyraTokenInput, name: string) =>
    el.shadowRoot!.querySelector(`[part="${name}"]`) as HTMLElement;

  it("renders a slotted glyph in the start wrapper, before the tokens", async () => {
    const el = (await fixture(html`
      <lr-token-input .value=${["alpha"]}>
        <svg slot="start" width="12" height="12" aria-hidden="true">
          <circle cx="6" cy="6" r="5"></circle>
        </svg>
      </lr-token-input>
    `)) as LyraTokenInput;
    await el.updateComplete;
    const start = part(el, "start");
    expect(start.hasAttribute("hidden")).to.be.false;
    const startRect = start.getBoundingClientRect();
    const tokenRect = (
      el.shadowRoot!.querySelector('[part="token"]') as HTMLElement
    ).getBoundingClientRect();
    expect(startRect.width).to.be.greaterThan(0);
    expect(startRect.right).to.be.at.most(tokenRect.left + 1);
  });

  it("renders the end wrapper after the draft input", async () => {
    const el = (await fixture(html`
      <lr-token-input>
        <kbd slot="end">K</kbd>
      </lr-token-input>
    `)) as LyraTokenInput;
    await el.updateComplete;
    const end = part(el, "end");
    expect(end.hasAttribute("hidden")).to.be.false;
    const input = el.shadowRoot!.querySelector("#input") as HTMLElement;
    expect(
      end.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_PRECEDING
    ).to.be.greaterThan(0);
  });

  it("hides both wrappers when nothing is slotted", async () => {
    const el = (await fixture(
      html`<lr-token-input></lr-token-input>`
    )) as LyraTokenInput;
    await el.updateComplete;
    expect(part(el, "start").hasAttribute("hidden")).to.be.true;
    expect(part(el, "end").hasAttribute("hidden")).to.be.true;
    expect(getComputedStyle(part(el, "start")).display).to.equal("none");
    expect(getComputedStyle(part(el, "end")).display).to.equal("none");
  });

  it("reveals the start wrapper when adornment content is slotted in after first render", async () => {
    const el = (await fixture(
      html`<lr-token-input></lr-token-input>`
    )) as LyraTokenInput;
    expect(part(el, "start").hasAttribute("hidden")).to.be.true;
    const glyph = document.createElement("span");
    glyph.slot = "start";
    glyph.textContent = "*";
    el.append(glyph);
    await el.updateComplete;
    await el.updateComplete;
    expect(part(el, "start").hasAttribute("hidden")).to.be.false;
  });
});
