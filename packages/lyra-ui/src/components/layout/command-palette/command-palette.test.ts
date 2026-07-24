import { fixture, expect, html, oneEvent } from "@open-wc/testing";
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

it("opens, filters, and selects a command", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[
        { id: "save", label: "Save", group: "File" },
        { id: "close", label: "Close" },
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
  expect((await selected).detail.command.id).to.equal("save");
  expect(el.open).to.be.false;
});

it("registers and unregisters commands through the public API", async () => {
  let selections = 0;
  const el = (await fixture(
    html`<lr-command-palette></lr-command-palette>`
  )) as LyraCommandPalette;
  const command = {
    id: "registered",
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
      { id: "disabled", label: "Disabled", disabled: true },
      { id: "open", label: "Open" },
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
  expect((await selected).detail.command.id).to.equal("open");

  el.commands = [{ id: "disabled", label: "Disabled", disabled: true }];
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

it("is accessible while open", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[{ id: "save", label: "Save" }]}
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
        { id: "save", label: "Save" },
        { id: "close", label: "Close" },
      ]}
    ></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input")!;
  const rows = el.shadowRoot!.querySelectorAll('[part="command"]');
  expect(rows[0].id).to.not.equal("");
  expect(input.getAttribute("aria-activedescendant")).to.equal(rows[0].id);
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(input.getAttribute("aria-activedescendant")).to.equal(rows[1].id);
});

it("skips disabled commands during arrow navigation and marks them aria-disabled", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[
        { id: "a", label: "Alpha" },
        { id: "b", label: "Bravo", disabled: true },
        { id: "c", label: "Charlie" },
      ]}
    ></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input")!;
  const rows = el.shadowRoot!.querySelectorAll('[part="command"]');
  expect(rows[0].getAttribute("aria-disabled")).to.equal("false");
  expect(rows[1].getAttribute("aria-disabled")).to.equal("true");
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowDown",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(input.getAttribute("aria-activedescendant")).to.equal(rows[2].id);
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(input.getAttribute("aria-activedescendant")).to.equal(rows[0].id);
});

it("never rests the active option on a disabled command when one leads the list", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[
        { id: "a", label: "Alpha", disabled: true },
        { id: "b", label: "Bravo" },
      ]}
    ></lr-command-palette>`
  )) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector("input")!;
  const rows = el.shadowRoot!.querySelectorAll('[part="command"]');
  expect(input.getAttribute("aria-activedescendant")).to.equal(rows[1].id);
  input.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "ArrowUp",
      bubbles: true,
      cancelable: true,
    })
  );
  await el.updateComplete;
  expect(input.getAttribute("aria-activedescendant")).to.equal(rows[1].id);
});

it("scrolls the newly active row into view when navigating with arrow keys", async () => {
  const commands = Array.from({ length: 5 }, (_unused, i) => ({
    id: `c${i}`,
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

it("preserves the active command by identity across reorder and repairs it after removal", async () => {
  const alpha = { id: "a", label: "Alpha" };
  const bravo = { id: "b", label: "Bravo" };
  const charlie = { id: "c", label: "Charlie" };
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

  el.commands = [charlie, alpha, bravo];
  await el.updateComplete;
  expect(
    el.shadowRoot!.querySelector('[part="command"][data-active="true"]')!
      .textContent
  ).to.contain("Bravo");
  expect(
    el.shadowRoot!.getElementById(input.getAttribute("aria-activedescendant")!),
    "the reconciled active descendant remains rendered"
  ).to.exist;

  el.commands = [charlie, alpha];
  await el.updateComplete;
  expect(
    el.shadowRoot!.getElementById(input.getAttribute("aria-activedescendant")!)
  ).to.exist;
});

it("case-folds command search with the effective locale", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      lang="tr"
      .commands=${[
        { id: "istanbul", label: "İstanbul" },
        { id: "izmir", label: "İzmir" },
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
  expect(rows[0].textContent).to.contain("İstanbul");
});

it("owns grouped options through labeled ARIA groups", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[
        { id: "save", label: "Save", group: "File" },
        { id: "close", label: "Close", group: "File" },
        { id: "copy", label: "Copy", group: "Edit" },
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
    id: `command-${index}`,
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
  expect(
    el.shadowRoot!.getElementById(input.getAttribute("aria-activedescendant")!)
  ).to.exist;
});

it("renders a visible focus indicator on the auto-focused search input", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[{ id: "save", label: "Save" }]}
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
          id: "long",
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
      .commands=${[{ id: "save", label: "Save" }]}
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
      .commands=${[{ id: "save", label: "Save" }]}
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

it("locks document scroll while open and releases it on close", async () => {
  const el = (await fixture(
    html`<lr-command-palette
      .commands=${[{ id: "save", label: "Save" }]}
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
      .commands=${[{ id: "save", label: "Save" }]}
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

it("supports an explicit ctrl shortcut without requiring the platform mod key", async () => {
  const el = (await fixture(
    html`<lr-command-palette shortcut="ctrl+p"></lr-command-palette>`
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
            { id: "save", label: "Save" },
            { id: "close", label: "Close" },
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
    expect(active).to.exist;
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

it("resets the native search-input cancel glyph instead of leaving the browser default", () => {
  const css = styles.cssText.replace(/\s+/g, " ").replaceAll('"', "'");
  expect(css).to.match(/\[part='input'\]::-webkit-search-cancel-button/);
  expect(css).to.match(/\[part='input'\]::-webkit-search-decoration/);
});

it("shrinks a long, unbreakable command description instead of overflowing the dialog", async () => {
  // Deliberately has no space/hyphen/slash break opportunities anywhere -- with the UA default
  // `min-width: auto` a flex:1 child still refuses to shrink below its own (here: full-string)
  // min-content width, forcing this row -- and the whole list -- wider than the dialog.
  const longDescription = "x".repeat(120);
  const el = (await fixture(html`<lr-command-palette
    style="--lr-command-palette-max-inline-size: 320px;"
    .commands=${[
      { id: "open", label: "Open File", description: longDescription },
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
      { id: "save", label: "Save", icon },
      { id: "close", label: "Close" },
    ]}
  ></lr-command-palette>`)) as LyraCommandPalette;
  el.openPalette();
  await el.updateComplete;
  const rows = el.shadowRoot!.querySelectorAll('[part="command"]');
  expect(rows[0].querySelector('[part="icon"] svg.save-icon')).to.not.equal(
    null
  );
  expect(rows[1].querySelector('[part="icon"]')).to.equal(null);
});

it("renders localized strings from a .strings override for the dialog label, placeholder, results label, and empty message", async () => {
  const el = (await fixture(html`<lr-command-palette
    .commands=${[{ id: "save", label: "Save" }]}
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
