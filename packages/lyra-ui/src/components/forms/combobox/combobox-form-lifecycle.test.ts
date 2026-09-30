// Focused native form lifecycle cases. Test bodies and titles were moved intact from the prior suite.
import { fixture, expect, oneEvent, html, aTimeout, waitUntil } from "@open-wc/testing";
import "./combobox.js";
import "./option.js";
import "../input/input.js";
import "../select/select.js";
import "../button/button.js";
import "../token-input/token-input.js";
import "../color-picker/color-picker.js";
import "../../layout/segmented/segmented.js";
import type { ComboboxFilterDetail, LyraCombobox } from "./combobox.js";
import "../../../translations/ar/forms.js";
import "../../../translations/ar/shared.js";

const requiredItem = <T>(items: ArrayLike<T>, index: number, description: string): T => {
  const item = items[index];
  if (item === undefined) throw new Error(`Missing ${description} at index ${index}.`);
  return item;
};

const basic = () => html`
  <lr-combobox>
    <lr-option value="a">Apple</lr-option>
    <lr-option value="b">Banana</lr-option>
    <lr-option value="c">Cherry</lr-option>
  </lr-combobox>
`;

async function typeQuery(el: LyraCombobox, text: string) {
  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  input.value = text;
  input.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      composed: true,
      data: text,
      inputType: "insertText",
    })
  );
  await el.updateComplete;
  return input;
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

it("rejects direct open writes while disabled or synchronously fieldset-disabled", async () => {
  const fieldset = await fixture<HTMLFieldSetElement>(html`
    <fieldset>
      <lr-combobox><lr-option value="a">A</lr-option></lr-combobox>
    </fieldset>
  `);
  const el = fieldset.querySelector("lr-combobox") as LyraCombobox;
  el.disabled = true;
  el.open = true;
  expect(el.open).to.be.false;
  expect(el.hasAttribute("open")).to.be.false;

  el.disabled = false;
  fieldset.disabled = true;
  el.setAttribute("open", "");
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(el.hasAttribute("open")).to.be.false;
});

it("participates in a form (single + multiple)", async () => {
  const form = (await fixture(html`
    <form>
      <lr-combobox name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-combobox") as LyraCombobox;
  el.value = "b";
  await el.updateComplete;
  expect(new FormData(form).get("fruit")).to.equal("b");

  el.multiple = true;
  el.value = ["a", "b"];
  await el.updateComplete;
  expect(new FormData(form).getAll("fruit")).to.deep.equal(["a", "b"]);
});

it("blocks a required, empty combobox from submitting the form", async () => {
  const form = (await fixture(html`
    <form>
      <lr-combobox name="fruit" required>
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    </form>
  `)) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;
});

it("focuses the inner input after direct and submit-driven validity reporting", async () => {
  const form = (await fixture(html`
    <form>
      <button type="button">Before combobox</button>
      <lr-combobox name="fruit" required>
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    </form>
  `)) as HTMLFormElement;
  const sentinel = form.querySelector("button") as HTMLButtonElement;
  const el = form.querySelector("lr-combobox") as LyraCombobox;
  let submitCount = 0;
  form.addEventListener("submit", (event) => {
    submitCount += 1;
    event.preventDefault();
  });

  sentinel.focus();
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal("lr-combobox");
  expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal(
    "combobox-input"
  );

  sentinel.focus();
  form.requestSubmit();
  expect(submitCount).to.equal(0);
  expect(document.activeElement?.localName).to.equal("lr-combobox");
  expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal(
    "combobox-input"
  );
});

it("updates dynamic required validity synchronously without awaiting a Lit update", async () => {
  const el = (await fixture(basic())) as LyraCombobox;

  el.required = true;
  expect(el.hasAttribute("required")).to.be.true;
  expect(el.checkValidity()).to.be.false;

  el.required = false;
  expect(el.hasAttribute("required")).to.be.false;
  expect(el.checkValidity()).to.be.true;
});

it("updates disabled form participation synchronously without awaiting a Lit update", async () => {
  const form = (await fixture(html`
    <form>
      <lr-combobox name="fruit">
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-combobox") as LyraCombobox;
  el.value = "a";
  expect(new FormData(form).get("fruit")).to.equal("a");

  el.disabled = true;
  expect(el.hasAttribute("disabled")).to.be.true;
  expect(new FormData(form).has("fruit")).to.be.false;

  el.disabled = false;
  expect(el.hasAttribute("disabled")).to.be.false;
  expect(new FormData(form).get("fruit")).to.equal("a");
});

it("restores the declared default selection on form.reset()", async () => {
  const form = (await fixture(html`
    <form>
      <lr-combobox name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b" selected>Banana</lr-option>
      </lr-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-combobox") as LyraCombobox;
  await el.updateComplete;
  el.value = "a";
  form.reset();
  expect(el.value).to.equal("b");
});

it("preserves an initial property-only selected write until reset reapplies a later default", async () => {
  const form = (await fixture(html`
    <form>
      <lr-combobox name="fruit" multiple>
        <lr-option value="a" .selected=${true}>Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-combobox") as LyraCombobox;
  const [, banana] = [...el.querySelectorAll("lr-option")];
  await el.updateComplete;
  expect(el.value).to.deep.equal(["a"]);

  banana!.defaultSelected = true;
  await banana!.updateComplete;
  await el.updateComplete;
  expect(
    el.value,
    "the later reset default must not overwrite dirty live selectedness"
  ).to.deep.equal(["a"]);

  form.reset();
  expect(el.value).to.deep.equal(["b"]);
});

it('retroactively seeds the reset default from a late dirty selection when nothing was ever declared selected', async () => {
  const form = (await fixture(html`
    <form>
      <lr-combobox name="fruit"><lr-option value="a">Apple</lr-option></lr-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-combobox") as LyraCombobox;
  await el.updateComplete;
  expect(el.value).to.equal("");

  const zebra = document.createElement("lr-option");
  zebra.setAttribute("value", "z");
  zebra.textContent = "Zebra";
  zebra.selected = true; // property-only write: dirty, but never a declared `selected` attribute
  el.appendChild(zebra);
  await aTimeout(0);
  await el.updateComplete;
  expect(el.value).to.equal("z");

  el.value = "a";
  form.reset();
  expect(
    el.value,
    "the late dirty selection retroactively became the reset default"
  ).to.equal("z");
});

it("does not let a user pick become the reset default when no option is declared selected", async () => {
  // Regression test: previously the *first* pick on an initially-unselected
  // combobox silently became the permanent reset default, so a later
  // different pick could never reset back to empty.
  const form = (await fixture(html`
    <form>
      <lr-combobox name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-combobox") as LyraCombobox;
  await el.updateComplete;
  el.value = "a";
  el.value = "b";
  form.reset();
  expect(el.value).to.equal("");
});

it("exposes --lr-combobox-gap and --lr-combobox-radius, defaulting to the shared form-control ladder", async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const combobox = el.shadowRoot!.querySelector(
    '[part="combobox"]'
  ) as HTMLElement;
  const cs = getComputedStyle(combobox);
  expect(cs.gap).to.equal("4px");
  expect(cs.borderRadius).to.equal("8px");
});

it("reflects an invalid state only after the field has been interacted with once", async () => {
  const el = (await fixture(html`
    <lr-combobox required>
      <lr-option value="a">Apple</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;
  expect(el.hasAttribute("data-invalid")).to.be.false;

  const input = el.shadowRoot!.querySelector(
    '[part="combobox-input"]'
  ) as HTMLInputElement;
  input.dispatchEvent(new FocusEvent("focus"));
  input.dispatchEvent(new FocusEvent("blur"));
  await el.updateComplete;
  expect(el.hasAttribute("data-invalid")).to.be.true;
});

it("clone-normalizes source rows, retains valid siblings, and contains hostile getters", async () => {
  const el = (await fixture(
    html`<lr-combobox source-delay="0"></lr-combobox>`
  )) as LyraCombobox;
  const hostile = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(hostile, "value", {
    get: () => {
      throw new Error("hostile getter");
    },
  });
  const mutable = { value: "safe", label: "Safe row", data: { id: 1 } };
  el.source = async () => [
    hostile as never,
    { value: 7, label: "wrong" } as never,
    mutable,
  ];
  el.open = true;
  await waitUntil(
    () => el.sourceTotal === 3,
    "normalized source response never settled"
  );
  mutable.label = "Mutated after return";
  await el.updateComplete;

  const rows = el.shadowRoot!.querySelectorAll('[part="option"]');
  expect(rows).to.have.length(1);
  expect(requiredItem(rows, 0, 'normalized option').textContent).to.contain("Safe row");
  expect(el.sourceTruncated).to.be.true;
});

it("re-fetches with the reset query after picking a row, refreshing stale async results (multiple + source)", async () => {
  const el = (await fixture(
    html`<lr-combobox multiple></lr-combobox>`
  )) as LyraCombobox;
  const calls: string[] = [];
  el.source = async (query: string) => {
    calls.push(query);
    return query === "ban"
      ? [{ value: "b", label: "Banana" }]
      : [
          { value: "a", label: "Apple" },
          { value: "b", label: "Banana" },
        ];
  };
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  await typeQuery(el, "ban");
  await aTimeout(250);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(1);

  const row = el.shadowRoot!.querySelector('[part="option"]') as HTMLElement;
  row.click();
  await aTimeout(250);
  await el.updateComplete;

  expect(calls).to.deep.equal(["", "ban", ""]);
  const labels = Array.from(
    el.shadowRoot!.querySelectorAll('[part="option-label"]')
  ).map((n) => n.textContent?.trim());
  expect(labels).to.deep.equal(["Apple", "Banana"]);
});

it("re-fetches with the reset query after clear(), refreshing stale async results (source mode)", async () => {
  const el = (await fixture(
    html`<lr-combobox with-clear></lr-combobox>`
  )) as LyraCombobox;
  const calls: string[] = [];
  el.source = async (query: string) => {
    calls.push(query);
    return query === "ban"
      ? [{ value: "b", label: "Banana" }]
      : [
          { value: "a", label: "Apple" },
          { value: "b", label: "Banana" },
        ];
  };
  el.value = "b";
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  await typeQuery(el, "ban");
  await aTimeout(250);
  await el.updateComplete;

  const clearBtn = el.shadowRoot!.querySelector(
    '[part="clear-button"]'
  ) as HTMLButtonElement;
  setTimeout(() => clearBtn.click());
  await oneEvent(el, "lr-clear");
  await aTimeout(250);
  await el.updateComplete;

  expect(calls).to.deep.equal(["", "ban", ""]);
});

it('does not merge two nameless multiple comboboxes under a shared "value" form key', async () => {
  const form = (await fixture(html`
    <form>
      <lr-combobox multiple>
        <lr-option value="a" selected>Apple</lr-option>
      </lr-combobox>
      <lr-combobox multiple>
        <lr-option value="b" selected>Banana</lr-option>
      </lr-combobox>
    </form>
  `)) as HTMLFormElement;
  const els = Array.from(
    form.querySelectorAll("lr-combobox")
  ) as LyraCombobox[];
  await Promise.all(els.map((e) => e.updateComplete));
  expect(els.map((e) => e.value)).to.deep.equal([["a"], ["b"]]);

  expect(new FormData(form).getAll("value")).to.deep.equal([]);
});

it("disables the combobox when its containing fieldset is disabled", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-combobox name="fruit">
          <lr-option value="a">Apple</lr-option>
        </lr-combobox>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-combobox") as LyraCombobox;
  const fieldset = form.querySelector("fieldset") as HTMLFieldSetElement;
  await el.updateComplete;
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to
    .be.false;

  fieldset.disabled = true;
  await el.updateComplete;
  // `el.disabled` (the consumer-facing IDL property/attribute) is never
  // mutated by fieldset cascading -- only the combined `effectiveDisabled`
  // reflects it (mirrors native `<input>` and the FormAssociated mixin's own
  // `_fieldsetDisabled`/`effectiveDisabled` pattern).
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to
    .be.true;
  expect(el.disabled).to.be.false;
  const combobox = el.shadowRoot!.querySelector(
    '[part="combobox"]'
  ) as HTMLElement;
  expect(getComputedStyle(combobox).opacity).to.equal("0.5");
  expect(getComputedStyle(combobox).cursor).to.equal("not-allowed");
});

it("re-syncs the submitted FormData when `name` changes after a value is already set", async () => {
  const form = document.createElement("form");
  const el = (await fixture(html`
    <lr-combobox name="a"
      ><lr-option value="x" selected></lr-option
    ></lr-combobox>
  `)) as LyraCombobox;
  form.appendChild(el);
  document.body.appendChild(form);
  el.name = "b";
  await el.updateComplete;
  const data = new FormData(form);
  expect(data.has("a")).to.be.false;
  expect(data.get("b")).to.equal("x");
  form.remove();
});

it("rebinds multiple FormData entries to a new name synchronously", async () => {
  const form = (await fixture(html`
    <form>
      <lr-combobox name="old" multiple .value=${["a", "b"]}></lr-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-combobox") as LyraCombobox;

  el.name = "next";
  const data = new FormData(form);

  expect(data.has("old")).to.be.false;
  expect(data.getAll("next")).to.deep.equal(["a", "b"]);
});

it("re-syncs FormData when switching between single and multiple mode", async () => {
  const form = document.createElement("form");
  const el = (await fixture(html`
    <lr-combobox name="tags"
      ><lr-option value="x" selected></lr-option
    ></lr-combobox>
  `)) as LyraCombobox;
  form.appendChild(el);
  document.body.appendChild(form);
  // Force two entries into `_selected` while still in single mode (the
  // `value` setter itself doesn't gate on `multiple`, so this doesn't
  // require a second declared-`selected` option, which single mode would
  // collapse down to just the last one anyway). This makes a two-entry
  // `data.getAll('tags')` below only possible if switching `multiple` on
  // actually re-ran `syncFormValue()`'s `FormData.append()` path -- the old
  // single-value path (`setFormValue(this._selected[0] ?? '')`, still in
  // effect from the most recent `value` assignment) can only ever produce
  // one entry, so a stale sync would leave just `['x']`.
  el.value = ["x", "y"];
  await el.updateComplete;
  el.multiple = true;
  await el.updateComplete;
  const data = new FormData(form);
  expect(data.getAll("tags")).to.deep.equal(["x", "y"]);
  form.remove();
});

it("restores its own explicit `disabled` after an ancestor fieldset re-enables", async () => {
  const el = (await fixture(
    html`<lr-combobox disabled></lr-combobox>`
  )) as LyraCombobox;
  (
    el as unknown as { formDisabledCallback(d: boolean): void }
  ).formDisabledCallback(true);
  (
    el as unknown as { formDisabledCallback(d: boolean): void }
  ).formDisabledCallback(false);
  await el.updateComplete;
  expect(el.disabled).to.be.true;
});

describe("native input surface", () => {
  it("forwards native editing-assistance attributes to the internal input", async () => {
    const el = (await fixture(html`
      <lr-combobox
        autocomplete="one-time-code"
        inputmode="search"
        enterkeyhint="done"
        spellcheck="false"
        autocapitalize="off"
        autocorrect="off"
      ></lr-combobox>
    `)) as LyraCombobox;
    const input = el.shadowRoot!.querySelector(
      '[part="combobox-input"]'
    ) as HTMLInputElement;

    expect(input.getAttribute("autocomplete")).to.equal("one-time-code");
    expect(input.getAttribute("inputmode")).to.equal("search");
    expect(input.getAttribute("enterkeyhint")).to.equal("done");
    expect(input.spellcheck).to.be.false;
    expect(input.getAttribute("autocapitalize")).to.equal("off");
    expect(input.getAttribute("autocorrect")).to.equal("off");
  });

  it('restores the declared false spellcheck default when the attribute is removed', async () => {
    const el = (await fixture(
      html`<lr-combobox spellcheck="true"></lr-combobox>`
    )) as LyraCombobox;
    const input = el.shadowRoot!.querySelector(
      '[part="combobox-input"]'
    ) as HTMLInputElement;
    expect(el.spellcheck).to.equal(true);
    expect(input.spellcheck).to.equal(true);

    el.removeAttribute('spellcheck');
    await el.updateComplete;

    expect(el.spellcheck).to.equal(false);
    expect(input.spellcheck).to.equal(false);
  });

  it("supports clearable while retaining with-clear as a compatibility alias", async () => {
    const clearable = (await fixture(html`
      <lr-combobox clearable>
        <lr-option value="a" selected>Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await clearable.updateComplete;
    expect(
      clearable.shadowRoot!.querySelector('[part="clear-button"]') !== null
    ).to.be.true;

    const legacy = (await fixture(html`
      <lr-combobox with-clear>
        <lr-option value="a" selected>Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await legacy.updateComplete;
    expect(legacy.shadowRoot!.querySelector('[part="clear-button"]') !== null)
      .to.be.true;
  });

  it("forwards focus, blur, selection, and range editing to the internal input", async () => {
    const el = (await fixture(
      html`<lr-combobox multiple></lr-combobox>`
    )) as LyraCombobox;
    const input = el.shadowRoot!.querySelector(
      '[part="combobox-input"]'
    ) as HTMLInputElement;

    el.focus();
    expect(el.shadowRoot!.activeElement === input).to.be.true;

    input.value = "hello world";
    input.dispatchEvent(
      new InputEvent("input", { bubbles: true, composed: true })
    );
    el.setSelectionRange(6, 11, "forward");
    expect(el.selectionStart).to.equal(6);
    expect(el.selectionEnd).to.equal(11);
    expect(el.selectionDirection).to.equal("forward");

    el.setRangeText("there", 6, 11, "select");
    await el.updateComplete;
    expect(el.input?.value).to.equal("hello there");

    el.select();
    expect(el.selectionStart).to.equal(0);
    expect(el.selectionEnd).to.equal("hello there".length);

    el.blur();
    expect(el.shadowRoot!.activeElement === null).to.be.true;
  });

  it("rejects host focus synchronously when direct or fieldset disablement starts", async () => {
    const fieldset = await fixture<HTMLFieldSetElement>(html`
      <fieldset>
        <lr-combobox><lr-option value="a">Apple</lr-option></lr-combobox>
      </fieldset>
    `);
    const el = fieldset.querySelector("lr-combobox") as LyraCombobox;

    el.disabled = true;
    el.focus();
    expect(el.shadowRoot!.activeElement === null, "direct disabled write").to.be
      .true;

    el.disabled = false;
    await el.updateComplete;
    fieldset.disabled = true;
    el.focus();
    expect(el.shadowRoot!.activeElement === null, "same-task fieldset cascade")
      .to.be.true;
  });

  it("relays exactly one owner-realm native focus/blur pair and never fires the removed lr-focus/lr-blur aliases", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    const input = el.shadowRoot!.querySelector(
      '[part="combobox-input"]'
    ) as HTMLInputElement;
    const related = document.createElement("button");
    const nativeEvents: FocusEvent[] = [];
    const aliases: Event[] = [];
    el.addEventListener("focus", (event) => nativeEvents.push(event));
    el.addEventListener("blur", (event) => nativeEvents.push(event));
    el.addEventListener("lr-focus", (event) => aliases.push(event));
    el.addEventListener("lr-blur", (event) => aliases.push(event));

    input.dispatchEvent(new FocusEvent("focus", { relatedTarget: related }));
    input.dispatchEvent(new FocusEvent("blur", { relatedTarget: related }));

    expect(nativeEvents.map(({ type }) => type)).to.deep.equal([
      "focus",
      "blur",
    ]);
    expect(
      nativeEvents.every(
        (event) =>
          event.constructor === el.ownerDocument.defaultView!.FocusEvent &&
          event.bubbles &&
          event.composed &&
          (event.target as Element).localName === "lr-combobox"
      )
    ).to.be.true;
    expect(
      nativeEvents.map((event) =>
        event.relatedTarget instanceof Node ? event.relatedTarget.nodeName : null
      )
    ).to.deep.equal(["BUTTON", "BUTTON"]);
    expect(aliases).to.deep.equal([]);
  });
});

describe("lr-filter (live filter text)", () => {
  /** Collects every `lr-filter` detail value in dispatch order. */
  function trackFilter(el: LyraCombobox): {
    values: string[];
    events: CustomEvent<ComboboxFilterDetail>[];
  } {
    const values: string[] = [];
    const events: CustomEvent<ComboboxFilterDetail>[] = [];
    el.addEventListener("lr-filter", (event) => {
      events.push(event);
      values.push(event.detail.value);
    });
    return { values, events };
  }

  it("emits one lr-filter per keystroke carrying the in-progress filter text", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    const { values, events } = trackFilter(el);

    await typeQuery(el, "b");
    await typeQuery(el, "ba");
    await typeQuery(el, "ban");

    expect(values).to.deep.equal(["b", "ba", "ban"]);
    expect(events.every((event) => event.bubbles && event.composed)).to.be.true;
    expect(events.every((event) => !event.cancelable)).to.be.true;
    expect(
      events.every(
        (event) => (event.target as Element).localName === "lr-combobox"
      )
    ).to.be.true;
  });

  it("emits lr-filter when the user clears the filter text back to empty", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    await typeQuery(el, "ban");
    const { values } = trackFilter(el);

    await typeQuery(el, "");

    expect(values).to.deep.equal([""]);
  });

  it("does not emit lr-filter when a pointer selection commits and resets the query (single)", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.open = true;
    await el.updateComplete;
    await typeQuery(el, "ban");
    const { values } = trackFilter(el);
    const changes: string[] = [];
    el.addEventListener("change", (event) => changes.push(event.type));

    (
      el.shadowRoot!.querySelectorAll('[part="option"]')[0] as HTMLElement
    ).click();
    await el.updateComplete;

    expect(el.value).to.equal("b");
    expect(changes).to.deep.equal(["change"]);
    expect(values).to.deep.equal([]);
  });

  it("does not emit lr-filter when a keyboard selection commits and resets the query (multiple)", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.multiple = true;
    const input = el.shadowRoot!.querySelector(
      '[part="combobox-input"]'
    ) as HTMLInputElement;
    input.focus();
    el.open = true;
    await el.updateComplete;
    await typeQuery(el, "ban");
    const { values } = trackFilter(el);

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );
    await el.updateComplete;

    expect(el.value).to.deep.equal(["b"]);
    expect(values).to.deep.equal([]);
  });

  it("does not emit lr-filter for a value write, form.reset(), or closing the listbox", async () => {
    const form = (await fixture(html`
      <form>
        <lr-combobox name="fruit" clearable>
          <lr-option value="a">Apple</lr-option>
          <lr-option value="b" selected>Banana</lr-option>
        </lr-combobox>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-combobox") as LyraCombobox;
    await el.updateComplete;
    await typeQuery(el, "app");
    const { values } = trackFilter(el);
    // The clear button IS a user-driven filter writer -- see the 'clear affordance on the filter
    // axis' suite below for its own lr-filter coverage.

    // Programmatic `value` assignment.
    el.value = "a";
    await el.updateComplete;
    expect(values, "value assignment must not emit lr-filter").to.deep.equal(
      []
    );

    // form.reset() -> formResetCallback() blanks the query.
    await typeQuery(el, "che");
    values.length = 0;
    form.reset();
    await el.updateComplete;
    expect(values, "form.reset() must not emit lr-filter").to.deep.equal([]);

    // Closing the listbox (single mode) abandons the in-progress query.
    await typeQuery(el, "che");
    values.length = 0;
    el.open = false;
    await el.updateComplete;
    expect(values, "closing the listbox must not emit lr-filter").to.deep.equal(
      []
    );
  });

  it("does not emit lr-filter for the programmatic setRangeText() editing API", async () => {
    const el = (await fixture(
      html`<lr-combobox multiple></lr-combobox>`
    )) as LyraCombobox;
    await typeQuery(el, "hello world");
    const { values } = trackFilter(el);

    el.setSelectionRange(6, 11, "forward");
    el.setRangeText("there", 6, 11, "select");
    await el.updateComplete;

    expect(el.input?.value).to.equal("hello there");
    expect(values).to.deep.equal([]);
  });

  it("reports the filter text, never the committed selection (single)", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.open = true;
    await el.updateComplete;
    (
      el.shadowRoot!.querySelectorAll('[part="option"]')[0] as HTMLElement
    ).click();
    await el.updateComplete;
    expect(el.value).to.equal("a");

    const { values } = trackFilter(el);
    await typeQuery(el, "che");

    expect(values).to.deep.equal(["che"]);
    expect(el.value).to.equal("a");
  });

  it("reports the filter text, never the committed selection (multiple)", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.multiple = true;
    el.open = true;
    await el.updateComplete;
    (
      el.shadowRoot!.querySelectorAll('[part="option"]')[0] as HTMLElement
    ).click();
    await el.updateComplete;
    expect(el.value).to.deep.equal(["a"]);

    const { values } = trackFilter(el);
    await typeQuery(el, "che");

    expect(values).to.deep.equal(["che"]);
    expect(el.value).to.deep.equal(["a"]);
  });
});

// -- ElementInternals availability -------------------------------------------
describe("ElementInternals availability", () => {
  it("does not throw when constructed in an environment without a real ElementInternals implementation (e.g. a downstream Vitest + happy-dom suite)", () => {
    const original = HTMLElement.prototype.attachInternals;
    // @ts-expect-error -- simulating an environment that lacks ElementInternals entirely
    delete HTMLElement.prototype.attachInternals;
    try {
      let el: LyraCombobox | undefined;
      expect(() => {
        el = document.createElement("lr-combobox") as LyraCombobox;
      }).to.not.throw();
      // Confirm the fallback keeps the rest of the public surface usable rather than merely
      // swallowing the constructor error.
      expect(el!.checkValidity()).to.be.true;
      expect(el!.form === null).to.be.true;
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

// -- Degraded-environment internals, slot tracking, and closed-list keys ------
describe("ElementInternals fallback", () => {
  /** Mirrors a DOM implementation without form-association support (a consumer's happy-dom/Vitest
   *  suite): the component must still construct and stay inert rather than throwing on import. */
  const withAttachInternals = async (
    impl: undefined | (() => never),
    assertion: (el: LyraCombobox) => void
  ): Promise<void> => {
    const proto = HTMLElement.prototype as unknown as {
      attachInternals?: unknown;
    };
    const original = proto.attachInternals;
    if (impl === undefined) delete proto.attachInternals;
    else proto.attachInternals = impl;
    try {
      const el = (await fixture(basic())) as LyraCombobox;
      assertion(el);
    } finally {
      proto.attachInternals = original;
    }
  };

  it("falls back to inert no-op internals when attachInternals is missing entirely", async () => {
    await withAttachInternals(undefined, (el) => {
      const internals = (el as unknown as { internals: ElementInternals })
        .internals;
      expect(internals.form === null).to.equal(true);
      expect(internals.willValidate).to.be.false;
      expect(internals.validationMessage).to.equal("");
      expect(internals.labels.length).to.equal(0);
      expect(internals.checkValidity()).to.be.true;
      expect(internals.reportValidity()).to.be.true;
      expect(() => internals.setFormValue("x")).to.not.throw();
      expect(() => internals.setValidity({}, "")).to.not.throw();
    });
  });

  it("falls back to inert no-op internals when attachInternals throws", async () => {
    await withAttachInternals(
      () => {
        throw new DOMException("not supported");
      },
      (el) => {
        const internals = (el as unknown as { internals: ElementInternals })
          .internals;
        expect(internals.willValidate).to.be.false;
        expect(internals.reportValidity()).to.be.true;
      }
    );
  });
});

describe("validity custom states", () => {
  it("publishes required/optional and valid/invalid from the first update", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(html`
      <lr-combobox required name="fruit">
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    expect(el.matches(":state(required)"), "required").to.be.true;
    expect(el.matches(":state(optional)"), "optional").to.be.false;
    expect(el.matches(":state(invalid)"), "invalid").to.be.true;
    expect(el.matches(":state(valid)"), "valid").to.be.false;

    el.value = "a";
    await el.updateComplete;
    expect(el.matches(":state(valid)"), "valid after a selection").to.be.true;
    expect(el.matches(":state(invalid)"), "invalid after a selection").to.be
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
    const el = (await fixture(html`
      <lr-combobox required name="fruit">
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    // Invalid, but nobody has had a turn yet: styling this red would be hostile, which is the
    // whole reason the `user-*` pair exists.
    expect(el.matches(":state(invalid)"), "invalid while pristine").to.be.true;
    expect(el.matches(":state(user-invalid)"), "user-invalid while pristine").to
      .be.false;
    expect(el.matches(":state(user-valid)"), "user-valid while pristine").to.be
      .false;

    const input = el.shadowRoot!.querySelector(
      '[part="combobox-input"]'
    ) as HTMLInputElement;
    input.dispatchEvent(new FocusEvent("blur"));
    await el.updateComplete;
    expect(el.matches(":state(user-invalid)"), "user-invalid after blur").to.be
      .true;
    expect(el.matches(":state(user-valid)"), "user-valid after blur").to.be
      .false;

    el.value = "a";
    await el.updateComplete;
    expect(el.matches(":state(user-valid)"), "user-valid once satisfied").to.be
      .true;
    expect(el.matches(":state(user-invalid)"), "user-invalid once satisfied").to
      .be.false;
  });

  it("counts a reportValidity() call as interaction, and a form reset as going pristine again", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const form = (await fixture(html`
      <form>
        <lr-combobox required name="fruit">
          <lr-option value="a">Apple</lr-option>
        </lr-combobox>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-combobox") as LyraCombobox;
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

describe("lr-combobox setCustomValidity()", () => {
  const inForm = () => html`
    <form>
      <lr-combobox name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-combobox>
    </form>
  `;

  it("blocks form submission with a consumer-supplied error, and reports it as validationMessage", async () => {
    const form = (await fixture(inForm())) as HTMLFormElement;
    const el = form.querySelector("lr-combobox") as LyraCombobox;
    await el.updateComplete;
    let submits = 0;
    // Registered before any requestSubmit() below, so a successful submission can never navigate
    // the test page.
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      submits += 1;
    });
    expect(el.checkValidity(), "valid before the custom error").to.be.true;

    el.setCustomValidity("That fruit is out of stock.");
    expect(el.validity.customError).to.be.true;
    expect(el.checkValidity()).to.be.false;
    expect(el.validationMessage).to.equal("That fruit is out of stock.");
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

  it('treats a nullish message the same as an empty string', async () => {
    const form = (await fixture(inForm())) as HTMLFormElement;
    const el = form.querySelector("lr-combobox") as LyraCombobox;
    await el.updateComplete;

    el.setCustomValidity("Rejected.");
    expect(el.validity.customError).to.be.true;

    el.setCustomValidity(null as unknown as string);
    expect(el.validity.customError).to.be.false;
    expect(el.validationMessage).to.equal("");
  });

  it("keeps a custom error through an intrinsic revalidation", async () => {
    const el = (await fixture(html`
      <lr-combobox required><lr-option value="a">Apple</lr-option></lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    el.setCustomValidity("Rejected by the server.");

    // Committing a selection re-runs updateValidity(), the traffic that would otherwise wipe the
    // custom error out on every interaction.
    el.value = "a";
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
      <form>
        <lr-combobox name="fruit">
          <lr-option value="a" selected>Apple</lr-option>
          <lr-option value="b">Banana</lr-option>
        </lr-combobox>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-combobox") as LyraCombobox;
    await el.updateComplete;
    el.value = "b";
    el.setCustomValidity("Already chosen by this order.");

    form.reset();
    await el.updateComplete;
    expect(el.value, "the reset restored the declarative default").to.equal(
      "a"
    );
    expect(el.validity.customError, "the custom error outlives the reset").to.be
      .true;
    expect(el.validationMessage).to.equal("Already chosen by this order.");
    expect(el.checkValidity()).to.be.false;
  });

  it("restores the computed validity when cleared, rather than forcing the control valid", async () => {
    const el = (await fixture(html`
      <lr-combobox required><lr-option value="a">Apple</lr-option></lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    expect(el.validity.valueMissing, "required and unselected to begin with").to
      .be.true;

    el.setCustomValidity("Rejected by the server.");
    expect(el.validity.customError).to.be.true;

    el.setCustomValidity("");
    expect(el.validity.customError).to.be.false;
    expect(
      el.validity.valueMissing,
      "an unselected required control is still missing a value"
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
    const el = (await fixture(basic())) as LyraCombobox;
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
});

describe("lr-combobox implicit form submission", () => {
  const enterOn = (el: LyraCombobox, init: KeyboardEventInit = {}) =>
    (
      el.shadowRoot!.querySelector(
        '[part="combobox-input"]'
      ) as HTMLInputElement
    ).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        composed: true,
        cancelable: true,
        ...init,
      })
    );

  const inForm = () => html`
    <form>
      <lr-combobox name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-combobox>
    </form>
  `;

  it("submits the ancestor form when Enter commits nothing in the listbox", async () => {
    const form = (await fixture(inForm())) as HTMLFormElement;
    const el = form.querySelector("lr-combobox") as LyraCombobox;
    await el.updateComplete;
    let submits = 0;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submits += 1;
    });
    enterOn(el);
    expect(submits).to.equal(1);
  });

  it("submits through an lr-button submitter, which requestSubmit() itself would reject", async () => {
    const form = (await fixture(html`
      <form>
        <lr-combobox name="fruit"
          ><lr-option value="a">Apple</lr-option></lr-combobox
        >
        <lr-button type="submit" name="action" value="save">Go</lr-button>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-combobox") as LyraCombobox;
    await el.updateComplete;
    let submitterName = "";
    let submits = 0;
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

  it("picks the active option instead of submitting while the listbox has one highlighted", async () => {
    const form = (await fixture(inForm())) as HTMLFormElement;
    const el = form.querySelector("lr-combobox") as LyraCombobox;
    await el.updateComplete;
    let submits = 0;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submits += 1;
    });
    el.show();
    await el.updateComplete;
    (
      el.shadowRoot!.querySelector(
        '[part="combobox-input"]'
      ) as HTMLInputElement
    ).dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
    await el.updateComplete;
    enterOn(el);
    await el.updateComplete;
    expect(el.value, "Enter committed the highlighted option").to.equal("a");
    expect(
      submits,
      "committing a selection is not implicit submission"
    ).to.equal(0);
  });

  it("never submits on a held modifier, during IME composition, or after a veto", async () => {
    const form = (await fixture(inForm())) as HTMLFormElement;
    const el = form.querySelector("lr-combobox") as LyraCombobox;
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

it("drops a consumer validity message and restores the intrinsic constraint", async () => {
  const el = (await fixture(
    html`<lr-combobox label="City" required
      ><lr-option value="paris">Paris</lr-option></lr-combobox
    >`
  )) as LyraCombobox;
  el.setCustomValidity("Pick a supported city");
  await el.updateComplete;
  expect(el.validity.customError).to.equal(true);
  expect(el.validationMessage).to.equal("Pick a supported city");

  el.resetValidity();
  await el.updateComplete;
  expect(el.validity.customError).to.equal(false);
  expect(el.validity.valueMissing).to.equal(true);
});

it("bars constraint validation while disabled, like a native disabled required control", async () => {
  const el = (await fixture(html`
    <lr-combobox required disabled label="Fruit"
      ><lr-option value="a">Apple</lr-option></lr-combobox
    >
  `)) as LyraCombobox;
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

it("bars constraint validation while readonly, like a native readonly required control", async () => {
  const el = (await fixture(html`
    <lr-combobox required readonly label="Fruit"
      ><lr-option value="a">Apple</lr-option></lr-combobox
    >
  `)) as LyraCombobox;
  await el.updateComplete;
  expect(el.validity.valueMissing, "a barred control raises no violation").to.be
    .false;
  expect(el.checkValidity()).to.be.true;

  el.readonly = false;
  await el.updateComplete;
  expect(
    el.validity.valueMissing,
    "the violation returns once it is enforceable again"
  ).to.be.true;
});

describe("formStateRestoreCallback (autofill/bfcache restore)", () => {
  it("restores an array-shaped persisted state in multiple mode", async () => {
    const el = (await fixture(html`
      <lr-combobox multiple>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    el.formStateRestoreCallback(JSON.stringify(["a", "b"]), "restore");
    await el.updateComplete;
    expect(el.value).to.deep.equal(["a", "b"]);
  });

  it("restores only the first value in single-select mode", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.formStateRestoreCallback(JSON.stringify(["a", "b"]), "autocomplete");
    await el.updateComplete;
    expect(el.value).to.equal("a");
  });

  it("falls back to an empty selection for malformed or non-array persisted state", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    for (const state of [
      "not json{{",
      JSON.stringify({ not: "an array" }),
      JSON.stringify([1, 2]),
    ]) {
      el.value = "a";
      await el.updateComplete;
      el.formStateRestoreCallback(state, "restore");
      await el.updateComplete;
      expect(el.value, `state: ${state}`).to.equal("");
    }
  });

  it("keeps a restored selection when a later live-selected option is slotted", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.formStateRestoreCallback(JSON.stringify(["a"]), "restore");
    await el.updateComplete;

    const later = document.createElement("lr-option");
    later.value = "z";
    later.textContent = "Zucchini";
    later.selected = true;
    el.append(later);
    await aTimeout(0);
    await el.updateComplete;

    expect(el.value).to.equal("a");
    expect(later.selected).to.equal(false);
  });
});

it("adopts a lazily-appended declarative <lr-option selected> as the new reset default without marking value dirty", async () => {
  // The initial option is deliberately unselected -- refreshOptionDefaults() re-derives
  // `_defaultSelected` from *every* currently-defaultSelected option and (in single-select mode)
  // keeps only the first one in document order, so seeding two simultaneously-declared defaults
  // here would make this assert on that unrelated tie-break rule instead of the lazy-arrival path.
  const el = (await fixture(html`
    <lr-combobox>
      <lr-option value="a">Apple</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;
  expect(el.value).to.equal("");

  const opt = document.createElement("lr-option");
  opt.setAttribute("value", "z");
  opt.textContent = "Zucchini";
  opt.toggleAttribute("selected", true); // declarative, not the live `.selected` property
  el.appendChild(opt);
  await aTimeout(0);
  await el.updateComplete;

  expect(el.value).to.equal("z");

  // Because this went through setValue(..., dirty: false), a form reset restores this new
  // declarative default rather than snapping back to the original "a".
  const form = document.createElement("form");
  form.appendChild(el);
  document.body.appendChild(form);
  form.reset();
  await el.updateComplete;
  expect(el.value, "the newly-declared default survives a reset").to.equal("z");
  form.remove();
});

it("resolves an external form owner, and exposes labels/willValidate/getForm()/validationTarget passthroughs", async () => {
  const root = await fixture(html`
    <div>
      <form id="ext"></form>
      <label for="target-input">Fruit</label>
      <lr-combobox id="target-input">
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    </div>
  `);
  const el = root.querySelector("lr-combobox") as LyraCombobox;
  const form = root.querySelector("form") as HTMLFormElement;
  await el.updateComplete;

  el.form = "ext";
  await el.updateComplete;
  expect(el.getAttribute("form")).to.equal("ext");
  expect(el.form === form).to.equal(true);
  expect(el.getForm() === form).to.equal(true);

  el.form = null;
  await el.updateComplete;
  expect(el.hasAttribute("form")).to.be.false;

  expect(
    el.labels.length,
    "the associated <label for> reaches the public labels getter"
  ).to.equal(1);
  expect(el.willValidate).to.be.a("boolean");

  const override = document.createElement("span");
  el.validationTarget = override;
  expect(el.validationTarget === override).to.equal(true);
  el.validationTarget = undefined;
  expect(el.validationTarget === (el.input ?? undefined)).to.equal(true);
});

describe("lr-combobox custom validators", () => {
  it("runs a function/object-validate validator through every result shape", async () => {
    const el = (await fixture(basic())) as LyraCombobox;

    el.validators = [() => true];
    expect(el.checkValidity(), "a true result passes").to.be.true;

    el.validators = [() => "Explicit message"];
    expect(el.checkValidity()).to.be.false;
    expect(el.validity.customError).to.be.true;
    expect(el.validationMessage).to.equal("Explicit message");

    el.validators = [() => false];
    expect(el.checkValidity()).to.be.false;
    expect(el.validity.customError).to.be.true;
    expect(el.validationMessage.length).to.be.greaterThan(0);

    el.validators = [() => ({ typeMismatch: true })];
    expect(el.checkValidity()).to.be.false;
    expect(el.validity.typeMismatch).to.be.true;

    el.validators = [
      () => {
        throw new Error("boom");
      },
    ];
    expect(el.checkValidity()).to.be.false;
    expect(el.validity.customError).to.be.true;

    el.validators = [{ validate: () => "Object-shaped validator message" }];
    expect(el.checkValidity()).to.be.false;
    expect(el.validationMessage).to.equal("Object-shaped validator message");

    el.validators = [];
    expect(el.checkValidity(), "clearing the array clears the violation").to.be
      .true;
  });

  it("receives the live value and keeps the intrinsic required constraint ahead of a passing validator", async () => {
    const el = (await fixture(html`
      <lr-combobox required>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    const seen: (string | string[])[] = [];
    el.validators = [
      (value) => {
        seen.push(value);
        return true;
      },
    ];

    expect(el.checkValidity(), "an empty required combobox still fails").to.be
      .false;
    expect(el.validity.valueMissing).to.be.true;

    el.value = "a";
    await el.updateComplete;
    expect(el.checkValidity()).to.be.true;
    expect(seen.at(-1)).to.equal("a");

    el.validators = [() => "Not that one"];
    expect(el.checkValidity()).to.be.false;
    expect(el.validationMessage).to.equal("Not that one");
  });

  it("supports an object checkValidity() validator, mapping invalidKeys and revalidating through observedAttributes", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    let allowed = false;
    el.validators = [
      {
        observedAttributes: ["data-external-flag"],
        checkValidity: () =>
          allowed
            ? { isValid: true, invalidKeys: [], message: "" }
            : {
                isValid: false,
                invalidKeys: [
                  "typeMismatch",
                  "not-a-real-key",
                ] as unknown as Exclude<keyof ValidityState, "valid">[],
                message: "External system rejected this choice",
              },
      },
    ];
    await el.updateComplete;

    expect(
      el.validity.typeMismatch,
      "validity ran without an explicit checkValidity() call"
    ).to.be.true;
    expect(el.validationMessage).to.equal(
      "External system rejected this choice"
    );

    allowed = true;
    const priv = el as unknown as { validityRevision: number };
    const revisionBefore = priv.validityRevision;
    el.setAttribute("data-external-flag", "go");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(
      priv.validityRevision,
      "the MutationObserver-driven revalidation ran"
    ).to.be.greaterThan(revisionBefore);
    expect(
      el.validity.typeMismatch,
      "revalidated without an explicit checkValidity() call"
    ).to.be.false;
  });

  it("falls back through checkValidity()'s own message to the validator's static or function message, and synthesizes customError when invalidKeys maps to nothing", async () => {
    const el = (await fixture(basic())) as LyraCombobox;

    el.validators = [
      {
        checkValidity: () => ({ isValid: false, invalidKeys: [], message: "" }),
        message: "Static object message",
      },
    ];
    expect(el.checkValidity()).to.be.false;
    expect(
      el.validity.customError,
      "no mapped invalidKeys synthesizes customError"
    ).to.be.true;
    expect(el.validationMessage).to.equal("Static object message");

    el.validators = [
      {
        checkValidity: () => ({ isValid: false, invalidKeys: [], message: "" }),
        message: () => "Function-derived object message",
      },
    ];
    expect(el.checkValidity()).to.be.false;
    expect(el.validationMessage).to.equal("Function-derived object message");

    el.validators = [
      {
        checkValidity: () => ({
          isValid: false,
          invalidKeys: ["customError"] as unknown as Exclude<
            keyof ValidityState,
            "valid"
          >[],
          message: "",
        }),
      },
    ];
    expect(el.checkValidity()).to.be.false;
    expect(
      el.validationMessage.length,
      "falls back to the localized default"
    ).to.be.greaterThan(0);
  });

  it("treats a missing invalidKeys/message on an object validator's result the same as an empty array/string", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.validators = [
      {
        checkValidity: () =>
          ({ isValid: false }) as unknown as {
            isValid: boolean;
            invalidKeys: Exclude<keyof ValidityState, "valid">[];
            message: string;
          },
      },
    ];
    expect(el.checkValidity()).to.be.false;
    expect(
      el.validity.customError,
      "an omitted invalidKeys maps to nothing, synthesizing customError"
    ).to.be.true;
    expect(el.validationMessage).to.equal("The value is invalid.");
  });

  it('treats a non-array validators property as no validators instead of throwing', async () => {
    const el = (await fixture(html`
      <lr-combobox required>
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    (el as unknown as { validators: unknown }).validators = null;
    await el.updateComplete;

    expect(
      el.checkValidity(),
      "a non-array validators must be treated as empty, not thrown from"
    ).to.be.false;
    expect(el.validity.valueMissing).to.be.true;
    expect(el.validity.customError).to.be.false;

    el.value = "a";
    await el.updateComplete;
    expect(
      el.checkValidity(),
      "the intrinsic required constraint alone now passes"
    ).to.be.true;
  });

  it('skips building the validator-attribute observer while assigning observedAttributes-bearing validators to a disconnected host', async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.remove();
    el.validators = [
      {
        observedAttributes: ["data-flag"],
        checkValidity: () => ({ isValid: true, invalidKeys: [], message: "" }),
      },
    ];
    await el.updateComplete;
    const priv = el as unknown as { validatorAttributeObserver?: unknown };
    expect(
      priv.validatorAttributeObserver === undefined,
      "a disconnected host must not build a live MutationObserver"
    ).to.equal(true);
  });

  it("ignores a validator whose observedAttributes getter throws, and disconnects an observer whose observe() throws", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.validators = [
      {
        get observedAttributes(): string[] {
          throw new Error("boom");
        },
        checkValidity: () => ({ isValid: true, invalidKeys: [], message: "" }),
      },
    ];
    await el.updateComplete;
    expect(el.checkValidity()).to.be.true;

    const originalObserve = MutationObserver.prototype.observe;
    const originalDisconnect = MutationObserver.prototype.disconnect;
    let disconnectCalls = 0;
    MutationObserver.prototype.observe = function () {
      throw new Error("forced failure for coverage");
    };
    MutationObserver.prototype.disconnect = function (...args: []) {
      disconnectCalls += 1;
      return originalDisconnect.apply(this, args);
    };
    try {
      el.validators = [
        {
          observedAttributes: ["data-flag"],
          checkValidity: () => ({
            isValid: true,
            invalidKeys: [],
            message: "",
          }),
        },
      ];
      await el.updateComplete;
    } finally {
      MutationObserver.prototype.observe = originalObserve;
      MutationObserver.prototype.disconnect = originalDisconnect;
    }
    expect(
      disconnectCalls,
      "a failed observe() triggers a disconnect() cleanup"
    ).to.be.greaterThan(0);
  });

  it("bars configured validators while disabled, exactly like the intrinsic constraint", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.validators = [() => "Always invalid"];
    expect(el.checkValidity()).to.be.false;

    el.disabled = true;
    await el.updateComplete;
    expect(el.checkValidity(), "a barred control reports no violation at all")
      .to.be.true;

    el.disabled = false;
    await el.updateComplete;
    expect(el.checkValidity()).to.be.false;
  });

  it("stops observing validator attributes once disconnected", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.validators = [
      {
        observedAttributes: ["data-external-flag"],
        checkValidity: () => ({ isValid: true, invalidKeys: [], message: "" }),
      },
    ];
    await el.updateComplete;
    const priv = el as unknown as {
      validityRevision: number;
      validatorAttributeObserver?: unknown;
    };
    expect(priv.validatorAttributeObserver === undefined).to.equal(false);
    const parent = el.parentElement!;
    el.remove();
    expect(priv.validatorAttributeObserver === undefined).to.equal(true);
    const revisionBefore = priv.validityRevision;
    el.setAttribute("data-external-flag", "go");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(priv.validityRevision).to.equal(revisionBefore);
    parent.append(el);
    await el.updateComplete;
    expect(
      priv.validatorAttributeObserver === undefined,
      "a reconnect rebuilds it"
    ).to.equal(false);
  });
});

// `''`, is a candidate value resolved against the current local options/async rows instead.
describe('empty-valued option as a stable controlled selection', () => {
  const withEmptyOption = () => html`
    <lr-combobox>
      <lr-option value="">None</lr-option>
      <lr-option value="a">Apple</lr-option>
    </lr-combobox>
  `;

  it('selects the empty-valued option when assigned programmatically', async () => {
    const el = (await fixture(withEmptyOption())) as LyraCombobox;
    el.value = 'a';
    await el.updateComplete;
    el.value = '';
    await el.updateComplete;
    expect(el.value, 'the empty-valued option is selected, not cleared').to.equal('');
    expect(el.selectedRows.length, 'a row actually matched').to.equal(1);
    expect(el.selectedRows[0]!.value).to.equal('');
  });

  it('selects the empty-valued option when its row is clicked (pointer path)', async () => {
    const el = (await fixture(withEmptyOption())) as LyraCombobox;
    el.open = true;
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector('[part="option"][data-value=""]') as HTMLElement;
    setTimeout(() => row.click());
    await oneEvent(el, 'change');
    expect(el.value).to.equal('');
    expect(el.selectedRows.length).to.equal(1);
  });

  it('undefined clears an existing selection, distinct from selecting the empty-valued option', async () => {
    const el = (await fixture(withEmptyOption())) as LyraCombobox;
    el.value = 'a';
    await el.updateComplete;
    el.value = undefined;
    await el.updateComplete;
    expect(el.value).to.equal('');
    expect(el.selectedRows.length, 'no row matched -- this really is a clear').to.equal(0);
  });

  it('null clears an existing selection, distinct from selecting the empty-valued option', async () => {
    const el = (await fixture(withEmptyOption())) as LyraCombobox;
    el.value = 'a';
    await el.updateComplete;
    el.value = null;
    await el.updateComplete;
    expect(el.value).to.equal('');
    expect(el.selectedRows.length).to.equal(0);
  });

  it('multiple mode: an empty string in the array selects the empty-valued occurrence alongside others', async () => {
    const el = (await fixture(html`
      <lr-combobox multiple>
        <lr-option value="">None</lr-option>
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    el.value = ['', 'a'];
    await el.updateComplete;
    expect(el.value).to.deep.equal(['', 'a']);
  });

  it('multiple mode: an empty array still clears, distinct from selecting the empty-valued option', async () => {
    const el = (await fixture(html`
      <lr-combobox multiple>
        <lr-option value="">None</lr-option>
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    el.value = ['', 'a'];
    await el.updateComplete;
    el.value = [];
    await el.updateComplete;
    expect(el.value).to.deep.equal([]);
  });

  it('restores the empty-valued option on form.reset() when it is the declared default', async () => {
    const form = (await fixture(html`
      <form>
        <lr-combobox name="choice">
          <lr-option value="" selected>None</lr-option>
          <lr-option value="a">Apple</lr-option>
        </lr-combobox>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-combobox') as LyraCombobox;
    await el.updateComplete;
    expect(el.value, 'the declared selected="" default selects the empty-valued option').to.equal('');
    expect(el.selectedRows.length).to.equal(1);

    el.value = 'a';
    await el.updateComplete;
    form.reset();
    await el.updateComplete;
    expect(el.value).to.equal('');
    expect(
      el.selectedRows.length,
      'reset restores the matched empty-valued option, not a bare clear'
    ).to.equal(1);
  });
});

// submitted with the form -- mirrors `<lr-input>`'s own `readonly`.
describe("readonly", () => {
  it("defaults to false and is not reflected", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    expect(el.readonly).to.be.false;
    expect(el.hasAttribute("readonly")).to.be.false;
  });

  it("reflects the attribute both ways", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.readonly = true;
    await el.updateComplete;
    expect(el.hasAttribute("readonly")).to.be.true;

    el.readonly = false;
    await el.updateComplete;
    expect(el.hasAttribute("readonly")).to.be.false;
  });

  it("forwards readonly, not disabled, to the native filter input -- it stays focusable", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.readonly = true;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(
      '[part="combobox-input"]'
    ) as HTMLInputElement;
    expect(input.readOnly).to.be.true;
    expect(input.disabled).to.be.false;

    input.focus();
    expect(el.shadowRoot!.activeElement === input, "still focusable").to.be
      .true;
  });

  it("rejects opening the listbox while readonly, including a direct .show() call", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.readonly = true;
    await el.updateComplete;

    el.open = true;
    await el.updateComplete;
    expect(el.open, "direct open write is rejected").to.be.false;

    await el.show();
    expect(el.open, ".show() is rejected too").to.be.false;
  });

  it("does not open the listbox on focus or ArrowDown while readonly", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.readonly = true;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(
      '[part="combobox-input"]'
    ) as HTMLInputElement;

    input.dispatchEvent(
      new FocusEvent("focus", { bubbles: true, composed: true })
    );
    await el.updateComplete;
    expect(el.open, "focus must not open the listbox while readonly").to.be
      .false;

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })
    );
    await el.updateComplete;
    expect(el.open, "ArrowDown must not open the listbox while readonly").to
      .be.false;
  });

  it("blocks Backspace-driven tag removal in multiple mode", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.multiple = true;
    el.value = ["a", "b"];
    el.readonly = true;
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector(
      '[part="combobox-input"]'
    ) as HTMLInputElement;

    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, composed: true })
    );
    await el.updateComplete;

    expect(el.value).to.deep.equal(["a", "b"]);
  });

  it("disables the tag remove button so a click cannot change the value", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.multiple = true;
    el.value = ["a", "b"];
    el.readonly = true;
    await el.updateComplete;

    const removeButton = el.shadowRoot!.querySelector(
      '[part="tag__remove-button"]'
    ) as HTMLButtonElement;
    expect(removeButton.disabled, "the remove button is disabled").to.be
      .true;

    removeButton.click();
    await el.updateComplete;
    expect(el.value).to.deep.equal(["a", "b"]);
  });

  it("hides and disables the clear button", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.clearable = true;
    el.value = "a";
    el.readonly = true;
    await el.updateComplete;

    const clearButton = el.shadowRoot!.querySelector(
      '[part="clear-button"]'
    ) as HTMLButtonElement | null;
    if (clearButton) expect(clearButton.disabled).to.be.true;
  });

  it("still submits the committed value with the form while readonly", async () => {
    const form = (await fixture(html`
      <form>
        <lr-combobox name="fruit">
          <lr-option value="a">Apple</lr-option>
        </lr-combobox>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-combobox") as LyraCombobox;
    el.value = "a";
    el.readonly = true;
    await el.updateComplete;

    expect(
      new FormData(form).get("fruit"),
      "a readonly control still submits its value"
    ).to.equal("a");
  });

  it("unset-regression: with readonly false (the default), the listbox opens and tags remain removable exactly as before", async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.multiple = true;
    el.value = ["a", "b"];
    await el.updateComplete;
    expect(el.readonly).to.be.false;

    await el.show();
    expect(el.open).to.be.true;
    await el.hide();

    const removeButton = el.shadowRoot!.querySelector(
      '[part="tag__remove-button"]'
    ) as HTMLButtonElement;
    expect(removeButton.disabled).to.be.false;
    removeButton.click();
    await el.updateComplete;
    expect(el.value).to.deep.equal(["b"]);
  });
});
