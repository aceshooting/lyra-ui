import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import jsonGrammar from "shiki/langs/json.mjs";
import tsGrammar from "shiki/langs/typescript.mjs";
import "./code-block-core.js";

const meta: Meta = {
  title: "CodeBlockCore",
  component: "lr-code-block-core",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "A build-lean variant of `lr-code-block` for a consumer whose `languages` map already covers every language it renders. This component's module never references shiki's full ~200-language default entry point, so importing it gives a genuine compile-time exclusion of that table from the build output. A `language` absent from the supplied `languages` map always renders the plain-text fallback; there is no default highlighter to fall back to.",
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

const jsonLanguages = { json: jsonGrammar };
const typescriptLanguages = { typescript: tsGrammar };

export const Default: Story = {
  render: () => html`
    <lr-code-block-core
      language="typescript"
      .languages=${{ typescript: tsGrammar }}
      .code=${tsSample}
      style="max-width: 32rem;"
    ></lr-code-block-core>
  `,
};

export const WithFilename: Story = {
  render: () => html`
    <lr-code-block-core
      filename="greet.ts"
      language="typescript"
      .languages=${{ typescript: tsGrammar }}
      .code=${tsSample}
      style="max-width: 32rem;"
    ></lr-code-block-core>
  `,
};

export const Narrow320: Story = {
  name: "Narrow (320px, long filename and code)",
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-code-block-core
        filename=${`src/generated/${"very-long-directory-name/".repeat(
          8
        )}conversation-handler.ts`}
        language="typescript"
        line-numbers
        .languages=${typescriptLanguages}
        .code=${`const endpoint = "https://example.test/${"unbroken-segment-".repeat(
          16
        )}";`}
      ></lr-code-block-core>
    </div>
  `,
};

export const LanguageNotInMap: Story = {
  name: "Language absent from the languages map (always plain text)",
  render: () => html`
    <lr-code-block-core
      filename="notes.py"
      language="python"
      .languages=${{ json: jsonGrammar }}
      .code=${'print("no python grammar was supplied")'}
      style="max-width: 32rem;"
    ></lr-code-block-core>
  `,
};

export const RuntimeLanguageMapReplacement: Story = {
  name: "Runtime language-map replacement",
  parameters: {
    docs: {
      description: {
        story:
          "Replace the `languages` map while the component is connected. Each replacement starts a new loading generation, so a slower obsolete map cannot clear the current loading state or overwrite its output.",
      },
    },
  },
  render: () => html`
    <div style="display:grid; gap:var(--lr-space-m); max-inline-size:32rem;">
      <div style="display:flex; flex-wrap:wrap; gap:var(--lr-space-xs);">
        <button
          type="button"
          @click=${(event: Event) => {
            const codeBlock = (event.currentTarget as HTMLElement)
              .closest("div")!
              .parentElement!.querySelector("lr-code-block-core")!;
            codeBlock.language = "json";
            codeBlock.code = '{"generation":"json"}';
            codeBlock.languages = jsonLanguages;
          }}
        >
          Load JSON map
        </button>
        <button
          type="button"
          @click=${(event: Event) => {
            const codeBlock = (event.currentTarget as HTMLElement)
              .closest("div")!
              .parentElement!.querySelector("lr-code-block-core")!;
            codeBlock.language = "typescript";
            codeBlock.code = tsSample;
            codeBlock.languages = typescriptLanguages;
          }}
        >
          Load TypeScript map
        </button>
      </div>
      <lr-code-block-core
        filename="runtime-map.ts"
        language="typescript"
        .languages=${typescriptLanguages}
        .code=${tsSample}
      ></lr-code-block-core>
    </div>
  `,
};

export const Collapsible: Story = {
  render: () => html`
    <lr-code-block-core
      collapsible
      collapsed
      filename="long-file.ts"
      language="typescript"
      .languages=${{ typescript: tsGrammar }}
      .code=${Array.from(
        { length: 20 },
        (_, i) => `const line${i} = ${i};`
      ).join("\n")}
      style="max-width: 32rem;"
    ></lr-code-block-core>
  `,
};

export const ActivatableLines: Story = {
  name: "Keyboard-activatable line numbers",
  parameters: {
    docs: {
      description: {
        story:
          "Tab into the gutter and use ArrowUp, ArrowDown, Home, and End. If a live code update removes the focused line, focus follows the final surviving line instead of escaping the widget.",
      },
    },
  },
  render: () => html`
    <lr-code-block-core
      filename="stream.ts"
      line-numbers
      activatable-lines
      .code=${"const first = 1;\nconst second = 2;\nconst third = 3;\nconst fourth = 4;"}
    ></lr-code-block-core>
  `,
};

export const NotCopyable: Story = {
  render: () => html`
    <lr-code-block-core
      .copyable=${false}
      language="typescript"
      .languages=${{ typescript: tsGrammar }}
      filename="readonly.ts"
      .code=${tsSample}
      style="max-width: 32rem;"
    ></lr-code-block-core>
  `,
};

export const AccessibleNameOverride: Story = {
  name: "Accessible code-region name",
  parameters: {
    docs: {
      description: {
        story:
          "The host `aria-label` is forwarded to the internal focusable code region, overriding the filename/language-derived default.",
      },
    },
  },
  render: () => html`
    <lr-code-block-core
      aria-label="TypeScript greeting implementation"
      filename="greet.ts"
      language="typescript"
      .languages=${{ typescript: tsGrammar }}
      .code=${tsSample}
      style="max-inline-size:32rem;"
    ></lr-code-block-core>
  `,
};
