import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import type { LyraChatComposer } from '../chat-composer/chat-composer.class.js';
import type { LyraMentionPopover } from '../../utility/mention-popover/mention-popover.class.js';
import './prompt-input.js';
import type { LyraPromptInput } from './prompt-input.class.js';

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

it('gates every composed interaction while disabled and forwards host click to the composer', async () => {
  const el = (await fixture(html`<lr-prompt-input
    disabled
    .attachments=${[{ id: 'doc-1', name: 'report.pdf' }]}
    .sources=${[{ id: 'doc-1', label: 'Report' }]}
    .mentionItems=${[{ id: 'ada', label: 'Ada' }]}
  ></lr-prompt-input>`)) as LyraPromptInput;
  const composer = el.shadowRoot!.querySelector('lr-chat-composer') as LyraChatComposer;
  const attachment = el.shadowRoot!.querySelector('lr-attachment-chip')!;
  const sources = el.shadowRoot!.querySelector('details')!;
  const popover = el.shadowRoot!.querySelector('lr-mention-popover') as LyraMentionPopover;

  expect(attachment.removable).to.be.false;
  expect(sources.inert).to.be.true;
  expect(popover.open).to.be.false;

  el.click();
  expect(composer.shadowRoot!.activeElement).to.not.exist;
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
