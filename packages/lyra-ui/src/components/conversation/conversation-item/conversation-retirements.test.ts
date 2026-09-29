import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { captureDeprecationWarnings } from '../../../../test/expected-deprecations.js';
import type { LyraElement } from '../../../internal/lyra-element.js';
import '../agent-workspace/agent-workspace.js';
import '../message-actions/message-actions.js';
import '../chat-composer/chat-composer.js';
import '../chat-message/chat-message.js';
import '../checkpoint/checkpoint.js';
import '../code-block/code-block-core.js';
import '../code-block/code-block.js';
import '../conversation-item/conversation-item.js';
import '../generation-metrics/generation-metrics.js';
import '../markdown/markdown-core.js';
import '../markdown/markdown.js';
import '../message-parts/message-parts.js';
import '../prompt-input/prompt-input.js';
import '../prompt-queue/prompt-queue.js';
import '../push-to-talk/push-to-talk.js';
import '../realtime-session/realtime-session.js';
import '../streaming-text/streaming-text-core.js';
import '../streaming-text/streaming-text.js';
import '../thread-list/thread-list.js';
import '../transcript-feed/transcript-feed.js';
import '../voice-picker/voice-picker.js';

type AliasCase = readonly [tag: string, alias: string, attribute: string, canonical: string,
  defaultValue: boolean | string, activeValue: boolean | string, aliasValue: boolean | string];
const cases: readonly AliasCase[] = [
  ['lr-agent-workspace', 'showComposer', 'show-composer', 'withoutComposer', false, true, false],
  ['lr-agent-workspace', 'showDetails', 'show-details', 'withoutDetails', false, true, false],
  ['lr-chat-composer', 'stoppable', 'stoppable', 'withoutStop', false, true, false],
  ['lr-chat-composer', 'submitOnEnter', 'submit-on-enter', 'withoutEnterSubmit', false, true, false],
  ['lr-chat-message', 'actionsPosition', 'actions-position', 'actionsPlacement', 'inside', 'outside', 'outside'],
  ['lr-chat-message', 'attachmentsPosition', 'attachments-position', 'attachmentsPlacement', 'after', 'before', 'before'],
  ['lr-checkpoint', 'confirmRestore', 'confirm-restore', 'withoutRestoreConfirmation', false, true, false],
  ['lr-checkpoint', 'restorable', 'restorable', 'withoutRestore', false, true, false],
  ['lr-code-block-core', 'copyable', 'copyable', 'withoutCopyButton', false, true, false],
  ['lr-code-block', 'copyable', 'copyable', 'withoutCopyButton', false, true, false],
  ['lr-conversation-item', 'compact', 'compact', 'size', 'm', 's', true],
  ['lr-conversation-item', 'renamable', 'renamable', 'withoutRename', false, true, false],
  ['lr-generation-metrics', 'showStop', 'show-stop', 'withoutStop', false, true, false],
  ['lr-markdown-core', 'codeBlockChrome', 'code-block-chrome', 'codeBlockHeader', false, true, true],
  ['lr-markdown-core', 'gfm', 'gfm', 'withoutGfm', false, true, false],
  ['lr-markdown-core', 'highlightCode', 'highlight-code', 'withoutSyntaxHighlighting', false, true, false],
  ['lr-markdown', 'codeBlockChrome', 'code-block-chrome', 'codeBlockHeader', false, true, true],
  ['lr-markdown', 'gfm', 'gfm', 'withoutGfm', false, true, false],
  ['lr-markdown', 'highlightCode', 'highlight-code', 'withoutSyntaxHighlighting', false, true, false],
  ['lr-message-parts', 'codeBlockChrome', 'code-block-chrome', 'codeBlockHeader', false, true, true],
  ['lr-message-parts', 'showReasoning', 'show-reasoning', 'withoutReasoning', false, true, false],
  ['lr-prompt-input', 'submitOnEnter', 'submit-on-enter', 'withoutEnterSubmit', false, true, false],
  ['lr-prompt-queue', 'editable', 'editable', 'readonly', false, true, false],
  ['lr-push-to-talk', 'showTimer', 'show-timer', 'withoutTimer', false, true, false],
  ['lr-realtime-session', 'showCapture', 'show-capture', 'withoutCapture', false, true, false],
  ['lr-streaming-text-core', 'codeBlockChrome', 'code-block-chrome', 'codeBlockHeader', false, true, true],
  ['lr-streaming-text-core', 'gfm', 'gfm', 'withoutGfm', false, true, false],
  ['lr-streaming-text-core', 'highlightCode', 'highlight-code', 'withoutSyntaxHighlighting', false, true, false],
  ['lr-streaming-text', 'codeBlockChrome', 'code-block-chrome', 'codeBlockHeader', false, true, true],
  ['lr-streaming-text', 'gfm', 'gfm', 'withoutGfm', false, true, false],
  ['lr-streaming-text', 'highlightCode', 'highlight-code', 'withoutSyntaxHighlighting', false, true, false],
  ['lr-thread-list', 'renamable', 'renamable', 'withoutRename', false, true, false],
  ['lr-thread-list', 'showArchived', 'show-archived', 'withArchived', false, true, true],
  ['lr-transcript-feed', 'showTimestamps', 'show-timestamps', 'withTimestamps', false, true, true],
  ['lr-voice-picker', 'preview', 'preview', 'withoutPreview', false, true, false],
];

for (const [tag, alias, attribute, canonical, defaultValue, activeValue, aliasValue] of cases) {
  it(`${tag} ignores retired ${attribute} input in both write orders`, async () => {
    const warnings = await captureDeprecationWarnings([], async () => {
      const el = await fixture<LyraElement>(`<${tag}></${tag}>`);
      expect(Reflect.get(el, canonical)).to.equal(defaultValue);
      el.setAttribute(attribute, String(aliasValue));
      await el.updateComplete;
      expect(Reflect.get(el, canonical), 'old attribute cannot change the default').to.equal(defaultValue);
      expect(alias in el, 'old reactive property is absent').to.equal(false);
      Reflect.set(el, alias, aliasValue);
      await el.updateComplete;
      expect(Reflect.get(el, canonical), 'old property write is inert').to.equal(defaultValue);
      Reflect.set(el, canonical, activeValue);
      await el.updateComplete;
      expect(Reflect.get(el, canonical)).to.equal(activeValue);
      Reflect.set(el, alias, typeof aliasValue === 'boolean' ? !aliasValue : defaultValue);
      el.removeAttribute(attribute);
      await el.updateComplete;
      expect(Reflect.get(el, canonical), 'late legacy writes cannot undo canonical control').to.equal(activeValue);
      Reflect.set(el, canonical, defaultValue);
      await el.updateComplete;
      expect(Reflect.get(el, canonical)).to.equal(defaultValue);
    });
    expect(warnings).to.have.length(0);
  });
}

it('workspace canonical visibility still controls the rendered details and composer', async () => {
  const el = await fixture<LyraElement>(html`<lr-agent-workspace .run=${{ id: 'run', status: { kind: 'collecting', message: 'Gathering sources' }, steps: [] }}></lr-agent-workspace>`);
  el.setAttribute('show-details', 'false');
  el.setAttribute('show-composer', 'false');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('lr-chat-composer').length).to.equal(1);
  const details = el.shadowRoot!.querySelector<HTMLElement>('[part="details"]')!;
  expect(details.hidden).to.equal(false);
  Reflect.set(el, 'withoutComposer', true);
  Reflect.set(el, 'withoutDetails', true);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('lr-chat-composer').length).to.equal(0);
  expect(details.hidden).to.equal(true);
});

for (const tag of ['lr-code-block', 'lr-code-block-core']) {
  it(`${tag} uses without-copy-button to control the actual copy action`, async () => {
    const el = await fixture<LyraElement>(`<${tag} language="text" filename="sample.txt" code="sample"></${tag}>`);
    el.setAttribute('copyable', 'false');
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('[part~="copy-button"]') !== null);
    Reflect.set(el, 'withoutCopyButton', true);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part~="copy-button"]').length).to.equal(0);
  });
}

for (const tag of ['lr-markdown', 'lr-markdown-core', 'lr-streaming-text', 'lr-streaming-text-core']) {
  it(`${tag} retains canonical GFM and code-header rendering with inert legacy attributes`, async () => {
    const el = await fixture<LyraElement>(`<${tag}></${tag}>`);
    if (tag.startsWith('lr-streaming')) Reflect.set(el, 'contentMode', 'markdown');
    el.setAttribute('gfm', 'false');
    el.setAttribute('highlight-code', 'false');
    el.setAttribute('code-block-chrome', '');
    Reflect.set(el, 'content', '| A | B |\n| - | - |\n| 1 | 2 |\n\n~~~text\nsample\n~~~');
    Reflect.set(el, 'withoutSyntaxHighlighting', true);
    await el.updateComplete;
    const contentRoot = (): ShadowRoot | null => {
      if (tag.startsWith('lr-streaming')) return el.shadowRoot!.querySelector(tag.endsWith('-core') ? 'lr-markdown-core' : 'lr-markdown')?.shadowRoot ?? null;
      return el.shadowRoot;
    };
    await waitUntil(() => contentRoot()?.querySelector('table') != null && contentRoot()?.querySelector('pre') != null);
    expect(contentRoot()!.querySelectorAll('[part~="code-block-header"]').length).to.equal(0);
    Reflect.set(el, 'codeBlockHeader', true);
    await waitUntil(() => contentRoot()!.querySelectorAll('[part~="code-block-header"]').length === 1);
    Reflect.set(el, 'withoutGfm', true);
    await waitUntil(() => contentRoot()!.querySelectorAll('table').length === 0);
    expect(contentRoot()!.querySelectorAll('pre').length).to.equal(1);
  });
}

for (const [tag, part] of [
  ['lr-code-block', 'copy-button'], ['lr-code-block-core', 'copy-button'],
  ['lr-message-actions', 'edit-button'], ['lr-message-actions', 'regenerate-button'],
]) {
  it(`${tag} exposes only the canonical ${part}-control styling hook`, async () => {
    const el = await fixture<LyraElement>(`<${tag}></${tag}>`);
    if (tag === 'lr-message-actions') Reflect.set(el, 'controls', ['edit', 'regenerate']);
    else {
      Reflect.set(el, 'filename', 'sample.txt');
      Reflect.set(el, 'code', 'sample');
    }
    await el.updateComplete;
    const child = el.shadowRoot!.querySelector<LyraElement>(`[part~="${part}"]`)!;
    await child.updateComplete;
    const control = child.shadowRoot!.querySelector<HTMLElement>('[part~="button"]')!;
    const baseline = getComputedStyle(control).paddingTop;
    const style = document.createElement('style');
    el.classList.add('retirement-part');
    document.head.append(style);
    try {
      style.textContent = `${tag}.retirement-part::part(${part}__control) { padding-top: 17px !important; }`;
      expect(getComputedStyle(control).paddingTop).to.equal(baseline);
      style.textContent += `${tag}.retirement-part::part(${part}-control) { padding-top: 19px !important; }`;
      expect(getComputedStyle(control).paddingTop).to.equal('19px');
    } finally {
      style.remove();
    }
  });
}
