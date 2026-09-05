import { sendKeys } from '@web/test-runner-commands';
import {
  fixture,
  expect,
  html,
  oneEvent,
  waitUntil,
} from "@open-wc/testing";
import { hoverUntilMatched, resetMouse, sendMouse, settlePointer } from "../../../../test/wtr-mouse.js";
import "./command-palette.js";
import type { LyraCommandPalette } from "./command-palette.js";
import { styles } from "./command-palette.styles.js";

it("provides hover feedback for enabled command rows", () => {
  // Pseudo-class presence is the behavior under test; synthetic pointer events do not
  // activate browser :hover state under Web Test Runner.
  const css = styles.cssText.replace(/\s+/g, " ").replaceAll('"', "'");
  expect(css).to.match(
    /:where\(\[part='command'\]\):hover:where\(:not\(:disabled\)\)/
  );
});

it('rejects accessor-backed commands without invoking them while retaining source identity for selection', async () => {
  let labelReads = 0;
  const accessorBacked: Record<string, unknown> = {
    commandId: 'accessor-backed',
    onSelect: () => undefined,
  };
  Object.defineProperty(accessorBacked, 'label', {
    enumerable: true,
    get(): never {
      labelReads += 1;
      throw new Error('do not invoke command accessors');
    },
  });
  const command = { commandId: 'safe', label: 'Safe command', onSelect: () => undefined };
  const el = (await fixture(html`<lr-command-palette></lr-command-palette>`)) as LyraCommandPalette;
  el.commands = [
    accessorBacked as unknown as import('./command-palette.js').LyraCommand,
    command,
  ];
  el.openPalette();
  await el.updateComplete;

  expect(labelReads).to.equal(0);
  const selected = oneEvent(el, 'lr-select');
  (el.shadowRoot!.querySelector('[part="command"]') as HTMLButtonElement).click();
  expect((await selected as CustomEvent).detail.command).to.equal(command);
});

it('inherits a 20px command action font and renders its 1em glyph at that size', async () => {
  const el = (await fixture(html`
    <lr-command-palette
      style="font-size:20px"
      .commands=${[{
        commandId: 'font-proof',
        label: 'Font proof',
        icon: html`<span style="display:inline-block;inline-size:1em;block-size:1em"></span>`,
      }]}
    ></lr-command-palette>
  `)) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;

  const action = el.shadowRoot!.querySelector('[part="command"]') as HTMLButtonElement;
  const glyph = el.shadowRoot!.querySelector('[part="icon"] span') as HTMLElement;
  expect(getComputedStyle(action).fontSize).to.equal('20px');
  expect(parseFloat(getComputedStyle(glyph).inlineSize)).to.equal(20);
  expect(parseFloat(getComputedStyle(glyph).blockSize)).to.equal(20);
});

it("keeps an explicitly empty aria-label distinct from an omitted one", async () => {
  const omitted = (await fixture(
    html`<lr-command-palette></lr-command-palette>`
  )) as LyraCommandPalette;
  expect(omitted.accessibleLabel).to.equal(undefined);
  omitted.openPalette();
  await omitted.updateComplete;
  expect(
    omitted.shadowRoot!.querySelector('[part="dialog"]')!.getAttribute("aria-label")
  ).to.equal("Command palette");

  const explicitEmpty = (await fixture(
    html`<lr-command-palette aria-label=""></lr-command-palette>`
  )) as LyraCommandPalette;
  expect(explicitEmpty.accessibleLabel).to.equal("");
  explicitEmpty.openPalette();
  await explicitEmpty.updateComplete;
  expect(
    explicitEmpty.shadowRoot!.querySelector('[part="dialog"]')!.getAttribute("aria-label")
  ).to.equal("");
});

it("opens, filters, and selects a command", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[
        { commandId: "save", label: "Save", group: "File" },
        { commandId: "close", label: "Close" },
      ]}
    ></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.value = "save";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await el.updateComplete;
  const selected = oneEvent(el, "lr-select");
  el.shadowRoot!.querySelector('[part="command"]')!.dispatchEvent(
    new MouseEvent("click", { bubbles: true })
  );
  expect((await selected).detail.command.commandId).to.equal("save");
  expect(el.open).to.be.false;
});

it("registers and unregisters commands through the public API", async () => {
  let selections = 0;
  const el = (await fixture(
    html`<lr-command-palette></lr-command-palette>`
  )) as LyraCommandPalette;
  const command = {
    commandId: "registered",
    label: "Registered command",
    onSelect: () => selections++,
  };
  const unregister = el.registerCommand(command);
  el.openPalette();
  await el.updateComplete;
  const selected = oneEvent(el, "lr-select");
  (
    el.shadowRoot!.querySelector('[part="command"]') as HTMLButtonElement
  ).click();
  expect((await selected).detail.command).to.equal(command);
  expect(selections).to.equal(1);

  unregister();
  await el.updateComplete;
  expect(el.commands).to.deep.equal([]);
});

it("selects the active command with Enter and ignores Enter when no enabled command exists", async () => {
  const el = (await fixture(html`<lr-command-palette
    .commands=${[
      { commandId: "disabled", label: "Disabled", disabled: true },
      { commandId: "open", label: "Open" },
    ]}
  ></lr-command-palette>`)) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input")!;
  const selected = oneEvent(el, "lr-select");
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    })
  );
  expect((await selected).detail.command.commandId).to.equal("open");

  el.commands = [{ commandId: "disabled", label: "Disabled", disabled: true }];
  el.openPalette();
  await el.updateComplete;
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    })
  );
  expect(el.open).to.be.true;
});

it("does not navigate or activate while an IME composition key is committing", async () => {
  const el = (await fixture(html`<lr-command-palette
    .commands=${[
      { commandId: "first", label: "First" },
      { commandId: "second", label: "Second" },
    ]}
  ></lr-command-palette>`)) as LyraCommandPalette;
  let selections = 0;
  el.addEventListener("lr-select", () => selections += 1);
  el.openPalette();
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input")!;
  for (const key of ["ArrowDown", "Enter"]) {
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    Object.defineProperty(event, "isComposing", { value: true });
    input.dispatchEvent(event);
    expect(event.defaultPrevented, `${key} remains owned by the IME`).to.be.false;
  }
  const legacy = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
  Object.defineProperty(legacy, "keyCode", { value: 229 });
  input.dispatchEvent(legacy);
  await el.updateComplete;
  expect(selections).to.equal(0);
  expect(el.open).to.be.true;
  expect(input.getAttribute("aria-activedescendant")).to.equal(
    el.shadowRoot!.querySelector('[part="command"]')!.id
  );
});

it("contains the native search input event at the component boundary", async () => {
  const el = (await fixture(html`<lr-command-palette
    .commands=${[{ commandId: "save", label: "Save" }]}
  ></lr-command-palette>`)) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  let leaked = 0;
  el.addEventListener("input", () => leaked += 1);
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.value = "save";
  input.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(leaked).to.equal(0);
  expect(el.shadowRoot!.querySelectorAll('[part="command"]')).to.have.length(1);
});

it("is accessible while open", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[{ commandId: "save", label: "Save" }]}
    ></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it("wires aria-activedescendant to a stable id on the active command row", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[
        { commandId: "save", label: "Save" },
        { commandId: "close", label: "Close" },
      ]}
    ></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input")!;
  const rows = el.shadowRoot!.querySelectorAll('[part="command"]');
  expect(rows[0]!.id).to.not.equal("");
  expect(input.getAttribute("aria-activedescendant")).to.equal(rows[0]!.id);
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(input.getAttribute("aria-activedescendant")).to.equal(rows[1]!.id);
});

it("keeps aria-activedescendant-owned command options out of the sequential tab order", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[
        { commandId: "save", label: "Save" },
        { commandId: "close", label: "Close" },
      ]}
    ></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;

  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  const rows = [
    ...el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="command"]'),
  ];
  input.focus();

  expect(rows.map((row) => row.tabIndex)).to.deep.equal([-1, -1]);
  expect((el.shadowRoot!.activeElement as HTMLElement | null)?.localName).to.equal(
    "input"
  );
  expect(input.getAttribute("aria-activedescendant")).to.equal(rows[0]!.id);
});

it("skips disabled commands during arrow navigation and marks them aria-disabled", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[
        { commandId: "a", label: "Alpha" },
        { commandId: "b", label: "Bravo", disabled: true },
        { commandId: "c", label: "Charlie" },
      ]}
    ></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input")!;
  const rows = el.shadowRoot!.querySelectorAll('[part="command"]');
  expect(rows[0]!.getAttribute("aria-disabled")).to.equal("false");
  expect(rows[1]!.getAttribute("aria-disabled")).to.equal("true");
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(input.getAttribute("aria-activedescendant")).to.equal(rows[2]!.id);
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(input.getAttribute("aria-activedescendant")).to.equal(rows[0]!.id);
});

it("never rests the active option on a disabled command when one leads the list", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[
        { commandId: "a", label: "Alpha", disabled: true },
        { commandId: "b", label: "Bravo" },
      ]}
    ></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input")!;
  const rows = el.shadowRoot!.querySelectorAll('[part="command"]');
  expect(input.getAttribute("aria-activedescendant")).to.equal(rows[1]!.id);
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(input.getAttribute("aria-activedescendant")).to.equal(rows[1]!.id);
});

it("scrolls the newly active row into view when navigating with arrow keys", async () => {
  const commands = Array.from({ length: 5 }, (_unused, i) => ({
    commandId: `c${i}`,
    label: `Command ${i}`,
  }));
  const el = (await fixture(
    html`<lr-command-palette .commands=${commands}></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input")!;
  const secondRow = el.shadowRoot!.querySelectorAll(
    '[part="command"]'
  )[1] as HTMLElement;
  let called = false;
  secondRow.scrollIntoView = () => {
    called = true;
  };
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(called).to.be.true;
});

it("preserves the active command by commandId across replacement/reorder and repairs it after removal", async () => {
  const alpha = { commandId: "a", label: "Alpha" };
  const bravo = { commandId: "b", label: "Bravo" };
  const charlie = { commandId: "c", label: "Charlie" };
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[alpha, bravo, charlie]}
    ></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input")!;
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="command"][data-active="true"]')!
      .textContent
  ).to.contain("Bravo");

  el.commands = [
    { commandId: "c", label: "Charlie replacement" },
    { commandId: "a", label: "Alpha replacement" },
    { commandId: "b", label: "Bravo replacement" },
  ];
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="command"][data-active="true"]')!
      .textContent
  ).to.contain("Bravo");
  expect((el.shadowRoot!.getElementById(input.getAttribute("aria-activedescendant")!)) != null, "the reconciled active descendant remains rendered").to.equal(true);

  el.commands = [charlie, alpha];
  await el.updateComplete;
  expect((el.shadowRoot!.getElementById(input.getAttribute("aria-activedescendant")!)) != null).to.equal(true);
});

it("requires unique nonempty commandId values and deterministically keeps the first command", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[
        { commandId: "", label: "Empty" },
        { commandId: "same", label: "First" },
        { commandId: "same", label: "Duplicate" },
        { commandId: "other", label: "Other" },
      ]}
    ></lr-command-palette>`
  )) as LyraCommandPalette;

  el.openPalette();
  await el.updateComplete;
  const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part=command]')];
  expect(rows.map((row) => row.textContent?.trim())).to.deep.equal(["First", "Other"]);

  const selected = oneEvent(el, "lr-select");
  rows[0]!.click();
  expect((await selected).detail.command.commandId).to.equal("same");
});

it('drops commands with empty or whitespace-only labels while retaining an accessible valid row', async () => {
  const el = (await fixture(html`
    <lr-command-palette
      .commands=${[
        { commandId: 'empty', label: '' },
        { commandId: 'blank', label: '   ' },
        { commandId: 'valid', label: 'Valid command' },
      ]}
    ></lr-command-palette>
  `)) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;

  const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="command"]')];
  expect(rows.length).to.equal(1);
  expect(rows[0]!.textContent?.trim()).to.equal('Valid command');
  await expect(el).to.be.accessible();
});

it('omits a command whose identity accessor throws while retaining valid neighbors', async () => {
  const hostile = { label: 'Hostile' } as { label: string; commandId: string };
  Object.defineProperty(hostile, 'commandId', {
    enumerable: true,
    get: () => {
      throw new Error('hostile command identity');
    },
  });
  const el = (await fixture(
    html`<lr-command-palette></lr-command-palette>`
  )) as LyraCommandPalette;

  el.commands = [
    { commandId: 'before', label: 'Before' },
    hostile,
    { commandId: 'after', label: 'After' },
  ];
  el.openPalette();
  await el.updateComplete;

  const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="command"]')];
  expect(rows.map((row) => row.textContent?.trim())).to.deep.equal(['Before', 'After']);
});

it('ignores malformed keyword collections without dropping valid commands or search', async () => {
  const el = (await fixture(
    html`<lr-command-palette></lr-command-palette>`
  )) as LyraCommandPalette;
  el.commands = [
    { commandId: 'number', label: 'Numeric keywords', keywords: 42 },
    { commandId: 'object', label: 'Object keywords', keywords: {} },
    { commandId: 'valid', label: 'Valid keywords', keywords: ['find-me'] },
  ] as unknown as typeof el.commands;

  el.openPalette();
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = 'find-me';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await el.updateComplete;

  const rows = [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="command"]')];
  expect(rows.map((row) => row.textContent?.trim())).to.deep.equal(['Valid keywords']);
});

it("case-folds command search with the effective locale", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      lang="tr"
      .commands=${[
        { commandId: "istanbul", label: "İstanbul" },
        { commandId: "izmir", label: "İzmir" },
      ]}
    ></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.value = "istanbul";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await el.updateComplete;
  const rows = el.shadowRoot!.querySelectorAll('[part="command"]');
  expect(rows).to.have.length(1);
  expect(rows[0]!.textContent).to.contain("İstanbul");
});

it("owns grouped options through labeled ARIA groups", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[
        { commandId: "save", label: "Save", group: "File" },
        { commandId: "close", label: "Close", group: "File" },
        { commandId: "copy", label: "Copy", group: "Edit" },
      ]}
    ></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const groups = [
    ...el.shadowRoot!.querySelectorAll('[part="command-group"][role="group"]'),
  ];
  expect(groups).to.have.length(2);
  for (const group of groups) {
    const heading = el.shadowRoot!.getElementById(
      group.getAttribute("aria-labelledby")!
    );
    expect(heading?.getAttribute("part")).to.equal("group");
    expect(group.querySelectorAll('[role="option"]').length).to.be.greaterThan(
      0
    );
  }
  await expect(el).to.be.accessible();
});

it("virtualizes a 5,000-command catalog while keeping the active descendant mounted", async () => {
  const commands = Array.from({ length: 5000 }, (_, index) => ({
    commandId: `command-${index}`,
    label: `Command ${index}`,
    group: `Group ${Math.floor(index / 100)}`,
  }));
  const el = (await fixture(
    html`<lr-command-palette .commands=${commands}></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const rendered = el.shadowRoot!.querySelectorAll('[part="command"]');
  const input = el.shadowRoot!.querySelector("input")!;
  expect(rendered.length).to.be.lessThan(100);
  expect((el.shadowRoot!.getElementById(input.getAttribute("aria-activedescendant")!)) != null).to.equal(true);
});

it("renders a visible focus indicator on the auto-focused search input", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[{ commandId: "save", label: "Save" }]}
    ></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.focus();
  expect(getComputedStyle(input).outlineStyle).to.not.equal("none");
  expect(parseFloat(getComputedStyle(input).outlineWidth)).to.be.greaterThan(0);
});

it("contains long labels and shortcuts inside a 320px dialog", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      style="--lr-command-palette-max-inline-size: 320px"
      .commands=${[
        {
          commandId: "long",
          label: "AnExtremelyLongUnbrokenLocalizedCommandLabelThatMustShrink",
          description:
            "AnEquallyLongUnbrokenDescriptionThatMustRemainContained",
          shortcut: "Control+Option+Shift+AnExtremelyLongUnbrokenShortcut",
        },
      ]}
    ></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const list = el.shadowRoot!.querySelector('[part="list"]') as HTMLElement;
  expect(list.scrollWidth).to.be.at.most(list.clientWidth + 1);
});

it("traps focus by inerting sibling content while open, releasing it on close", async () => {
  const wrapper = await fixture(html`<div>
    <button id="outside">Outside</button>
    <lr-command-palette
      .commands=${[{ commandId: "save", label: "Save" }]}
    ></lr-command-palette>
  </div>`);
  const el = wrapper.querySelector("lr-command-palette") as LyraCommandPalette;
  const outside = wrapper.querySelector("#outside") as HTMLButtonElement & {
    inert: boolean;
  };
  el.openPalette();
  await el.updateComplete;
  expect(outside.inert).to.be.true;
  el.close();
  await el.updateComplete;
  expect(outside.inert).to.be.false;
});

it("closes on a document-level Escape via the shared overlay manager", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[{ commandId: "save", label: "Save" }]}
    ></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  expect(el.open).to.be.true;
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('closes when the backdrop itself is activated', async () => {
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[{ commandId: 'save', label: 'Save' }]}
    ></lr-command-palette>`,
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const closed = oneEvent(el, 'lr-close');

  (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();

  await closed;
  await el.updateComplete;
  expect(el.open).to.equal(false);
});

it('remains usable when ResizeObserver is unavailable', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'ResizeObserver');
  try {
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      value: undefined,
    });
    const el = (await fixture(html`
      <lr-command-palette
        .commands=${[{ commandId: 'save', label: 'Save' }]}
      ></lr-command-palette>
    `)) as LyraCommandPalette;

    el.openPalette();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="command"]')).to.have.lengthOf(1);
  } finally {
    if (descriptor) Object.defineProperty(window, 'ResizeObserver', descriptor);
    else Reflect.deleteProperty(window, 'ResizeObserver');
  }
});

it("locks document scroll while open and releases it on close", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[{ commandId: "save", label: "Save" }]}
    ></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.equal("hidden");
  el.close();
  await el.updateComplete;
  expect(document.documentElement.style.overflow).to.not.equal("hidden");
});

it("restores overlay ownership when an open palette reconnects", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[{ commandId: "save", label: "Save" }]}
    ></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const list = el.shadowRoot!.querySelector('[part="list"]') as HTMLElement;
  list.dispatchEvent(new Event("scroll"));
  const parent = el.parentElement!;
  el.remove();
  expect(document.documentElement.style.overflow).to.not.equal("hidden");

  parent.appendChild(el);
  await el.updateComplete;
  await Promise.resolve();
  expect(el.open).to.be.true;
  expect(document.documentElement.style.overflow).to.equal("hidden");
  el.close();
  await el.updateComplete;
});

it("supports an explicit ctrl hotkey without requiring the platform mod key", async () => {
  const el = (await fixture(
    html`<lr-command-palette hotkey="ctrl+p"></lr-command-palette>`
  )) as LyraCommandPalette;
  window.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "p",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(el.open).to.be.true;
});

it("binds its global shortcut to the adopted owner window", async () => {
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const frameWindow = frame.contentWindow!;
  const frameDocument = frame.contentDocument!;
  const NativeResizeObserver = frameWindow.ResizeObserver;
  const resizeDescriptor = Object.getOwnPropertyDescriptor(frameWindow, "ResizeObserver");
  const styleDescriptor = Object.getOwnPropertyDescriptor(frameWindow, "getComputedStyle");
  let constructions = 0;
  let hostStyleReads = 0;
  const observed: Element[] = [];
  class TrackingResizeObserver extends NativeResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      super(callback);
      constructions += 1;
    }
    override observe(target: Element, options?: ResizeObserverOptions): void {
      observed.push(target);
      super.observe(target, options);
    }
  }
  Object.defineProperty(frameWindow, "ResizeObserver", {
    configurable: true,
    value: TrackingResizeObserver,
  });
  const nativeGetComputedStyle = frameWindow.getComputedStyle.bind(frameWindow);
  const el = document.createElement("lr-command-palette") as LyraCommandPalette;
  el.hotkey = "ctrl+p";
  Object.defineProperty(frameWindow, "getComputedStyle", {
    configurable: true,
    value: (element: Element, pseudo?: string | null) => {
      if (element === el) hostStyleReads += 1;
      return nativeGetComputedStyle(element, pseudo);
    },
  });

  try {
    document.body.append(el);
    await el.updateComplete;
    el.openPalette();
    await el.updateComplete;
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    await Promise.resolve();
    const list = el.shadowRoot!.querySelector('[part="list"]')!;
    expect(constructions).to.be.greaterThan(0);
    expect(observed.includes(list)).to.be.true;
    expect(hostStyleReads).to.be.greaterThan(0);
    const hotkey = new frameWindow.KeyboardEvent("keydown", {
      key: "p",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    frameWindow.dispatchEvent(hotkey);
    await el.updateComplete;
    expect(el.open).to.be.true;
    expect(hotkey.defaultPrevented).to.be.true;
  } finally {
    el.remove();
    if (resizeDescriptor) Object.defineProperty(frameWindow, "ResizeObserver", resizeDescriptor);
    if (styleDescriptor) Object.defineProperty(frameWindow, "getComputedStyle", styleDescriptor);
    frame.remove();
  }
});

it("does not match the default mod+k shortcut when an extra Shift modifier is held", async () => {
  const el = (await fixture(
    html`<lr-command-palette></lr-command-palette>`
  )) as LyraCommandPalette;
  const modInit: KeyboardEventInit = {
    key: "k",
    shiftKey: true,
    bubbles: true,
    cancelable: true,
  };
  if (navigator.platform.includes("Mac")) modInit.metaKey = true;
  else modInit.ctrlKey = true;
  window.dispatchEvent(new KeyboardEvent("keydown", modInit));
  await el.updateComplete;
  expect(el.open).to.be.false;
  const plainInit: KeyboardEventInit = {
    key: "k",
    bubbles: true,
    cancelable: true,
  };
  if (navigator.platform.includes("Mac")) plainInit.metaKey = true;
  else plainInit.ctrlKey = true;
  window.dispatchEvent(new KeyboardEvent("keydown", plainInit));
  await el.updateComplete;
  expect(el.open).to.be.true;
});

it('resolves mod+k from Client Hints when navigator.platform is reduced', async () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    'platform'
  );
  const userAgentDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    'userAgent'
  );
  const userAgentDataDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    'userAgentData'
  );
  Object.defineProperty(navigator, 'userAgentData', {
    configurable: true,
    value: { platform: 'macOS' },
  });
  Object.defineProperty(navigator, 'platform', {
    configurable: true,
    value: '',
  });
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: 'Reduced User Agent',
  });

  let el: LyraCommandPalette | undefined;
  try {
    el = (await fixture(
      html`<lr-command-palette></lr-command-palette>`
    )) as LyraCommandPalette;
    await el.updateComplete;
    const chord = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(chord);
    await el.updateComplete;

    expect(chord.defaultPrevented).to.be.true;
    expect(el.open).to.be.true;
  } finally {
    el?.remove();
    if (platformDescriptor)
      Object.defineProperty(navigator, 'platform', platformDescriptor);
    else Reflect.deleteProperty(navigator, 'platform');
    if (userAgentDescriptor)
      Object.defineProperty(navigator, 'userAgent', userAgentDescriptor);
    else Reflect.deleteProperty(navigator, 'userAgent');
    if (userAgentDataDescriptor)
      Object.defineProperty(navigator, 'userAgentData', userAgentDataDescriptor);
    else Reflect.deleteProperty(navigator, 'userAgentData');
  }
});

it('falls back to the user agent for mod+k when newer platform hints are empty', async () => {
  const platformDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    'platform'
  );
  const userAgentDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    'userAgent'
  );
  const userAgentDataDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    'userAgentData'
  );
  Object.defineProperty(navigator, 'userAgentData', {
    configurable: true,
    value: { platform: '' },
  });
  Object.defineProperty(navigator, 'platform', {
    configurable: true,
    value: '',
  });
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  });

  let el: LyraCommandPalette | undefined;
  try {
    el = (await fixture(
      html`<lr-command-palette></lr-command-palette>`
    )) as LyraCommandPalette;
    await el.updateComplete;
    const chord = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(chord);
    await el.updateComplete;

    expect(chord.defaultPrevented).to.be.true;
    expect(el.open).to.be.true;
  } finally {
    el?.remove();
    if (platformDescriptor)
      Object.defineProperty(navigator, 'platform', platformDescriptor);
    else Reflect.deleteProperty(navigator, 'platform');
    if (userAgentDescriptor)
      Object.defineProperty(navigator, 'userAgent', userAgentDescriptor);
    else Reflect.deleteProperty(navigator, 'userAgent');
    if (userAgentDataDescriptor)
      Object.defineProperty(navigator, 'userAgentData', userAgentDataDescriptor);
    else Reflect.deleteProperty(navigator, 'userAgentData');
  }
});

it("ignores repeated hotkeys and gives one last-connected palette ownership", async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <lr-command-palette></lr-command-palette>
      <lr-command-palette></lr-command-palette>
    </div>
  `);
  const [first, second] = [...wrapper.querySelectorAll("lr-command-palette")] as LyraCommandPalette[];
  const chord: KeyboardEventInit = { key: "k", bubbles: true, cancelable: true };
  if (navigator.platform.includes("Mac")) chord.metaKey = true;
  else chord.ctrlKey = true;

  window.dispatchEvent(new KeyboardEvent("keydown", { ...chord, repeat: true }));
  await Promise.all([first!.updateComplete, second!.updateComplete]);
  expect(first!.open).to.be.false;
  expect(second!.open).to.be.false;

  window.dispatchEvent(new KeyboardEvent("keydown", chord));
  await Promise.all([first!.updateComplete, second!.updateComplete]);
  expect(first!.open).to.be.false;
  expect(second!.open).to.be.true;

  second!.close();
  await second!.updateComplete;
  second!.remove();
  window.dispatchEvent(new KeyboardEvent("keydown", chord));
  await first!.updateComplete;
  expect(first!.open).to.be.true;
});

it("defines distinct active-plus-pressed and forced-color current-row paint", () => {
  const css = styles.cssText.replace(/\s+/g, " ").replaceAll('"', "'");
  // The pressed arm must carry the [data-active='true'] compound at FULL specificity -- see the
  // rendered-probe tests near the end of this file, which are what actually prove it applies.
  expect(css).to.match(
    /\[part='command'\]\[data-active='true'\]:active:where\(:not\(:disabled\)\)/
  );
  expect(css).to.match(
    /@media \(forced-colors: active\).*\[part='command'\]\[data-active='true'\].*outline:/
  );
});

describe("active-command cssprop", () => {
  /** Resolves what a `declaration` would compute to *inside this component's shadow root*, where the
   *  `--lr-*` design tokens actually live. Used to assert the unset default byte-for-byte against
   *  the token it falls back to. */
  function resolvedInShadow(
    el: LyraCommandPalette,
    declaration: string,
    property: string
  ): string {
    const probe = document.createElement("span");
    probe.setAttribute("style", declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  async function themed(style: string): Promise<LyraCommandPalette> {
    const wrapper = (await fixture(html`
      <div style=${style}>
        <lr-command-palette
          .commands=${[
            { commandId: "save", label: "Save" },
            { commandId: "close", label: "Close" },
          ]}
        ></lr-command-palette>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector(
      "lr-command-palette"
    ) as LyraCommandPalette;
    el.openPalette();
    await el.updateComplete;
    return el;
  }

  it("recolors the active command from an ancestor, not a :host-declared prop", async () => {
    const el = await themed("--lr-command-palette-active-bg: rgb(0, 51, 102);");
    const active = el.shadowRoot!.querySelector(
      '[part="command"][data-active="true"]'
    ) as HTMLElement;
    expect((active) != null).to.equal(true);
    expect(getComputedStyle(active).backgroundColor).to.equal(
      "rgb(0, 51, 102)"
    );
    // A non-active command keeps its transparent resting background -- the prop is scoped to
    // [data-active='true'] only.
    const inactive = el.shadowRoot!.querySelector(
      '[part="command"][data-active="false"]'
    ) as HTMLElement;
    expect(getComputedStyle(inactive).backgroundColor).to.equal(
      "rgba(0, 0, 0, 0)"
    );
  });

  it("renders byte-identically to the pre-cssprop output when the prop is unset", async () => {
    const el = await themed("");
    const active = el.shadowRoot!.querySelector(
      '[part="command"][data-active="true"]'
    ) as HTMLElement;
    expect(getComputedStyle(active).backgroundColor).to.equal(
      resolvedInShadow(
        el,
        "background: var(--lr-color-brand-quiet)",
        "background-color"
      )
    );
  });

  it("is accessible with the active-command prop themed", async () => {
    const el = await themed("--lr-command-palette-active-bg: rgb(0, 51, 102);");
    await expect(el).to.be.accessible();
  });
});

it("colors the search-input's placeholder and undoes Firefox's reduced default opacity", () => {
  const css = styles.cssText.replace(/\s+/g, " ").replaceAll('"', "'");
  expect(css).to.match(
    /\[part='input'\]::placeholder\s*\{[^}]*color:\s*var\(--lr-color-text-quiet\)[^}]*opacity:\s*1/
  );
});

it("renders the search-input's ::placeholder in the shared quiet-text token's color, opacity undone (getComputedStyle, not just source text)", async () => {
  // The test above only proves the token string appears in the stylesheet source -- it can't
  // catch a rule that stops matching the real DOM (wrong selector, broken specificity, a shadow-
  // DOM part boundary issue). This reads the actual rendered pseudo-element instead.
  const el = (await fixture(
    html`<lr-command-palette
      style="--lr-color-text-quiet: rgb(12, 34, 56)"
    ></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  expect(getComputedStyle(input, "::placeholder").color).to.equal(
    "rgb(12, 34, 56)"
  );
  expect(getComputedStyle(input, "::placeholder").opacity).to.equal("1");
});

it("resets supported native search decorations without adding a Firefox-only control", async () => {
  const el = (await fixture(
    html`<lr-command-palette .commands=${[{ commandId: "search", label: "Search" }]}></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const search = el.shadowRoot!.querySelector('[part="search"]') as HTMLElement;
  const input = el.shadowRoot!.querySelector('[part="input"]') as HTMLInputElement;
  if (!CSS.supports('selector(input::-webkit-search-cancel-button)')) {
    // Firefox exposes no WebKit search pseudo-controls; the component keeps one native search
    // input rather than appending a browser-specific clear button of its own.
    expect(search.querySelectorAll("button").length).to.equal(0);
    return;
  }

  // Chromium/WebKit do not consistently surface pseudo-element `appearance` through
  // getComputedStyle(). Instead, prove the real native affordance is actionable when deliberately
  // restored, then prove the component's rendered styling removes that exact hit target.
  const nativeDecoration = document.createElement('style');
  nativeDecoration.textContent = `
    [part='input']::-webkit-search-cancel-button {
      appearance: auto !important;
      -webkit-appearance: searchfield-cancel-button !important;
      display: block !important;
      opacity: 1 !important;
      pointer-events: auto !important;
    }
  `;
  el.shadowRoot!.append(nativeDecoration);
  input.focus();
  const rect = input.getBoundingClientRect();
  try {
    let cancelPosition: [number, number] | undefined;
    for (let offset = 2; offset <= 48; offset += 2) {
      input.value = 'clear me';
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
      const candidate: [number, number] = [
        Math.round(rect.right - offset),
        Math.round(rect.top + rect.height / 2),
      ];
      await sendMouse({ type: 'click', position: candidate });
      if (input.value === '') {
        cancelPosition = candidate;
        break;
      }
    }
    expect(
      cancelPosition !== undefined,
      'positive control exposes the native clear action'
    ).to.equal(true);

    input.value = 'keep me';
    input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
    nativeDecoration.remove();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve())
    );
    await sendMouse({ type: 'click', position: cancelPosition! });
    expect(
      input.value,
      'component styling removes the native clear action'
    ).to.equal('keep me');
  } finally {
    nativeDecoration.remove();
    await resetMouse();
  }
});

it("shrinks a long, unbreakable command description instead of overflowing the dialog", async () => {
  // Deliberately has no space/hyphen/slash break opportunities anywhere -- with the UA default
  // `min-width: auto` a flex:1 child still refuses to shrink below its own (here: full-string)
  // min-content width, forcing this row -- and the whole list -- wider than the dialog.
  const longDescription = "x".repeat(120);
  const el = (await fixture(html`<lr-command-palette
    style="--lr-command-palette-max-inline-size: 320px;"
    .commands=${[
      { commandId: "open", label: "Open File", description: longDescription },
    ]}
  ></lr-command-palette>`)) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const list = el.shadowRoot!.querySelector('[part="list"]') as HTMLElement;
  expect(list.scrollWidth).to.be.at.most(list.clientWidth + 1);
});

it("renders a leading icon on a command that has one, and omits the part for commands that do not", async () => {
  const icon = html`<svg class="save-icon"></svg>`;
  const el = (await fixture(html`<lr-command-palette
    .commands=${[
      { commandId: "save", label: "Save", icon },
      { commandId: "close", label: "Close" },
    ]}
  ></lr-command-palette>`)) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const rows = el.shadowRoot!.querySelectorAll('[part="command"]');
  expect(rows[0]!.querySelector('[part="icon"] svg.save-icon')).to.not.equal(
    null
  );
  expect((rows[1]!.querySelector('[part="icon"]')) === (null)).to.equal(true);
});

it("renders localized strings from a .strings override for the dialog label, placeholder, results label, and empty message", async () => {
  const el = (await fixture(html`<lr-command-palette
    .commands=${[{ commandId: "save", label: "Save" }]}
    .strings=${{
      commandPaletteLabel: "Palette de commandes",
      commandPalettePlaceholder: "Rechercher des commandes…",
      commandPaletteResults: "Commandes",
      commandPaletteEmpty: "Aucune commande correspondante.",
    }}
  ></lr-command-palette>`)) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const dialog = el.shadowRoot!.querySelector('[part="dialog"]') as HTMLElement;
  expect(dialog.getAttribute("aria-label")).to.equal("Palette de commandes");
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  expect(input.placeholder).to.equal("Rechercher des commandes…");
  const list = el.shadowRoot!.querySelector('[part="list"]') as HTMLElement;
  expect(list.getAttribute("aria-label")).to.equal("Commandes");
  input.value = "no such command";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await el.updateComplete;
  const empty = el.shadowRoot!.querySelector('[part="empty"]') as HTMLElement;
  expect(empty.textContent?.trim()).to.equal("Aucune commande correspondante.");
});

it("derives the virtual row pitch from the row-height tokens, not a hardcoded pixel value", async () => {
  const el = (await fixture(
    html`<lr-command-palette style="--lr-command-palette-row-height: 60px; --lr-command-palette-group-height: 40px"></lr-command-palette>`,
  )) as LyraCommandPalette;
  el.commands = Array.from({ length: 20 }, (_, i) => ({ commandId: `c${i}`, label: `Command ${i}` }));
  el.openPalette();
  await el.updateComplete;
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await el.updateComplete;

  // Rows are absolutely positioned at this pitch while being painted at the token height. A
  // hardcoded 48 would overlap every row by 12px once the token resolves to anything else --
  // which is exactly what a raised browser font size does to the 3rem default.
  expect((el as unknown as { rowPitch: number }).rowPitch).to.equal(60);
  expect((el as unknown as { groupPitch: number }).groupPitch).to.equal(40);
});

function virtualGeometry(el: LyraCommandPalette): {
  rows: string[];
  groups: string[];
  spacer: string;
} {
  return {
    rows: [
      ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="command"]'),
    ].map((row) => row.style.transform),
    groups: [
      ...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="group"]'),
    ].map((group) => group.style.transform),
    spacer: el.shadowRoot!.querySelector<HTMLElement>(
      '[part="list-spacer"]'
    )!.style.blockSize,
  };
}

async function settleRowPitch(el: LyraCommandPalette): Promise<void> {
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  await el.updateComplete;
}

it("rebuilds virtual transforms and spacer extent from the measured pitches", async () => {
  const el = (await fixture(html`
    <lr-command-palette
      style="--lr-command-palette-row-height: 60px; --lr-command-palette-group-height: 40px"
      .commands=${[
        { commandId: "save", label: "Save", group: "File" },
        { commandId: "close", label: "Close", group: "File" },
        { commandId: "copy", label: "Copy", group: "Edit" },
      ]}
    ></lr-command-palette>
  `)) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  await settleRowPitch(el);

  expect(virtualGeometry(el)).to.deep.equal({
    rows: ["translateY(40px)", "translateY(100px)", "translateY(200px)"],
    groups: ["translateY(0px)", "translateY(160px)"],
    spacer: "260px",
  });
});

it("rebuilds virtual geometry after live row and group token changes", async () => {
  const el = (await fixture(html`
    <lr-command-palette
      style="--lr-command-palette-row-height: 60px; --lr-command-palette-group-height: 40px"
      .commands=${[
        { commandId: "save", label: "Save", group: "File" },
        { commandId: "close", label: "Close", group: "File" },
        { commandId: "copy", label: "Copy", group: "Edit" },
      ]}
    ></lr-command-palette>
  `)) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  await settleRowPitch(el);

  el.style.setProperty("--lr-command-palette-row-height", "72px");
  el.style.setProperty("--lr-command-palette-group-height", "36px");
  await settleRowPitch(el);

  expect(virtualGeometry(el)).to.deep.equal({
    rows: ["translateY(36px)", "translateY(108px)", "translateY(216px)"],
    groups: ["translateY(0px)", "translateY(180px)"],
    spacer: "288px",
  });
});

it("does not schedule a Lit update from the initial row-pitch measurement", async () => {
  // `measureRowPitch()` writes reactive state. Called synchronously from the observer-attach path
  // -- which runs inside Lit's `updated()` -- that write logs "scheduled an update after an update
  // completed" for every consumer with Lit's dev build. Same precedent as `<lr-virtual-list>`'s
  // initial container measurement: queue the read out of the lifecycle callback.
  const globalWarnings = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
  globalWarnings?.forEach((warning) => {
    if (warning.includes("scheduled an update")) globalWarnings.delete(warning);
  });
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    // The tokens must resolve to something *other* than the 48/32 fallbacks, or `measureRowPitch()`
    // changes no state and schedules no update either way -- the test would pass vacuously.
    const el = (await fixture(
      html`<lr-command-palette
        style="--lr-command-palette-row-height: 60px; --lr-command-palette-group-height: 40px"
      ></lr-command-palette>`
    )) as LyraCommandPalette;
    el.commands = Array.from({ length: 20 }, (_, i) => ({ commandId: `c${i}`, label: `Command ${i}` }));
    el.openPalette();
    await el.updateComplete;
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    await el.updateComplete;
  } finally {
    console.warn = originalWarn;
  }
  const scheduled = calls.filter((args) =>
    args.some((a) => typeof a === "string" && a.includes("scheduled an update"))
  );
  expect(scheduled, JSON.stringify(scheduled)).to.have.length(0);
});

it("emits a cancelable lr-open before mutating open, and skips the mutation when it is vetoed", async () => {
  const el = (await fixture(html`<lr-command-palette></lr-command-palette>`)) as LyraCommandPalette;
  const seen: boolean[] = [];
  el.addEventListener("lr-open", (event) => {
    seen.push(el.open);
    event.preventDefault();
  });
  el.openPalette();
  expect(seen, "open must still be false while lr-open is being dispatched").to.deep.equal([false]);
  expect(el.open, "a defaultPrevented lr-open must not open the palette").to.be.false;
});

it("emits a cancelable lr-close before mutating open, and skips the mutation when it is vetoed", async () => {
  const el = (await fixture(html`<lr-command-palette></lr-command-palette>`)) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const seen: boolean[] = [];
  el.addEventListener("lr-close", (event) => {
    seen.push(el.open);
    event.preventDefault();
  });
  el.close();
  expect(seen, "open must still be true while lr-close is being dispatched").to.deep.equal([true]);
  expect(el.open, "a defaultPrevented lr-close must not close the palette").to.be.true;
});

it("routes direct IDL and attribute writes through the same synchronous lifecycle", async () => {
  const el = (await fixture(html`<lr-command-palette></lr-command-palette>`)) as LyraCommandPalette;
  const order: string[] = [];
  el.addEventListener("lr-open", () => order.push(`open:${el.open}`));
  el.addEventListener("lr-close", () => order.push(`close:${el.open}`));

  el.open = true;
  expect(order).to.deep.equal(["open:false"]);
  expect(el.open).to.be.true;
  await el.updateComplete;

  el.removeAttribute("open");
  expect(order).to.deep.equal(["open:false", "close:true"]);
  expect(el.open).to.be.false;
});

it("restores a vetoed reflected attribute write and avoids opening side effects", async () => {
  const el = (await fixture(html`
    <lr-command-palette
      .commands=${[
        { commandId: "save", label: "Save" },
        { commandId: "close", label: "Close" },
      ]}
    ></lr-command-palette>
  `)) as LyraCommandPalette;
  el.addEventListener("lr-open", (event) => event.preventDefault(), { once: true });

  el.setAttribute("open", "");
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(el.hasAttribute("open")).to.be.false;
});

it("resets search state for every accepted opening entry path", async () => {
  const el = (await fixture(html`
    <lr-command-palette
      .commands=${[
        { commandId: "save", label: "Save" },
        { commandId: "close", label: "Close" },
      ]}
    ></lr-command-palette>
  `)) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
  input.value = "close";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await el.updateComplete;
  el.close();
  await el.updateComplete;

  el.open = true;
  await el.updateComplete;

  expect((el.shadowRoot!.querySelector("input") as HTMLInputElement).value).to.equal("");
  expect(el.shadowRoot!.querySelectorAll('[part="command"]')).to.have.length(2);
});

it("bridges the search input's native focus/blur out through the shadow boundary as host focus/blur events", async () => {
  // Native focus/blur neither bubble nor cross the shadow boundary, so a host listener on
  // <lr-command-palette> itself never hears them without an explicit bridge -- mirrors
  // <lr-tool-param-form>'s identical native-input focus/blur bridge.
  const el = (await fixture(
    html`<lr-command-palette></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;

  const focusPromise = oneEvent(el, "focus");
  input.dispatchEvent(new Event("focus"));
  const focusEvent = await focusPromise;
  expect(focusEvent.bubbles).to.be.true;
  expect(focusEvent.composed).to.be.true;

  const blurPromise = oneEvent(el, "blur");
  input.dispatchEvent(new Event("blur"));
  const blurEvent = await blurPromise;
  expect(blurEvent.bubbles).to.be.true;
  expect(blurEvent.composed).to.be.true;
});

describe("pressed feedback on the keyboard-highlighted row", () => {
  /** Resolves what a `declaration` computes to *inside this component's shadow root*, where the
   *  `--lr-*` design tokens live. */
  function resolvedInShadow(
    el: LyraCommandPalette,
    declaration: string,
    property: string
  ): string {
    const probe = document.createElement("span");
    probe.setAttribute("style", declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  /** Each native state transition retains the existing input-arrival budget. */
  const POINTER_STATE_TIMEOUT = 15_000;
  // Reserve five seconds for hover admission (four 1.2s attempts), plus five seconds for
  // fixture setup, native commands and cleanup outside the state poll.
  const POINTER_TEST_TIMEOUT = POINTER_STATE_TIMEOUT + 10_000;

  async function openThemed(): Promise<LyraCommandPalette> {
    const wrapper = (await fixture(html`
      <div style="--lr-command-palette-active-bg: rgb(0, 51, 102);">
        <lr-command-palette
          .commands=${[
            { commandId: "save", label: "Save" },
            { commandId: "close", label: "Close" },
          ]}
        ></lr-command-palette>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector(
      "lr-command-palette"
    ) as LyraCommandPalette;
    el.openPalette();
    await el.updateComplete;
    return el;
  }

  it("darkens the highlighted row while it is held under the pointer", async function () {
    this.timeout(POINTER_TEST_TIMEOUT);
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches)
      this.skip();
    const el = await openThemed();
    const row = el.shadowRoot!.querySelector(
      '[part="command"][data-active="true"]'
    ) as HTMLElement;
    expect(row != null, "expected a highlighted command row").to.equal(true);
    expect(getComputedStyle(row).backgroundColor).to.equal("rgb(0, 51, 102)");

    const pressed = resolvedInShadow(
      el,
      "background: color-mix(in oklab, rgb(0, 51, 102), var(--lr-color-mix-partner) var(--lr-color-mix-active))",
      "background-color"
    );
    expect(pressed).to.not.equal("rgb(0, 51, 102)");

    try {
      await resetMouse();
      await hoverUntilMatched(row, "the pointer must reach the highlighted row");
      expect(row.isConnected, "the highlighted row must remain mounted").to.equal(true);
      // mouseenter keeps the hovered row the highlighted one, so this is still the
      // data-active row -- exactly the combination the press rule has to out-rank.
      expect(row.getAttribute("data-active")).to.equal("true");
      await sendMouse({ type: "down" });
      // Margined timeout, not the 1s default. This waits on a real pointer-down round-tripping
      // through CDP into the browser's own :active bookkeeping -- a genuine input-latency wait
      // whose duration scales with machine load, not a paint that settles on its own schedule.
      // The stylesheet declares no transition on [part="command"], so once :active engages the
      // fill is exact immediately; the only thing being waited on is the event arriving. Under a
      // fully-parallel 490-file run this exceeded 1s and failed two separate release attempts.
      await waitUntil(
        () => row.isConnected && row.getAttribute("data-active") === "true" &&
          row.matches(":active") && getComputedStyle(row).backgroundColor === pressed,
        "the highlighted row kept its resting fill while held",
        { timeout: POINTER_STATE_TIMEOUT }
      );
    } finally {
      await sendMouse({ type: "up" });
      await resetMouse();
    }
  });

  it("restores the highlighted row's resting fill once the pointer is released", async function () {
    // Both sequential state polls retain their existing budget.
    this.timeout(POINTER_TEST_TIMEOUT + POINTER_STATE_TIMEOUT);
    if (window.matchMedia("(hover: none), (pointer: coarse)").matches)
      this.skip();
    const el = await openThemed();
    // The click that ends the press selects the command and closes the palette, taking the row
    // being asserted on with it -- vetoing the close keeps the row mounted so the released state
    // is observable at all.
    el.addEventListener("lr-close", (event) => event.preventDefault());
    const row = el.shadowRoot!.querySelector(
      '[part="command"][data-active="true"]'
    ) as HTMLElement;
    const pressed = resolvedInShadow(
      el,
      "background: color-mix(in oklab, rgb(0, 51, 102), var(--lr-color-mix-partner) var(--lr-color-mix-active))",
      "background-color"
    );
    expect(pressed).to.not.equal("rgb(0, 51, 102)");
    try {
      await resetMouse();
      await hoverUntilMatched(row, "the pointer must reach the highlighted row");
      expect(row.isConnected, "the highlighted row must remain mounted").to.equal(true);
      expect(row.getAttribute("data-active")).to.equal("true");
      await sendMouse({ type: "down" });
      await waitUntil(
        () => row.isConnected && row.getAttribute("data-active") === "true" &&
          row.matches(":active") && getComputedStyle(row).backgroundColor === pressed,
        "the highlighted row must show its held fill before release",
        { timeout: POINTER_STATE_TIMEOUT }
      );
      await sendMouse({ type: "up" });
      await waitUntil(
        () => row.isConnected && row.getAttribute("data-active") === "true" &&
          !row.matches(":active") && getComputedStyle(row).backgroundColor === "rgb(0, 51, 102)",
        "the highlighted row never returned to its resting fill",
        { timeout: POINTER_STATE_TIMEOUT }
      );
      expect(el.open).to.equal(true);
    } finally {
      await resetMouse();
    }
  });
});

describe('native pointer cleanup', () => {
  async function pointerTarget(): Promise<HTMLButtonElement> {
    const target = await fixture<HTMLButtonElement>(html`<button style="inline-size: 120px; block-size: 48px">Pointer target</button>`);
    target.addEventListener('contextmenu', event => event.preventDefault());
    await hoverUntilMatched(target, 'the native pointer must reach its cleanup target');
    target.focus();
    return target;
  }

  it('leaves a focused palette and its rows unchanged when no mouse button is held', async () => {
    const selection = await fixture<HTMLInputElement>(html`<input value="alpha">`);
    selection.focus();
    await sendKeys({ press: 'Home' });
    for (let index = 0; index < 3; index += 1) await sendKeys({ press: 'Shift+ArrowRight' });
    expect(selection.value.slice(selection.selectionStart!, selection.selectionEnd!)).to.equal('alp');
    selection.remove();
    const palette = await fixture<LyraCommandPalette>(html`<lr-command-palette .commands=${[{ commandId: 'save', label: 'Save' }]}></lr-command-palette>`);
    palette.openPalette();
    await palette.updateComplete;
    const input = palette.shadowRoot!.querySelector<HTMLInputElement>('input')!;
    input.focus();
    const row = palette.shadowRoot!.querySelector<HTMLElement>('[part="command"]')!;
    const released: number[] = [];
    const inputTypes: string[] = [];
    const onRelease = (event: MouseEvent) => released.push(event.button);
    const onInput = (event: Event) => inputTypes.push((event as InputEvent).inputType);
    window.addEventListener('mouseup', onRelease, true);
    input.addEventListener('input', onInput);
    try {
      await resetMouse();
      await resetMouse();
      await settlePointer();
      expect(released, 'idle cleanup must not synthesize native releases').to.deep.equal([]);
      expect(inputTypes, 'idle cleanup must not paste into the focused search').to.deep.equal([]);
      expect(input.value).to.equal('');
      expect(palette.shadowRoot!.activeElement === input).to.equal(true);
      expect(row.isConnected).to.equal(true);
      expect(palette.shadowRoot!.querySelector('[part="command"]') === row).to.equal(true);
    } finally {
      window.removeEventListener('mouseup', onRelease, true);
      input.removeEventListener('input', onInput);
      await resetMouse();
    }
  });

  for (const [button, nativeButton] of [['left', 0], ['middle', 1], ['right', 2]] as const) {
    it(`releases a held ${button} button exactly once and retains explicit releases`, async () => {
      const target = await pointerTarget();
      const down: number[] = [];
      const up: number[] = [];
      target.addEventListener('mousedown', event => down.push(event.button));
      target.addEventListener('mouseup', event => up.push(event.button));
      try {
        await sendMouse({ type: 'down', button });
        await waitUntil(() => down.length === 1, 'the native button must be held');
        await resetMouse();
        await waitUntil(() => up.length === 1, 'cleanup must release the held native button');
        await resetMouse();
        await settlePointer();
        expect(up).to.deep.equal([nativeButton]);
        await hoverUntilMatched(target, 'the target must remain usable after cleanup');
        await sendMouse({ type: 'down', button });
        await sendMouse({ type: 'up', button });
        await resetMouse();
        await settlePointer();
        expect(down).to.deep.equal([nativeButton, nativeButton]);
        expect(up).to.deep.equal([nativeButton, nativeButton]);
      } finally {
        await resetMouse();
      }
    });
  }

  it('releases a real three-button chord only once across concurrent resets', async () => {
    const target = await pointerTarget();
    const released: { button: number; buttons: number }[] = [];
    target.addEventListener('mouseup', event => released.push({ button: event.button, buttons: event.buttons }));
    try {
      for (const button of ['left', 'middle', 'right'] as const) await sendMouse({ type: 'down', button });
      await Promise.all([resetMouse(), resetMouse()]);
      await waitUntil(() => released.length === 3, 'every held native button must be released');
      expect(released.map(event => event.button)).to.deep.equal([0, 1, 2]);
      expect(released[2]!.buttons).to.equal(0);
    } finally {
      await resetMouse();
    }
  });

  it('keeps pending presses and cleanup in invocation order', async () => {
    const target = await pointerTarget();
    const events: string[] = [];
    const onDown = (event: MouseEvent) => events.push(`down:${event.button}`);
    const onUp = (event: MouseEvent) => events.push(`up:${event.button}`);
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('mouseup', onUp, true);
    try {
      const first = sendMouse({ type: 'down', button: 'left' });
      const clean = resetMouse();
      const second = sendMouse({ type: 'down', button: 'right' });
      await Promise.all([first, clean, second]);
      await resetMouse();
      await waitUntil(() => events.length === 4, 'queued native press and release commands must complete');
      expect(events).to.deep.equal(['down:0', 'up:0', 'down:2', 'up:2']);
      expect(target.isConnected).to.equal(true);
    } finally {
      window.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('mouseup', onUp, true);
      await resetMouse();
    }
  });

  it('does not release a completed native click again during cleanup', async () => {
    const target = await pointerTarget();
    const rect = target.getBoundingClientRect();
    const up: number[] = [];
    window.addEventListener('mouseup', onUp, true);
    function onUp(event: MouseEvent): void { up.push(event.button); }
    try {
      await sendMouse({ type: 'click', position: [Math.round(rect.x + rect.width / 2), Math.round(rect.y + rect.height / 2)] });
      await resetMouse();
      await settlePointer();
      expect(up).to.deep.equal([0]);
    } finally {
      window.removeEventListener('mouseup', onUp, true);
      await resetMouse();
    }
  });
});
