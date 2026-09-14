import { expect, fixture, html } from '@open-wc/testing';
import './document-library.js';
import type {
  LibraryDocument,
  LyraDocumentLibrary,
} from './document-library.js';

const DOCUMENTS: LibraryDocument[] = [
  { id: 'd1', name: 'Handbook', tags: ['hr'] },
  { id: 'd2', name: 'Runbook', tags: ['ops'] },
];

/**
 * Reads the size each composed control actually resolved, as a property rather than an attribute:
 * both controls reflect their own `size`, so an attribute read cannot tell "the library forwarded
 * nothing" apart from "the control reflected its own default".
 */
function toolbarSizes(el: LyraDocumentLibrary): {
  search: string | undefined;
  tagFilter: string | undefined;
} {
  const search = el.shadowRoot!.querySelector('[part="search"]') as
    | (HTMLElement & { size?: string })
    | null;
  const tagFilter = el.shadowRoot!.querySelector('[part="tag-filter"]') as
    | (HTMLElement & { size?: string })
    | null;
  return { search: search?.size, tagFilter: tagFilter?.size };
}

async function library(): Promise<LyraDocumentLibrary> {
  const el = await fixture<LyraDocumentLibrary>(
    html`<lr-document-library .documents=${DOCUMENTS}></lr-document-library>`
  );
  await el.updateComplete;
  return el;
}

describe('lr-document-library toolbar sizing', () => {
  it('leaves the toolbar controls on their own defaults while no size is set', async () => {
    const el = await library();

    expect(el.size).to.equal(undefined);
    expect(el.hasAttribute('size')).to.equal(false);
    expect(
      toolbarSizes(el),
      'an unset library must leave both composed controls on their own m default'
    ).to.deep.equal({ search: 'm', tagFilter: 'm' });
  });

  it('forwards a size tier to both the search field and the tag filter', async () => {
    const el = await library();
    el.size = 's';
    await el.updateComplete;

    expect(el.getAttribute('size')).to.equal('s');
    expect(toolbarSizes(el)).to.deep.equal({ search: 's', tagFilter: 's' });
  });

  it('forwards the Web Awesome and Shoelace spelling as authored', async () => {
    const el = await library();
    el.setAttribute('size', 'large');
    await el.updateComplete;

    expect(el.size).to.equal('large');
    expect(toolbarSizes(el)).to.deep.equal({
      search: 'large',
      tagFilter: 'large',
    });
  });

  it('drops an unsupported size back to the unset toolbar and removes the attribute', async () => {
    const el = await library();
    el.size = 'l';
    await el.updateComplete;
    el.size = 'huge' as never;
    await el.updateComplete;

    expect(el.size).to.equal(undefined);
    expect(el.hasAttribute('size')).to.equal(false);
    expect(toolbarSizes(el)).to.deep.equal({ search: 'm', tagFilter: 'm' });
  });
});
