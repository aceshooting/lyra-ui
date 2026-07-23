import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './prompt-studio.js';
import type { LyraPromptStudio, PromptStudioMessage, PromptStudioVersion } from './prompt-studio.js';

const messages: PromptStudioMessage[] = [
  { id: 'system', role: 'system', content: 'Answer for {{audience}}.' },
  { id: 'user', role: 'user', content: 'Explain retrieval.' },
];
const versions: PromptStudioVersion[] = [{ id: 'v1', label: 'Production', messages }];

it('renders messages, resolves variables in preview, and exposes versions', async () => {
  const el = (await fixture(
    html`<lr-prompt-studio
      .messages=${messages}
      .variables=${[{ name: 'audience', value: 'developers' }]}
      .versions=${versions}
    ></lr-prompt-studio>`,
  )) as LyraPromptStudio;
  expect(el.shadowRoot!.querySelectorAll('[part="message"]').length).to.equal(2);
  expect(el.shadowRoot!.querySelector('[part="preview"]')!.textContent).to.contain('Answer for developers.');
  expect(el.shadowRoot!.querySelector('[data-version-id="v1"]')).to.exist;
});

it('emits immutable edits, run requests, and complete version records', async () => {
  const el = (await fixture(
    html`<lr-prompt-studio .messages=${messages} .versions=${versions}></lr-prompt-studio>`,
  )) as LyraPromptStudio;
  const changePending = oneEvent(el, 'lr-change');
  const textarea = el.shadowRoot!.querySelector('textarea')!;
  textarea.value = 'Changed';
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
  const changed = await changePending;
  expect(changed.detail.messages[0].content).to.equal('Changed');
  expect(messages[0]!.content).to.equal('Answer for {{audience}}.');

  const runPending = oneEvent(el, 'lr-run');
  (el.shadowRoot!.querySelector('[part="run"]') as HTMLButtonElement).click();
  expect((await runPending).detail.messages).to.have.length(2);

  const versionPending = oneEvent(el, 'lr-version-select');
  (el.shadowRoot!.querySelector('[data-version-id="v1"]') as HTMLButtonElement).click();
  expect((await versionPending).detail).to.deep.equal({ version: versions[0] });
});

it('is accessible when populated and gates all editing controls while disabled', async () => {
  const el = (await fixture(
    html`<lr-prompt-studio disabled .messages=${messages} .versions=${versions}></lr-prompt-studio>`,
  )) as LyraPromptStudio;
  expect([...el.shadowRoot!.querySelectorAll('button, textarea, input')].every((node) => (node as HTMLInputElement).disabled)).to.be.true;
  await expect(el).shadowDom.to.be.accessible();
});

it('applies per-instance localized strings', async () => {
  const el = (await fixture(html`<lr-prompt-studio
    .strings=${{ promptStudioLabel: 'Localized prompt workshop' }}
  ></lr-prompt-studio>`)) as LyraPromptStudio;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Localized prompt workshop');
});

it('keeps both variable controls named when a caller supplies an empty variable name', async () => {
  const el = (await fixture(html`<lr-prompt-studio
    .variables=${[{ name: '', value: 'developers' }]}
  ></lr-prompt-studio>`)) as LyraPromptStudio;
  const inputs = [...el.shadowRoot!.querySelectorAll('[part="variable"] input')];
  expect(inputs.map((input) => input.getAttribute('aria-label'))).to.deep.equal([
    'Variable 1 name',
    'Variable 1 value',
  ]);
});

it('generates a unique message id even when the timestamp-based candidate already exists', async () => {
  const originalNow = Date.now;
  Date.now = () => 123;
  try {
    const existing: PromptStudioMessage[] = [
      { id: 'message-123-1', role: 'system', content: 'Keep me' },
    ];
    const el = (await fixture(html`<lr-prompt-studio .messages=${existing}></lr-prompt-studio>`)) as LyraPromptStudio;
    const pending = oneEvent(el, 'lr-change');
    (el.shadowRoot!.querySelector('[part="add-message"]') as HTMLButtonElement).click();
    const event = await pending;
    const ids = event.detail.messages.map((message: PromptStudioMessage) => message.id);
    expect(new Set(ids).size).to.equal(2);
    expect(ids[0]).to.equal('message-123-1');
  } finally {
    Date.now = originalNow;
  }
});

it('renders and exposes a component-scoped theme hook for the selected version', async () => {
  const el = (await fixture(html`
    <lr-prompt-studio
      style="--lr-prompt-studio-version-selected-border: rgb(1, 2, 3)"
      selected-version-id="v1"
      .versions=${versions}
    ></lr-prompt-studio>
  `)) as LyraPromptStudio;
  const version = el.shadowRoot!.querySelector('[part="version"]') as HTMLElement;
  expect(version.getAttribute('aria-pressed')).to.equal('true');
  expect(getComputedStyle(version).borderTopColor).to.equal('rgb(1, 2, 3)');
});
