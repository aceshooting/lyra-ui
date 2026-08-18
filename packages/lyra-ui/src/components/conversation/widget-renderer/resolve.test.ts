import { expect } from "@open-wc/testing";
import {
  createWidgetDocument,
  resolveTree,
  type ResolveContext,
  type LyraWidgetNode,
} from "./resolve.js";
import {
  readWidgetPointer,
  WIDGET_MAX_DEPTH,
  WIDGET_MAX_NODES,
  WIDGET_MAX_PROPS_PER_NODE,
  WIDGET_MAX_WARNINGS,
} from "../../../internal/widget-resolver.js";
import {
  createWidgetTypeRegistry,
  type LyraWidgetTypeRegistry,
} from "./registry.js";

describe("createWidgetDocument", () => {
  it("takes an immediate frozen structural snapshot without cloning opaque leaves", () => {
    const propLeaf = { value: 1 };
    const payload = { request: "open" };
    const child: LyraWidgetNode = {
      type: "button",
      id: "open",
      props: { data: propLeaf },
      actionId: "open-action",
      payload,
    };
    const children: Array<LyraWidgetNode | string> = [child, "before"];
    const root: LyraWidgetNode = { type: "row", children };

    const document = createWidgetDocument(root);
    child.type = "mutated";
    children[1] = "after";
    children.push({ type: "text" });

    expect(document).to.deep.include({ version: "2" });
    expect(document.root.children).to.have.length(2);
    expect(document.root.children?.[0]).to.deep.include({ type: "button" });
    expect(document.root.children?.[1]).to.equal("before");
    expect(Object.isFrozen(document)).to.be.true;
    expect(Object.isFrozen(document.root)).to.be.true;
    expect(Object.isFrozen(document.root.children)).to.be.true;
    const snappedChild = document.root.children?.[0] as LyraWidgetNode;
    expect(Object.isFrozen(snappedChild)).to.be.true;
    expect(Object.isFrozen(snappedChild.props)).to.be.true;
    expect(snappedChild.props?.["data"]).to.equal(propLeaf);
    expect(snappedChild.payload).to.equal(payload);
    expect(Object.isFrozen(propLeaf)).to.be.false;
    expect(Object.isFrozen(payload)).to.be.false;
  });

  it("uses the renderer node budget without reading a sibling outside it", () => {
    const children = Array.from(
      { length: WIDGET_MAX_NODES + 1 },
      () => ({ type: "text" }) as LyraWidgetNode
    );
    Object.defineProperty(children, WIDGET_MAX_NODES - 1, {
      configurable: true,
      get(): never {
        throw new Error("outside the admitted prefix");
      },
    });

    const document = createWidgetDocument({ type: "row", children });
    expect(document.root.children).to.have.length(WIDGET_MAX_NODES - 1);
  });

  it("fails closed for malformed, cyclic, duplicate-id, and hostile structures", () => {
    const cyclic: { type: string; children?: unknown[] } = { type: "row" };
    cyclic.children = [cyclic];
    const hostile = {
      get type(): never {
        throw new Error("hostile type");
      },
    };
    const invalid: unknown[] = [
      null,
      { children: [] },
      { type: "row", props: [] },
      { type: "row", children: [null] },
      { type: "text", id: "" },
      cyclic,
      hostile,
      {
        type: "row",
        children: [
          { type: "text", id: "same" },
          { type: "text", id: "same" },
        ],
      },
    ];

    for (const root of invalid) {
      expect(() => createWidgetDocument(root as LyraWidgetNode)).to.throw(
        TypeError
      );
    }
  });

  it("rejects an invalid slot or actionId on a document node", () => {
    expect(() =>
      createWidgetDocument({ type: "row", slot: " bad " } as LyraWidgetNode)
    ).to.throw(TypeError);
    expect(() =>
      createWidgetDocument({ type: "row", actionId: "" } as LyraWidgetNode)
    ).to.throw(TypeError);
  });

  it("caps admitted document props and fails closed on a throwing prop getter", () => {
    const props: Record<string, unknown> = {};
    for (let index = 0; index < WIDGET_MAX_PROPS_PER_NODE + 5; index++) {
      props[`p${index}`] = index;
    }
    const document = createWidgetDocument({ type: "row", props });
    expect(Object.keys(document.root.props ?? {})).to.have.lengthOf(
      WIDGET_MAX_PROPS_PER_NODE
    );

    const hostileProps: Record<string, unknown> = {};
    Object.defineProperty(hostileProps, "bad", {
      enumerable: true,
      get(): never {
        throw new Error("hostile prop");
      },
    });
    expect(() =>
      createWidgetDocument({ type: "row", props: hostileProps })
    ).to.throw(TypeError);
  });

  it("silently drops document descendants beyond the depth cap rather than throwing", () => {
    let deep: LyraWidgetNode = { type: "row" };
    for (let index = 0; index <= WIDGET_MAX_DEPTH + 2; index++) {
      deep = { type: "row", children: [deep] };
    }
    const document = createWidgetDocument(deep);
    let depth = 0;
    let node: LyraWidgetNode | undefined = document.root;
    while (node?.children && node.children.length > 0) {
      depth += 1;
      node = node.children[0] as LyraWidgetNode;
    }
    expect(depth).to.equal(WIDGET_MAX_DEPTH);
  });
});

function ctx(
  registry: LyraWidgetTypeRegistry = createWidgetTypeRegistry(),
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
    const cyclic: LyraWidgetNode = { type: "row" };
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
      expect(resolveTree(input as LyraWidgetNode, ctx())).to.be.null;
    }
  });

  it("bounds depth and node count", () => {
    let deep: LyraWidgetNode = { type: "row" };
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
    const wide: LyraWidgetNode = {
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
      () => ({ type: "row" } as LyraWidgetNode)
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
    expect(() => resolveTree(root as LyraWidgetNode, ctx())).to.throw();
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
    expect(resolveTree({ type: "text", id: "" } as LyraWidgetNode, ctx())).to.be
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

  it("resolves a builtin column and drops an unlisted row/col enum value", () => {
    const resolved = resolveTree(
      { type: "col", props: { gap: "xl", align: "center" } },
      ctx()
    );
    expect(resolved?.kind).to.equal("builtin-col");
    expect(resolved?.props).to.deep.equal({ align: "center" });
  });

  it("converts a numeric bound text value to a string", () => {
    const resolved = resolveTree({ type: "text", props: { value: 42 } }, ctx());
    expect(resolved?.props).to.deep.equal({ value: "42" });
  });

  it("drops a mapped prop whose resolved value does not match the allowlisted primitive type", () => {
    const warnings: string[] = [];
    const registry = createWidgetTypeRegistry([
      [
        "card",
        {
          tag: "lr-card",
          interaction: "none",
          props: { appearance: "string" },
        },
      ],
    ]);
    const resolved = resolveTree(
      { type: "card", props: { appearance: 42 } },
      ctx(registry, warnings)
    );
    expect(resolved?.props).to.deep.equal({});
    expect(warnings.some((warning) => warning.includes("mistyped"))).to.equal(
      true
    );
  });

  it("falls back to console.warn when the context supplies no warn callback", () => {
    const original = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => {
      calls.push(args);
    };
    try {
      const resolved = resolveTree(
        { type: "evil-widget" },
        {
          registry: createWidgetTypeRegistry(),
          bindingState: undefined,
          warned: new Set(),
        }
      );
      expect(resolved).to.be.null;
      expect(calls).to.have.lengthOf(1);
      expect(String(calls[0]?.[0])).to.include("evil-widget");
    } finally {
      console.warn = original;
    }
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
