import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html } from 'lit'; import './token-input.js'; import type { LyraTokenInputSize } from './token-input.class.js';
const meta: Meta = { title: 'Token Input', component: 'lr-token-input', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Default: Story = { render: () => html`<lr-token-input label="Recipients" placeholder="Add a recipient…" .value=${['Ada', 'Grace']}></lr-token-input>` };
/**
 * The `size` property scales the input-wrapper's row height across six tiers, matching `lr-input`'s
 * own height ladder (`2xs`–`xl`), and automatically adjusts padding and text size to stay visually
 * balanced at each tier. The remove button's hit area stays fixed at `40px` across all sizes.
 */
export const Sizes: Story = {
  render: () => {
    const sizes: LyraTokenInputSize[] = ['2xs', 'xs', 's', 'm', 'l', 'xl'];
    return html`
      <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 20rem">
        ${sizes.map(
          (size) => html`
            <lr-token-input
              size=${size}
              label=${`Size "${size}"`}
              placeholder="Add a token…"
              .value=${['Token A', 'Token B']}
            ></lr-token-input>
          `,
        )}
      </div>
    `;
  },
};
/**
 * `editable` turns every token into a roving tab stop that opens an inline editor on click, Enter,
 * or F2 — Enter commits and emits `lr-token-edit`, Escape reverts. `.delimiter=${null}` keeps
 * commas (and every other character) inside a token instead of splitting it, which is what a rule
 * like `Bash(git status:*)` needs.
 */
export const Editable: Story = {
  render: () => html`<lr-token-input
    label="Permission rules"
    hint="Click a rule to edit it in place. Enter commits, Escape reverts."
    placeholder="Add a rule…"
    editable
    .delimiter=${null}
    .value=${['Bash(git status:*)', 'Read(src/**)', 'WebFetch(domain:example.com)']}
    @lr-token-edit=${(event: CustomEvent<{ value: string; previousValue: string; index: number }>) =>
      console.log('lr-token-edit', event.detail)}
  ></lr-token-input>`,
};
