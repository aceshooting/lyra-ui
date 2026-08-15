import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { RubricKey, RubricValue } from './rubric-form.js';

const keys: RubricKey[] = [
  {
    key: 'accuracy',
    type: 'score',
    label: 'Accuracy',
    description: 'Is the answer factually correct?',
    min: 0,
    max: 5,
    step: 1,
    required: true,
  },
  { key: 'helpfulness', type: 'score', label: 'Helpfulness', min: 0, max: 100, step: 1 },
  {
    key: 'issue',
    type: 'category',
    label: 'Issue category',
    multiple: true,
    options: [
      { value: 'hallucination', label: 'Hallucination' },
      { value: 'tone', label: 'Tone' },
      { value: 'formatting', label: 'Formatting' },
    ],
  },
  { key: 'comment', type: 'comment', label: 'Notes', placeholder: 'Optional reviewer notes' },
];

const requiredMarkerKeys = keys.map((key) => ({ ...key, required: true }));

const meta: Meta = {
  title: 'Observability/Rubric Form',
  component: 'lr-rubric-form',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-rubric-form style="max-width: 28rem" .keys=${keys}></lr-rubric-form>`,
};

export const RequiredMarkerTheme: Story = {
  name: 'Shared required-marker theme',
  render: () => html`
    <lr-rubric-form
      style="max-inline-size: var(--lr-size-28rem); --lr-form-control-required-content: ' (required)'"
      .keys=${requiredMarkerKeys}
    ></lr-rubric-form>
  `,
};

/** Native form reset restores the explicit canonical default. Later live edits do not rewrite it. */
export const FormResetBaseline: Story = {
  render: () => html`
    <form style="display: grid; gap: var(--lr-space-m); max-inline-size: var(--lr-size-28rem);">
      <lr-rubric-form
        name="review"
        .keys=${keys}
        .defaultValue=${{ accuracy: 4, comment: 'Seeded review' } satisfies RubricValue}
      ></lr-rubric-form>
      <button type="reset" style="justify-self: start;">Reset to seeded review</button>
    </form>
  `,
};

/** External values are normalized against the schema before any consumer-facing projection. */
export const CanonicalValueNormalization: Story = {
  render: () => html`
    <lr-rubric-form
      label="Canonical value normalization"
      hint="The supplied score 999 clamps to 5; the unknown category is omitted and remains required."
      style="max-inline-size: var(--lr-size-28rem)"
      .keys=${keys}
      .value=${{ accuracy: 999, issue: 'not-an-option', undeclared: 'discarded' } as RubricValue}
    ></lr-rubric-form>
  `,
};

/** Aggregate form chrome names and describes the complete rubric independently from each field's
 * own label, hint, and error. The error property also demonstrates the region used by a blocking
 * `setCustomValidity()` message when `error-text` is empty. */
export const AggregateFormChrome: Story = {
  render: () => html`
    <lr-rubric-form
      label="Response-quality review"
      error-text="Resolve the review-policy conflict before submitting."
      style="max-inline-size: var(--lr-size-28rem)"
      .keys=${keys}
    >
      <span slot="hint">Complete every required dimension, then submit the aggregate review.</span>
    </lr-rubric-form>
  `,
};

export const EffectiveValidityEvents: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The log receives frozen, deduplicated effective-validity snapshots. A consumer custom error appears under `errors.base`; disabling the control bars native validation and publishes `{ valid: true, errors: {} }`.',
      },
    },
  },
  render: () => {
    const controlFor = (event: Event) =>
      (event.currentTarget as HTMLElement)
        .closest('.demo')!
        .querySelector('lr-rubric-form') as HTMLElement & {
        disabled: boolean;
        setCustomValidity(message: string): void;
      };
    const showSnapshot = (event: CustomEvent) => {
      const output = (event.currentTarget as HTMLElement)
        .closest('.demo')!
        .querySelector('output')!;
      output.textContent = JSON.stringify(event.detail);
    };
    return html`
      <div class="demo" style="display: grid; gap: var(--lr-space-m); max-inline-size: var(--lr-size-28rem)">
        <lr-rubric-form
          .keys=${keys}
          .value=${{ accuracy: 4 }}
          @lr-validity-change=${showSnapshot}
        ></lr-rubric-form>
        <div style="display: flex; flex-wrap: wrap; gap: var(--lr-space-xs)">
          <button type="button" @click=${(event: Event) => controlFor(event).setCustomValidity('Rejected by policy.')}>
            Set custom error
          </button>
          <button type="button" @click=${(event: Event) => controlFor(event).setCustomValidity('')}>
            Clear custom error
          </button>
          <button type="button" @click=${(event: Event) => {
            const control = controlFor(event);
            control.disabled = !control.disabled;
          }}>
            Toggle disabled
          </button>
        </div>
        <output aria-live="polite"></output>
      </div>
    `;
  },
};

export const IndependentActionTheme: Story = {
  name: 'Independent submit and skip themes',
  render: () => html`
    <lr-rubric-form
      skippable
      style="max-inline-size: var(--lr-size-28rem); --lr-rubric-form-submit-bg: var(--lr-color-success); --lr-rubric-form-submit-border-color: var(--lr-color-success); --lr-rubric-form-submit-color: var(--lr-color-on-success); --lr-rubric-form-submit-hover-bg: var(--lr-color-warning); --lr-rubric-form-submit-active-bg: var(--lr-color-danger); --lr-rubric-form-skip-hover-bg: var(--lr-color-warning-quiet); --lr-rubric-form-skip-active-bg: var(--lr-color-danger-quiet);"
      .keys=${keys}
    ></lr-rubric-form>
  `,
};

/** A submit-and-next flow for working through a queue of items: `has-next` and `skippable` are
 *  set, and each `lr-submit`/`lr-skip` advances to the next item by resetting `value` and
 *  changing `item-id` (which also resets which fields have been visited/error-revealed). */
export const QueueFlow: Story = {
  render: () => {
    let value: RubricValue = {};
    let itemId = 'item-1';
    const getEl = () => document.getElementById('queue-rubric') as HTMLElement & { value: RubricValue; itemId: string };
    return html`
      <lr-rubric-form
        id="queue-rubric"
        style="max-width: 28rem"
        .keys=${keys}
        .value=${value}
        item-id=${itemId}
        has-next
        skippable
        @lr-submit=${(e: CustomEvent<{ value: RubricValue; itemId: string }>) => {
          console.log('submitted', e.detail);
          value = {};
          itemId = itemId === 'item-1' ? 'item-2' : 'item-1';
          const el = getEl();
          el.value = value;
          el.itemId = itemId;
        }}
        @lr-skip=${() => {
          value = {};
          itemId = itemId === 'item-1' ? 'item-2' : 'item-1';
          const el = getEl();
          el.value = value;
          el.itemId = itemId;
        }}
      ></lr-rubric-form>
    `;
  },
};

export const Empty: Story = {
  render: () => html`<lr-rubric-form style="max-width: 28rem"></lr-rubric-form>`,
};

/** Exact-320px long/localized allocation in both directions. */
export const Narrow: Story = {
  name: 'Narrow long content LTR/RTL (320px)',
  render: () => {
    const label = 'InternationalizedRubricContentWithoutAnyNaturalBreakOpportunity';
    const narrowKeys: RubricKey[] = [
      { key: 'comment', type: 'comment', label, description: label, placeholder: label },
    ];
    return html`
      <div style="display: grid; gap: var(--lr-space-m)">
        ${(['ltr', 'rtl'] as const).map(
          (direction) => html`
            <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%">
              <lr-rubric-form
                skippable
                .keys=${narrowKeys}
                .strings=${{ rubricSubmit: label, rubricSkip: label }}
              ></lr-rubric-form>
            </div>
          `,
        )}
      </div>
    `;
  },
};

export const LocalizedScores: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Arabic-Egyptian digits are used consistently by compact segmented and wide slider score branches while submitted values stay numeric.',
      },
    },
  },
  render: () => html`
    <lr-rubric-form
      dir="rtl"
      locale="ar-EG"
      style="max-inline-size: var(--lr-size-28rem)"
      .keys=${[
        { key: 'compact', type: 'score', label: 'تقييم مختصر', min: 0, max: 5, step: 1 },
        { key: 'wide', type: 'score', label: 'تقييم تفصيلي', min: 0, max: 2000, step: 1 },
      ] satisfies RubricKey[]}
      .value=${{ compact: 3, wide: 1234 }}
    ></lr-rubric-form>
  `,
};
