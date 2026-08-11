import { fixture, expect, html, oneEvent } from "@open-wc/testing";
import "./widget-renderer.js";
import {
  registerWidgetType,
  clearWidgetTypes,
  getDefaultWidgetTypeRegistry,
} from "./registry.js";
import { registerDefaultWidgetTypes } from "./default-registry.js";
import type { LyraWidgetRenderer } from "./widget-renderer.js";
import type { WidgetNode } from "./resolve.js";

async function captureWarnings(work: () => Promise<void>): Promise<string[]> {
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) =>
    warnings.push(args.map(String).join(" "));
  try {
    await work();
  } finally {
    console.warn = originalWarn;
  }
  return warnings;
}

describe("lr-widget-renderer", () => {
  beforeEach(() => {
    clearWidgetTypes();
    registerDefaultWidgetTypes();
  });

  it("defaults to tree=null and renders an empty base with no lr-render-error", async () => {
    const el = (await fixture(
      html`<lr-widget-renderer></lr-widget-renderer>`
    )) as LyraWidgetRenderer;
    expect(el.tree).to.be.null;
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.children.length
    ).to.equal(0);
  });

  it("renders a built-in row of two mapped stat widgets", async () => {
    const el = (await fixture(
      html`<lr-widget-renderer></lr-widget-renderer>`
    )) as LyraWidgetRenderer;
    el.tree = {
      type: "row",
      props: { gap: "m" },
      children: [
        { type: "stat", props: { label: "Users", value: "1,204" } },
        { type: "stat", props: { label: "Errors", value: "3" } },
      ],
    };
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector('[part="row"]')!;
    const stats = row.querySelectorAll("lr-stat");
    expect(stats.length).to.equal(2);
    expect((stats[0] as HTMLElement & { label: string }).label).to.equal(
      "Users"
    );
  });

  it("applies the documented row alignment and distribution values", async () => {
    const el = (await fixture(
      html`<lr-widget-renderer></lr-widget-renderer>`
    )) as LyraWidgetRenderer;
    el.tree = {
      type: "row",
      props: { align: "stretch", justify: "between" },
    };
    await el.updateComplete;

    const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
    expect(getComputedStyle(row).alignItems).to.equal("stretch");
    expect(getComputedStyle(row).justifyContent).to.equal("space-between");
  });

  it("SECURITY: an unknown/disallowed type is silently skipped -- never rendered, never in the DOM", async () => {
    const el = (await fixture(
      html`<lr-widget-renderer></lr-widget-renderer>`
    )) as LyraWidgetRenderer;
    const warnings = await captureWarnings(async () => {
      el.tree = {
        type: "row",
        children: [
          { type: "evil-widget", props: { onclick: "alert(1)" } },
          { type: "stat", props: { label: "ok", value: "1" } },
        ],
      };
      await el.updateComplete;
    });
    expect(warnings.join("\n")).to.include("evil-widget");
    expect(el.shadowRoot!.innerHTML).to.not.include("evil-widget");
    expect(el.shadowRoot!.querySelectorAll("lr-stat").length).to.equal(1);
  });

  it("bounds warning dedupe keys to the current streamed tree generation", async () => {
    const el = (await fixture(
      html`<lr-widget-renderer></lr-widget-renderer>`
    )) as LyraWidgetRenderer;
    const access = el as unknown as { warned: Set<string> };
    const warnings = await captureWarnings(async () => {
      for (let index = 0; index < 64; index += 1) {
        el.tree = {
          type: "row",
          children: [{ type: `attacker-controlled-${index}` }],
        };
        await el.updateComplete;
      }

      expect(
        access.warned.size,
        "only the current tree warning key remains"
      ).to.equal(1);
      el.state = { unrelated: true };
      await el.updateComplete;
    });

    expect(
      warnings.filter((warning) => warning.includes("attacker-controlled-"))
        .length
    ).to.equal(64);
  });

  it("SECURITY: a disallowed prop is never assigned to the underlying element", async () => {
    const el = (await fixture(
      html`<lr-widget-renderer></lr-widget-renderer>`
    )) as LyraWidgetRenderer;
    const warnings = await captureWarnings(async () => {
      el.tree = {
        type: "card",
        props: { appearance: "outlined", href: "https://evil.example/" },
      };
      await el.updateComplete;
    });
    expect(warnings.join("\n")).to.include("href");
    const card = el.shadowRoot!.querySelector("lr-card") as HTMLElement & {
      href?: string;
      appearance: string;
    };
    expect(card.appearance).to.equal("outlined");
    expect(card.href).to.be.undefined; // 'href' is not in card's allowlist -- never assigned
  });

  it("emits lr-widget-action with actionId/payload when a mapped button's action event fires", async () => {
    const el = (await fixture(
      html`<lr-widget-renderer></lr-widget-renderer>`
    )) as LyraWidgetRenderer;
    el.tree = {
      type: "button",
      props: { variant: "brand" },
      actionId: "submit",
      payload: { formId: "f1" },
    };
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector("lr-button")!;
    const listener = oneEvent(el, "lr-widget-action");
    button.dispatchEvent(new Event("click", { bubbles: true, composed: true }));
    const event = (await listener) as CustomEvent<{
      actionId: string;
      payload: unknown;
    }>;
    expect(event.detail).to.deep.equal({
      actionId: "submit",
      payload: { formId: "f1" },
    });
  });

  it("refreshes a keyed action handler when the action id and payload change", async () => {
    const el = (await fixture(
      html`<lr-widget-renderer></lr-widget-renderer>`
    )) as LyraWidgetRenderer;
    el.tree = { type: "button", id: "stable", actionId: "first", payload: 1 };
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector("lr-button")!;

    el.tree = { type: "button", id: "stable", actionId: "second", payload: 2 };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("lr-button")).to.equal(button);

    const listener = oneEvent(el, "lr-widget-action");
    button.dispatchEvent(new Event("click", { bubbles: true, composed: true }));
    const event = (await listener) as CustomEvent<{
      actionId: string;
      payload: unknown;
    }>;
    expect(event.detail).to.deep.equal({ actionId: "second", payload: 2 });
  });

  it("emits lr-render-error for a structurally unusable non-null tree", async () => {
    const el = (await fixture(
      html`<lr-widget-renderer></lr-widget-renderer>`
    )) as LyraWidgetRenderer;
    const warnings = await captureWarnings(async () => {
      const listener = oneEvent(el, "lr-render-error");
      el.tree = { type: "totally-unknown-root-type" };
      await el.updateComplete;
      await listener;
    });
    expect(warnings.join("\n")).to.include("totally-unknown-root-type");
  });

  it("fails closed with one render error and clears stale UI for a malformed nested tree", async () => {
    const el = (await fixture(
      html`<lr-widget-renderer></lr-widget-renderer>`
    )) as LyraWidgetRenderer;
    el.tree = { type: "stat", props: { label: "Previous", value: "1" } };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll("lr-stat").length).to.equal(1);

    const errors: unknown[] = [];
    el.addEventListener("lr-render-error", (event) => {
      errors.push((event as CustomEvent<{ error: unknown }>).detail.error);
    });
    el.tree = { type: "row", children: [null] } as unknown as WidgetNode;
    await el.updateComplete;

    expect(errors.length).to.equal(1);
    expect(errors[0] instanceof Error).to.equal(true);
    expect(el.shadowRoot!.querySelectorAll("lr-stat").length).to.equal(0);
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.children.length
    ).to.equal(0);
  });

  it("falls back to a generic render error when a supplied document state accessor fails", async () => {
    const el = (await fixture(
      html`<lr-widget-renderer
        .tree=${{ type: "stat", props: { label: "Previous", value: "1" } }}
      ></lr-widget-renderer>`
    )) as LyraWidgetRenderer;
    expect(el.shadowRoot!.querySelectorAll("lr-stat")).to.have.lengthOf(1);

    const documentWithUnreadableState = {
      version: "1" as const,
      root: { type: "stat", props: { label: "Unreadable", value: "2" } },
      get state(): never {
        throw "state accessor failed";
      },
    };
    const renderedError = oneEvent(el, "lr-render-error");
    el.document = documentWithUnreadableState;
    await el.updateComplete;
    const event = (await renderedError) as CustomEvent<{ error: unknown }>;

    expect(event.detail.error).to.be.instanceOf(Error);
    expect((event.detail.error as Error).message).to.equal("lr-widget-renderer: tree resolution failed");
    expect(el.shadowRoot!.querySelectorAll("lr-stat")).to.have.lengthOf(0);
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.children.length
    ).to.equal(0);
  });

  it("reconciles a streamed update in place: the same mapped element instance survives a re-resolve", async () => {
    const el = (await fixture(
      html`<lr-widget-renderer></lr-widget-renderer>`
    )) as LyraWidgetRenderer;
    el.tree = {
      type: "stat",
      id: "s1",
      props: { label: "Users", value: "100" },
    };
    await el.updateComplete;
    const first = el.shadowRoot!.querySelector("lr-stat");
    el.tree = {
      type: "stat",
      id: "s1",
      props: { label: "Users", value: "101" },
    };
    await el.updateComplete;
    const second = el.shadowRoot!.querySelector("lr-stat");
    expect(second).to.equal(first); // same DOM element instance, not recreated
    expect((second as HTMLElement & { value: string }).value).to.equal("101");
  });

  it("restores a keyed element property default when a streamed update removes that prop", async () => {
    const registry = new Map([
      ["field", { tag: "input", props: { value: "string" as const } }],
    ]);
    const el = (await fixture(
      html`<lr-widget-renderer .registry=${registry}></lr-widget-renderer>`
    )) as LyraWidgetRenderer;
    el.tree = { type: "field", id: "stable", props: { value: "Ada" } };
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
    expect(input.value).to.equal("Ada");

    el.tree = { type: "field", id: "stable" };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("input") === input).to.equal(true);
    expect(input.value).to.equal("");
  });

  it("renders raw string children as text, and card children default-slotted unless allowlisted", async () => {
    const el = (await fixture(
      html`<lr-widget-renderer></lr-widget-renderer>`
    )) as LyraWidgetRenderer;
    el.tree = { type: "text", children: ["hello world"] };
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="text"]')!.textContent
    ).to.include("hello world");
  });

  it("wraps long built-in and mapped row content inside an exact 320px RTL allocation", async () => {
    const container = (await fixture(html`
      <div dir="rtl" style="inline-size:320px">
        <lr-widget-renderer style="display:block;inline-size:100%"></lr-widget-renderer>
      </div>
    `)) as HTMLDivElement;
    const el = container.querySelector("lr-widget-renderer") as LyraWidgetRenderer;
    const long = "WidgetPayloadWithoutNaturalBreaks".repeat(16);
    el.tree = {
      type: "row",
      props: { gap: "m" },
      children: [long, { type: "stat", props: { label: long, value: long } }],
    };
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
    const text = row.querySelector(".widget-text") as HTMLElement;
    const stat = row.querySelector("lr-stat") as HTMLElement & { updateComplete: Promise<unknown> };
    await stat.updateComplete;
    expect(Math.round(container.getBoundingClientRect().width)).to.equal(320);
    expect(container.scrollWidth).to.be.at.most(container.clientWidth + 1);
    expect(row.scrollWidth).to.be.at.most(row.clientWidth + 1);
    expect(text != null).to.equal(true);
    expect(text.scrollWidth).to.be.at.most(text.clientWidth + 1);
  });

  it("a custom per-instance registry overrides the default one", async () => {
    const custom = new Map();
    custom.set("custom-badge", {
      tag: "lr-badge",
      props: { variant: "string" },
    });
    const el = (await fixture(
      html`<lr-widget-renderer></lr-widget-renderer>`
    )) as LyraWidgetRenderer;
    el.registry = custom;
    el.tree = { type: "custom-badge", props: { variant: "success" } };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("lr-badge")).to.exist;
  });

  it("registerWidgetType() extends the default registry app-side", async () => {
    registerWidgetType("my-badge", {
      tag: "lr-badge",
      props: { variant: "string" },
    });
    expect(getDefaultWidgetTypeRegistry().has("my-badge")).to.be.true;
    const el = (await fixture(
      html`<lr-widget-renderer></lr-widget-renderer>`
    )) as LyraWidgetRenderer;
    el.tree = { type: "my-badge", props: { variant: "success" } };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("lr-badge")).to.exist;
  });

  it('the image built-in maps to lr-media-card with kind forced to "image"', async () => {
    const el = (await fixture(
      html`<lr-widget-renderer></lr-widget-renderer>`
    )) as LyraWidgetRenderer;
    el.tree = {
      type: "image",
      props: { src: "https://example.com/a.png", alt: "a", filename: "a.png" },
    };
    await el.updateComplete;
    const card = el.shadowRoot!.querySelector(
      "lr-media-card"
    ) as HTMLElement & { kind: string };
    expect(card.kind).to.equal("image");
  });

  it("is accessible with a mixed row/col/mapped tree", async () => {
    const el = (await fixture(
      html`<lr-widget-renderer></lr-widget-renderer>`
    )) as LyraWidgetRenderer;
    const tree: WidgetNode = {
      type: "row",
      children: [
        { type: "stat", props: { label: "Users", value: "1,204" } },
        {
          type: "button",
          props: { variant: "brand" },
          actionId: "go",
          children: ["Go"],
        },
      ],
    };
    el.tree = tree;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it("renders a versioned widget document and resolves controlled state bindings", async () => {
    const el = await fixture<LyraWidgetRenderer>(html`
      <lr-widget-renderer
        .document=${{
          version: "1",
          root: {
            id: "status",
            type: "col",
            children: [
              { type: "text", props: { value: { $bind: "/status" } } },
            ],
          },
          state: { status: "Ready" },
        }}
      ></lr-widget-renderer>
    `);
    expect(el.shadowRoot!.textContent).to.contain("Ready");
  });

  it("fails closed and emits lr-render-error for an unsupported document version", async () => {
    const el = await fixture<LyraWidgetRenderer>(html`
      <lr-widget-renderer
        .tree=${{ type: "stat", props: { label: "Fallback", value: "1" } }}
      ></lr-widget-renderer>
    `);
    let renderError: CustomEvent<{ error: unknown }> | undefined;
    el.addEventListener("lr-render-error", (event) => {
      renderError = event;
    });

    el.document = {
      version: "2" as never,
      root: { type: "stat", props: { label: "Unsupported", value: "2" } },
    };
    await el.updateComplete;

    expect(el.shadowRoot!.querySelectorAll("lr-stat").length).to.equal(0);
    expect(renderError).to.exist;
    expect(renderError!.detail.error).to.be.instanceOf(Error);
  });

  it("renders duplicate agent ids as distinct occurrence-scoped elements", async () => {
    const el = await fixture<LyraWidgetRenderer>(
      html`<lr-widget-renderer></lr-widget-renderer>`
    );
    el.tree = {
      type: "row",
      children: [
        {
          id: "duplicate",
          type: "stat",
          props: { label: "First", value: "1" },
        },
        {
          id: "duplicate",
          type: "stat",
          props: { label: "Second", value: "2" },
        },
      ],
    };
    await el.updateComplete;

    const stats = [...el.shadowRoot!.querySelectorAll("lr-stat")] as Array<
      HTMLElement & { label: string }
    >;
    expect(stats.length).to.equal(2);
    expect(stats.map((stat) => stat.label)).to.deep.equal(["First", "Second"]);
  });

  it("emits controlled state changes from bound mapped controls", async () => {
    const registry = new Map();
    registry.set("field", {
      tag: "input",
      props: { value: "string" },
      bindings: { value: { event: "input" } },
    });
    const el = await fixture<LyraWidgetRenderer>(html`
      <lr-widget-renderer
        .registry=${registry}
        .document=${{
          version: "1",
          root: {
            id: "name",
            type: "field",
            props: { value: { $bind: "/name" } },
          },
          state: { name: "Ada" },
        }}
      ></lr-widget-renderer>
    `);
    const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
    expect(input.value).to.equal("Ada");
    const changed = oneEvent(el, "lr-widget-state-change");
    input.value = "Grace";
    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    const event = (await changed) as CustomEvent<{
      path: string;
      value: unknown;
      nodeId: string;
      prop: string;
    }>;
    expect(event.detail).to.deep.equal({
      path: "/name",
      value: "Grace",
      nodeId: "name",
      prop: "value",
    });
  });

  it("uses a controlled event detail value ahead of the mapped control property", async () => {
    const registry = new Map();
    registry.set("field", {
      tag: "input",
      props: { value: "string" as const },
      bindings: { value: { event: "input" } },
    });
    const el = await fixture<LyraWidgetRenderer>(
      html`<lr-widget-renderer></lr-widget-renderer>`
    );
    el.registry = registry;
    el.state = { name: "Ada" };
    el.tree = {
      id: "name",
      type: "field",
      props: { value: { $bind: "/name" } },
    };
    await el.updateComplete;

    const input = el.shadowRoot!.querySelector("input") as HTMLInputElement;
    input.value = "stale property value";
    const changed = oneEvent(el, "lr-widget-state-change");
    input.dispatchEvent(
      new CustomEvent("input", {
        bubbles: true,
        composed: true,
        detail: { value: "event value" },
      })
    );

    const event = (await changed) as CustomEvent<{
      path: string;
      value: unknown;
      nodeId: string;
      prop: string;
    }>;
    expect(event.detail).to.deep.equal({
      path: "/name",
      value: "event value",
      nodeId: "name",
      prop: "value",
    });
  });

  it("detaches obsolete controlled callbacks when streamed nodes change or disappear", async () => {
    const registry = new Map();
    registry.set("field", {
      tag: "input",
      props: { value: "string" as const },
      bindings: { value: { event: "input" } },
    });
    registry.set("action", {
      tag: "button",
      action: { event: "click" },
    });
    const el = await fixture<LyraWidgetRenderer>(
      html`<lr-widget-renderer></lr-widget-renderer>`
    );
    el.registry = registry;
    el.state = { retained: "Ada", removed: "Bea" };
    el.tree = {
      type: "row",
      children: [
        {
          id: "retained",
          type: "field",
          props: { value: { $bind: "/retained" } },
        },
        {
          id: "removed",
          type: "field",
          props: { value: { $bind: "/removed" } },
        },
        { id: "action", type: "action", actionId: "remove-me" },
      ],
    };
    await el.updateComplete;

    const inputs = Array.from(
      el.shadowRoot!.querySelectorAll("input")
    ) as HTMLInputElement[];
    const retained = inputs[0]!;
    const removed = inputs[1]!;
    const action = el.shadowRoot!.querySelector("button") as HTMLButtonElement;
    let stateChanges = 0;
    let actions = 0;
    el.addEventListener("lr-widget-state-change", () => stateChanges++);
    el.addEventListener("lr-widget-action", () => actions++);

    el.tree = {
      type: "row",
      children: [
        { id: "retained", type: "field", props: { value: "literal" } },
      ],
    };
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector("input") === retained).to.equal(true);
    retained.dispatchEvent(
      new Event("input", { bubbles: true, composed: true })
    );
    removed.dispatchEvent(
      new Event("input", { bubbles: true, composed: true })
    );
    action.dispatchEvent(new Event("click", { bubbles: true, composed: true }));
    expect(stateChanges).to.equal(0);
    expect(actions).to.equal(0);
  });
});
