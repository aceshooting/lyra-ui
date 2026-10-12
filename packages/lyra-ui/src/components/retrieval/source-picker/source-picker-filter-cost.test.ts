import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LyraElement } from '../../../internal/lyra-element.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import '../../../translations/tr/retrieval.js';
import '../../../translations/tr/shared.js';
import '../../../translations/tr/media.js';
import './source-picker.js';
import type { LyraSourceEntry, LyraSourcePicker } from './source-picker.js';

it('resolves the search locale per pass while retaining Turkish matches, ancestors and match counts', async () => {
  const sources: LyraSourceEntry[] = [
    { id: 'folder', label: 'Places', children: [{ id: 'target', label: 'İzmir' }] },
    ...Array.from({ length: 100 }, (_, index) => ({ id: `other-${index}`, label: `Other ${index}` })),
  ];
  const el = await fixture<LyraSourcePicker>(html`<lr-source-picker lang="tr"
    .sources=${sources}
    .strings=${{ sourcePickerMatches: { one: 'Found {count} source', other: 'Found {count} sources' } }}
  ></lr-source-picker>`);
  const localeGetter = Object.getOwnPropertyDescriptor(LyraElement.prototype, 'effectiveLocale')!.get!;
  let localeReads = 0;
  Object.defineProperty(el, 'effectiveLocale', {
    configurable: true,
    get() {
      localeReads++;
      return localeGetter.call(this);
    },
  });
  try {
    const sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)!;
    const before = sink.children.length;
    el.shadowRoot!.querySelector('[part="search"]')!.dispatchEvent(new CustomEvent('lr-input', {
      detail: { value: ' iz ' }, bubbles: true, composed: true,
    }));
    await el.updateComplete;
    await waitUntil(() => sink.children.length > before);
    const labels = [...el.shadowRoot!.querySelectorAll('[part="label"]')].map((node) => node.textContent);
    expect(labels).to.deep.equal(['Places', 'İzmir']);
    expect(sink.lastElementChild?.textContent).to.equal('Found 1 source');
    expect(localeReads).to.be.lessThan(12);

    localeReads = 0;
    const rows = (el as unknown as { visibleRows(): { entry: LyraSourceEntry }[] }).visibleRows();
    expect(rows.map((row) => row.entry.id)).to.deep.equal(['folder', 'target']);
    expect(localeReads).to.equal(1);
  } finally {
    Reflect.deleteProperty(el, 'effectiveLocale');
  }
});
