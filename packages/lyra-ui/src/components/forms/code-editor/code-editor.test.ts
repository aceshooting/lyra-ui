import { fixture, expect, html, waitUntil } from "@open-wc/testing";
import "./code-editor.js";
import type { LyraCodeEditor } from "./code-editor.js";
import { styles } from "./code-editor.styles.js";
import { resetMouse, sendMouse } from "../../../../test/wtr-mouse.js";

it("lets a consumer retint hover and invalid editor borders independently", async () => {
  const el = (await fixture(html`
    <lr-code-editor
      style="--lr-code-editor-hover-border: rgb(1, 2, 3); --lr-code-editor-invalid-border: rgb(4, 5, 6)"
    ></lr-code-editor>
  `)) as LyraCodeEditor;
  const editor = el.shadowRoot!.querySelector('[part="editor"]') as HTMLElement;
  const rect = editor.getBoundingClientRect();
  try {
    await sendMouse({
      type: "move",
      position: [
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.top + rect.height / 2),
      ],
    });
    expect(getComputedStyle(editor).borderTopColor).to.equal("rgb(1, 2, 3)");
  } finally {
    await resetMouse();
  }
  el.setAttribute("data-invalid", "");
  expect(getComputedStyle(editor).borderTopColor).to.equal("rgb(4, 5, 6)");
});

it("falls back from an invalid runtime resize value without injecting declarations", async () => {
  const el = await fixture<LyraCodeEditor>(
    html`<lr-code-editor></lr-code-editor>`
  );
  el.resize = "vertical;position:fixed" as unknown as LyraCodeEditor["resize"];
  await el.updateComplete;
  const textarea = el.shadowRoot!.querySelector("textarea")!;
  expect(textarea.style.resize).to.equal("both");
  expect(textarea.style.position).to.equal("");
  el.resize = "horizontal";
  await el.updateComplete;
  expect(textarea.style.resize).to.equal("horizontal");
});

it("keeps scrolling on the editor frame instead of creating a nested textarea scrollbar", () => {
  expect(styles.cssText).to.contain("grid-template-columns: auto max-content");
  expect(styles.cssText).to.contain("inline-size: max-content");
  expect(styles.cssText).to.contain("overflow: visible");
});

it("renders line numbers and inserts spaces for Tab", async () => {
  const el = (await fixture(
    html`<lr-code-editor
      value="one
two"
      tab-size="2"
    ></lr-code-editor>`
  )) as LyraCodeEditor;
  expect(
    el.shadowRoot!.querySelectorAll('[part="gutter"] .gutter-line')
  ).to.have.length(2);
  const textarea = el.shadowRoot!.querySelector("textarea")!;
  textarea.focus();
  textarea.setSelectionRange(0, 0);
  textarea.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    })
  );
  expect(el.value).to.contain("  one");
});

it("positions gutter rows from an inherited line-height hook while a direct host value wins", async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div style="--lr-code-editor-line-height: 2">
      <lr-code-editor
        value="one
two"
      ></lr-code-editor>
    </div>
  `);
  const el = wrapper.querySelector("lr-code-editor") as LyraCodeEditor;
  const second =
    el.shadowRoot!.querySelectorAll<HTMLElement>(".gutter-line")[1]!;
  expect(getComputedStyle(second).insetBlockStart).to.equal("32px");

  el.style.setProperty("--lr-code-editor-line-height", "3");
  expect(getComputedStyle(second).insetBlockStart).to.equal("48px");
});

// Regression test for a confirmed crash: `tabSize` fed `' '.repeat(Math.max(1, this.tabSize))`
// directly. `String.prototype.repeat()` throws a `RangeError` for a count of `+Infinity`
// specifically (per spec, `ToIntegerOrInfinity` maps `NaN` to `0` -- harmless -- but `Infinity`
// stays `Infinity`, and `repeat()` explicitly rejects that) -- and `Number("Infinity")` is exactly
// what Lit's `type: Number` converter produces for a literal `tab-size="Infinity"` attribute, so
// this was reachable from plain markup, not just a hand-crafted property write. `tabSize` is now
// sanitized to a finite integer in `[1, 16]` at assignment time via `finiteInteger`, so neither
// `Infinity` nor any other non-finite/negative/oversized value ever reaches `repeat()`. Matching
// `finiteInteger`'s own established contract (see e.g. `<lr-qr-code>`'s `size`/`radius`), a
// non-finite input (Infinity/NaN) resolves to the documented fallback default, while a merely
// out-of-range *finite* input clamps to the nearest bound instead.
it("never throws RangeError from an Infinity/NaN/negative tabSize, and clamps it into a safe [1, 16] range", async () => {
  const el = (await fixture(
    html`<lr-code-editor value="one"></lr-code-editor>`
  )) as LyraCodeEditor;
  const textarea = el.shadowRoot!.querySelector("textarea")!;
  const pressTab = () => {
    textarea.focus();
    textarea.setSelectionRange(0, 0);
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      })
    );
  };

  el.tabSize = Infinity;
  await el.updateComplete;
  expect(pressTab).to.not.throw(RangeError);
  expect(el.tabSize).to.equal(2); // non-finite input falls back to the default, not left as Infinity

  el.value = "one";
  el.tabSize = NaN;
  expect(el.tabSize).to.equal(2); // falls back to the documented default, not NaN
  await el.updateComplete;
  expect(pressTab).to.not.throw();
  expect(el.value).to.contain("  one"); // still indents (unlike raw NaN, silently a no-op insert)

  el.value = "one";
  el.tabSize = -5;
  expect(el.tabSize).to.be.at.least(1); // out-of-range but finite -- clamped to the lower bound

  await el.updateComplete;
  expect(pressTab).to.not.throw();

  el.value = "one";
  el.tabSize = 999;
  expect(el.tabSize).to.equal(16); // out-of-range but finite -- clamped to the upper bound
  await el.updateComplete;
  expect(pressTab).to.not.throw();
  expect(el.value.startsWith(" ".repeat(16))).to.be.true;
});

// `--lr-code-editor-tab-size` used to be inert: the stylesheet read it on the `textarea` part, but
// `render()` also wrote an inline `tab-size:${this.tabSize}` on that very element, and an inline
// declaration always beats a rule. The documented precedence is now: an explicitly assigned
// `tabSize` wins over everything, otherwise a host-level token override wins, otherwise the `:host`
// default of `2`.
describe("tab width precedence", () => {
  const computedTabSize = (el: LyraCodeEditor): string =>
    getComputedStyle(el.shadowRoot!.querySelector("textarea")!).tabSize;
  const pressTab = (el: LyraCodeEditor): void => {
    const textarea = el.shadowRoot!.querySelector("textarea")!;
    textarea.focus();
    textarea.setSelectionRange(0, 0);
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      })
    );
  };

  it("falls back to the token default when neither tabSize nor the token is set", async () => {
    const el = (await fixture(
      html`<lr-code-editor value="one"></lr-code-editor>`
    )) as LyraCodeEditor;
    expect(computedTabSize(el)).to.equal("2");
    pressTab(el);
    expect(el.value).to.equal("  one");
  });

  it("honours a host-level --lr-code-editor-tab-size override while tabSize is untouched", async () => {
    const el = (await fixture(
      html`<lr-code-editor
        value="one"
        style="--lr-code-editor-tab-size: 8"
      ></lr-code-editor>`
    )) as LyraCodeEditor;
    expect(computedTabSize(el)).to.equal("8");
    pressTab(el);
    expect(el.value).to.equal(`${" ".repeat(8)}one`);
  });

  it("keeps an explicitly set tabSize winning over a host-level token override", async () => {
    const el = (await fixture(
      html`<lr-code-editor
        value="one"
        tab-size="4"
        style="--lr-code-editor-tab-size: 8"
      ></lr-code-editor>`
    )) as LyraCodeEditor;
    expect(computedTabSize(el)).to.equal("4");
    pressTab(el);
    expect(el.value).to.equal("    one");

    const assigned = (await fixture(
      html`<lr-code-editor
        value="one"
        style="--lr-code-editor-tab-size: 8"
      ></lr-code-editor>`
    )) as LyraCodeEditor;
    assigned.tabSize = 3;
    await assigned.updateComplete;
    expect(computedTabSize(assigned)).to.equal("3");
    pressTab(assigned);
    expect(assigned.value).to.equal("   one");
  });

  // A length-valued token is a purely visual metric for rendering literal tab characters; it must
  // not be reinterpreted as a count of spaces for the Tab key.
  it("ignores a length-valued token for the indent unit but still renders it", async () => {
    const el = (await fixture(
      html`<lr-code-editor
        value="one"
        style="--lr-code-editor-tab-size: 40px"
      ></lr-code-editor>`
    )) as LyraCodeEditor;
    expect(computedTabSize(el)).to.equal("40px");
    pressTab(el);
    expect(el.value).to.equal("  one");
  });

  it("hands control back to the token when the tab-size attribute is removed", async () => {
    const el = (await fixture(
      html`<lr-code-editor
        value="one"
        tab-size="4"
        style="--lr-code-editor-tab-size: 8"
      ></lr-code-editor>`
    )) as LyraCodeEditor;
    expect(computedTabSize(el)).to.equal("4");
    el.removeAttribute("tab-size");
    await el.updateComplete;
    expect(computedTabSize(el)).to.equal("8");
    pressTab(el);
    expect(el.value).to.equal(`${" ".repeat(8)}one`);
  });

  // Out-of-range token values go through the same [1, 16] sanitisation as the property.
  it("clamps an out-of-range token before using it as the indent unit", async () => {
    const el = (await fixture(
      html`<lr-code-editor
        value="one"
        style="--lr-code-editor-tab-size: 999"
      ></lr-code-editor>`
    )) as LyraCodeEditor;
    pressTab(el);
    expect(el.value).to.equal(`${" ".repeat(16)}one`);
  });
});

// Keyboard-trap coverage (WCAG 2.1.2): a synthetic KeyboardEvent is untrusted, so the browser
// never performs real focus traversal for it — the observable contract is that the component
// leaves the event un-defaultPrevented (letting a real browser traverse) and inserts nothing.
it("lets Shift+Tab perform native reverse focus traversal instead of inserting spaces", async () => {
  const el = (await fixture(
    html`<lr-code-editor value="one"></lr-code-editor>`
  )) as LyraCodeEditor;
  const textarea = el.shadowRoot!.querySelector("textarea")!;
  textarea.focus();
  textarea.setSelectionRange(0, 0);
  const shiftTab = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  });
  textarea.dispatchEvent(shiftTab);
  expect(shiftTab.defaultPrevented).to.be.false;
  expect(el.value).to.equal("one");
});

it("releases the next Tab for native forward focus traversal after Escape", async () => {
  const el = (await fixture(
    html`<lr-code-editor value="one"></lr-code-editor>`
  )) as LyraCodeEditor;
  const textarea = el.shadowRoot!.querySelector("textarea")!;
  textarea.focus();
  textarea.setSelectionRange(0, 0);
  textarea.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })
  );
  const tab = new KeyboardEvent("keydown", {
    key: "Tab",
    bubbles: true,
    cancelable: true,
  });
  textarea.dispatchEvent(tab);
  expect(tab.defaultPrevented).to.be.false;
  expect(el.value).to.equal("one");
});

it("re-arms Tab indentation after the Escape bypass is cancelled by typing or by leaving the editor", async () => {
  const el = (await fixture(
    html`<lr-code-editor value="one" tab-size="2"></lr-code-editor>`
  )) as LyraCodeEditor;
  const textarea = el.shadowRoot!.querySelector("textarea")!;
  const pressTab = () => {
    textarea.setSelectionRange(0, 0);
    textarea.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Tab",
        bubbles: true,
        cancelable: true,
      })
    );
  };
  textarea.focus();

  // Any non-Tab keypress after Escape means the user resumed editing: Tab indents again.
  textarea.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })
  );
  textarea.dispatchEvent(
    new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true })
  );
  pressTab();
  expect(el.value).to.equal("  one");

  // Leaving the editor (blur) also clears the bypass, so a refocused editor indents on Tab.
  el.value = "one";
  await el.updateComplete;
  textarea.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })
  );
  textarea.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  textarea.focus();
  pressTab();
  expect(el.value).to.equal("  one");
});

it("is accessible", async () => {
  const el = (await fixture(
    html`<lr-code-editor
      label="Source"
      value="const answer = 42;"
    ></lr-code-editor>`
  )) as LyraCodeEditor;
  expect(el.shadowRoot!.querySelector("textarea")!.value).to.equal(
    "const answer = 42;"
  );
  await expect(el).to.be.accessible();
});

it("renders hint/errorText text and wires aria-describedby to the visible parts", async () => {
  const el = (await fixture(
    html`<lr-code-editor
      label="Source"
      hint="Keep it short"
      error-text="Required"
    ></lr-code-editor>`
  )) as LyraCodeEditor;
  const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(hint.hidden).to.be.false;
  expect(hint.textContent).to.contain("Keep it short");
  expect(error.hidden).to.be.false;
  expect(error.textContent).to.contain("Required");
  const textarea = el.shadowRoot!.querySelector(
    "textarea"
  ) as HTMLTextAreaElement;
  expect(textarea.getAttribute("aria-describedby")).to.equal(
    `${error.id} ${hint.id}`
  );
  expect(textarea.getAttribute("aria-invalid")).to.equal("true");
  expect(
    el.checkValidity(),
    "visible consumer error chrome does not rewrite FACE validity"
  ).to.be.true;
});

it("projects requiredness to the native textarea in optional, required, and disabled states", async () => {
  const el = (await fixture(
    html`<lr-code-editor></lr-code-editor>`
  )) as LyraCodeEditor;
  const textarea = el.shadowRoot!.querySelector(
    "textarea"
  ) as HTMLTextAreaElement;
  expect(textarea.required).to.be.false;

  el.required = true;
  await el.updateComplete;
  expect(textarea.required).to.be.true;

  el.disabled = true;
  await el.updateComplete;
  expect(
    textarea.required,
    "disablement bars validity but does not erase authored requiredness"
  ).to.be.true;
});

it("supports label, hint, and error slots with same-shadow description ids", async () => {
  const el = (await fixture(html`
    <lr-code-editor>
      <span slot="label">Slotted label</span>
      <span slot="hint">Slotted hint</span>
      <span slot="error">Slotted error</span>
    </lr-code-editor>
  `)) as LyraCodeEditor;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part~="label"]') as HTMLElement;
  const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(label.hidden).to.be.false;
  expect(hint.hidden).to.be.false;
  expect(error.hidden).to.be.false;
  const textarea = el.shadowRoot!.querySelector(
    "textarea"
  ) as HTMLTextAreaElement;
  expect(textarea.getAttribute("aria-describedby")).to.equal(
    `${error.id} ${hint.id}`
  );
  expect(textarea.getAttribute("aria-invalid")).to.equal("true");
});

it("hides hint/error parts and omits aria-describedby when unset", async () => {
  const el = (await fixture(
    html`<lr-code-editor></lr-code-editor>`
  )) as LyraCodeEditor;
  const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(hint.hidden).to.be.true;
  expect(error.hidden).to.be.true;
  const textarea = el.shadowRoot!.querySelector(
    "textarea"
  ) as HTMLTextAreaElement;
  expect(textarea.hasAttribute("aria-describedby")).to.be.false;
});

it("toggles data-invalid once touched and invalid", async () => {
  const el = (await fixture(
    html`<lr-code-editor required></lr-code-editor>`
  )) as LyraCodeEditor;
  await el.updateComplete;
  expect(el.hasAttribute("data-invalid")).to.be.false;
  const textarea = el.shadowRoot!.querySelector(
    "textarea"
  ) as HTMLTextAreaElement;
  textarea.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
  await el.updateComplete;
  expect(el.hasAttribute("data-invalid")).to.be.true;
});

// Regression test: disabling a focused native form control forces
// the browser to blur it outright -- plain native HTML behavior, nothing to do with custom
// elements -- and that forced blur is not a real user interaction. Marking `touched` for it could
// (depending on exact timing) reenter an in-flight Lit update and trip Lit's dev-mode "scheduled
// an update after an update completed" warning. Checks the private `touched` state directly (via
// a cast), not a DOM attribute proxy like `aria-invalid`, which can lag a render behind and give
// false confidence.
it("does not mark touched from a blur caused by the control itself becoming disabled", async () => {
  const el = (await fixture(
    html`<lr-code-editor required></lr-code-editor>`
  )) as LyraCodeEditor;
  const textarea = el.shadowRoot!.querySelector(
    "textarea"
  ) as HTMLTextAreaElement;
  textarea.focus();
  expect(
    el.shadowRoot!.activeElement === textarea,
    "precondition: textarea holds real focus"
  ).to.be.true;

  el.disabled = true;
  await el.updateComplete;
  // The platform's own force-blur can trail the render commit by an unpredictable amount on some
  // engines (observed on Firefox/WebKit; Chromium settles within updateComplete alone) -- poll
  // instead of guessing a fixed delay.
  await waitUntil(
    () => el.shadowRoot!.activeElement !== textarea,
    "the platform never force-blurred the disabled textarea",
    { timeout: 2000 }
  );

  // Never chai-compare DOM nodes directly (hangs the whole file) -- compare identity as a plain
  // boolean instead.
  expect(
    el.shadowRoot!.activeElement === textarea,
    "precondition: becoming disabled must have forced a real blur"
  ).to.be.false;
  expect(
    (el as unknown as { touched: boolean }).touched,
    "a disable-forced blur must not mark the field touched"
  ).to.be.false;
});

it("still marks touched from an ordinary blur", async () => {
  const el = (await fixture(
    html`<lr-code-editor required></lr-code-editor>`
  )) as LyraCodeEditor;
  const textarea = el.shadowRoot!.querySelector(
    "textarea"
  ) as HTMLTextAreaElement;
  textarea.focus();
  expect(el.shadowRoot!.activeElement === textarea).to.be.true;

  textarea.blur();
  await el.updateComplete;

  expect((el as unknown as { touched: boolean }).touched).to.be.true;
});

it("colors the textarea's placeholder text instead of leaving the UA default", async () => {
  // Rendered-fixture proof, not a stylesheet-source regex: read the pseudo-element's real computed
  // color and confirm it matches --lr-color-text-quiet (via the hint part, which uses that same
  // token) while differing from the textarea's own regular text color -- a selector typo or
  // specificity loss would leave the UA default and fail both comparisons.
  const el = (await fixture(
    html`<lr-code-editor
      placeholder="Type code"
      hint="Quiet reference"
    ></lr-code-editor>`
  )) as LyraCodeEditor;
  const textarea = el.shadowRoot!.querySelector(
    "textarea"
  ) as HTMLTextAreaElement;
  const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  const placeholderColor = getComputedStyle(textarea, "::placeholder").color;
  const quietColor = getComputedStyle(hint).color;
  const textareaColor = getComputedStyle(textarea).color;
  expect(placeholderColor).to.not.equal("");
  expect(placeholderColor).to.equal(quietColor);
  expect(placeholderColor).to.not.equal(textareaColor);
});

it("uses a .strings override for the default accessible-name fallback", async () => {
  const el = (await fixture(
    html`<lr-code-editor></lr-code-editor>`
  )) as LyraCodeEditor;
  el.strings = { codeEditorLabel: "Éditeur de code" };
  await el.updateComplete;
  const textarea = el.shadowRoot!.querySelector(
    "textarea"
  ) as HTMLTextAreaElement;
  expect(textarea.getAttribute("aria-label")).to.equal("Éditeur de code");
});

describe("lineNumbers", () => {
  it("renders the gutter by default", async () => {
    const el = (await fixture(
      html`<lr-code-editor value="one"></lr-code-editor>`
    )) as LyraCodeEditor;
    expect(el.shadowRoot!.querySelectorAll('[part="gutter"]')).to.have.length(
      1
    );
  });

  it('omits the gutter for a plain line-numbers="false" attribute, not just a property binding', async () => {
    const el = (await fixture(
      html`<lr-code-editor value="one" line-numbers="false"></lr-code-editor>`
    )) as LyraCodeEditor;
    expect(el.lineNumbers).to.be.false;
    expect(el.shadowRoot!.querySelectorAll('[part="gutter"]')).to.have.length(
      0
    );
  });

  it("still omits the gutter via a property binding", async () => {
    const el = (await fixture(
      html`<lr-code-editor value="one" .lineNumbers=${false}></lr-code-editor>`
    )) as LyraCodeEditor;
    expect(el.shadowRoot!.querySelectorAll('[part="gutter"]')).to.have.length(
      0
    );
  });
});

it("gives the editor frame hover feedback matching the keyboard focus-visible cue", () => {
  const css = styles.cssText.replace(/\s+/g, " ");
  expect(css).to.match(/\[part=["']editor["']\]:hover\s*\{[^}]*border-color:/);
});

it("dims and blocks the cursor via its own disabled property/attribute", async () => {
  const el = (await fixture(
    html`<lr-code-editor value="one" disabled></lr-code-editor>`
  )) as LyraCodeEditor;
  expect(getComputedStyle(el).opacity).to.equal("0.5");
  expect(getComputedStyle(el).cursor).to.equal("not-allowed");
});

// :host(:disabled), not :host([disabled]) -- see the styles.ts comment. effectiveDisabled already
// correctly gates the internal <textarea> when disabled purely by an ancestor fieldset (mirrors
// lr-chat-composer/lr-checkbox's identical _fieldsetDisabled/effectiveDisabled pattern), but that
// alone doesn't prove the *visual* dimming follows -- it needs its own computed-style assertion.
it("dims via the :disabled pseudo-class when disabled only through an ancestor fieldset", async () => {
  const form = (await fixture(html`
    <form>
      <fieldset disabled>
        <lr-code-editor value="one"></lr-code-editor>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector("lr-code-editor") as LyraCodeEditor;
  const textarea = el.shadowRoot!.querySelector(
    "textarea"
  ) as HTMLTextAreaElement;

  expect(el.disabled).to.be.false;
  expect(el.effectiveDisabled).to.be.true;
  expect(textarea.disabled).to.be.true;
  expect(getComputedStyle(el).opacity).to.equal("0.5");
  expect(getComputedStyle(el).cursor).to.equal("not-allowed");
});

it("forwards click and the writable native selection surface to the textarea", async () => {
  const el = (await fixture(
    html`<lr-code-editor value="abcdef"></lr-code-editor>`
  )) as LyraCodeEditor;
  const textarea = el.shadowRoot!.querySelector(
    "textarea"
  ) as HTMLTextAreaElement;
  let clicks = 0;
  textarea.addEventListener("click", () => clicks++);

  el.click();
  el.selectionStart = 1;
  el.selectionEnd = 4;
  el.selectionDirection = "backward";

  expect(clicks).to.equal(1);
  expect(textarea.selectionStart).to.equal(1);
  expect(textarea.selectionEnd).to.equal(4);
  expect(textarea.selectionDirection).to.equal("backward");
});

it("forwards the complete native focus, selection, and range-editing surface", async () => {
  const el = (await fixture(
    html`<lr-code-editor value="abcdef"></lr-code-editor>`
  )) as LyraCodeEditor;
  const textarea = el.shadowRoot!.querySelector(
    "textarea"
  ) as HTMLTextAreaElement;
  const forwarded: string[] = [];
  el.addEventListener("focus", (event) => {
    if (event instanceof FocusEvent && event.target === el)
      forwarded.push("focus");
  });
  el.addEventListener("blur", (event) => {
    if (event instanceof FocusEvent && event.target === el)
      forwarded.push("blur");
  });

  el.focus({ preventScroll: true });
  expect(el.shadowRoot!.activeElement?.localName).to.equal("textarea");
  el.setSelectionRange(1, 4, "forward");
  expect(el.selectionStart).to.equal(1);
  expect(el.selectionEnd).to.equal(4);
  expect(el.selectionDirection).to.equal("forward");

  el.setRangeText("XY");
  expect(el.value).to.equal("aXYef");
  expect(textarea.value).to.equal("aXYef");

  el.setRangeText("!", 0, 1, "select");
  expect(el.value).to.equal("!XYef");
  expect(el.selectionStart).to.equal(0);
  expect(el.selectionEnd).to.equal(1);

  el.select();
  expect(el.selectionStart).to.equal(0);
  expect(el.selectionEnd).to.equal(el.value.length);
  el.blur();
  expect(el.shadowRoot!.activeElement === null).to.equal(true);
  expect(forwarded).to.deep.equal(["focus", "blur"]);
});

it("rejects host focus synchronously when direct or fieldset disablement starts", async () => {
  const fieldset = await fixture<HTMLFieldSetElement>(html`
    <fieldset><lr-code-editor></lr-code-editor></fieldset>
  `);
  const el = fieldset.querySelector("lr-code-editor") as LyraCodeEditor;

  el.disabled = true;
  el.focus();
  expect(el.shadowRoot!.activeElement === null, "direct disabled write").to.be
    .true;

  el.disabled = false;
  await el.updateComplete;
  fieldset.disabled = true;
  el.focus();
  expect(el.shadowRoot!.activeElement === null, "same-task fieldset cascade").to
    .be.true;
});

it("relays one native input/change and emits typed Lyra value aliases", async () => {
  const el = (await fixture(
    html`<lr-code-editor></lr-code-editor>`
  )) as LyraCodeEditor;
  const textarea = el.shadowRoot!.querySelector(
    "textarea"
  ) as HTMLTextAreaElement;
  const nativeInputs: Event[] = [];
  const nativeChanges: Event[] = [];
  const inputDetails: unknown[] = [];
  const changeDetails: unknown[] = [];
  el.addEventListener("input", (event) => nativeInputs.push(event));
  el.addEventListener("change", (event) => nativeChanges.push(event));
  el.addEventListener("lr-input", (event) => inputDetails.push(event.detail));
  el.addEventListener("lr-change", (event) => changeDetails.push(event.detail));

  textarea.value = "const answer = 42;";
  textarea.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      composed: true,
      data: "2",
      inputType: "insertText",
    })
  );
  textarea.dispatchEvent(new Event("change", { bubbles: true }));

  expect(el.value).to.equal("const answer = 42;");
  expect(nativeInputs).to.have.lengthOf(1);
  expect(nativeInputs[0]).to.be.instanceOf(InputEvent);
  expect((nativeInputs[0] as InputEvent).inputType).to.equal("insertText");
  expect(nativeInputs[0].target === el).to.be.true;
  expect(nativeChanges).to.have.lengthOf(1);
  expect(nativeChanges[0].constructor).to.equal(Event);
  expect(nativeChanges[0].target === el).to.be.true;
  expect(inputDetails).to.deep.equal([{ value: "const answer = 42;" }]);
  expect(changeDetails).to.deep.equal([{ value: "const answer = 42;" }]);
});

it("normalizes every public/default/restored line ending to the native LF representation", async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <lr-code-editor name="source" value=${"a\rb\r\nc"}></lr-code-editor>
    </form>
  `);
  const el = form.querySelector("lr-code-editor") as LyraCodeEditor;
  const textarea = el.input!;
  expect(el.value).to.equal("a\nb\nc");
  expect(el.defaultValue).to.equal("a\nb\nc");
  expect(textarea.value).to.equal("a\nb\nc");
  expect(new FormData(form).get("source")).to.equal("a\nb\nc");
  expect(el.shadowRoot!.querySelectorAll(".gutter-line")).to.have.lengthOf(3);

  el.value = "live\rvalue";
  form.reset();
  expect(el.value).to.equal("a\nb\nc");
  el.formStateRestoreCallback("restored\r\nvalue", "restore");
  expect(el.value).to.equal("restored\nvalue");
  expect(el.selectionStart).to.equal(textarea.selectionStart);
});

it("matches native hard-wrap FormData while retaining the live unwrapped value", async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form>
      <textarea name="native" cols="20" wrap="hard">
abcdefghijklmnopqrstuvwxyz</textarea
      >
      <lr-code-editor
        name="editor"
        cols="20"
        wrap="hard"
        value="abcdefghijklmnopqrstuvwxyz"
      ></lr-code-editor>
    </form>
  `);
  const el = form.querySelector("lr-code-editor") as LyraCodeEditor;
  const data = new FormData(form);
  expect(data.get("editor")).to.equal(data.get("native"));
  expect(el.value).to.equal("abcdefghijklmnopqrstuvwxyz");
  expect(el.input!.value).to.equal("abcdefghijklmnopqrstuvwxyz");
});

it("forwards the native editing attributes and exposes the owned input and scroll position", async () => {
  const el = await fixture<LyraCodeEditor>(html`
    <lr-code-editor
      rows="7"
      cols="33"
      minlength="2"
      maxlength="8"
      autocomplete="off"
      inputmode="text"
      enterkeyhint="done"
      autocorrect="on"
      autofocus
      title="Source editor"
    ></lr-code-editor>
  `);
  const textarea = el.input!;
  expect(textarea === el.shadowRoot!.querySelector("textarea")).to.be.true;
  expect(textarea.rows).to.equal(7);
  expect(textarea.cols).to.equal(33);
  expect(textarea.minLength).to.equal(2);
  expect(textarea.maxLength).to.equal(8);
  expect(textarea.autocomplete).to.equal("off");
  expect(textarea.inputMode).to.equal("text");
  expect(textarea.getAttribute("enterkeyhint")).to.equal("done");
  expect(textarea.autofocus).to.be.true;
  expect(textarea.title).to.equal("Source editor");
  el.scrollPosition({ top: 12, left: 3 });
  expect(el.scrollPosition()).to.deep.equal({
    top: textarea.scrollTop,
    left: textarea.scrollLeft,
  });
});

it("reflects the language styling hook and restores its empty default on removal", async () => {
  const el = await fixture<LyraCodeEditor>(
    html`<lr-code-editor language="typescript"></lr-code-editor>`
  );
  expect(el.language).to.equal("typescript");
  expect(el.getAttribute("language")).to.equal("typescript");
  el.language = "rust";
  await el.updateComplete;
  expect(el.getAttribute("language")).to.equal("rust");
  el.removeAttribute("language");
  await el.updateComplete;
  expect(el.language).to.equal("");
  expect(el.hasAttribute("language")).to.be.false;
});

it("supplements native minlength/maxlength validity for programmatic values", async () => {
  const el = await fixture<LyraCodeEditor>(
    html`<lr-code-editor minlength="3" maxlength="5"></lr-code-editor>`
  );
  el.value = "x";
  expect(el.validity.tooShort).to.be.true;
  expect(el.validationMessage).to.not.equal("");
  el.value = "abcdef";
  expect(el.validity.tooLong).to.be.true;
  el.value = "valid";
  expect(el.validity.valid).to.be.true;
});

it("normalizes non-finite and fractional row and length constraints before layout and validity", async () => {
  const el = await fixture<LyraCodeEditor>(
    html`<lr-code-editor value="abcd"></lr-code-editor>`
  );

  el.rows = Number.POSITIVE_INFINITY;
  el.minlength = 2.9;
  el.maxlength = 3.9;
  await el.updateComplete;
  expect(el.rows).to.equal(4);
  expect(el.input!.rows).to.equal(4);
  expect(el.minlength).to.equal(2);
  expect(el.maxlength).to.equal(3);
  expect(el.input!.minLength).to.equal(2);
  expect(el.input!.maxLength).to.equal(3);
  expect(el.validity.tooLong).to.be.true;

  el.rows = -10;
  el.minlength = Number.NaN;
  el.maxlength = Number.NEGATIVE_INFINITY;
  await el.updateComplete;
  expect(el.rows).to.equal(1);
  expect(el.minlength).to.equal(undefined);
  expect(el.maxlength).to.equal(undefined);
  expect(el.input!.hasAttribute("minlength")).to.be.false;
  expect(el.input!.hasAttribute("maxlength")).to.be.false;
  expect(el.validity.valid).to.be.true;
});

it("parses explicit spellcheck strings with native true/false semantics", async () => {
  const enabled = (await fixture(
    html`<lr-code-editor spellcheck="true"></lr-code-editor>`
  )) as LyraCodeEditor;
  const disabled = (await fixture(
    html`<lr-code-editor spellcheck="false"></lr-code-editor>`
  )) as LyraCodeEditor;

  expect(enabled.spellcheck).to.be.true;
  expect(enabled.shadowRoot!.querySelector("textarea")!.spellcheck).to.be.true;
  expect(disabled.spellcheck).to.be.false;
  expect(disabled.shadowRoot!.querySelector("textarea")!.spellcheck).to.be
    .false;
});

it("bounds the line-number projection and skips all line splitting while the gutter is disabled", async () => {
  const value = Array.from({ length: 100_000 }, (_, index) =>
    String(index)
  ).join("\n");
  const el = (await fixture(
    html`<lr-code-editor .value=${value}></lr-code-editor>`
  )) as LyraCodeEditor;
  expect(el.shadowRoot!.querySelectorAll(".gutter-line")).to.have.lengthOf(200);
  expect(
    el.shadowRoot!.querySelector('[part="gutter"]')!.textContent
  ).to.contain("100000");
  expect(
    el.shadowRoot!.querySelector('[part="gutter"]')!.textContent!.length
  ).to.be.lessThan(2_000);

  el.lineNumbers = false;
  await el.updateComplete;
  const originalSplit = String.prototype.split;
  let splits = 0;
  const nextValue = `${value}\nlast`;
  String.prototype.split = function (...args: Parameters<String["split"]>) {
    if (String(this) === nextValue && args[0] === "\n") splits++;
    return originalSplit.apply(this, args);
  };
  try {
    el.value = nextValue;
    await el.updateComplete;
  } finally {
    String.prototype.split = originalSplit;
  }
  expect(splits).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="gutter"]') === null).to.be.true;
});

it("paints the required marker as generated content the accessible name never sees", async () => {
  // Rendered proof, not stylesheet text: the marker used to be a literal
  // <span aria-hidden="true">*</span> in the template, a third shape alongside the shared rule and
  // the hand-copied per-component ones. Generated content also cannot reach the label's accessible
  // name, and it stays suppressible/retunable through the three shared custom properties.
  const el = (await fixture(
    html`<lr-code-editor label="Config" required></lr-code-editor>`
  )) as LyraCodeEditor;
  const label = el.shadowRoot!.querySelector(
    '[part~="form-control-label"]'
  ) as HTMLElement;
  expect(label.querySelector("span") === null).to.equal(true);
  expect(getComputedStyle(label, "::after").content).to.contain("*");
  expect(label.textContent!.trim()).to.equal("Config");

  const optional = (await fixture(
    html`<lr-code-editor label="Config"></lr-code-editor>`
  )) as LyraCodeEditor;
  const optionalLabel = optional.shadowRoot!.querySelector(
    '[part~="form-control-label"]'
  ) as HTMLElement;
  expect(getComputedStyle(optionalLabel, "::after").content).to.not.contain(
    "*"
  );
});

it("lets a consumer suppress and retune the required marker through the shared properties", async () => {
  const el = (await fixture(
    html`<lr-code-editor
      label="Config"
      required
      style="--lr-form-control-required-content: ''"
    ></lr-code-editor>`
  )) as LyraCodeEditor;
  const label = el.shadowRoot!.querySelector(
    '[part~="form-control-label"]'
  ) as HTMLElement;
  expect(getComputedStyle(label, "::after").content).to.not.contain("*");

  el.setAttribute(
    "style",
    "--lr-form-control-required-content: ' (required)'; --lr-form-control-required-offset: 4px"
  );
  await el.updateComplete;
  const after = getComputedStyle(label, "::after");
  expect(after.content).to.contain("(required)");
  expect(after.marginInlineStart).to.equal("4px");
});

it("bars constraint validation while disabled, fieldset-disabled or readonly", async () => {
  const el = (await fixture(
    html`<lr-code-editor required disabled></lr-code-editor>`
  )) as LyraCodeEditor;
  await el.updateComplete;
  expect(el.validity.valueMissing, "disabled + required").to.be.false;
  expect(el.matches(":state(invalid)"), "disabled must not be :state(invalid)")
    .to.be.false;

  el.disabled = false;
  await el.updateComplete;
  expect(el.validity.valueMissing, "enabled again").to.be.true;

  el.readonly = true;
  await el.updateComplete;
  expect(el.validity.valueMissing, "readonly + required").to.be.false;
  expect(el.matches(":state(invalid)"), "readonly must not be :state(invalid)")
    .to.be.false;
});

it("emits a cancelable lr-invalid alias whose cancellation reaches the native invalid event", async () => {
  const el = (await fixture(
    html`<lr-code-editor required></lr-code-editor>`
  )) as LyraCodeEditor;
  const aliases: CustomEvent[] = [];
  el.addEventListener("lr-invalid", (event) =>
    aliases.push(event as CustomEvent)
  );

  expect(el.checkValidity()).to.be.false;
  expect(aliases).to.have.lengthOf(1);
  expect(aliases[0].bubbles && aliases[0].composed).to.be.true;
  expect(aliases[0].cancelable).to.be.true;

  el.addEventListener("lr-invalid", (event) => event.preventDefault());
  const natives: Event[] = [];
  el.addEventListener("invalid", (event) => natives.push(event));
  expect(el.checkValidity()).to.be.false;
  expect(natives).to.have.lengthOf(1);
  expect(natives[0].defaultPrevented).to.be.true;
});

// -- size: parity with lr-textarea's own six-step ladder (see textarea.test.ts's identical
// describe block) -- lr-code-editor had no `size` property at all before this.
describe("lr-code-editor size", () => {
  const textareaOf = (el: LyraCodeEditor) =>
    el.shadowRoot!.querySelector('[part="textarea"]') as HTMLElement;
  const gutterOf = (el: LyraCodeEditor) =>
    el.shadowRoot!.querySelector('[part="gutter"]') as HTMLElement;
  const editorOf = (el: LyraCodeEditor) =>
    el.shadowRoot!.querySelector('[part="editor"]') as HTMLElement;

  it('defaults to size "m" and reflects the attribute', async () => {
    const el = await fixture<LyraCodeEditor>(
      html`<lr-code-editor></lr-code-editor>`
    );
    expect(el.size).to.equal("m");
    expect(el.getAttribute("size")).to.equal("m");
    const sized = await fixture<LyraCodeEditor>(
      html`<lr-code-editor size="s"></lr-code-editor>`
    );
    expect(sized.size).to.equal("s");
    expect(sized.getAttribute("size")).to.equal("s");
  });

  it('leaves the committed padding/font-size untouched at the default tier and tightens them at "xs"', async () => {
    const mEl = await fixture<LyraCodeEditor>(
      html`<lr-code-editor value="one"></lr-code-editor>`
    );
    const xsEl = await fixture<LyraCodeEditor>(
      html`<lr-code-editor value="one" size="xs"></lr-code-editor>`
    );
    const m = getComputedStyle(textareaOf(mEl));
    const xs = getComputedStyle(textareaOf(xsEl));
    // Today's exact rendering at the untouched default tier -- 0.5rem padding, 1rem font-size --
    // must survive the addition of the `size` property unchanged.
    expect(m.paddingTop).to.equal("8px");
    expect(m.fontSize).to.equal("16px");
    expect(parseFloat(xs.paddingTop)).to.be.below(parseFloat(m.paddingTop));
    expect(parseFloat(xs.fontSize)).to.be.below(parseFloat(m.fontSize));
  });

  it('grows padding/font-size/min-block-size at "xl" beyond the default tier', async () => {
    const mEl = await fixture<LyraCodeEditor>(
      html`<lr-code-editor value="one"></lr-code-editor>`
    );
    const xlEl = await fixture<LyraCodeEditor>(
      html`<lr-code-editor value="one" size="xl"></lr-code-editor>`
    );
    const m = getComputedStyle(textareaOf(mEl));
    const xl = getComputedStyle(textareaOf(xlEl));
    expect(parseFloat(xl.paddingTop)).to.be.above(parseFloat(m.paddingTop));
    expect(parseFloat(xl.fontSize)).to.be.above(parseFloat(m.fontSize));
    expect(parseFloat(getComputedStyle(editorOf(xlEl)).minHeight)).to.be.above(
      parseFloat(getComputedStyle(editorOf(mEl)).minHeight)
    );
  });

  it("keeps the gutter font-size in step with the textarea so line numbers stay aligned", async () => {
    const el = await fixture<LyraCodeEditor>(
      html`<lr-code-editor
        value="one
two"
        size="l"
      ></lr-code-editor>`
    );
    expect(getComputedStyle(gutterOf(el)).fontSize).to.equal(
      getComputedStyle(textareaOf(el)).fontSize
    );
  });

  it('accepts the Web Awesome/Shoelace "small"/"large" spellings and renders them identically to "s"/"l"', async () => {
    const small = await fixture<LyraCodeEditor>(
      html`<lr-code-editor value="one" size="small"></lr-code-editor>`
    );
    const s = await fixture<LyraCodeEditor>(
      html`<lr-code-editor value="one" size="s"></lr-code-editor>`
    );
    expect(getComputedStyle(textareaOf(small)).fontSize).to.equal(
      getComputedStyle(textareaOf(s)).fontSize
    );
    expect(getComputedStyle(textareaOf(small)).paddingTop).to.equal(
      getComputedStyle(textareaOf(s)).paddingTop
    );
  });
});

it("keeps long code in its editor scrollport inside an exact 320px RTL allocation", async () => {
  const long = "LocalizedUnbrokenCodeEditorChrome".repeat(32);
  const code = `const payload = '${"unbrokenSourceToken".repeat(96)}';`;
  const wrapper = await fixture<HTMLElement>(html`
    <div
      dir="rtl"
      style="inline-size:320px;max-inline-size:320px;overflow:auto"
    >
      <lr-code-editor
        label=${long}
        hint=${long}
        resize="none"
        .value=${code}
        style="max-inline-size:100%"
      ></lr-code-editor>
    </div>
  `);
  const editor = wrapper.querySelector("lr-code-editor") as LyraCodeEditor;
  const frame =
    editor.shadowRoot!.querySelector<HTMLElement>('[part="editor"]')!;
  const textarea =
    editor.shadowRoot!.querySelector<HTMLTextAreaElement>('[part="textarea"]')!;
  expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth);
  expect(textarea.scrollWidth).to.be.greaterThan(textarea.clientWidth);
  expect(getComputedStyle(frame).overflowX).to.equal("auto");
});
