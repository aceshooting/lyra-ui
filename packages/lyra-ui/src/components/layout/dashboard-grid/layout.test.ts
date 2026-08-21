import { expect } from "@open-wc/testing";
import {
  resolveLyraDashboardPlacement,
  type LyraDashboardCell,
} from "./layout.js";
import * as publicLayout from "./layout.js";
import type { LyraWidgetNode } from "../../conversation/widget-renderer/resolve.js";
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
        { cellId: "a", x: 0, y: 0, w: 2, h: 2 },
        { cellId: "b", x: 1, y: 1, w: 2, h: 2 }
      )
    ).to.be.true;
  });

  it("is false for rectangles that only touch edges", () => {
    expect(
      overlapsDashboardCells(
        { cellId: "a", x: 0, y: 0, w: 2, h: 2 },
        { cellId: "b", x: 2, y: 0, w: 2, h: 2 }
      )
    ).to.be.false;
  });

  it("is false for rectangles with a gap between them", () => {
    expect(
      overlapsDashboardCells(
        { cellId: "a", x: 0, y: 0, w: 1, h: 1 },
        { cellId: "b", x: 5, y: 5, w: 1, h: 1 }
      )
    ).to.be.false;
  });
});

describe("findDashboardCollisions", () => {
  const layout: LyraDashboardCell[] = [
    { cellId: "a", x: 0, y: 0, w: 2, h: 2 },
    { cellId: "b", x: 4, y: 0, w: 2, h: 2 },
  ];

  it("excludes the candidate itself even when its id matches a layout entry", () => {
    expect(
      collisions(layout, { cellId: "a", x: 0, y: 0, w: 2, h: 2 })
    ).to.deep.equal([]);
  });

  it("lists every other cell the candidate rectangle overlapsDashboardCells", () => {
    expect(
      collisions(layout, { cellId: "new", x: 1, y: 0, w: 1, h: 1 })
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
      { cellId: "c", x: 0, y: 1, w: 1, h: 1 },
      { cellId: "a", x: 2, y: 0, w: 1, h: 1 },
      { cellId: "b", x: 0, y: 0, w: 1, h: 1 },
    ];
    expect(sortDashboardSpatial(layout).map((c) => c.cellId)).to.deep.equal([
      "b",
      "a",
      "c",
    ]);
  });

  it("does not mutate the input array", () => {
    const layout: LyraDashboardCell[] = [
      { cellId: "b", x: 1, y: 0, w: 1, h: 1 },
      { cellId: "a", x: 0, y: 0, w: 1, h: 1 },
    ];
    const original = [...layout];
    sortDashboardSpatial(layout);
    expect(layout).to.deep.equal(original);
  });
});

describe("resolveDashboardPlacement", () => {
  it("returns accepted=false unchanged for an unknown candidateId", () => {
    const layout: LyraDashboardCell[] = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
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
        { cellId: "a", x: 0, y: 0, w: 1, h: 1 },
        { cellId: "b", x: 3, y: 0, w: 1, h: 1 },
      ];
      const result = resolveDashboardPlacement(
        layout,
        "a",
        { x: 1, y: 0, w: 1, h: 1 },
        6,
        "reject"
      );
      expect(result.accepted).to.be.true;
      expect(result.layout.find((c) => c.cellId === "a")).to.deep.include({
        x: 1,
        y: 0,
      });
      expect(result.collidedCellIds).to.deep.equal([]);
    });

    it("rejects a colliding move and leaves the layout reference unchanged", () => {
      const layout: LyraDashboardCell[] = [
        { cellId: "a", x: 0, y: 0, w: 1, h: 1 },
        { cellId: "b", x: 1, y: 0, w: 1, h: 1 },
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
      expect(result.collidedCellIds).to.deep.equal(["b"]);
    });
  });

  describe("policy: overlap", () => {
    it("applies a colliding move anyway, still reporting the collision", () => {
      const layout: LyraDashboardCell[] = [
        { cellId: "a", x: 0, y: 0, w: 1, h: 1 },
        { cellId: "b", x: 1, y: 0, w: 1, h: 1 },
      ];
      const result = resolveDashboardPlacement(
        layout,
        "a",
        { x: 1, y: 0, w: 1, h: 1 },
        6,
        "overlap"
      );
      expect(result.accepted).to.be.true;
      expect(result.layout.find((c) => c.cellId === "a")).to.deep.include({
        x: 1,
        y: 0,
      });
      expect(result.collidedCellIds).to.deep.equal(["b"]);
    });
  });

  describe("policy: push", () => {
    it("pushes a single colliding cell straight down out of the candidate’s way", () => {
      const layout: LyraDashboardCell[] = [
        { cellId: "a", x: 0, y: 0, w: 1, h: 1 },
        { cellId: "b", x: 1, y: 0, w: 1, h: 1 },
      ];
      const result = resolveDashboardPlacement(
        layout,
        "a",
        { x: 1, y: 0, w: 1, h: 1 },
        6,
        "push"
      );
      expect(result.accepted).to.be.true;
      const a = result.layout.find((c) => c.cellId === "a")!;
      const b = result.layout.find((c) => c.cellId === "b")!;
      expect(a).to.deep.include({ x: 1, y: 0 });
      expect(b).to.deep.include({ x: 1, y: 1 });
      expect(overlapsDashboardCells(a, b)).to.be.false;
    });

    it("cascades a push through a chain of stacked cells", () => {
      const layout: LyraDashboardCell[] = [
        { cellId: "a", x: 0, y: 0, w: 1, h: 1 },
        { cellId: "b", x: 1, y: 0, w: 1, h: 1 },
        { cellId: "c", x: 1, y: 1, w: 1, h: 1 },
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
          if (x.cellId !== y.cellId)
            expect(overlapsDashboardCells(x, y), `${x.cellId} vs ${y.cellId}`).to.be
              .false;
        }
      }
    });

    it("never moves a locked cell, and settles an unlocked cell underneath it instead", () => {
      const layout: LyraDashboardCell[] = [
        { cellId: "a", x: 0, y: 0, w: 1, h: 1 },
        { cellId: "locked", x: 1, y: 1, w: 1, h: 1, locked: true },
        { cellId: "b", x: 1, y: 0, w: 1, h: 1 },
      ];
      const result = resolveDashboardPlacement(
        layout,
        "a",
        { x: 1, y: 0, w: 1, h: 1 },
        6,
        "push"
      );
      expect(result.accepted).to.be.true;
      const locked = result.layout.find((c) => c.cellId === "locked")!;
      const b = result.layout.find((c) => c.cellId === "b")!;
      expect(locked).to.deep.include({ x: 1, y: 1 });
      expect(overlapsDashboardCells(locked, b)).to.be.false;
    });

    it("rejects (does not push through) a direct collision with a locked cell", () => {
      const layout: LyraDashboardCell[] = [
        { cellId: "a", x: 0, y: 0, w: 1, h: 1 },
        { cellId: "locked", x: 1, y: 0, w: 1, h: 1, locked: true },
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
    const layout: LyraDashboardCell[] = [{ cellId: "a", x: 0, y: 0, w: 2, h: 1 }];
    const result = resolveDashboardPlacement(
      layout,
      "a",
      { x: 99, y: -4, w: 2, h: 1 },
      6,
      "reject"
    );
    expect(result.accepted).to.be.true;
    expect(result.layout.find((c) => c.cellId === "a")).to.deep.include({
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
      { cellId: "first", x: 1, y: 2, w: 2, h: 3, label: "First" },
      null,
      { cellId: "", x: 0, y: 0, w: 1, h: 1 },
      { cellId: "first", x: 9, y: 9, w: 1, h: 1 },
      { cellId: "last", x: Number.NaN, y: -4, w: 999, h: 0 },
      Object.create({ cellId: "inherited", x: 0, y: 0, w: 1, h: 1 }),
    ];

    const snapshot = snapshotDashboardLayout(input);

    expect(snapshot.map((cell) => cell.cellId)).to.deep.equal(["first", "last"]);
    expect(snapshot[0]).to.deep.include({ x: 1, y: 2, w: 2, h: 3 });
    expect(snapshot[1]).to.deep.include({ x: 0, y: 0, w: 48, h: 1 });
  });

  it("normalizes contradictory constraints against the live column bound", () => {
    const snapshot = snapshotDashboardLayout([
      {
        cellId: "bounded",
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
      cellId: `cell-${index}`,
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
    const hostileRecord = { cellId: "hostile", y: 0, w: 1, h: 1 };
    Object.defineProperty(hostileRecord, "x", {
      get: () => {
        throw new Error("hostile field");
      },
    });
    input[3] = hostileRecord as (typeof input)[number];

    const snapshot = snapshotDashboardLayout(input);

    expect(snapshot).to.have.length(998);
    expect(snapshot.some((cell) => cell.cellId === "hostile")).to.be.false;
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
    const source = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1 }];
    const result = resolveLyraDashboardPlacement(
      source,
      "a",
      { x: 2, y: 1, w: 1, h: 1 },
      6,
      "reject"
    );

    source[0]!.x = 5;
    source.push({ cellId: "later", x: 0, y: 0, w: 1, h: 1 });
    expect(result.layout).to.have.length(1);
    expect(result.layout[0]).to.deep.include({ cellId: "a", x: 2, y: 1 });
    expect(Object.isFrozen(result)).to.be.true;
    expect(Object.isFrozen(result.layout)).to.be.true;
    expect(Object.isFrozen(result.layout[0])).to.be.true;
    expect(Object.isFrozen(result.collidedCellIds)).to.be.true;
  });

  it("snapshots widget structure at admission while preserving opaque prop leaves", () => {
    const leaf = { value: 1 };
    const widget = {
      type: "row",
      children: [{ type: "stat", props: { data: leaf } }],
    };
    const source = [{ cellId: "a", x: 0, y: 0, w: 1, h: 1, widget }];

    const snapshot = snapshotDashboardLayout(source);
    widget.children[0]!.type = "mutated";
    widget.children.push({ type: "later", props: { data: leaf } });

    expect(snapshot[0]?.widget?.children).to.have.length(1);
    expect(snapshot[0]?.widget?.children?.[0]).to.deep.include({ type: "stat" });
    expect(Object.isFrozen(snapshot[0]?.widget)).to.be.true;
    expect(Object.isFrozen(snapshot[0]?.widget?.children)).to.be.true;
    const child = snapshot[0]?.widget?.children?.[0] as LyraWidgetNode;
    expect(Object.isFrozen(child.props)).to.be.true;
    expect(child.props?.["data"]).to.equal(leaf);
    expect(Object.isFrozen(leaf)).to.be.false;
  });

  it("omits malformed or hostile widget input without discarding its cell", () => {
    const hostile = {
      get type(): never {
        throw new Error("hostile widget");
      },
    };
    const snapshot = snapshotDashboardLayout([
      { cellId: "hostile", x: 0, y: 0, w: 1, h: 1, widget: hostile as never },
      {
        cellId: "malformed",
        x: 1,
        y: 0,
        w: 1,
        h: 1,
        widget: { type: "row", children: [null] } as never,
      },
    ]);

    expect(snapshot.map((cell) => cell.cellId)).to.deep.equal([
      "hostile",
      "malformed",
    ]);
    expect(snapshot.every((cell) => cell.widget === undefined)).to.be.true;
  });

  it("normalizes a foreign collision policy to reject at the runtime boundary", () => {
    const result = resolveLyraDashboardPlacement(
      [
        { cellId: "a", x: 0, y: 0, w: 1, h: 1 },
        { cellId: "b", x: 1, y: 0, w: 1, h: 1 },
      ],
      "a",
      { x: 1, y: 0, w: 1, h: 1 },
      6,
      "foreign" as never
    );

    expect(result.accepted).to.be.false;
    expect(result.collidedCellIds).to.deep.equal(["b"]);
  });

  it("uses indexed push placement for the maximum admitted dashboard", () => {
    const layout: LyraDashboardCell[] = Array.from(
      { length: 1_000 },
      (_, index) => ({
        cellId: `cell-${index}`,
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

describe('dashboard layout hostile and sparse boundaries', () => {
  it('returns a frozen empty snapshot for non-arrays and revoked array proxies', () => {
    const plain = snapshotDashboardLayout({ length: 1 });
    expect(plain).to.deep.equal([]);
    expect(Object.isFrozen(plain)).to.equal(true);

    const revoked = Proxy.revocable<unknown[]>([], {});
    revoked.revoke();
    const hostile = snapshotDashboardLayout(revoked.proxy);
    expect(hostile).to.deep.equal([]);
    expect(Object.isFrozen(hostile)).to.equal(true);
  });

  it('preserves an explicit null widget while normalizing non-numeric geometry', () => {
    const snapshot = snapshotDashboardLayout([
      { cellId: 'null-widget', x: '2', y: undefined, w: null, h: false, widget: null },
    ]);
    expect(snapshot).to.have.length(1);
    expect(snapshot[0]).to.deep.include({
      cellId: 'null-widget',
      x: 0,
      y: 0,
      w: 1,
      h: 1,
      widget: null,
    });
  });

  it('tolerates sparse spatial-index buckets outside an admitted projection', () => {
    const sparse = {
      columns: 2,
      byId: new Map(),
      orderById: new Map(),
      columnBuckets: [],
    } as unknown as ReturnType<typeof createDashboardSpatialIndex>;
    expect(
      findDashboardCollisions(sparse, { cellId: 'candidate', x: 0, y: 0, w: 2, h: 1 }),
    ).to.deep.equal([]);
  });

  it('keeps a disjoint locked interval fixed while pushing an overlapping peer', () => {
    const layout: LyraDashboardCell[] = [
      { cellId: 'candidate', x: 0, y: 5, w: 1, h: 1 },
      { cellId: 'overlap', x: 0, y: 0, w: 1, h: 1 },
      { cellId: 'fixed', x: 0, y: 10, w: 1, h: 1, locked: true },
    ];
    const result = resolveDashboardPlacement(
      layout,
      'candidate',
      { x: 0, y: 0, w: 1, h: 1 },
      2,
      'push',
    );
    expect(result.accepted).to.equal(true);
    expect(result.layout.find((cell) => cell.cellId === 'overlap')?.y).to.equal(1);
    expect(result.layout.find((cell) => cell.cellId === 'fixed')?.y).to.equal(10);
  });
});
