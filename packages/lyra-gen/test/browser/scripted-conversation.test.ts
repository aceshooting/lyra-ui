import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { createCatalog } from '../../src/catalog.js';
import '../../src/gen-view.js';
import type { LyraGenViewElement } from '../../src/gen-view.class.js';
import { connectScriptedConversation, createScriptedConversation, type LyraGenScriptedBuildResult, type LyraGenScriptedBuildStep, type LyraGenScriptedSnapshot, type LyraGenScriptedTree } from '../../src/scripted-conversation.js';
import type { JsonValue } from '../../src/types.js';

const catalog = createCatalog({ id: 'scripted-browser', version: '1', components: {
  stack: { tag: 'div', properties: {}, children: true },
  text: { tag: 'p', properties: {}, text: true },
} });
type Copy = { readonly label: string };
const tree: LyraGenScriptedTree<Copy> = {
  start: 'intro',
  steps: {
    intro: { id: 'intro', copy: { label: 'Which sample?' }, choices: [
      { id: 'markets', next: 'detail', copy: { label: 'Markets' } },
      { id: 'weather', next: 'detail', copy: { label: 'Weather' } },
    ] },
    detail: { id: 'detail', copy: { label: 'Refine the answer' }, choices: [
      { id: 'focus', next: 'done', copy: { label: 'Focus on one' } },
      { id: 'compare', next: 'done', copy: { label: 'Compare all' } },
    ] },
    done: { id: 'done', copy: { label: 'Complete' }, choices: [] },
  },
};
const text = (step: string, controls: Readonly<Record<string, JsonValue>>) => ({ root: { id: 'root', type: 'stack', children: [{ id: 'answer', type: 'text', text: `${step} ${String(controls['nights'] ?? '')}` }] } });

async function mount(buildStep: LyraGenScriptedBuildStep = (path, controls) => text(path.step, controls)) {
  const host = await fixture<HTMLElement>(html`<section aria-label="Guided answer"><ol data-transcript></ol><lr-gen-view></lr-gen-view><div data-choices role="group" aria-label="Follow-up"></div><button data-back type="button">Back</button></section>`);
  const view = host.querySelector<LyraGenViewElement>('lr-gen-view')!;
  const choices = host.querySelector<HTMLElement>('[data-choices]')!;
  const conversation = createScriptedConversation({ tree, catalog, surfaceId: 'guided', controls: { nights: 1 }, buildStep });
  const paint = (snapshot: LyraGenScriptedSnapshot<Copy>) => {
    host.querySelector('[data-transcript]')!.replaceChildren(...snapshot.transcript.map(entry => Object.assign(document.createElement('li'), { textContent: entry.copy?.label ?? '' })));
    choices.replaceChildren(...snapshot.choices.map(choice => {
      const button = Object.assign(document.createElement('button'), { type: 'button', textContent: choice.copy?.label ?? '' });
      button.dataset['choice'] = choice.id;
      button.addEventListener('click', () => conversation.choose(choice.id));
      return button;
    }));
  };
  conversation.subscribe(paint);
  const readyRevisions: number[] = [];
  const connection = connectScriptedConversation(conversation, view, {
    onReady: snapshot => readyRevisions.push(snapshot.document!.revision),
    resolveFocus: target => target.choiceId ? choices.querySelector<HTMLElement>(`[data-choice="${target.choiceId}"]`) : host.querySelector<HTMLElement>('[data-back]'),
    focusScope: host,
  });
  host.querySelector('[data-back]')!.addEventListener('click', () => conversation.back());
  conversation.restart();
  return { host, view, conversation, connection, readyRevisions };
}

describe('scripted conversation with lr-gen-view', () => {
  it('assigns each committed revision, reports readiness and restores focus to the next choices', async () => {
    const { host, view, conversation, readyRevisions } = await mount();
    await waitUntil(() => conversation.snapshot.rendered);
    expect(view.document?.revision).to.equal(1);
    expect(readyRevisions).to.deep.equal([1]);
    host.querySelector<HTMLButtonElement>('[data-choice="weather"]')!.click();
    await waitUntil(() => conversation.snapshot.rendered && conversation.snapshot.document?.revision === 2);
    expect(view.document?.revision).to.equal(2);
    expect(document.activeElement?.getAttribute('data-choice')).to.equal('focus');
    expect(view.shadowRoot!.querySelector('[data-gen-id="answer"]')!.textContent).to.contain('detail');
    expect([...host.querySelectorAll('[data-transcript] li')].map(item => item.textContent)).to.deep.equal(['Which sample?', 'Weather', 'Refine the answer']);
    await expect(host).to.be.accessible();
    host.querySelector<HTMLButtonElement>('[data-back]')!.focus();
    host.querySelector<HTMLButtonElement>('[data-back]')!.click();
    await waitUntil(() => conversation.snapshot.rendered && conversation.snapshot.document?.revision === 3);
    expect(view.document?.revision).to.equal(3, 'Back publishes a new revision');
    expect(document.activeElement?.getAttribute('data-choice')).to.equal('weather', 'Back returns focus to the undone choice');
    expect(readyRevisions).to.deep.equal([1, 2, 3]);
  });

  it('control edits re-render without moving focus and a superseded build never reaches the view', async () => {
    const releases: Array<() => void> = [];
    const { host, view, conversation, readyRevisions } = await mount((path, controls) => {
      if (controls['nights'] !== 9) return text(path.step, controls);
      return new Promise<LyraGenScriptedBuildResult>(resolve => { releases.push(() => resolve(text(path.step, controls))); });
    });
    await waitUntil(() => conversation.snapshot.rendered);
    const outside = Object.assign(document.createElement('input'), { ariaLabel: 'Nights' });
    host.append(outside); outside.focus();
    conversation.setControls({ nights: 2 });
    await waitUntil(() => conversation.snapshot.rendered && view.document?.revision === 2);
    expect(document.activeElement).to.equal(outside);
    expect(view.shadowRoot!.querySelector('[data-gen-id="answer"]')!.textContent).to.contain('2');
    conversation.setControls({ nights: 9 });
    await waitUntil(() => releases.length === 1);
    conversation.choose('markets');
    releases[1]!();
    await waitUntil(() => conversation.snapshot.rendered && conversation.snapshot.document?.revision === 4);
    expect(view.document?.revision).to.equal(4);
    expect(readyRevisions).to.deep.equal([1, 4]);
    releases[0]!();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(view.document?.revision).to.equal(4, 'the superseded control build never lands');
    expect(view.shadowRoot!.querySelector('[data-gen-id="answer"]')!.textContent).to.equal('detail 9');
  });

  it('a ready event for a revision the controller has moved past is ignored', async () => {
    const target = Object.assign(new EventTarget(), { document: undefined as LyraGenViewElement['document'], catalog });
    const conversation = createScriptedConversation({ tree, catalog, surfaceId: 'guided', buildStep: path => text(path.step, {}) });
    const connection = connectScriptedConversation(conversation, target);
    const ready = (revision: number) => target.dispatchEvent(new CustomEvent('lr-gen-ready', { detail: { surfaceId: 'guided', revision } }));
    conversation.restart();
    await waitUntil(() => target.document?.revision === 1);
    conversation.choose('markets');
    await waitUntil(() => target.document?.revision === 2);
    ready(1);
    expect(conversation.snapshot.rendered).to.equal(false);
    ready(2);
    expect(conversation.snapshot.rendered).to.equal(true);
    connection.disconnect();
    conversation.choose('focus');
    await waitUntil(() => conversation.snapshot.document?.revision === 3);
    expect(target.document?.revision).to.equal(2, 'a disconnected view is left alone');
  });
});
