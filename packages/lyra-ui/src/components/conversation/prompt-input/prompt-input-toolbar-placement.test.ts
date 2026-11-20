import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import '../../lr-prompt-input.js';
import type { LyraPromptInput } from './prompt-input.class.js';
import type { LyraChatComposer } from '../chat-composer/chat-composer.class.js';

function composerOf(el: LyraPromptInput): LyraChatComposer {
  return el.shadowRoot!.querySelector<LyraChatComposer>('[part="composer"]')!;
}

function composerPart(composer: LyraChatComposer, name: string): HTMLElement {
  return composer.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;
}

async function settle(el: LyraPromptInput): Promise<void> {
  await el.updateComplete;
  await composerOf(el).updateComplete;
  await nextFrame();
  await el.updateComplete;
  await composerOf(el).updateComplete;
}

describe('prompt input toolbar placement forwarding', () => {
  it('keeps an unset toolbar placement above forwarded attachments in the below actions layout', async () => {
    const el = await fixture<LyraPromptInput>(html`
      <lr-prompt-input actions-layout="below" style="inline-size: 480px">
        <button slot="toolbar" type="button">Model options</button>
        <span slot="chips">notes.txt</span>
        <button slot="start" type="button">Attach</button>
      </lr-prompt-input>
    `);
    await settle(el);
    const composer = composerOf(el);
    expect(composer.actionsLayout).to.equal('below');
    expect(composer.getAttribute('toolbar-placement')).to.equal('above');
    const toolbar = composerPart(composer, 'toolbar').getBoundingClientRect();
    const chips = composerPart(composer, 'chips').getBoundingClientRect();
    const textarea = composer.input!.getBoundingClientRect();
    expect(toolbar.height, 'the forwarded toolbar is visible').to.be.greaterThan(0);
    expect(chips.height, 'the forwarded attachment tray is visible').to.be.greaterThan(0);
    expect(toolbar.bottom).to.be.at.most(chips.top + 1);
    expect(chips.bottom).to.be.at.most(textarea.top + 1);
  });

  it('aligns the forwarded bottom toolbar at the inline end through the attribute and property', async () => {
    const el = await fixture<LyraPromptInput>(html`
      <lr-prompt-input actions-layout="below" toolbar-placement="actions" toolbar-align="end"
        style="inline-size: 480px">
        <button slot="toolbar" type="button">Generation options</button>
        <button slot="start" type="button">Attach</button>
      </lr-prompt-input>
    `);
    await settle(el);
    const toolbar = composerPart(composerOf(el), 'toolbar');
    const options = el.querySelector('[slot="toolbar"]')!;
    const gapAt = (edge: 'left' | 'right') =>
      Math.abs(toolbar.getBoundingClientRect()[edge] - options.getBoundingClientRect()[edge]);

    expect(el.toolbarAlign).to.equal('end');
    expect(gapAt('right')).to.be.at.most(1);
    expect(gapAt('left')).to.be.greaterThan(100);

    el.toolbarAlign = 'start';
    await settle(el);
    expect(gapAt('left')).to.be.at.most(1);

    el.toolbarAlign = 'end';
    await settle(el);
    expect(gapAt('right')).to.be.at.most(1);

    el.removeAttribute('toolbar-align');
    await settle(el);
    expect(gapAt('left')).to.be.at.most(1);
  });

  it('forwards bottom toolbar placement and restores above placement without moving the separate model controls', async () => {
    const el = await fixture<LyraPromptInput>(html`
      <lr-prompt-input actions-layout="below" toolbar-placement="actions" value="A preserved prompt"
        .modelCatalog=${[{ id: 'fast', label: 'Fast' }]} model="fast" style="inline-size: 480px">
        <button id="toolbar-options" slot="toolbar" type="button">Generation options</button>
        <span slot="chips">notes.txt</span>
        <button slot="start" type="button">Attach</button>
      </lr-prompt-input>
    `);
    await settle(el);
    const composer = composerOf(el);
    const controls = el.shadowRoot!.querySelector<HTMLElement>('[part="controls"]')!;
    const model = controls.querySelector('lr-model-select')!;
    const toolbarControl = el.querySelector('#toolbar-options')!;
    const events: string[] = [];
    for (const name of ['input', 'change', 'lr-input', 'lr-change', 'lr-submit', 'lr-stop', 'lr-model-change']) {
      el.addEventListener(name, () => events.push(name));
    }
    expect(composer.getAttribute('toolbar-placement')).to.equal('actions');
    expect(composer.toolbarAlign).to.equal('start');
    const chips = composerPart(composer, 'chips').getBoundingClientRect();
    const textarea = composer.input!.getBoundingClientRect();
    const toolbar = composerPart(composer, 'toolbar').getBoundingClientRect();
    const start = composerPart(composer, 'start').getBoundingClientRect();
    const end = composerPart(composer, 'end').getBoundingClientRect();
    expect(chips.height).to.be.greaterThan(0);
    expect(chips.bottom).to.be.at.most(textarea.top + 1);
    expect(toolbar.top, 'the forwarded toolbar follows the textarea').to.be.at.least(textarea.bottom - 1);
    expect(start.right).to.be.at.most(toolbar.left + 1);
    expect(toolbar.right).to.be.at.most(end.left + 1);
    expect(Math.min(start.bottom, toolbar.bottom) - Math.max(start.top, toolbar.top)).to.be.greaterThan(0);
    expect(Math.min(end.bottom, toolbar.bottom) - Math.max(end.top, toolbar.top)).to.be.greaterThan(0);
    const slots = [...composer.shadowRoot!.querySelectorAll<HTMLSlotElement>('slot[name="toolbar"]')];
    expect(slots.length).to.equal(1);
    expect(slots[0]!.assignedElements({ flatten: true }).map(element => element.id)).to.deep.equal(['toolbar-options']);
    expect(controls.getBoundingClientRect().height).to.be.greaterThan(0);
    expect(controls.getBoundingClientRect().bottom).to.be.at.most(composer.getBoundingClientRect().top + 1);

    el.setAttribute('toolbar-placement', 'above');
    await settle(el);

    expect(composerOf(el) === composer).to.equal(true);
    expect(composer.getAttribute('toolbar-placement')).to.equal('above');
    expect(composerPart(composer, 'toolbar').getBoundingClientRect().bottom).to.be.at.most(
      composerPart(composer, 'chips').getBoundingClientRect().top + 1,
    );
    expect(el.querySelector('#toolbar-options') === toolbarControl, 'the caller toolbar control survives relocation').to.equal(true);
    expect(controls.querySelector('lr-model-select') === model, 'the separate model control is retained').to.equal(true);
    expect(controls.getBoundingClientRect().bottom).to.be.at.most(composer.getBoundingClientRect().top + 1);
    expect(el.value).to.equal('A preserved prompt');
    expect(composer.value).to.equal(el.value);
    expect(events).to.deep.equal([]);
  });
});
