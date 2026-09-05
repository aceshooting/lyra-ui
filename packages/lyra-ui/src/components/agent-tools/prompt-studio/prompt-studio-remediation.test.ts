import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './prompt-studio.js';
import type { LyraPromptStudio, PromptStudioMessage, PromptStudioVariable } from './prompt-studio.js';

const limitMessage = 'Aperçu indisponible : limite de développement atteinte.';
const previewLimit = 1_048_576;

function chain(length: number, leaf = 'resolved'): PromptStudioVariable[] {
  return Array.from({ length }, (_, index) => ({
    name: `v${index}`,
    value: index + 1 < length ? `{{v${index + 1}}}` : leaf,
  }));
}

async function studio(contents: string[], variables: PromptStudioVariable[] = []): Promise<LyraPromptStudio> {
  return fixture<LyraPromptStudio>(html`<lr-prompt-studio
    .messages=${contents.map((content, index): PromptStudioMessage => ({ id: `m${index}`, role: 'user', content }))}
    .variables=${variables}
    .strings=${{ promptStudioPreviewLimit: limitMessage }}
  ></lr-prompt-studio>`);
}

function previewTexts(el: LyraPromptStudio): string[] {
  return Array.from(el.shadowRoot!.querySelectorAll('[part="preview"] pre'), (pre) => pre.textContent ?? '');
}

function expectLimit(el: LyraPromptStudio): void {
  expect(el.shadowRoot!.querySelector('[part="preview"]')!.textContent!.includes(limitMessage), 'localized limit fallback').to.equal(true);
  expect(previewTexts(el).length).to.equal(0);
}

describe('prompt preview resource bounds', () => {
  it('allows 64 nested resolutions and falls back at 65', async () => {
    const el = await studio(['{{v0}}'], chain(64));
    expect(previewTexts(el)).to.deep.equal(['resolved']);
    el.variables = chain(65);
    await el.updateComplete;
    expectLimit(el);
  });

  it('allows 10,000 substitutions and stops at the next one even when each result is empty', async () => {
    const el = await studio(['{{empty}}'.repeat(10_000)], [{ name: 'empty', value: '' }]);
    expect(previewTexts(el)).to.deep.equal(['']);
    el.messages = [{ id: 'm0', role: 'user', content: '{{empty}}'.repeat(10_001) }];
    await el.updateComplete;
    expectLimit(el);
  });

  it('shares the substitution work budget across all message previews', async () => {
    const el = await studio(['{{missing}}'.repeat(5_000), '{{missing}}'.repeat(5_001)]);
    expectLimit(el);
  });

  it('counts aggregate preview output in UTF-16 units across messages', async () => {
    const content = '😀'.repeat(previewLimit / 4);
    const el = await studio([content, content]);
    expect(previewTexts(el).map((text) => text.length)).to.deep.equal([previewLimit / 2, previewLimit / 2]);
    el.messages = [...el.messages, { id: 'extra', role: 'user', content: 'x' }];
    await el.updateComplete;
    expectLimit(el);
  });

  it('stops multiplicative expansion with a small source model', async () => {
    const variables: PromptStudioVariable[] = [{ name: 'v0', value: 'x' }];
    for (let index = 1; index <= 21; index++) {
      variables.push({ name: `v${index}`, value: `{{v${index - 1}}}{{v${index - 1}}}` });
    }
    const el = await studio(['{{v21}}'], variables);
    expectLimit(el);
  });

  it('checks repeated cached substitutions against the remaining output budget', async () => {
    const el = await studio(['{{half}}{{half}}'], [{ name: 'half', value: 'x'.repeat(previewLimit / 2) }]);
    expect(previewTexts(el).map((text) => text.length)).to.deep.equal([previewLimit]);
    el.messages = [{ id: 'm0', role: 'user', content: '{{half}}{{half}}x' }];
    await el.updateComplete;
    expectLimit(el);
  });

  it('bounds aggregate memoized intermediate text separately from final output', async () => {
    const leaf = 'x'.repeat(previewLimit / 4);
    const el = await studio(['{{v0}}'], chain(4, leaf));
    expect(previewTexts(el).map((text) => text.length)).to.deep.equal([previewLimit / 4]);
    el.variables = chain(5, leaf);
    await el.updateComplete;
    expectLimit(el);
  });

  it('shares the memoized-text budget across the preview projection', async () => {
    const el = await studio(['{{v0}}', '{{v0}}'], chain(2, 'x'.repeat(200_000)));
    expect(previewTexts(el).map((text) => text.length)).to.deep.equal([200_000, 200_000]);
    el.messages = [...el.messages, { id: 'third', role: 'user', content: '{{v0}}' }];
    await el.updateComplete;
    expectLimit(el);
  });

  it('preserves ordinary recursive, missing and cyclic placeholders independently in each message', async () => {
    const el = await studio(['{{greeting}} {{missing}}', '{{a}}', '{{b}}'], [
      { name: 'greeting', value: 'Hello {{audience}}' },
      { name: 'audience', value: 'reader' },
      { name: 'a', value: '{{b}}' },
      { name: 'b', value: '{{a}}' },
    ]);
    expect(previewTexts(el)).to.deep.equal(['Hello reader {{missing}}', '{{a}}', '{{b}}']);
  });

  it('keeps raw state, run/save payloads and editing usable after a preview limit', async () => {
    const variables = chain(65);
    const el = await studio(['{{v0}}'], variables);
    expectLimit(el);
    expect(el.messages[0]!.content).to.equal('{{v0}}');
    expect(el.variables).to.deep.equal(variables);
    for (const action of ['run', 'save']) {
      const pending = oneEvent(el, `lr-${action}`);
      el.shadowRoot!.querySelector<HTMLButtonElement>(`[part="${action}"]`)!.click();
      const event = await pending;
      expect(event.detail.messages).to.deep.equal([{ id: 'm0', role: 'user', content: '{{v0}}' }]);
      expect(event.detail.variables).to.deep.equal(variables);
    }
    const editor = el.shadowRoot!.querySelector<HTMLTextAreaElement>('[part="message-content"]')!;
    editor.value = 'Edited after limit';
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.messages[0]!.content).to.equal('Edited after limit');
    expect(previewTexts(el)).to.deep.equal(['Edited after limit']);
    expect(el.shadowRoot!.querySelector('[part="preview"]')!.textContent).not.to.contain(limitMessage);
  });
});

it('renders the English preview-limit fallback when no override or locale is registered', async () => {
  const el = await studio(['{{v0}}'], chain(65));
  el.strings = {};
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="preview"]')!.textContent!.includes(
    'Preview unavailable: expansion limit exceeded.',
  )).to.equal(true);
  expect(previewTexts(el).length).to.equal(0);
});
