// Focused native form lifecycle cases. Test bodies and titles were moved intact from the prior suite.
import { fixture, expect, html, oneEvent } from "@open-wc/testing";
import "./radio.js";
import "./radio-button.js";
import "./radio-group.js";
import type { LyraRadio } from "./radio.js";
import type { LyraRadioGroup } from "./radio-group.js";

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

it("emits one cancelable group-owned lr-invalid alias when its aggregate validity fails a check", async () => {
  const group = (await fixture(html`
    <lr-radio-group required label="Choice">
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const radios = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  await Promise.all(radios.map((radio) => radio.updateComplete));
  const aliases: CustomEvent[] = [];
  group.addEventListener("lr-invalid", (event) =>
    aliases.push(event as CustomEvent)
  );
  const natives: Event[] = [];
  group.addEventListener("invalid", (event) => natives.push(event));

  expect(group.checkValidity()).to.be.false;
  expect(aliases).to.have.lengthOf(1);
  const alias = requiredItem(aliases, 0, "group invalid alias");
  expect(alias.target === group).to.equal(true);
  expect(alias.bubbles && alias.composed).to.be.true;
  expect(alias.cancelable).to.be.true;
  // Nothing cancelled it, so the browser's own validation UI stays enabled.
  expect(natives).to.have.lengthOf(1);
  expect(
    requiredItem(natives, 0, "native group invalid event").defaultPrevented
  ).to.be.false;
});

it("cancels the native invalid event when the group-owned lr-invalid alias is cancelled", async () => {
  const group = (await fixture(html`
    <lr-radio-group required label="Choice">
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const radios = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  await Promise.all(radios.map((radio) => radio.updateComplete));
  group.addEventListener("lr-invalid", (event) => event.preventDefault());
  const natives: Event[] = [];
  group.addEventListener("invalid", (event) => natives.push(event));

  expect(group.checkValidity()).to.be.false;
  expect(natives).to.have.lengthOf(1);
  expect(
    requiredItem(natives, 0, "native group invalid event").defaultPrevented
  ).to.be.true;
});

it("accepts an owned radio-shaped invalid target from another realm without instanceof", async () => {
  const group = (await fixture(
    html`<lr-radio-group></lr-radio-group>`
  )) as LyraRadioGroup;
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameDocument = frame.contentDocument;
  const frameWindow = frame.contentWindow;
  if (!frameDocument || !frameWindow) {
    frame.remove();
    throw new Error("The iframe realm was unavailable.");
  }
  const foreignRadio = frameDocument.createElement("lr-radio");
  const internals = group as unknown as {
    ownsRadio(target: Element): boolean;
    onInvalid(event: Event): void;
  };
  const ownsRadio = internals.ownsRadio.bind(group);
  internals.ownsRadio = (target) => target === foreignRadio;
  const invalid = new frameWindow.Event("invalid", { cancelable: true });
  Object.defineProperty(invalid, "target", {
    configurable: true,
    value: foreignRadio,
  });
  let aliases = 0;
  group.addEventListener("lr-invalid", () => {
    aliases += 1;
  });

  try {
    internals.onInvalid(invalid);
    expect(aliases).to.equal(1);
  } finally {
    internals.ownsRadio = ownsRadio;
    frame.remove();
  }
});

it("restores the declarative default-checked state on form reset", async () => {
  const form = (await fixture(html`
    <form>
      <lr-radio name="choice" value="a" checked>A</lr-radio>
      <lr-radio name="choice" value="b">B</lr-radio>
    </form>
  `)) as HTMLFormElement;
  const [a, b] = [...form.querySelectorAll("lr-radio")] as LyraRadio[];
  if (!a || !b) throw new Error("Expected both reset radios.");
  expect(a.checked).to.be.true;

  b.checked = true;
  a.checked = false;
  expect(a.checked).to.be.false;
  expect(b.checked).to.be.true;

  form.reset();
  expect(a.checked, "a restores its declarative checked default").to.be.true;
  expect(b.checked, "b restores its (unchecked) declarative default").to.be
    .false;
});

it("exposes native form validity/focus APIs and restores serialized checked state", async () => {
  const form = (await fixture(html`
    <form><lr-radio name="choice" value="a" required>A</lr-radio></form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-radio") as LyraRadio;

  expect(el.form === form).to.equal(true);
  expect(el.validity.valueMissing).to.be.true;
  expect(el.validationMessage).to.equal("Please select an option.");
  expect(el.willValidate).to.be.true;

  el.formStateRestoreCallback("checked", "restore");
  await el.updateComplete;
  expect(el.checked).to.be.true;
  expect(el.validity.valid).to.be.true;
  expect(new FormData(form).get("choice")).to.equal("a");

  el.focus({ preventScroll: true });
  expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal("base");
  el.blur();
  expect(el.shadowRoot!.activeElement === null).to.equal(true);

  el.formStateRestoreCallback("unchecked", "autocomplete");
  expect(el.checked).to.be.false;
});

it("temporarily disables a bare radio through an ancestor fieldset without overwriting the author disabled state", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-radio value="a">A</lr-radio>
        <lr-radio value="b" disabled>B</lr-radio>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const [a, b] = [...form.querySelectorAll("lr-radio")] as LyraRadio[];
  if (!a || !b) throw new Error("Expected both fieldset radios.");
  const fieldset = form.querySelector("fieldset") as HTMLFieldSetElement;

  expect(a.effectiveDisabled).to.be.false;
  expect(b.disabled).to.be.true;

  // No `await` before these assertions: `formDisabledCallback` fires
  // synchronously when the fieldset's `disabled` property is set.
  fieldset.disabled = true;
  expect(a.effectiveDisabled, "an ancestor fieldset must reach a bare lr-radio")
    .to.be.true;
  expect(
    a.disabled,
    "fieldset state must never mutate the public disabled property"
  ).to.be.false;
  expect(
    a.hasAttribute("disabled"),
    "the host attribute must not be mutated either"
  ).to.be.false;
  expect(b.disabled, "an already-explicitly-disabled radio is unaffected").to.be
    .true;
  expect(b.effectiveDisabled).to.be.true;

  const aBase = a.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  let delegatedCalls = 0;
  aBase.click = () => {
    delegatedCalls += 1;
  };
  aBase.focus = () => {
    delegatedCalls += 1;
  };
  a.click();
  a.focus();
  expect(
    delegatedCalls,
    "fieldset disablement gates host click/focus delegation"
  ).to.equal(0);

  fieldset.disabled = false;
  expect(
    a.effectiveDisabled,
    "must not be permanently stuck disabled once the fieldset re-enables"
  ).to.be.false;
  expect(a.disabled).to.be.false;
  expect(b.disabled, "an explicit disabled state survives the fieldset cycle")
    .to.be.true;
  expect(b.effectiveDisabled).to.be.true;

  await Promise.all([a.updateComplete, b.updateComplete]);
  expect(aBase.getAttribute("aria-disabled")).to.equal("false");
  expect(aBase.getAttribute("tabindex")).to.equal("0");
});

it("cascades fieldset-disabled state down to radios nested inside a lr-radio-group", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-radio-group label="Choice">
          <lr-radio value="a">A</lr-radio>
          <lr-radio value="b">B</lr-radio>
        </lr-radio-group>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const group = form.querySelector("lr-radio-group") as LyraRadioGroup;
  const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  if (!a || !b) throw new Error("Expected both nested fieldset radios.");
  const fieldset = form.querySelector("fieldset") as HTMLFieldSetElement;
  await group.updateComplete;

  expect(a.effectiveDisabled).to.be.false;
  expect(b.effectiveDisabled).to.be.false;

  fieldset.disabled = true;
  expect(
    a.effectiveDisabled,
    "fieldset state must reach radios nested inside a radio-group"
  ).to.be.true;
  expect(b.effectiveDisabled).to.be.true;
  expect(
    a.disabled,
    "fieldset state must never mutate the public disabled property"
  ).to.be.false;

  fieldset.disabled = false;
  expect(a.effectiveDisabled).to.be.false;
  expect(b.effectiveDisabled).to.be.false;
});

it("treats required as a group constraint that becomes valid when any owned radio is selected", async () => {
  const form = (await fixture(html`
    <form>
      <lr-radio-group name="choice" label="Choice" required>
        <lr-radio value="a">A</lr-radio>
        <lr-radio value="b">B</lr-radio>
      </lr-radio-group>
    </form>
  `)) as HTMLFormElement;
  const group = form.querySelector("lr-radio-group") as LyraRadioGroup;
  const radios = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  const base = group.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  expect(base.getAttribute("aria-required")).to.equal("true");
  expect(form.checkValidity(), "an empty required group is invalid").to.be
    .false;

  const second = requiredItem(radios, 1, "second required-group radio");
  second.click();
  expect(second.checked).to.be.true;
  expect(form.checkValidity(), "one checked option satisfies the whole group")
    .to.be.true;
  expect(radios.every((radio) => radio.validity.valid)).to.be.true;
});

describe("aggregate form ownership", () => {
  it("makes the group the only submitting FACE control while standalone radios still submit", async () => {
    const form = (await fixture(html`
      <form>
        <label for="choice">Choice</label>
        <lr-radio-group id="choice" name="choice" value="b">
          <lr-radio value="a">A</lr-radio>
          <lr-radio value="b">B</lr-radio>
        </lr-radio-group>
        <lr-radio name="standalone" value="yes" checked>Standalone</lr-radio>
      </form>
    `)) as HTMLFormElement;
    const group = form.querySelector("lr-radio-group") as LyraRadioGroup;
    const radios = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    await group.updateComplete;

    expect(group.form === form).to.be.true;
    expect(group.getForm() === form).to.be.true;
    expect(group.labels.length).to.equal(1);
    expect([...form.elements].includes(group)).to.be.true;
    expect(group.value).to.equal("b");
    expect(radios.map((radio) => radio.checked)).to.deep.equal([false, true]);
    expect(
      new FormData(form).getAll("choice"),
      "owned radios must not duplicate the group entry"
    ).to.deep.equal(["b"]);
    expect(new FormData(form).getAll("standalone")).to.deep.equal(["yes"]);
  });

  it("submits through a writable external form owner", async () => {
    const root = await fixture(html`
      <div>
        <form id="external-radio-owner"></form>
        <lr-radio-group name="choice" value="a">
          <lr-radio value="a">A</lr-radio>
        </lr-radio-group>
      </div>
    `);
    const form = root.querySelector("form") as HTMLFormElement;
    const group = root.querySelector("lr-radio-group") as LyraRadioGroup;

    group.form = "external-radio-owner";

    expect(group.form === form).to.be.true;
    expect(group.getForm() === form).to.be.true;
    expect(new FormData(form).getAll("choice")).to.deep.equal(["a"]);
  });

  it("owns required and custom validity without leaving an invalid child control", async () => {
    const form = (await fixture(html`
      <form>
        <lr-radio-group name="choice" required>
          <lr-radio value="a">A</lr-radio>
          <lr-radio value="b">B</lr-radio>
        </lr-radio-group>
      </form>
    `)) as HTMLFormElement;
    const group = form.querySelector("lr-radio-group") as LyraRadioGroup;
    const radios = [...group.querySelectorAll("lr-radio")] as LyraRadio[];

    expect(group.validity.valueMissing).to.be.true;
    expect(
      radios.every((radio) => radio.validity.valid),
      "children are not aggregate proxies"
    ).to.be.true;
    expect(form.checkValidity()).to.be.false;

    group.value = "b";
    expect(group.validity.valid).to.be.true;
    expect(form.checkValidity()).to.be.true;

    group.setCustomValidity("Unavailable choice");
    expect(group.validity.customError).to.be.true;
    expect(group.validationMessage).to.equal("Unavailable choice");
    expect(form.checkValidity()).to.be.false;
    group.resetValidity();
    expect(group.validity.valid).to.be.true;

    group.setCustomValidity("Unavailable again");
    group.setCustomValidity();
    expect(
      group.validity.valid,
      "the published empty-message default also clears custom validity"
    ).to.be.true;
  });

  it("resets to the current child defaults and restores early state silently", async () => {
    const group = document.createElement("lr-radio-group") as LyraRadioGroup;
    group.name = "choice";
    const restored: string[] = [];
    group.addEventListener("change", () => restored.push("change"));
    group.formStateRestoreCallback("b", "restore");
    group.innerHTML = `
      <lr-radio value="a" checked>A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    `;
    const form = document.createElement("form");
    form.append(group);
    document.body.append(form);
    try {
      await group.updateComplete;
      await new Promise((resolve) => setTimeout(resolve, 0));
      await group.updateComplete;
      const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
      if (!a || !b) throw new Error("Expected both early-restoration radios.");
      expect(group.value).to.equal("b");
      expect([a.checked, b.checked]).to.deep.equal([false, true]);
      expect(restored).to.deep.equal([]);

      a.defaultChecked = false;
      b.defaultChecked = true;
      group.value = "a";
      form.reset();
      expect(group.value).to.equal("b");
      expect([a.checked, b.checked]).to.deep.equal([false, true]);
      expect(new FormData(form).getAll("choice")).to.deep.equal(["b"]);
    } finally {
      form.remove();
    }
  });
});

it("normalizes declarative, programmatic, restored, and reset state to one checked radio", async () => {
  const form = (await fixture(html`
    <form>
      <lr-radio-group name="choice">
        <lr-radio value="a" checked>A</lr-radio>
        <lr-radio value="b" checked>B</lr-radio>
      </lr-radio-group>
    </form>
  `)) as HTMLFormElement;
  const group = form.querySelector("lr-radio-group") as LyraRadioGroup;
  const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  if (!a || !b) throw new Error("Expected both normalization radios.");
  await group.updateComplete;

  expect(
    [a, b].filter((radio) => radio.checked).length,
    "declarative state"
  ).to.equal(1);

  a.checked = true;
  expect(a.checked, "the latest programmatic selection wins").to.be.true;
  expect(b.checked).to.be.false;

  group.formStateRestoreCallback("b", "restore");
  expect(a.checked).to.be.false;
  expect(b.checked, "restored state is normalized through the owner").to.be
    .true;

  form.reset();
  expect(
    [a, b].filter((radio) => radio.checked).length,
    "reset state"
  ).to.equal(1);
});

it("does not move or select from keyboard while the group or fieldset is disabled", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-radio-group label="Choice">
          <lr-radio value="a" checked>A</lr-radio>
          <lr-radio value="b">B</lr-radio>
        </lr-radio-group>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const group = form.querySelector("lr-radio-group") as LyraRadioGroup;
  const fieldset = form.querySelector("fieldset") as HTMLFieldSetElement;
  const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
  if (!a || !b) throw new Error("Expected both disabled-navigation radios.");
  a.checked = true;

  group.disabled = true;
  await group.updateComplete;
  a.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      composed: true,
    })
  );
  expect(a.checked).to.be.true;
  expect(b.checked).to.be.false;

  group.disabled = false;
  fieldset.disabled = true;
  await group.updateComplete;
  await Promise.all([a.updateComplete, b.updateComplete]);
  expect(
    a.effectiveDisabled && b.effectiveDisabled,
    "group fieldset state reaches every option"
  ).to.be.true;
  expect(
    a.shadowRoot!.querySelector('[part~="base"]')!.getAttribute("aria-disabled")
  ).to.equal("true");
  a.dispatchEvent(
    new KeyboardEvent("keydown", { key: "End", bubbles: true, composed: true })
  );
  expect(a.checked).to.be.true;
  expect(b.checked).to.be.false;
});

describe("lifecycle: attachInternals guard", () => {
  it("degrades gracefully instead of throwing when ElementInternals is unavailable", async () => {
    const original = (globalThis as { ElementInternals?: unknown })
      .ElementInternals;
    // Deliberately simulating an environment (e.g. happy-dom) with no ElementInternals
    // implementation at all.
    delete (globalThis as { ElementInternals?: unknown }).ElementInternals;
    try {
      expect(() => document.createElement("lr-radio")).to.not.throw();
      const el = (await fixture(
        html`<lr-radio value="a">A</lr-radio>`
      )) as LyraRadio;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="base"]').length).to.equal(
        1
      );
      expect(() => el.click()).to.not.throw();
    } finally {
      (globalThis as { ElementInternals?: unknown }).ElementInternals =
        original;
    }
  });

  it("degrades gracefully instead of throwing when the native attachInternals() call itself throws", async () => {
    // Scoped to just this tag -- default lyra-radio fixtures render no other
    // form-associated shadow children, but scope defensively anyway.
    const original = HTMLElement.prototype.attachInternals;
    HTMLElement.prototype.attachInternals = function (this: HTMLElement) {
      if (this.tagName.toLowerCase() === "lr-radio") {
        throw new DOMException(
          "attachInternals is not supported",
          "NotSupportedError"
        );
      }
      return original.call(this);
    };
    try {
      expect(() => document.createElement("lr-radio")).to.not.throw();
      const el = (await fixture(
        html`<lr-radio value="a">A</lr-radio>`
      )) as LyraRadio;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="base"]').length).to.equal(
        1
      );
      expect(() => el.click()).to.not.throw();
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

// -- Degraded-DOM form-association fallback ---------------------------------
describe("inert ElementInternals fallback", () => {
  // Form-association support is determined by attachInternals(), not the global constructor.
  const withGlobalRemoved = async (
    assertion: (el: LyraRadio) => void
  ): Promise<void> => {
    const scope = globalThis as { ElementInternals?: unknown };
    const original = scope.ElementInternals;
    delete scope.ElementInternals;
    try {
      const el = (await fixture(
        html`<lr-radio value="a">A</lr-radio>`
      )) as LyraRadio;
      await el.updateComplete;
      assertion(el);
    } finally {
      scope.ElementInternals = original;
    }
  };

  it("retains native form support when only the ElementInternals global is absent", async () => {
    await withGlobalRemoved((el) => {
      expect(el.willValidate).to.be.true;
      expect(el.checkValidity()).to.be.true;
      el.setCustomValidity("Choose another option");
      expect(el.validity.customError).to.be.true;
      expect(el.validationMessage).to.equal("Choose another option");
      expect(el.checkValidity()).to.be.false;
      el.setCustomValidity("");
      expect(el.checkValidity()).to.be.true;
    });
  });

  it("falls back when attachInternals throws", async () => {
    const proto = HTMLElement.prototype as unknown as {
      attachInternals?: unknown;
    };
    const original = proto.attachInternals;
    proto.attachInternals = () => {
      throw new DOMException("unsupported");
    };
    try {
      const el = (await fixture(
        html`<lr-radio value="a">A</lr-radio>`
      )) as LyraRadio;
      await el.updateComplete;
      const internals = (el as unknown as { internals: ElementInternals })
        .internals;
      expect(internals.checkValidity()).to.be.true;
      expect(internals.reportValidity()).to.be.true;
    } finally {
      proto.attachInternals = original;
    }
  });
});

describe("lr-radio validity custom states", () => {
  it("publishes required/optional and valid/invalid from the first render", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-radio required value="a">One</lr-radio>`
    )) as LyraRadio;
    await el.updateComplete;
    expect(el.matches(":state(required)"), "required").to.be.true;
    expect(el.matches(":state(optional)"), "optional").to.be.false;
    expect(el.matches(":state(invalid)"), "invalid").to.be.true;
    expect(el.matches(":state(valid)"), "valid").to.be.false;

    const optional = (await fixture(
      html`<lr-radio value="a">One</lr-radio>`
    )) as LyraRadio;
    await optional.updateComplete;
    expect(optional.matches(":state(optional)")).to.be.true;
    expect(optional.matches(":state(valid)")).to.be.true;
  });

  it("reads an owning required group as required, not just its own attribute", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const group = (await fixture(html`
      <lr-radio-group required name="pick" label="Pick">
        <lr-radio value="a">One</lr-radio>
        <lr-radio value="b">Two</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    const first = group.querySelector("lr-radio") as LyraRadio;
    expect(first.hasAttribute("required"), "no attribute of its own").to.be
      .false;
    expect(first.matches(":state(required)"), "required through the group").to
      .be.true;
    expect(first.matches(":state(optional)")).to.be.false;
  });

  it("withholds user-valid/user-invalid until the user has actually interacted", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-radio required value="a">One</lr-radio>`
    )) as LyraRadio;
    await el.updateComplete;
    expect(
      el.matches(":state(user-invalid)"),
      "pristine required must not read as an error"
    ).to.be.false;
    expect(el.matches(":state(user-valid)")).to.be.false;

    el.click();
    await el.updateComplete;
    expect(el.checked).to.be.true;
    expect(el.matches(":state(valid)")).to.be.true;
    expect(
      el.matches(":state(user-valid)"),
      "user-valid after a real selection"
    ).to.be.true;
  });

  it("marks a required standalone radio user-invalid when reportValidity runs", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-radio required value="a">One</lr-radio>`
    )) as LyraRadio;
    await el.updateComplete;
    expect(el.matches(":state(user-invalid)"), "pristine before reporting").to
      .be.false;

    expect(el.reportValidity()).to.be.false;
    await el.updateComplete;
    expect(
      el.matches(":state(user-invalid)"),
      "a validity report is user interaction"
    ).to.be.true;
  });

  it("does not turn a disabled blur into user interaction for either radio rendering", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        <lr-radio required value="standard">Standard</lr-radio>
        <lr-radio-button required value="button">Button</lr-radio-button>
      </div>
    `);
    const radios = Array.from(
      wrapper.querySelectorAll("lr-radio, lr-radio-button")
    ) as LyraRadio[];

    for (const radio of radios) {
      const base = radio.shadowRoot!.querySelector(
        '[part~="base"]'
      ) as HTMLElement;
      radio.disabled = true;
      base.dispatchEvent(new FocusEvent("blur"));
      radio.disabled = false;
      await radio.updateComplete;
      expect(
        radio.matches(":state(user-invalid)"),
        `${radio.localName} stays pristine`
      ).to.be.false;
    }
  });

  it("goes pristine again after a form reset", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const form = await fixture<HTMLFormElement>(
      html`<form><lr-radio name="pick" required value="a">One</lr-radio></form>`
    );
    const el = form.querySelector("lr-radio") as LyraRadio;
    await el.updateComplete;
    el.click();
    await el.updateComplete;
    expect(el.matches(":state(user-valid)")).to.be.true;
    form.reset();
    await el.updateComplete;
    expect(
      el.matches(":state(user-valid)"),
      "reset returns the control to pristine"
    ).to.be.false;
    expect(el.matches(":state(user-invalid)")).to.be.false;
    expect(
      el.matches(":state(invalid)"),
      "unchecked again, so intrinsically invalid"
    ).to.be.true;
  });
});

describe("lr-radio setCustomValidity()", () => {
  it("blocks form submission and becomes the validationMessage", async () => {
    const form = (await fixture(html`
      <form><lr-radio name="plan" value="pro" checked>Pro</lr-radio></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-radio") as LyraRadio;
    let submits = 0;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submits += 1;
    });

    form.requestSubmit();
    expect(submits, "an otherwise-valid radio submits").to.equal(1);

    el.setCustomValidity("That plan is no longer available");
    expect(el.validationMessage).to.equal("That plan is no longer available");
    expect(el.validity.customError, "customError").to.be.true;
    expect(el.checkValidity()).to.be.false;

    form.requestSubmit();
    expect(submits, "a custom error blocks submission").to.equal(1);
  });

  it("survives an intrinsic revalidation", async () => {
    const el = (await fixture(
      html`<lr-radio required value="pro">Pro</lr-radio>`
    )) as LyraRadio;
    el.setCustomValidity("Server says no");
    el.checked = true; // clears valueMissing and re-runs the intrinsic recompute
    expect(el.validity.valueMissing, "valueMissing cleared").to.be.false;
    expect(el.validity.customError, "custom error survives the recompute").to.be
      .true;
    expect(el.validationMessage).to.equal("Server says no");
  });

  // Native `setCustomValidity()` is sticky: `form.reset()` restores values, never the custom
  // error, which only another `setCustomValidity('')` clears. Matching that here.
  it("keeps the custom error across a form reset", async () => {
    const form = (await fixture(html`
      <form><lr-radio name="plan" value="pro">Pro</lr-radio></form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-radio") as LyraRadio;
    el.setCustomValidity("Server says no");
    form.reset();
    await el.updateComplete;
    expect(el.validity.customError).to.be.true;
    expect(el.validationMessage).to.equal("Server says no");
  });

  it("resetValidity() restores computed validity rather than forcing the control valid", async () => {
    const el = (await fixture(
      html`<lr-radio required value="pro">Pro</lr-radio>`
    )) as LyraRadio;
    el.setCustomValidity("Server says no");
    el.resetValidity();
    expect(el.validity.customError, "custom error cleared").to.be.false;
    expect(
      el.validity.valueMissing,
      "an empty custom error must not force a still-unchecked required control valid"
    ).to.be.true;
    expect(el.checkValidity()).to.be.false;
    expect(el.validationMessage).to.not.equal("");
    el.checked = true;
    expect(el.checkValidity()).to.be.true;
  });

  it("drives the valid/invalid custom states", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(
      html`<lr-radio value="pro">Pro</lr-radio>`
    )) as LyraRadio;
    await el.updateComplete;
    expect(el.matches(":state(valid)"), "valid before").to.be.true;
    el.setCustomValidity("Server says no");
    expect(el.matches(":state(invalid)"), "invalid while a custom error is set")
      .to.be.true;
    expect(el.matches(":state(valid)")).to.be.false;
    el.setCustomValidity("");
    expect(el.matches(":state(valid)"), "valid again once cleared").to.be.true;
  });

  it("routes custom validity through the aggregate group owner", async () => {
    const group = (await fixture(html`
      <lr-radio-group name="plan" label="Plan">
        <lr-radio value="pro">Pro</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const radio = group.querySelector("lr-radio") as LyraRadio & {
      customError: string | null;
    };
    radio.customError = "Server says no";
    expect(group.validity.customError).to.be.true;
    expect(radio.validity.valid).to.be.true;
    expect(radio.customError).to.equal("Server says no");
    radio.customError = null;
    expect(group.validity.valid).to.be.true;
  });

  it("transfers a standalone custom error when a radio becomes group-owned", async () => {
    const form = (await fixture(html`
      <form><lr-radio-group name="plan" label="Plan"></lr-radio-group></form>
    `)) as HTMLFormElement;
    const group = form.querySelector("lr-radio-group") as LyraRadioGroup;
    const radio = document.createElement("lr-radio") as LyraRadio;
    radio.value = "pro";
    radio.checked = true;
    radio.setCustomValidity("Server says no");

    group.append(radio);
    await Promise.all([group.updateComplete, radio.updateComplete]);

    expect(
      radio.validity.valid,
      "the owned child no longer participates in validity"
    ).to.be.true;
    expect(
      group.validity.customError,
      "the aggregate owner retains the rejection"
    ).to.be.true;
    expect(group.validationMessage).to.equal("Server says no");
    expect(form.checkValidity()).to.be.false;
  });
});

it("exposes the group willValidate flag and reports validity on demand", async () => {
  const form = (await fixture(html`
    <form>
      <lr-radio-group name="choice" required label="Choice">
        <lr-radio value="a">A</lr-radio>
        <lr-radio value="b">B</lr-radio>
      </lr-radio-group>
    </form>
  `)) as HTMLFormElement;
  const group = form.querySelector("lr-radio-group") as LyraRadioGroup;
  await group.updateComplete;
  expect(group.willValidate).to.equal(true);
  expect(group.checkValidity()).to.equal(false);
  expect(group.reportValidity()).to.equal(false);
  await group.updateComplete;
  expect(group.matches(":state(user-invalid)")).to.equal(true);

  group.value = "a";
  await group.updateComplete;
  expect(group.reportValidity()).to.equal(true);
});

it("marks the group user-invalid from a blocked native submission attempt, but never from a bare checkValidity() call", async function () {
  if (!supportsCustomStates || !supportsStateSelector) this.skip();
  const form = (await fixture(html`
    <form>
      <lr-radio-group name="choice" required label="Choice">
        <lr-radio value="a">A</lr-radio>
        <lr-radio value="b">B</lr-radio>
      </lr-radio-group>
      <button type="submit">Go</button>
    </form>
  `)) as HTMLFormElement;
  // Defensive only: a truly invalid required group never reaches the `submit` event at all -- the
  // platform's interactive validation aborts submission before it is dispatched.
  form.addEventListener("submit", (event) => event.preventDefault());
  const group = form.querySelector("lr-radio-group") as LyraRadioGroup;
  await group.updateComplete;

  expect(group.checkValidity(), "checkValidity() itself").to.be.false;
  expect(
    group.matches(":state(user-invalid)"),
    "a silent checkValidity() must not mark interaction, however invalid the group already is"
  ).to.be.false;

  (form.querySelector("button") as HTMLButtonElement).click();
  await group.updateComplete;
  expect(
    group.matches(":state(user-invalid)"),
    "a blocked submission attempt counts as interaction, even though it never calls reportValidity()"
  ).to.be.true;
});

it("bars the group from constraint validation while disabled, like a native disabled control", async () => {
  const group = (await fixture(html`
    <lr-radio-group required disabled label="Choice">
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  await group.updateComplete;
  expect(group.validity.valueMissing, "a barred group raises no violation").to
    .be.false;
  expect(group.checkValidity()).to.be.true;

  group.disabled = false;
  await group.updateComplete;
  expect(
    group.validity.valueMissing,
    "the violation returns once it is enforceable again"
  ).to.be.true;
});

it("bars a standalone radio from constraint validation while disabled", async () => {
  const el = (await fixture(
    html`<lr-radio required disabled value="a">A</lr-radio>`
  )) as LyraRadio;
  await el.updateComplete;
  expect(el.validity.valueMissing, "a barred radio raises no violation").to.be
    .false;
  expect(el.checkValidity()).to.be.true;

  el.disabled = false;
  await el.updateComplete;
  expect(
    el.validity.valueMissing,
    "the violation returns once it is enforceable again"
  ).to.be.true;
});

describe("lr-radio-group branch-coverage edge cases", () => {
  it("normalizes a null defaultValue write to empty, clearing the reflected value attribute", async () => {
    const group = (await fixture(html`
      <lr-radio-group value="a">
        <lr-radio value="a">A</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    expect(group.hasAttribute("value")).to.be.true;

    // The public type is `string`, but the setter is written defensively against a raw `null`
    // write (e.g. from untyped JS or a lenient framework binding) -- exercise that directly.
    (group as unknown as { defaultValue: string }).defaultValue =
      null as unknown as string;
    expect(
      group.defaultValue,
      "a null write normalizes to empty, matching the public string contract"
    ).to.equal("");
    expect(
      group.hasAttribute("value"),
      "an empty default removes the reflected attribute rather than leaving it blank"
    ).to.be.false;
  });

  it("ignores an invalid event from a light-DOM descendant it does not own", async () => {
    const group = (await fixture(html`
      <lr-radio-group required label="Choice">
        <lr-radio value="a">A</lr-radio>
        <div slot="hint"><lr-radio value="helper">Helper</lr-radio></div>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    const helper = group.querySelector('[slot="hint"] lr-radio') as LyraRadio;
    // `helper` is a standalone form participant (not group-owned) and installs its own native ->
    // `lr-invalid` alias, which legitimately bubbles up through the group -- that is unrelated to
    // the group's own aggregate alias, so only a `target === group` event would prove the group
    // mistakenly claimed ownership of an event it does not own.
    const groupOwnedAliases: CustomEvent[] = [];
    group.addEventListener("lr-invalid", (event) => {
      if (event.target === group) groupOwnedAliases.push(event as CustomEvent);
    });

    const invalid = new Event("invalid", { cancelable: true });
    helper.dispatchEvent(invalid);

    expect(
      groupOwnedAliases,
      "a support-slot radio is not group-owned, so the group never claims its invalid event as its own aggregate alias"
    ).to.have.lengthOf(0);
    expect(
      invalid.defaultPrevented,
      "the group must not veto an invalid event it does not own"
    ).to.be.false;
  });

  it("ignores an invalid event with no element target at all (defensive)", async () => {
    const group = (await fixture(
      html`<lr-radio-group></lr-radio-group>`
    )) as LyraRadioGroup;
    await group.updateComplete;
    const internals = group as unknown as { onInvalid(event: Event): void };
    const fakeEvent = { target: null, preventDefault() {} } as unknown as Event;
    let aliasCount = 0;
    group.addEventListener("lr-invalid", () => {
      aliasCount += 1;
    });

    expect(() => internals.onInvalid(fakeEvent)).to.not.throw();
    expect(aliasCount).to.equal(0);
  });

  it("no-ops arming the membership observer while disconnected", () => {
    const group = document.createElement("lr-radio-group") as LyraRadioGroup;
    const internals = group as unknown as {
      armMembershipObserver(): void;
      membershipObserver?: MutationObserver;
    };
    expect(() => internals.armMembershipObserver()).to.not.throw();
    expect(
      internals.membershipObserver,
      "a disconnected host never gets an observer"
    ).to.equal(undefined);
  });

  it("skips re-arming an already-current membership observer for the same owner document", async () => {
    const group = (await fixture(html`
      <lr-radio-group><lr-radio value="a">A</lr-radio></lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    const internals = group as unknown as {
      armMembershipObserver(): void;
      membershipObserver?: MutationObserver;
    };
    const first = internals.membershipObserver;
    expect(first, "connecting already armed one observer").to.exist;
    internals.armMembershipObserver();
    expect(
      internals.membershipObserver,
      "a redundant arm call in the same document is a no-op"
    ).to.equal(first);
  });

  it("drops the membership observer follow-up microtask once the group has since disconnected", async () => {
    const NativeMutationObserver = window.MutationObserver;
    let groupCallback: MutationCallback | undefined;
    let group!: LyraRadioGroup;
    // A fully fake (non-extending) stand-in, matching the pattern already used above for the
    // adopted-realm test -- `armMembershipObserver()` only needs a constructible `MutationObserver`
    // shape, and the outer callback is invoked directly below rather than through a real mutation.
    class TrackingMutationObserver implements MutationObserver {
      private readonly callback: MutationCallback;
      constructor(callback: MutationCallback) {
        this.callback = callback;
      }
      observe(target: Node, options?: MutationObserverInit): void {
        // Identified by its distinctive attributeFilter shape rather than `target === group`: the
        // outer `group` binding is only assigned once the `fixture()` promise resolves, which is
        // *after* the synchronous connect (and this synchronous `observe()` call) already ran.
        const filter = options?.attributeFilter;
        if (
          (target as Element)?.localName === "lr-radio-group" &&
          filter?.includes("checked") &&
          filter?.includes("slot")
        ) {
          groupCallback = this.callback;
        }
      }
      takeRecords(): MutationRecord[] {
        return [];
      }
      disconnect(): void {}
    }
    (window as unknown as { MutationObserver: unknown }).MutationObserver =
      TrackingMutationObserver;
    try {
      group = (await fixture(
        html`<lr-radio-group></lr-radio-group>`
      )) as LyraRadioGroup;
      await group.updateComplete;
      expect(groupCallback, "connecting arms the membership observer").to.be.a(
        "function"
      );
    } finally {
      window.MutationObserver = NativeMutationObserver;
    }

    const originalQueueMicrotask = window.queueMicrotask;
    let followUp: (() => void) | undefined;
    (
      window as unknown as { queueMicrotask: typeof window.queueMicrotask }
    ).queueMicrotask = ((fn: () => void) => {
      followUp = fn;
    }) as typeof window.queueMicrotask;
    const internals = group as unknown as { syncRadios(): void };
    const originalSyncRadios = internals.syncRadios.bind(group);
    const staleCalls: boolean[] = [];
    internals.syncRadios = () => {
      staleCalls.push(true);
      originalSyncRadios();
    };
    try {
      groupCallback!([], {} as MutationObserver);
      expect(
        followUp,
        "a passing outer guard queues its own follow-up microtask"
      ).to.be.a("function");

      group.remove();
      followUp!();

      expect(
        staleCalls,
        "the stale follow-up must bail before resyncing a disconnected group"
      ).to.deep.equal([]);
    } finally {
      window.queueMicrotask = originalQueueMicrotask;
      internals.syncRadios = originalSyncRadios;
    }
  });

  it("skips arming a membership observer and bails from onRadioSlotChange when the owner document reports no defaultView", async () => {
    const group = (await fixture(html`
      <lr-radio-group><lr-radio value="a">A</lr-radio></lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    const internals = group as unknown as {
      armMembershipObserver(): void;
      resetMembershipObserver(): void;
      onRadioSlotChange(): void;
      membershipObserver?: MutationObserver;
    };
    internals.resetMembershipObserver();
    expect(internals.membershipObserver).to.equal(undefined);

    // Same technique as elsewhere in this codebase (see theme-watcher.test.ts) for simulating a
    // defaultView-less owner document without actually adopting into one -- this component's real
    // shadow root uses adopted constructed stylesheets, which cannot themselves be adopted into a
    // document created via `DOMImplementation.createHTMLDocument()`, so faking just the getter
    // exercises the same guard without that unrelated stylesheet limitation.
    Object.defineProperty(group, "ownerDocument", {
      configurable: true,
      value: { defaultView: null },
    });
    try {
      expect(() => internals.armMembershipObserver()).to.not.throw();
      expect(
        internals.membershipObserver,
        "no window means no MutationObserver to construct"
      ).to.equal(undefined);
      expect(() => internals.onRadioSlotChange()).to.not.throw();
    } finally {
      delete (group as unknown as { ownerDocument?: unknown }).ownerDocument;
    }
  });

  it("treats a disconnected, never-owned radio as unowned across ownsRadio/reconcileRadio/releaseRadio", async () => {
    const group = (await fixture(html`
      <lr-radio-group><lr-radio value="a">A</lr-radio></lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    const bare = document.createElement("lr-radio") as LyraRadio;
    bare.value = "b";

    expect(
      group.ownsRadio(bare),
      "an element with no ancestor radio-group at all is never owned"
    ).to.be.false;
    expect(
      group.reconcileRadio(bare),
      "reconciling an unowned radio is a no-op that reports failure"
    ).to.be.false;
    expect(() => group.releaseRadio(bare)).to.not.throw();
  });

  it("refuses to select through a disabled group, a disabled radio, or an unowned radio", async () => {
    const group = (await fixture(html`
      <lr-radio-group disabled>
        <lr-radio value="a">A</lr-radio>
        <lr-radio value="b" disabled>B</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    if (!a || !b) throw new Error("Expected both selection-refusal radios.");
    const bare = document.createElement("lr-radio") as LyraRadio;
    bare.value = "c";

    expect(group.selectRadio(a), "a disabled group refuses every selection").to
      .be.false;

    group.disabled = false;
    await group.updateComplete;
    expect(
      group.selectRadio(b),
      "a disabled radio refuses selection even in an enabled group"
    ).to.be.false;
    expect(group.selectRadio(bare), "an unowned radio is never selectable").to
      .be.false;
    expect(
      group.selectRadio(a),
      "the enabled owned radio still selects normally"
    ).to.be.true;
  });

  it("normalizes a null value write on the private selectValue helper the same as an empty string", async () => {
    const group = (await fixture(html`
      <lr-radio-group>
        <lr-radio value="a" checked>A</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    const internals = group as unknown as {
      selectValue(next: string | null): void;
    };

    internals.selectValue(null);

    expect(group.value).to.equal("");
    expect((group.querySelector("lr-radio") as LyraRadio).checked).to.be.false;
  });

  it("clears the checked radio when a pending restored/reset selection matches nothing", async () => {
    const group = document.createElement("lr-radio-group") as LyraRadioGroup;
    group.formStateRestoreCallback("missing", "restore");
    group.innerHTML = `
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    `;
    document.body.append(group);
    try {
      await group.updateComplete;
      await new Promise((resolve) => setTimeout(resolve, 0));
      await group.updateComplete;
      const radios = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
      expect(group.value).to.equal("");
      expect(radios.every((radio) => !radio.checked)).to.be.true;
    } finally {
      group.remove();
    }
  });

  it("reflects the customError property through the custom-error attribute", async () => {
    const group = (await fixture(
      html`<lr-radio-group></lr-radio-group>`
    )) as LyraRadioGroup;
    await group.updateComplete;

    group.customError = "Nope";
    expect(group.getAttribute("custom-error")).to.equal("Nope");
    expect(group.customError).to.equal("Nope");
    expect(group.validity.customError).to.be.true;

    group.customError = null;
    expect(
      group.hasAttribute("custom-error"),
      "a null customError removes the reflected attribute"
    ).to.be.false;
    expect(group.validity.customError).to.be.false;
  });

  it("keeps group validity methods and the reflected custom-error state atomic when clearing", async () => {
    const group = (await fixture(html`
      <lr-radio-group label="Plan">
        <lr-radio value="free">Free</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;

    group.setCustomValidity("Unavailable");
    expect(group.customError).to.equal("Unavailable");
    expect(group.getAttribute("custom-error")).to.equal("Unavailable");

    group.setCustomValidity("");
    expect(group.customError).to.equal(null);
    expect(group.hasAttribute("custom-error")).to.equal(false);

    group.customError = "Unavailable again";
    group.resetValidity();
    expect(group.customError).to.equal(null);
    expect(group.hasAttribute("custom-error")).to.equal(false);

    group.customError = "";
    expect(group.customError).to.equal(null);
    expect(group.hasAttribute("custom-error")).to.equal(false);
  });

  it("normalizes a null name/value property write to empty, matching the string contract", async () => {
    const group = (await fixture(html`
      <lr-radio-group name="choice" value="a">
        <lr-radio value="a">A</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;

    group.name = null;
    expect(group.name).to.equal("");
    expect(group.hasAttribute("name")).to.be.false;

    group.value = null;
    expect(group.value).to.equal("");
    expect((group.querySelector("lr-radio") as LyraRadio).checked).to.be.false;
  });

  it("restores a standalone radio's native default value when its value is set to null", async () => {
    const radio = (await fixture(
      html`<lr-radio name="choice" value="custom" checked>Choice</lr-radio>`
    )) as LyraRadio;
    (radio as unknown as { value: string | null }).value = null;
    expect(radio.value).to.equal("on");
    expect(radio.hasAttribute("value")).to.equal(false);
    await radio.updateComplete;
    expect(radio.getAttribute("value")).to.equal("on");
  });

  it("does not move focus when a fieldset disables the radio group in the same task", async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        <button type="button">Elsewhere</button>
        <fieldset>
          <lr-radio-group label="Choice">
            <lr-radio value="a">A</lr-radio>
          </lr-radio-group>
        </fieldset>
      </div>
    `);
    const button = wrapper.querySelector("button")!;
    const fieldset = wrapper.querySelector("fieldset")!;
    const group = wrapper.querySelector("lr-radio-group") as LyraRadioGroup;
    button.focus();
    fieldset.disabled = true;
    group.focus();
    expect(document.activeElement === button).to.equal(true);
  });

  it('navigates horizontally in plain LTR (no dir="rtl"), unlike the already-covered RTL case', async () => {
    const group = (await fixture(html`
      <lr-radio-group orientation="horizontal" label="Choice">
        <lr-radio value="a" checked>A</lr-radio>
        <lr-radio value="b">B</lr-radio>
        <lr-radio value="c">C</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const [a, b, c] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    if (!a || !b || !c) throw new Error("Expected all plain-LTR radios.");
    await group.updateComplete;
    const aBase = a.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

    let changed = oneEvent(group, "change");
    aBase.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowRight",
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await changed;
    expect(b.checked, "ArrowRight moves forward under plain LTR").to.be.true;

    const bBase = b.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    changed = oneEvent(group, "change");
    bBase.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowLeft",
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await changed;
    expect(a.checked, "ArrowLeft moves backward under plain LTR").to.be.true;
    expect(c.checked).to.be.false;
  });

  it("moves selection to the first enabled option on Home and the last on End", async () => {
    const group = (await fixture(html`
      <lr-radio-group label="Choice">
        <lr-radio value="a">A</lr-radio>
        <lr-radio value="b" checked>B</lr-radio>
        <lr-radio value="c">C</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const [a, b, c] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    if (!a || !b || !c) throw new Error("Expected all Home/End radios.");
    await group.updateComplete;
    const bBase = b.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;

    let changed = oneEvent(group, "change");
    bBase.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Home",
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await changed;
    expect(a.checked, "Home selects the first enabled option").to.be.true;

    const aBase = a.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    changed = oneEvent(group, "change");
    aBase.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "End",
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await changed;
    expect(c.checked, "End selects the last enabled option").to.be.true;
  });

  it("ignores a keydown whose own dispatching radio is individually disabled", async () => {
    const group = (await fixture(html`
      <lr-radio-group label="Choice">
        <lr-radio value="a" checked>A</lr-radio>
        <lr-radio value="b" disabled>B</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    if (!a || !b) throw new Error("Expected both disabled-keydown radios.");
    await group.updateComplete;

    // A disabled radio is never a real keyboard focus target, but a synthetic event dispatched
    // straight from it must still be rejected by the group's own defensive re-check.
    b.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        composed: true,
      })
    );
    expect(a.checked).to.be.true;
    expect(b.checked).to.be.false;
  });

  it("excludes hidden, inert, and aria-disabled ancestor subtrees from roving navigation", async () => {
    const group = (await fixture(html`
      <lr-radio-group label="Choice">
        <lr-radio value="a" checked>A</lr-radio>
        <span inert><lr-radio value="b">B</lr-radio></span>
        <span aria-hidden=" TRUE "><lr-radio value="c">C</lr-radio></span>
        <span aria-disabled=" true "><lr-radio value="d">D</lr-radio></span>
        <lr-radio value="e">E</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const [a, b, c, d, e] = [
      ...group.querySelectorAll("lr-radio"),
    ] as LyraRadio[];
    if (!a || !b || !c || !d || !e) {
      throw new Error("Expected all availability-filter radios.");
    }
    await group.updateComplete;

    const changed = oneEvent(group, "change");
    a.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await changed;
    expect(e.checked).to.be.true;
    expect([b, c, d].every((radio) => !radio.checked)).to.be.true;
  });

  it("observes live ancestor availability changes and keeps exactly one available roving stop", async () => {
    const group = (await fixture(html`
      <lr-radio-group label="Choice">
        <span id="first-wrap"><lr-radio value="a" checked>A</lr-radio></span>
        <span id="second-wrap"><lr-radio value="b">B</lr-radio></span>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    if (!a || !b) throw new Error("Expected both live-availability radios.");
    const firstWrap = group.querySelector<HTMLElement>("#first-wrap")!;
    await group.updateComplete;

    firstWrap.setAttribute("aria-hidden", " TRUE ");
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    await group.updateComplete;
    const tabStops = [a, b].filter(
      (radio) =>
        radio.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!
          .tabIndex === 0
    );
    expect(tabStops.length).to.equal(1);
    expect(tabStops[0]?.value).to.equal("b");
  });

  it("ignores a composed keydown retargeted to a nested inner group that owns no radios itself", async () => {
    const outer = (await fixture(html`
      <lr-radio-group label="Outer">
        <lr-radio value="p" checked>P</lr-radio>
        <lr-radio-group label="Inner">
          <lr-radio value="x" checked>X</lr-radio>
        </lr-radio-group>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await outer.updateComplete;
    const [p] = [...outer.querySelectorAll(":scope > lr-radio")] as LyraRadio[];
    if (!p) throw new Error("Expected the outer-group radio.");
    // `:scope > lr-radio-group lr-radio` (not the ambiguous `lr-radio-group lr-radio`, which would
    // also match `p` itself as a descendant of the outer group) unambiguously reaches the inner
    // group's own radio.
    const innerGroup = outer.querySelector(
      ":scope > lr-radio-group"
    ) as LyraRadioGroup;
    const innerRadio = innerGroup.querySelector("lr-radio") as LyraRadio;
    await innerRadio.updateComplete;
    const innerBase = innerRadio.shadowRoot!.querySelector(
      '[part~="base"]'
    ) as HTMLElement;

    innerBase.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );

    expect(
      p.checked,
      "the outer group must not navigate based on an inner-group-owned keydown"
    ).to.be.true;
  });

  it("tracks label and error slot presence through live slotchange, showing each hidden part", async () => {
    const group = (await fixture(html`
      <lr-radio-group><lr-radio value="a">A</lr-radio></lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    const labelPart = group.shadowRoot!.querySelector(
      '[part~="label"]'
    ) as HTMLElement;
    const errorPart = group.shadowRoot!.querySelector(
      '[part="error"]'
    ) as HTMLElement;
    expect(labelPart.hidden).to.be.true;
    expect(errorPart.hidden).to.be.true;

    const labelSlot = group.shadowRoot!.querySelector(
      'slot[name="label"]'
    ) as HTMLSlotElement;
    const errorSlot = group.shadowRoot!.querySelector(
      'slot[name="error"]'
    ) as HTMLSlotElement;

    const labelChanged = oneEvent(labelSlot, "slotchange");
    const labelEl = document.createElement("span");
    labelEl.slot = "label";
    labelEl.textContent = "Choice";
    group.append(labelEl);
    await labelChanged;
    await group.updateComplete;
    expect(labelPart.hidden, "a slotted label element shows the label part").to
      .be.false;

    const errorChanged = oneEvent(errorSlot, "slotchange");
    const errorEl = document.createElement("span");
    errorEl.slot = "error";
    errorEl.textContent = "Required";
    group.append(errorEl);
    await errorChanged;
    await group.updateComplete;
    expect(errorPart.hidden, "a slotted error element shows the error part").to
      .be.false;
  });

  it("no-ops syncFormState/updateValidity when called before internals/validityController exist", async () => {
    const group = (await fixture(
      html`<lr-radio-group></lr-radio-group>`
    )) as LyraRadioGroup;
    await group.updateComplete;
    const internals = group as unknown as {
      internals?: ElementInternals;
      validityController?: unknown;
      syncFormState(): void;
      updateValidity(): void;
    };
    const savedInternals = internals.internals;
    const savedValidityController = internals.validityController;
    try {
      internals.internals = undefined;
      expect(() => internals.syncFormState()).to.not.throw();
      internals.validityController = undefined;
      expect(() => internals.updateValidity()).to.not.throw();
    } finally {
      internals.internals = savedInternals;
      internals.validityController = savedValidityController;
    }
  });

  it("treats an explicit null message the same as empty when clearing custom validity", async () => {
    const group = (await fixture(html`
      <lr-radio-group required>
        <lr-radio value="a">A</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    group.setCustomValidity("Nope");
    expect(group.validity.customError).to.be.true;

    (group.setCustomValidity as (message?: string | null) => void)(null);
    expect(
      group.validity.customError,
      "a null message clears custom validity like an empty string"
    ).to.be.false;
  });

  it("restores the reflected default value on its own reset pass when no radio has a competing native default", async () => {
    const group = (await fixture(html`
      <lr-radio-group name="choice" value="a">
        <lr-radio value="a">A</lr-radio>
        <lr-radio value="b">B</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    if (!a || !b) throw new Error("Expected both group-default reset radios.");
    await group.updateComplete;
    expect(a.checked).to.be.true;

    b.click();
    expect(b.checked).to.be.true;
    expect(group.value).to.equal("b");

    // Calls the group's own reset entry point directly -- exactly what a native `form.reset()`
    // invokes on it -- to isolate its own restoration logic from each *individually*
    // form-associated owned radio's own separate `formResetCallback()`. Under a real `form.reset()`,
    // each owned radio's native reset also fires and, when neither radio carries a matching
    // `checked` attribute, replaces this restored selection with an empty value. This assertion is
    // intentionally limited to the group's own restoration contract.
    group.formResetCallback();
    expect(
      group.value,
      "the group-level defaultValue wins its own reset pass when no radio has a competing default"
    ).to.equal("a");
    expect(a.checked).to.be.true;
    expect(b.checked).to.be.false;
  });

  it("lets the group remain the sole reset owner during a real form reset", async () => {
    const form = (await fixture(html`
      <form>
        <lr-radio-group name="choice" value="a">
          <lr-radio value="a">A</lr-radio>
          <lr-radio value="b">B</lr-radio>
        </lr-radio-group>
      </form>
    `)) as HTMLFormElement;
    const group = form.querySelector("lr-radio-group") as LyraRadioGroup;
    const [a, b] = [...group.querySelectorAll("lr-radio")] as LyraRadio[];
    if (!a || !b) throw new Error("Expected both form-reset radios.");
    await group.updateComplete;

    b.click();
    expect(group.value).to.equal("b");
    form.reset();

    expect(group.value).to.equal("a");
    expect(a.checked).to.be.true;
    expect(b.checked).to.be.false;
    expect(new FormData(form).get("choice")).to.equal("a");
  });

  it("formStateRestoreCallback clears the selection for a non-string restored state", async () => {
    const group = (await fixture(html`
      <lr-radio-group>
        <lr-radio value="a" checked>A</lr-radio>
      </lr-radio-group>
    `)) as LyraRadioGroup;
    await group.updateComplete;
    expect(group.value).to.equal("a");

    group.formStateRestoreCallback(null, "restore");
    await group.updateComplete;
    expect(
      group.value,
      "a non-string restored state clears the selection like an empty string"
    ).to.equal("");
    expect((group.querySelector("lr-radio") as LyraRadio).checked).to.be.false;
  });
});
