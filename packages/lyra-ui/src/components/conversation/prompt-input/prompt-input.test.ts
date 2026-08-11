import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { LyraAttachmentChip } from '../../media/attachment-chip/attachment-chip.class.js';
import type { LyraChatComposer } from '../chat-composer/chat-composer.class.js';
import type { LyraMentionPopover } from '../../utility/mention-popover/mention-popover.class.js';
import './prompt-input.js';
import type { LyraPromptInput, PromptInputAttachment } from './prompt-input.class.js';
import { styles } from './prompt-input.styles.js';

interface PromptInputEditingFacade {
  readonly input: HTMLTextAreaElement | null;
  spellcheck: boolean;
  autocapitalize: string;
  autoCorrect: string;
  wrap: 'hard' | 'soft' | 'off';
  autocomplete: string;
  inputMode: string;
  enterKeyHint: string;
  selectionStart: number | null;
  selectionEnd: number | null;
  selectionDirection: 'forward' | 'backward' | 'none' | null;
  select(): void;
  setSelectionRange(start: number | null, end: number | null, direction?: 'forward' | 'backward' | 'none'): void;
  setRangeText(replacement: string): void;
  setRangeText(replacement: string, start: number, end: number, selectMode?: SelectionMode): void;
}

it('declares a fallback for --lr-control-width so an unset value never leaves the controls row sizing invalid (regression)', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/min-inline-size:\s*min\(100%,\s*var\(--lr-control-width,\s*[^)]+\)\)/);
  expect(css).to.match(/flex:\s*1 1 var\(--lr-control-width,\s*[^)]+\)/);
});

it('names the semantic group that owns the prompt option controls', async () => {
  const el = (await fixture(html`
    <lr-prompt-input
      .modelCatalog=${[{ group: 'Models', models: [{ value: 'fast', label: 'Fast' }] }]}
    ></lr-prompt-input>
  `)) as LyraPromptInput;
  const controls = el.shadowRoot!.querySelector('[part="controls"]')!;
  expect(controls.getAttribute('role')).to.equal('group');
  expect(controls.getAttribute('aria-label')).to.equal('Prompt options');
});

it('is deliberately event-submitted rather than a native successful form control', async () => {
  const form = (await fixture(html`
    <form>
      <lr-prompt-input name="prompt" .value=${'Summarize the report'}></lr-prompt-input>
    </form>
  `)) as HTMLFormElement;
  const element = form.querySelector('lr-prompt-input') as LyraPromptInput;

  expect(new FormData(form).has('prompt')).to.be.false;
  expect('getForm' in element).to.be.false;
});

it('keeps a definite flex-basis for controls even when --lr-control-width is never set (regression)', async () => {
  const el = (await fixture(
    html`<lr-prompt-input .modelCatalog=${['fast', 'accurate']}></lr-prompt-input>`,
  )) as LyraPromptInput;
  await el.updateComplete;
  const control = el.shadowRoot!.querySelector('[part="controls"] > *') as HTMLElement;
  expect((control) != null, 'expected at least one rendered control').to.equal(true);
  // Without a fallback, an unset custom property makes `var(--lr-control-width)` invalid at
  // computed-value time, which invalidates the whole `flex` shorthand declaration and falls the
  // basis back to its initial `auto` -- a definite length here proves the fallback took effect.
  expect(getComputedStyle(control).flexBasis).to.not.equal('auto');
});

it('composes attachments, model, voice, sources, queue, and the chat composer', async () => {
  const el = (await fixture(html`<lr-prompt-input
    .attachments=${[{ id: 'doc-1', name: 'report.pdf', mimeType: 'application/pdf' }]}
    .modelCatalog=${['fast', 'accurate']}
    .voiceCatalog=${['calm', 'bright']}
    .sources=${[{ id: 'doc-1', label: 'Report' }]}
    .queue=${[{ id: 'q1', value: 'Follow up' }]}
  ></lr-prompt-input>`)) as LyraPromptInput;

  expect(el.shadowRoot!.querySelectorAll('lr-chat-composer')).to.have.lengthOf(1);
  expect(el.shadowRoot!.querySelectorAll('lr-attachment-chip')).to.have.lengthOf(1);
  expect(el.shadowRoot!.querySelectorAll('lr-model-select')).to.have.lengthOf(1);
  expect(el.shadowRoot!.querySelectorAll('lr-voice-picker')).to.have.lengthOf(1);
  expect(el.shadowRoot!.querySelectorAll('lr-source-picker')).to.have.lengthOf(1);
  expect(el.shadowRoot!.querySelectorAll('lr-prompt-queue')).to.have.lengthOf(1);
});

it('detects mention triggers, anchors the popover to the real textarea, and inserts a selection', async () => {
  const el = (await fixture(html`<lr-prompt-input
    .mentionItems=${[
      { id: 'ada', label: 'Ada', description: 'Engineering' },
      { id: 'adam', label: 'Adam', description: 'Research' },
    ]}
  ></lr-prompt-input>`)) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector('lr-chat-composer') as LyraChatComposer;
  composer.value = 'Hello @ad';
  await composer.updateComplete;
  expect(composer.input?.tagName).to.equal('TEXTAREA');
  composer.selectionStart = composer.value.length;
  composer.selectionEnd = composer.value.length;
  composer.dispatchEvent(
    new CustomEvent('lr-input', { bubbles: true, composed: true, detail: { value: composer.value } }),
  );
  await el.updateComplete;
  const popover = el.shadowRoot!.querySelector('lr-mention-popover') as LyraMentionPopover;
  await popover.updateComplete;
  expect(popover.open).to.be.true;
  expect(popover.query).to.equal('ad');
  expect(popover.anchor?.tagName).to.equal('TEXTAREA');
  expect(
    composer.input?.hasAttribute('aria-controls'),
    'a document-owned input must not publish a string IDREF into the popover shadow root',
  ).to.be.false;
  const reflected = (
    composer.input as HTMLTextAreaElement & { ariaActiveDescendantElement?: Element | null }
  ).ariaActiveDescendantElement === popover.activeDescendantElement;
  if (!reflected) {
    expect(
      composer.input?.hasAttribute('aria-activedescendant'),
      'unsupported cross-root reflection must fail closed without a broken string IDREF',
    ).to.be.false;
  }

  composer.input!.focus();
  const initialActiveDescendant = popover.activeDescendantId;
  const keydown = new KeyboardEvent('keydown', {
    key: 'ArrowDown',
    bubbles: true,
    composed: true,
    cancelable: true,
  });
  composer.input!.dispatchEvent(keydown);
  await el.updateComplete;
  expect(keydown.defaultPrevented).to.be.true;
  expect(popover.activeDescendantId).to.not.equal(initialActiveDescendant);
  await waitUntil(() => {
    const currentReflection = (
      composer.input as HTMLTextAreaElement & { ariaActiveDescendantElement?: Element | null }
    ).ariaActiveDescendantElement;
    return (
      currentReflection === popover.activeDescendantElement ||
      (popover.shadowRoot!.activeElement as HTMLElement | null)?.dataset.id === 'adam'
    );
  });
  const usesReflection = (
    composer.input as HTMLTextAreaElement & { ariaActiveDescendantElement?: Element | null }
  ).ariaActiveDescendantElement === popover.activeDescendantElement;
  if (usesReflection) {
    expect(
      (composer.input as HTMLTextAreaElement & { ariaActiveDescendantElement?: Element | null })
        .ariaActiveDescendantElement === popover.activeDescendantElement,
    ).to.be.true;
    expect(composer.shadowRoot!.activeElement === composer.input).to.be.true;
  } else {
    expect(
      composer.input?.hasAttribute('aria-activedescendant'),
      'the fallback must continue avoiding a broken string IDREF',
    ).to.be.false;
    expect((popover.shadowRoot!.activeElement as HTMLElement | null)?.dataset.id).to.equal('adam');
  }

  const selected = oneEvent(el, 'lr-mention-select');
  popover.dispatchEvent(
    new CustomEvent('lr-mention-select', {
      bubbles: true,
      composed: true,
      detail: { id: 'ada', label: 'Ada' },
    }),
  );
  const event = await selected as CustomEvent<{ id: string; label: string; trigger: '@' }>;
  expect(event.detail).to.deep.equal({ id: 'ada', label: 'Ada', trigger: '@' });
  expect(el.value).to.equal('Hello @Ada ');
});

it('recognizes slash commands and clears suggestions after ordinary input', async () => {
  const el = (await fixture(html`<lr-prompt-input></lr-prompt-input>`)) as LyraPromptInput;
  el.commandItems = [{ id: 'summarize', label: 'Summarize', insertText: 'summary' }];
  await el.updateComplete;
  const composer = el.shadowRoot!.querySelector('lr-chat-composer') as LyraChatComposer;
  const popover = el.shadowRoot!.querySelector('lr-mention-popover') as LyraMentionPopover;

  composer.value = '/summ';
  await composer.updateComplete;
  composer.selectionStart = composer.value.length;
  composer.dispatchEvent(
    new CustomEvent('lr-input', {
      bubbles: true,
      composed: true,
      detail: { value: composer.value },
    }),
  );
  await el.updateComplete;
  await popover.updateComplete;
  expect(popover.open).to.be.true;
  expect(popover.query).to.equal('summ');

  composer.value = 'ordinary text';
  await composer.updateComplete;
  composer.selectionStart = composer.value.length;
  composer.dispatchEvent(
    new CustomEvent('lr-input', {
      bubbles: true,
      composed: true,
      detail: { value: composer.value },
    }),
  );
  await el.updateComplete;
  await popover.updateComplete;
  expect(popover.open).to.be.false;

  composer.value = '/summ';
  await composer.updateComplete;
  composer.selectionStart = composer.value.length;
  composer.dispatchEvent(
    new CustomEvent('lr-input', {
      bubbles: true,
      composed: true,
      detail: { value: composer.value },
    }),
  );
  await el.updateComplete;
  await popover.updateComplete;
  const selected = oneEvent(el, 'lr-mention-select');
  popover.dispatchEvent(
    new CustomEvent('lr-mention-select', {
      bubbles: true,
      composed: true,
      detail: { id: 'summarize', label: 'Summarize' },
    }),
  );
  expect((await selected as CustomEvent<{ id: string; label: string; trigger: '/' }>).detail).to.deep.equal({
    id: 'summarize',
    label: 'Summarize',
    trigger: '/',
  });
  expect(el.value).to.equal('/summary ');
});

it('invalidates a suggestion session when the controlled value changes', async () => {
  const el = (await fixture(html`
    <lr-prompt-input .mentionItems=${[{ id: 'ada', label: 'Ada' }]}></lr-prompt-input>
  `)) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector('lr-chat-composer') as LyraChatComposer;
  composer.value = 'Hello @ad';
  await composer.updateComplete;
  composer.selectionStart = composer.value.length;
  composer.dispatchEvent(
    new CustomEvent('lr-input', {
      bubbles: true,
      composed: true,
      detail: { value: composer.value },
    }),
  );
  await el.updateComplete;
  const popover = el.shadowRoot!.querySelector('lr-mention-popover') as LyraMentionPopover;
  expect(popover.open).to.be.true;

  el.value = 'Controlled replacement';
  await el.updateComplete;
  await popover.updateComplete;
  expect(popover.open).to.be.false;

  popover.dispatchEvent(
    new CustomEvent('lr-mention-select', {
      bubbles: true,
      composed: true,
      detail: { id: 'ada', label: 'Ada' },
    }),
  );
  expect(el.value).to.equal('Controlled replacement');
});

it('invalidates a suggestion session when its public item collection changes', async () => {
  const el = (await fixture(html`
    <lr-prompt-input .mentionItems=${[{ id: 'ada', label: 'Ada' }]}></lr-prompt-input>
  `)) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector('lr-chat-composer') as LyraChatComposer;
  composer.value = '@a';
  await composer.updateComplete;
  composer.selectionStart = composer.value.length;
  composer.dispatchEvent(
    new CustomEvent('lr-input', {
      bubbles: true,
      composed: true,
      detail: { value: composer.value },
    }),
  );
  await el.updateComplete;
  const popover = el.shadowRoot!.querySelector('lr-mention-popover') as LyraMentionPopover;
  expect(popover.open).to.be.true;

  el.mentionItems = [{ id: 'bea', label: 'Bea' }];
  await el.updateComplete;
  await popover.updateComplete;
  expect(popover.open).to.be.false;
});

it('does not revive a stale suggestion session after disable and re-enable', async () => {
  const el = (await fixture(html`
    <lr-prompt-input .mentionItems=${[{ id: 'ada', label: 'Ada' }]}></lr-prompt-input>
  `)) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector('lr-chat-composer') as LyraChatComposer;
  composer.value = '@a';
  await composer.updateComplete;
  composer.selectionStart = composer.value.length;
  composer.dispatchEvent(
    new CustomEvent('lr-input', {
      bubbles: true,
      composed: true,
      detail: { value: composer.value },
    }),
  );
  await el.updateComplete;
  const popover = el.shadowRoot!.querySelector('lr-mention-popover') as LyraMentionPopover;

  el.disabled = true;
  await el.updateComplete;
  el.disabled = false;
  await el.updateComplete;
  await popover.updateComplete;

  expect(popover.open).to.be.false;
});

it('forwards composer submit and stop events from its own host', async () => {
  const el = (await fixture(html`<lr-prompt-input value="Question"></lr-prompt-input>`)) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector('lr-chat-composer')!;

  const submit = oneEvent(el, 'lr-submit');
  composer.dispatchEvent(
    new CustomEvent('lr-submit', { bubbles: true, composed: true, detail: { value: 'Question' } }),
  );
  expect((await submit as CustomEvent<{ value: string }>).detail.value).to.equal('Question');

  const stop = oneEvent(el, 'lr-stop');
  composer.dispatchEvent(new CustomEvent('lr-stop', { bubbles: true, composed: true }));
  await stop;
});

it('emits attachment additions and removals as controlled requests', async () => {
  const el = (await fixture(html`<lr-prompt-input
    .attachments=${[{ id: 'doc-1', name: 'report.pdf' }]}
  ></lr-prompt-input>`)) as LyraPromptInput;
  const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
  const added = oneEvent(el, 'lr-attachments-add');
  el.shadowRoot!.querySelector('lr-attachment-trigger')!.dispatchEvent(
    new CustomEvent('lr-pick', {
      bubbles: true,
      composed: true,
      detail: { capability: 'files', files: [file] },
    }),
  );
  expect((await added as CustomEvent<{ files: File[] }>).detail.files[0]?.name).to.equal('hello.txt');

  const removed = oneEvent(el, 'lr-attachment-remove');
  el.shadowRoot!.querySelector('lr-attachment-chip')!.dispatchEvent(
    new CustomEvent('lr-remove', { bubbles: true, composed: true, detail: { id: 'doc-1' } }),
  );
  expect((await removed as CustomEvent<{ id: string }>).detail.id).to.equal('doc-1');
});

it('translates composed control events from its host without leaking the raw child events', async () => {
  const el = (await fixture(html`<lr-prompt-input
    .attachments=${[{
      id: 'doc-1',
      name: 'report.pdf',
      mimeType: 'application/pdf',
      uri: 'https://example.test/report.pdf',
    }]}
    .modelCatalog=${['fast']}
    .sources=${[{ id: 'doc-1', label: 'Report' }]}
  ></lr-prompt-input>`)) as LyraPromptInput;
  const modelSelect = el.shadowRoot!.querySelector('lr-model-select')!;
  const sourcePicker = el.shadowRoot!.querySelector('lr-source-picker')!;
  const attachment = el.shadowRoot!.querySelector('lr-attachment-chip')!;

  let leakedModelChanges = 0;
  el.addEventListener('lr-change', () => leakedModelChanges++);
  const modelChanged = oneEvent(el, 'lr-model-change');
  modelSelect.dispatchEvent(new CustomEvent('lr-change', {
    bubbles: true,
    composed: true,
    detail: { value: 'fast', inCatalog: true },
  }));
  const modelEvent = await modelChanged as CustomEvent<{ value: string; inCatalog: boolean }>;
  expect(modelEvent.target === el).to.be.true;
  expect(modelEvent.detail).to.deep.equal({ value: 'fast', inCatalog: true });
  expect(leakedModelChanges).to.equal(0);

  const sourceTargets: string[] = [];
  el.addEventListener('lr-sources-change', (event) => {
    sourceTargets.push((event.target as Element).tagName);
  });
  sourcePicker.dispatchEvent(new CustomEvent('lr-sources-change', {
    bubbles: true,
    composed: true,
    detail: { selectedIds: ['doc-1'] },
  }));
  expect(sourceTargets).to.deep.equal(['LR-PROMPT-INPUT']);

  const previewed = oneEvent(el, 'lr-attachment-preview');
  attachment.dispatchEvent(new CustomEvent('lr-preview', {
    bubbles: true,
    composed: true,
    detail: {
      id: 'doc-1',
      name: 'report.pdf',
      mimeType: 'application/pdf',
      src: 'https://example.test/report.pdf',
    },
  }));
  const previewEvent = await previewed as CustomEvent<{ id: string; src: string }>;
  expect(previewEvent.target === el).to.be.true;
  expect(previewEvent.detail.id).to.equal('doc-1');
  expect(previewEvent.detail.src).to.equal('https://example.test/report.pdf');
});

it('forwards attachment lifecycle state and exposes a translated retry request', async () => {
  const attachments: PromptInputAttachment[] = [
    {
      id: 'failed-doc',
      name: 'failed.pdf',
      status: 'error',
    },
    {
      id: 'uploading-doc',
      name: 'uploading.pdf',
      status: 'uploading',
      progress: 42,
    },
  ];
  const el = (await fixture(html`<lr-prompt-input
    .attachments=${attachments}
  ></lr-prompt-input>`)) as LyraPromptInput;
  const chips = Array.from(
    el.shadowRoot!.querySelectorAll('lr-attachment-chip'),
  ) as LyraAttachmentChip[];
  const failed = chips[0]!;
  const uploading = chips[1]!;
  await Promise.all(chips.map((chip) => chip.updateComplete));

  expect(failed.status).to.equal('error');
  expect(uploading.status).to.equal('uploading');
  expect(uploading.progress).to.equal(42);
  expect(
    uploading.shadowRoot!.querySelector('[part="progress"]')?.getAttribute('aria-valuenow'),
  ).to.equal('42');

  let rawRetries = 0;
  el.addEventListener('lr-retry', () => rawRetries++);
  const retried = oneEvent(el, 'lr-attachment-retry');
  failed.dispatchEvent(new CustomEvent('lr-retry', {
    bubbles: true,
    composed: true,
    detail: { id: 'failed-doc' },
  }));
  const retryEvent = await retried as CustomEvent<{ id: string }>;
  expect(retryEvent.target === el).to.be.true;
  expect(retryEvent.detail.id).to.equal('failed-doc');
  expect(rawRetries).to.equal(0);
});

it('gates every composed interaction while disabled and forwards host click to the composer', async () => {
  const el = (await fixture(html`<lr-prompt-input
    disabled
    .attachments=${[{ id: 'doc-1', name: 'report.pdf' }]}
    .sources=${[{ id: 'doc-1', label: 'Report' }]}
    .mentionItems=${[{ id: 'ada', label: 'Ada' }]}
  ></lr-prompt-input>`)) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector('lr-chat-composer') as LyraChatComposer;
  const attachment = el.shadowRoot!.querySelector('lr-attachment-chip')!;
  const attachmentTrigger = el.shadowRoot!.querySelector('lr-attachment-trigger')!;
  const sources = el.shadowRoot!.querySelector('details')!;
  const popover = el.shadowRoot!.querySelector('lr-mention-popover') as LyraMentionPopover;
  let additions = 0;
  let removals = 0;
  el.addEventListener('lr-attachments-add', () => additions++);
  el.addEventListener('lr-attachment-remove', () => removals++);

  expect(attachment.removable).to.be.false;
  expect(sources.inert).to.be.true;
  expect(popover.open).to.be.false;

  attachmentTrigger.dispatchEvent(new CustomEvent('lr-pick', {
    bubbles: true,
    composed: true,
    detail: { capability: 'files', files: [] },
  }));
  attachment.dispatchEvent(new CustomEvent('lr-remove', {
    bubbles: true,
    composed: true,
    detail: { id: 'doc-1' },
  }));
  expect(additions).to.equal(0);
  expect(removals).to.equal(0);

  el.click();
  expect((composer.shadowRoot!.activeElement) == null).to.equal(true);
  el.disabled = false;
  await el.updateComplete;
  el.click();
  expect(composer.shadowRoot!.activeElement?.getAttribute('part')).to.equal('textarea');
});

it('makes previewable attachments inert and suppresses their wrapper events while disabled', async () => {
  const el = (await fixture(html`<lr-prompt-input
    disabled
    .attachments=${[{
      id: 'doc-1',
      name: 'report.pdf',
      mimeType: 'application/pdf',
      uri: 'https://example.test/report.pdf',
    }]}
  ></lr-prompt-input>`)) as LyraPromptInput;
  const attachment = el.shadowRoot!.querySelector('lr-attachment-chip') as HTMLElement & {
    inert: boolean;
  };
  let previewEvents = 0;
  el.addEventListener('lr-attachment-preview', () => previewEvents++);

  attachment.dispatchEvent(new CustomEvent('lr-preview', {
    bubbles: true,
    composed: true,
    detail: {
      id: 'doc-1',
      name: 'report.pdf',
      mimeType: 'application/pdf',
      src: 'https://example.test/report.pdf',
    },
  }));

  expect(attachment.inert).to.be.true;
  expect(previewEvents).to.equal(0);
});

it('applies per-instance strings to the prompt label', async () => {
  const el = (await fixture(
    html`<lr-prompt-input .strings=${{ promptInputLabel: 'Invite IA' }}></lr-prompt-input>`,
  )) as LyraPromptInput;
  expect(el.shadowRoot!.querySelector('[part="base"]')?.getAttribute('aria-label')).to.equal('Invite IA');
});

it('is accessible with its composed controls populated', async () => {
  const el = await fixture(html`<lr-prompt-input
    .modelCatalog=${['fast']}
    .sources=${[{ id: 'doc-1', label: 'Report' }]}
    .mentionItems=${[{ id: 'ada', label: 'Ada' }]}
  ></lr-prompt-input>`);
  expect(el.shadowRoot!.querySelectorAll('lr-chat-composer')).to.have.lengthOf(1);
  await expect(el).to.be.accessible();
});

// -- Focus/selection delegation to the embedded composer --------------------

it('delegates focus(), blur() and select() to the embedded composer', async () => {
  const el = (await fixture(html`<lr-prompt-input></lr-prompt-input>`)) as LyraPromptInput;
  await el.updateComplete;
  const composer = el.shadowRoot!.querySelector('lr-chat-composer') as LyraChatComposer;
  await composer.updateComplete;
  const textarea = composer.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;

  el.focus();
  expect((composer.shadowRoot!.activeElement) === (textarea)).to.equal(true);

  el.value = 'draft text';
  await el.updateComplete;
  await composer.updateComplete;
  el.select();
  expect(textarea.selectionStart).to.equal(0);
  expect(textarea.selectionEnd).to.equal(textarea.value.length);

  el.blur();
  expect((composer.shadowRoot!.activeElement) !== (textarea)).to.equal(true);
});

it('forwards editing-assistance attributes to the nested native textarea', async () => {
  const el = (await fixture(html`
    <lr-prompt-input
      spellcheck="false"
      autocapitalize="off"
      autocorrect="off"
      wrap="hard"
      autocomplete="one-time-code"
      inputmode="numeric"
      enterkeyhint="send"
    ></lr-prompt-input>
  `)) as LyraPromptInput;
  const facade = el as LyraPromptInput & PromptInputEditingFacade;
  const composer = el.shadowRoot!.querySelector('lr-chat-composer') as LyraChatComposer;
  await composer.updateComplete;
  const textarea = composer.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;

  expect(facade.spellcheck).to.be.false;
  expect(facade.autocapitalize).to.equal('off');
  expect(facade.autoCorrect).to.equal('off');
  expect(facade.wrap).to.equal('hard');
  expect(facade.autocomplete).to.equal('one-time-code');
  expect(facade.inputMode).to.equal('numeric');
  expect(facade.enterKeyHint).to.equal('send');
  expect(textarea.spellcheck).to.be.false;
  expect(textarea.getAttribute('autocapitalize')).to.equal('off');
  expect(textarea.getAttribute('autocorrect')).to.equal('off');
  expect(textarea.getAttribute('wrap')).to.equal('hard');
  expect(textarea.getAttribute('autocomplete')).to.equal('one-time-code');
  expect(textarea.getAttribute('inputmode')).to.equal('numeric');
  expect(textarea.getAttribute('enterkeyhint')).to.equal('send');
});

it('leaves native editing-assistance defaults unchanged when the new prompt properties are unset', async () => {
  const el = (await fixture(html`<lr-prompt-input></lr-prompt-input>`)) as LyraPromptInput;
  const facade = el as LyraPromptInput & PromptInputEditingFacade;
  const composer = el.shadowRoot!.querySelector('lr-chat-composer') as LyraChatComposer;
  await composer.updateComplete;
  const textarea = composer.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;

  expect(facade.spellcheck).to.be.true;
  expect(facade.autocapitalize).to.equal('');
  expect(facade.autoCorrect).to.equal('');
  expect(facade.wrap).to.equal('soft');
  expect(facade.autocomplete).to.equal('');
  expect(facade.inputMode).to.equal('');
  expect(facade.enterKeyHint).to.equal('');
  expect(textarea.spellcheck).to.be.true;
  expect(textarea.getAttribute('wrap')).to.equal('soft');
  expect(textarea.hasAttribute('autocapitalize')).to.be.false;
  expect(textarea.hasAttribute('autocorrect')).to.be.false;
  expect(textarea.hasAttribute('autocomplete')).to.be.false;
  expect(textarea.hasAttribute('inputmode')).to.be.false;
  expect(textarea.hasAttribute('enterkeyhint')).to.be.false;
});

it('forwards selection and silent range editing while synchronizing the outer prompt value', async () => {
  const el = (await fixture(html`<lr-prompt-input value="hello world"></lr-prompt-input>`)) as LyraPromptInput;
  const facade = el as LyraPromptInput & PromptInputEditingFacade;
  const composer = el.shadowRoot!.querySelector('lr-chat-composer') as LyraChatComposer;
  await composer.updateComplete;
  const textarea = composer.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  let inputEvents = 0;
  el.addEventListener('lr-input', () => inputEvents++);

  expect(facade.input === textarea).to.be.true;
  facade.select();
  expect(facade.selectionStart).to.equal(0);
  expect(facade.selectionEnd).to.equal('hello world'.length);

  facade.setSelectionRange(6, 11, 'forward');
  expect(facade.selectionStart).to.equal(6);
  expect(facade.selectionEnd).to.equal(11);
  expect(facade.selectionDirection).to.equal('forward');

  facade.selectionStart = 0;
  facade.selectionEnd = textarea.value.length;
  facade.selectionDirection = 'backward';
  expect(textarea.selectionStart).to.equal(0);
  expect(textarea.selectionEnd).to.equal('hello world'.length);
  expect(textarea.selectionDirection).to.equal('backward');

  facade.setRangeText('Lyra', 6, 11, 'select');
  expect(el.value).to.equal('hello Lyra');
  expect(composer.value).to.equal('hello Lyra');
  expect(textarea.value).to.equal('hello Lyra');

  facade.setSelectionRange(6, 10);
  facade.setRangeText('world');
  expect(el.value).to.equal('hello world');
  expect(composer.value).to.equal('hello world');
  expect(inputEvents).to.equal(0);
});

it('keeps the text editing facade inert before the composed textarea renders', () => {
  const detached = document.createElement('lr-prompt-input') as LyraPromptInput & PromptInputEditingFacade;

  expect(detached.input === null).to.be.true;
  expect(detached.selectionStart).to.equal(null);
  expect(detached.selectionEnd).to.equal(null);
  expect(detached.selectionDirection).to.equal(null);
  expect(() => {
    detached.selectionStart = 0;
    detached.selectionEnd = 0;
    detached.selectionDirection = 'forward';
    detached.select();
    detached.setSelectionRange(0, 0);
    detached.setRangeText('ignored');
  }).to.not.throw();
  expect(detached.value).to.equal('');
});
