import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import tsGrammar from 'shiki/langs/typescript.mjs';
import './markdown-core.js';

const meta: Meta = {
  title: 'MarkdownCore',
  component: 'lyra-markdown-core',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A build-lean variant of `lyra-markdown` for a consumer whose `languages` map already ' +
          "covers every language it renders. Unlike `lyra-markdown`'s runtime `languagesOnly` flag " +
          "-- a check a bundler can't prove always-true -- this component's own module never " +
          "references shiki's full ~200-language default entry point at all, so importing it gives " +
          'a genuine compile-time exclusion of that table from the build output. A fenced-block ' +
          'language absent from `languages` always renders the plain-text fallback.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const sample = `# Build-lean Markdown

\`\`\`typescript
export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}
\`\`\`
`;

export const Default: Story = {
  render: () => html`
    <lyra-markdown-core
      .languages=${{ typescript: tsGrammar }}
      content=${sample}
      style="max-width: 32rem;"
    ></lyra-markdown-core>
  `,
};

export const LanguageNotInMap: Story = {
  name: 'Language absent from the languages map (always plain text)',
  render: () => html`
    <lyra-markdown-core
      .languages=${{}}
      content=${'```python\nprint("no python grammar was supplied")\n```'}
      style="max-width: 32rem;"
    ></lyra-markdown-core>
  `,
};
