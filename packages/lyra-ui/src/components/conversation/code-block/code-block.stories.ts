import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";
import "./code-block.js";
import "../../forms/button/button.js";

const meta: Meta = {
  title: "CodeBlock",
  component: "lr-code-block",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Fenced code display with an optional lazy-loaded syntax highlighter (the `shiki` peer dependency) and a copy button. Renders as plain unhighlighted `<pre><code>` at zero extra bytes whenever `shiki` isn't installed or `language` is unset/unrecognized — the default, supported rendering path, not a degraded one.",
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

// Deliberately tab-indented (not spaces) so --lr-code-block-tab-size has something to act on.
const tabSample =
  'function greet(name) {\n\tif (name) {\n\t\treturn `Hello, ${name}!`;\n\t}\n\treturn "Hello!";\n}\n';

export const Default: Story = {
  render: () =>
    html`<lr-code-block
      language="typescript"
      .code=${tsSample}
      style="max-width: 32rem;"
    ></lr-code-block>`,
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

/** The opt-in theme-level scrollbar hooks retheme the body scrollport, plus every other internal
 *  scroll container in the library, from one declaration on an ancestor. */
export const ThemedScrollbar: Story = {
  name: "Themed scrollbar (theme-level cssprops)",
  parameters: {
    docs: {
      description: {
        story:
          "Setting `--lr-theme-scrollbar-width` and `--lr-theme-scrollbar-gutter` on an ancestor retunes the `body` scrollport -- and, set on `:root`, every other internal scroll container in the library (`lr-table`, `lr-virtual-list`, `lr-scroller`, `lr-carousel`, `lr-time-input`, `lr-emoji-picker`, `lr-code-editor`) at once.",
      },
    },
  },
  render: () => html`
    <div style="--lr-theme-scrollbar-width: thin; --lr-theme-scrollbar-gutter: stable;">
      <lr-code-block
        language="typescript"
        .code=${tsSample}
        style="max-width: 32rem; --lr-code-block-max-height: 6rem;"
      ></lr-code-block>
    </div>
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
  javascript: "const greet = (name) => console.log(`Hello, ${name}!`);",
  typescript: `type User = { name: string };\nconst user: User = { name: "Lyra" };`,
  greycat: `type User { name: String }\nfn greet(user: User) { return user.name }`,
  html: `<main><h1>Hello, Lyra</h1></main>`,
} as const;

export const PythonLanguage: Story = {
  render: () => html`
    <lr-code-block
      filename="fib.py"
      language="python"
      .code=${pySample}
      style="max-width: 32rem;"
    ></lr-code-block>
  `,
};

export const CommonLanguages: Story = {
  name: "Common languages",
  parameters: {
    docs: {
      description: {
        story:
          "The default viewer lazy-loads Shiki grammars on demand. Python, C, Java, JavaScript, TypeScript, and HTML come from Shiki; GreyCat/GCL is included by Lyra because it is not in Shiki’s bundled catalog.",
      },
    },
  },
  render: () => html`
    <div
      style="display:grid; grid-template-columns:repeat(auto-fit,minmax(18rem,1fr)); gap:0.75rem;"
    >
      ${Object.entries(languageSamples).map(
        ([language, code]) => html`
          <lr-code-block
            filename=${language === "greycat"
              ? "hello.gcl"
              : `hello.${language}`}
            language=${language}
            .code=${code}
          ></lr-code-block>
        `
      )}
    </div>
  `,
};

export const PlainFallback: Story = {
  name: "No language set (always plain text)",
  render: () => html`
    <lr-code-block
      filename="notes.txt"
      .code=${"Just plain text, never highlighted.\nline two\nline three"}
      style="max-width: 32rem;"
    ></lr-code-block>
  `,
};

export const WithLineNumbers: Story = {
  name: "Optional line numbers",
  render: () => html`
    <lr-code-block
      filename="example.ts"
      language="typescript"
      line-numbers
      .code=${"const answer = 42;\nconsole.log(answer);\n"}
    ></lr-code-block>
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
    <lr-code-block
      filename="stream.ts"
      line-numbers
      activatable-lines
      .code=${"const first = 1;\nconst second = 2;\nconst third = 3;\nconst fourth = 4;"}
    ></lr-code-block>
  `,
};

export const UnrecognizedLanguage: Story = {
  name: "Unrecognized language id (falls back to plain text)",
  render: () => html`
    <lr-code-block
      language="not-a-real-language"
      .code=${"plain(); // shiki has no grammar for this id"}
      style="max-width: 32rem;"
    ></lr-code-block>
  `,
};

export const Collapsible: Story = {
  render: () => html`
    <lr-code-block
      collapsible
      collapsed
      filename="long-file.ts"
      language="typescript"
      .code=${Array.from(
        { length: 20 },
        (_, i) => `const line${i} = ${i};`
      ).join("\n")}
      style="max-width: 32rem;"
    ></lr-code-block>
  `,
};

export const MaxHeightScrolling: Story = {
  render: () => html`
    <lr-code-block
      language="typescript"
      max-height="8rem"
      .code=${Array.from(
        { length: 30 },
        (_, i) => `const line${i} = ${i};`
      ).join("\n")}
      style="max-width: 32rem;"
    ></lr-code-block>
  `,
};

export const FillHeightContainer: Story = {
  name: "Fills a definite-height container",
  parameters: {
    docs: {
      description: {
        story:
          "The host, base and body all carry an unconditional `block-size: 100%` chain, the same pattern `lr-file-input` and `lr-code-editor` already use. Set on an ordinary auto-height ancestor it is a no-op (see `Default`); sized inside a flex column with a definite block size, as here, the header keeps its natural size and the body grows to fill and scroll the remaining space instead of collapsing to its own content height.",
      },
    },
  },
  render: () => html`
    <div style="display: flex; flex-direction: column; block-size: 12rem; max-width: 32rem;">
      <lr-code-block
        language="typescript"
        filename="greet.ts"
        style="block-size: 100%;"
        .code=${Array.from(
          { length: 30 },
          (_, i) => `const line${i} = ${i};`
        ).join("\n")}
      ></lr-code-block>
    </div>
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
    <lr-code-block
      aria-label="TypeScript greeting implementation"
      filename="greet.ts"
      language="typescript"
      .code=${tsSample}
      style="max-inline-size:32rem;"
    ></lr-code-block>
  `,
};

export const ClipboardEvents: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "A fulfilled clipboard write emits `lr-copy` with `{ ok: true, text }`. An unavailable or rejected clipboard write instead emits `lr-error` and `lr-copy-error` with `{ ok: false, text, reason, error }`, and the button shows a localized failure state.",
      },
    },
  },
  render: () => html`
    <div
      style="display:flex; flex-direction:column; gap:0.75rem; max-width:32rem;"
    >
      <lr-code-block
        language="typescript"
        .code=${tsSample}
        @lr-copy=${(e: CustomEvent<{ ok: true; text: string }>) =>
          console.log("lr-copy", e.detail)}
        @lr-copy-error=${(
          e: CustomEvent<{
            ok: false;
            text: string;
            reason: string;
            error: unknown;
          }>
        ) => console.error("lr-copy-error", e.detail)}
        @lr-error=${(e: CustomEvent<null>) =>
          console.error("lr-error", e.detail)}
      ></lr-code-block>
      <p
        style="margin:0; color:var(--lr-color-text-quiet); font-size:0.8125rem;"
      >
        Open the console — clicking "Copy" logs either the fulfilled
        <code>lr-copy</code> result or both failure events.
      </p>
    </div>
  `,
};

export const TabWidth: Story = {
  name: "Tab width (--lr-code-block-tab-size)",
  parameters: {
    docs: {
      description: {
        story:
          "Tab-indented source rendered at the default width of `2` (matching `--lr-code-editor-tab-size`) and at `8`. The component writes the token, never an inline `tab-size`, so the override survives shiki's own inline `style` on the highlighted `<pre>`.",
      },
    },
  },
  render: () => html`
    <div
      style="display:flex; flex-direction:column; gap:0.75rem; max-inline-size:32rem;"
    >
      <lr-code-block language="javascript" .code=${tabSample}></lr-code-block>
      <lr-code-block
        language="javascript"
        .code=${tabSample}
        style="--lr-code-block-tab-size: 8"
      ></lr-code-block>
    </div>
  `,
};

export const Narrow320: Story = {
  name: "Narrow allocation (320px)",
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%;">
      <lr-code-block
        filename="greet.ts"
        language="typescript"
        line-numbers
        .code=${tsSample}
      ></lr-code-block>
    </div>
  `,
};

export const ActiveLineOutlineColor: Story = {
  name: "Active-line outline color",
  parameters: {
    docs: {
      description: {
        story:
          "`--lr-code-block-active-line-outline-color` retints only the active highlight outline. `--lr-code-block-language-bg`/`--lr-code-block-language-color` retint the language pill independently of both that outline and the ordinary hover/focus states, which keep `--lr-color-brand`.",
      },
    },
  },
  render: () => html`
    <lr-code-block
      language="typescript"
      .code=${tsSample}
      line-numbers
      .highlights=${[
        { id: "h1", anchor: { kind: "line-range", start: 2, end: 2 } },
      ]}
      active-highlight-id="h1"
      style="max-inline-size:32rem; --lr-code-block-active-line-outline-color: var(--lr-color-success); --lr-code-block-language-bg: var(--lr-color-warning-quiet); --lr-code-block-language-color: var(--lr-color-warning);"
    ></lr-code-block>
  `,
};

/** Locale and strings remain live after the grammar has finished highlighting. */
export const LiveGutterLocalization: Story = {
  render: () => html`
    <div lang="en">
      <button type="button" @click=${(event: Event) => {
        const wrapper = (event.currentTarget as HTMLElement).parentElement!;
        wrapper.lang = wrapper.lang === 'en' ? 'ar-EG' : 'en';
      }}>Change gutter number locale</button>
      <lr-code-block language="typescript" line-numbers activatable-lines
        .code=${'const answer = 42;\nconsole.log(answer);'}
        .strings=${{ codeBlockLineLabel: 'Source line {line}' }}
      ></lr-code-block>
    </div>
  `,
};

export const IconCopyAndHeaderActions: Story = {
  name: 'Icon copy control and header actions',
  parameters: {
    docs: {
      description: {
        story:
          '`copy-appearance="icon"` swaps the copy control\'s visible label for a compact glyph and promotes the same localized Copy/Copied/failure string to its accessible name, for a dense header. The `header-actions` slot takes extra controls at the trailing end of the header row; its content alone is enough to render the header. The copy control composes a real `<lr-icon-button>`, so `--lr-icon-button-*` retunes it.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:1rem;">
      <lr-code-block
        filename="deploy.sh"
        language="bash"
        copy-appearance="icon"
        code="pnpm build && pnpm deploy"
      >
        <lr-button slot="header-actions" size="2xs" appearance="plain">Run</lr-button>
      </lr-code-block>
      <lr-code-block filename="deploy.sh" language="bash" code="pnpm build && pnpm deploy">
      </lr-code-block>
    </div>
  `,
};

export const RightToLeft: Story = {
  parameters: { docs: { description: { story: 'Under `dir=\'rtl\'` the code body stays left-to-right and opens at the start of the code, the `c++` badge and `./src/main.cpp` file name keep their character order, and the header follows the page direction.' } } },
  render: () => html`
    <div dir="rtl" style="inline-size: 400px; max-inline-size: 100%;">
      <lr-code-block language="c++" filename="./src/main.cpp" max-height="8rem" line-numbers
        .code=${'#include <iostream>\n\nint main() {\n  std::cout << \"A deliberately long line that has to scroll horizontally inside the code body\" << std::endl;\n  short();\n  return 0;\n}\n'}></lr-code-block>
    </div>
  `,
};
