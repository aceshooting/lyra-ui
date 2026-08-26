import { expect, fixture, html, oneEvent, waitUntil } from "@open-wc/testing";
import type { LyraAttachmentChip } from "../../media/attachment-chip/attachment-chip.class.js";
import type { LyraChatComposer } from "../chat-composer/chat-composer.class.js";
import type { LyraMentionPopover } from "../../utility/mention-popover/mention-popover.class.js";
import "./prompt-input.js";
import type {
  LyraPromptInput,
  LyraPromptInputAttachment,
} from "./prompt-input.class.js";
import { styles } from "./prompt-input.styles.js";
import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';

// Removed-attribute regression tests below deliberately author these; see the helper.
expectStaleAttribute('lr-prompt-input', 'name');

interface PromptInputEditingFacade {
  readonly input: HTMLTextAreaElement | null;
  spellcheck: boolean;
  autocapitalize: string;
  autocorrect: boolean | string;
  wrap: "hard" | "soft" | "off";
  autocomplete: string;
  inputMode: string;
  enterKeyHint: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  selectionDirection: "forward" | "backward" | "none" | null;
  select(): void;
  setSelectionRange(
    start: number | null,
    end: number | null,
    direction?: "forward" | "backward" | "none"
  ): void;
  setRangeText(replacement: string): void;
  setRangeText(
    replacement: string,
    start: number,
    end: number,
    selectMode?: SelectionMode
  ): void;
}

it("declares a prompt-scoped control-width hook with a safe fallback", () => {
  const css = styles.cssText.replace(/\s+/g, " ");
  expect(css).to.match(
    /min-inline-size:\s*min\(100%,\s*var\(--lr-prompt-input-control-width,\s*[^)]+\)\)/
  );
  expect(css).to.match(
    /flex:\s*1 1 var\(--lr-prompt-input-control-width,\s*[^)]+\)/
  );
  expect(css).to.not.include("var(--lr-control-width");
});

it("names the semantic group that owns the prompt option controls", async () => {
  const el = (await fixture(html`
    <lr-prompt-input
      .modelCatalog=${[
        { id: "fast", label: "Fast" },
      ]}
    ></lr-prompt-input>
  `)) as LyraPromptInput;
  const controls = el.shadowRoot!.querySelector('[part="controls"]')!;
  expect(controls.getAttribute("role")).to.equal("group");
  expect(controls.getAttribute("aria-label")).to.equal("Prompt options");
});

it("does not count invalid-only model or voice catalogs as prompt option controls", async () => {
  const el = (await fixture(html`<lr-prompt-input
    .modelCatalog=${["", "   "]}
    .voiceCatalog=${[{ id: "", label: "Empty" }]}
  ></lr-prompt-input>`)) as LyraPromptInput;
  expect(Boolean(el.shadowRoot!.querySelector('[part="controls"]'))).to.equal(false);
});

it("is deliberately event-submitted rather than a native successful form control", async () => {
  const form = (await fixture(html`
    <form>
      <lr-prompt-input
        name="prompt"
        .value=${"Summarize the report"}
      ></lr-prompt-input>
    </form>
  `)) as HTMLFormElement;
  const element = form.querySelector("lr-prompt-input") as LyraPromptInput;

  expect(new FormData(form).has("prompt")).to.be.false;
  expect("getForm" in element).to.be.false;
});

it("keeps a definite flex-basis when --lr-prompt-input-control-width is unset", async () => {
  const el = (await fixture(
    html`<lr-prompt-input
      .modelCatalog=${["fast", "accurate"]}
    ></lr-prompt-input>`
  )) as LyraPromptInput;
  await el.updateComplete;
  const control = el.shadowRoot!.querySelector(
    '[part="controls"] > *'
  ) as HTMLElement;
  expect(control != null, "expected at least one rendered control").to.equal(
    true
  );
  // Without a fallback, an unset custom property makes the declaration invalid at
  // computed-value time, which invalidates the whole `flex` shorthand declaration and falls the
  // basis back to its initial `auto` -- a definite length here proves the fallback took effect.
  expect(getComputedStyle(control).flexBasis).to.not.equal("auto");
});

it("composes attachments, model, voice, sources, queue, and the chat composer", async () => {
  const el = (await fixture(html`<lr-prompt-input
    .attachments=${[
      {
        attachmentId: "doc-1",
        name: "report.pdf",
        mimeType: "application/pdf",
      },
    ]}
    .modelCatalog=${["fast", "accurate"]}
    .voiceCatalog=${["calm", "bright"]}
    .sources=${[{ id: "doc-1", label: "Report" }]}
    .queue=${[{ id: "q1", value: "Follow up" }]}
  ></lr-prompt-input>`)) as LyraPromptInput;

  expect(el.shadowRoot!.querySelectorAll("lr-chat-composer")).to.have.lengthOf(
    1
  );
  expect(
    el.shadowRoot!.querySelectorAll("lr-attachment-chip")
  ).to.have.lengthOf(1);
  expect(el.shadowRoot!.querySelectorAll("lr-model-select")).to.have.lengthOf(
    1
  );
  expect(el.shadowRoot!.querySelectorAll("lr-voice-picker")).to.have.lengthOf(
    1
  );
  expect(el.shadowRoot!.querySelectorAll("lr-source-picker")).to.have.lengthOf(
    1
  );
  expect(el.shadowRoot!.querySelectorAll("lr-prompt-queue")).to.have.lengthOf(
    1
  );
  const voiceChanged = oneEvent(el, "lr-voice-change");
  el.shadowRoot!.querySelector("lr-voice-picker")!.dispatchEvent(
    new CustomEvent("lr-change", {
      bubbles: true,
      composed: true,
      detail: { value: "bright", inCatalog: true },
    })
  );
  expect((await voiceChanged).detail).to.deep.equal({
    value: "bright",
    inCatalog: true,
  });
});

it("composes canonical start/end slots and restores generated fallbacks live", async () => {
  const el = (await fixture(html`
    <lr-prompt-input>
      <button id="start" slot="start" type="button">Start</button>
      <button id="end" slot="end" type="button">End</button>
    </lr-prompt-input>
  `)) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  await composer.updateComplete;
  const startSlot =
    el.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="start"]')!;
  const endSlot =
    el.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="end"]')!;
  const composerStartSlot =
    composer.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="start"]')!;
  const composerEndSlot =
    composer.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="end"]')!;

  expect(startSlot.assignedElements().map((item) => item.id)).to.deep.equal([
    "start",
  ]);
  expect(endSlot.assignedElements().map((item) => item.id)).to.deep.equal([
    "end",
  ]);
  expect(
    composerStartSlot
      .assignedElements()
      .map((item) => item.getAttribute("part"))
  ).to.deep.equal(["start"]);
  expect(
    composerEndSlot.assignedElements().map((item) => item.getAttribute("name"))
  ).to.deep.equal(["end"]);
  // The generated trigger remains as fallback DOM but is not assigned while author content wins.
  // Testing slot assignment avoids mistaking fallback markup for rendered content.
  expect(startSlot.assignedElements()).to.have.lengthOf(1);
  expect(
    composer.shadowRoot!.querySelectorAll('[part="action-button"]').length
  ).to.equal(0);

  const changed = oneEvent(startSlot, "slotchange");
  el.querySelector("#start")!.remove();
  await changed;
  await el.updateComplete;
  await composer.updateComplete;
  expect(
    el.shadowRoot!.querySelectorAll("lr-attachment-trigger").length
  ).to.equal(1);

  el.querySelector("#end")!.remove();
  await waitUntil(
    () =>
      composer.shadowRoot!.querySelectorAll('[part="action-button"]').length ===
      1
  );
});

it("detects mention triggers, anchors the popover to the real textarea, and inserts a selection", async () => {
  const el = (await fixture(html`<lr-prompt-input
    .mentionItems=${[
      { suggestionId: "ada", label: "Ada", description: "Engineering" },
      { suggestionId: "adam", label: "Adam", description: "Research" },
    ]}
  ></lr-prompt-input>`)) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  composer.value = "Hello @ad";
  await composer.updateComplete;
  expect(composer.input?.tagName).to.equal("TEXTAREA");
  composer.selectionStart = composer.value.length;
  composer.selectionEnd = composer.value.length;
  composer.dispatchEvent(
    new CustomEvent("lr-input", {
      bubbles: true,
      composed: true,
      detail: { value: composer.value },
    })
  );
  await el.updateComplete;
  const popover = el.shadowRoot!.querySelector(
    "lr-mention-popover"
  ) as LyraMentionPopover;
  await popover.updateComplete;
  expect(popover.open).to.be.true;
  expect(popover.query).to.equal("ad");
  expect(popover.anchor?.tagName).to.equal("TEXTAREA");
  expect(
    composer.input?.hasAttribute("aria-controls"),
    "a document-owned input must not publish a string IDREF into the popover shadow root"
  ).to.be.false;
  const reflected =
    (
      composer.input as HTMLTextAreaElement & {
        ariaActiveDescendantElement?: Element | null;
      }
    ).ariaActiveDescendantElement === popover.activeDescendantElement;
  if (!reflected) {
    expect(
      composer.input?.hasAttribute("aria-activedescendant"),
      "unsupported cross-root reflection must fail closed without a broken string IDREF"
    ).to.be.false;
  }

  composer.input!.focus();
  const initialActiveDescendant = popover.activeDescendantId;
  const keydown = new KeyboardEvent("keydown", {
    key: "ArrowDown",
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  composer.input!.dispatchEvent(keydown);
  await el.updateComplete;
  expect(keydown.defaultPrevented).to.be.true;
  expect(popover.activeDescendantId).to.not.equal(initialActiveDescendant);
  await waitUntil(() => {
    const currentReflection = (
      composer.input as HTMLTextAreaElement & {
        ariaActiveDescendantElement?: Element | null;
      }
    ).ariaActiveDescendantElement;
    return (
      currentReflection === popover.activeDescendantElement ||
      (popover.shadowRoot!.activeElement as HTMLElement | null)?.dataset['id'] ===
        "adam"
    );
  });
  const usesReflection =
    (
      composer.input as HTMLTextAreaElement & {
        ariaActiveDescendantElement?: Element | null;
      }
    ).ariaActiveDescendantElement === popover.activeDescendantElement;
  if (usesReflection) {
    expect(
      (
        composer.input as HTMLTextAreaElement & {
          ariaActiveDescendantElement?: Element | null;
        }
      ).ariaActiveDescendantElement === popover.activeDescendantElement
    ).to.be.true;
    expect(composer.shadowRoot!.activeElement === composer.input).to.be.true;
  } else {
    expect(
      composer.input?.hasAttribute("aria-activedescendant"),
      "the fallback must continue avoiding a broken string IDREF"
    ).to.be.false;
    expect(
      (popover.shadowRoot!.activeElement as HTMLElement | null)?.dataset['id']
    ).to.equal("adam");
  }

  const selected = oneEvent(el, "lr-mention-select");
  popover.dispatchEvent(
    new CustomEvent("lr-mention-select", {
      bubbles: true,
      composed: true,
      detail: { suggestionId: "ada", index: 0, label: "Ada" },
    })
  );
  const event = (await selected) as CustomEvent<{
    suggestionId: string;
    index: number;
    label: string;
    trigger: "@";
  }>;
  expect(event.detail).to.deep.equal({
    suggestionId: "ada",
    index: 0,
    label: "Ada",
    trigger: "@",
  });
  expect(el.value).to.equal("Hello @Ada ");
});

it("does not overwrite a controlled caret after suggestion selection", async () => {
  const el = (await fixture(html`
    <lr-prompt-input
      .mentionItems=${[{ suggestionId: "ada", label: "Ada" }]}
    ></lr-prompt-input>
  `)) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  composer.value = "Hello @ad";
  await composer.updateComplete;
  composer.setSelectionRange(composer.value.length, composer.value.length);
  composer.dispatchEvent(
    new CustomEvent("lr-input", {
      bubbles: true,
      composed: true,
      detail: { value: composer.value },
    })
  );
  await el.updateComplete;
  const popover = el.shadowRoot!.querySelector(
    "lr-mention-popover"
  ) as LyraMentionPopover;
  await popover.updateComplete;

  el.addEventListener(
    "lr-input",
    () => {
      el.value = "Controlled replacement";
      composer.value = "Controlled replacement";
      el.setSelectionRange(3, 3);
    },
    { once: true }
  );
  popover.dispatchEvent(
    new CustomEvent("lr-mention-select", {
      bubbles: true,
      composed: true,
      detail: { suggestionId: "ada", index: 0, label: "Ada" },
    })
  );
  await el.updateComplete;
  await composer.updateComplete;
  await Promise.resolve();

  expect(el.value).to.equal("Controlled replacement");
  expect(composer.value).to.equal("Controlled replacement");
  expect(composer.selectionStart).to.equal(3);
  expect(composer.selectionEnd).to.equal(3);
});

it("recognizes slash commands and clears suggestions after ordinary input", async () => {
  const el = (await fixture(
    html`<lr-prompt-input></lr-prompt-input>`
  )) as LyraPromptInput;
  el.commandItems = [
    { suggestionId: "summarize", label: "Summarize", insertText: "summary" },
  ];
  await el.updateComplete;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  const popover = el.shadowRoot!.querySelector(
    "lr-mention-popover"
  ) as LyraMentionPopover;

  composer.value = "/summ";
  await composer.updateComplete;
  composer.selectionStart = composer.value.length;
  composer.dispatchEvent(
    new CustomEvent("lr-input", {
      bubbles: true,
      composed: true,
      detail: { value: composer.value },
    })
  );
  await el.updateComplete;
  await popover.updateComplete;
  expect(popover.open).to.be.true;
  expect(popover.query).to.equal("summ");

  composer.value = "ordinary text";
  await composer.updateComplete;
  composer.selectionStart = composer.value.length;
  composer.dispatchEvent(
    new CustomEvent("lr-input", {
      bubbles: true,
      composed: true,
      detail: { value: composer.value },
    })
  );
  await el.updateComplete;
  await popover.updateComplete;
  expect(popover.open).to.be.false;

  composer.value = "/summ";
  await composer.updateComplete;
  composer.selectionStart = composer.value.length;
  composer.dispatchEvent(
    new CustomEvent("lr-input", {
      bubbles: true,
      composed: true,
      detail: { value: composer.value },
    })
  );
  await el.updateComplete;
  await popover.updateComplete;
  const selected = oneEvent(el, "lr-mention-select");
  popover.dispatchEvent(
    new CustomEvent("lr-mention-select", {
      bubbles: true,
      composed: true,
      detail: { suggestionId: "summarize", index: 0, label: "Summarize" },
    })
  );
  expect(
    (
      (await selected) as CustomEvent<{
        suggestionId: string;
        index: number;
        label: string;
        trigger: "/";
      }>
    ).detail
  ).to.deep.equal({
    suggestionId: "summarize",
    index: 0,
    label: "Summarize",
    trigger: "/",
  });
  expect(el.value).to.equal("/summary ");
});

it("preserves the filtered occurrence index when suggestion identifiers repeat", async () => {
  const el = (await fixture(html`
    <lr-prompt-input
      .mentionItems=${[
        { suggestionId: "person", label: "Ada One", insertText: "first" },
        { suggestionId: "person", label: "Ada Two", insertText: "second" },
      ]}
    ></lr-prompt-input>
  `)) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  const popover = el.shadowRoot!.querySelector(
    "lr-mention-popover"
  ) as LyraMentionPopover;
  composer.value = "@";
  await composer.updateComplete;
  composer.setSelectionRange(1, 1);
  composer.dispatchEvent(
    new CustomEvent("lr-input", {
      bubbles: true,
      composed: true,
      detail: { value: "@" },
    })
  );
  await el.updateComplete;
  await popover.updateComplete;

  const selected = oneEvent(el, "lr-mention-select");
  popover.dispatchEvent(
    new CustomEvent("lr-mention-select", {
      bubbles: true,
      composed: true,
      detail: { suggestionId: "person", index: 1, label: "Ada Two" },
    })
  );

  const detail = (
    (await selected) as CustomEvent<{
      suggestionId: string;
      index: number;
      label: string;
      trigger: "@";
    }>
  ).detail;
  expect(detail).to.deep.equal({
    suggestionId: "person",
    index: 1,
    label: "Ada Two",
    trigger: "@",
  });
  expect(el.value).to.equal("@second ");
});

it("invalidates a suggestion session when the controlled value changes", async () => {
  const el = (await fixture(html`
    <lr-prompt-input
      .mentionItems=${[{ suggestionId: "ada", label: "Ada" }]}
    ></lr-prompt-input>
  `)) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  composer.value = "Hello @ad";
  await composer.updateComplete;
  composer.selectionStart = composer.value.length;
  composer.dispatchEvent(
    new CustomEvent("lr-input", {
      bubbles: true,
      composed: true,
      detail: { value: composer.value },
    })
  );
  await el.updateComplete;
  const popover = el.shadowRoot!.querySelector(
    "lr-mention-popover"
  ) as LyraMentionPopover;
  expect(popover.open).to.be.true;

  el.value = "Controlled replacement";
  await el.updateComplete;
  await popover.updateComplete;
  expect(popover.open).to.be.false;

  popover.dispatchEvent(
    new CustomEvent("lr-mention-select", {
      bubbles: true,
      composed: true,
      detail: { suggestionId: "ada", index: 0, label: "Ada" },
    })
  );
  expect(el.value).to.equal("Controlled replacement");
});

it("invalidates a suggestion session when its public item collection changes", async () => {
  const el = (await fixture(html`
    <lr-prompt-input
      .mentionItems=${[{ suggestionId: "ada", label: "Ada" }]}
    ></lr-prompt-input>
  `)) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  composer.value = "@a";
  await composer.updateComplete;
  composer.selectionStart = composer.value.length;
  composer.dispatchEvent(
    new CustomEvent("lr-input", {
      bubbles: true,
      composed: true,
      detail: { value: composer.value },
    })
  );
  await el.updateComplete;
  const popover = el.shadowRoot!.querySelector(
    "lr-mention-popover"
  ) as LyraMentionPopover;
  expect(popover.open).to.be.true;

  el.mentionItems = [{ suggestionId: "bea", label: "Bea" }];
  await el.updateComplete;
  await popover.updateComplete;
  expect(popover.open).to.be.false;
});

it("does not revive a stale suggestion session after disable and re-enable", async () => {
  const el = (await fixture(html`
    <lr-prompt-input
      .mentionItems=${[{ suggestionId: "ada", label: "Ada" }]}
    ></lr-prompt-input>
  `)) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  composer.value = "@a";
  await composer.updateComplete;
  composer.selectionStart = composer.value.length;
  composer.dispatchEvent(
    new CustomEvent("lr-input", {
      bubbles: true,
      composed: true,
      detail: { value: composer.value },
    })
  );
  await el.updateComplete;
  const popover = el.shadowRoot!.querySelector(
    "lr-mention-popover"
  ) as LyraMentionPopover;

  el.disabled = true;
  await el.updateComplete;
  el.disabled = false;
  await el.updateComplete;
  await popover.updateComplete;

  expect(popover.open).to.be.false;
});

it("closes suggestions when focus leaves the prompt and popover composite", async () => {
  const wrapper = await fixture(html`<div>
    <lr-prompt-input
      .mentionItems=${[{ suggestionId: "ada", label: "Ada" }]}
    ></lr-prompt-input>
    <button id="outside" type="button">Outside</button>
  </div>`);
  const el = wrapper.querySelector("lr-prompt-input") as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  const popover = el.shadowRoot!.querySelector(
    "lr-mention-popover"
  ) as LyraMentionPopover;
  composer.value = "@a";
  await composer.updateComplete;
  composer.setSelectionRange(2, 2);
  composer.dispatchEvent(
    new CustomEvent("lr-input", {
      bubbles: true,
      composed: true,
      detail: { value: "@a" },
    })
  );
  await el.updateComplete;
  await popover.updateComplete;
  expect(popover.open).to.be.true;

  composer.focus();
  (wrapper.querySelector("#outside") as HTMLButtonElement).focus();
  await waitUntil(() => !popover.open);
});

it("does not transfer suggestion focus after an outside control takes ownership", async () => {
  const wrapper = await fixture(html`<div>
    <lr-prompt-input
      .mentionItems=${[
        { suggestionId: "ada", label: "Ada" },
        { suggestionId: "bea", label: "Bea" },
      ]}
    ></lr-prompt-input>
    <button id="outside" type="button">Outside</button>
  </div>`);
  const el = wrapper.querySelector("lr-prompt-input") as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  const popover = el.shadowRoot!.querySelector(
    "lr-mention-popover"
  ) as LyraMentionPopover;
  composer.value = "@";
  await composer.updateComplete;
  composer.setSelectionRange(1, 1);
  composer.dispatchEvent(
    new CustomEvent("lr-input", {
      bubbles: true,
      composed: true,
      detail: { value: "@" },
    })
  );
  await el.updateComplete;
  await popover.updateComplete;

  let transfers = 0;
  let guardedAfterOwnershipChanged = false;
  popover.syncActiveDescendant = () => false;
  const outside = wrapper.querySelector("#outside") as HTMLButtonElement;
  popover.focusActiveOption = async (options = {}) => {
    transfers += 1;
    outside.focus();
    guardedAfterOwnershipChanged = options.ownsFocus?.() === false;
    return false;
  };
  composer.focus();
  composer.input!.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      composed: true,
      cancelable: true,
    })
  );
  await waitUntil(() => transfers === 1);

  expect(document.activeElement === outside).to.be.true;
  expect(guardedAfterOwnershipChanged).to.be.true;
});

it("stops the popover-owned lr-mention-close event from leaking past the prompt input as a raw event", async () => {
  // <lr-mention-popover>'s own lr-mention-close (bubbles + composed, emitted from its updated()
  // whenever `open` transitions true -> false, e.g. Escape) reaches the prompt input's
  // shadow-internal listener and, unless that listener stops it, keeps bubbling right past the
  // prompt input host -- lr-prompt-input never re-declares or re-emits lr-mention-close itself,
  // so an ancestor listening for it would otherwise see the popover's raw event under an
  // undocumented name.
  const wrapper = await fixture(html`<div>
    <lr-prompt-input
      .mentionItems=${[{ suggestionId: "ada", label: "Ada" }]}
    ></lr-prompt-input>
  </div>`);
  const el = wrapper.querySelector("lr-prompt-input") as LyraPromptInput;
  const popover = el.shadowRoot!.querySelector(
    "lr-mention-popover"
  ) as LyraMentionPopover;

  let leaked = 0;
  wrapper.addEventListener("lr-mention-close", () => leaked++);

  popover.dispatchEvent(
    new CustomEvent("lr-mention-close", { bubbles: true, composed: true })
  );

  expect(
    leaked,
    "the popover-owned lr-mention-close must not leak past the prompt input"
  ).to.equal(0);
});

it("forwards composer submit and stop events from its own host", async () => {
  const el = (await fixture(
    html`<lr-prompt-input value="Question"></lr-prompt-input>`
  )) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector("lr-chat-composer")!;

  const submit = oneEvent(el, "lr-submit");
  composer.dispatchEvent(
    new CustomEvent("lr-submit", {
      bubbles: true,
      composed: true,
      detail: { value: "Question" },
    })
  );
  expect(
    ((await submit) as CustomEvent<{ value: string }>).detail.value
  ).to.equal("Question");

  const stop = oneEvent(el, "lr-stop");
  composer.dispatchEvent(
    new CustomEvent("lr-stop", { bubbles: true, composed: true })
  );
  await stop;
});

it("emits attachment additions and removals as controlled requests", async () => {
  const el = (await fixture(html`<lr-prompt-input
    .attachments=${[{ attachmentId: "doc-1", name: "report.pdf" }]}
  ></lr-prompt-input>`)) as LyraPromptInput;
  const file = new File(["hello"], "hello.txt", { type: "text/plain" });
  const added = oneEvent(el, "lr-attachments-add");
  el.shadowRoot!.querySelector("lr-attachment-trigger")!.dispatchEvent(
    new CustomEvent("lr-files", {
      bubbles: true,
      composed: true,
      detail: { capability: "files", files: [file] },
    })
  );
  expect(
    ((await added) as CustomEvent<{ files: File[] }>).detail.files[0]?.name
  ).to.equal("hello.txt");

  const removed = oneEvent(el, "lr-attachment-remove");
  el.shadowRoot!.querySelector("lr-attachment-chip")!.dispatchEvent(
    new CustomEvent("lr-remove", {
      bubbles: true,
      composed: true,
      detail: { attachmentId: "doc-1" },
    })
  );
  expect(
    ((await removed) as CustomEvent<{ attachmentId: string }>).detail
      .attachmentId
  ).to.equal("doc-1");
});

it("translates composed control events from its host without leaking the raw child events", async () => {
  const el = (await fixture(html`<lr-prompt-input
    .attachments=${[
      {
        attachmentId: "doc-1",
        name: "report.pdf",
        mimeType: "application/pdf",
        uri: "https://example.test/report.pdf",
      },
    ]}
    .modelCatalog=${["fast"]}
    .sources=${[{ id: "doc-1", label: "Report" }]}
  ></lr-prompt-input>`)) as LyraPromptInput;
  const modelSelect = el.shadowRoot!.querySelector("lr-model-select")!;
  const sourcePicker = el.shadowRoot!.querySelector("lr-source-picker")!;
  const attachment = el.shadowRoot!.querySelector("lr-attachment-chip")!;

  let leakedModelChanges = 0;
  el.addEventListener("lr-change", () => leakedModelChanges++);
  const modelChanged = oneEvent(el, "lr-model-change");
  modelSelect.dispatchEvent(
    new CustomEvent("lr-change", {
      bubbles: true,
      composed: true,
      detail: { value: "fast", inCatalog: true },
    })
  );
  const modelEvent = (await modelChanged) as CustomEvent<{
    value: string;
    inCatalog: boolean;
  }>;
  expect(modelEvent.target === el).to.be.true;
  expect(modelEvent.detail).to.deep.equal({ value: "fast", inCatalog: true });
  expect(leakedModelChanges).to.equal(0);

  const sourceTargets: string[] = [];
  el.addEventListener("lr-sources-change", (event) => {
    sourceTargets.push((event.target as Element).tagName);
  });
  sourcePicker.dispatchEvent(
    new CustomEvent("lr-sources-change", {
      bubbles: true,
      composed: true,
      detail: { selectedSourceIds: ['doc-1'] },
    })
  );
  expect(sourceTargets).to.deep.equal(["LR-PROMPT-INPUT"]);

  const previewed = oneEvent(el, "lr-attachment-preview-request");
  const previewRequest = new CustomEvent("lr-preview-request", {
    bubbles: true,
    composed: true,
    cancelable: true,
    detail: {
      attachmentId: "doc-1",
      name: "report.pdf",
      mimeType: "application/pdf",
      src: "https://example.test/report.pdf",
    },
  });
  attachment.dispatchEvent(previewRequest);
  const previewEvent = (await previewed) as CustomEvent<{
    attachmentId: string;
    src: string;
  }>;
  expect(previewEvent.target === el).to.be.true;
  expect(previewEvent.detail.attachmentId).to.equal("doc-1");
  expect(previewEvent.detail.src).to.equal("https://example.test/report.pdf");
});

it("propagates a host preview-request veto back to the attachment chip request", async () => {
  const el = (await fixture(html`<lr-prompt-input
    .attachments=${[
      {
        attachmentId: "doc-1",
        name: "report.pdf",
        mimeType: "application/pdf",
        uri: "https://example.test/report.pdf",
      },
    ]}
  ></lr-prompt-input>`)) as LyraPromptInput;
  const attachment = el.shadowRoot!.querySelector("lr-attachment-chip")!;
  el.addEventListener(
    "lr-attachment-preview-request",
    (event) => event.preventDefault(),
    { once: true }
  );
  const request = new CustomEvent("lr-preview-request", {
    bubbles: true,
    composed: true,
    cancelable: true,
    detail: {
      attachmentId: "doc-1",
      name: "report.pdf",
      mimeType: "application/pdf",
      src: "https://example.test/report.pdf",
    },
  });

  expect(attachment.dispatchEvent(request)).to.be.false;
  expect(request.defaultPrevented).to.be.true;
});

it("contains auxiliary native input/change events and publishes one primary editing pair", async () => {
  const wrapper = await fixture(html`<div>
    <lr-prompt-input .modelCatalog=${["fast"]}></lr-prompt-input>
  </div>`);
  const el = wrapper.querySelector("lr-prompt-input") as LyraPromptInput;
  const modelSelect = el.shadowRoot!.querySelector("lr-model-select")!;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  await composer.updateComplete;
  const textarea = composer.input!;
  const nativeInputs: InputEvent[] = [];
  const nativeChanges: Event[] = [];
  let prefixedInputs = 0;
  let prefixedChanges = 0;
  wrapper.addEventListener("input", (event) =>
    nativeInputs.push(event as InputEvent)
  );
  wrapper.addEventListener("change", (event) => nativeChanges.push(event));
  el.addEventListener("lr-input", () => prefixedInputs++);
  el.addEventListener("lr-change", () => prefixedChanges++);

  modelSelect.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      composed: true,
      data: "auxiliary",
      inputType: "insertText",
    })
  );
  modelSelect.dispatchEvent(
    new Event("change", { bubbles: true, composed: true })
  );
  expect(nativeInputs).to.have.lengthOf(0);
  expect(nativeChanges).to.have.lengthOf(0);

  textarea.value = "primary";
  textarea.dispatchEvent(
    new InputEvent("input", {
      bubbles: true,
      composed: true,
      data: "y",
      inputType: "insertText",
    })
  );
  textarea.dispatchEvent(
    new Event("change", { bubbles: true, composed: true })
  );

  expect(nativeInputs).to.have.lengthOf(1);
  expect(nativeInputs[0]).to.be.instanceOf(InputEvent);
  expect(nativeInputs[0]?.target === el).to.be.true;
  expect(nativeInputs[0]?.data).to.equal("y");
  expect(nativeChanges).to.have.lengthOf(1);
  expect(nativeChanges[0]?.target === el).to.be.true;
  expect(prefixedInputs).to.equal(1);
  expect(prefixedChanges).to.equal(1);
});

it("blocks a genuine child event when capture disables the prompt in the same dispatch", async () => {
  const el = (await fixture(html`
    <lr-prompt-input .modelCatalog=${["fast"]}></lr-prompt-input>
  `)) as LyraPromptInput;
  const modelSelect = el.shadowRoot!.querySelector("lr-model-select")!;
  let modelChanges = 0;
  el.addEventListener("lr-model-change", () => modelChanges++);
  el.addEventListener(
    "lr-change",
    () => {
      el.disabled = true;
    },
    { capture: true, once: true }
  );

  modelSelect.dispatchEvent(
    new CustomEvent("lr-change", {
      bubbles: true,
      composed: true,
      detail: { value: "fast", inCatalog: true },
    })
  );

  expect(el.disabled).to.be.true;
  expect(modelChanges).to.equal(0);
});

it("forwards attachment lifecycle state and exposes a translated retry request", async () => {
  const attachments: LyraPromptInputAttachment[] = [
    {
      attachmentId: "failed-doc",
      name: "failed.pdf",
      status: "error",
    },
    {
      attachmentId: "uploading-doc",
      name: "uploading.pdf",
      status: "uploading",
      progress: 42,
    },
  ];
  const el = (await fixture(html`<lr-prompt-input
    .attachments=${attachments}
  ></lr-prompt-input>`)) as LyraPromptInput;
  const chips = Array.from(
    el.shadowRoot!.querySelectorAll("lr-attachment-chip")
  ) as LyraAttachmentChip[];
  const failed = chips[0]!;
  const uploading = chips[1]!;
  await Promise.all(chips.map((chip) => chip.updateComplete));

  expect(failed.status).to.equal("error");
  expect(uploading.status).to.equal("uploading");
  expect(uploading.progress).to.equal(42);
  expect(
    uploading
      .shadowRoot!.querySelector('[part="progress"]')
      ?.getAttribute("aria-valuenow")
  ).to.equal("42");

  let rawRetries = 0;
  el.addEventListener("lr-retry", () => rawRetries++);
  const retried = oneEvent(el, "lr-attachment-retry");
  failed.dispatchEvent(
    new CustomEvent("lr-retry", {
      bubbles: true,
      composed: true,
      detail: { attachmentId: "failed-doc" },
    })
  );
  const retryEvent = (await retried) as CustomEvent<{ attachmentId: string }>;
  expect(retryEvent.target === el).to.be.true;
  expect(retryEvent.detail.attachmentId).to.equal("failed-doc");
  expect(rawRetries).to.equal(0);
});

it("forwards LyraPromptInputAttachment.bytes to the attachment chip byte-count contract", async () => {
  const attachments: LyraPromptInputAttachment[] = [
    { attachmentId: "sized-doc", name: "sized.pdf", bytes: 2_048 },
  ];
  const el = (await fixture(html`
    <lr-prompt-input .attachments=${attachments}></lr-prompt-input>
  `)) as LyraPromptInput;
  const chip = el.shadowRoot!.querySelector(
    "lr-attachment-chip"
  ) as LyraAttachmentChip;
  await chip.updateComplete;

  expect(chip.bytes).to.equal(2_048);
  expect(
    chip.shadowRoot!.querySelector('[part="size"]')?.textContent?.trim()
  ).to.equal("2.0 KB");
});

it("preserves omitted attachment bytes instead of converting unknown size to a known empty file", async () => {
  const el = (await fixture(html`
    <lr-prompt-input
      .attachments=${[{ attachmentId: "unknown-size", name: "unknown.pdf" }]}
    ></lr-prompt-input>
  `)) as LyraPromptInput;
  const chip = el.shadowRoot!.querySelector(
    "lr-attachment-chip"
  ) as LyraAttachmentChip;

  expect(chip.bytes).to.equal(undefined);
  const size = chip.shadowRoot!.querySelector('[part="size"]') as HTMLElement;
  expect(size.hasAttribute("hidden")).to.be.true;
  expect(size.textContent?.trim()).to.equal("");
});

it("gates every composed interaction while disabled and forwards host click to the composer", async () => {
  const el = (await fixture(html`<lr-prompt-input
    disabled
    .attachments=${[{ attachmentId: "doc-1", name: "report.pdf" }]}
    .sources=${[{ id: "doc-1", label: "Report" }]}
    .mentionItems=${[{ suggestionId: "ada", label: "Ada" }]}
  ></lr-prompt-input>`)) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  const attachment = el.shadowRoot!.querySelector("lr-attachment-chip")!;
  const attachmentTrigger = el.shadowRoot!.querySelector(
    "lr-attachment-trigger"
  )!;
  const sources = el.shadowRoot!.querySelector("details")!;
  const popover = el.shadowRoot!.querySelector(
    "lr-mention-popover"
  ) as LyraMentionPopover;
  let additions = 0;
  let removals = 0;
  el.addEventListener("lr-attachments-add", () => additions++);
  el.addEventListener("lr-attachment-remove", () => removals++);

  expect(attachment.removable).to.be.false;
  expect(sources.inert).to.be.true;
  expect(popover.open).to.be.false;

  attachmentTrigger.dispatchEvent(
    new CustomEvent("lr-files", {
      bubbles: true,
      composed: true,
      detail: { capability: "files", files: [] },
    })
  );
  attachment.dispatchEvent(
    new CustomEvent("lr-remove", {
      bubbles: true,
      composed: true,
      detail: { attachmentId: "doc-1" },
    })
  );
  expect(additions).to.equal(0);
  expect(removals).to.equal(0);

  el.click();
  expect(composer.shadowRoot!.activeElement == null).to.equal(true);
  el.disabled = false;
  await el.updateComplete;
  el.click();
  expect(composer.shadowRoot!.activeElement?.getAttribute("part")).to.equal(
    "textarea"
  );
});

it("makes previewable attachments inert and suppresses their wrapper events while disabled", async () => {
  const el = (await fixture(html`<lr-prompt-input
    disabled
    .attachments=${[
      {
        attachmentId: "doc-1",
        name: "report.pdf",
        mimeType: "application/pdf",
        uri: "https://example.test/report.pdf",
      },
    ]}
  ></lr-prompt-input>`)) as LyraPromptInput;
  const attachment = el.shadowRoot!.querySelector(
    "lr-attachment-chip"
  ) as HTMLElement & {
    inert: boolean;
  };
  let previewEvents = 0;
  el.addEventListener("lr-attachment-preview-request", () => previewEvents++);

  const request = new CustomEvent("lr-preview-request", {
    bubbles: true,
    composed: true,
    cancelable: true,
    detail: {
      attachmentId: "doc-1",
      name: "report.pdf",
      mimeType: "application/pdf",
      src: "https://example.test/report.pdf",
    },
  });
  attachment.dispatchEvent(request);

  expect(attachment.inert).to.be.true;
  expect(previewEvents).to.equal(0);
  expect(request.defaultPrevented).to.be.true;
});

it("applies per-instance strings to the prompt label", async () => {
  const el = (await fixture(
    html`<lr-prompt-input
      .strings=${{ promptInputLabel: "Invite IA" }}
    ></lr-prompt-input>`
  )) as LyraPromptInput;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')?.getAttribute("aria-label")
  ).to.equal("Invite IA");
});

it("preserves an explicitly empty host aria-label and restores the prompt fallback when removed", async () => {
  const el = (await fixture(
    html`<lr-prompt-input
      aria-label="Prompt workspace"
      label="Visible prompt"
    ></lr-prompt-input>`
  )) as LyraPromptInput;
  const base = el.shadowRoot!.querySelector('[part="base"]')!;
  expect(base.getAttribute("aria-label")).to.equal("Prompt workspace");

  el.accessibleLabel = "";
  await el.updateComplete;
  expect(base.getAttribute("aria-label")).to.equal("");

  el.accessibleLabel = null;
  await el.updateComplete;
  expect(base.getAttribute("aria-label")).to.equal("Visible prompt");
});

it("is accessible with its composed controls populated", async () => {
  const el = await fixture(html`<lr-prompt-input
    .modelCatalog=${["fast"]}
    .sources=${[{ id: "doc-1", label: "Report" }]}
    .mentionItems=${[{ suggestionId: "ada", label: "Ada" }]}
  ></lr-prompt-input>`);
  expect(el.shadowRoot!.querySelectorAll("lr-chat-composer")).to.have.lengthOf(
    1
  );
  await expect(el).to.be.accessible();
});

// -- Focus/selection delegation to the embedded composer --------------------

it("delegates focus(), blur() and select() to the embedded composer", async () => {
  const el = (await fixture(
    html`<lr-prompt-input></lr-prompt-input>`
  )) as LyraPromptInput;
  await el.updateComplete;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  await composer.updateComplete;
  const textarea = composer.shadowRoot!.querySelector(
    "textarea"
  ) as HTMLTextAreaElement;

  el.focus();
  expect(composer.shadowRoot!.activeElement === textarea).to.equal(true);

  el.value = "draft text";
  await el.updateComplete;
  await composer.updateComplete;
  el.select();
  expect(textarea.selectionStart).to.equal(0);
  expect(textarea.selectionEnd).to.equal(textarea.value.length);

  el.blur();
  expect(composer.shadowRoot!.activeElement !== textarea).to.equal(true);
});

it("forwards editing-assistance attributes to the nested native textarea", async () => {
  const el = (await fixture(html`
    <lr-prompt-input
      spellcheck="false"
      autocapitalize="off"
      autocorrect="off"
      wrap="hard"
      autocomplete="one-time-code"
      inputmode="numeric"
      enterkeyhint="send"
    ></lr-prompt-input>
  `)) as LyraPromptInput;
  const facade = el as LyraPromptInput & PromptInputEditingFacade;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  await composer.updateComplete;
  const textarea = composer.shadowRoot!.querySelector(
    "textarea"
  ) as HTMLTextAreaElement;

  expect(facade.spellcheck).to.be.false;
  expect(facade.autocapitalize).to.equal("off");
  expect(facade.autocorrect).to.equal(false);
  expect(facade.wrap).to.equal("hard");
  expect(facade.autocomplete).to.equal("one-time-code");
  expect(facade.inputMode).to.equal("numeric");
  expect(facade.enterKeyHint).to.equal("send");
  expect(textarea.spellcheck).to.be.false;
  expect(textarea.getAttribute("autocapitalize")).to.equal("off");
  expect(textarea.getAttribute("autocorrect")).to.equal("off");
  expect(textarea.getAttribute("wrap")).to.equal("hard");
  expect(textarea.getAttribute("autocomplete")).to.equal("one-time-code");
  expect(textarea.getAttribute("inputmode")).to.equal("numeric");
  expect(textarea.getAttribute("enterkeyhint")).to.equal("send");
});

it("forwards readOnly/minLength/maxLength and keeps read-only edits inert", async () => {
  const el = (await fixture(html`
    <lr-prompt-input
      value="draft"
      readonly
      minlength="5"
      maxlength="8"
    ></lr-prompt-input>
  `)) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  await composer.updateComplete;
  const textarea = composer.input!;
  let inputEvents = 0;
  el.addEventListener("lr-input", () => inputEvents++);

  expect(el.readOnly).to.be.true;
  expect(composer.readOnly).to.be.true;
  expect(textarea.readOnly).to.be.true;
  expect(composer.minLength).to.equal(5);
  expect(composer.maxLength).to.equal(8);
  expect(textarea.minLength).to.equal(5);
  expect(textarea.maxLength).to.equal(8);

  composer.dispatchEvent(
    new CustomEvent("lr-input", {
      bubbles: true,
      composed: true,
      detail: { value: "changed" },
    })
  );
  expect(el.value).to.equal("draft");
  expect(inputEvents).to.equal(0);

  el.readOnly = false;
  el.minLength = undefined;
  el.maxLength = undefined;
  await el.updateComplete;
  await composer.updateComplete;
  expect(textarea.readOnly).to.be.false;
  expect(textarea.hasAttribute("minlength")).to.be.false;
  expect(textarea.hasAttribute("maxlength")).to.be.false;

  el.minLength = Number.NEGATIVE_INFINITY;
  el.maxLength = 6.8;
  await el.updateComplete;
  await composer.updateComplete;
  expect(textarea.hasAttribute("minlength")).to.be.false;
  expect(textarea.maxLength).to.equal(6);
});

it('publishes exactly one native focus/blur pair for the primary editor, and never lr-focus/lr-blur', async () => {
  const wrapper = await fixture(html`<div>
    <button id="before" type="button">Before</button>
    <lr-prompt-input></lr-prompt-input>
    <button id="after" type="button">After</button>
  </div>`);
  const el = wrapper.querySelector("lr-prompt-input") as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  await composer.updateComplete;
  const before = wrapper.querySelector("#before") as HTMLButtonElement;
  const after = wrapper.querySelector("#after") as HTMLButtonElement;
  const focuses: FocusEvent[] = [];
  const blurs: FocusEvent[] = [];
  let prefixedFocuses = 0;
  let prefixedBlurs = 0;
  el.addEventListener('focus', (event) => focuses.push(event as FocusEvent));
  el.addEventListener('blur', (event) => blurs.push(event as FocusEvent));
  el.addEventListener("lr-focus", () => prefixedFocuses++);
  el.addEventListener("lr-blur", () => prefixedBlurs++);

  before.focus();
  composer.focus();
  after.focus();

  expect(focuses).to.have.lengthOf(1);
  expect(blurs).to.have.lengthOf(1);
  expect(focuses[0]).to.be.instanceOf(FocusEvent);
  expect(blurs[0]).to.be.instanceOf(FocusEvent);
  expect(focuses[0]?.target === el).to.be.true;
  expect(blurs[0]?.target === el).to.be.true;
  // v9 dropped the v8 lr-focus/lr-blur compatibility aliases -- only the native pair remains.
  expect(prefixedFocuses).to.equal(0);
  expect(prefixedBlurs).to.equal(0);
});

it('does not leak a descendant control\'s own native focus/blur as the composite\'s focus/blur', async () => {
  const el = (await fixture(
    html`<lr-prompt-input .modelCatalog=${['fast']}></lr-prompt-input>`
  )) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector(
    'lr-chat-composer'
  ) as LyraChatComposer;
  await composer.updateComplete;
  const modelSelect = el.shadowRoot!.querySelector(
    'lr-model-select'
  ) as HTMLElement & { focus(): void; blur(): void };
  const attachmentTrigger = el.shadowRoot!.querySelector(
    'lr-attachment-trigger'
  ) as HTMLElement & { focus(): void; blur(): void };
  const focuses: FocusEvent[] = [];
  const blurs: FocusEvent[] = [];
  el.addEventListener('focus', (event) => focuses.push(event as FocusEvent));
  el.addEventListener('blur', (event) => blurs.push(event as FocusEvent));

  modelSelect.focus();
  modelSelect.blur();
  attachmentTrigger.focus();
  attachmentTrigger.blur();

  expect(focuses).to.have.lengthOf(0);
  expect(blurs).to.have.lengthOf(0);

  // The primary composer's own focus/blur still relays exactly once -- only descendants leak.
  composer.focus();
  composer.blur();

  expect(focuses).to.have.lengthOf(1);
  expect(blurs).to.have.lengthOf(1);
  expect(focuses[0]?.target === el).to.be.true;
  expect(blurs[0]?.target === el).to.be.true;
});

it("does not render empty chips/footer wrappers and tracks live/reconnected slot content", async () => {
  const container = await fixture(
    html`<div><lr-prompt-input></lr-prompt-input></div>`
  );
  const el = container.querySelector("lr-prompt-input") as LyraPromptInput;
  expect(el.shadowRoot!.querySelector('[part="chips"]') === null).to.be.true;
  expect(el.shadowRoot!.querySelector('[part="footer"]') === null).to.be.true;

  const chip = document.createElement("span");
  chip.slot = "chips";
  chip.textContent = "report.pdf";
  const footer = document.createElement("span");
  footer.slot = "footer";
  footer.textContent = "Footer";
  el.append(chip, footer);
  await waitUntil(
    () =>
      el.shadowRoot!.querySelector('[part="chips"]') !== null &&
      el.shadowRoot!.querySelector('[part="footer"]') !== null
  );

  chip.remove();
  footer.remove();
  await waitUntil(
    () =>
      el.shadowRoot!.querySelector('[part="chips"]') === null &&
      el.shadowRoot!.querySelector('[part="footer"]') === null
  );

  el.remove();
  const reconnectedChip = document.createElement("span");
  reconnectedChip.slot = "chips";
  reconnectedChip.textContent = "reconnected.txt";
  el.append(reconnectedChip);
  container.append(el);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="chips"]')).to.not.equal(null);
  expect(el.shadowRoot!.querySelector('[part="footer"]') === null).to.be.true;
});

it("leaves native editing-assistance defaults unchanged when the new prompt properties are unset", async () => {
  const el = (await fixture(
    html`<lr-prompt-input></lr-prompt-input>`
  )) as LyraPromptInput;
  const facade = el as LyraPromptInput & PromptInputEditingFacade;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  await composer.updateComplete;
  const textarea = composer.shadowRoot!.querySelector(
    "textarea"
  ) as HTMLTextAreaElement;

  expect(facade.spellcheck).to.be.true;
  expect(facade.autocapitalize).to.equal("");
  expect(facade.autocorrect).to.equal(true);
  expect(facade.wrap).to.equal("soft");
  expect(facade.autocomplete).to.equal("");
  expect(facade.inputMode).to.equal("");
  expect(facade.enterKeyHint).to.equal("");
  expect(textarea.spellcheck).to.be.true;
  expect(textarea.getAttribute("wrap")).to.equal("soft");
  expect(textarea.hasAttribute("autocapitalize")).to.be.false;
  expect(textarea.hasAttribute("autocorrect")).to.be.false;
  expect(textarea.hasAttribute("autocomplete")).to.be.false;
  expect(textarea.hasAttribute("inputmode")).to.be.false;
  expect(textarea.hasAttribute("enterkeyhint")).to.be.false;
});

it("forwards selection and silent range editing while synchronizing the outer prompt value", async () => {
  const el = (await fixture(
    html`<lr-prompt-input value="hello world"></lr-prompt-input>`
  )) as LyraPromptInput;
  const facade = el as LyraPromptInput & PromptInputEditingFacade;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  await composer.updateComplete;
  const textarea = composer.shadowRoot!.querySelector(
    "textarea"
  ) as HTMLTextAreaElement;
  let inputEvents = 0;
  el.addEventListener("lr-input", () => inputEvents++);

  expect(facade.input === textarea).to.be.true;
  facade.select();
  expect(facade.selectionStart).to.equal(0);
  expect(facade.selectionEnd).to.equal("hello world".length);

  facade.setSelectionRange(6, 11, "forward");
  expect(facade.selectionStart).to.equal(6);
  expect(facade.selectionEnd).to.equal(11);
  expect(facade.selectionDirection).to.equal("forward");

  facade.selectionStart = 0;
  facade.selectionEnd = textarea.value.length;
  facade.selectionDirection = "backward";
  expect(textarea.selectionStart).to.equal(0);
  expect(textarea.selectionEnd).to.equal("hello world".length);
  expect(textarea.selectionDirection).to.equal("backward");

  facade.setRangeText("Lyra", 6, 11, "select");
  expect(el.value).to.equal("hello Lyra");
  expect(composer.value).to.equal("hello Lyra");
  expect(textarea.value).to.equal("hello Lyra");

  facade.setSelectionRange(6, 10);
  facade.setRangeText("world");
  expect(el.value).to.equal("hello world");
  expect(composer.value).to.equal("hello world");
  expect(inputEvents).to.equal(0);
});

it("keeps the text editing facade inert before the composed textarea renders", () => {
  const detached = document.createElement(
    "lr-prompt-input"
  ) as LyraPromptInput & PromptInputEditingFacade;

  expect(detached.input === null).to.be.true;
  expect(detached.selectionStart).to.equal(null);
  expect(detached.selectionEnd).to.equal(null);
  expect(detached.selectionDirection).to.equal(null);
  expect(() => {
    detached.selectionStart = 0;
    detached.selectionEnd = 0;
    detached.selectionDirection = "forward";
    detached.select();
    detached.setSelectionRange(0, 0);
    detached.setRangeText("ignored");
  }).to.not.throw();
  expect(detached.value).to.equal("");
});

it("forwards status, placeholder and submitOnEnter to the composed chat composer", async () => {
  const el = (await fixture(html`
    <lr-prompt-input
      status="busy"
      placeholder="Ask anything"
      submit-on-enter="false"
    ></lr-prompt-input>
  `)) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  await composer.updateComplete;

  // `status` is not cosmetic: the composer gates Enter-to-submit and its send/stop button on it.
  expect(composer.status).to.equal("busy");
  expect(composer.placeholder).to.equal("Ask anything");
  expect(composer.submitOnEnter).to.equal(false);
});

it("forwards the unset defaults of status, placeholder and submitOnEnter unchanged", async () => {
  const el = (await fixture(
    html`<lr-prompt-input></lr-prompt-input>`
  )) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  await composer.updateComplete;

  expect(el.status).to.equal("idle");
  expect(el.placeholder).to.equal("");
  expect(el.submitOnEnter).to.equal(true);
  expect(composer.status).to.equal("idle");
  expect(composer.placeholder).to.equal("");
  expect(composer.submitOnEnter).to.equal(true);
});

it("suppresses Enter-to-submit end to end when submit-on-enter is false, and restores it when true", async () => {
  const el = (await fixture(html`
    <lr-prompt-input submit-on-enter="false" value="drafted"></lr-prompt-input>
  `)) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  await composer.updateComplete;
  const textarea = composer.shadowRoot!.querySelector(
    "textarea"
  ) as HTMLTextAreaElement;

  let submits = 0;
  el.addEventListener("lr-submit", () => {
    submits += 1;
  });
  textarea.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      composed: true,
    })
  );
  expect(
    submits,
    "Enter must not submit while submit-on-enter is false"
  ).to.equal(0);

  el.submitOnEnter = true;
  await el.updateComplete;
  await composer.updateComplete;
  textarea.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      composed: true,
    })
  );
  expect(
    submits,
    "Enter submits again once submit-on-enter is restored"
  ).to.equal(1);
});

it("gates Enter-to-submit on the forwarded status, so a busy prompt cannot submit again", async () => {
  const el = (await fixture(
    html`<lr-prompt-input status="busy" value="drafted"></lr-prompt-input>`
  )) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector(
    "lr-chat-composer"
  ) as LyraChatComposer;
  await composer.updateComplete;
  const textarea = composer.shadowRoot!.querySelector(
    "textarea"
  ) as HTMLTextAreaElement;

  let submits = 0;
  el.addEventListener("lr-submit", () => {
    submits += 1;
  });
  textarea.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      composed: true,
    })
  );
  expect(submits, "a busy composer never submits on Enter").to.equal(0);

  el.status = "idle";
  await el.updateComplete;
  await composer.updateComplete;
  textarea.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      composed: true,
    })
  );
  expect(submits, "an idle composer submits on Enter").to.equal(1);
});

it("normalizes attachment identity before rendering and keys surviving chips by attachmentId", async () => {
  const first = { attachmentId: "first", name: "First.pdf" };
  const second = { attachmentId: "second", name: "Second.pdf" };
  const el = (await fixture(html`<lr-prompt-input
    .attachments=${[
      { attachmentId: "", name: "Empty.pdf" },
      first,
      { attachmentId: "first", name: "Ignored.pdf" },
      { attachmentId: "   ", name: "Whitespace.pdf" },
      second,
    ]}
  ></lr-prompt-input>`)) as LyraPromptInput;

  let chips = [...el.shadowRoot!.querySelectorAll<LyraAttachmentChip>("lr-attachment-chip")];
  expect(chips.map((chip) => chip.attachmentId)).to.deep.equal(["first", "second"]);
  expect(chips.map((chip) => chip.name)).to.deep.equal(["First.pdf", "Second.pdf"]);
  const retainedSecond = chips[1]!;

  el.attachments = [second, first];
  await el.updateComplete;
  chips = [...el.shadowRoot!.querySelectorAll<LyraAttachmentChip>("lr-attachment-chip")];
  expect(chips.map((chip) => chip.attachmentId)).to.deep.equal(["second", "first"]);
  expect(chips[0] === retainedSecond, "the same attachment keeps its rendered chip").to.equal(true);
});

it('normalizes source, selected-source, and queue identities before rendering or section gating', async () => {
  const el = await fixture<LyraPromptInput>(html`<lr-prompt-input
    .sources=${[
      null,
      { id: '   ', label: 'Blank' },
      { id: 'source-a', label: 'First source' },
      { id: 'source-a', label: 'Ignored duplicate' },
    ] as unknown as LyraPromptInput['sources']}
    .selectedSourceIds=${['', 'source-a', 'source-a']}
    .queue=${[
      undefined,
      { id: '', value: 'Blank' },
      { id: 'queue-a', value: 'First queued prompt' },
      { id: 'queue-a', value: 'Ignored duplicate' },
    ] as unknown as LyraPromptInput['queue']}
  ></lr-prompt-input>`);

  const picker = el.shadowRoot!.querySelector('lr-source-picker') as HTMLElement & {
    sources: readonly { id: string; label: string }[];
    selectedSourceIds: readonly string[];
  };
  const queue = el.shadowRoot!.querySelector('lr-prompt-queue') as HTMLElement & {
    items: readonly { id: string; value: string }[];
  };
  expect(picker.sources.map((source) => source.label)).to.deep.equal(['First source']);
  expect(picker.selectedSourceIds).to.deep.equal(['source-a']);
  expect(queue.items.map((item) => item.value)).to.deep.equal(['First queued prompt']);

  el.sources = [null, { id: ' ', label: 'Blank' }] as unknown as typeof el.sources;
  el.queue = [false, { id: '', value: 'Blank' }] as unknown as typeof el.queue;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('lr-source-picker') === null).to.be.true;
  expect(el.shadowRoot!.querySelector('lr-prompt-queue') === null).to.be.true;
});
