import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './message-feedback.js';

const meta: Meta = {
  title: 'MessageFeedback',
  component: 'lyra-message-feedback',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Thumbs up/down for one assistant message, with an optional inline detail step (reason chips + comment). Emits; never persists.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const ThumbsOnly: Story = {
  render: () => html`<lyra-message-feedback></lyra-message-feedback>`,
};

export const WithReasonsAndComment: Story = {
  render: () => html`
    <lyra-message-feedback
      .reasons=${[
        { id: 'wrong', label: 'Factually wrong' },
        { id: 'unhelpful', label: 'Not helpful' },
        { id: 'unsafe', label: 'Unsafe or harmful' },
      ]}
      commentable
    ></lyra-message-feedback>
  `,
};

/** `detail-for="both"` opens the reason/comment panel for either thumb, not just the down one. */
export const DetailOnBothThumbs: Story = {
  render: () => html`
    <lyra-message-feedback
      detail-for="both"
      .reasons=${[
        { id: 'accurate', label: 'Accurate' },
        { id: 'creative', label: 'Creative' },
      ]}
      commentable
    ></lyra-message-feedback>
  `,
};

/** A host reflecting a previously-recorded rating back read-only: `value` set, `disabled` set. */
export const RecordedReadOnly: Story = {
  render: () => html`<lyra-message-feedback value="up" disabled></lyra-message-feedback>`,
};

/** 320px container — the panel already stacks in a flex column and the comment field is
 *  full-width by construction, so it fits with no horizontal overflow. */
export const Narrow320px: Story = {
  render: () => html`
    <div style="max-width:320px;border:1px dashed #ccc;padding:8px;">
      <lyra-message-feedback
        .reasons=${[
          { id: 'wrong', label: 'Factually wrong' },
          { id: 'unhelpful', label: 'Not helpful' },
        ]}
        commentable
      ></lyra-message-feedback>
    </div>
  `,
};
