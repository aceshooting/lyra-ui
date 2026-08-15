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
          'Thumbs up/down for one assistant message, with an optional inline detail step (reason chips + comment) and one cancelable terminal persistence transaction. The detail record and reasons are a bounded clone-owned frozen snapshot; create and reassign a new detail record after changes.',
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
      .detail=${{
        reasons: [
          { id: 'wrong', label: 'Factually wrong' },
          { id: 'unhelpful', label: 'Not helpful' },
          { id: 'unsafe', label: 'Unsafe or harmful' },
        ],
        commentable: true,
      }}
    ></lr-message-feedback>
  `,
};

export const AsyncPersistenceHold: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'This listener prevents `lr-feedback-submit`, placing the component in its reflected pending state without closing or announcing success. A real host calls `finalizePendingSubmit()` after persistence succeeds or `revertPendingSubmit()` after it fails.',
      },
    },
  },
  render: () => html`
    <lr-message-feedback
      .detail=${{ reasons: reasonsForStory, commentable: true }}
      @lr-feedback-submit=${(event: Event) => event.preventDefault()}
    ></lr-message-feedback>
  `,
};

/** `detail-for="both"` opens the reason/comment panel for either thumb, not just the down one. */
export const DetailOnBothThumbs: Story = {
  render: () => html`
    <lr-message-feedback
      detail-for="both"
      .detail=${{
        reasons: [
          { id: 'accurate', label: 'Accurate' },
          { id: 'creative', label: 'Creative' },
        ],
        commentable: true,
      }}
    ></lr-message-feedback>
  `,
};

/** A host reflecting a previously-recorded `rating` back read-only with `disabled`. */
export const RecordedReadOnly: Story = {
  render: () => html`<lr-message-feedback rating="up" disabled></lr-message-feedback>`,
};

/** 320px container — the panel already stacks in a flex column and the comment field is
 *  full-width by construction, so it fits with no horizontal overflow. */
export const Narrow320px: Story = {
  render: () => html`
    <div style="max-width:320px;border:1px dashed var(--lr-color-border);padding:8px;">
      <lr-message-feedback
        .detail=${{
          reasons: [
            { id: 'wrong', label: 'Factually wrong' },
            { id: 'unhelpful', label: 'Not helpful' },
          ],
          commentable: true,
        }}
      ></lr-message-feedback>
    </div>
  `,
};

const reasonsForStory = [
  { id: 'wrong', label: 'Factually wrong' },
  { id: 'unhelpful', label: 'Not helpful' },
];
