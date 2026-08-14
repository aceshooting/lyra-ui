import assert from "node:assert/strict";
import test from "node:test";

import { generateEventTypeSource } from "./generate-event-types.mjs";

const manifest = {
  schemaVersion: "1.0.0",
  modules: [
    {
      path: "src/components/base/base.class.ts",
      declarations: [
        {
          name: "LyraBase",
          customElement: true,
          tagName: "lr-base",
          events: [{ name: "lr-open" }],
        },
      ],
    },
    {
      path: "src/components/child/child.class.ts",
      declarations: [
        {
          name: "LyraChild",
          customElement: true,
          tagName: "lr-child",
          superclass: {
            name: "LyraBase",
            module: "/src/components/base/base.class.js",
          },
        },
      ],
    },
  ],
};

test("emitter documentation comes from every effective manifest contract", () => {
  const source = generateEventTypeSource({
    prefix: "lr",
    manifest,
    maps: [
      {
        name: "LyraBaseEventMap",
        specifier: "./components/base/base.class.js",
        events: ["lr-open"],
      },
    ],
  });

  assert.match(
    source,
    /`lr-open` — dispatched by 2 components: `<lr-base>`, `<lr-child>`\./
  );
  assert.match(
    source,
    /export type LyraOpenEvent = LyraBaseEventMap\['lr-open'\];/
  );
  assert.doesNotMatch(source, /LyraChildEventMap\['lr-open'\]/);
});

test("generation fails closed when an effective manifest event has no typed owner", () => {
  assert.throws(
    () => generateEventTypeSource({ prefix: "lr", manifest, maps: [] }),
    /no Lyra\*EventMap declares/
  );
});
