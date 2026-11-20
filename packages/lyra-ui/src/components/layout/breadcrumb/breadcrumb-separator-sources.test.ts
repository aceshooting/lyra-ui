import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-breadcrumb.js';
import '../../lr-breadcrumb-item.js';
import type { LyraBreadcrumb } from '../../lr-breadcrumb.js';

const separatorTexts = (el: LyraBreadcrumb): string[][] =>
  [...el.querySelectorAll('lr-breadcrumb-item')].map((item) =>
    [...item.querySelectorAll(':scope > [slot="separator"]')].map((separator) => separator.textContent ?? ''),
  );

describe('lr-breadcrumb shared separator sources', () => {
  it('replaces generated separators when the shared source element is swapped', async () => {
    const el = await fixture<LyraBreadcrumb>(html`<lr-breadcrumb>
      <span slot="separator">/</span>
      <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
      <lr-breadcrumb-item current>Reports</lr-breadcrumb-item>
    </lr-breadcrumb>`);
    await waitUntil(() => separatorTexts(el).every((texts) => texts.join() === '/'), 'the initial separator is distributed');
    const replacement = document.createElement('span');
    replacement.slot = 'separator';
    replacement.textContent = '>';
    el.querySelector(':scope > [slot="separator"]')!.replaceWith(replacement);
    await waitUntil(() => separatorTexts(el).every((texts) => texts.join() === '>'), 'the replacement separator is distributed');
    expect(separatorTexts(el)).to.deep.equal([['>'], ['>']]);
  });

  it('projects only the live override and restores the shared separator after removal', async () => {
    const el = await fixture<LyraBreadcrumb>(html`<lr-breadcrumb dir="rtl">
      <span slot="separator">»</span>
      <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
      <lr-breadcrumb-item current>Reports<span slot="separator">›</span></lr-breadcrumb-item>
    </lr-breadcrumb>`);
    const item = el.querySelector('lr-breadcrumb-item[current]')!;
    const slot = item.shadowRoot!.querySelector<HTMLSlotElement>('slot[name="separator"]')!;
    const assigned = () => slot.assignedNodes({ flatten: true }).map(node => node.textContent);
    const override = item.querySelector<HTMLElement>('[slot="separator"]')!;
    expect(assigned()).to.deep.equal(['›']);

    override.remove();
    await waitUntil(() => assigned().join() === '»', 'shared separator restored after removal');

    item.append(override);
    await waitUntil(() => assigned().join() === '›', 'only the appended override is projected');
    override.slot = 'start';
    await waitUntil(() => assigned().join() === '»', 'shared separator restored after reassignment');
    override.slot = 'separator';
    await waitUntil(() => assigned().join() === '›', 'only the reassigned override is projected');
  });

  it('suppresses the leading separator on the first visible assigned item', async () => {
    const el = await fixture<LyraBreadcrumb>(html`<lr-breadcrumb>
      <span slot="separator">»</span>
      <lr-breadcrumb-item slot="unused">Unassigned</lr-breadcrumb-item>
      <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
      <lr-breadcrumb-item current>Reports</lr-breadcrumb-item>
    </lr-breadcrumb>`);
    const [unused, home, current] = [...el.querySelectorAll('lr-breadcrumb-item')];
    const display = (item: typeof home) => getComputedStyle(item!.shadowRoot!.querySelector('[part="separator"]')!).display;
    expect(display(home)).to.equal('none');
    expect(display(current)).to.not.equal('none');

    unused!.removeAttribute('slot');
    await waitUntil(() => display(unused) === 'none' && display(home) !== 'none');
    unused!.hidden = true;
    await waitUntil(() => display(home) === 'none' && display(current) !== 'none');
  });

  it('drops surplus generated separators when a shared source is removed', async () => {
    const el = await fixture<LyraBreadcrumb>(html`<lr-breadcrumb>
      <span slot="separator" id="first">/</span>
      <span slot="separator" id="second">|</span>
      <lr-breadcrumb-item href="/">Home</lr-breadcrumb-item>
      <lr-breadcrumb-item current>Reports</lr-breadcrumb-item>
    </lr-breadcrumb>`);
    await waitUntil(() => separatorTexts(el).every((texts) => texts.join() === '/,|'), 'both separators are distributed');
    el.querySelector('#second')!.remove();
    await waitUntil(() => separatorTexts(el).every((texts) => texts.join() === '/'), 'only the remaining separator is kept');
    expect(separatorTexts(el)).to.deep.equal([['/'], ['/']]);
  });
});
