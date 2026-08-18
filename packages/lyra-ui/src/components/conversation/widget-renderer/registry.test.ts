import { expect } from "@open-wc/testing";
import { createWidgetTypeRegistry, isWidgetTypeRegistry } from "./registry.js";
import { DEFAULT_WIDGET_TYPE_REGISTRY } from "./default-registry.js";

describe("widget-renderer immutable registries", () => {
  it("creates an immutable isolated snapshot", () => {
    const definition = {
      tag: "lr-sparkline",
      interaction: "none" as const,
      props: { label: "string" as const },
    };
    const first = createWidgetTypeRegistry([["sparkline", definition]]);
    const second = createWidgetTypeRegistry();

    expect(first.get("sparkline")?.tag).to.equal("lr-sparkline");
    expect(second.has("sparkline")).to.equal(false);
    expect((first as unknown as { set?: unknown }).set).to.be.undefined;
    expect(Object.isFrozen(first)).to.equal(true);
    (definition.props as { label: string }).label = "number";
    const third = createWidgetTypeRegistry([["sparkline", definition]]);
    expect(first.get("sparkline")?.props).to.deep.equal({ label: "string" });
    expect(third.get("sparkline")?.props).to.deep.equal({ label: "number" });
    expect(Object.isFrozen(first.get("sparkline"))).to.equal(true);
    expect(Object.isFrozen(first.get("sparkline")?.props)).to.equal(true);
  });

  it("does not let a mutable structural Map satisfy the immutable registry contract", () => {
    const mutable = new Map([
      ["card", { tag: "lr-card", interaction: "none" as const }],
    ]);
    const snapshot = createWidgetTypeRegistry(mutable);
    expect(isWidgetTypeRegistry(mutable)).to.equal(false);
    expect(isWidgetTypeRegistry(snapshot)).to.equal(true);
    mutable.set("later", { tag: "lr-badge", interaction: "none" });
    expect(snapshot.has("later")).to.equal(false);
  });

  it("exposes one immutable built-in registry with explicit render targets", () => {
    expect(DEFAULT_WIDGET_TYPE_REGISTRY.size).to.equal(8);
    expect((DEFAULT_WIDGET_TYPE_REGISTRY as unknown as { set?: unknown }).set)
      .to.be.undefined;
    for (const definition of DEFAULT_WIDGET_TYPE_REGISTRY.values()) {
      expect(definition.tag).to.match(/^[a-z][.0-9_a-z]*-[\-.0-9_a-z]*$/);
      expect(["none", "control"]).to.include(definition.interaction);
      expect(Object.isFrozen(definition)).to.equal(true);
    }
    expect(DEFAULT_WIDGET_TYPE_REGISTRY.get("button")?.interaction).to.equal(
      "control"
    );
  });

  it("rejects a missing or non-custom-element render target", () => {
    expect(() => createWidgetTypeRegistry([["missing", {} as never]])).to.throw(
      TypeError
    );
    expect(() =>
      createWidgetTypeRegistry([
        ["native", { tag: "button", interaction: "none" }],
      ])
    ).to.throw(TypeError);
    expect(() =>
      createWidgetTypeRegistry([
        ["reserved", { tag: "annotation-xml", interaction: "none" }],
      ])
    ).to.throw(TypeError);
  });

  it("requires explicit control metadata for definitions with actions or bindings", () => {
    expect(() =>
      createWidgetTypeRegistry([["passive", { tag: "lr-card" } as never]])
    ).to.throw(TypeError);
    expect(() =>
      createWidgetTypeRegistry([
        [
          "action",
          {
            tag: "lr-button",
            interaction: "none",
            action: { event: "click" },
          },
        ],
      ])
    ).to.throw(TypeError);
    expect(() =>
      createWidgetTypeRegistry([
        [
          "bound",
          {
            tag: "lr-input",
            props: { value: "string" },
            interaction: "none",
            bindings: { value: { event: "lr-input" } },
          },
        ],
      ])
    ).to.throw(TypeError);

    const registry = createWidgetTypeRegistry([
      [
        "bound",
        {
          tag: "lr-input",
          props: { value: "string" },
          interaction: "control",
          bindings: { value: { event: "lr-input" } },
        },
      ],
    ]);
    expect(registry.get("bound")?.interaction).to.equal("control");
  });

  it("rejects duplicate type keys, unsafe property sinks and invalid bindings", () => {
    expect(() =>
      createWidgetTypeRegistry([
        ["x", { tag: "lr-a", interaction: "none" }],
        ["x", { tag: "lr-b", interaction: "none" }],
      ])
    ).to.throw(TypeError);
    expect(() =>
      createWidgetTypeRegistry([
        ["row", { tag: "lr-card", interaction: "none" }],
      ])
    ).to.throw(TypeError);
    expect(() =>
      createWidgetTypeRegistry([
        [
          "unsafe",
          {
            tag: "lr-card",
            interaction: "none",
            forcedProps: { innerHTML: "x" },
          },
        ],
      ])
    ).to.throw(TypeError);
    expect(() =>
      createWidgetTypeRegistry([
        [
          "invalid-binding",
          {
            tag: "lr-input",
            interaction: "control",
            bindings: { value: { event: "lr-input" } },
          },
        ],
      ])
    ).to.throw(TypeError);
  });

  it("supports slot allowlists and rejects invalid or duplicate slot names", () => {
    const registry = createWidgetTypeRegistry([
      [
        "card",
        {
          tag: "lr-card",
          interaction: "none",
          slots: ["header", "footer"],
        },
      ],
    ]);
    expect(registry.get("card")?.slots).to.deep.equal(["header", "footer"]);
    expect(Object.isFrozen(registry.get("card")?.slots)).to.equal(true);
    expect(() =>
      createWidgetTypeRegistry([
        ["bad", { tag: "lr-card", interaction: "none", slots: "header" as never }],
      ])
    ).to.throw(TypeError);
    expect(() =>
      createWidgetTypeRegistry([
        ["bad", { tag: "lr-card", interaction: "none", slots: [" header "] }],
      ])
    ).to.throw(TypeError);
    expect(() =>
      createWidgetTypeRegistry([
        ["bad", { tag: "lr-card", interaction: "none", slots: [""] }],
      ])
    ).to.throw(TypeError);
    expect(() =>
      createWidgetTypeRegistry([
        ["bad", { tag: "lr-card", interaction: "none", slots: [1 as never] }],
      ])
    ).to.throw(TypeError);
    expect(() =>
      createWidgetTypeRegistry([
        ["bad", { tag: "lr-card", interaction: "none", slots: ["dup", "dup"] }],
      ])
    ).to.throw(TypeError);
  });

  it("rejects empty, whitespace-padded, or non-string widget type keys", () => {
    expect(() =>
      createWidgetTypeRegistry([["", { tag: "lr-card", interaction: "none" }]])
    ).to.throw(TypeError);
    expect(() =>
      createWidgetTypeRegistry([
        [" card ", { tag: "lr-card", interaction: "none" }],
      ])
    ).to.throw(TypeError);
    expect(() =>
      createWidgetTypeRegistry([
        [1 as never, { tag: "lr-card", interaction: "none" }],
      ])
    ).to.throw(TypeError);
  });

  it("rejects empty or whitespace-padded action event names", () => {
    expect(() =>
      createWidgetTypeRegistry([
        [
          "button",
          { tag: "lr-button", interaction: "control", action: { event: "" } },
        ],
      ])
    ).to.throw(TypeError);
    expect(() =>
      createWidgetTypeRegistry([
        [
          "button",
          {
            tag: "lr-button",
            interaction: "control",
            action: { event: " click " },
          },
        ],
      ])
    ).to.throw(TypeError);
  });

  it("rejects invalid property-name patterns, event-handler-shaped names, and every forbidden property name", () => {
    for (const name of ["__proto__", "constructor", "prototype", "outerHTML"]) {
      expect(
        () =>
          createWidgetTypeRegistry([
            [
              "x",
              {
                tag: "lr-card",
                interaction: "none",
                forcedProps: { [name]: 1 },
              },
            ],
          ]),
        name
      ).to.throw(TypeError);
    }
    expect(() =>
      createWidgetTypeRegistry([
        [
          "x",
          { tag: "lr-card", interaction: "none", forcedProps: { onClick: 1 } },
        ],
      ])
    ).to.throw(TypeError);
    expect(() =>
      createWidgetTypeRegistry([
        [
          "x",
          { tag: "lr-card", interaction: "none", forcedProps: { "1bad": 1 } },
        ],
      ])
    ).to.throw(TypeError);
  });

  it("rejects non-object props, forcedProps, and bindings collections", () => {
    expect(() =>
      createWidgetTypeRegistry([
        ["x", { tag: "lr-card", interaction: "none", props: [] as never }],
      ])
    ).to.throw(TypeError);
    expect(() =>
      createWidgetTypeRegistry([
        [
          "x",
          {
            tag: "lr-card",
            interaction: "none",
            props: { bad: "symbol" as never },
          },
        ],
      ])
    ).to.throw(TypeError);
    expect(() =>
      createWidgetTypeRegistry([
        [
          "x",
          { tag: "lr-card", interaction: "none", forcedProps: [] as never },
        ],
      ])
    ).to.throw(TypeError);
    expect(() =>
      createWidgetTypeRegistry([
        [
          "x",
          {
            tag: "lr-input",
            interaction: "control",
            props: { value: "string" },
            bindings: [] as never,
          },
        ],
      ])
    ).to.throw(TypeError);
    expect(() =>
      createWidgetTypeRegistry([
        [
          "x",
          {
            tag: "lr-input",
            interaction: "control",
            props: { value: "string" },
            bindings: { value: "not-an-object" as never },
          },
        ],
      ])
    ).to.throw(TypeError);
  });

  it("rejects a non-object widget type definition and an invalid interaction value", () => {
    expect(() => createWidgetTypeRegistry([["x", null as never]])).to.throw(
      TypeError
    );
    expect(() => createWidgetTypeRegistry([["x", [] as never]])).to.throw(
      TypeError
    );
    expect(() =>
      createWidgetTypeRegistry([
        ["x", { tag: "lr-card", interaction: "weird" as never }],
      ])
    ).to.throw(TypeError);
  });

  it("exposes entries(), keys(), forEach() and Symbol.iterator alongside get/has", () => {
    const registry = createWidgetTypeRegistry([
      ["card", { tag: "lr-card", interaction: "none" as const }],
      ["badge", { tag: "lr-badge", interaction: "none" as const }],
    ]);
    expect([...registry.keys()]).to.deep.equal(["card", "badge"]);
    expect([...registry.entries()].map(([key]) => key)).to.deep.equal([
      "card",
      "badge",
    ]);
    expect([...registry].map(([key]) => key)).to.deep.equal(["card", "badge"]);

    const seen: string[] = [];
    const thisArg = { tag: "marker" };
    registry.forEach(function (this: typeof thisArg, _value, key) {
      expect(this).to.equal(thisArg);
      seen.push(key);
    }, thisArg);
    expect(seen).to.deep.equal(["card", "badge"]);
  });

  it("rejects null, primitives and plain objects lacking the registry brand", () => {
    expect(isWidgetTypeRegistry(null)).to.equal(false);
    expect(isWidgetTypeRegistry(undefined)).to.equal(false);
    expect(isWidgetTypeRegistry("registry")).to.equal(false);
    expect(isWidgetTypeRegistry({})).to.equal(false);
  });
});
