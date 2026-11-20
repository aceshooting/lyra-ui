import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-approval-queue.js';
import '../../lr-permission-rules.js';
import '../../lr-permission-grant.js';
import '../../lr-connector-manager.js';
import '../../lr-confirm-bar.js';
import '../../lr-tool-call-chip.js';
import '../../lr-tool-select-dialog.js';
import '../../lr-tool-timeline.js';
import '../../lr-tool-param-form.js';
import '../../lr-tool-approval-dialog.js';

const part = (el: HTMLElement, name: string) => el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;
const call = { id: 'a', name: 'Search', toolName: 'Search', args: {}, status: 'pending', needsApproval: true };

describe('tool approval interactions', () => {
  for (const [name, template] of [
    ['queue', html`<lr-approval-queue .requests=${[call]}></lr-approval-queue>`],
    ['timeline', html`<lr-tool-timeline .entries=${[call]}></lr-tool-timeline>`],
  ] as const) {
    it(`correlates review events and forwards deferred approval through the ${name}`, async () => {
      const host = await fixture<HTMLElement>(template);
      const opens: string[] = [];
      const closes: string[] = [];
      host.addEventListener(name === 'queue' ? 'lr-approval-open' : 'lr-tool-approval-open', e => opens.push((e as CustomEvent).detail.invocationId));
      host.addEventListener(name === 'queue' ? 'lr-approval-close' : 'lr-tool-approval-close', e => closes.push((e as CustomEvent).detail.reason));
      const trigger = name === 'queue' ? part(host, 'request') : host.shadowRoot!.querySelector('lr-tool-call-chip')!;
      trigger.click();
      await waitUntil(() => !!host.shadowRoot!.querySelector('lr-tool-approval-dialog')?.open);
      const dialog = host.shadowRoot!.querySelector('lr-tool-approval-dialog')!;
      let finish!: () => void;
      const done = new Promise<void>(resolve => { finish = resolve; });
      host.addEventListener(name === 'queue' ? 'lr-approval-decision-request' : 'lr-tool-approval-decide-request', e => {
        (e as CustomEvent).detail.waitUntil(done);
      });
      part(dialog, 'approve-button').click();
      await dialog.updateComplete;
      expect(dialog.pendingAction).to.equal('approve');
      expect(opens).to.deep.equal(['a']);
      finish();
      await waitUntil(() => !dialog.open);
      expect(closes).to.deep.equal(['approve']);
    });
  }

  it('reports a correlated timeline close when a reviewed entry is removed', async () => {
    const timeline = await fixture<HTMLElementTagNameMap['lr-tool-timeline']>(html`<lr-tool-timeline
      .entries=${[{...call, sourceKey:'s'}]}></lr-tool-timeline>`);
    timeline.shadowRoot!.querySelector('lr-tool-call-chip')!.click();
    await timeline.updateComplete;
    const closed: unknown[] = [];
    timeline.addEventListener('lr-tool-approval-close', e => closed.push((e as CustomEvent).detail));
    timeline.entries = [];
    await timeline.updateComplete;
    expect(closed).to.deep.equal([{invocationId:'a', sourceKey:'s', reason:'request-invalidated'}]);
  });

  it('releases a vetoed timeline decision when deferred denial rejects', async () => {
    const timeline = await fixture<HTMLElementTagNameMap['lr-tool-timeline']>(html`<lr-tool-timeline .entries=${[call]}></lr-tool-timeline>`);
    timeline.shadowRoot!.querySelector('lr-tool-call-chip')!.click();
    const dialog = timeline.shadowRoot!.querySelector('lr-tool-approval-dialog')!;
    await waitUntil(() => dialog.open);
    let reject!: () => void;
    const save = new Promise<void>((_resolve, fail) => { reject = fail; });
    timeline.addEventListener('lr-tool-approval-decide-request', e => {
      e.preventDefault();
      (e as CustomEvent).detail.waitUntil(save);
    }, {once: true});
    part(dialog, 'deny-button').click();
    expect(timeline.pendingApproval).to.equal('deny');
    reject();
    await waitUntil(() => timeline.pendingApproval === null && dialog.pendingAction === null);
    expect(dialog.open).to.equal(true);
    part(dialog, 'approve-button').click();
    await waitUntil(() => !dialog.open);
  });

  for (const [name, template, selector] of [
    ['queue', html`<lr-approval-queue heading-level="5"></lr-approval-queue>`, '[part="heading"]'],
    ['approval dialog', html`<lr-tool-approval-dialog heading-level="5"></lr-tool-approval-dialog>`, '[part="header"] > :first-child'],
    ['catalog', html`<lr-tool-select-dialog heading-level="5" .tools=${[{id: 'a', name: 'A'}]}></lr-tool-select-dialog>`, '[part="title"]'],
  ] as const) {
    it(`supports changing and suppressing the ${name} heading level`, async () => {
      const host = await fixture<HTMLElement & {updateComplete: Promise<unknown>}>(template);
      const heading = () => host.shadowRoot!.querySelector(selector)!;
      expect(heading().getAttribute('aria-level') ?? heading().localName).to.be.oneOf(['5', 'h5']);
      host.setAttribute('heading-level', 'none');
      await host.updateComplete;
      expect(heading().matches('h1,h2,h3,h4,h5,h6,[role="heading"]')).to.equal(false);
    });
  }

  it('gates decisions when the approval dialog is disabled', async () => {
    const dialog = await fixture<HTMLElement>(html`<lr-tool-approval-dialog open disabled></lr-tool-approval-dialog>`);
    for (const name of ['approve-button','deny-button','edit-button']) expect(part(dialog, name).hasAttribute('disabled')).to.equal(true);
  });

  it('keeps a disabled queue from opening review', async () => {
    const host = await fixture<HTMLElementTagNameMap['lr-approval-queue']>(html`<lr-approval-queue disabled readonly .requests=${[call]}></lr-approval-queue>`);
    part(host,'request').click();
    expect(host.open).to.equal(false);
    host.readonly = false;
    await host.updateComplete;
    // `readonly` is a non-reflecting property: clearing it leaves the authored attribute in place.
    expect(host.readonly).to.equal(false);
    expect(host.hasAttribute('readonly')).to.equal(true);
  });

  for (const [name, template] of [
    ['timeline', html`<lr-tool-timeline .entries=${[call]}></lr-tool-timeline>`],
    ['queue', html`<lr-approval-queue .requests=${[call]}></lr-approval-queue>`],
  ] as const) {
    it(`does not treat a grandchild close event as dismissing approval review in the ${name}`, async () => {
      const host = await fixture<HTMLElementTagNameMap['lr-tool-timeline' | 'lr-approval-queue']>(template);
      const trigger = name === 'queue' ? part(host, 'request') : host.shadowRoot!.querySelector('lr-tool-call-chip')!;
      trigger.click();
      await waitUntil(() => !!host.shadowRoot!.querySelector('lr-tool-approval-dialog')?.open);
      const dialog = host.shadowRoot!.querySelector('lr-tool-approval-dialog')!;
      const child = document.createElement('span');
      dialog.append(child);
      child.dispatchEvent(new CustomEvent('lr-close', { bubbles: true, composed: true, detail: { reason: 'child' } }));
      await host.updateComplete;
      expect(dialog.open).to.equal(true);
    });
  }

  it('captures parameter bindings made between connection and first render for reset', async () => {
    const wrapper = await fixture<HTMLElement>(html`<div></div>`);
    const form = document.createElement('lr-tool-param-form');
    wrapper.append(form);
    form.value = {n: 1};
    await form.updateComplete;
    form.value = {n: 2};
    form.formResetCallback();
    expect(form.value).to.deep.equal({n: 1});
  });

  it('refreshes parameter validation messages after a strings override', async () => {
    const form = await fixture<HTMLElementTagNameMap['lr-tool-param-form']>(html`<lr-tool-param-form
      .schema=${{type:'object', properties:{name:{type:'string'}}, required:['name']}}></lr-tool-param-form>`);
    const before = form.validationMessage;
    form.strings = {fieldRequired:'Obligatoire'};
    await form.updateComplete;
    expect(before).not.to.equal('Obligatoire');
    expect(form.validationMessage).to.equal('Obligatoire');
  });

  it('uses the shared field radius for a rule decision', async () => {
    const host = await fixture<HTMLElement>(html`<lr-permission-rules style="--lr-form-control-radius:17px"
      .rules=${[{id:'r',label:'Read',scope:'files',decision:'ask'}]}></lr-permission-rules>`);
    expect(getComputedStyle(part(host, 'decision')).borderTopLeftRadius).to.equal('17px');
  });

  it('keeps the defaults hint aligned when the switch track changes width', async () => {
    const host = await fixture<HTMLElement>(html`<lr-tool-select-dialog open use-defaults style="--lr-switch-track-inline-size:70px"></lr-tool-select-dialog>`);
    const hint = part(host, 'defaults-hint');
    expect(getComputedStyle(hint).paddingInlineStart).to.equal('0px');
  });

  it('keeps decorative chip separators out of the accessible name', async () => {
    const host = await fixture<HTMLElement>(html`<lr-tool-call-chip category="Files" name="Read" summary="Done"></lr-tool-call-chip>`);
    expect(part(host, 'category').nextElementSibling?.getAttribute('aria-hidden')).to.equal('true');
    expect(part(host, 'category').nextElementSibling?.textContent).to.equal('·');
    expect(part(host, 'summary').previousElementSibling?.textContent).to.contain(':');
  });
});

it('ignores a pending row activation when the queue has just been disabled', async () => {
  const queue = await fixture<HTMLElementTagNameMap['lr-approval-queue']>(html`<lr-approval-queue .requests=${[call]}></lr-approval-queue>`);
  const row = part(queue, 'request');
  queue.disabled = true;
  row.click();
  expect(queue.open).to.equal(false);
});

it('opens a single review for repeated timeline activation and skips it when disabled', async () => {
  const el = await fixture<HTMLElementTagNameMap['lr-tool-timeline']>(html`<lr-tool-timeline disabled .entries=${[call]}></lr-tool-timeline>`);
  let opens = 0;
  el.addEventListener('lr-tool-approval-open', () => { opens++; });
  const chip = el.shadowRoot!.querySelector('lr-tool-call-chip')!;
  chip.click();
  expect(opens).to.equal(0);
  el.disabled = false;
  chip.click();
  chip.click();
  expect(opens).to.equal(1);
});

it('omits empty headings while retaining an accessible approval dialog name', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <lr-approval-queue label=""></lr-approval-queue>
    <lr-tool-select-dialog label=""></lr-tool-select-dialog>
    <lr-tool-approval-dialog open tool-name="Lookup" .strings=${{toolApprovalHeading: '  '}}></lr-tool-approval-dialog>
  </div>`);
  for (const panel of wrapper.children) {
    expect(panel.shadowRoot!.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]').length).to.equal(0);
  }
  const dialog = wrapper.querySelector('lr-tool-approval-dialog')!;
  expect(part(dialog, 'panel').getAttribute('aria-label')).to.equal('Lookup');
});
