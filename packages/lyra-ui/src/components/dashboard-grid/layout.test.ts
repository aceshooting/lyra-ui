import { expect } from '@open-wc/testing';
import {
  clampCandidate,
  findCollisions,
  overlaps,
  resolvePlacement,
  sortSpatial,
  type DashboardCell,
} from './layout.js';

describe('overlaps', () => {
  it('is true for two rectangles that share area', () => {
    expect(overlaps({ id: 'a', x: 0, y: 0, w: 2, h: 2 }, { id: 'b', x: 1, y: 1, w: 2, h: 2 })).to.be.true;
  });

  it('is false for rectangles that only touch edges', () => {
    expect(overlaps({ id: 'a', x: 0, y: 0, w: 2, h: 2 }, { id: 'b', x: 2, y: 0, w: 2, h: 2 })).to.be.false;
  });

  it('is false for rectangles with a gap between them', () => {
    expect(overlaps({ id: 'a', x: 0, y: 0, w: 1, h: 1 }, { id: 'b', x: 5, y: 5, w: 1, h: 1 })).to.be.false;
  });
});

describe('findCollisions', () => {
  const layout: DashboardCell[] = [
    { id: 'a', x: 0, y: 0, w: 2, h: 2 },
    { id: 'b', x: 4, y: 0, w: 2, h: 2 },
  ];

  it('excludes the candidate itself even when its id matches a layout entry', () => {
    expect(findCollisions(layout, { id: 'a', x: 0, y: 0, w: 2, h: 2 })).to.deep.equal([]);
  });

  it('lists every other cell the candidate rectangle overlaps', () => {
    expect(findCollisions(layout, { id: 'new', x: 1, y: 0, w: 1, h: 1 })).to.deep.equal(['a']);
  });
});

describe('clampCandidate', () => {
  it('clamps x so the cell never spans past the last column', () => {
    expect(clampCandidate({}, { x: 10, y: 0, w: 3, h: 1 }, 6)).to.deep.equal({ x: 3, y: 0, w: 3, h: 1 });
  });

  it('clamps a negative x to 0', () => {
    expect(clampCandidate({}, { x: -5, y: 0, w: 2, h: 1 }, 6)).to.deep.equal({ x: 0, y: 0, w: 2, h: 1 });
  });

  it('clamps a negative y to 0 (the row axis has no upper bound)', () => {
    expect(clampCandidate({}, { x: 0, y: -3, w: 2, h: 1 }, 6)).to.deep.equal({ x: 0, y: 0, w: 2, h: 1 });
  });

  it('clamps w/h to minW/minH when the request is smaller', () => {
    expect(clampCandidate({ minW: 2, minH: 2 }, { x: 0, y: 0, w: 1, h: 1 }, 6)).to.deep.equal({
      x: 0,
      y: 0,
      w: 2,
      h: 2,
    });
  });

  it('clamps w/h to maxW/maxH when the request is larger', () => {
    expect(clampCandidate({ maxW: 3, maxH: 4 }, { x: 0, y: 0, w: 8, h: 8 }, 6)).to.deep.equal({
      x: 0,
      y: 0,
      w: 3,
      h: 4,
    });
  });

  it('never lets w exceed the grid column count even without an explicit maxW', () => {
    expect(clampCandidate({}, { x: 0, y: 0, w: 20, h: 1 }, 6)).to.deep.equal({ x: 0, y: 0, w: 6, h: 1 });
  });
});

describe('sortSpatial', () => {
  it('orders row-major: top-to-bottom, then leading-to-trailing within a row', () => {
    const layout: DashboardCell[] = [
      { id: 'c', x: 0, y: 1, w: 1, h: 1 },
      { id: 'a', x: 2, y: 0, w: 1, h: 1 },
      { id: 'b', x: 0, y: 0, w: 1, h: 1 },
    ];
    expect(sortSpatial(layout).map((c) => c.id)).to.deep.equal(['b', 'a', 'c']);
  });

  it('does not mutate the input array', () => {
    const layout: DashboardCell[] = [
      { id: 'b', x: 1, y: 0, w: 1, h: 1 },
      { id: 'a', x: 0, y: 0, w: 1, h: 1 },
    ];
    const original = [...layout];
    sortSpatial(layout);
    expect(layout).to.deep.equal(original);
  });
});

describe('resolvePlacement', () => {
  it('returns accepted=false unchanged for an unknown candidateId', () => {
    const layout: DashboardCell[] = [{ id: 'a', x: 0, y: 0, w: 1, h: 1 }];
    const result = resolvePlacement(layout, 'ghost', { x: 1, y: 1, w: 1, h: 1 }, 6, 'reject');
    expect(result.accepted).to.be.false;
    expect(result.layout).to.equal(layout);
  });

  describe('policy: reject', () => {
    it('applies a non-colliding move', () => {
      const layout: DashboardCell[] = [
        { id: 'a', x: 0, y: 0, w: 1, h: 1 },
        { id: 'b', x: 3, y: 0, w: 1, h: 1 },
      ];
      const result = resolvePlacement(layout, 'a', { x: 1, y: 0, w: 1, h: 1 }, 6, 'reject');
      expect(result.accepted).to.be.true;
      expect(result.layout.find((c) => c.id === 'a')).to.deep.include({ x: 1, y: 0 });
      expect(result.collidedWith).to.deep.equal([]);
    });

    it('rejects a colliding move and leaves the layout reference unchanged', () => {
      const layout: DashboardCell[] = [
        { id: 'a', x: 0, y: 0, w: 1, h: 1 },
        { id: 'b', x: 1, y: 0, w: 1, h: 1 },
      ];
      const result = resolvePlacement(layout, 'a', { x: 1, y: 0, w: 1, h: 1 }, 6, 'reject');
      expect(result.accepted).to.be.false;
      expect(result.layout).to.equal(layout);
      expect(result.collidedWith).to.deep.equal(['b']);
    });
  });

  describe('policy: overlap', () => {
    it('applies a colliding move anyway, still reporting the collision', () => {
      const layout: DashboardCell[] = [
        { id: 'a', x: 0, y: 0, w: 1, h: 1 },
        { id: 'b', x: 1, y: 0, w: 1, h: 1 },
      ];
      const result = resolvePlacement(layout, 'a', { x: 1, y: 0, w: 1, h: 1 }, 6, 'overlap');
      expect(result.accepted).to.be.true;
      expect(result.layout.find((c) => c.id === 'a')).to.deep.include({ x: 1, y: 0 });
      expect(result.collidedWith).to.deep.equal(['b']);
    });
  });

  describe('policy: push', () => {
    it('pushes a single colliding cell straight down out of the candidate’s way', () => {
      const layout: DashboardCell[] = [
        { id: 'a', x: 0, y: 0, w: 1, h: 1 },
        { id: 'b', x: 1, y: 0, w: 1, h: 1 },
      ];
      const result = resolvePlacement(layout, 'a', { x: 1, y: 0, w: 1, h: 1 }, 6, 'push');
      expect(result.accepted).to.be.true;
      const a = result.layout.find((c) => c.id === 'a')!;
      const b = result.layout.find((c) => c.id === 'b')!;
      expect(a).to.deep.include({ x: 1, y: 0 });
      expect(b).to.deep.include({ x: 1, y: 1 });
      expect(overlaps(a, b)).to.be.false;
    });

    it('cascades a push through a chain of stacked cells', () => {
      const layout: DashboardCell[] = [
        { id: 'a', x: 0, y: 0, w: 1, h: 1 },
        { id: 'b', x: 1, y: 0, w: 1, h: 1 },
        { id: 'c', x: 1, y: 1, w: 1, h: 1 },
      ];
      const result = resolvePlacement(layout, 'a', { x: 1, y: 0, w: 1, h: 1 }, 6, 'push');
      const cells = result.layout;
      // No two cells may overlap after resolution.
      for (const x of cells) {
        for (const y of cells) {
          if (x.id !== y.id) expect(overlaps(x, y), `${x.id} vs ${y.id}`).to.be.false;
        }
      }
    });

    it('never moves a locked cell, and settles an unlocked cell underneath it instead', () => {
      const layout: DashboardCell[] = [
        { id: 'a', x: 0, y: 0, w: 1, h: 1 },
        { id: 'locked', x: 1, y: 1, w: 1, h: 1, locked: true },
        { id: 'b', x: 1, y: 0, w: 1, h: 1 },
      ];
      const result = resolvePlacement(layout, 'a', { x: 1, y: 0, w: 1, h: 1 }, 6, 'push');
      expect(result.accepted).to.be.true;
      const locked = result.layout.find((c) => c.id === 'locked')!;
      const b = result.layout.find((c) => c.id === 'b')!;
      expect(locked).to.deep.include({ x: 1, y: 1 });
      expect(overlaps(locked, b)).to.be.false;
    });

    it('rejects (does not push through) a direct collision with a locked cell', () => {
      const layout: DashboardCell[] = [
        { id: 'a', x: 0, y: 0, w: 1, h: 1 },
        { id: 'locked', x: 1, y: 0, w: 1, h: 1, locked: true },
      ];
      const result = resolvePlacement(layout, 'a', { x: 1, y: 0, w: 1, h: 1 }, 6, 'push');
      expect(result.accepted).to.be.false;
      expect(result.layout).to.equal(layout);
    });
  });

  it('clamps the requested placement to bounds before evaluating collisions', () => {
    const layout: DashboardCell[] = [{ id: 'a', x: 0, y: 0, w: 2, h: 1 }];
    const result = resolvePlacement(layout, 'a', { x: 99, y: -4, w: 2, h: 1 }, 6, 'reject');
    expect(result.accepted).to.be.true;
    expect(result.layout.find((c) => c.id === 'a')).to.deep.include({ x: 4, y: 0 });
  });
});
