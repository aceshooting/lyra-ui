import assert from "node:assert/strict";
import test from "node:test";

import { collectEventMaps, generateEventTypeSource } from "./generate-event-types.mjs";

/** Collapses `docComment()`'s `\n * ` line-continuations so an assertion doesn't depend on the
 *  greedy-width-wrap point. */
function flattenDocComments(source) {
  return source.replace(/\n \* /g, " ");
}

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

  // Doc comments are greedy-width-wrapped, so match against the flattened prose (`\n * ` line
  // continuations collapsed to a space) rather than assuming a wrap point.
  assert.match(
    flattenDocComments(source),
    /`lr-open` — dispatched by 2 components: `<lr-base>`, `<lr-child>`; detail `LyraBaseEventMap\['lr-open'\]`\./
  );
  assert.match(
    source,
    /export type LyraOpenEvent = LyraBaseEventMap\['lr-open'\];/
  );
  assert.doesNotMatch(source, /LyraChildEventMap\['lr-open'\]/);
});

test("a multi-owner event documents a union detail type", () => {
  const source = generateEventTypeSource({
    prefix: "lr",
    manifest,
    maps: [
      {
        name: "LyraBaseEventMap",
        specifier: "./components/base/base.class.js",
        events: ["lr-open"],
      },
      {
        name: "LyraChildEventMap",
        specifier: "./components/child/child.class.js",
        events: ["lr-open"],
      },
    ],
  });

  assert.match(
    flattenDocComments(source),
    /`lr-open` — dispatched by 2 components: `<lr-base>`, `<lr-child>`; detail union of 2, e\.g\. `LyraBaseEventMap\['lr-open'\]`\./
  );
  assert.match(
    source,
    /export type LyraOpenEvent =\n {2}\| LyraBaseEventMap\['lr-open'\]\n {2}\| LyraChildEventMap\['lr-open'\];/
  );
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
