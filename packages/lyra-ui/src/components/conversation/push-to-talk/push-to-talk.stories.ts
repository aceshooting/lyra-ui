import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './push-to-talk.js';
import { storyColor } from '../../../../../../.storybook/story-theme.js';

const meta: Meta = {
  title: 'Push To Talk',
  component: 'lr-push-to-talk',
};
export default meta;
type Story = StoryObj;

export const Hold: Story = {
  render: () => html`<lr-push-to-talk mode="hold"></lr-push-to-talk>`,
};

export const Toggle: Story = {
  render: () => html`<lr-push-to-talk mode="toggle"></lr-push-to-talk>`,
};

export const WithLevelEventsAndMaxDuration: Story = {
  render: () => html`
    <lr-push-to-talk mode="toggle" level-events max-duration-ms="30000"
      @lr-level=${(e: CustomEvent<{ level: number }>) => console.log('level', e.detail.level)}
    ></lr-push-to-talk>
  `,
};

export const Disabled: Story = {
  render: () => html`<lr-push-to-talk disabled></lr-push-to-talk>`,
};

export const Narrow320: Story = {
  render: () => html`
    <div style="max-inline-size: 320px; border: 1px dashed var(--lr-color-border); padding: 8px;">
      <lr-push-to-talk mode="toggle"></lr-push-to-talk>
    </div>
  `,
};

export const ThemedRecording: Story = {
  name: 'Themed recording state (cssprop)',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-push-to-talk-recording-color` recolors the recording trigger’s border and glyph on its own. Set it on the element or any ancestor — it is not declared on `:host`, so an ancestor value is never shadowed, and unlike hijacking `--lr-color-danger` it leaves every other danger-toned surface on the page alone. The `data-state` attribute is set here to show the treatment without a live microphone.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; gap: 24px; --lr-push-to-talk-recording-color: ${storyColor('brand')};">
      <lr-push-to-talk mode="toggle" data-state="recording"></lr-push-to-talk>
      <lr-push-to-talk mode="toggle"></lr-push-to-talk>
    </div>
  `,
};
