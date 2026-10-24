import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import type { LyraSplitPanel } from './split-panel.class.js';
import './split-panel.js';

afterEach(async () => { await resetMouse(); });

async function panel(snap: string): Promise<LyraSplitPanel> {
  const el = await fixture<LyraSplitPanel>(html`<lr-split-panel .snap=${snap}
    style="inline-size:400px;block-size:120px"><div slot="start">Start</div><div slot="end">End</div></lr-split-panel>`);
  await waitUntil(() => Math.abs(el.positionInPixels - 200) < 0.1);
  return el;
}

async function dragTo(el: LyraSplitPanel, position: number): Promise<void> {
  const divider = el.shadowRoot!.querySelector<HTMLElement>('[part~="divider"]')!;
  await hoverUntilMatched(divider, 'the native pointer did not reach the separator');
  const rect = divider.getBoundingClientRect();
  const x = Math.round(rect.left + rect.width / 2);
  const y = Math.round(rect.top + rect.height / 2);
  const destination = x + Math.round(position - el.positionInPixels);
  await sendMouse({ type: 'move', position: [x, y] });
  await sendMouse({ type: 'down' });
  await waitUntil(() => divider.hasAttribute('data-dragging'));
  await sendMouse({ type: 'move', position: [destination, y] });
  await sendMouse({ type: 'up' });
  await waitUntil(() => !divider.hasAttribute('data-dragging'), 'the native release did not finish the drag');
  await el.updateComplete;
  expect(divider.hasAttribute('data-dragging')).to.equal(false);
}

for (const whitespace of ['\u2000', '\u2028', '\u2029', '\u202f']) {
  it(`recognizes uppercase repeat/pixel tokens separated by U+${whitespace.charCodeAt(0).toString(16)} during a native drag`, async () => {
    const el = await panel(`REPEAT(${whitespace}100PX${whitespace})`);
    const changes: number[] = [];
    el.addEventListener('lr-resize-change', event => { changes.push(event.detail.positionInPixels); });
    await dragTo(el, 294);
    expect(el.positionInPixels).to.be.closeTo(300, 0.1);
    expect(changes).to.have.length(1);
    expect(changes[0]).to.be.closeTo(300, 0.1);

    el.snap = '';
    el.positionInPixels = 200;
    await el.updateComplete;
    await dragTo(el, 294);
    expect(el.positionInPixels, 'clearing snap restores the unsnapped pointer position').to.be.closeTo(294, 0.1);
    expect(changes).to.have.length(2);
    expect(changes[1]).to.be.closeTo(294, 0.1);
  });
}

it('uses every fractional digit of a leading-decimal percent snap point', async () => {
  const el = await panel('.5550%');
  await dragTo(el, 4);
  expect(el.positionInPixels).to.be.closeTo(2.22, 0.01);
  expect(el.position).to.be.closeTo(0.555, 0.01);
  el.snap = '';
  el.positionInPixels = 200;
  await el.updateComplete;
  await dragTo(el, 4);
  expect(el.positionInPixels).to.be.closeTo(4, 0.1);
});

it('leaves a drag unsnapped when a repeat expression ends after whitespace without a length', async () => {
  const el = await panel('repeat(\u2028\u2029');
  await dragTo(el, 294);
  expect(el.positionInPixels).to.be.closeTo(294, 0.1);
  expect(el.position).to.be.closeTo(73.5, 0.1);
});
