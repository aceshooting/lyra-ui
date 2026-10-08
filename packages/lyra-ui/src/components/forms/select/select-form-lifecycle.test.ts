import { fixture, expect, html, waitUntil, aTimeout } from '@open-wc/testing';
import { assertInvalidAlias } from '../../../../test/contracts/invalid-alias.js';
import { withUnavailableInternals } from '../../../../test/contracts/form-lifecycle.js';
import './select.js';
import '../combobox/option.js';
import type { LyraSelect } from './select.js';
import type { LyraOption } from '../combobox/option.js';
import { LyraElement } from '../../../internal/lyra-element.js';


const basic = () => html`
  <lr-select>
    <lr-option value="a">Apple</lr-option>
    <lr-option value="b">Banana</lr-option>
    <lr-option value="c">Cherry</lr-option>
  </lr-select>
`;

function trigger(el: LyraSelect): HTMLButtonElement {
  return el.shadowRoot!.querySelector('[part="trigger"]') as HTMLButtonElement;
}

// `internals.states` (CustomStateSet) reached Chromium 125 / Safari 17.4 / Firefox 126, and the
// `:state()` SELECTOR landed separately from the API. Both are guarded because the helper no-ops
// where either is missing -- an unguarded assertion fails on WebKit rather than skipping.
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



it("emits one cancelable lr-invalid alias when a validity check fails", async () => {
  const el = (await fixture(html`
    <lr-select required label="Fruit"
      ><lr-option value="a">Apple</lr-option></lr-select
    >
  `)) as LyraSelect;
  assertInvalidAlias(el);
});


it("cancels the native invalid event when the lr-invalid alias is cancelled", async () => {
  const el = (await fixture(html`
    <lr-select required label="Fruit"
      ><lr-option value="a">Apple</lr-option></lr-select
    >
  `)) as LyraSelect;
  assertInvalidAlias(el, { alias: 'cancel', native: 'cancelled' });
});


it("participates in a form: value reflects in FormData on submit", async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-select") as LyraSelect;
  el.value = "b";
  await el.updateComplete;
  expect(new FormData(form).get("fruit")).to.equal("b");
});


it("submits an untouched empty value instead of omitting the named control", async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;

  const data = new FormData(form);
  expect(data.has("fruit")).to.be.true;
  expect(data.get("fruit")).to.equal("");
});


it("blocks a required, empty select from submitting the form", async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit" required>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;
});


it("allows a required select to submit once a value is selected", async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit" required>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-select") as LyraSelect;
  el.value = "a";
  await el.updateComplete;
  expect(form.reportValidity()).to.be.true;
});


it("focuses the inner trigger after direct and submit-driven validity reporting", async () => {
  const form = (await fixture(html`
    <form>
      <button type="button">Before select</button>
      <lr-select name="fruit" required>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const sentinel = form.querySelector("button") as HTMLButtonElement;
  const el = form.querySelector("lr-select") as LyraSelect;
  let submitCount = 0;
  form.addEventListener("submit", (event) => {
    submitCount += 1;
    event.preventDefault();
  });

  sentinel.focus();
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal("lr-select");
  expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal(
    "trigger"
  );

  sentinel.focus();
  form.requestSubmit();
  expect(submitCount).to.equal(0);
  expect(document.activeElement?.localName).to.equal("lr-select");
  expect(el.shadowRoot!.activeElement?.getAttribute("part")).to.equal(
    "trigger"
  );
});


it("updates dynamic required validity synchronously without awaiting a Lit update", async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;

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
      <lr-select name="fruit">
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-select") as LyraSelect;
  el.value = "a";
  expect(new FormData(form).get("fruit")).to.equal("a");

  el.disabled = true;
  expect(el.hasAttribute("disabled")).to.be.true;
  expect(new FormData(form).has("fruit")).to.be.false;

  el.disabled = false;
  expect(el.hasAttribute("disabled")).to.be.false;
  expect(new FormData(form).get("fruit")).to.equal("a");
});


it("seeds the initial selection from a declaratively-selected <lr-option>", async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b" selected>Banana</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  expect(el.value).to.equal("b");
});


it("restores the declared default selection on form.reset()", async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b" selected>Banana</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-select") as LyraSelect;
  await el.updateComplete;
  el.value = "a";
  form.reset();
  expect(el.value).to.equal("b");
});


it("updates the reset baseline from defaultSelected without changing a dirty live selection", async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b" selected>Banana</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-select") as LyraSelect;
  const [apple, banana] = [...el.querySelectorAll("lr-option")] as LyraOption[];
  if (!apple || !banana) {
    throw new Error('Expected both reset-baseline options.');
  }
  await el.updateComplete;

  el.value = "b";
  apple.defaultSelected = true;
  banana.defaultSelected = false;
  await Promise.all([
    apple.updateComplete,
    banana.updateComplete,
    el.updateComplete,
  ]);
  expect(
    el.value,
    "changing the reset default is event-silent and does not overwrite live state"
  ).to.equal("b");

  form.reset();
  expect(el.value).to.equal("a");
  expect(apple.selected).to.equal(true);
  expect(banana.selected).to.equal(false);
});


it("applies post-mount defaultSelected changes to a pristine live selection", async () => {
  const el = (await fixture(html`
    <lr-select><lr-option value="a">Apple</lr-option></lr-select>
  `)) as LyraSelect;
  const option = el.querySelector("lr-option") as LyraOption;
  await el.updateComplete;
  expect(el.value).to.equal("");

  option.defaultSelected = true;
  await option.updateComplete;
  await el.updateComplete;
  expect(el.value).to.equal("a");
  expect(option.selected).to.equal(true);

  option.defaultSelected = false;
  await option.updateComplete;
  await el.updateComplete;
  expect(el.value).to.equal("");
  expect(option.selected).to.equal(false);
});


it("preserves an initial property-only selected write until reset reapplies a later default", async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit" multiple>
        <lr-option value="a" .selected=${true}>Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-select") as LyraSelect;
  const [, banana] = [...el.querySelectorAll("lr-option")] as LyraOption[];
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


it("retains a defaultSelected refresh when the parent detaches during option notification", async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit"><lr-option value="a">Apple</lr-option></lr-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-select") as LyraSelect;
  const option = el.querySelector("lr-option") as LyraOption;
  await el.updateComplete;

  option.addEventListener("lr-option-change", () => el.remove(), {
    once: true,
  });
  option.defaultSelected = true;
  await option.updateComplete;
  await Promise.resolve();
  form.append(el);
  await el.updateComplete;

  expect(el.value).to.equal("a");
  el.value = "";
  form.reset();
  expect(el.value).to.equal("a");
});


it("adopts a property-only dirty .selected write in single mode too, not just multiple", async () => {
  const el = (await fixture(html`
    <lr-select>
      <lr-option value="a" .selected=${true}>Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  expect(el.value).to.equal("a");
});


it("leaves nothing selected when the only dirty option was written back to unselected before mount", async () => {
  const option = document.createElement("lr-option") as LyraOption;
  option.value = "a";
  option.textContent = "Apple";
  option.selected = true;
  option.selected = false;
  const el = document.createElement("lr-select") as LyraSelect;
  el.append(option);
  document.body.append(el);
  await el.updateComplete;
  try {
    expect(
      el.value,
      "the dirty write is honoured even though it now says unselected"
    ).to.equal("");
  } finally {
    el.remove();
  }
});


it("commits a default-value with no matching option, mirroring a lazily-populated list", async () => {
  const el = (await fixture(html`
    <lr-select default-value="ghost">
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  expect(
    el.value,
    "the not-yet-existent default is still committed verbatim"
  ).to.equal("ghost");
});


it("does not let a late-arriving selected option override a value restored from form state", async () => {
  const el = (await fixture(
    html`<lr-select><lr-option value="a">Apple</lr-option></lr-select>`
  )) as LyraSelect;
  await el.updateComplete;
  el.formStateRestoreCallback("a", "restore");
  await el.updateComplete;
  expect(el.value).to.equal("a");

  const banana = document.createElement("lr-option") as LyraOption;
  banana.value = "b";
  banana.textContent = "Banana";
  banana.selected = true;
  el.append(banana);
  await el.updateComplete;
  expect(
    el.value,
    "a restored value outranks a newly-slotted selected option"
  ).to.equal("a");
});


it("merges a late-arriving live-selected option into an existing multi-select selection", async () => {
  const el = (await fixture(html`
    <lr-select multiple>
      <lr-option value="a" selected>Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  expect(el.value).to.deep.equal(["a"]);

  const banana = document.createElement("lr-option") as LyraOption;
  banana.value = "b";
  banana.textContent = "Banana";
  banana.selected = true;
  el.append(banana);
  await el.updateComplete;
  expect(el.value).to.deep.equal(["a", "b"]);
});


it("adopts a late-arriving declaratively-defaulted option into a pristine single selection", async () => {
  const el = (await fixture(
    html`<lr-select><lr-option value="a">Apple</lr-option></lr-select>`
  )) as LyraSelect;
  await el.updateComplete;
  expect(el.value).to.equal("");

  const banana = document.createElement("lr-option") as LyraOption;
  banana.value = "b";
  banana.textContent = "Banana";
  banana.defaultSelected = true;
  el.append(banana);
  await el.updateComplete;
  expect(el.value).to.equal("b");
});


it("resets to empty via form.reset() when no option was declared selected", async () => {
  const form = (await fixture(html`
    <form>
      <lr-select name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-select") as LyraSelect;
  await el.updateComplete;
  el.value = "a";
  el.value = "b";
  form.reset();
  expect(el.value).to.equal("");
});


it("does not open or select when disabled", async () => {
  const el = (await fixture(html`
    <lr-select disabled>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;

  trigger(el).click();
  await el.updateComplete;
  expect(el.open).to.be.false;
  expect(trigger(el).disabled).to.be.true;
});


it("force-closes when disabled and rejects every later open write without a vetoable lifecycle", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  const lifecycle: string[] = [];
  for (const type of ["lr-hide", "lr-after-hide"]) {
    el.addEventListener(type, (event) => {
      lifecycle.push(type);
      event.preventDefault();
    });
  }

  el.disabled = true;
  expect(el.open, "the disabled invariant is synchronous").to.be.false;
  await el.updateComplete;
  expect(el.hasAttribute("open")).to.be.false;
  expect(trigger(el).getAttribute("aria-expanded")).to.equal("false");
  expect(
    getComputedStyle(el.shadowRoot!.querySelector('[part="listbox"]')!)
      .visibility
  ).to.equal("hidden");
  expect(
    lifecycle,
    "policy closure is not an author-vetoable transition"
  ).to.deep.equal([]);

  el.open = true;
  expect(el.open, "a property write cannot violate the invariant").to.be.false;
  el.setAttribute("open", "");
  expect(el.open, "an attribute write cannot violate the invariant").to.be
    .false;
  expect(el.hasAttribute("open")).to.be.false;

  el.disabled = false;
  await el.updateComplete;
  el.open = true;
  await el.updateComplete;
  const pendingHide = el.hide();
  el.disabled = true;
  await pendingHide;
  await el.updateComplete;
  expect(
    el.open,
    "disablement also supersedes an ordinary close pending its veto point"
  ).to.be.false;
  expect(lifecycle).to.deep.equal([]);
});


it("does not let a closed disable-enable batch suppress or strand a same-task show transition", async () => {
  const el = (await fixture(html`
    <lr-select style="--lr-transition-fast: 1ms linear">
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  const lifecycle: string[] = [];
  el.addEventListener("lr-show", () => lifecycle.push("lr-show"));
  el.addEventListener("lr-after-show", () => lifecycle.push("lr-after-show"));

  el.disabled = true;
  el.disabled = false;
  const shown = el.show();
  const settled = await Promise.race([
    shown.then(() => true),
    // wait-reason: upper bound on a promise that must resolve; failure path only
    aTimeout(5000).then(() => false),
  ]);
  await el.updateComplete;

  expect(settled, "show() must not leave its after-show waiter stranded").to.be
    .true;
  expect(el.open).to.be.true;
  expect(lifecycle).to.deep.equal(["lr-show", "lr-after-show"]);
});


it("normalizes initially-open disabled markup to a closed listbox", async () => {
  const el = (await fixture(html`
    <lr-select disabled open><lr-option value="a">Apple</lr-option></lr-select>
  `)) as LyraSelect;
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(el.hasAttribute("open")).to.be.false;
  expect(trigger(el).getAttribute("aria-expanded")).to.equal("false");
});


it("normalizes parser-created open markup inside a genuinely disabled fieldset", async () => {
  const fieldset = (await fixture(html`
    <fieldset disabled>
      <lr-select open><lr-option value="a">Apple</lr-option></lr-select>
    </fieldset>
  `)) as HTMLFieldSetElement;
  const el = fieldset.querySelector("lr-select") as LyraSelect;
  await el.updateComplete;

  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to
    .be.true;
  expect(el.open).to.be.false;
  expect(el.hasAttribute("open")).to.be.false;
  expect(trigger(el).disabled).to.be.true;
  expect(trigger(el).getAttribute("aria-expanded")).to.equal("false");
  expect(
    getComputedStyle(el.shadowRoot!.querySelector('[part="listbox"]')!)
      .visibility
  ).to.equal("hidden");
});


it("disables the select when its containing fieldset is disabled", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-select name="fruit">
          <lr-option value="a">Apple</lr-option>
        </lr-select>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-select") as LyraSelect;
  const fieldset = form.querySelector("fieldset") as HTMLFieldSetElement;
  await el.updateComplete;
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to
    .be.false;

  fieldset.disabled = true;
  await el.updateComplete;
  // `el.disabled` (the consumer-facing IDL property/attribute) is never
  // mutated by fieldset cascading -- only the combined `effectiveDisabled`
  // reflects it (mirrors lr-combobox's identical `_fieldsetDisabled`/
  // `effectiveDisabled` pattern).
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to
    .be.true;
  expect(el.disabled).to.be.false;
  const triggerEl = el.shadowRoot!.querySelector(
    '[part="trigger"]'
  ) as HTMLElement;
  expect(getComputedStyle(triggerEl).opacity).to.equal("0.5");
  expect(getComputedStyle(triggerEl).cursor).to.equal("not-allowed");
  let delegatedCalls = 0;
  triggerEl.click = () => {
    delegatedCalls += 1;
  };
  triggerEl.focus = () => {
    delegatedCalls += 1;
  };
  el.click();
  el.focus();
  expect(
    delegatedCalls,
    "fieldset disablement gates host click/focus delegation"
  ).to.equal(0);
});


it("force-closes when fieldset-disabled even when lr-hide is vetoed", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.open = true;
  await el.updateComplete;
  let hides = 0;
  el.addEventListener("lr-hide", (event) => {
    hides += 1;
    event.preventDefault();
  });

  (
    el as unknown as { formDisabledCallback(disabled: boolean): void }
  ).formDisabledCallback(true);
  expect(el.open).to.be.false;
  await el.updateComplete;
  expect(hides).to.equal(0);
  expect(trigger(el).disabled).to.be.true;
  expect(trigger(el).getAttribute("aria-expanded")).to.equal("false");
});


it("restores its own explicit `disabled` after an ancestor fieldset re-enables", async () => {
  const el = (await fixture(
    html`<lr-select disabled></lr-select>`
  )) as LyraSelect;
  (
    el as unknown as { formDisabledCallback(d: boolean): void }
  ).formDisabledCallback(true);
  (
    el as unknown as { formDisabledCallback(d: boolean): void }
  ).formDisabledCallback(false);
  await el.updateComplete;
  expect(el.disabled).to.be.true;
});


it("reflects a property-assigned `name` synchronously, with no await, so same-tick FormData submission sees it", async () => {
  const el = (await fixture(html`<lr-select></lr-select>`)) as LyraSelect;
  el.name = "region";
  expect(el.getAttribute("name")).to.equal("region");
});


it("marks touched from a real user blur of the trigger", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  trigger(el).focus();
  await el.updateComplete;
  expect((el as unknown as { touched: boolean }).touched, "not yet blurred").to
    .be.false;

  trigger(el).blur();
  await el.updateComplete;
  expect(
    (el as unknown as { touched: boolean }).touched,
    "a real blur marks touched"
  ).to.be.true;
});

// Disabling a focused native form control (input/select/
// textarea/button) is plain platform behavior that forces a blur -- nothing to do with custom
// elements specifically. That forced blur is not a real user interaction and must not mark the
// field touched, since (depending on exact timing) it could reenter an in-flight Lit update and
// trip Lit's dev-mode "scheduled an update after an update completed" warning.

it("does not mark touched from a blur caused by the trigger itself becoming disabled", async () => {
  // Never chai-compare DOM nodes directly (hangs the whole file) -- compare identity as a plain
  // boolean instead.
  const el = (await fixture(basic())) as LyraSelect;
  trigger(el).focus();
  await el.updateComplete;
  expect(
    el.shadowRoot!.activeElement === trigger(el),
    "trigger holds focus before disabling"
  ).to.be.true;

  el.disabled = true;
  await el.updateComplete;
  // The platform's own force-blur can trail the render commit by an unpredictable amount on some
  // engines (observed on Firefox/WebKit; Chromium settles within updateComplete alone) -- poll
  // instead of guessing a fixed delay.
  await waitUntil(
    () => el.shadowRoot!.activeElement === null,
    "the platform never force-blurred the disabled trigger",
    { timeout: 2000 }
  );

  expect(
    el.shadowRoot!.activeElement === null,
    "the platform force-blurred the now-disabled trigger"
  ).to.be.true;
  expect(
    (el as unknown as { touched: boolean }).touched,
    "a disable-forced blur must not mark the field touched"
  ).to.be.false;
});


it("reflects an invalid state only after the field has been interacted with once", async () => {
  const el = (await fixture(html`
    <lr-select required>
      <lr-option value="a">Apple</lr-option>
    </lr-select>
  `)) as LyraSelect;
  await el.updateComplete;
  expect(el.hasAttribute("data-invalid")).to.be.false;

  trigger(el).dispatchEvent(new FocusEvent("blur"));
  await el.updateComplete;
  expect(el.hasAttribute("data-invalid")).to.be.true;
});


describe("validationMessage localization", () => {
  it("defaults to the built-in English validationMessage for a required, unselected control", async () => {
    const el = (await fixture(html`
      <lr-select required>
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    expect(el.validationMessage).to.equal("Please select an option.");
  });

  it("localizes the validationMessage via this.localize() when .strings overrides selectValueMissing", async () => {
    const el = (await fixture(html`
      <lr-select
        required
        .strings=${{ selectValueMissing: "Veuillez sélectionner une option." }}
      >
        <lr-option value="a">Apple</lr-option>
      </lr-select>
    `)) as LyraSelect;
    expect(el.validationMessage).to.equal("Veuillez sélectionner une option.");

    el.value = "a";
    expect(el.validationMessage).to.equal("");
  });
});


describe("ElementInternals availability", () => {
  it("does not throw when constructed in an environment without a real ElementInternals implementation (e.g. a downstream Vitest + happy-dom suite)", () => {
    withUnavailableInternals(() => {
      let el: LyraSelect | undefined;
      expect(() => {
        el = document.createElement("lr-select") as LyraSelect;
      }).to.not.throw();
      // Confirm the fallback keeps the rest of the public surface usable rather than merely
      // swallowing the constructor error.
      expect(el!.checkValidity()).to.be.true;
      expect(el!.form === null).to.equal(true);
    });
  });
});


describe("ElementInternals unavailable at call time (attachInternals throws)", () => {
  it("falls back to no-op ElementInternals when attachInternals() exists but throws (e.g. already attached elsewhere)", () => {
    withUnavailableInternals(() => {
      let el: LyraSelect | undefined;
      expect(() => {
        el = document.createElement("lr-select") as LyraSelect;
      }).to.not.throw();
      expect(el!.checkValidity()).to.be.true;
      expect(el!.reportValidity()).to.be.true;
      expect(el!.form === null).to.equal(true);
    }, () => new Error('already attached'));
  });
});


it("normalizes a nullish name assignment to the empty string and removes the name attribute", async () => {
  const el = (await fixture(
    html`<lr-select name="fruit"></lr-select>`
  )) as LyraSelect;
  expect(el.getAttribute("name")).to.equal("fruit");
  (el as unknown as { name: string }).name = null as unknown as string;
  expect(el.name).to.equal("");
  expect(el.hasAttribute("name")).to.be.false;
});


it("normalizes a nullish value assignment to the empty string", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  el.value = "a";
  (el as unknown as { value: string }).value = null as unknown as string;
  expect(el.value).to.equal("");
});


describe("formStateRestoreCallback", () => {
  it("restores a string form state verbatim", () => {
    const el = document.createElement("lr-select") as LyraSelect;
    (
      el as unknown as {
        formStateRestoreCallback(
          state: string | File | FormData | null,
          mode?: "restore" | "autocomplete"
        ): void;
      }
    ).formStateRestoreCallback("a", "restore");
    expect(el.value).to.equal("a");
  });

  it("restores to empty when the browser hands it a non-string state (e.g. null)", () => {
    const el = document.createElement("lr-select") as LyraSelect;
    el.value = "a";
    (
      el as unknown as {
        formStateRestoreCallback(
          state: string | File | FormData | null,
          mode?: "restore" | "autocomplete"
        ): void;
      }
    ).formStateRestoreCallback(null, "restore");
    expect(el.value).to.equal("");
  });
});


describe("ElementInternals fallback (lr-select)", () => {
  /** Mirrors a DOM implementation without form-association support (a consumer's happy-dom/Vitest
   *  suite). `attachInternals()` is browser-only, so the component swaps in inert no-op internals
   *  rather than throwing at construction -- every member has to answer, and value changes must
   *  still work with form participation simply unavailable. */
  const withoutAttachInternals = async (
    impl: undefined | (() => never),
    assertion: (el: LyraSelect) => void | Promise<void>
  ): Promise<void> => {
    const proto = HTMLElement.prototype as unknown as {
      attachInternals?: unknown;
    };
    const original = proto.attachInternals;
    if (impl === undefined) delete proto.attachInternals;
    else proto.attachInternals = impl;
    try {
      const el = (await fixture(
        html`<lr-select label="Meter"
          ><lr-option value="a">A</lr-option></lr-select
        >`
      )) as LyraSelect;
      await el.updateComplete;
      await assertion(el);
    } finally {
      proto.attachInternals = original;
    }
  };

  it("answers inertly when attachInternals is missing", async () => {
    await withoutAttachInternals(undefined, async (el) => {
      const internals = (el as unknown as { internals: ElementInternals })
        .internals;
      expect(internals.form === null).to.equal(true);
      expect(internals.willValidate).to.be.false;
      expect(internals.validationMessage).to.equal("");
      expect(internals.checkValidity()).to.be.true;
      expect(internals.reportValidity()).to.be.true;
      expect(() => internals.setFormValue("x")).to.not.throw();
      expect(() => internals.setValidity({}, "")).to.not.throw();
      el.value = "a";
      await el.updateComplete;
    });
  });

  it("answers inertly when attachInternals throws", async () => {
    await withoutAttachInternals(
      () => {
        throw new DOMException("unsupported");
      },
      (el) => {
        const internals = (el as unknown as { internals: ElementInternals })
          .internals;
        expect(internals.willValidate).to.be.false;
        expect(internals.reportValidity()).to.be.true;
        expect(internals.checkValidity()).to.be.true;
      }
    );
  });

  it("takes the direct no-op path when nothing in the prototype chain implements attachInternals", async () => {
    // `LyraElement` itself declares an `override attachInternals()` (to capture form internals for
    // shared infrastructure), which always shadows `HTMLElement.prototype.attachInternals` -- so
    // deleting only the native one (as the sibling "is missing" test above does) never reaches
    // `attachInternalsSafely`'s own `typeof host.attachInternals !== 'function'` guard: the lookup
    // still finds LyraElement's own method (a real function), which then *calls* the missing
    // native one and throws, exercising the catch branch instead (same as "throws" above). Removing
    // LyraElement's override too is the only way to actually hit the guard's early-return branch.
    const htmlProto = HTMLElement.prototype as unknown as {
      attachInternals?: unknown;
    };
    const lyraProto = LyraElement.prototype as unknown as {
      attachInternals?: unknown;
    };
    const originalHtml = htmlProto.attachInternals;
    const hadOwnLyra = Object.prototype.hasOwnProperty.call(
      lyraProto,
      "attachInternals"
    );
    const originalLyra = lyraProto.attachInternals;
    delete htmlProto.attachInternals;
    delete lyraProto.attachInternals;
    try {
      const el = (await fixture(
        html`<lr-select label="Meter"
          ><lr-option value="a">A</lr-option></lr-select
        >`
      )) as LyraSelect;
      await el.updateComplete;
      const internals = (el as unknown as { internals: ElementInternals })
        .internals;
      expect(internals.willValidate).to.be.false;
      expect(internals.checkValidity()).to.be.true;
      expect(internals.reportValidity()).to.be.true;
      expect(() => internals.setFormValue("x")).to.not.throw();
    } finally {
      htmlProto.attachInternals = originalHtml;
      if (hadOwnLyra) lyraProto.attachInternals = originalLyra;
      else delete lyraProto.attachInternals;
    }
  });
});

describe("lr-select validity custom states", () => {
  const required = () => html`
    <lr-select required>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
    </lr-select>
  `;

  it("publishes required/optional and valid/invalid from the first render", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(required())) as LyraSelect;
    await el.updateComplete;
    expect(el.matches(":state(required)"), "required").to.be.true;
    expect(el.matches(":state(optional)"), "optional").to.be.false;
    expect(el.matches(":state(invalid)"), "invalid").to.be.true;
    expect(el.matches(":state(valid)"), "valid").to.be.false;

    const optional = (await fixture(basic())) as LyraSelect;
    await optional.updateComplete;
    expect(optional.matches(":state(optional)")).to.be.true;
    expect(optional.matches(":state(valid)")).to.be.true;
  });

  it("withholds user-valid/user-invalid until the user has actually interacted", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const el = (await fixture(required())) as LyraSelect;
    await el.updateComplete;
    expect(
      el.matches(":state(user-invalid)"),
      "pristine required must not read as an error"
    ).to.be.false;

    el.reportValidity();
    expect(
      el.matches(":state(user-invalid)"),
      "a submit attempt counts as interaction"
    ).to.be.true;

    el.value = "a";
    await el.updateComplete;
    expect(el.matches(":state(valid)")).to.be.true;
    expect(el.matches(":state(user-valid)")).to.be.true;
    expect(el.matches(":state(user-invalid)")).to.be.false;
  });

  it("goes pristine again after a form reset", async function () {
    if (!supportsCustomStates || !supportsStateSelector) this.skip();
    const form = await fixture<HTMLFormElement>(html`
      <form>
        <lr-select name="fruit" required>
          <lr-option value="a">Apple</lr-option>
        </lr-select>
      </form>
    `);
    const el = form.querySelector("lr-select") as LyraSelect;
    await el.updateComplete;
    el.reportValidity();
    expect(el.matches(":state(user-invalid)")).to.be.true;
    form.reset();
    await el.updateComplete;
    expect(
      el.matches(":state(user-invalid)"),
      "reset returns the control to pristine"
    ).to.be.false;
    expect(el.matches(":state(invalid)")).to.be.true;
  });
});


describe("lr-select setCustomValidity()", () => {
  const inForm = () => html`
    <form>
      <lr-select name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-select>
    </form>
  `;

  it("blocks form submission with a consumer-supplied error, and reports it as validationMessage", async () => {
    const form = (await fixture(inForm())) as HTMLFormElement;
    const el = form.querySelector("lr-select") as LyraSelect;
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

    el.resetValidity();
    expect(el.validity.customError).to.be.false;
    expect(el.validationMessage).to.equal("");
    form.requestSubmit();
    expect(
      submits,
      "submission is unblocked once the custom error is cleared"
    ).to.equal(1);
  });

  it("keeps a custom error through an intrinsic revalidation", async () => {
    const el = (await fixture(html`
      <lr-select required><lr-option value="a">Apple</lr-option></lr-select>
    `)) as LyraSelect;
    await el.updateComplete;
    el.setCustomValidity("Rejected by the server.");

    // Selecting a value re-runs updateValidity(), the traffic that would otherwise wipe the
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
        <lr-select name="fruit">
          <lr-option value="a" selected>Apple</lr-option>
          <lr-option value="b">Banana</lr-option>
        </lr-select>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector("lr-select") as LyraSelect;
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
      <lr-select required><lr-option value="a">Apple</lr-option></lr-select>
    `)) as LyraSelect;
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
    const el = (await fixture(basic())) as LyraSelect;
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

  it("treats a nullish message the same as the empty string, for non-TS callers", async () => {
    const el = (await fixture(basic())) as LyraSelect;
    await el.updateComplete;
    (
      el as unknown as { setCustomValidity(message?: string | null): void }
    ).setCustomValidity(undefined);
    expect(el.validity.customError).to.be.false;
    expect(el.validationMessage).to.equal("");
  });
});


it("bars constraint validation while disabled, like a native disabled required control", async () => {
  const el = (await fixture(html`
    <lr-select required disabled label="Fruit"
      ><lr-option value="a">Apple</lr-option></lr-select
    >
  `)) as LyraSelect;
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


it("keeps committing values when the engine rejects a custom state name", async () => {
  const el = (await fixture(basic())) as LyraSelect;
  const internals = (el as unknown as { internals: ElementInternals }).internals;
  const rejecting = { has: () => false, add() { throw new DOMException("dashed idents only", "SyntaxError"); }, delete() { throw new DOMException("dashed idents only", "SyntaxError"); } };
  Object.defineProperty(internals, "states", { configurable: true, value: rejecting });
  expect(() => { el.value = "a"; }).to.not.throw();
  expect(() => { el.value = ""; }).to.not.throw();
  await el.updateComplete;
  expect(el.value).to.equal("");
});
