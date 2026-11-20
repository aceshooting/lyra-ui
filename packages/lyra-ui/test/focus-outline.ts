import { expect } from '@open-wc/testing';

/**
 * Asserts that the keyboard focus outline painted by `target` lies wholly inside the client box of
 * `clip`, the nearest ancestor whose overflow clips it. An outline is not part of
 * getBoundingClientRect(), so its outer paint edge is the border box grown by width + offset
 * (negative for an inset ring); an axis whose overflow is `visible` does not clip and is skipped.
 */
export function expectOutlineInsideClip(target: Element, clip: Element): void {
  const style = getComputedStyle(target);
  const clipStyle = getComputedStyle(clip);
  const width = Number.parseFloat(style.outlineWidth);
  const offset = Number.parseFloat(style.outlineOffset);
  expect(target.matches(':focus-visible'), 'the outlined element owns keyboard focus styling').to.equal(true);
  expect(style.outlineStyle).to.equal('solid');
  expect(width, 'the rendered outline has nonzero paint width').to.be.greaterThan(0);
  expect(Number.isFinite(offset)).to.equal(true);

  const rect = target.getBoundingClientRect();
  const clipRect = clip.getBoundingClientRect();
  const extent = width + offset;
  const clipLeft = clipRect.left + clip.clientLeft;
  const clipTop = clipRect.top + clip.clientTop;
  const clipRight = clipLeft + clip.clientWidth;
  const clipBottom = clipTop + clip.clientHeight;
  expect(rect.width).to.be.greaterThan(0);
  expect(rect.height).to.be.greaterThan(0);
  expect(rect.right, 'the focused element is revealed inline').to.be.greaterThan(clipLeft);
  expect(rect.left, 'the focused element is revealed inline').to.be.lessThan(clipRight);

  if (clipStyle.overflowY !== 'visible') {
    expect(rect.top - extent, 'the top outline lies inside the block clipping edge').to.be.at.least(clipTop - 0.5);
    expect(rect.bottom + extent, 'the bottom outline lies inside the block clipping edge').to.be.at.most(clipBottom + 0.5);
  }
  if (clipStyle.overflowX !== 'visible') {
    expect(rect.left - extent, 'the start outline lies inside the inline clipping edge').to.be.at.least(clipLeft - 0.5);
    expect(rect.right + extent, 'the end outline lies inside the inline clipping edge').to.be.at.most(clipRight + 0.5);
  }
}
