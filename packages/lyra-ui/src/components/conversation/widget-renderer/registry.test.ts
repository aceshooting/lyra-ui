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
});
