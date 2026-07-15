import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './code-block.js';

const meta: Meta = {
  title: 'CodeBlock',
  component: 'lyra-code-block',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Fenced code display with an optional lazy-loaded syntax highlighter (the `shiki` peer dependency) and a copy button. Renders as plain unhighlighted `<pre><code>` at zero extra bytes whenever `shiki` isn\'t installed or `language` is unset/unrecognized — the default, supported rendering path, not a degraded one.',
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
  render: () => html`<lyra-code-block language="typescript" .code=${tsSample} style="max-width: 32rem;"></lyra-code-block>`,
};

export const WithFilename: Story = {
  render: () => html`
    <lyra-code-block
      filename="greet.ts"
      language="typescript"
      .code=${tsSample}
      style="max-width: 32rem;"
    ></lyra-code-block>
  `,
};

const pySample = `def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
`;

export const PythonLanguage: Story = {
  render: () => html`
    <lyra-code-block filename="fib.py" language="python" .code=${pySample} style="max-width: 32rem;"></lyra-code-block>
  `,
};

export const PlainFallback: Story = {
  name: 'No language set (always plain text)',
  render: () => html`
    <lyra-code-block filename="notes.txt" .code=${'Just plain text, never highlighted.\nline two\nline three'} style="max-width: 32rem;"></lyra-code-block>
  `,
};

export const UnrecognizedLanguage: Story = {
  name: 'Unrecognized language id (falls back to plain text)',
  render: () => html`
    <lyra-code-block language="not-a-real-language" .code=${'plain(); // shiki has no grammar for this id'} style="max-width: 32rem;"></lyra-code-block>
  `,
};

export const Collapsible: Story = {
  render: () => html`
    <lyra-code-block
      collapsible
      collapsed
      filename="long-file.ts"
      language="typescript"
      .code=${Array.from({ length: 20 }, (_, i) => `const line${i} = ${i};`).join('\n')}
      style="max-width: 32rem;"
    ></lyra-code-block>
  `,
};

export const MaxHeightScrolling: Story = {
  render: () => html`
    <lyra-code-block
      language="typescript"
      max-height="8rem"
      .code=${Array.from({ length: 30 }, (_, i) => `const line${i} = ${i};`).join('\n')}
      style="max-width: 32rem;"
    ></lyra-code-block>
  `,
};

export const NotCopyable: Story = {
  render: () => html`
    <lyra-code-block
      .copyable=${false}
      language="typescript"
      filename="readonly.ts"
      .code=${tsSample}
      style="max-width: 32rem;"
    ></lyra-code-block>
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
    <lyra-code-block
      aria-label="TypeScript greeting implementation"
      filename="greet.ts"
      language="typescript"
      .code=${tsSample}
      style="max-inline-size:32rem;"
    ></lyra-code-block>
  `,
};

export const CopyEvent: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:0.75rem; max-width:32rem;">
      <lyra-code-block
        language="typescript"
        .code=${tsSample}
        @lyra-copy=${(e: CustomEvent<{ text: string }>) => console.log('lyra-copy', e.detail.text)}
      ></lyra-code-block>
      <p style="margin:0; color:var(--lyra-color-text-quiet); font-size:0.8125rem;">
        Open the console — clicking "Copy" logs the raw <code>code</code> text via <code>lyra-copy</code>.
      </p>
    </div>
  `,
};
