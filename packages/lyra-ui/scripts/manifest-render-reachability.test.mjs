import assert from "node:assert/strict";
import test from "node:test";

import { renderSurfaceFor } from "./manifest-render-reachability.mjs";

test("render reachability excludes stylesheets and unrelated sibling classes", () => {
  const sources = new Map([
    [
      "src/components/x/example/example.class.ts",
      `
        import { styles } from './example.styles.js';
        import { LyraChild } from './child.class.js';
        export class Example {
          static styles = styles;
          render() { return html\`<div part="owned"></div><lr-child></lr-child>\`; }
        }
      `,
    ],
    [
      "src/components/x/example/example.styles.ts",
      `export const styles = css\`[part~="phantom-style"] { color: red; }\`;`,
    ],
    [
      "src/components/x/example/child.class.ts",
      `export class LyraChild { render() { return html\`<div part="phantom-child"></div>\`; } }`,
    ],
  ]);

  const surface = renderSurfaceFor(
    "src/components/x/example/example.class.ts",
    sources
  );
  assert.match(surface, /part="owned"/);
  assert.doesNotMatch(surface, /phantom-style/);
  assert.doesNotMatch(surface, /phantom-child/);
});

test("render reachability follows an invoked render helper and a same-directory superclass", () => {
  const sources = new Map([
    [
      "src/components/x/example/example.class.ts",
      `
        import { BaseExample } from './base.js';
        import { renderShared } from './render-shared.js';
        export class Example extends BaseExample {
          render() { return html\`<section>\${renderShared()}</section>\`; }
        }
      `,
    ],
    [
      "src/components/x/example/base.ts",
      `export class BaseExample { renderBase() { return html\`<div part="base-owned"></div>\`; } }`,
    ],
    [
      "src/components/x/example/render-shared.ts",
      `export function renderShared() { return html\`<div part="helper-owned"></div>\`; }`,
    ],
  ]);

  const surface = renderSurfaceFor(
    "src/components/x/example/example.class.ts",
    sources
  );
  assert.match(surface, /base-owned/);
  assert.match(surface, /helper-owned/);
});

test("render reachability terminates same-directory helper cycles", () => {
  const sources = new Map([
    [
      "src/components/x/example/example.class.ts",
      `import { renderA } from './a.js'; export class Example { render() { return renderA(); } }`,
    ],
    [
      "src/components/x/example/a.ts",
      `import { renderB } from './b.js'; export function renderA() { return renderB(); }`,
    ],
    [
      "src/components/x/example/b.ts",
      `import { renderA } from './a.js'; export function renderB() { return renderA(); }`,
    ],
  ]);
  assert.match(
    renderSurfaceFor("src/components/x/example/example.class.ts", sources),
    /renderB/
  );
});
