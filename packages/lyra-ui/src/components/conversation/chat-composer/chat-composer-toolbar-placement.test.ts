import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './chat-composer.js';
import type { LyraChatComposer } from './chat-composer.js';

function part(el: LyraChatComposer, name: string): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;
}

async function settle(el: LyraChatComposer): Promise<void> {
  await el.updateComplete;
  await nextFrame();
  await el.updateComplete;
}

function assertBelow(el: LyraChatComposer): void {
  const chips = part(el, 'chips').getBoundingClientRect();
  const textarea = part(el, 'textarea').getBoundingClientRect();
  const toolbar = part(el, 'toolbar').getBoundingClientRect();
  const start = part(el, 'start').getBoundingClientRect();
  const end = part(el, 'end').getBoundingClientRect();
  expect(chips.height, 'the attachment tray is populated').to.be.greaterThan(0);
  expect(chips.bottom, 'attachments precede the textarea').to.be.at.most(textarea.top + 1);
  for (const [name, rect] of [['start', start], ['toolbar', toolbar], ['end', end]] as const) {
    expect(rect.height, `${name} is visible`).to.be.greaterThan(0);
    expect(rect.top, `${name} sits below the textarea`).to.be.at.least(textarea.bottom - 1);
  }
  expect(Math.min(start.bottom, toolbar.bottom) - Math.max(start.top, toolbar.top),
    'start and toolbar share the bottom action row').to.be.greaterThan(0);
  expect(Math.min(end.bottom, toolbar.bottom) - Math.max(end.top, toolbar.top),
    'end and toolbar share the bottom action row').to.be.greaterThan(0);
}

describe('chat composer toolbar placement', () => {
  it('keeps an unset toolbar placement above attachments in every existing actions layout', async () => {
    for (const layout of ['inline', 'stacked', 'below']) {
      const el = await fixture<LyraChatComposer>(html`
        <lr-chat-composer actions-layout=${layout} style="inline-size: 480px">
          <button slot="toolbar" type="button">Model</button>
          <span slot="chips">notes.txt</span>
          <button slot="start" type="button">Attach</button>
        </lr-chat-composer>
      `);
      await settle(el);
      expect(el.getAttribute('toolbar-placement'), layout).to.equal('above');
      const toolbar = part(el, 'toolbar').getBoundingClientRect();
      const chips = part(el, 'chips').getBoundingClientRect();
      const row = part(el, 'row').getBoundingClientRect();
      expect(toolbar.bottom, layout).to.be.at.most(chips.top + 1);
      expect(chips.bottom, layout).to.be.at.most(row.top + 1);
      const before = [toolbar.top, toolbar.height, chips.top, row.top, row.height];
      el.setAttribute('toolbar-placement', 'above');
      await settle(el);
      const explicitToolbar = part(el, 'toolbar').getBoundingClientRect();
      const explicitChips = part(el, 'chips').getBoundingClientRect();
      const explicitRow = part(el, 'row').getBoundingClientRect();
      expect([explicitToolbar.top, explicitToolbar.height, explicitChips.top, explicitRow.top, explicitRow.height],
        `${layout} has identical default and explicit-above geometry`).to.deep.equal(before);
    }
  });

  it('keeps actions placement above attachments while the actions layout is inline', async () => {
    const el = await fixture<LyraChatComposer>(html`
      <lr-chat-composer actions-layout="inline" toolbar-placement="actions" style="inline-size: 480px">
        <button slot="toolbar" type="button">Model</button>
        <span slot="chips">notes.txt</span>
        <button slot="start" type="button">Attach</button>
      </lr-chat-composer>
    `);
    await settle(el);
    expect(el.getAttribute('toolbar-placement')).to.equal('actions');
    expect(el.actionsLayout).to.equal('inline');
    expect(part(el, 'toolbar').getBoundingClientRect().bottom).to.be.at.most(part(el, 'chips').getBoundingClientRect().top + 1);
    expect(getComputedStyle(part(el, 'row')).display).to.equal('flex');
  });

  it('places the toolbar between start and end below the textarea while attachments stay above it', async () => {
    const el = await fixture<LyraChatComposer>(html`
      <lr-chat-composer actions-layout="below" toolbar-placement="actions" style="inline-size: 560px">
        <button id="model" slot="toolbar" type="button">Model</button>
        <span slot="chips">notes.txt</span>
        <button id="attach" slot="start" type="button">Attach</button>
      </lr-chat-composer>
    `);
    await settle(el);
    assertBelow(el);
    const start = part(el, 'start').getBoundingClientRect();
    const toolbar = part(el, 'toolbar').getBoundingClientRect();
    const end = part(el, 'end').getBoundingClientRect();
    expect(start.right).to.be.at.most(toolbar.left + 1);
    expect(toolbar.right).to.be.at.most(end.left + 1);
    const toolbarSlots = [...el.shadowRoot!.querySelectorAll<HTMLSlotElement>('slot[name="toolbar"]')];
    const startSlots = [...el.shadowRoot!.querySelectorAll<HTMLSlotElement>('slot[name="start"]')];
    expect(toolbarSlots.length).to.equal(1);
    expect(startSlots.length).to.equal(1);
    expect(toolbarSlots[0]!.assignedElements({ flatten: true }).map(element => element.id)).to.deep.equal(['model']);
    expect(startSlots[0]!.assignedElements({ flatten: true }).map(element => element.id)).to.deep.equal(['attach']);
    await expect(el).to.be.accessible();
  });

  for (const direction of ['ltr', 'rtl']) {
    it(`contains a long bottom toolbar at 320px in ${direction} while keeping attach and send at the logical edges`, async () => {
      const wrapper = await fixture<HTMLElement>(html`
        <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%">
          <lr-chat-composer actions-layout="below" toolbar-placement="actions"
            .value=${'A draft that wraps across several lines in a narrow conversation panel.'}>
            <select slot="toolbar" aria-label="Model">
              <option>Research model with extended reasoning and a long translated name</option>
            </select>
            <button slot="toolbar" type="button">Advanced generation options</button>
            <span slot="toolbar">Ready for the next message</span>
            <span slot="chips">notes.txt</span>
            <button slot="start" type="button" aria-label="Attach file">+</button>
          </lr-chat-composer>
        </div>
      `);
      const el = wrapper.querySelector('lr-chat-composer')!;
      await settle(el);
      assertBelow(el);
      const base = part(el, 'base');
      const row = part(el, 'row').getBoundingClientRect();
      const start = part(el, 'start').getBoundingClientRect();
      const toolbar = part(el, 'toolbar').getBoundingClientRect();
      const end = part(el, 'end').getBoundingClientRect();
      expect(base.scrollWidth, 'toolbar overflow stays inside its own region').to.be.at.most(base.clientWidth + 1);
      expect(wrapper.scrollWidth).to.be.at.most(wrapper.clientWidth + 1);
      expect(toolbar.width).to.be.greaterThan(0);
      expect(toolbar.left).to.be.at.least(row.left - 1);
      expect(toolbar.right).to.be.at.most(row.right + 1);
      expect(part(el, 'action-button').getBoundingClientRect().width).to.be.greaterThan(0);
      if (direction === 'rtl') {
        expect(Math.abs(start.right - row.right)).to.be.at.most(1);
        expect(Math.abs(end.left - row.left)).to.be.at.most(1);
        expect(end.right).to.be.at.most(toolbar.left + 1);
        expect(toolbar.right).to.be.at.most(start.left + 1);
      } else {
        expect(Math.abs(start.left - row.left)).to.be.at.most(1);
        expect(Math.abs(end.right - row.right)).to.be.at.most(1);
        expect(start.right).to.be.at.most(toolbar.left + 1);
        expect(toolbar.right).to.be.at.most(end.left + 1);
      }
    });
  }

  it('tabs from the textarea through attach and toolbar controls to the built-in send action', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="inline-size: 480px">
        <lr-chat-composer actions-layout="below" toolbar-placement="actions">
          <button id="attach" slot="start" type="button">Attach</button>
          <span slot="toolbar"><button id="model" type="button">Model</button><button id="options" type="button">Options</button></span>
        </lr-chat-composer>
        <button id="after-composer" type="button">Continue</button>
      </div>
    `);
    const el = wrapper.querySelector('lr-chat-composer')!;
    await settle(el);
    await focusByKeyboard(el.input!);
    for (const id of ['attach', 'model', 'options']) {
      await sendKeys({ press: 'Tab' });
      expect(document.activeElement?.id, `Tab reaches ${id}`).to.equal(id);
    }
    await sendKeys({ press: 'Tab' });
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('action-button');
    await sendKeys({ press: 'Tab' });
    expect(document.activeElement?.id).to.equal('after-composer');
  });

  it('preserves the textarea node, draft, selection, focus and submitted value through live placement changes', async () => {
    const form = await fixture<HTMLFormElement>(html`
      <form><lr-chat-composer name="message" actions-layout="below" value="A preserved draft" style="inline-size: 480px">
        <button slot="toolbar" type="button">Model</button>
        <button slot="start" type="button">Attach</button>
      </lr-chat-composer></form>
    `);
    const el = form.querySelector('lr-chat-composer')!;
    const textarea = el.input!;
    const events: string[] = [];
    for (const name of ['input', 'change', 'lr-input', 'lr-change', 'lr-submit', 'lr-stop']) el.addEventListener(name, () => events.push(name));
    await focusByKeyboard(textarea);
    el.setSelectionRange(2, 11, 'backward');
    for (const placement of ['actions', 'above']) {
      el.setAttribute('toolbar-placement', placement);
      await settle(el);
      expect(el.input === textarea, 'the textarea is retained').to.equal(true);
      expect(el.shadowRoot!.activeElement === textarea, 'layout does not blur the editor').to.equal(true);
      expect(el.value).to.equal('A preserved draft');
      expect(textarea.value).to.equal(el.value);
      expect([el.selectionStart, el.selectionEnd, el.selectionDirection]).to.deep.equal([2, 11, 'backward']);
      expect(new FormData(form).get('message')).to.equal(el.value);
    }
    expect(events).to.deep.equal([]);
  });

  it('retains focus on a slotted toolbar control when placement changes without claiming external focus', async () => {
    const wrapper = await fixture<HTMLElement>(html`
      <div style="inline-size: 480px">
        <lr-chat-composer actions-layout="below">
          <button id="model" slot="toolbar" type="button">Model</button>
          <button slot="start" type="button">Attach</button>
        </lr-chat-composer>
        <button id="elsewhere" type="button">Other action</button>
      </div>
    `);
    const el = wrapper.querySelector('lr-chat-composer')!;
    const model = el.querySelector<HTMLButtonElement>('#model')!;
    await focusByKeyboard(model);
    for (const placement of ['actions', 'above']) {
      el.setAttribute('toolbar-placement', placement);
      await settle(el);
      expect(el.querySelector('#model') === model, 'caller control identity is retained').to.equal(true);
      expect(document.activeElement?.id, `focused toolbar survives ${placement} placement`).to.equal('model');
    }
    await focusByKeyboard(wrapper.querySelector<HTMLButtonElement>('#elsewhere')!);
    el.setAttribute('toolbar-placement', 'actions');
    await settle(el);
    expect(document.activeElement?.id).to.equal('elsewhere');
  });

  it('normalizes invalid attribute and direct writes and restores above when placement is removed', async () => {
    const el = await fixture<LyraChatComposer>(html`
      <lr-chat-composer actions-layout="below" toolbar-placement="actions">
        <button slot="toolbar" type="button">Model</button>
      </lr-chat-composer>
    `);
    for (const invalid of ['bottom', '', 'ACTIONS']) {
      el.toolbarPlacement = 'actions';
      await settle(el);
      el.setAttribute('toolbar-placement', invalid);
      await settle(el);
      expect(el.toolbarPlacement, `attribute ${invalid}`).to.equal('above');
      expect(el.getAttribute('toolbar-placement')).to.equal('above');
    }
    for (const invalid of ['bottom', null, undefined, 1, {}]) {
      el.toolbarPlacement = 'actions';
      await settle(el);
      Reflect.set(el, 'toolbarPlacement', invalid);
      await settle(el);
      expect(el.toolbarPlacement, 'untyped property write').to.equal('above');
      expect(el.getAttribute('toolbar-placement')).to.equal('above');
    }
    for (const previous of ['actions', 'above'] as const) {
      el.toolbarPlacement = previous;
      await settle(el);
      el.removeAttribute('toolbar-placement');
      await settle(el);
      expect(el.toolbarPlacement, `removal from ${previous}`).to.equal('above');
      expect(el.getAttribute('toolbar-placement')).to.equal('above');
    }
  });

  it('keeps a requested actions toolbar above attachments in the stacked layout', async () => {
    const el = await fixture<LyraChatComposer>(html`
      <lr-chat-composer actions-layout="stacked" toolbar-placement="actions" min-rows="4"
        style="inline-size: 480px">
        <button slot="toolbar" type="button">Model</button>
        <span slot="chips">notes.txt</span>
        <button slot="start" type="button">Attach</button>
      </lr-chat-composer>
    `);
    await settle(el);
    expect(el.toolbarPlacement).to.equal('actions');
    expect(el.actionsLayout).to.equal('stacked');
    expect(part(el, 'toolbar').getBoundingClientRect().bottom).to.be.at.most(
      part(el, 'chips').getBoundingClientRect().top + 1,
    );
    expect(part(el, 'chips').getBoundingClientRect().bottom).to.be.at.most(
      part(el, 'row').getBoundingClientRect().top + 1,
    );
    expect(getComputedStyle(part(el, 'row')).display).to.equal('grid');
    expect(part(el, 'start').getBoundingClientRect().bottom).to.be.at.most(
      part(el, 'end').getBoundingClientRect().top + 1,
    );
    expect(part(el, 'textarea').getBoundingClientRect().left).to.be.at.least(
      part(el, 'start').getBoundingClientRect().right - 1,
    );
  });

  it('adds no action-row spacing when start and toolbar slots are empty', async () => {
    const el = await fixture<LyraChatComposer>(html`
      <lr-chat-composer actions-layout="below" style="inline-size: 320px"></lr-chat-composer>
    `);
    await settle(el);
    const measure = () => {
      const row = part(el, 'row').getBoundingClientRect();
      const textarea = part(el, 'textarea').getBoundingClientRect();
      const end = part(el, 'end').getBoundingClientRect();
      return [row.height, textarea.width, end.top - textarea.bottom, row.right - end.right];
    };
    const above = measure();
    el.toolbarPlacement = 'actions';
    await settle(el);
    expect(getComputedStyle(part(el, 'start')).display).to.equal('none');
    expect(getComputedStyle(part(el, 'toolbar')).display).to.equal('none');
    expect(part(el, 'action-button').getBoundingClientRect().width).to.be.greaterThan(0);
    measure().forEach((value, index) => {
      expect(Math.abs(value - above[index]!), `empty-slot geometry ${index}`).to.be.at.most(1);
    });
    expect(part(el, 'base').scrollWidth).to.be.at.most(part(el, 'base').clientWidth + 1);
  });

  it('retains the focused textarea and selection when requested actions switches below and inline', async () => {
    const el = await fixture<LyraChatComposer>(html`
      <lr-chat-composer actions-layout="below" toolbar-placement="actions"
        value="A preserved draft" style="inline-size: 480px">
        <button slot="toolbar" type="button">Model</button>
        <span slot="chips">notes.txt</span>
        <button slot="start" type="button">Attach</button>
      </lr-chat-composer>
    `);
    await settle(el);
    const textarea = el.input!;
    const events: string[] = [];
    for (const name of ['input', 'change', 'lr-input', 'lr-change', 'lr-submit', 'lr-stop']) {
      el.addEventListener(name, () => events.push(name));
    }
    await focusByKeyboard(textarea);
    el.setSelectionRange(2, 11, 'backward');
    for (const layout of ['inline', 'below'] as const) {
      el.actionsLayout = layout;
      await settle(el);
      expect(el.toolbarPlacement).to.equal('actions');
      expect(el.getAttribute('toolbar-placement')).to.equal('actions');
      expect(el.input === textarea, `textarea survives ${layout}`).to.equal(true);
      expect(el.shadowRoot!.activeElement === textarea, `focus survives ${layout}`).to.equal(true);
      expect(el.value).to.equal('A preserved draft');
      expect([el.selectionStart, el.selectionEnd, el.selectionDirection]).to.deep.equal([2, 11, 'backward']);
      if (layout === 'below') assertBelow(el);
      else expect(part(el, 'toolbar').getBoundingClientRect().bottom).to.be.at.most(
        part(el, 'chips').getBoundingClientRect().top + 1,
      );
    }
    expect(events).to.deep.equal([]);
  });
});
