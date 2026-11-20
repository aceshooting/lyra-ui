import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-agent-workspace.js';

it('lets the enclosing layout theme its base surface', async () => {
  const el = await fixture(html`<lr-agent-workspace
    style="--lr-agent-workspace-radius: 9px; --lr-agent-workspace-bg: rgb(1, 2, 3); --lr-agent-workspace-border-color: rgb(3, 4, 5); --lr-agent-workspace-padding: 7px"></lr-agent-workspace>`);
  const style = getComputedStyle(el.shadowRoot!.querySelector('[part~="base"]')!);
  expect(style.borderTopLeftRadius).to.equal('9px');
  expect(style.backgroundColor).to.equal('rgb(1, 2, 3)');
  expect(style.borderTopColor).to.equal('rgb(3, 4, 5)');
  expect(style.paddingInlineStart).to.equal('7px');
});

it('projects the host description onto the region and follows text edits', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><p id="help">Description</p>
    <lr-agent-workspace aria-describedby="help"></lr-agent-workspace></div>`);
  const el = wrapper.querySelector('lr-agent-workspace')!;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const description = wrapper.querySelector('p')!;
  const text = () => (base.ariaDescribedByElements ?? (base.getAttribute('aria-describedby') ?? '').split(/\s+/)
    .map(id => el.shadowRoot!.getElementById(id))).map(node => node?.textContent).join('');
  await waitUntil(() => text() === 'Description');
  description.textContent = 'Changed';
  await waitUntil(() => text() === 'Changed');
  const frame = await fixture<HTMLIFrameElement>(html`<iframe></iframe>`);
  frame.contentDocument!.body.append(wrapper);
  description.textContent = 'Adopted';
  await waitUntil(() => text() === 'Adopted');
});

it('changes heading levels for the title and details, and omits empty titles', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-agent-workspace']>(html`<lr-agent-workspace
    .retrievalLoading=${true}></lr-agent-workspace>`);
  const level = (part: string) => {
    const node = el.shadowRoot!.querySelector(`[part="${part}"]`)!;
    return node.getAttribute('aria-level') ?? (/^h[1-6]$/.test(node.localName) ? node.localName.slice(1) : null);
  };
  expect(level('heading')).to.equal('2');
  expect(level('section-heading')).to.equal('3');
  el.setAttribute('heading-level', '5');
  await el.updateComplete;
  expect(level('heading')).to.equal('5');
  expect(level('section-heading')).to.equal('6');
  el.setAttribute('heading-level', 'none');
  await el.updateComplete;
  expect(level('heading')).to.equal(null);
  expect(level('section-heading')).to.equal(null);
  for (const restore of [() => el.setAttribute('heading-level', 'bogus'), () => el.removeAttribute('heading-level')]) {
    el.setAttribute('heading-level', '5');
    await el.updateComplete;
    restore();
    await el.updateComplete;
    expect([level('heading'), level('section-heading')], 'the documented default returns').to.deep.equal(['2', '3']);
  }
  el.label = '';
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="heading"]').length).to.equal(0);
});

it('disables only its built-in composer and scopes its child events', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-agent-workspace']>(html`<lr-agent-workspace>
    <button slot="header-actions">Action</button></lr-agent-workspace>`);
  const composer = el.shadowRoot!.querySelector('lr-chat-composer')!;
  expect(composer.disabled).to.equal(false);
  el.setAttribute('composer-disabled', '');
  await el.updateComplete;
  expect(composer.disabled).to.equal(true);
  const events: string[] = [];
  for (const name of ['lr-submit', 'lr-change']) el.addEventListener(name, () => events.push(name));
  for (const name of ['lr-submit', 'lr-change']) composer.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
  el.querySelector('button')!.dispatchEvent(new CustomEvent('lr-change', { bubbles: true, composed: true }));
  expect(events).to.deep.equal(['lr-submit', 'lr-change']);
});

it('lets built-in retrieval load-more requests reach host listeners', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-agent-workspace']>(html`<lr-agent-workspace
    retrieval-loading retrieval-has-more></lr-agent-workspace>`);
  await el.updateComplete;
  const results = el.shadowRoot!.querySelector('lr-retrieval-results');
  expect(results, 'built-in retrieval results').to.not.equal(null);
  let requests = 0;
  el.addEventListener('lr-load-more', () => { requests += 1; });
  results!.dispatchEvent(new CustomEvent('lr-load-more', { bubbles: true, composed: true }));
  expect(requests).to.equal(1);
});

it('names the conversation log once within the workspace', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-agent-workspace']>(html`<lr-agent-workspace></lr-agent-workspace>`);
  const region = el.shadowRoot!.querySelector('[part="conversation"]')!;
  const viewport = region.querySelector('lr-chat-viewport')!;
  await viewport.updateComplete;
  expect(region.hasAttribute('aria-label')).to.equal(false);
  expect(viewport.shadowRoot!.querySelector('[role="log"]')?.getAttribute('aria-label')).to.equal('Conversation');
});

it('falls back to a localized name for whitespace-only overrides', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-agent-workspace']>(html`<lr-agent-workspace
    aria-label="  " label="   " .strings=${{ agentWorkspaceLabel: 'Localized name' }}></lr-agent-workspace>`);
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Localized name');
  expect(el.shadowRoot!.querySelector('[part="heading"]')?.textContent).to.equal('Localized name');
  el.setAttribute('aria-label', '  Named control  ');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')?.trim()).to.equal('Named control');
});

it('restores its default for blank composer-max-rows and honors explicit numbers', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-agent-workspace']>(html`<lr-agent-workspace composer-max-rows=" "></lr-agent-workspace>`);
  expect(el.composerMaxRows).to.equal(8);
  el.setAttribute('composer-max-rows', '3');
  await el.updateComplete;
  expect(el.composerMaxRows).to.equal(3);
  el.removeAttribute('composer-max-rows');
  await el.updateComplete;
  expect(el.composerMaxRows).to.equal(8);
});

it('projects authored label references onto the inner region through reconnect', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><p id="region-name">Region name</p>
    <lr-agent-workspace aria-labelledby="region-name"></lr-agent-workspace></div>`);
  const el = wrapper.querySelector('lr-agent-workspace')!;
  await el.updateComplete;
  const region = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const name = () => (region.ariaLabelledByElements ?? (region.getAttribute('aria-labelledby') ?? '').split(/\s+/)
    .map(id => el.shadowRoot!.getElementById(id))).map(node => node?.textContent).join('');
  expect(name()).to.equal('Region name');
  el.remove();
  expect(name()).to.equal('');
  wrapper.append(el);
  await waitUntil(() => name() === 'Region name');
  el.removeAttribute('aria-labelledby');
  await waitUntil(() => name() === '');
});
