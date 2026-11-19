import { fixture, expect, html } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import { setForcedColors } from '../../../../test/wtr-media.js';
import './flow-node.js';
import type { LyraFlowNode } from './flow-node.js';

describe('lr-flow-node progress', () => {
  afterEach(async () => {
    await setForcedColors('none');
  });

  it('names the progress bar after its node', async () => {
    const el = await fixture<LyraFlowNode>(html`<lr-flow-node heading="Fetch" .progress=${40}></lr-flow-node>`);
    expect(el.shadowRoot!.querySelector('[role="progressbar"]')!.getAttribute('aria-label')).to.equal('Fetch progress');
    const bare = await fixture<LyraFlowNode>(html`<lr-flow-node .progress=${40}></lr-flow-node>`);
    expect(bare.shadowRoot!.querySelector('[role="progressbar"]')!.getAttribute('aria-label')).to.equal('Progress');
  });

  it('keeps the progress fill and running border visible in forced colors', async () => {
    const el = await fixture<LyraFlowNode>(html`<lr-flow-node heading="Fetch" status="running" .progress=${40}></lr-flow-node>`);
    await setForcedColors('active');
    await twoFrames();
    expect(matchMedia('(forced-colors: active)').matches).to.equal(true);
    const fill = getComputedStyle(el.shadowRoot!.querySelector('.progress-fill')!).backgroundColor;
    const track = getComputedStyle(el.shadowRoot!.querySelector('[part="progress"]')!).backgroundColor;
    const reference = document.createElement('div');
    reference.style.backgroundColor = 'Highlight';
    el.after(reference);
    expect(fill).to.equal(getComputedStyle(reference).backgroundColor);
    expect(getComputedStyle(el.shadowRoot!.querySelector('.card')!).borderTopColor).to.equal(fill);
    expect(fill === track).to.equal(false);
  });
});

it('reserves a handle gutter only on sides with handles', async () => {
  const el = await fixture<LyraFlowNode>(html`<lr-flow-node .inputs=${[]} .outputs=${[]}></lr-flow-node>`);
  const gutters = [...el.shadowRoot!.querySelectorAll<HTMLElement>('.handles')];
  expect(gutters.map(gutter => gutter.getBoundingClientRect().width)).to.deep.equal([0, 0]);
  el.outputs = [{ id: 'result' }];
  await el.updateComplete;
  expect(gutters[1]!.getBoundingClientRect().width).to.be.greaterThan(0);
});
