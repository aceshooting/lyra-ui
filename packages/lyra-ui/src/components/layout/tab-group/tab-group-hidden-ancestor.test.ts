import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import '../../lr-tab-group.js';
import '../../lr-tab.js';
import '../../lr-tab-panel.js';
import type { LyraTabGroup } from './tab-group.class.js';

function names(group: LyraTabGroup): string[] {
  return [...group.shadowRoot!.querySelectorAll('[role="tab"]')]
    .map(button => button.getAttribute('aria-label') ?? '');
}

const MARKUP = `
  <lr-tab panel="plain">Plain label</lr-tab>
  <lr-tab panel="rich"><span>Rich <strong>label</strong></span></lr-tab>
  <lr-tab panel="excluded">Shown<span hidden> hidden</span><span aria-hidden="true"> aria</span><span inert> inert</span><span style="display: none"> styled</span></lr-tab>
  <lr-tab>Unpaneled label</lr-tab>
  <lr-tab-panel name="plain">Plain body</lr-tab-panel>
  <lr-tab-panel name="rich">Rich body</lr-tab-panel>
  <lr-tab-panel name="excluded">Excluded body</lr-tab-panel>`;

const EXPECTED = ['Plain label', 'Rich label', 'Shown', 'Unpaneled label'];

describe('lr-tab-group under a display:none ancestor', () => {
  for (const mode of ['parsed', 'appended'] as const) {
    it(`names ${mode} tabs from their label text, not the panel key, before and after the ancestor is shown`, async () => {
      const wrapper = await fixture<HTMLDivElement>(html`<div style="display: none"></div>`);
      let group: LyraTabGroup;
      if (mode === 'parsed') {
        wrapper.innerHTML = `<lr-tab-group>${MARKUP}</lr-tab-group>`;
        group = wrapper.querySelector<LyraTabGroup>('lr-tab-group')!;
      } else {
        group = document.createElement('lr-tab-group');
        group.innerHTML = MARKUP;
        wrapper.append(group);
      }
      await waitUntil(() => names(group).length === EXPECTED.length, 'tabs never rendered while hidden');
      await group.updateComplete;
      expect(names(group)).to.deep.equal(EXPECTED);

      wrapper.style.display = '';
      await nextFrame();
      await group.updateComplete;
      await nextFrame();
      expect(names(group)).to.deep.equal(EXPECTED);
    });
  }

  it('picks up a label edited while hidden once the ancestor is shown', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div style="display: none"><lr-tab-group>
      <lr-tab panel="first">First</lr-tab><lr-tab-panel name="first">Body</lr-tab-panel>
    </lr-tab-group></div>`);
    const group = wrapper.querySelector<LyraTabGroup>('lr-tab-group')!;
    await waitUntil(() => names(group).length === 1);
    group.querySelector('lr-tab')!.innerHTML = '<span>Renamed</span><span aria-hidden="true">x</span>';
    await waitUntil(() => names(group)[0] === 'Renamed', `hidden edit not applied: ${names(group).join('|')}`);
    wrapper.style.display = '';
    await nextFrame();
    await group.updateComplete;
    expect(names(group)).to.deep.equal(['Renamed']);
  });
});
