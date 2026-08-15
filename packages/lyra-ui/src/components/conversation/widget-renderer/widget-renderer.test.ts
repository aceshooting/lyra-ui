import { fixture, expect, html, oneEvent } from "@open-wc/testing";
import "../../forms/input/input.js";
import "./widget-renderer.js";
import { createWidgetDocument, type LyraWidgetNode } from "./resolve.js";
import { createWidgetTypeRegistry } from "./registry.js";
import { DEFAULT_WIDGET_TYPE_REGISTRY } from "./default-registry.js";
import type { LyraWidgetRenderer } from "./widget-renderer.js";

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

function documentFor(root: LyraWidgetNode) {
  return createWidgetDocument(root);
}

describe("lr-widget-renderer", () => {
  it("defaults to an empty version-two document surface", async () => {
    const el = await fixture<LyraWidgetRenderer>(
      html`<lr-widget-renderer></lr-widget-renderer>`
    );
    expect(el.document).to.be.null;
    expect(el.bindingState).to.be.undefined;
    expect(el.registry).to.equal(DEFAULT_WIDGET_TYPE_REGISTRY);
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.children
    ).to.have.lengthOf(0);
  });

  it("renders built-in layout and default mapped widgets from a version-two document", async () => {
    const el = await fixture<LyraWidgetRenderer>(
      html`<lr-widget-renderer></lr-widget-renderer>`
    );
    el.document = documentFor({
      type: "row",
      props: { gap: "m", align: "stretch", justify: "between" },
      children: [
        { type: "stat", props: { label: "Users", value: "1,204" } },
        { type: "stat", props: { label: "Errors", value: "3" } },
      ],
    });
    await el.updateComplete;

    const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
    const stats = row.querySelectorAll("lr-stat");
    expect(stats).to.have.lengthOf(2);
    expect((stats[0] as HTMLElement & { label: string }).label).to.equal(
      "Users"
    );
    expect(getComputedStyle(row).alignItems).to.equal("stretch");
    expect(getComputedStyle(row).justifyContent).to.equal("space-between");
  });

  it("renders mapped tags declaratively with stable hydration identity markers", async () => {
    const el = await fixture<LyraWidgetRenderer>(
      html`<lr-widget-renderer
        .document=${documentFor({
          type: "stat",
          id: "summary",
          props: { label: "Summary", value: "42" },
        })}
      ></lr-widget-renderer>`
    );
    const stat = el.shadowRoot!.querySelector("lr-stat")!;
    expect(stat.getAttribute("data-widget-node-key")).to.equal("id:summary");
    expect(stat.getAttribute("data-widget-node-path")).to.equal("0");
  });

  it("skips unknown types and disallowed props", async () => {
    const el = await fixture<LyraWidgetRenderer>(
      html`<lr-widget-renderer></lr-widget-renderer>`
    );
    const warnings = await captureWarnings(async () => {
      el.document = documentFor({
        type: "row",
        children: [
          { type: "evil-widget", props: { onclick: "alert(1)" } },
          {
            type: "card",
            props: { appearance: "outlined", href: "https://evil.example/" },
          },
        ],
      });
      await el.updateComplete;
    });
    expect(warnings.join("\n")).to.include("evil-widget");
    expect(warnings.join("\n")).to.include("href");
    expect(el.shadowRoot!.innerHTML).to.not.include("evil-widget");
    const card = el.shadowRoot!.querySelector("lr-card") as HTMLElement & {
      appearance: string;
      href?: string;
    };
    expect(card.appearance).to.equal("outlined");
    expect(card.href).to.be.undefined;
  });

  it("emits correlated widget actions only after the registered action event", async () => {
    const el = await fixture<LyraWidgetRenderer>(
      html`<lr-widget-renderer
        .document=${documentFor({
          type: "button",
          id: "refresh-control",
          actionId: "refresh",
          payload: { panel: "summary" },
          children: ["Refresh"],
        })}
      ></lr-widget-renderer>`
    );
    const button = el.shadowRoot!.querySelector("lr-button")!;
    const listener = oneEvent(el, "lr-widget-action");
    button.dispatchEvent(new Event("click", { bubbles: true, composed: true }));
    const event = (await listener) as CustomEvent<{
      actionId: string;
      payload: unknown;
      nodeId: string;
      nodeKey: string;
      nodePath: string;
    }>;
    expect(event.detail).to.deep.equal({
      actionId: "refresh",
      payload: { panel: "summary" },
      nodeId: "refresh-control",
      nodeKey: "id:refresh-control",
      nodePath: "0",
    });
  });

  it("reuses a declaratively keyed mapped element and refreshes its action closure", async () => {
    const el = await fixture<LyraWidgetRenderer>(
      html`<lr-widget-renderer></lr-widget-renderer>`
    );
    el.document = documentFor({
      type: "button",
      id: "stable-button",
      actionId: "first",
      payload: 1,
    });
    await el.updateComplete;
    const first = el.shadowRoot!.querySelector("lr-button")!;

    el.document = documentFor({
      type: "button",
      id: "stable-button",
      actionId: "second",
      payload: 2,
    });
    await el.updateComplete;
    const second = el.shadowRoot!.querySelector("lr-button")!;
    expect(second === first).to.equal(true);

    const listener = oneEvent(el, "lr-widget-action");
    second.dispatchEvent(new Event("click", { bubbles: true, composed: true }));
    const event = (await listener) as CustomEvent<{ actionId: string }>;
    expect(event.detail.actionId).to.equal("second");
  });

  it("restores a retained element's original property when a document removes that prop", async () => {
    const registry = createWidgetTypeRegistry([
      [
        "field",
        {
          tag: "lr-input",
          interaction: "none",
          props: { value: "string" },
        },
      ],
    ]);
    const el = await fixture<LyraWidgetRenderer>(
      html`<lr-widget-renderer .registry=${registry}></lr-widget-renderer>`
    );
    el.document = documentFor({
      type: "field",
      id: "stable-field",
      props: { value: "Ada" },
    });
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector("lr-input") as HTMLElement & {
      value: string;
    };
    expect(input.value).to.equal("Ada");

    el.document = documentFor({ type: "field", id: "stable-field" });
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector("lr-input") === input).to.equal(true);
    expect(input.value).to.equal("");
  });

  it("fails closed once and clears stale UI for malformed nested input", async () => {
    const el = await fixture<LyraWidgetRenderer>(
      html`<lr-widget-renderer
        .document=${documentFor({
          type: "stat",
          props: { label: "Previous", value: "1" },
        })}
      ></lr-widget-renderer>`
    );
    expect(el.shadowRoot!.querySelector("lr-stat")).to.exist;
    const events: CustomEvent<{ error: Error }>[] = [];
    el.addEventListener("lr-render-error", (event) => events.push(event));

    el.document = {
      version: "2",
      root: { type: "row", children: [null] } as unknown as LyraWidgetNode,
    };
    await el.updateComplete;
    expect(events).to.have.lengthOf(1);
    expect(events[0]!.detail.error).to.be.instanceOf(Error);
    expect(el.shadowRoot!.querySelector("lr-stat") === null).to.be.true;
  });

  it("puts version and root access inside the same normalized fail-closed path", async () => {
    for (const hostile of [
      {
        get version(): never {
          throw "version accessor failed";
        },
        root: { type: "row" },
      },
      {
        version: "2",
        get root(): never {
          throw "root accessor failed";
        },
      },
    ]) {
      const el = await fixture<LyraWidgetRenderer>(
        html`<lr-widget-renderer
          .document=${documentFor({
            type: "stat",
            props: { label: "Previous", value: "1" },
          })}
        ></lr-widget-renderer>`
      );
      const renderedError = oneEvent(el, "lr-render-error");
      el.document = hostile as never;
      await el.updateComplete;
      const event = (await renderedError) as CustomEvent<{ error: Error }>;
      expect(event.detail.error).to.be.instanceOf(Error);
      expect((event.detail.error as Error).message).to.equal(
        "lr-widget-renderer: document resolution failed"
      );
      expect(el.shadowRoot!.querySelector("lr-stat") === null).to.be.true;
    }
  });

  it("fails closed for an unsupported document version without using a legacy tree", async () => {
    const el = await fixture<LyraWidgetRenderer>(
      html`<lr-widget-renderer></lr-widget-renderer>`
    );
    const renderedError = oneEvent(el, "lr-render-error");
    el.document = {
      version: "1",
      root: { type: "stat", props: { label: "Old", value: "1" } },
    } as never;
    await el.updateComplete;
    const event = (await renderedError) as CustomEvent<{ error: Error }>;
    expect((event.detail.error as Error).message).to.include(
      "unsupported document version"
    );
    expect(el.shadowRoot!.querySelector("lr-stat") === null).to.be.true;
  });

  it("treats a null document root as malformed rather than as an empty document", async () => {
    const el = await fixture<LyraWidgetRenderer>(
      html`<lr-widget-renderer></lr-widget-renderer>`
    );
    const renderedError = oneEvent(el, "lr-render-error");
    el.document = { version: "2", root: null } as never;
    await el.updateComplete;
    const event = (await renderedError) as CustomEvent<{ error: Error }>;
    expect(event.detail.error).to.be.instanceOf(Error);
    expect(
      el.shadowRoot!.querySelector('[part="base"]')!.children
    ).to.have.lengthOf(0);
  });

  it("treats explicit bindingState=null as state, not as a fallback sentinel", async () => {
    const el = await fixture<LyraWidgetRenderer>(
      html`<lr-widget-renderer></lr-widget-renderer>`
    );
    el.bindingState = null;
    el.document = documentFor({
      type: "text",
      id: "status",
      props: { value: { $bind: "", fallback: "not-null" } },
    });
    await el.updateComplete;
    expect(
      el.shadowRoot!.querySelector('[part="text"]')!.textContent?.trim()
    ).to.equal("");
  });

  it("keeps custom registry ownership isolated per renderer", async () => {
    const firstRegistry = createWidgetTypeRegistry([
      [
        "custom",
        {
          tag: "lr-badge",
          interaction: "none",
          props: { variant: "string" },
        },
      ],
    ]);
    const secondRegistry = createWidgetTypeRegistry([
      [
        "custom",
        {
          tag: "lr-card",
          interaction: "none",
          props: { appearance: "string" },
        },
      ],
    ]);
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <lr-widget-renderer
        .registry=${firstRegistry}
        .document=${documentFor({
          type: "custom",
          props: { variant: "success" },
        })}
      ></lr-widget-renderer>
      <lr-widget-renderer
        .registry=${secondRegistry}
        .document=${documentFor({
          type: "custom",
          props: { appearance: "outlined" },
        })}
      ></lr-widget-renderer>
    </div>`);
    const renderers = wrapper.querySelectorAll("lr-widget-renderer");
    expect(renderers[0]!.shadowRoot!.querySelector("lr-badge")).to.exist;
    expect(renderers[0]!.shadowRoot!.querySelector("lr-card") === null).to.be
      .true;
    expect(renderers[1]!.shadowRoot!.querySelector("lr-card")).to.exist;
    expect(renderers[1]!.shadowRoot!.querySelector("lr-badge") === null).to.be
      .true;
  });

  it("emits controlled state changes with stable node identity and preserves null detail", async () => {
    const registry = createWidgetTypeRegistry([
      [
        "field",
        {
          tag: "lr-input",
          props: { value: "string" },
          interaction: "control",
          bindings: { value: { event: "lr-input" } },
        },
      ],
    ]);
    const el = await fixture<LyraWidgetRenderer>(
      html`<lr-widget-renderer
        .registry=${registry}
        .bindingState=${{ name: "Ada" }}
        .document=${documentFor({
          id: "name-field",
          type: "field",
          props: { value: { $bind: "/name" } },
        })}
      ></lr-widget-renderer>`
    );
    const input = el.shadowRoot!.querySelector("lr-input") as HTMLElement & {
      value: string;
    };
    expect(input.value).to.equal("Ada");
    input.value = "property fallback";
    const changed = oneEvent(el, "lr-widget-state-change");
    input.dispatchEvent(
      new CustomEvent("lr-input", {
        bubbles: true,
        composed: true,
        detail: { value: null },
      })
    );
    const event = (await changed) as CustomEvent<{
      path: string;
      value: unknown;
      nodeId: string;
      nodeKey: string;
      nodePath: string;
      prop: string;
    }>;
    expect(event.detail).to.deep.equal({
      path: "/name",
      value: null,
      nodeId: "name-field",
      nodeKey: "id:name-field",
      nodePath: "0",
      prop: "value",
    });
  });

  it("detaches obsolete binding/action callbacks when nodes disappear", async () => {
    const registry = createWidgetTypeRegistry([
      [
        "field",
        {
          tag: "lr-input",
          props: { value: "string" },
          interaction: "control",
          bindings: { value: { event: "lr-input" } },
        },
      ],
      [
        "action",
        {
          tag: "lr-button",
          interaction: "control",
          action: { event: "click" },
        },
      ],
    ]);
    const el = await fixture<LyraWidgetRenderer>(
      html`<lr-widget-renderer .registry=${registry}></lr-widget-renderer>`
    );
    el.bindingState = { removed: "Ada" };
    el.document = documentFor({
      type: "row",
      children: [
        {
          id: "removed-field",
          type: "field",
          props: { value: { $bind: "/removed" } },
        },
        { id: "removed-action", type: "action", actionId: "remove" },
      ],
    });
    await el.updateComplete;
    const input = el.shadowRoot!.querySelector("lr-input")!;
    const button = el.shadowRoot!.querySelector("lr-button")!;
    let stateChanges = 0;
    let actions = 0;
    el.addEventListener("lr-widget-state-change", () => stateChanges++);
    el.addEventListener("lr-widget-action", () => actions++);

    el.document = documentFor({ type: "row" });
    await el.updateComplete;
    input.dispatchEvent(
      new Event("lr-input", { bubbles: true, composed: true })
    );
    button.dispatchEvent(new Event("click", { bubbles: true, composed: true }));
    expect(stateChanges).to.equal(0);
    expect(actions).to.equal(0);
  });

  it("rejects a bound native-control descendant beneath an actionable mapped control", async () => {
    const registry = createWidgetTypeRegistry([
      [
        "outer",
        {
          tag: "lr-button",
          interaction: "control",
          action: { event: "click" },
        },
      ],
      [
        "bound-input",
        {
          tag: "lr-input",
          props: { value: "string" },
          interaction: "control",
          bindings: { value: { event: "lr-input" } },
        },
      ],
    ]);
    const el = await fixture<LyraWidgetRenderer>(
      html`<lr-widget-renderer
        .registry=${registry}
        .bindingState=${{ name: "Ada" }}
        .document=${documentFor({
          type: "outer",
          id: "outer",
          actionId: "save",
          children: [
            "Save",
            {
              type: "bound-input",
              id: "nested-name",
              props: { value: { $bind: "/name" } },
            },
          ],
        })}
      ></lr-widget-renderer>`
    );
    expect(el.shadowRoot!.querySelector("lr-button")).to.exist;
    expect(el.shadowRoot!.querySelector("lr-input") === null).to.be.true;
    await expect(el).to.be.accessible();
  });

  it("clears a duplicate-id document rather than reconciling ambiguous occurrences", async () => {
    const el = await fixture<LyraWidgetRenderer>(
      html`<lr-widget-renderer></lr-widget-renderer>`
    );
    const error = oneEvent(el, "lr-render-error");
    // Exercise the renderer's untyped property boundary directly; the public factory rejects this
    // malformed identity graph before it can become a document.
    el.document = {
      version: "2",
      root: {
        type: "row",
        children: [
          { type: "stat", id: "duplicate", props: { label: "One", value: "1" } },
          { type: "stat", id: "duplicate", props: { label: "Two", value: "2" } },
        ],
      },
    };
    await el.updateComplete;
    await error;
    expect(el.shadowRoot!.querySelectorAll("lr-stat")).to.have.lengthOf(0);
  });

  it("wraps long content in a 320px RTL allocation", async () => {
    const container = await fixture<HTMLDivElement>(html`
      <div dir="rtl" style="inline-size:320px">
        <lr-widget-renderer
          style="display:block;inline-size:100%"
        ></lr-widget-renderer>
      </div>
    `);
    const el = container.querySelector(
      "lr-widget-renderer"
    ) as LyraWidgetRenderer;
    const long = "WidgetPayloadWithoutNaturalBreaks".repeat(16);
    el.document = documentFor({
      type: "row",
      props: { gap: "m" },
      children: [long, { type: "stat", props: { label: long, value: long } }],
    });
    await el.updateComplete;
    const row = el.shadowRoot!.querySelector('[part="row"]') as HTMLElement;
    expect(Math.round(container.getBoundingClientRect().width)).to.equal(320);
    expect(container.scrollWidth).to.be.at.most(container.clientWidth + 1);
    expect(row.scrollWidth).to.be.at.most(row.clientWidth + 1);
  });

  it("renders a mixed document accessibly", async () => {
    const el = await fixture<LyraWidgetRenderer>(
      html`<lr-widget-renderer
        .document=${documentFor({
          type: "row",
          children: [
            { type: "stat", props: { label: "Users", value: "1,204" } },
            {
              type: "button",
              id: "go-button",
              actionId: "go",
              children: ["Go"],
            },
          ],
        })}
      ></lr-widget-renderer>`
    );
    await expect(el).to.be.accessible();
  });
});
