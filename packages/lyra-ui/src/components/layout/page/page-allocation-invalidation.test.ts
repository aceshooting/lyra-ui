import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import './page.js';
import type { LyraPage } from './page.class.js';

async function settleAllocation(): Promise<void> {
  await nextFrame();
  await nextFrame();
}

for (const unit of ['em', 'rem'] as const) {
  it(`ignores block-only allocation notifications without re-reading ${unit} breakpoint styles`, async () => {
    const page = await fixture<LyraPage>(html`
      <lr-page mobile-breakpoint=${`30${unit}`} style="inline-size:1000px;font-size:16px">
        <div style="block-size:4000px">Growing content</div>
      </lr-page>
    `);
    const content = page.querySelector<HTMLElement>('div')!;
    let deliveries = 0;
    const widths: number[] = [];
    const heights: number[] = [];
    const observer = new ResizeObserver((entries) => {
      const entry = entries.find((candidate) => candidate.target === page);
      if (!entry) return;
      widths.push(entry.contentRect.width);
      heights.push(entry.contentRect.height);
      deliveries += 1;
    });
    const original = window.getComputedStyle;
    let reads = 0;
    try {
      observer.observe(page);
      await waitUntil(() => deliveries > 0, 'the native observer delivered the initial page allocation');
      await settleAllocation();
      window.getComputedStyle = function (element, pseudoElement) {
        if (element === page || element === document.documentElement) reads += 1;
        return original.call(this, element, pseudoElement);
      };
      for (let growth = 1; growth <= 3; growth += 1) {
        const previous = deliveries;
        content.style.blockSize = `${4000 + growth * 200}px`;
        await waitUntil(() => deliveries > previous, 'content growth delivered a native allocation notification');
        await settleAllocation();
        expect(page.view).to.equal('desktop');
      }
      expect(new Set(widths).size, 'the observer saw one unchanged inline allocation').to.equal(1);
      expect(heights.at(-1)!, 'content actually grew the page block allocation').to.be.greaterThan(heights[0]!);
      expect(reads, 'block growth does not re-resolve font-relative breakpoints').to.equal(0);
      page.style.inlineSize = '300px';
      await waitUntil(() => page.view === 'mobile', 'an inline allocation change still reclassifies the page');
    } finally {
      window.getComputedStyle = original;
      observer.disconnect();
    }
  });
}

it('uses a zero em breakpoint when the page font size is zero', async () => {
  const page = await fixture<LyraPage>(html`
    <lr-page mobile-breakpoint="2em" style="inline-size:20px;font-size:16px">Content</lr-page>
  `);
  await settleAllocation();
  expect(page.view).to.equal('mobile');
  page.style.fontSize = '0px';
  await settleAllocation();
  expect(page.view).to.equal('desktop');
});

it('re-resolves a rem breakpoint when the root font changes at an unchanged page width', async () => {
  const root = document.documentElement;
  const previous = root.style.fontSize;
  const body = document.body;
  const previousBody = body.style.fontSize;
  try {
    body.style.fontSize = '12px';
    root.style.fontSize = '16px';
    const page = await fixture<LyraPage>(html`
      <lr-page mobile-breakpoint="30rem" style="inline-size:500px;font-size:16px">Content</lr-page>
    `);
    await settleAllocation();
    expect(page.view).to.equal('desktop');
    const width = page.getBoundingClientRect().width;
    root.style.fontSize = '20px';
    await waitUntil(() => page.view === 'mobile', 'the root font change invalidated the same-width breakpoint', { timeout: 2500 });
    expect(page.getBoundingClientRect().width).to.equal(width);
    root.style.fontSize = '16px';
    await waitUntil(() => page.view === 'desktop', 'restoring the root font restores desktop presentation', { timeout: 2500 });
  } finally {
    root.style.fontSize = previous;
    body.style.fontSize = previousBody;
  }
});

it('re-resolves an em breakpoint after a stylesheet changes the page font at an unchanged width', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <style>.page-font-allocation { font-size:10px; }</style>
      <lr-page class="page-font-allocation" mobile-breakpoint="40em" style="inline-size:500px">Content</lr-page>
    </div>
  `);
  const page = wrapper.querySelector<LyraPage>('lr-page')!;
  const stylesheet = wrapper.querySelector('style')!;
  await settleAllocation();
  expect(page.view).to.equal('desktop');
  const width = page.getBoundingClientRect().width;
  stylesheet.textContent = '.page-font-allocation { font-size:20px; }';
  await waitUntil(() => page.view === 'mobile', 'a stylesheet font change invalidated the same-width breakpoint', { timeout: 2500 });
  expect(page.getBoundingClientRect().width).to.equal(width);
  stylesheet.textContent = '.page-font-allocation { font-size:10px; }';
  await waitUntil(() => page.view === 'desktop', 'restoring the stylesheet font restores desktop presentation', { timeout: 2500 });
});

it('re-resolves an explicitly changed breakpoint without changing the inline allocation', async () => {
  const page = await fixture<LyraPage>(html`<lr-page style="inline-size:500px;font-size:10px">Content</lr-page>`);
  await settleAllocation();
  expect(page.view).to.equal('mobile');
  page.mobileBreakpoint = '40em';
  await waitUntil(() => page.view === 'desktop', 'switching from pixels to em uses the current font');
  page.style.fontSize = '20px';
  await waitUntil(() => page.view === 'mobile', 'the newly selected em metric is observed');
  page.mobileBreakpoint = '400px';
  await waitUntil(() => page.view === 'desktop', 'switching back to pixels reclassifies immediately');
  page.style.fontSize = '30px';
  await settleAllocation();
  expect(page.view, 'a pixel breakpoint remains independent of font metrics').to.equal('desktop');
});

it('re-resolves a viewport-unit breakpoint on owner-window resize at an unchanged page width', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div style="inline-size:1200px"><iframe style="inline-size:900px;block-size:400px"></iframe></div>`);
  const frame = wrapper.querySelector('iframe')!;
  const owner = frame.contentDocument!;
  const view = frame.contentWindow!;
  const page = document.createElement('lr-page');
  page.mobileBreakpoint = '50vw';
  page.style.inlineSize = '400px';
  try {
    owner.body.append(page);
    await waitUntil(() => view.innerWidth > 800 && page.view === 'mobile', 'the breakpoint uses the current owner viewport');
    const width = page.getBoundingClientRect().width;
    frame.style.inlineSize = '600px';
    await waitUntil(() => view.innerWidth < 700 && page.view === 'desktop', 'an owner-window resize invalidated the same-width breakpoint');
    expect(page.getBoundingClientRect().width).to.equal(width);
  } finally {
    page.remove();
  }
});

it('releases document font measurements when the breakpoint changes or the page disconnects', async () => {
  const page = await fixture<LyraPage>(html`<lr-page style="inline-size:500px"></lr-page>`);
  const owners = [document.documentElement, document.body];
  const childCounts = owners.map((element) => element.children.length);
  page.mobileBreakpoint = '32rem';
  await page.updateComplete;
  page.mobileBreakpoint = '400px';
  await page.updateComplete;
  expect(owners.map((element) => element.children.length)).to.deep.equal(childCounts);
  page.mobileBreakpoint = '32rem';
  await page.updateComplete;
  page.remove();
  expect(owners.map((element) => element.children.length)).to.deep.equal(childCounts);
});
