import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './code-editor.js';
const meta: Meta = {
  title: 'Code Editor',
  component: 'lr-code-editor',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;
const longUnwrappedSource = `${'x'.repeat(4_803)}${'\n'.repeat(80)}`;
export const Json: Story = {
  render: () =>
    html`<lr-code-editor
      label="Configuration"
      language="json"
      .value=${'{\n  "enabled": true\n}'}
    ></lr-code-editor>`,
};
// Tab width precedence: an inherited `--lr-code-editor-tab-size` drives both editors' tab stops and
// their Tab key, except where `tab-size` is set explicitly -- the property still wins.
export const TabWidth: Story = {
  render: () =>
    html`<div style="display: grid; gap: 1rem; --lr-code-editor-tab-size: 8;">
      <lr-code-editor
        label="Token-driven (8)"
        language="go"
        .value=${'func main() {\n\tprintln("hi")\n}'}
      ></lr-code-editor
      ><lr-code-editor
        label="Property wins (2)"
        language="go"
        tab-size="2"
        .value=${'func main() {\n\tprintln("hi")\n}'}
      ></lr-code-editor>
    </div>`,
};

export const NativeTextSurface: Story = {
  name: 'Native text-control surface',
  parameters: {
    docs: {
      description: {
        story:
          'The original editor forwards native rows/columns, length, editing-assistance and hard-wrap submission semantics while retaining its unwrapped live value.',
      },
    },
  },
  render: () => html`
    <form @submit=${(event: Event) => event.preventDefault()}>
      <lr-code-editor
        name="source"
        label="Source"
        language="typescript"
        rows="6"
        cols="32"
        maxlength="240"
        wrap="hard"
        autocomplete="off"
        inputmode="text"
        enterkeyhint="done"
        autocorrect="off"
        .value=${'const message = "Edit this source";'}
      ></lr-code-editor>
      <button type="submit">Inspect with FormData</button>
    </form>
  `,
};

export const ScopedStateTheme: Story = {
  name: 'Scoped hover / invalid border',
  parameters: {
    docs: {
      description: {
        story:
          'Hover the editor, then submit it empty, to exercise its independent frame-state hooks.',
      },
    },
  },
  render: () => html`
    <form>
      <lr-code-editor
        label="Required configuration"
        required
        style="--lr-code-editor-hover-border: var(--lr-color-success); --lr-code-editor-invalid-border: var(--lr-color-warning)"
      ></lr-code-editor>
      <button type="submit">Validate</button>
    </form>
  `,
};

export const NarrowLongContent: Story = {
  name: 'Narrow RTL long content (320px)',
  parameters: {
    docs: {
      description: {
        story:
          'Long translated chrome wraps at the host boundary while unbroken source remains reachable through the editor-owned scrollport.',
      },
    },
  },
  render: () => html`
    <div
      dir="rtl"
      style="inline-size:320px;max-inline-size:100%;overflow:hidden"
    >
      <lr-code-editor
        label="${'LocalizedUnbrokenEditorLabel'.repeat(12)}"
        hint="${'LocalizedUnbrokenEditorHint'.repeat(12)}"
        resize="none"
        .value=${`const payload = '${'unbrokenSourceToken'.repeat(64)}';`}
        style="max-inline-size:100%"
      ></lr-code-editor>
    </div>
  `,
};

export const SingleEditorScrollport: Story = {
  name: 'Single editor scrollport',
  parameters: {
    docs: {
      description: {
        story:
          'Both direction samples keep the long source, caret, gutter, wheel input, and public scroll API on the editor frame rather than a nested textarea scrollbar.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m)">
      ${(['ltr', 'rtl'] as const).map(
        (direction) => html`
          <div dir=${direction} style="inline-size: 200px; block-size: 160px">
            <lr-code-editor
              label=${`${direction.toUpperCase()} long source`}
              line-numbers
              resize="none"
              style="block-size: 100%"
              .value=${longUnwrappedSource}
            ></lr-code-editor>
          </div>
        `,
      )}
    </div>
  `,
};

export const WrappedSource: Story = {
  parameters: {
    docs: { description: { story: 'Soft and hard text wraps within the allocation. The textarea, caret measurement, and logical line-number gutter follow the same wrapping and tab width; the editor frame owns scrolling.' } },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m); inline-size: 320px; max-inline-size: 100%;">
      ${(['soft', 'hard'] as const).map((wrap) => html`
        <lr-code-editor label=${`${wrap} wrapping`} wrap=${wrap} tab-size="8" resize="none"
          style="block-size: 200px"
          .value=${`const sentence = "${'A longer source sentence. '.repeat(12)}";\n\treturn sentence;`}
        ></lr-code-editor>
      `)}
    </div>
  `,
};

export const DescribedRequiredEditor: Story = {
  parameters: {
    docs: { description: { story: 'External guidance describes the native text editor alongside its hint. Blur the empty editor, then reset: interaction feedback becomes pristine while required validity remains.' } },
  },
  render: () => html`
    <form>
      <p id="code-editor-story-guidance">Provide the source for this configuration.</p>
      <lr-code-editor label="Source" required aria-describedby="code-editor-story-guidance"
        hint="Enter code in the editor."></lr-code-editor>
      <button type="reset">Reset</button>
    </form>
  `,
};
