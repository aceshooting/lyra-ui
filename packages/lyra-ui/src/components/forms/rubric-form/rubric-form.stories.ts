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

/** 320px container — the single-column field stack needs no special narrow handling. */
export const Narrow: Story = {
  render: () => html`<lr-rubric-form style="max-width: 320px" .keys=${keys}></lr-rubric-form>`,
};
