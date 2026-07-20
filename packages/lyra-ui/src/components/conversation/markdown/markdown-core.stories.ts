import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import tsGrammar from 'shiki/langs/typescript.mjs';
import './markdown-core.js';

const meta: Meta = {
  title: 'MarkdownCore',
  component: 'lr-markdown-core',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A build-lean variant of `lr-markdown` for a consumer whose `languages` map already ' +
          "covers every language it renders. Unlike `lr-markdown`'s runtime `languagesOnly` flag " +
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
    <lr-markdown-core
      .languages=${{ typescript: tsGrammar }}
      content=${sample}
      style="max-width: 32rem;"
    ></lr-markdown-core>
  `,
};

export const LanguageNotInMap: Story = {
  name: 'Language absent from the languages map (always plain text)',
  render: () => html`
    <lr-markdown-core
      .languages=${{}}
      content=${'```python\nprint("no python grammar was supplied")\n```'}
      style="max-width: 32rem;"
    ></lr-markdown-core>
  `,
};

export const TabWidth: Story = {
  name: 'Tab width (--lr-code-block-tab-size)',
  parameters: {
    docs: {
      description: {
        story:
          'The same `--lr-code-block-tab-size` token `lr-code-block` and `lr-code-editor` use, re-declared here because those are sibling elements rather than ancestors. A markdown code block wraps (`pre-wrap`), so at the same value a wrapped line can still look different from `lr-code-block`.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:0.75rem; max-width:32rem;">
      <lr-markdown-core .languages=${{}} content=${'```\n\tone tab\n\t\ttwo tabs\n```'}></lr-markdown-core>
      <lr-markdown-core
        .languages=${{}}
        content=${'```\n\tone tab\n\t\ttwo tabs\n```'}
        style="--lr-code-block-tab-size: 8"
      ></lr-markdown-core>
    </div>
  `,
};
