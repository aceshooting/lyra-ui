import { expect } from '@open-wc/testing';
import { readCanvasRgba, resolveCanvasColor, resolveCanvasColors, toRgbaString } from './canvas-color.js';

/** Counts probe insertions, which is what makes a resolution expensive: each one forces a
 *  synchronous style recalculation. */
function countingScope(): { scope: HTMLElement; probes: () => number; dispose: () => void } {
  const scope = document.createElement('div');
  document.body.append(scope);
  let probes = 0;
  const original = scope.append.bind(scope);
  scope.append = ((...nodes: (Node | string)[]) => {
    probes += 1;
    original(...nodes);
  }) as HTMLElement['append'];
  return { scope, probes: () => probes, dispose: () => scope.remove() };
}

it('resolves a repeated color once per distinct string, preserving order', () => {
  const { scope, probes, dispose } = countingScope();
  try {
    const authored = Array.from({ length: 60 }, (_, i) => (i % 2 === 0 ? '#ff0000' : '#00ff00'));
    const resolved = resolveCanvasColors(scope, authored, 'transparent');

    expect(resolved).to.have.length(60);
    // Two distinct colors -- not 60 -- however long the array is.
    expect(probes()).to.equal(2);
    expect(resolved[0]).to.equal(resolved[2]);
    expect(resolved[0]).to.not.equal(resolved[1]);
  } finally {
    dispose();
  }
});

it('agrees with the scalar resolver for every entry', () => {
  const { scope, dispose } = countingScope();
  try {
    const authored = ['#ff0000', 'rebeccapurple', 'not-a-color', 'rgb(0, 128, 0)'];
    const batch = resolveCanvasColors(scope, authored, 'transparent');
    const scalar = authored.map((color) => resolveCanvasColor(scope, color, 'transparent'));
    expect(batch).to.deep.equal(scalar);
  } finally {
    dispose();
  }
});

it('falls back per entry without poisoning the entries around it', () => {
  const { scope, dispose } = countingScope();
  try {
    const resolved = resolveCanvasColors(scope, ['#ff0000', 'definitely-not-a-color'], 'transparent');
    expect(resolved[0]).to.not.equal('transparent');
    expect(resolved[1]).to.equal('transparent');
  } finally {
    dispose();
  }
});

it('returns an empty array for empty input without probing at all', () => {
  const { scope, probes, dispose } = countingScope();
  try {
    expect(resolveCanvasColors(scope, [], 'transparent')).to.deep.equal([]);
    expect(probes()).to.equal(0);
  } finally {
    dispose();
  }
});

it('resolves currentColor, inherit and unset to the scope\'s own computed color without probing', () => {
  const { scope, probes, dispose } = countingScope();
  try {
    scope.style.color = 'rgb(10, 20, 30)';
    for (const keyword of ['currentColor', ' INHERIT ', 'unset']) {
      expect(resolveCanvasColor(scope, keyword, 'transparent'), keyword).to.equal('rgb(10, 20, 30)');
    }
    expect(probes()).to.equal(0);
  } finally {
    dispose();
  }
});

it('uses the fallback for a color keyword when the scope has no computed style', () => {
  const detached = document.createElement('div');
  expect(resolveCanvasColor(detached, 'currentColor', '#123456')).to.equal('#123456');
});

describe('readCanvasRgba', () => {
  it('reads hex, named, hsl and color-mix colors as sRGB', () => {
    expect(readCanvasRgba(document, '#ff0000')).to.deep.equal([255, 0, 0, 1]);
    expect(readCanvasRgba(document, 'rebeccapurple')).to.deep.equal([102, 51, 153, 1]);
    expect(readCanvasRgba(document, 'hsl(120 100% 50%)')).to.deep.equal([0, 255, 0, 1]);
    const mixed = readCanvasRgba(document, 'color-mix(in srgb, red 50%, blue 50%)')!;
    expect(mixed[0]).to.be.closeTo(128, 1);
    expect(mixed[2]).to.be.closeTo(128, 1);
  });
  it('keeps alpha', () => {
    expect(readCanvasRgba(document, 'rgb(0 0 0 / 0.5)')![3]).to.be.closeTo(0.5, 0.01);
    expect(readCanvasRgba(document, 'transparent')![3]).to.equal(0);
  });
  it('returns undefined for invalid values and unresolved variables', () => {
    expect(readCanvasRgba(document, 'not-a-color')).to.equal(undefined);
    expect(readCanvasRgba(document, 'var(--missing)')).to.equal(undefined);
    expect(readCanvasRgba(document, '')).to.equal(undefined);
  });
  it('does not mistake a color equal to a probe base for invalid', () => {
    expect(readCanvasRgba(document, '#010203')).to.deep.equal([1, 2, 3, 1]);
  });
  it('fails closed on an unreadable canvas and reads a short pixel buffer as zeros', () => {
    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
    try {
      CanvasRenderingContext2D.prototype.getImageData = () => {
        throw new DOMException('Canvas pixels are unavailable', 'SecurityError');
      };
      expect(readCanvasRgba(document, '#ff0000')).to.equal(undefined);
      CanvasRenderingContext2D.prototype.getImageData = () =>
        ({ colorSpace: 'srgb', data: new Uint8ClampedArray(0), height: 0, width: 0 }) as ImageData;
      expect(readCanvasRgba(document, '#ff0000')).to.deep.equal([0, 0, 0, 0]);
    } finally {
      CanvasRenderingContext2D.prototype.getImageData = originalGetImageData;
    }
  });
  it('serializes to rgb/rgba strings', () => {
    expect(toRgbaString([1, 2, 3, 1])).to.equal('rgb(1, 2, 3)');
    expect(toRgbaString([1, 2, 3, 0.5])).to.equal('rgba(1, 2, 3, 0.5)');
    expect(toRgbaString([300, -4, NaN, 2])).to.equal('rgb(255, 0, 0)');
  });
});
