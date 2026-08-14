import { expect } from "@open-wc/testing";
import {
  resolveLyraDashboardPlacement,
  type LyraDashboardCell,
} from "./layout.js";
import * as publicLayout from "./layout.js";
import {
  clampDashboardCandidate,
  createDashboardSpatialIndex,
  findDashboardCollisions,
  overlapsDashboardCells,
  projectDashboardLayout,
  resolveDashboardPlacement,
  snapshotDashboardLayout,
  sortDashboardSpatial,
  type DashboardPlacementMetrics,
} from "./layout-internal.js";

function collisions(
  layout: readonly LyraDashboardCell[],
  candidate: LyraDashboardCell
): readonly string[] {
  return findDashboardCollisions(
    createDashboardSpatialIndex(layout, 6),
    candidate
  );
}

describe("overlapsDashboardCells", () => {
  it("is true for two rectangles that share area", () => {
    expect(
      overlapsDashboardCells(
        { id: "a", x: 0, y: 0, w: 2, h: 2 },
        { id: "b", x: 1, y: 1, w: 2, h: 2 }
      )
    ).to.be.true;
  });

  it("is false for rectangles that only touch edges", () => {
    expect(
      overlapsDashboardCells(
        { id: "a", x: 0, y: 0, w: 2, h: 2 },
        { id: "b", x: 2, y: 0, w: 2, h: 2 }
      )
    ).to.be.false;
  });

  it("is false for rectangles with a gap between them", () => {
    expect(
      overlapsDashboardCells(
        { id: "a", x: 0, y: 0, w: 1, h: 1 },
        { id: "b", x: 5, y: 5, w: 1, h: 1 }
      )
    ).to.be.false;
  });
});

describe("findDashboardCollisions", () => {
  const layout: LyraDashboardCell[] = [
    { id: "a", x: 0, y: 0, w: 2, h: 2 },
    { id: "b", x: 4, y: 0, w: 2, h: 2 },
  ];

  it("excludes the candidate itself even when its id matches a layout entry", () => {
    expect(
      collisions(layout, { id: "a", x: 0, y: 0, w: 2, h: 2 })
    ).to.deep.equal([]);
  });

  it("lists every other cell the candidate rectangle overlapsDashboardCells", () => {
    expect(
      collisions(layout, { id: "new", x: 1, y: 0, w: 1, h: 1 })
    ).to.deep.equal(["a"]);
  });
});

describe("clampDashboardCandidate", () => {
  it("clamps x so the cell never spans past the last column", () => {
    expect(
      clampDashboardCandidate({}, { x: 10, y: 0, w: 3, h: 1 }, 6)
    ).to.deep.equal({ x: 3, y: 0, w: 3, h: 1 });
  });

  it("clamps a negative x to 0", () => {
    expect(
      clampDashboardCandidate({}, { x: -5, y: 0, w: 2, h: 1 }, 6)
    ).to.deep.equal({ x: 0, y: 0, w: 2, h: 1 });
  });

  it("clamps a negative y to 0 (the row axis has no upper bound)", () => {
    expect(
      clampDashboardCandidate({}, { x: 0, y: -3, w: 2, h: 1 }, 6)
    ).to.deep.equal({ x: 0, y: 0, w: 2, h: 1 });
  });

  it("clamps w/h to minW/minH when the request is smaller", () => {
    expect(
      clampDashboardCandidate(
        { minW: 2, minH: 2 },
        { x: 0, y: 0, w: 1, h: 1 },
        6
      )
    ).to.deep.equal({
      x: 0,
      y: 0,
      w: 2,
      h: 2,
    });
  });

  it("clamps w/h to maxW/maxH when the request is larger", () => {
    expect(
      clampDashboardCandidate(
        { maxW: 3, maxH: 4 },
        { x: 0, y: 0, w: 8, h: 8 },
        6
      )
    ).to.deep.equal({
      x: 0,
      y: 0,
      w: 3,
      h: 4,
    });
  });

  it("never lets w exceed the grid column count even without an explicit maxW", () => {
    expect(
      clampDashboardCandidate({}, { x: 0, y: 0, w: 20, h: 1 }, 6)
    ).to.deep.equal({ x: 0, y: 0, w: 6, h: 1 });
  });
});

describe("sortDashboardSpatial", () => {
  it("orders row-major: top-to-bottom, then leading-to-trailing within a row", () => {
    const layout: LyraDashboardCell[] = [
      { id: "c", x: 0, y: 1, w: 1, h: 1 },
      { id: "a", x: 2, y: 0, w: 1, h: 1 },
      { id: "b", x: 0, y: 0, w: 1, h: 1 },
    ];
    expect(sortDashboardSpatial(layout).map((c) => c.id)).to.deep.equal([
      "b",
      "a",
      "c",
    ]);
  });

  it("does not mutate the input array", () => {
    const layout: LyraDashboardCell[] = [
      { id: "b", x: 1, y: 0, w: 1, h: 1 },
      { id: "a", x: 0, y: 0, w: 1, h: 1 },
    ];
    const original = [...layout];
    sortDashboardSpatial(layout);
    expect(layout).to.deep.equal(original);
  });
});

describe("resolveDashboardPlacement", () => {
  it("returns accepted=false unchanged for an unknown candidateId", () => {
    const layout: LyraDashboardCell[] = [{ id: "a", x: 0, y: 0, w: 1, h: 1 }];
    const result = resolveDashboardPlacement(
      layout,
      "ghost",
      { x: 1, y: 1, w: 1, h: 1 },
      6,
      "reject"
    );
    expect(result.accepted).to.be.false;
    expect(result.layout).to.equal(layout);
  });

  describe("policy: reject", () => {
    it("applies a non-colliding move", () => {
      const layout: LyraDashboardCell[] = [
        { id: "a", x: 0, y: 0, w: 1, h: 1 },
        { id: "b", x: 3, y: 0, w: 1, h: 1 },
      ];
      const result = resolveDashboardPlacement(
        layout,
        "a",
        { x: 1, y: 0, w: 1, h: 1 },
        6,
        "reject"
      );
      expect(result.accepted).to.be.true;
      expect(result.layout.find((c) => c.id === "a")).to.deep.include({
        x: 1,
        y: 0,
      });
      expect(result.collidedWith).to.deep.equal([]);
    });

    it("rejects a colliding move and leaves the layout reference unchanged", () => {
      const layout: LyraDashboardCell[] = [
        { id: "a", x: 0, y: 0, w: 1, h: 1 },
        { id: "b", x: 1, y: 0, w: 1, h: 1 },
      ];
      const result = resolveDashboardPlacement(
        layout,
        "a",
        { x: 1, y: 0, w: 1, h: 1 },
        6,
        "reject"
      );
      expect(result.accepted).to.be.false;
      expect(result.layout).to.equal(layout);
      expect(result.collidedWith).to.deep.equal(["b"]);
    });
  });

  describe("policy: overlap", () => {
    it("applies a colliding move anyway, still reporting the collision", () => {
      const layout: LyraDashboardCell[] = [
        { id: "a", x: 0, y: 0, w: 1, h: 1 },
        { id: "b", x: 1, y: 0, w: 1, h: 1 },
      ];
      const result = resolveDashboardPlacement(
        layout,
        "a",
        { x: 1, y: 0, w: 1, h: 1 },
        6,
        "overlap"
      );
      expect(result.accepted).to.be.true;
      expect(result.layout.find((c) => c.id === "a")).to.deep.include({
        x: 1,
        y: 0,
      });
      expect(result.collidedWith).to.deep.equal(["b"]);
    });
  });

  describe("policy: push", () => {
    it("pushes a single colliding cell straight down out of the candidate’s way", () => {
      const layout: LyraDashboardCell[] = [
        { id: "a", x: 0, y: 0, w: 1, h: 1 },
        { id: "b", x: 1, y: 0, w: 1, h: 1 },
      ];
      const result = resolveDashboardPlacement(
        layout,
        "a",
        { x: 1, y: 0, w: 1, h: 1 },
        6,
        "push"
      );
      expect(result.accepted).to.be.true;
      const a = result.layout.find((c) => c.id === "a")!;
      const b = result.layout.find((c) => c.id === "b")!;
      expect(a).to.deep.include({ x: 1, y: 0 });
      expect(b).to.deep.include({ x: 1, y: 1 });
      expect(overlapsDashboardCells(a, b)).to.be.false;
    });

    it("cascades a push through a chain of stacked cells", () => {
      const layout: LyraDashboardCell[] = [
        { id: "a", x: 0, y: 0, w: 1, h: 1 },
        { id: "b", x: 1, y: 0, w: 1, h: 1 },
        { id: "c", x: 1, y: 1, w: 1, h: 1 },
      ];
      const result = resolveDashboardPlacement(
        layout,
        "a",
        { x: 1, y: 0, w: 1, h: 1 },
        6,
        "push"
      );
      const cells = result.layout;
      // No two cells may overlap after resolution.
      for (const x of cells) {
        for (const y of cells) {
          if (x.id !== y.id)
            expect(overlapsDashboardCells(x, y), `${x.id} vs ${y.id}`).to.be
              .false;
        }
      }
    });

    it("never moves a locked cell, and settles an unlocked cell underneath it instead", () => {
      const layout: LyraDashboardCell[] = [
        { id: "a", x: 0, y: 0, w: 1, h: 1 },
        { id: "locked", x: 1, y: 1, w: 1, h: 1, locked: true },
        { id: "b", x: 1, y: 0, w: 1, h: 1 },
      ];
      const result = resolveDashboardPlacement(
        layout,
        "a",
        { x: 1, y: 0, w: 1, h: 1 },
        6,
        "push"
      );
      expect(result.accepted).to.be.true;
      const locked = result.layout.find((c) => c.id === "locked")!;
      const b = result.layout.find((c) => c.id === "b")!;
      expect(locked).to.deep.include({ x: 1, y: 1 });
      expect(overlapsDashboardCells(locked, b)).to.be.false;
    });

    it("rejects (does not push through) a direct collision with a locked cell", () => {
      const layout: LyraDashboardCell[] = [
        { id: "a", x: 0, y: 0, w: 1, h: 1 },
        { id: "locked", x: 1, y: 0, w: 1, h: 1, locked: true },
      ];
      const result = resolveDashboardPlacement(
        layout,
        "a",
        { x: 1, y: 0, w: 1, h: 1 },
        6,
        "push"
      );
      expect(result.accepted).to.be.false;
      expect(result.layout).to.equal(layout);
    });
  });

  it("clamps the requested placement to bounds before evaluating collisions", () => {
    const layout: LyraDashboardCell[] = [{ id: "a", x: 0, y: 0, w: 2, h: 1 }];
    const result = resolveDashboardPlacement(
      layout,
      "a",
      { x: 99, y: -4, w: 2, h: 1 },
      6,
      "reject"
    );
    expect(result.accepted).to.be.true;
    expect(result.layout.find((c) => c.id === "a")).to.deep.include({
      x: 4,
      y: 0,
    });
  });
});

describe("dashboard layout admission and public resolver", () => {
  it("keeps implementation helpers out of the public runtime module", () => {
    expect(Object.keys(publicLayout)).to.deep.equal([
      "resolveLyraDashboardPlacement",
    ]);
  });

  it("keeps valid records, skips malformed records, and uses first-valid duplicate ids", () => {
    const input: unknown[] = [
      { id: "first", x: 1, y: 2, w: 2, h: 3, label: "First" },
      null,
      { id: "", x: 0, y: 0, w: 1, h: 1 },
      { id: "first", x: 9, y: 9, w: 1, h: 1 },
      { id: "last", x: Number.NaN, y: -4, w: 999, h: 0 },
      Object.create({ id: "inherited", x: 0, y: 0, w: 1, h: 1 }),
    ];

    const snapshot = snapshotDashboardLayout(input);

    expect(snapshot.map((cell) => cell.id)).to.deep.equal(["first", "last"]);
    expect(snapshot[0]).to.deep.include({ x: 1, y: 2, w: 2, h: 3 });
    expect(snapshot[1]).to.deep.include({ x: 0, y: 0, w: 48, h: 1 });
  });

  it("normalizes contradictory constraints against the live column bound", () => {
    const snapshot = snapshotDashboardLayout([
      {
        id: "bounded",
        x: 0,
        y: 0,
        w: 1,
        h: 1,
        minW: 10,
        maxW: 2,
        minH: 5,
        maxH: 2,
      },
    ]);

    expect(projectDashboardLayout(snapshot, 6)[0]).to.deep.include({
      w: 6,
      h: 5,
      minW: 6,
      maxW: 6,
      minH: 5,
      maxH: 5,
    });
  });

  it("reads only the bounded prefix and survives hostile array and record getters", () => {
    let beyondBoundRead = false;
    const input = Array.from({ length: 1_002 }, (_, index) => ({
      id: `cell-${index}`,
      x: 0,
      y: index,
      w: 1,
      h: 1,
    }));
    Object.defineProperty(input, 2, {
      configurable: true,
      get: () => {
        throw new Error("hostile entry");
      },
    });
    Object.defineProperty(input, 1_000, {
      configurable: true,
      get: () => {
        beyondBoundRead = true;
        throw new Error("outside bound");
      },
    });
    const hostileRecord = { id: "hostile", y: 0, w: 1, h: 1 };
    Object.defineProperty(hostileRecord, "x", {
      get: () => {
        throw new Error("hostile field");
      },
    });
    input[3] = hostileRecord as (typeof input)[number];

    const snapshot = snapshotDashboardLayout(input);

    expect(snapshot).to.have.length(998);
    expect(snapshot.some((cell) => cell.id === "hostile")).to.be.false;
    expect(beyondBoundRead).to.be.false;

    const hostileLength = new Proxy([], {
      get(target, property, receiver) {
        if (property === "length") throw new Error("hostile length");
        return Reflect.get(target, property, receiver);
      },
    });
    expect(snapshotDashboardLayout(hostileLength)).to.deep.equal([]);
  });

  it("returns fresh frozen arrays and records that do not alias caller mutation", () => {
    const source = [{ id: "a", x: 0, y: 0, w: 1, h: 1 }];
    const result = resolveLyraDashboardPlacement(
      source,
      "a",
      { x: 2, y: 1, w: 1, h: 1 },
      6,
      "reject"
    );

    source[0]!.x = 5;
    source.push({ id: "later", x: 0, y: 0, w: 1, h: 1 });
    expect(result.layout).to.have.length(1);
    expect(result.layout[0]).to.deep.include({ id: "a", x: 2, y: 1 });
    expect(Object.isFrozen(result)).to.be.true;
    expect(Object.isFrozen(result.layout)).to.be.true;
    expect(Object.isFrozen(result.layout[0])).to.be.true;
    expect(Object.isFrozen(result.collidedWith)).to.be.true;
  });

  it("normalizes a foreign collision policy to reject at the runtime boundary", () => {
    const result = resolveLyraDashboardPlacement(
      [
        { id: "a", x: 0, y: 0, w: 1, h: 1 },
        { id: "b", x: 1, y: 0, w: 1, h: 1 },
      ],
      "a",
      { x: 1, y: 0, w: 1, h: 1 },
      6,
      "foreign" as never
    );

    expect(result.accepted).to.be.false;
    expect(result.collidedWith).to.deep.equal(["b"]);
  });

  it("uses indexed push placement for the maximum admitted dashboard", () => {
    const layout: LyraDashboardCell[] = Array.from(
      { length: 1_000 },
      (_, index) => ({
        id: `cell-${index}`,
        x: index === 0 ? 1 : 0,
        y: 0,
        w: 1,
        h: 1,
      })
    );
    const metrics: DashboardPlacementMetrics = {
      intervalQueries: 0,
      intervalInsertions: 0,
      collisionCandidates: 0,
    };

    const startedAt = performance.now();
    const result = resolveDashboardPlacement(
      layout,
      "cell-0",
      { x: 0, y: 0, w: 1, h: 1 },
      12,
      "push",
      metrics
    );
    const elapsedMs = performance.now() - startedAt;

    expect(result.accepted).to.be.true;
    expect(result.layout).to.have.length(1_000);
    expect(result.layout[0]).to.deep.include({ x: 0, y: 0 });
    expect(result.layout[999]).to.deep.include({ x: 0, y: 999 });
    expect(
      metrics.intervalQueries +
        metrics.intervalInsertions +
        metrics.collisionCandidates
    ).to.be.lessThan(10_000);
    expect(elapsedMs).to.be.lessThan(1_000);
  });
});
