import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import '../../lr-menubar.js';

const names = (root: Element): string[] =>
  [...root.querySelectorAll('lr-menubar-item')].map(item => item.getAttribute('aria-label') ?? '');

describe('lr-menubar-item under a display:none ancestor', () => {
  it('names element-wrapped labels from their text, still excluding author-hidden content, before and after the ancestor is shown', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div style="display: none"></div>`);
    wrapper.innerHTML = `<lr-menubar label="Application">
      <lr-menubar-item><span>Rich <strong>file</strong></span><lr-menu slot="menu"><lr-menu-item>New</lr-menu-item></lr-menu></lr-menubar-item>
      <lr-menubar-item><span>Edit</span><span hidden> hidden</span><span aria-hidden="true"> aria</span></lr-menubar-item>
    </lr-menubar>`;
    const bar = wrapper.querySelector('lr-menubar')!;
    await waitUntil(() => names(bar).length === 2, 'items never rendered');
    await nextFrame();
    await nextFrame();
    expect(names(bar)).to.deep.equal(['Rich file', 'Edit']);
    wrapper.style.display = '';
    await nextFrame();
    expect(names(bar)).to.deep.equal(['Rich file', 'Edit']);
  });
});
