import assert from "node:assert/strict";
import test from "node:test";

import { collectEventMaps, generateEventTypeSource } from "./generate-event-types.mjs";

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

test("free-function event maps contribute aliases and normal global listener types", () => {
  const source = generateEventTypeSource({
    prefix: "lr",
    manifest: { schemaVersion: "1.0.0", modules: [] },
    maps: [
      {
        name: "AutoloaderEventMap",
        specifier: "./autoloader.js",
        events: ["lr-autoload-loaded", "lr-autoload-traversal-error"],
      },
    ],
  });

  assert.match(source, /import type \{ AutoloaderEventMap \} from '\.\/autoloader\.js';/);
  assert.match(
    source,
    /export type LyraAutoloadTraversalErrorEvent = AutoloaderEventMap\['lr-autoload-traversal-error'\];/,
  );
  assert.match(source, /'lr-autoload-loaded': LyraAutoloadLoadedEvent;/);
});

test("the production source census enrolls the free-function autoloader map", () => {
  const autoloader = collectEventMaps().find(({ name }) => name === "AutoloaderEventMap");
  assert.deepEqual(autoloader, {
    name: "AutoloaderEventMap",
    specifier: "./autoloader.js",
    events: [
      "lr-autoload-preload",
      "lr-autoload-loaded",
      "lr-autoload-error",
      "lr-autoload-traversal-error",
    ],
  });
});
