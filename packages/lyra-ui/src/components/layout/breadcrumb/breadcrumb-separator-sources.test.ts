import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './breadcrumb.js';
import './breadcrumb-item.js';
import type { LyraBreadcrumb } from './breadcrumb.js';

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
