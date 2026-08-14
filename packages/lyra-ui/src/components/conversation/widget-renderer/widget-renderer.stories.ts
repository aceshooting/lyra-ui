import { html } from "lit";
import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../../forms/input/input.js";
import { tag } from "../../../internal/prefix.js";
import "./widget-renderer.js";
import { createWidgetDocument, type WidgetNode } from "./resolve.js";
import { createWidgetTypeRegistry } from "./registry.js";
import type { LyraWidgetRenderer } from "./widget-renderer.js";

const meta: Meta = {
  title: "Widget Renderer",
  component: "lr-widget-renderer",
};
export default meta;
type Story = StoryObj;

const dashboard: WidgetNode = {
  type: "col",
  props: { gap: "m" },
  children: [
    {
      type: "row",
      props: { gap: "m" },
      children: [
        { type: "stat", props: { label: "Users", value: "1,204" } },
        {
          type: "stat",
          props: { label: "Errors", value: "3", variant: "danger" },
        },
      ],
    },
    {
      type: "button",
      id: "refresh-dashboard",
      props: { variant: "brand" },
      actionId: "refresh",
      children: ["Refresh"],
    },
  ],
};
const narrowUnbrokenWidgetText = "WidgetPayloadWithoutNaturalBreaks".repeat(10);
const narrowRtlTree: WidgetNode = {
  type: "row",
  props: { gap: "m" },
  children: [
    narrowUnbrokenWidgetText,
    {
      type: "stat",
      props: {
        label: narrowUnbrokenWidgetText,
        value: narrowUnbrokenWidgetText,
      },
    },
  ],
};

const unsafeTree: WidgetNode = {
  type: "row",
  children: [
    { type: "evil-widget", props: { onclick: "alert(1)" } },
    { type: "stat", props: { label: "Still renders", value: "safely" } },
  ],
};

export const Default: Story = {
  render: () =>
    html`<lr-widget-renderer
      style="display:block;max-width:32rem"
      .document=${createWidgetDocument(dashboard)}
    ></lr-widget-renderer>`,
};

export const SecurityAllowlistDemo: Story = {
  render: () =>
    html`<lr-widget-renderer
      style="display:block;max-width:32rem"
      .document=${createWidgetDocument(unsafeTree)}
    ></lr-widget-renderer>`,
};

/** Replaces a valid tree with malformed streamed data. The prior stat is cleared and one
 * `lr-render-error` is reported instead of letting the resolver throw. */
export const MalformedTreeFailsClosed: Story = {
  render: () => html`
    <div
      data-malformed-tree
      style="display:grid;gap:var(--lr-space-s);max-width:32rem"
    >
      <button
        type="button"
        @click=${(event: Event) => {
          const wrapper = (
            event.currentTarget as HTMLElement
          ).closest<HTMLElement>("[data-malformed-tree]");
          const renderer =
            wrapper?.querySelector<LyraWidgetRenderer>("lr-widget-renderer");
          if (renderer)
            renderer.document = createWidgetDocument({
              type: "row",
              children: [null],
            } as unknown as WidgetNode);
        }}
      >
        Stream malformed tree
      </button>
      <lr-widget-renderer
        .document=${createWidgetDocument({
          type: "stat",
          props: { label: "Prior valid tree", value: "Rendered" },
        })}
        @lr-render-error=${(event: CustomEvent<{ error: Error }>) => {
          const output = (event.currentTarget as HTMLElement)
            .nextElementSibling;
          if (output instanceof HTMLOutputElement)
            output.textContent = "Malformed tree rejected";
        }}
      ></lr-widget-renderer>
      <output aria-live="polite">Waiting for malformed input</output>
    </div>
  `,
};

/**
 * Each click supplies a fresh unknown type plus one safe stat. The unknown subtree stays absent;
 * warning dedupe keys are scoped to that current tree generation rather than retained forever.
 */
export const StreamedUnknownTypeGenerations: Story = {
  render: () => html`
    <div
      data-warning-generation
      style="display:grid;gap:var(--lr-space-s);max-width:32rem"
    >
      <button
        type="button"
        @click=${(event: Event) => {
          const wrapper = (
            event.currentTarget as HTMLElement
          ).closest<HTMLElement>("[data-warning-generation]");
          const renderer =
            wrapper?.querySelector<LyraWidgetRenderer>("lr-widget-renderer");
          if (!wrapper || !renderer) return;
          const generation = Number(wrapper.dataset["generation"] ?? "0") + 1;
          wrapper.dataset["generation"] = String(generation);
          renderer.document = createWidgetDocument({
            type: "row",
            children: [
              { type: `unknown-generation-${generation}` },
              {
                type: "stat",
                props: {
                  label: "Accepted generation",
                  value: String(generation),
                },
              },
            ],
          });
        }}
      >
        Stream a fresh tree
      </button>
      <lr-widget-renderer
        .document=${createWidgetDocument(unsafeTree)}
      ></lr-widget-renderer>
    </div>
  `,
};

export const ControlledDocumentBinding: Story = {
  render: () => {
    const registry = createWidgetTypeRegistry([
      [
        "bound-input",
        {
          tag: tag("input"),
          props: { label: "string", value: "string" },
          interaction: "control",
          bindings: { value: { event: "lr-input" } },
        },
      ],
    ]);
    const widgetDocument = createWidgetDocument({
      type: "bound-input",
      id: "name",
      props: { label: "Name", value: { $bind: "/name", fallback: "" } },
    });
    const initialBindingState = { name: "Ada" };
    const handleStateChange = (
      event: CustomEvent<{
        path: string;
        value: unknown;
        nodeId: string;
        nodeKey: string;
        nodePath: string;
        prop: string;
      }>
    ): void => {
      const renderer = event.currentTarget as LyraWidgetRenderer;
      renderer.bindingState = { name: event.detail.value };
      const output = renderer.nextElementSibling;
      if (output instanceof HTMLOutputElement) {
        output.textContent = JSON.stringify(event.detail);
      }
    };

    return html`
      <div style="display:grid;gap:var(--lr-space-s);max-width:32rem">
        <lr-widget-renderer
          .document=${widgetDocument}
          .bindingState=${initialBindingState}
          .registry=${registry}
          @lr-widget-state-change=${handleStateChange}
        ></lr-widget-renderer>
        <output aria-live="polite"
          >Edit the field to request a controlled state update.</output
        >
      </div>
    `;
  },
};

export const Narrow320: Story = {
  name: "Narrow RTL (320px, long content)",
  render: () =>
    html`<div dir="rtl" style="inline-size:320px;max-inline-size:100%">
      <lr-widget-renderer
        style="display:block"
        .document=${createWidgetDocument(narrowRtlTree)}
      ></lr-widget-renderer>
    </div>`,
};
