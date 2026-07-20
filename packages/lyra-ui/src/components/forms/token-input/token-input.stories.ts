import type { Meta, StoryObj } from '@storybook/web-components-vite'; import { html } from 'lit'; import './token-input.js';
const meta: Meta = { title: 'Token Input', component: 'lr-token-input', tags: ['autodocs'] }; export default meta; type Story = StoryObj;
export const Default: Story = { render: () => html`<lr-token-input label="Recipients" placeholder="Add a recipient…" .value=${['Ada', 'Grace']}></lr-token-input>` };
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
