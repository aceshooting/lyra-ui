import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import type { LyraButton } from '../../forms/button/button.class.js';
import { createWidgetDocument } from './resolve.js';
import type { LyraWidgetRenderer } from './widget-renderer.class.js';
import '../../forms/button/button.js';
import './widget-renderer.js';

function documentFor(phase: number) {
  return createWidgetDocument({ type: 'col', id: 'panel', props: { gap: 'm', align: 'stretch' }, children: [
    { type: 'text', id: 'heading', props: { value: `Heading ${phase}` } },
    { type: 'row', id: 'controls', props: { gap: 's', align: 'center', justify: 'between' }, children: [
      { type: 'col', id: 'details', props: { gap: 's', align: 'start' }, children: [
        { type: 'text', id: 'caption', props: { value: `Details ${phase}` } },
        { type: 'button', id: 'run', actionId: `run-${phase}`, payload: { phase }, children: [`Run ${phase}`] },
      ] },
      { type: 'text', id: 'status', props: { value: 'Ready' } },
    ] },
  ] });
}

for (const direction of ['ltr', 'rtl']) {
  it(`renders nested builtin columns at 320px in ${direction} and retains keyed native action identity`, async () => {
    const element = await fixture<LyraWidgetRenderer>(html`<lr-widget-renderer dir=${direction}
      style="inline-size:320px;--lr-space-m:16px;--lr-space-s:8px" .document=${documentFor(1)}></lr-widget-renderer>`);
    const outer = element.shadowRoot!.querySelector<HTMLElement>('[part="col"]')!;
    const row = outer.querySelector<HTMLElement>('[part="row"]')!;
    const inner = row.querySelector<HTMLElement>('[part="col"]')!;
    const button = inner.querySelector<LyraButton>('lr-button')!;
    await button.updateComplete;
    await waitUntil(() => button.getBoundingClientRect().width > 0 && row.getBoundingClientRect().width > 0, 'nested action layout did not settle');
    expect([...outer.children].map(child => child.getAttribute('part'))).to.deep.equal(['text', 'row']);
    expect([...row.children].map(child => child.getAttribute('part'))).to.deep.equal(['col', 'text']);
    expect(inner.children[0]?.textContent?.trim()).to.equal('Details 1');
    expect(inner.children[1] === button).to.equal(true);
    expect(getComputedStyle(outer).display).to.equal('flex');
    expect(getComputedStyle(outer).flexDirection).to.equal('column');
    expect(getComputedStyle(outer).gap).to.equal('16px');
    expect(getComputedStyle(outer).alignItems).to.equal('stretch');
    expect(getComputedStyle(inner).flexDirection).to.equal('column');
    expect(getComputedStyle(inner).gap).to.equal('8px');
    expect(getComputedStyle(inner).alignItems).to.equal('flex-start');
    expect(getComputedStyle(row).flexDirection).to.equal('row');
    expect(getComputedStyle(row).justifyContent).to.equal('space-between');
    const status = row.children[1]!.getBoundingClientRect(), details = inner.getBoundingClientRect();
    expect(direction === 'rtl' ? details.left > status.left : details.left < status.left).to.equal(true);
    const bounds = outer.getBoundingClientRect();
    expect(Math.abs(bounds.width - 320)).to.be.lessThan(1);
    for (const node of [row, inner, button]) {
      const rect = node.getBoundingClientRect();
      expect(rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1).to.equal(true);
    }
    const actions: unknown[] = [];
    element.addEventListener('lr-widget-action', event => actions.push(event.detail));
    const first = oneEvent(element, 'lr-widget-action');
    await focusByKeyboard(button);
    await sendKeys({ press: 'Enter' });
    expect((await first).detail).to.deep.equal({ actionId: 'run-1', payload: { phase: 1 }, nodeId: 'run', nodeKey: 'id:run', nodePath: '0.1.0.1' });
    expect(actions.length).to.equal(1);
    element.document = documentFor(2);
    await element.updateComplete;
    expect(inner.querySelector('lr-button') === button).to.equal(true);
    await button.updateComplete;
    expect(inner.children[0]?.textContent?.trim()).to.equal('Details 2');
    expect(button.textContent?.trim()).to.equal('Run 2');
    expect(outer.children[0]?.textContent?.trim()).to.equal('Heading 2');
    const second = oneEvent(element, 'lr-widget-action');
    await focusByKeyboard(button);
    await sendKeys({ press: 'Enter' });
    expect((await second).detail).to.deep.equal({ actionId: 'run-2', payload: { phase: 2 }, nodeId: 'run', nodeKey: 'id:run', nodePath: '0.1.0.1' });
    expect(actions.length).to.equal(2);
  });
}
