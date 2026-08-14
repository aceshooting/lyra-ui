import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import "./stepper.js";
import type { LyraStepItem } from "./stepper.js";
import { storyColor } from "../../../../../../.storybook/theme-contract.js";

const wizardSteps: LyraStepItem[] = [
  { id: "account", label: "Account", state: "completed" },
  { id: "profile", label: "Profile", state: "completed" },
  { id: "plan", label: "Plan", state: "current" },
  { id: "payment", label: "Payment", state: "pending" },
  { id: "confirm", label: "Confirm", state: "pending", disabled: true },
];

const errorSteps: LyraStepItem[] = [
  { id: "account", label: "Account", state: "completed" },
  { id: "profile", label: "Profile", state: "error" },
  { id: "plan", label: "Plan", state: "pending" },
  { id: "payment", label: "Payment", state: "pending", disabled: true },
];

const lockedStepsWithTitle: LyraStepItem[] = [
  { id: "account", label: "Account", state: "current" },
  {
    id: "profile",
    label: "Profile",
    state: "pending",
    disabled: true,
    title: "Complete Account first",
  },
  {
    id: "plan",
    label: "Plan",
    state: "pending",
    disabled: true,
    title: "Complete Account first",
  },
];

const longLabelSteps: LyraStepItem[] = [
  {
    id: "account",
    label: "Account and organization details",
    state: "completed",
  },
  {
    id: "profile",
    label: "Profile and notification preferences",
    state: "current",
  },
  {
    id: "review",
    label: "Review and confirm everything before submitting",
    state: "pending",
  },
];

const meta: Meta = {
  title: "Stepper",
  component: "lr-stepper",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "An ordered multi-step wizard/form navigation strip: label + index per step, independent pending/current/completed/error progress and disabled availability, click-to-jump. Fully data-driven and controlled -- like `lr-table`, it never mutates its own `steps`; a click or Enter/Space on a non-disabled step fires a (non-cancelable) `lr-step-select` event and the host decides whether/how `steps` changes in response.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Horizontal: Story = {
  render: () => html`<lr-stepper .steps=${wizardSteps}></lr-stepper>`,
};

export const Vertical: Story = {
  render: () =>
    html`<lr-stepper
      orientation="vertical"
      .steps=${wizardSteps}
    ></lr-stepper>`,
};

export const WrappedVerticalLabels: Story = {
  name: "Wrapped vertical labels",
  render: () => html`
    <div style="inline-size: 12rem">
      <lr-stepper
        orientation="vertical"
        wrap-labels
        .steps=${longLabelSteps}
      ></lr-stepper>
    </div>
  `,
  parameters: {
    docs: {
      description: {
        story:
          "Set `wrap-labels` to allow long labels to wrap when the stepper is vertical. Horizontal labels remain single-line.",
      },
    },
  },
};

export const NarrowLongLabels: Story = {
  name: "Long unbroken labels at 320px (LTR / RTL)",
  parameters: {
    docs: {
      description: {
        story:
          "At an exact 320px allocation, vertical wrap-labels steppers break long unbroken labels without widening their container in either text direction.",
      },
    },
  },
  render: () => {
    const longLabel =
      "AnExtremelyLongUnbrokenLocalizedStepperLabelThatMustRemainContained".repeat(
        4
      );
    const narrowSteps: LyraStepItem[] = [
      { id: "account", label: longLabel, state: "completed" },
      { id: "review", label: longLabel, state: "current" },
    ];
    return html`
      <div style="display: grid; gap: var(--lr-space-l);">
        ${(["ltr", "rtl"] as const).map(
          (direction) => html`
            <div
              dir=${direction}
              style="inline-size: 320px; max-inline-size: 100%;"
            >
              <lr-stepper
                orientation="vertical"
                wrap-labels
                style="inline-size: 100%;"
                .steps=${narrowSteps}
              ></lr-stepper>
            </div>
          `
        )}
      </div>
    `;
  },
};

export const WithError: Story = {
  render: () => html`<lr-stepper .steps=${errorSteps}></lr-stepper>`,
};

/** Hovered, pressed, current, and error step treatments — plus the current index chip — each have
 *  their own inherited CSS hook. None is declared on the host, so a wrapper can recolor one state
 *  without hijacking shared brand, text, or danger tokens. */
export const ThemedStates: Story = {
  name: "Themed states (cssprops)",
  parameters: {
    docs: {
      description: {
        story:
          "Set the --lr-stepper-hover-* and --lr-stepper-active-* hooks alongside the current/error hooks on the element or any ancestor. Hover or press a completed step to see those interaction states remain independent.",
      },
    },
  },
  render: () => html`
    <div
      style="--lr-stepper-hover-bg: ${storyColor(
        "warningQuiet"
      )}; --lr-stepper-hover-color: ${storyColor(
        "warning"
      )}; --lr-stepper-active-bg: ${storyColor(
        "successQuiet"
      )}; --lr-stepper-active-color: ${storyColor(
        "success"
      )}; --lr-stepper-current-color: ${storyColor(
        "success"
      )}; --lr-stepper-current-index-bg: ${storyColor(
        "success"
      )}; --lr-stepper-current-index-color: ${storyColor(
        "onBrand"
      )}; --lr-stepper-error-color: ${storyColor("warning")};"
    >
      <lr-stepper
        .steps=${[
          { id: "account", label: "Account", state: "completed" },
          { id: "profile", label: "Profile", state: "error" },
          { id: "plan", label: "Plan", state: "current" },
          { id: "confirm", label: "Confirm", state: "pending" },
        ] as LyraStepItem[]}
      ></lr-stepper>
    </div>
  `,
};

export const LockedStepWithTitle: Story = {
  render: () => html`<lr-stepper .steps=${lockedStepsWithTitle}></lr-stepper>`,
  parameters: {
    docs: {
      description: {
        story:
          "A locked step can set `title` to explain why it's disabled -- hover a disabled step to see the native browser tooltip.",
      },
    },
  },
};

export const StepSelectEvent: Story = {
  render: () => html`
    <div>
      <lr-stepper
        .steps=${wizardSteps}
        @lr-step-select=${(e: CustomEvent<{ index: number; id: string }>) => {
          const out = document.getElementById("stepper-select-log");
          if (out)
            out.textContent = `Selected step: ${e.detail.id} (index ${e.detail.index})`;
        }}
      ></lr-stepper>
      <p id="stepper-select-log">Selected step: (none yet)</p>
    </div>
  `,
};

export const ResponsiveOrientation: Story = {
  render: () => html`
    <div
      style="resize: horizontal; overflow: hidden; inline-size: 100%; min-inline-size: 8rem; max-inline-size: 100%; border: 1px dashed var(--lr-color-border); padding: 0.5rem;"
    >
      <p
        style="margin: 0 0 0.5rem; font: 12px sans-serif; color: var(--lr-color-text-quiet)"
      >
        Drag this box's bottom-right corner to shrink it below 500px — the
        stepper switches to a vertical strip (<code
          >orientation-breakpoint="500" narrow-orientation="vertical"</code
        >) even though the surrounding page is wide. Mirrors
        <code>lr-multi-split</code>'s identically-named contract. Add
        <code>orientation-breakpoint-basis="viewport"</code> to key off the
        viewport via <code>matchMedia</code> instead of the stepper's own width
        — necessary when the stepper has a fixed width in a row that stacks at a
        shared breakpoint.
      </p>
      <lr-stepper
        orientation-breakpoint="500"
        narrow-orientation="vertical"
        .steps=${wizardSteps}
        @lr-stepper-orientation-change=${(
          e: CustomEvent<{ orientation: string }>
        ) => console.log("lr-stepper-orientation-change", e.detail.orientation)}
      ></lr-stepper>
    </div>
  `,
};

export const ResponsiveOrientationRem: Story = {
  render: () => html`
    <div
      style="resize: horizontal; overflow: hidden; inline-size: 100%; min-inline-size: 8rem; max-inline-size: 100%; border: 1px dashed var(--lr-color-border); padding: 0.5rem;"
    >
      <p
        style="margin: 0 0 0.5rem; font: 12px sans-serif; color: var(--lr-color-text-quiet)"
      >
        The same breakpoint authored as a CSS length —
        <code>orientation-breakpoint="31.25rem"</code> — which is 500px at the
        default 16px root font size. <code>rem</code> resolves against the
        <strong>document root</strong>, exactly as it does in a CSS
        <code>@media</code> query (not against the stepper), so this stays in
        step with a sibling <code>@media (max-width: 31.25rem)</code> rule even
        when the root font size changes; it is re-resolved on every measurement,
        never cached. <code>px</code> and <code>em</code> lengths and the
        historical bare number all still work.
      </p>
      <lr-stepper
        orientation-breakpoint="31.25rem"
        narrow-orientation="vertical"
        .steps=${wizardSteps}
        @lr-stepper-orientation-change=${(
          e: CustomEvent<{ orientation: string }>
        ) => console.log("lr-stepper-orientation-change", e.detail.orientation)}
      ></lr-stepper>
    </div>
  `,
};
