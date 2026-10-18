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

test("render reachability follows an invoked shared internal template", () => {
  const sources = new Map([
    ["src/components/x/example/example.class.ts", `
      import { renderChrome } from '../../../internal/chrome.js';
      export class Example { render() { return html\`\${renderChrome()}\`; } }
    `],
    ["src/internal/chrome.ts", `export function renderChrome() { return html\`<div part="shared-chrome"></div>\`; }`],
  ]);
  assert.match(renderSurfaceFor("src/components/x/example/example.class.ts", sources), /shared-chrome/);
});

test("render reachability follows a literal dynamic import inside an owned controller", () => {
  const sources = new Map([
    ["src/components/x/example/example.class.ts", `
      import { LazyController } from './lazy.js';
      export class Example {
        // @renderController LazyController
        controller = new LazyController(this);
      }
    `],
    ["src/components/x/example/lazy.ts", `
      export class LazyController {
        constructor(host: HTMLElement) { void import('./paint.js'); }
      }
    `],
    ["src/components/x/example/paint.ts", `export function paint() { el.setAttribute('part', 'lazy-owned'); }`],
    ["src/components/x/example/unrelated.ts", `export function paint() { el.setAttribute('part', 'phantom-lazy'); }`],
  ]);
  const surface = renderSurfaceFor("src/components/x/example/example.class.ts", sources);
  assert.match(surface, /lazy-owned/);
  assert.doesNotMatch(surface, /phantom-lazy/);
});

test("render reachability excludes a component's unrelated lazy child import", () => {
  const sources = new Map([
    ["src/components/x/example/example.class.ts", `
      export class Example {
        render() { return html\`<div part="owned"></div>\`; }
        loadChild() { return import('./child.js'); }
      }
    `],
    ["src/components/x/example/child.ts", `
      export class Child { render() { return html\`<div part="child-only"></div>\`; } }
    `],
  ]);
  const surface = renderSurfaceFor("src/components/x/example/example.class.ts", sources);
  assert.match(surface, /part="owned"/);
  assert.doesNotMatch(surface, /child-only/);
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

test("render reachability follows an annotated controller constructed for this host", () => {
  const sources = new Map([
    ["src/example.ts", `
      import { SurfaceController as PaintController } from './controller.js';
      export class Example {
        // @renderController PaintController
        private controller = new PaintController(this);
      }
    `],
    ["src/controller.ts", `
      export class SurfaceController {
        constructor(private host: HTMLElement) {}
        paint() { const overlay = document.createElement('div'); overlay.setAttribute('part', 'controller-owned'); this.host.append(overlay); }
      }
    `],
  ]);
  assert.match(renderSurfaceFor("src/example.ts", sources), /controller-owned/);
});

for (const [name, component] of [
  ["unannotated constructor", `import { Controller } from './controller.js'; class Example { c = new Controller(this); }`],
  ["unused annotation", `import { Controller } from './controller.js'; // @renderController Controller\nclass Example {}`],
  ["unmatched import alias", `import { Controller as Alias } from './controller.js'; // @renderController Controller\nclass Example { c = new Alias(this); }`],
  ["another host", `import { Controller } from './controller.js'; // @renderController Controller\nclass Example { c = new Controller(otherHost); }`],
  ["type-only import", `import type { Controller } from './controller.js'; // @renderController Controller\nclass Example { c = new Controller(this); }`],
  ["type-only specifier", `import { type Controller } from './controller.js'; // @renderController Controller\nclass Example { c = new Controller(this); }`],
  ["annotation inside a string", `import { Controller } from './controller.js'; class Example { note = '@renderController Controller'; c = new Controller(this); }`],
  ["annotation inside a template", `import { Controller } from './controller.js'; class Example { note = \`@renderController Controller\`; c = new Controller(this); }`],
  ["constructor inside a string", `import { Controller } from './controller.js'; // @renderController Controller\nclass Example { note = 'new Controller(this)'; }`],
  ["stylesheet controller", `import { Controller } from './controller.styles.js'; // @renderController Controller\nclass Example { c = new Controller(this); }`],
]) {
  test(`render reachability excludes ${name}`, () => {
    const sources = new Map([
      ["src/example.ts", component],
      ["src/controller.ts", `export class Controller { paint() { return html\`<div part="phantom-controller"></div>\`; } }`],
      ["src/controller.styles.ts", `export class Controller { paint() { return html\`<div part="phantom-controller"></div>\`; } }`],
    ]);
    assert.doesNotMatch(renderSurfaceFor("src/example.ts", sources), /phantom-controller/);
  });
}

test("render reachability follows an invoked exported view with a markup body", () => {
  const sources = new Map([
    ["src/example.ts", `import { hierarchySourceView } from './view.js'; class Example { render() { return hierarchySourceView(); } }`],
    ["src/view.ts", `export function hierarchySourceView() { return html\`<div part="view-owned"></div>\`; }`],
  ]);
  assert.match(renderSurfaceFor("src/example.ts", sources), /view-owned/);
});

for (const [name, component, helper] of [
  ["uninvoked view", `import { hierarchySourceView } from './view.js'; class Example {}`, `export function hierarchySourceView() { return html\`<div part="phantom-view"></div>\`; }`],
  ["type-only view", `import type { hierarchySourceView } from './view.js'; class Example { render() { return hierarchySourceView(); } }`, `export function hierarchySourceView() { return html\`<div part="phantom-view"></div>\`; }`],
  ["comment-only call", `import { hierarchySourceView } from './view.js'; /* hierarchySourceView() */ class Example {}`, `export function hierarchySourceView() { return html\`<div part="phantom-view"></div>\`; }`],
  ["string-only markup", `import { hierarchySourceView } from './view.js'; hierarchySourceView();`, `export function hierarchySourceView() { return 'html\`<div part="phantom-view"></div>\`'; }`],
  ["stylesheet-only body", `import { hierarchySourceView } from './view.js'; hierarchySourceView();`, `export function hierarchySourceView() { return css\`[part="phantom-view"] {}\`; }`],
  ["unrelated exported template", `import { dataView } from './view.js'; dataView();`, `export function dataView() { return []; } export function otherView() { return html\`<div part="phantom-view"></div>\`; }`],
]) {
  test(`render reachability excludes ${name}`, () => {
    const sources = new Map([["src/example.ts", component], ["src/view.ts", helper]]);
    assert.doesNotMatch(renderSurfaceFor("src/example.ts", sources), /phantom-view/);
  });
}

const lazyFactoryComponent = `
  import type { Spatial as SpatialType } from './spatial.js';
  // @renderController SpatialType
  class Example {
    load() { return import('./spatial.js'); }
    ensure() { return this.load().then(({ Spatial: Loaded }) => this.create(Loaded)); }
    create(Ctor: typeof SpatialType) { return new Ctor(this); }
  }
`;
const lazyFactorySources = component => new Map([
  ["src/example.ts", component],
  ["src/spatial.ts", `export class Spatial { render() { return html\`<div part="lazy-factory-owned"></div>\`; } }`],
  ["src/other.ts", `export class Other { render() { return html\`<div part="unrelated-lazy"></div>\`; } }`],
]);

test("render reachability follows an annotated literal lazy controller through a typed host factory", () => {
  const surface = renderSurfaceFor("src/example.ts", lazyFactorySources(lazyFactoryComponent));
  assert.match(surface, /lazy-factory-owned/);
  assert.doesNotMatch(surface, /unrelated-lazy/);
});

for (const [name, component] of [
  ["missing annotation", lazyFactoryComponent.replace('// @renderController SpatialType', '')],
  ["string annotation", lazyFactoryComponent.replace('// @renderController SpatialType', `const note = '@renderController SpatialType';`)],
  ["string import", lazyFactoryComponent.replace(`return import('./spatial.js')`, `return "import('./spatial.js')"`)],
  ["wrong lazy module", lazyFactoryComponent.replace(`return import('./spatial.js')`, `return import('./other.js')`)],
  ["wrong factory type", lazyFactoryComponent.replace('Ctor: typeof SpatialType', 'Ctor: typeof Other')],
  ["wrong export", lazyFactoryComponent.replace('Spatial: Loaded', 'Other: Loaded')],
  ["wrong constructor", lazyFactoryComponent.replace('new Ctor(this)', 'new Other(this)')],
  ["another host", lazyFactoryComponent.replace('new Ctor(this)', 'new Ctor(otherHost)')],
  ["unused factory", lazyFactoryComponent.replace('this.create(Loaded)', 'Loaded')],
  ["wrong factory argument", lazyFactoryComponent.replace('this.create(Loaded)', 'this.create(Other)')],
  ["factory from another class", lazyFactoryComponent.replace('create(Ctor: typeof SpatialType)', '} class Other { create(Ctor: typeof SpatialType)')],
]) {
  test(`render reachability excludes lazy ${name}`, () => {
    assert.doesNotMatch(renderSurfaceFor("src/example.ts", lazyFactorySources(component)), /lazy-factory-owned/);
  });
}

for (const [name, component] of [
  ["callback without lexical this", lazyFactoryComponent.replace('({ Spatial: Loaded }) => this.create(Loaded)', 'function ({ Spatial: Loaded }) { return this.create(Loaded); }')],
  ["nested unbound factory construction", lazyFactoryComponent.replace('return new Ctor(this)', 'return function () { return new Ctor(this); }')],
  ["shadowed callback binding", lazyFactoryComponent.replace('this.create(Loaded)', '(() => { const Loaded = Other; return this.create(Loaded); })()')],
  ["shadowed factory parameter", lazyFactoryComponent.replace('return new Ctor(this)', '{ const Ctor = Other; return new Ctor(this); }')],
]) {
  test(`render reachability rejects lazy ${name}`, () => {
    assert.doesNotMatch(renderSurfaceFor("src/example.ts", lazyFactorySources(component)), /lazy-factory-owned/);
  });
}

test("render reachability rejects a shadowed imported view call", () => {
  const sources = new Map([
    ["src/example.ts", `import { dataView } from './view.js'; class Example { render(dataView) { return dataView(); } }`],
    ["src/view.ts", `export function dataView() { return html\`<div part="phantom-view"></div>\`; }`],
  ]);
  assert.doesNotMatch(renderSurfaceFor("src/example.ts", sources), /phantom-view/);
});

for (const [name, component] of [
  ["reassigned factory parameter", lazyFactoryComponent.replace('return new Ctor(this)', 'Ctor = Other; return new Ctor(this)')],
  ["reassigned callback binding", lazyFactoryComponent.replace('({ Spatial: Loaded }) => this.create(Loaded)', '({ Spatial: Loaded }) => { Loaded = Other; return this.create(Loaded); }')],
]) {
  test(`render reachability rejects lazy ${name}`, () => {
    assert.doesNotMatch(renderSurfaceFor("src/example.ts", lazyFactorySources(component)), /lazy-factory-owned/);
  });
}

test("render reachability rejects a helper whose only markup is in an uninvoked nested function", () => {
  const sources = new Map([
    ["src/example.ts", `import { dataView } from './view.js'; dataView();`],
    ["src/view.ts", `export function dataView() { function unused() { return html\`<div part="phantom-nested"></div>\`; } return []; }`],
  ]);
  assert.doesNotMatch(renderSurfaceFor("src/example.ts", sources), /phantom-nested/);
});

for (const [name, body] of [
  ["module block", `{ const dataView = () => []; dataView(); }`],
  ["destructured block", `{ const { dataView } = other; dataView(); }`],
  ["catch parameter", `try {} catch (dataView) { dataView(); }`],
  ["for initializer", `for (let dataView = other; condition; ) dataView();`],
  ["for-of binding", `for (const dataView of others) dataView();`],
  ["switch binding", `switch (value) { case 0: const dataView = other; dataView(); }`],
]) {
  test(`render reachability rejects imported view shadowing in a ${name}`, () => {
    const sources = new Map([
      ["src/example.ts", `import { dataView } from './view.js'; ${body}`],
      ["src/view.ts", `export function dataView() { return html\`<div part="phantom-scoped"></div>\`; }`],
    ]);
    assert.doesNotMatch(renderSurfaceFor("src/example.ts", sources), /phantom-scoped/);
  });
}

test("render reachability keeps an imported call outside a shadowing block", () => {
  const sources = new Map([
    ["src/example.ts", `import { dataView } from './view.js'; { const dataView = other; dataView(); } dataView();`],
    ["src/view.ts", `export function dataView() { return html\`<div part="scoped-owned"></div>\`; }`],
  ]);
  assert.match(renderSurfaceFor("src/example.ts", sources), /scoped-owned/);
});
