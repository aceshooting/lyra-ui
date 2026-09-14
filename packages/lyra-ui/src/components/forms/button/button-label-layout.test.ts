import { expect, fixture, html } from '@open-wc/testing';
import './button.js';
import type { LyraButton } from './button.class.js';

/** The rendered content box of `[part~="base"]`: the row the label, adornments and caret share. */
function contentBox(el: LyraButton): { start: number; end: number; width: number } {
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  const rect = base.getBoundingClientRect();
  const style = getComputedStyle(base);
  const startInset =
    Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.borderLeftWidth);
  const endInset =
    Number.parseFloat(style.paddingRight) + Number.parseFloat(style.borderRightWidth);
  return {
    start: rect.left + startInset,
    end: rect.right - endInset,
    width: rect.width - startInset - endInset,
  };
}

function partRect(el: LyraButton, part: string): DOMRect {
  return (el.shadowRoot!.querySelector(`[part~="${part}"]`) as HTMLElement).getBoundingClientRect();
}

/** Where the label's own rendered glyphs actually sit. The `[part="label"]` wrapper is NOT a
 *  proxy for this: while the wrapper grows, its box reaches the trailing content edge even though
 *  the text inside it stays packed against the leading one — which is the whole defect. */
function labelTextRect(el: LyraButton): DOMRect {
  return el.querySelector<HTMLElement>('[data-label-text]')!.getBoundingClientRect();
}

/** The rendered width of the button's own gap token, read live rather than hardcoded. */
function gapPx(el: LyraButton): number {
  const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
  return Number.parseFloat(getComputedStyle(base).columnGap);
}

describe('lr-button: label layout', () => {
  it('centres icon+label in a stretched button instead of stretching the label', async () => {
    const el = (await fixture(html`
      <lr-button appearance="outlined" style="inline-size: 320px;">
        <svg slot="start" width="16" height="16" viewBox="0 0 16 16"><circle r="8" cx="8" cy="8"></circle></svg>
        <span data-label-text>Copy</span>
      </lr-button>
    `)) as LyraButton;
    await el.updateComplete;

    const row = contentBox(el);
    const start = partRect(el, 'start');
    const text = labelTextRect(el);
    const leadingSlack = start.left - row.start;
    const trailingSlack = row.end - text.right;

    expect(
      Math.abs(leadingSlack - trailingSlack),
      `leading slack ${leadingSlack} and trailing slack ${trailingSlack} must match`
    ).to.be.at.most(1.5);
    expect(
      Math.abs(text.left - start.right - gapPx(el)),
      `icon-to-label spacing ${text.left - start.right} must equal the gap token ${gapPx(el)}`
    ).to.be.at.most(1.5);
  });

  it('still pins a caret to the trailing edge of a stretched button', async () => {
    const el = (await fixture(html`
      <lr-button with-caret style="inline-size: 320px;"><span data-label-text>Menu</span></lr-button>
    `)) as LyraButton;
    await el.updateComplete;

    const row = contentBox(el);
    const text = labelTextRect(el);
    const caret = partRect(el, 'caret');
    expect(row.end - caret.right, 'the caret stays at the trailing content edge').to.be.at.most(1.5);
    expect(text.left - row.start, 'the label stays at the leading content edge').to.be.at.most(1.5);
  });

  it('still pins an end adornment to the trailing edge of a stretched button', async () => {
    const el = (await fixture(html`
      <lr-button style="inline-size: 320px;">
        <span data-label-text>Details</span>
        <svg slot="end" width="16" height="16" viewBox="0 0 16 16"><circle r="8" cx="8" cy="8"></circle></svg>
      </lr-button>
    `)) as LyraButton;
    await el.updateComplete;

    const row = contentBox(el);
    const end = partRect(el, 'end');
    const text = labelTextRect(el);
    expect(row.end - end.right, 'the end adornment stays at the trailing content edge').to.be.at.most(1.5);
    expect(text.left - row.start, 'the label stays at the leading content edge').to.be.at.most(1.5);
  });

  it('restores the previous full-width stretch through --lr-button-label-grow', async () => {
    const el = (await fixture(html`
      <lr-button style="inline-size: 320px; --lr-button-label-grow: 1;">
        <svg slot="start" width="16" height="16" viewBox="0 0 16 16"><circle r="8" cx="8" cy="8"></circle></svg>
        <span data-label-text>Copy</span>
      </lr-button>
    `)) as LyraButton;
    await el.updateComplete;

    const row = contentBox(el);
    const start = partRect(el, 'start');
    const label = partRect(el, 'label');
    expect(start.left - row.start, 'the icon returns to the leading content edge').to.be.at.most(1.5);
    expect(row.end - label.right, 'the label again fills to the trailing content edge').to.be.at.most(1.5);
  });

  it('positions the centred row through --lr-button-justify', async () => {
    const el = (await fixture(html`
      <lr-button style="inline-size: 320px; --lr-button-justify: flex-end;">
        <svg slot="start" width="16" height="16" viewBox="0 0 16 16"><circle r="8" cx="8" cy="8"></circle></svg>
        <span data-label-text>Copy</span>
      </lr-button>
    `)) as LyraButton;
    await el.updateComplete;

    const row = contentBox(el);
    const text = labelTextRect(el);
    expect(row.end - text.right, 'the row is packed against the trailing edge').to.be.at.most(1.5);
  });

  it('centres a plain stretched label with symmetric slack under RTL', async () => {
    const el = (await fixture(html`
      <lr-button dir="rtl" style="inline-size: 320px;"><span data-label-text>القائمة</span></lr-button>
    `)) as LyraButton;
    await el.updateComplete;

    const row = contentBox(el);
    const text = labelTextRect(el);
    const leadingSlack = row.end - text.right;
    const trailingSlack = text.left - row.start;
    expect(
      Math.abs(leadingSlack - trailingSlack),
      `RTL slack must be symmetric: ${leadingSlack} vs ${trailingSlack}`
    ).to.be.at.most(1.5);
  });

  it('pins the caret to the inline end and the label to the inline start under RTL', async () => {
    const el = (await fixture(html`
      <lr-button dir="rtl" with-caret style="inline-size: 320px;"
        ><span data-label-text>القائمة</span></lr-button
      >
    `)) as LyraButton;
    await el.updateComplete;

    const row = contentBox(el);
    const text = labelTextRect(el);
    const caret = partRect(el, 'caret');
    // Inline-end under RTL is physically to the LEFT, so the caret hugs the row's left edge and
    // the label's own glyphs hug the right one. A grown-but-centre-aligned label floated the text
    // in the middle of the row instead.
    expect(caret.left - row.start, 'the caret stays at the inline-end content edge').to.be.at.most(
      1.5
    );
    expect(row.end - text.right, 'the label stays at the inline-start content edge').to.be.at.most(
      1.5
    );
  });

  it('wraps a long label onto multiple lines when wrap is set', async () => {
    const singleLine = (await fixture(html`
      <lr-button style="inline-size: 140px;">A rather long multi word button label</lr-button>
    `)) as LyraButton;
    await singleLine.updateComplete;
    const singleLineHeight = (
      singleLine.shadowRoot!.querySelector('[part="label"]') as HTMLElement
    ).getBoundingClientRect().height;

    const el = (await fixture(html`
      <lr-button wrap style="inline-size: 140px;"
        >A rather long multi word button label</lr-button
      >
    `)) as LyraButton;
    await el.updateComplete;
    const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
    expect(getComputedStyle(label).whiteSpace, 'wrap opts out of the single-line rule').to.equal(
      'normal'
    );
    expect(
      label.getBoundingClientRect().height,
      'the wrapped label is taller than the same text on one line'
    ).to.be.greaterThan(singleLineHeight * 1.5);
  });

  it('keeps the single-line ellipsis rule when wrap is unset (regression)', async () => {
    const el = (await fixture(html`
      <lr-button style="inline-size: 140px;">A rather long multi word button label</lr-button>
    `)) as LyraButton;
    await el.updateComplete;
    const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
    expect(el.wrap, 'wrap defaults to false').to.equal(false);
    expect(getComputedStyle(label).whiteSpace).to.equal('nowrap');
    expect(getComputedStyle(label).textOverflow).to.equal('ellipsis');
  });

  it('treats a visually hidden label as no label at all for icon-only detection', async () => {
    const el = (await fixture(html`
      <lr-button>
        <svg width="16" height="16" viewBox="0 0 16 16"><circle r="8" cx="8" cy="8"></circle></svg>
        <span
          style="position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;"
          >Close</span
        >
      </lr-button>
    `)) as LyraButton;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    expect(base.hasAttribute('data-icon-button'), 'the square icon-only treatment applies').to.equal(
      true
    );
    const box = base.getBoundingClientRect();
    expect(Math.abs(box.width - box.height), 'the control renders square').to.be.at.most(1.5);
  });

  it('still counts a visible text label as content (regression)', async () => {
    const el = (await fixture(html`
      <lr-button>
        <svg width="16" height="16" viewBox="0 0 16 16"><circle r="8" cx="8" cy="8"></circle></svg>
        <span>Close</span>
      </lr-button>
    `)) as LyraButton;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part~="base"]') as HTMLElement;
    expect(base.hasAttribute('data-icon-button')).to.equal(false);
  });
});
