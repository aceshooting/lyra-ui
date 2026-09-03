import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './mention-popover.js';
import type { LyraMentionItem, LyraMentionPopover, LyraMentionSelectDetail } from './mention-popover.js';

const meta: Meta = {
  title: 'MentionPopover',
  component: 'lr-mention-popover',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const PEOPLE: LyraMentionItem[] = [
  { suggestionId: 'alice', label: 'Alice Johansson', description: 'Product design', icon: '👩‍🎨' },
  { suggestionId: 'bob', label: 'Bob Nakamura', description: 'Backend engineering', icon: '🧑‍💻' },
  { suggestionId: 'carol', label: 'Carol Ibarra', description: 'Solar ops', icon: '🧑‍🔧' },
  { suggestionId: 'dan', label: 'Dan Petrov', description: 'Customer success', icon: '🧑‍💼' },
];

const COMMANDS: LyraMentionItem[] = [
  { suggestionId: 'summarize', label: '/summarize', description: 'Summarize this conversation' },
  { suggestionId: 'explain', label: '/explain', description: 'Explain the last response in more detail' },
  { suggestionId: 'retry', label: '/retry', description: 'Regenerate the last response' },
];

// This component has no anchor of its own -- place() needs a real element to
// measure -- so every "static" story below renders a small marker box the
// popover anchors under (mimicking wherever a trigger character would sit in
// a real textarea) and wires `.anchor`/`.open` imperatively after mount,
// exactly like a host application would in response to its own '@'/'/'
// detection. See LiveComposerIntegration below for the full, real-textarea version.
function staticDemo(
  id: string,
  items: LyraMentionItem[],
  props: Partial<LyraMentionPopover> = {},
  maxWidth = '28rem',
) {
  setTimeout(() => {
    const container = document.getElementById(id);
    const anchor = container?.querySelector<HTMLElement>('.demo-anchor');
    const popover = container?.querySelector<LyraMentionPopover>('.demo-popover');
    if (!anchor || !popover) return;
    Object.assign(popover, props);
    popover.anchor = anchor;
    popover.items = items;
    popover.open = true;
  }, 0);
  return html`
    <div id=${id} style="max-width: ${maxWidth};">
      <span class="demo-anchor" style="display: inline-block;">@</span>
      <lr-mention-popover class="demo-popover"></lr-mention-popover>
    </div>
  `;
}

export const Default: Story = {
  render: () => staticDemo('mention-demo-default', PEOPLE),
};

/** `icon` is an opaque literal string (an emoji here) — same convention as `<lr-tool-select-dialog>`'s own `icon`. */
export const WithIcons: Story = {
  render: () => staticDemo('mention-demo-icons', PEOPLE),
};

/** No `description`/`icon` set on any candidate — those parts simply don't render per row. */
export const CommandsWithoutIcons: Story = {
  render: () => staticDemo('mention-demo-commands', COMMANDS, { label: 'Slash commands' }),
};

export const FilteredByQuery: Story = {
  render: () => staticDemo('mention-demo-filtered', PEOPLE, { query: 'ba' }),
};

export const NoMatches: Story = {
  render: () => staticDemo('mention-demo-empty', PEOPLE, { query: 'zzz', emptyText: 'No teammates match “zzz”' }),
};

export const NarrowLongContent: Story = {
  render: () =>
    staticDemo(
      'mention-demo-narrow-long',
      [
        {
          suggestionId: 'long',
          label: 'Avery-With-An-Exceptionally-Long-Unbroken-Display-Name',
          description: 'A-description-without-natural-breakpoints-that-must-not-expand-the-popover-inline-axis',
        },
      ],
      {},
      '20rem',
    ),
};

/**
 * Full live integration against a real `<textarea>`: typing `@` opens the
 * popover, caret-anchored via the hidden-mirror-element technique described
 * in the class doc; ArrowUp/ArrowDown/Enter/Escape are forwarded from the
 * textarea's own `keydown` through `handleKeyDown()`, and a committed
 * mention is spliced into the text in place of the trigger + query.
 */
export const LiveComposerIntegration: Story = {
  render: () => {
    const containerId = 'mention-demo';
    setTimeout(() => wireDemo(containerId), 0);
    return html`
      <div id=${containerId} style="max-width: 28rem; font-family: system-ui, sans-serif;">
        <p style="font-size: 0.875rem; margin-bottom: 0.5rem;">
          Type <code>@</code> followed by a name in the box below.
        </p>
        <textarea
          class="demo-textarea"
          rows="3"
          style="width: 100%; box-sizing: border-box; padding: 0.5rem; font: inherit;"
          placeholder="Try: Hey @a"
        ></textarea>
        <lr-mention-popover class="demo-popover" .items=${PEOPLE} empty-text="No teammates found"></lr-mention-popover>
      </div>
    `;
  },
};

function wireDemo(containerId: string): void {
  const container = document.getElementById(containerId);
  const textarea = container?.querySelector<HTMLTextAreaElement>('.demo-textarea');
  const popover = container?.querySelector<LyraMentionPopover>('.demo-popover');
  if (!textarea || !popover) return;

  let triggerIndex = -1;
  let suggestionGeneration = 0;

  const closeMention = () => {
    suggestionGeneration += 1;
    triggerIndex = -1;
    popover.open = false;
  };

  textarea.addEventListener('input', () => {
    const caret = textarea.selectionStart ?? 0;
    const upToCaret = textarea.value.slice(0, caret);
    const match = /(?:^|\s)@([\w-]*)$/.exec(upToCaret);
    if (!match) {
      closeMention();
      return;
    }
    triggerIndex = caret - match[1].length - 1;
    suggestionGeneration += 1;
    popover.anchor = textarea;
    popover.query = match[1];
    popover.open = true;
  });

  textarea.addEventListener('keydown', (e) => {
    if (
      popover.open &&
      popover.handleKeyDown(e) &&
      (e.key === 'ArrowDown' || e.key === 'ArrowUp')
    ) {
      const generation = suggestionGeneration;
      void popover.focusActiveOption({
        ownsFocus: () =>
          generation === suggestionGeneration &&
          (textarea.ownerDocument.activeElement === textarea ||
            textarea.ownerDocument.activeElement === popover),
      });
    }
  });

  textarea.addEventListener('blur', (event) => {
    // Keyboard navigation deliberately moves real focus from the textarea
    // into the popover. Shadow retargeting exposes that move as the host.
    if (event.relatedTarget !== popover) closeMention();
  });

  popover.addEventListener('lr-mention-select', ((e: CustomEvent<LyraMentionSelectDetail>) => {
    const caret = textarea.selectionStart ?? 0;
    const before = textarea.value.slice(0, triggerIndex);
    const after = textarea.value.slice(caret);
    const inserted = `@${e.detail.label} `;
    textarea.value = `${before}${inserted}${after}`;
    const newCaret = before.length + inserted.length;
    textarea.setSelectionRange(newCaret, newCaret);
    textarea.focus();
    closeMention();
  }) as EventListener);
}
