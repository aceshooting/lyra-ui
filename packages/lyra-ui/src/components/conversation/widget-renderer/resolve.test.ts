import { expect } from "@open-wc/testing";
import {
  resolveTree,
  readWidgetPointer,
  WIDGET_MAX_NODES,
  WIDGET_MAX_PROPS_PER_NODE,
  WIDGET_MAX_WARNINGS,
  type ResolveContext,
  type WidgetNode,
} from "./resolve.js";
import {
  createWidgetTypeRegistry,
  type WidgetTypeRegistry,
} from "./registry.js";

function ctx(
  registry: WidgetTypeRegistry = createWidgetTypeRegistry(),
  warnings: string[] = [],
  bindingState: unknown = undefined
): ResolveContext {
  return {
    registry,
    bindingState,
    warned: new Set(),
    warn: (message) => warnings.push(message),
  };
}

describe("resolveTree (bounded allowlist enforcement)", () => {
  it("rejects mutable structural maps at an untyped registry boundary", () => {
    const mutable = new Map([
      ["card", { tag: "lr-card", interaction: "none" }],
    ]);
    expect(() => resolveTree({ type: "card" }, ctx(mutable as never))).to.throw(
      TypeError
    );
  });

  it("skips an unknown type and its subtree with one warning", () => {
    const warnings: string[] = [];
    const resolved = resolveTree(
      { type: "evil-widget", children: [{ type: "row" }] },
      ctx(createWidgetTypeRegistry(), warnings)
    );
    expect(resolved).to.be.null;
    expect(warnings).to.have.lengthOf(1);
    expect(warnings[0]).to.include("evil-widget");
  });

  it("filters mapped props by primitive type and applies forced props last", () => {
    const registry = createWidgetTypeRegistry([
      [
        "card",
        {
          tag: "lr-card",
          interaction: "none",
          props: { appearance: "string", disabled: "boolean" },
          forcedProps: { disabled: true },
        },
      ],
    ]);
    const resolved = resolveTree(
      {
        type: "card",
        props: { appearance: "outlined", disabled: false, href: "bad" },
      },
      ctx(registry)
    );
    expect(resolved?.kind).to.equal("mapped");
    expect(resolved?.props).to.deep.equal({
      appearance: "outlined",
      disabled: true,
    });
  });

  it("drops unallowlisted named slots without dropping their nodes", () => {
    const registry = createWidgetTypeRegistry([
      ["card", { tag: "lr-card", interaction: "none", slots: ["header"] }],
    ]);
    const resolved = resolveTree(
      {
        type: "card",
        children: [
          { type: "text", slot: "header", children: ["ok"] },
          { type: "text", slot: "footer", children: ["default"] },
        ],
      },
      ctx(registry)
    );
    expect(resolved?.children[0]?.slot).to.equal("header");
    expect(resolved?.children[1]?.slot).to.be.undefined;
  });

  it("resolves structural rows, columns, text and raw string children", () => {
    const resolved = resolveTree(
      {
        type: "row",
        props: { gap: "m", align: "center", justify: "between" },
        children: ["hello", { type: "text", props: { value: "world" } }],
      },
      ctx()
    );
    expect(resolved?.kind).to.equal("builtin-row");
    expect(resolved?.props).to.deep.equal({
      gap: "m",
      align: "center",
      justify: "between",
    });
    expect(resolved?.children[0]).to.deep.include({
      nodeKey: "path:0.0",
      nodePath: "0.0",
      kind: "text",
      text: "hello",
    });
    expect(resolved?.children[1]?.kind).to.equal("builtin-text");
  });

  it("fails closed for malformed roots, nested shapes and cycles", () => {
    const cyclic: WidgetNode = { type: "row" };
    cyclic.children = [cyclic];
    const malformed: unknown[] = [
      null,
      "bad",
      { children: [] },
      { type: "row", children: [null] },
      { type: "row", children: { type: "text" } },
      { type: "row", props: [] },
      cyclic,
    ];
    for (const input of malformed) {
      expect(resolveTree(input as WidgetNode, ctx())).to.be.null;
    }
  });

  it("bounds depth and node count", () => {
    let deep: WidgetNode = { type: "row" };
    for (let index = 0; index < 40; index++) {
      deep = { type: "row", children: [deep] };
    }
    const depthWarnings: string[] = [];
    expect(resolveTree(deep, ctx(createWidgetTypeRegistry(), depthWarnings))).to
      .not.be.null;
    expect(depthWarnings.some((warning) => warning.includes("depth"))).to.equal(
      true
    );

    const nodeWarnings: string[] = [];
    const wide: WidgetNode = {
      type: "row",
      children: Array.from({ length: WIDGET_MAX_NODES + 10 }, () => ({
        type: "row",
      })),
    };
    const resolved = resolveTree(
      wide,
      ctx(createWidgetTypeRegistry(), nodeWarnings)
    );
    expect(resolved?.children.length).to.equal(WIDGET_MAX_NODES - 1);
    expect(
      nodeWarnings.some((warning) => warning.includes("node cap"))
    ).to.equal(true);
  });

  it("never dereferences a sibling outside the one shared node budget", () => {
    const children = Array.from(
      { length: WIDGET_MAX_NODES + 2 },
      () => ({ type: "row" } as WidgetNode)
    );
    Object.defineProperty(children, WIDGET_MAX_NODES - 1, {
      configurable: true,
      get(): never {
        throw new Error("out-of-budget sibling was touched");
      },
    });
    const resolved = resolveTree({ type: "row", children }, ctx());
    expect(resolved?.children.length).to.equal(WIDGET_MAX_NODES - 1);
  });

  it("caps authored props before reading an out-of-budget getter", () => {
    const props: Record<string, unknown> = {};
    for (let index = 0; index < WIDGET_MAX_PROPS_PER_NODE; index++) {
      props[`disallowed${index}`] = index;
    }
    Object.defineProperty(props, `disallowed${WIDGET_MAX_PROPS_PER_NODE}`, {
      enumerable: true,
      get(): never {
        throw new Error("out-of-budget prop was touched");
      },
    });
    const warnings: string[] = [];
    const registry = createWidgetTypeRegistry([
      ["card", { tag: "lr-card", interaction: "none" }],
    ]);
    const resolved = resolveTree(
      { type: "card", props },
      ctx(registry, warnings)
    );
    expect(resolved?.props).to.deep.equal({});
    expect(warnings.some((warning) => warning.includes("prop cap"))).to.equal(
      true
    );
  });

  it("caps retained/emitted warnings and adds one aggregate suppression diagnostic", () => {
    const warnings: string[] = [];
    const context = ctx(createWidgetTypeRegistry(), warnings);
    resolveTree(
      {
        type: "row",
        children: Array.from(
          { length: WIDGET_MAX_WARNINGS * 3 },
          (_, index) => ({
            type: `unknown-${index}`,
          })
        ),
      },
      context
    );
    expect(context.warned.size).to.equal(WIDGET_MAX_WARNINGS + 1);
    expect(warnings).to.have.lengthOf(WIDGET_MAX_WARNINGS + 1);
    expect(warnings.at(-1)).to.include("suppressed further diagnostics");
  });

  it("propagates admitted throwing access so the host can emit one normalized render error", () => {
    const root = {
      get type(): never {
        throw "unreadable type";
      },
    };
    expect(() => resolveTree(root as WidgetNode, ctx())).to.throw();
  });

  it("requires unique, nonempty authored ids", () => {
    const warnings: string[] = [];
    const resolved = resolveTree(
      {
        type: "row",
        children: [
          { type: "text", id: "duplicate", props: { value: "first" } },
          { type: "text", id: "duplicate", props: { value: "second" } },
        ],
      },
      ctx(createWidgetTypeRegistry(), warnings)
    );
    expect(resolved).to.be.null;
    expect(warnings.some((warning) => warning.includes("duplicate"))).to.equal(
      true
    );
    expect(resolveTree({ type: "text", id: "" } as WidgetNode, ctx())).to.be
      .null;
  });

  it("publishes deterministic node ids, keys and paths", () => {
    const resolved = resolveTree(
      {
        type: "row",
        children: [
          { type: "text", id: "stable", props: { value: "first" } },
          { type: "text", props: { value: "second" } },
        ],
      },
      ctx()
    );
    expect(resolved?.children[0]).to.deep.include({
      nodeId: "stable",
      nodeKey: "id:stable",
      nodePath: "0.0",
    });
    expect(resolved?.children[1]).to.deep.include({
      nodeKey: "path:0.1",
      nodePath: "0.1",
    });
  });

  it("requires stable ids for bound and actionable nodes", () => {
    const registry = createWidgetTypeRegistry([
      [
        "button",
        {
          tag: "lr-button",
          interaction: "control",
          action: { event: "click" },
        },
      ],
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
    expect(() =>
      resolveTree({ type: "button", actionId: "submit" }, ctx(registry))
    ).to.throw(TypeError);
    expect(() =>
      resolveTree(
        { type: "field", props: { value: { $bind: "/name" } } },
        ctx(registry, [], { name: "Ada" })
      )
    ).to.throw(TypeError);
    expect(() =>
      resolveTree(
        { type: "text", props: { value: { $bind: "/name" } } },
        ctx(createWidgetTypeRegistry(), [], { name: "Ada" })
      )
    ).to.throw(TypeError);
  });

  it("uses explicit interaction metadata to reject every nested control", () => {
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
    const warnings: string[] = [];
    const resolved = resolveTree(
      {
        type: "outer",
        id: "outer",
        actionId: "save",
        children: [
          "Save",
          {
            type: "bound-input",
            id: "name",
            props: { value: { $bind: "/name", fallback: "" } },
          },
        ],
      },
      ctx(registry, warnings, { name: "Ada" })
    );
    expect(resolved?.children).to.have.lengthOf(1);
    expect(resolved?.children[0]?.kind).to.equal("text");
    expect(
      warnings.some((warning) => warning.includes("control descendant"))
    ).to.equal(true);
  });

  it("wires action metadata only when actionId is authored", () => {
    const registry = createWidgetTypeRegistry([
      [
        "button",
        {
          tag: "lr-button",
          interaction: "control",
          action: { event: "click" },
        },
      ],
    ]);
    const active = resolveTree(
      { type: "button", id: "submit-button", actionId: "submit", payload: 3 },
      ctx(registry)
    );
    const inactive = resolveTree(
      { type: "button", id: "plain-button" },
      ctx(registry)
    );
    expect(active).to.deep.include({
      actionEvent: "click",
      actionId: "submit",
      payload: 3,
      interactive: true,
    });
    expect(inactive?.actionEvent).to.be.undefined;
    expect(inactive?.interactive).to.equal(true);
  });

  describe("canonical JSON Pointer binding reads", () => {
    it("accepts only canonical decimal spellings for array indices", () => {
      const state = ["zero", "one"];
      expect(readWidgetPointer(state, "/0")).to.equal("zero");
      expect(readWidgetPointer(state, "/1")).to.equal("one");
      for (const pointer of ["/", "/00", "/+0", "/0x0", "/0.0", "/-", "/-1"]) {
        expect(readWidgetPointer(state, pointer), pointer).to.be.undefined;
      }
    });

    it("retains standard escape decoding and rejects malformed escapes", () => {
      const state = { "a/b": { "m~n": "ok" }, "": "empty-key" };
      expect(readWidgetPointer(state, "/a~1b/m~0n")).to.equal("ok");
      expect(readWidgetPointer(state, "/")).to.equal("empty-key");
      expect(readWidgetPointer(state, "/a~2b")).to.be.undefined;
    });

    it("blocks prototype-chain segments without mutating Object.prototype", () => {
      expect(readWidgetPointer({}, "/__proto__/polluted")).to.be.undefined;
      expect(readWidgetPointer({ nested: {} }, "/nested/constructor/prototype"))
        .to.be.undefined;
      expect(({} as Record<string, unknown>)["polluted"]).to.be.undefined;
    });

    it("preserves explicit null rather than taking a binding fallback", () => {
      const resolved = resolveTree(
        {
          type: "text",
          id: "status",
          props: { value: { $bind: "/status", fallback: "fallback" } },
        },
        ctx(createWidgetTypeRegistry(), [], { status: null })
      );
      expect(resolved?.props).to.deep.equal({});
    });
  });

  it("contains no raw HTML or browser-DOM creation path", async () => {
    const response = await fetch(new URL("./resolve.ts", import.meta.url));
    const rendererResponse = await fetch(
      new URL("./widget-renderer.class.ts", import.meta.url)
    );
    expect(response.ok && rendererResponse.ok).to.equal(true);
    const source = `${await response.text()}\n${await rendererResponse.text()}`;
    expect(source).to.not.include("innerHTML");
    expect(source).to.not.include("document.createElement");
  });
});
