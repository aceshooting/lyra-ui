import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './code-block.js';

const meta: Meta = {
  title: 'CodeBlock',
  component: 'lr-code-block',
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
  render: () => html`<lr-code-block language="typescript" .code=${tsSample} style="max-width: 32rem;"></lr-code-block>`,
};

export const WithFilename: Story = {
  render: () => html`
    <lr-code-block
      filename="greet.ts"
      language="typescript"
      .code=${tsSample}
      style="max-width: 32rem;"
    ></lr-code-block>
  `,
};

const pySample = `def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a
`;

const languageSamples = {
  python: `def greet(name):\n    return f"Hello, {name}!"`,
  c: `#include <stdio.h>\nint main(void) { puts("Hello"); }`,
  java: `public final class Hello {\n  public static void main(String[] args) {\n    System.out.println("Hello");\n  }\n}`,
  javascript: 'const greet = (name) => console.log(`Hello, ${name}!`);',
  typescript: `type User = { name: string };\nconst user: User = { name: "Lyra" };`,
  greycat: `model User { name: String }\nfn greet(user: User) { return user.name }`,
  html: `<main><h1>Hello, Lyra</h1></main>`,
} as const;

export const PythonLanguage: Story = {
  render: () => html`
    <lr-code-block filename="fib.py" language="python" .code=${pySample} style="max-width: 32rem;"></lr-code-block>
  `,
};

export const CommonLanguages: Story = {
  name: 'Common languages',
  parameters: {
    docs: {
      description: {
        story:
          'The default viewer lazy-loads Shiki grammars on demand. Python, C, Java, JavaScript, TypeScript, and HTML come from Shiki; GreyCat/GCL is included by Lyra because it is not in Shiki’s bundled catalog.',
      },
    },
  },
  render: () => html`
    <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(18rem,1fr)); gap:0.75rem;">
      ${Object.entries(languageSamples).map(
        ([language, code]) => html`
          <lr-code-block
            filename=${language === 'greycat' ? 'hello.gcl' : `hello.${language}`}
            language=${language}
            .code=${code}
          ></lr-code-block>
        `,
      )}
    </div>
  `,
};

export const PlainFallback: Story = {
  name: 'No language set (always plain text)',
  render: () => html`
    <lr-code-block filename="notes.txt" .code=${'Just plain text, never highlighted.\nline two\nline three'} style="max-width: 32rem;"></lr-code-block>
  `,
};

export const WithLineNumbers: Story = {
  name: 'Optional line numbers',
  render: () => html`
    <lr-code-block
      filename="example.ts"
      language="typescript"
      line-numbers
      .code=${'const answer = 42;\nconsole.log(answer);\n'}
    ></lr-code-block>
  `,
};

export const UnrecognizedLanguage: Story = {
  name: 'Unrecognized language id (falls back to plain text)',
  render: () => html`
    <lr-code-block language="not-a-real-language" .code=${'plain(); // shiki has no grammar for this id'} style="max-width: 32rem;"></lr-code-block>
  `,
};

export const Collapsible: Story = {
  render: () => html`
    <lr-code-block
      collapsible
      collapsed
      filename="long-file.ts"
      language="typescript"
      .code=${Array.from({ length: 20 }, (_, i) => `const line${i} = ${i};`).join('\n')}
      style="max-width: 32rem;"
    ></lr-code-block>
  `,
};

export const MaxHeightScrolling: Story = {
  render: () => html`
    <lr-code-block
      language="typescript"
      max-height="8rem"
      .code=${Array.from({ length: 30 }, (_, i) => `const line${i} = ${i};`).join('\n')}
      style="max-width: 32rem;"
    ></lr-code-block>
  `,
};

export const NotCopyable: Story = {
  render: () => html`
    <lr-code-block
      .copyable=${false}
      language="typescript"
      filename="readonly.ts"
      .code=${tsSample}
      style="max-width: 32rem;"
    ></lr-code-block>
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
    <lr-code-block
      aria-label="TypeScript greeting implementation"
      filename="greet.ts"
      language="typescript"
      .code=${tsSample}
      style="max-inline-size:32rem;"
    ></lr-code-block>
  `,
};

export const CopyEvent: Story = {
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:0.75rem; max-width:32rem;">
      <lr-code-block
        language="typescript"
        .code=${tsSample}
        @lr-copy=${(e: CustomEvent<{ text: string }>) => console.log('lr-copy', e.detail.text)}
      ></lr-code-block>
      <p style="margin:0; color:var(--lr-color-text-quiet); font-size:0.8125rem;">
        Open the console — clicking "Copy" logs the raw <code>code</code> text via <code>lr-copy</code>.
      </p>
    </div>
  `,
};
