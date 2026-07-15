import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import jsonGrammar from 'shiki/langs/json.mjs';
import tsGrammar from 'shiki/langs/typescript.mjs';
import './code-block-core.js';

const meta: Meta = {
  title: 'CodeBlockCore',
  component: 'lyra-code-block-core',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A build-lean variant of `lyra-code-block` for a consumer whose `languages` map already covers every language it renders. Unlike `lyra-code-block`\'s `languagesOnly` flag -- a runtime check a bundler can\'t prove always-true -- this component\'s own module never references shiki\'s full ~200-language default entry point at all, so importing it gives a genuine compile-time exclusion of that table from the build output. A `language` absent from the supplied `languages` map always renders the plain-text fallback; there is no default highlighter to fall back to.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const tsSample = `export function greet(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? \`Hello, \${trimmed}!\` : 'Hello!';
}
`;

export const Default: Story = {
  render: () => html`
    <lyra-code-block-core
      language="typescript"
      .languages=${{ typescript: tsGrammar }}
      .code=${tsSample}
      style="max-width: 32rem;"
    ></lyra-code-block-core>
  `,
};

export const WithFilename: Story = {
  render: () => html`
    <lyra-code-block-core
      filename="greet.ts"
      language="typescript"
      .languages=${{ typescript: tsGrammar }}
      .code=${tsSample}
      style="max-width: 32rem;"
    ></lyra-code-block-core>
  `,
};

export const LanguageNotInMap: Story = {
  name: 'Language absent from the languages map (always plain text)',
  render: () => html`
    <lyra-code-block-core
      filename="notes.py"
      language="python"
      .languages=${{ json: jsonGrammar }}
      .code=${'print("no python grammar was supplied")'}
      style="max-width: 32rem;"
    ></lyra-code-block-core>
  `,
};

export const Collapsible: Story = {
  render: () => html`
    <lyra-code-block-core
      collapsible
      collapsed
      filename="long-file.ts"
      language="typescript"
      .languages=${{ typescript: tsGrammar }}
      .code=${Array.from({ length: 20 }, (_, i) => `const line${i} = ${i};`).join('\n')}
      style="max-width: 32rem;"
    ></lyra-code-block-core>
  `,
};

export const NotCopyable: Story = {
  render: () => html`
    <lyra-code-block-core
      .copyable=${false}
      language="typescript"
      .languages=${{ typescript: tsGrammar }}
      filename="readonly.ts"
      .code=${tsSample}
      style="max-width: 32rem;"
    ></lyra-code-block-core>
  `,
};

export const AccessibleNameOverride: Story = {
  name: 'Accessible code-region name',
  parameters: {
    docs: {
      description: {
        story:
          'The host `aria-label` is forwarded to the internal focusable code region, overriding the filename/language-derived default.',
      },
    },
  },
  render: () => html`
    <lyra-code-block-core
      aria-label="TypeScript greeting implementation"
      filename="greet.ts"
      language="typescript"
      .languages=${{ typescript: tsGrammar }}
      .code=${tsSample}
      style="max-inline-size:32rem;"
    ></lyra-code-block-core>
  `,
};
