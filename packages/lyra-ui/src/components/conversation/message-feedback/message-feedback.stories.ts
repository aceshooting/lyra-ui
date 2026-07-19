import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './message-feedback.js';

const meta: Meta = {
  title: 'MessageFeedback',
  component: 'lr-message-feedback',
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
  render: () => html`<lr-message-feedback></lr-message-feedback>`,
};

export const WithReasonsAndComment: Story = {
  render: () => html`
    <lr-message-feedback
      .reasons=${[
        { id: 'wrong', label: 'Factually wrong' },
        { id: 'unhelpful', label: 'Not helpful' },
        { id: 'unsafe', label: 'Unsafe or harmful' },
      ]}
      commentable
    ></lr-message-feedback>
  `,
};

/** `detail-for="both"` opens the reason/comment panel for either thumb, not just the down one. */
export const DetailOnBothThumbs: Story = {
  render: () => html`
    <lr-message-feedback
      detail-for="both"
      .reasons=${[
        { id: 'accurate', label: 'Accurate' },
        { id: 'creative', label: 'Creative' },
      ]}
      commentable
    ></lr-message-feedback>
  `,
};

/** A host reflecting a previously-recorded rating back read-only: `value` set, `disabled` set. */
export const RecordedReadOnly: Story = {
  render: () => html`<lr-message-feedback value="up" disabled></lr-message-feedback>`,
};

/** 320px container — the panel already stacks in a flex column and the comment field is
 *  full-width by construction, so it fits with no horizontal overflow. */
export const Narrow320px: Story = {
  render: () => html`
    <div style="max-width:320px;border:1px dashed var(--lr-color-border);padding:8px;">
      <lr-message-feedback
        .reasons=${[
          { id: 'wrong', label: 'Factually wrong' },
          { id: 'unhelpful', label: 'Not helpful' },
        ]}
        commentable
      ></lr-message-feedback>
    </div>
  `,
};
