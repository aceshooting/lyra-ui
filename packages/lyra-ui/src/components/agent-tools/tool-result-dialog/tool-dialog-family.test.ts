import { expect, fixture, html } from '@open-wc/testing';
import { setForcedColors } from '../../../../test/wtr-media.js';
import '../approval-queue/approval-queue.js';
import '../tool-approval-dialog/tool-approval-dialog.js';
import '../tool-call-block/tool-call-block.js';
import '../tool-call-chip/tool-call-chip.js';
import '../tool-param-form/tool-param-form.js';
import './tool-result-dialog.js';
import '../tool-result-view/tool-result-view.js';
import '../tool-select-dialog/tool-select-dialog.js';
import '../tool-timeline/tool-timeline.js';

const part = (host: HTMLElement, name: string) =>
  host.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`)!;

describe('tool dialog surfaces', () => {
  for (const template of [
    html`<lr-tool-approval-dialog open></lr-tool-approval-dialog>`,
    html`<lr-tool-result-dialog open></lr-tool-result-dialog>`,
    html`<lr-tool-select-dialog open></lr-tool-select-dialog>`,
  ]) {
    it(`honors inherited overlay tokens on ${template.strings[0]}`, async () => {
      const el = await fixture<HTMLElement>(template);
      el.style.setProperty('--lr-overlay-surface', 'rgb(21, 32, 43)');
      el.style.setProperty('--lr-overlay-radius', '17px');
      el.style.setProperty('--lr-overlay-border', 'rgb(54, 65, 76)');
      const panel = getComputedStyle(part(el, 'panel'));
      expect(panel.backgroundColor).to.equal('rgb(21, 32, 43)');
      expect(panel.borderTopColor).to.equal('rgb(54, 65, 76)');
      expect(panel.borderTopLeftRadius).to.equal('17px');
      expect(getComputedStyle(el).display).to.equal('flex');
      expect(getComputedStyle(el).alignItems).to.equal('center');
    });
  }

  it('inherits overlay tokens on the tool chip preview', async () => {
    const chip = await fixture<HTMLElement>(html`<lr-tool-call-chip
      style="--lr-overlay-surface:rgb(21, 32, 43);--lr-overlay-radius:17px">Preview</lr-tool-call-chip>`);
    const preview = getComputedStyle(part(chip, 'tooltip'));
    expect(preview.backgroundColor).to.equal('rgb(21, 32, 43)');
    expect(preview.borderTopLeftRadius).to.equal('17px');
  });

  it('uses form-control sizing on native parameter inputs', async () => {
    const el = await fixture<HTMLElement>(html`<lr-tool-param-form
      style="--lr-form-control-radius:17px;--lr-form-control-height:53px"
      .schema=${{type: 'object', properties: {task: {type: 'string'}}}}></lr-tool-param-form>`);
    const input = el.shadowRoot!.querySelector('input')!;
    expect(getComputedStyle(input).borderTopLeftRadius).to.equal('17px');
    expect(getComputedStyle(input).minHeight).to.equal('53px');
  });

  it('uses icon-button chrome on both result actions and the search clear action', async () => {
    const result = await fixture<HTMLElement>(html`<lr-tool-result-dialog></lr-tool-result-dialog>`);
    const select = await fixture<HTMLElementTagNameMap['lr-tool-select-dialog']>(html`<lr-tool-select-dialog></lr-tool-select-dialog>`);
    const input = part(select, 'search-input') as HTMLInputElement;
    input.value = 'abc';
    input.dispatchEvent(new Event('input'));
    await select.updateComplete;
    for (const [host, names] of [[result, ['maximize-button', 'close-button']], [select, ['search-clear']]] as const) {
      host.style.setProperty('--lr-icon-button-radius', '19px');
      for (const name of names) expect(getComputedStyle(part(host, name)).borderTopLeftRadius).to.equal('19px');
    }
  });

  it('lets a listener veto a result close button and a catalog backdrop dismissal', async () => {
    const result = await fixture<HTMLElementTagNameMap['lr-tool-result-dialog']>(html`<lr-tool-result-dialog open></lr-tool-result-dialog>`);
    result.addEventListener('lr-request-close', e => e.preventDefault(), {once: true});
    part(result, 'close-button').click();
    expect(result.open).to.equal(true);
    part(result, 'close-button').click();
    expect(result.open).to.equal(false);
    const select = await fixture<HTMLElementTagNameMap['lr-tool-select-dialog']>(html`<lr-tool-select-dialog open light-dismiss></lr-tool-select-dialog>`);
    select.addEventListener('lr-request-close', e => e.preventDefault(), {once: true});
    part(select, 'backdrop').click();
    expect(select.open).to.equal(true);
    part(select, 'backdrop').click();
    expect(select.open).to.equal(false);
  });

  it('can veto the approval dialog backdrop without resolving the proposal', async () => {
    const approval = await fixture<HTMLElementTagNameMap['lr-tool-approval-dialog']>(html`<lr-tool-approval-dialog open light-dismiss></lr-tool-approval-dialog>`);
    const requests: string[] = [];
    approval.addEventListener('lr-request-close', e => {
      requests.push((e as CustomEvent).detail.source);
      e.preventDefault();
    }, {once:true});
    part(approval, 'backdrop').click();
    expect(requests).to.deep.equal(['backdrop']);
    expect(approval.open).to.equal(true);
    part(approval, 'backdrop').click();
    expect(approval.open).to.equal(false);
  });

  it('reports the committed maximized state', async () => {
    const el = await fixture<HTMLElementTagNameMap['lr-tool-result-dialog']>(html`<lr-tool-result-dialog open></lr-tool-result-dialog>`);
    const changes: boolean[] = [];
    el.addEventListener('lr-after-maximize-change', () => changes.push(el.hasAttribute('maximized')));
    part(el, 'maximize-button').click();
    await el.updateComplete;
    expect(changes).to.deep.equal([true]);
  });

  it('searches names and descriptions without accents and retains a custom filter query', async () => {
    const el = await fixture<HTMLElementTagNameMap['lr-tool-select-dialog']>(html`<lr-tool-select-dialog
      .tools=${[{id: 'a', name: 'Café'}, {id: 'b', name: 'Tool', description: 'Café'}]}></lr-tool-select-dialog>`);
    const input = part(el, 'search-input') as HTMLInputElement;
    input.value = 'CAFE';
    input.dispatchEvent(new Event('input'));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="tool-row"]').length).to.equal(2);
    const queries: string[] = [];
    el.filter = (_tool, query) => { queries.push(query); return true; };
    input.value = 'CAFÉ';
    input.dispatchEvent(new Event('input'));
    await el.updateComplete;
    expect(queries).to.deep.equal(['café', 'café']);
    el.requestUpdate();
    await el.updateComplete;
    expect(queries.length).to.equal(2);
  });

  it('normalizes invalid result statuses and reports committed changes', async () => {
    const el = await fixture<HTMLElementTagNameMap['lr-tool-result-view']>(html`<lr-tool-result-view></lr-tool-result-view>`);
    const statuses: string[] = [];
    el.addEventListener('lr-status-change', () => statuses.push(el.status));
    el.status = 'running';
    await el.updateComplete;
    el.setAttribute('status', 'invalid');
    await el.updateComplete;
    expect(statuses).to.deep.equal(['running', 'success']);
    expect(el.getAttribute('status')).to.equal('success');
  });

  it('keeps preformatted output separate from wrapping error prose', async () => {
    const el = await fixture<HTMLElement>(html`<lr-tool-call-block expanded .args=${{id: 1}} .result=${'ok'} error-text="failed"></lr-tool-call-block>`);
    expect(getComputedStyle(el.shadowRoot!.querySelector('lr-tool-result-view')!).overflowWrap).to.equal('normal');
    expect(getComputedStyle(part(el, 'error').querySelector('p')!).overflowWrap).to.equal('anywhere');
  });

  it('includes the category and request identifier in their respective control names', async () => {
    const chip = await fixture<HTMLElement>(html`<lr-tool-call-chip category="Files" name="Read" summary="Done"></lr-tool-call-chip>`);
    expect(part(chip, 'base').getAttribute('aria-label')).to.contain('Files');
    const queue = await fixture<HTMLElement>(html`<lr-approval-queue .requests=${[{id: 'a17', toolName: 'Read'}]}></lr-approval-queue>`);
    expect(part(queue, 'request').getAttribute('aria-label')).to.contain('\u2066a17\u2069');
    const block = await fixture<HTMLElement>(html`<lr-tool-call-block aria-label="Review" name="Read"></lr-tool-call-block>`);
    expect(part(block, 'header').getAttribute('aria-label')).to.contain('Review');
  });

  it('preserves the selected queue item and timeline marker in forced colors', async () => {
    const queue = await fixture<HTMLElement>(html`<lr-approval-queue selected-invocation-id="a" .requests=${[{id: 'a', toolName: 'Read'}, {id: 'b', toolName: 'Write'}]}></lr-approval-queue>`);
    const timeline = await fixture<HTMLElement>(html`<lr-tool-timeline .entries=${[{id: 'a', name: 'Read', status: 'success'}]}></lr-tool-timeline>`);
    await setForcedColors('active');
    try {
      if (matchMedia('(forced-colors: active)').matches) {
        const rows = queue.shadowRoot!.querySelectorAll('[part="request"]');
        expect(getComputedStyle(rows[0]!).outlineStyle).to.equal('solid');
        expect(getComputedStyle(rows[1]!).outlineStyle).to.equal('none');
        expect(getComputedStyle(part(timeline, 'entry-marker'), '::before').borderTopStyle).to.equal('solid');
      }
      const chip = await fixture<HTMLElement>(html`<lr-tool-call-chip status="error"></lr-tool-call-chip>`);
      expect(part(chip, 'status-text').textContent?.trim()).to.equal('Error');
      const block = await fixture<HTMLElement>(html`<lr-tool-call-block status="error"></lr-tool-call-block>`);
      expect(part(block, 'label').textContent?.trim()).to.match(/failed/i);
    } finally {
      await setForcedColors('none');
    }
  });
});

for (const tagName of ['lr-tool-result-dialog', 'lr-tool-approval-dialog', 'lr-tool-select-dialog'] as const) {
  it(`honors a veto on native Escape dismissal of ${tagName}`, async () => {
    const wrapper = await fixture<HTMLElement>(html`<div><dialog><button>Return</button></dialog></div>`);
    const outer = wrapper.querySelector('dialog')!;
    const host = document.createElement(tagName);
    wrapper.append(host);
    outer.showModal();
    try {
      host.show();
      await host.updateComplete;
      const carrier = host.shadowRoot!.querySelector('dialog')!;
      const sources: string[] = [];
      host.addEventListener('lr-request-close', event => {
        sources.push((event as CustomEvent).detail.source);
        event.preventDefault();
      }, { once: true });
      carrier.dispatchEvent(new Event('cancel', { cancelable: true }));
      expect(host.open).to.equal(true);
      expect(sources).to.deep.equal(['escape']);
      carrier.dispatchEvent(new Event('cancel', { cancelable: true }));
      expect(host.open).to.equal(false);
    } finally {
      host.close();
      await host.updateComplete;
      outer.close();
    }
  });
}
