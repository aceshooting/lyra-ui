import { expect, fixture, html } from '@open-wc/testing';
import '../../lr-chat-viewport.js';
import type { LyraChatViewport } from '../../lr-chat-viewport.js';
import { twoFrames } from '../../../../test/frames.js';

function parts(viewport: LyraChatViewport): { scroll: HTMLElement; content: HTMLElement } {
  return {
    scroll: viewport.shadowRoot!.querySelector<HTMLElement>('[part="scroll"]')!,
    content: viewport.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!,
  };
}

function rowsTops(viewport: LyraChatViewport): number[] {
  return Array.from(viewport.querySelectorAll<HTMLElement>(':scope > .row'), (row) => row.getBoundingClientRect().top);
}

describe('lr-chat-viewport layout tokens', () => {
  it('keeps the shipped padding, no gap, and an unconstrained content width when unset', async () => {
    const host = await fixture<HTMLElement>(html`<div style="block-size:300px;inline-size:600px">
      <lr-chat-viewport>
        <div class="row" style="block-size:20px"></div>
        <div class="row" style="block-size:20px"></div>
      </lr-chat-viewport>
    </div>`);
    const viewport = host.querySelector<LyraChatViewport>('lr-chat-viewport')!;
    await viewport.updateComplete;
    const { scroll, content } = parts(viewport);
    const probe = document.createElement('div');
    probe.style.paddingTop = 'var(--lr-space-m)';
    document.body.append(probe);
    const spaceM = getComputedStyle(probe).paddingTop;
    probe.remove();
    expect(getComputedStyle(scroll).paddingTop).to.equal(spaceM);
    expect(getComputedStyle(scroll).paddingInlineStart).to.equal(spaceM);
    expect(getComputedStyle(content).maxInlineSize).to.equal('none');
    const [first, second] = rowsTops(viewport);
    expect(Math.round(second! - first!)).to.equal(20);
    expect(Math.round(content.getBoundingClientRect().width)).to.equal(
      Math.round(scroll.clientWidth - 2 * Number.parseFloat(spaceM)),
    );
  });

  it('applies --lr-chat-viewport-padding, -gap and -content-max-inline-size, centring the content', async () => {
    const host = await fixture<HTMLElement>(html`<div style="block-size:300px;inline-size:600px">
      <lr-chat-viewport
        unread-start-index="1"
        style="--lr-chat-viewport-padding:10px;--lr-chat-viewport-gap:12px;--lr-chat-viewport-content-max-inline-size:200px"
      >
        <div class="row" style="block-size:20px"></div>
        <div class="row" style="block-size:20px"></div>
        <div class="row" style="block-size:20px"></div>
      </lr-chat-viewport>
    </div>`);
    const viewport = host.querySelector<LyraChatViewport>('lr-chat-viewport')!;
    await viewport.updateComplete;
    await twoFrames();
    await viewport.updateComplete;
    const { scroll, content } = parts(viewport);
    expect(getComputedStyle(scroll).paddingTop).to.equal('10px');
    expect(getComputedStyle(scroll).paddingInlineEnd).to.equal('10px');
    const [first, second, third] = rowsTops(viewport);
    // The hidden semantic unread boundary inserted before row 2 must not add a second gap.
    expect(Math.round(second! - first!)).to.equal(32);
    expect(Math.round(third! - second!)).to.equal(32);
    const contentRect = content.getBoundingClientRect();
    const scrollRect = scroll.getBoundingClientRect();
    expect(Math.round(contentRect.width)).to.equal(200);
    const startSpace = contentRect.left - scrollRect.left;
    const endSpace = scrollRect.left + scroll.clientWidth - contentRect.right;
    expect(Math.abs(startSpace - endSpace)).to.be.lessThan(1);
    // The unread divider sits centred in the gap above the first unread row.
    const divider = viewport.shadowRoot!.querySelector<HTMLElement>('[part="unread-divider"]')!;
    const dividerRect = divider.getBoundingClientRect();
    const dividerMid = dividerRect.top + dividerRect.height / 2;
    expect(Math.abs(dividerMid - (second! - 6))).to.be.lessThan(1.5);
  });

  it('applies inherited jump fill, color, border, radius, and shadow', async () => {
    const host = await fixture<HTMLElement>(html`
      <div style="
        block-size:200px;
        --lr-chat-viewport-jump-bg: rgb(251, 251, 251);
        --lr-chat-viewport-jump-color: rgb(23, 23, 23);
        --lr-chat-viewport-jump-border: 2px solid rgb(97, 97, 97);
        --lr-chat-viewport-jump-radius: 9px;
        --lr-chat-viewport-jump-shadow: none;
      ">
        <lr-chat-viewport follow="false"><div style="block-size:400px">Message</div></lr-chat-viewport>
      </div>
    `);
    const viewport = host.querySelector<LyraChatViewport>('lr-chat-viewport')!;
    await viewport.updateComplete;
    const pill = viewport.shadowRoot!.querySelector('[part="jump-pill"]')!;
    const style = getComputedStyle(pill);
    expect(style.backgroundColor).to.equal('rgb(251, 251, 251)');
    expect(style.color).to.equal('rgb(23, 23, 23)');
    expect(style.borderTop).to.equal('2px solid rgb(97, 97, 97)');
    expect(style.borderTopLeftRadius).to.equal('9px');
    expect(style.boxShadow).to.equal('none');
  });

  it('gives the labelled jump pill the shared minimum hit area', async () => {
    const host = await fixture<HTMLElement>(html`
      <div style="block-size:200px">
        <lr-chat-viewport follow="false"><div style="block-size:400px">Message</div></lr-chat-viewport>
      </div>
    `);
    const viewport = host.querySelector<LyraChatViewport>('lr-chat-viewport')!;
    await viewport.updateComplete;
    const rect = viewport.shadowRoot!.querySelector('[part="jump-pill"]')!.getBoundingClientRect();
    // --lr-icon-button-size defaults to 2.25rem (36px).
    expect(Math.round(rect.height)).to.be.at.least(36);
    expect(Math.round(rect.width)).to.be.at.least(36);
  });

  it('centres a constrained content column under RTL too', async () => {
    const host = await fixture<HTMLElement>(html`<div dir="rtl" style="block-size:300px;inline-size:600px">
      <lr-chat-viewport style="--lr-chat-viewport-content-max-inline-size:240px">
        <div class="row" style="block-size:20px"></div>
      </lr-chat-viewport>
    </div>`);
    const viewport = host.querySelector<LyraChatViewport>('lr-chat-viewport')!;
    await viewport.updateComplete;
    const { scroll, content } = parts(viewport);
    const contentRect = content.getBoundingClientRect();
    const scrollRect = scroll.getBoundingClientRect();
    expect(Math.round(contentRect.width)).to.equal(240);
    const scrollMid = scrollRect.left + scroll.clientLeft + scroll.clientWidth / 2;
    const contentMid = contentRect.left + contentRect.width / 2;
    expect(Math.abs(scrollMid - contentMid)).to.be.lessThan(scrollRect.width - scroll.clientWidth + 1);
  });
});
