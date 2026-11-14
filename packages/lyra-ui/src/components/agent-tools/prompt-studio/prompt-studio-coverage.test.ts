import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './prompt-studio.js';
import type { LyraPromptStudio } from './prompt-studio.js';

it('renders each supported native toolbar heading level', async () => {
  const studio = await fixture<LyraPromptStudio>(html`<lr-prompt-studio heading="Prompt studio"></lr-prompt-studio>`);
  const heading = (): Element => studio.shadowRoot!.querySelector('[part="toolbar"]')!.firstElementChild!;

  for (const level of ['1', '2', '3', '5', '6'] as const) {
    studio.headingLevel = level;
    await studio.updateComplete;
    expect(heading().localName).to.equal(`h${level}`);
    expect(heading().textContent).to.equal('Prompt studio');
  }
  await expect(studio).to.be.accessible();
});

it('keeps focus on an enabled move action after moving a message up into the middle and onto the top boundary', async () => {
  const four = [
    { id: 'a', role: 'system', content: 'A' },
    { id: 'b', role: 'user', content: 'B' },
    { id: 'c', role: 'assistant', content: 'C' },
    { id: 'd', role: 'user', content: 'D' },
  ] as const;
  const el = await fixture<LyraPromptStudio>(html`<lr-prompt-studio reorderable .messages=${four.map((message) => ({ ...message }))}></lr-prompt-studio>`);
  const action = (id: string, part: string) => el.shadowRoot!.querySelector<HTMLButtonElement>(`[data-message-id="${id}"] [part="${part}"]`)!;
  const focused = () => {
    const active = el.shadowRoot!.activeElement as HTMLElement | null;
    return [active?.closest<HTMLElement>('[data-message-id]')?.dataset['messageId'], active?.getAttribute('part')];
  };
  action('c', 'move-message-up').click();
  await el.updateComplete;
  await waitUntil(() => focused()[0] === 'c');
  expect(el.messages.map((message) => message.id)).to.deep.equal(['a', 'c', 'b', 'd']);
  expect(focused()).to.deep.equal(['c', 'move-message-up']);
  action('c', 'move-message-up').click();
  await el.updateComplete;
  await waitUntil(() => focused()[1] === 'move-message-down');
  expect(el.messages.map((message) => message.id)).to.deep.equal(['c', 'a', 'b', 'd']);
  expect(focused()).to.deep.equal(['c', 'move-message-down']);
  expect(action('c', 'move-message-up').disabled).to.equal(true);
});

it('drops a reorder whose request listener replaced the messages before it resolved', async () => {
  const el = await fixture<LyraPromptStudio>(html`<lr-prompt-studio reorderable .messages=${[
    { id: 'one', role: 'user', content: 'One' },
    { id: 'two', role: 'assistant', content: 'Two' },
  ]}></lr-prompt-studio>`);
  let changes = 0;
  el.addEventListener('lr-change', () => changes++);
  el.addEventListener('lr-message-reorder-request', () => {
    el.messages = [{ id: 'replacement', role: 'user', content: 'Replacement' }];
  }, { once: true });
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-message-id="one"] [part="move-message-down"]')!.click();
  await el.updateComplete;
  expect(changes).to.equal(0);
  expect(el.messages.map((message) => message.id)).to.deep.equal(['replacement']);
});

it('keeps the order when the follow-up change request for an accepted reorder is vetoed', async () => {
  const el = await fixture<LyraPromptStudio>(html`<lr-prompt-studio reorderable .messages=${[
    { id: 'one', role: 'user', content: 'One' },
    { id: 'two', role: 'assistant', content: 'Two' },
  ]}></lr-prompt-studio>`);
  let reorders = 0;
  el.addEventListener('lr-message-reorder-request', () => reorders++);
  el.addEventListener('lr-change-request', (event) => event.preventDefault());
  el.shadowRoot!.querySelector<HTMLButtonElement>('[data-message-id="one"] [part="move-message-down"]')!.click();
  await el.updateComplete;
  expect(reorders).to.equal(1);
  expect(el.messages.map((message) => message.id)).to.deep.equal(['one', 'two']);
});

it('lets a non-empty host aria-label name the studio instead of its inner section', async () => {
  const el = await fixture<LyraPromptStudio>(html`<lr-prompt-studio aria-label="Support prompt" .messages=${[{ id: 'one', role: 'user', content: 'One' }]}></lr-prompt-studio>`);
  expect(el.shadowRoot!.querySelector('[part="base"]')!.hasAttribute('aria-label')).to.equal(false);
  await expect(el).to.be.accessible();
});
