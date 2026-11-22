import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-toast.js';
import type { LyraToast } from '../../lr-toast.js';

const insets = (el: Element): string[] => {
  const style = getComputedStyle(el);
  return [style.insetBlockStart, style.insetBlockEnd, style.insetInlineStart, style.insetInlineEnd];
};

describe('lr-toast region insets', () => {
  it('keeps the var(--lr-space-l) default and takes block and inline inset tokens per region', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <lr-toast placement="top-end"></lr-toast>
      <lr-toast placement="bottom-center" style="--lr-toast-inset-block: 5px; --lr-toast-inset-inline: 7px"></lr-toast>
      <lr-toast placement="top-start" style="--lr-toast-inset-block: var(--lr-space-l); --lr-toast-inset-inline: var(--lr-space-l)"></lr-toast>
    </div>`);
    const [plain, custom, explicitDefault] = [...wrapper.querySelectorAll<LyraToast>('lr-toast')];
    await Promise.all([plain!.updateComplete, custom!.updateComplete, explicitDefault!.updateComplete]);
    expect(insets(plain!)).to.deep.equal(insets(explicitDefault!));
    expect(insets(custom!)).to.deep.equal(['5px', '5px', '7px', '7px']);
  });
});
