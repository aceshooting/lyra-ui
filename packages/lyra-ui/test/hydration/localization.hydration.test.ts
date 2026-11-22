import { html, ssrFixture, ssrStaticDocument } from '../wtr-ssr-fixture.js';
import { expect } from '@open-wc/testing';

interface CalloutHost extends HTMLElement {
  closable: boolean;
  updateComplete: Promise<boolean>;
}

const frenchPage = () => html`<div lang="fr">
  <lr-callout closable>Une mise à jour est disponible.</lr-callout>
  <lr-spinner></lr-spinner>
</div>`;

const closeLabel = (root: ParentNode) =>
  root.querySelector('lr-callout')!.shadowRoot!.querySelector('[part="close-button"]')!.getAttribute('aria-label');
const spinnerLabel = (root: ParentNode) =>
  root.querySelector('lr-spinner')!.shadowRoot!.querySelector('[part~="base"]')!.getAttribute('aria-label');

describe('hydrated localized text under an ancestor lang', () => {
  it('renders a registered catalog on the server for the request locale and keeps it through hydration', async () => {
    const options = { catalogs: ['fr'], serverLocale: 'fr' };
    const served = await ssrStaticDocument(frenchPage(), options);
    expect(closeLabel(served.body)).to.equal('Fermer');
    expect(spinnerLabel(served.body)).to.equal('Chargement…');

    const wrapper = await ssrFixture(frenchPage(), options);
    expect(closeLabel(wrapper)).to.equal('Fermer');
    expect(spinnerLabel(wrapper)).to.equal('Chargement…');
    const callout = wrapper.querySelector<CalloutHost>('lr-callout')!;
    callout.closable = false;
    await callout.updateComplete;
    callout.closable = true;
    await callout.updateComplete;
    expect(closeLabel(wrapper)).to.equal('Fermer');
  });

  it('renders a host lang translated on the server without a request locale', async () => {
    const template = () => html`<lr-callout lang="fr" closable>Une mise à jour est disponible.</lr-callout>`;
    const served = await ssrStaticDocument(template(), { catalogs: ['fr'] });
    expect(closeLabel(served.body)).to.equal('Fermer');
    const callout = await ssrFixture(template(), { catalogs: ['fr'] });
    expect(closeLabel(callout.parentElement!)).to.equal('Fermer');
  });

  it('commits the ancestor locale after hydration when the server rendered without it', async () => {
    // The server cannot see an ancestor lang, so it renders the default catalog; the browser then
    // replaces that text with the inherited locale instead of leaving the server text stale.
    const served = await ssrStaticDocument(frenchPage(), { catalogs: ['fr'] });
    expect(closeLabel(served.body)).to.equal('Close');

    const wrapper = await ssrFixture(frenchPage(), { catalogs: ['fr'] });
    expect(closeLabel(wrapper)).to.equal('Fermer');
    expect(spinnerLabel(wrapper)).to.equal('Chargement…');
  });

  it('follows a later ancestor lang change after hydration', async () => {
    const wrapper = await ssrFixture(frenchPage(), { catalogs: ['fr'], serverLocale: 'fr' });
    wrapper.setAttribute('lang', 'en');
    const callout = wrapper.querySelector<CalloutHost>('lr-callout')!;
    await new Promise((resolve) => setTimeout(resolve, 0));
    await callout.updateComplete;
    expect(closeLabel(wrapper)).to.equal('Close');
  });
});
