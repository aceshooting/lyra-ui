#!/usr/bin/env node
// Standalone test for scripts/check-component-dependencies.mjs -- plain `node:assert`, not wired
// into the wtr suite (this checker reads source text, it does not render components). Run
// directly: `node scripts/check-component-dependencies.test.mjs`.
// Every fixture below is a reduced copy of a real shape from src/components: the bug this checker
// exists to catch (`tool-result-view` renders `<lr-copy-button>` from a class module that imports
// only the side-effect-FREE `copy-button.class.js`, while its registration entry never imports
// `copy-button.js`), and -- just as importantly -- the correct shapes that must NOT be flagged
// (lazy `import()` registration as in `phone-input`, subclass inheritance as in `dropdown-item`,
// tags named only in comments or in plain string literals, and suppressed cycle-bound pairs).

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  analyzeComponentDependencies,
  collectSources,
  findMissingDependencies,
  htmlTemplateChunks,
  locallyRegisteredTags,
  renderedTags,
} from './check-component-dependencies.mjs';

// Quiet by default (it runs inside the `pnpm lint` contract-policy chain); `--verbose` prints the
// per-case lines.
const verbose = process.argv.includes('--verbose');
let failures = 0;
let passes = 0;
function test(name, fn) {
  try {
    fn();
    passes += 1;
    if (verbose) console.log(`ok - ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`not ok - ${name}`);
    console.error(err instanceof Error ? err.stack : err);
  }
}

const tagsOf = (source) => [...renderedTags(source)].sort();

test('collectSources keys files relative to the supplied package, not the checker installation', () => {
  const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-component-deps-'));
  try {
    const nested = path.join(packageRoot, 'src', 'components', 'x');
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, 'x.ts'), 'export const x = true;');
    const files = collectSources(path.join(packageRoot, 'src'), new Map());
    assert.deepEqual([...files.keys()], ['src/components/x/x.ts']);
  } finally {
    fs.rmSync(packageRoot, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Template scanning
// ---------------------------------------------------------------------------

test('collects tags from html templates, including nested ternary branches', () => {
  const source = `
    import { html, nothing } from 'lit';
    class Fixture {
      render() {
        return html\`
          <div part="base">
            \${this.loading
              ? html\`<lr-skeleton variant="rect"></lr-skeleton>\`
              : html\`<lr-json-viewer .data=\${this.result}></lr-json-viewer>\`}
            \${this.copyable ? html\`<lr-copy-button .value=\${this.text}></lr-copy-button>\` : nothing}
          </div>
        \`;
      }
    }
  `;
  assert.deepEqual(tagsOf(source), ['lr-copy-button', 'lr-json-viewer', 'lr-skeleton']);
});

test('ignores tags that appear only in comments', () => {
  const source = `
    /**
     * \`<lr-tool-result-view>\` falls back to \`<lr-json-viewer>\`.
     * @csspart fallback-copy - The \`<lr-copy-button>\` shown when \`copyable\` is set.
     */
    class Fixture {
      // renders <lr-badge> one day
      render() {
        return html\`<div part="base"></div>\`;
      }
    }
  `;
  assert.deepEqual(tagsOf(source), []);
});

test('ignores tags that appear only in plain string literals', () => {
  const source = `
    const selector = '<lr-badge>';
    const other = "<lr-avatar>";
    const message = \`plain template <lr-icon>\`;
    class Fixture {
      render() {
        return html\`<lr-badge-real></lr-badge-real>\`;
      }
    }
  `;
  assert.deepEqual(tagsOf(source), ['lr-badge-real']);
});

test('ignores a tag named inside an interpolation hole rather than markup', () => {
  const source = `
    class Fixture {
      render() {
        return html\`<div>\${this.kind === '<lr-badge>' ? this.a : this.b}</div>\`;
      }
    }
  `;
  assert.deepEqual(tagsOf(source), []);
});

test('resolves the static-html unsafeStatic(tag()) form used by menu-item and dropdown', () => {
  const source = `
    import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
    const menuTag = unsafeStatic(tag('menu'));
    class Fixture {
      render() {
        return staticHtml\`<\${menuTag} part="submenu"><slot></slot></\${menuTag}>\`;
      }
    }
  `;
  assert.deepEqual(tagsOf(source), ['lr-menu']);
});

test('htmlTemplateChunks keeps escaped characters from ending a template early', () => {
  const chunks = htmlTemplateChunks("const a = html`<lr-a title=\"x\\`y\"></lr-a>`; const b = '`';");
  assert.equal(chunks.length, 1);
  assert.match(chunks[0], /<lr-a/);
});

// ---------------------------------------------------------------------------
// Reachability analysis
// ---------------------------------------------------------------------------

const REGISTRATION = (name, extra = '') => `
export * from './${name}.class.js';
${extra}
import { Lyra } from './${name}.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('${name}', Lyra);
`;

/** The pre-fix tool-result-view shape: class imports the pure class module, entry never registers. */
function toolResultViewFixture({ entryImports = '', classImports = "import '../../utility/copy-button/copy-button.class.js';" } = {}) {
  return {
    components: [
      {
        tag: 'lr-tool-result-view',
        classModule: 'src/components/agent-tools/tool-result-view/tool-result-view.class.ts',
        registrationModule: 'src/components/agent-tools/tool-result-view/tool-result-view.ts',
      },
      {
        tag: 'lr-copy-button',
        classModule: 'src/components/utility/copy-button/copy-button.class.ts',
        registrationModule: 'src/components/utility/copy-button/copy-button.ts',
      },
    ],
    files: new Map([
      [
        'src/components/agent-tools/tool-result-view/tool-result-view.ts',
        REGISTRATION('tool-result-view', entryImports),
      ],
      [
        'src/components/agent-tools/tool-result-view/tool-result-view.class.ts',
        `${classImports}
         export class Lyra {
           render() {
             return html\`<lr-copy-button part="fallback-copy" .value=\${this.result}></lr-copy-button>\`;
           }
         }`,
      ],
      ['src/components/utility/copy-button/copy-button.ts', REGISTRATION('copy-button')],
      ['src/components/utility/copy-button/copy-button.class.ts', 'export class Lyra {}'],
    ]),
  };
}

test('flags a registration entry that never registers a tag its class renders', () => {
  const findings = findMissingDependencies(toolResultViewFixture());
  assert.equal(findings.length, 1);
  assert.match(findings[0], /\[component-dependency\]/);
  assert.match(findings[0], /lr-tool-result-view/);
  assert.match(findings[0], /<lr-copy-button>/);
  assert.match(findings[0], /copy-button\/copy-button\.js/);
});

test('passes once the registration entry imports the dependency registration', () => {
  const findings = findMissingDependencies(
    toolResultViewFixture({ entryImports: "import '../../utility/copy-button/copy-button.js';" }),
  );
  assert.deepEqual(findings, []);
});

test('emits deterministic direct and transitive component dependency metadata', () => {
  const fixture = toolResultViewFixture({ entryImports: "import '../../utility/copy-button/copy-button.js';" });
  fixture.components.push({
    tag: 'lr-tool-timeline',
    classModule: 'src/components/agent-tools/tool-timeline/tool-timeline.class.ts',
    registrationModule: 'src/components/agent-tools/tool-timeline/tool-timeline.ts',
  });
  fixture.files.set(
    'src/components/agent-tools/tool-timeline/tool-timeline.ts',
    REGISTRATION('tool-timeline', "import '../tool-result-view/tool-result-view.js';"),
  );
  fixture.files.set('src/components/agent-tools/tool-timeline/tool-timeline.class.ts', 'export class Lyra {}');

  const { findings, graph } = analyzeComponentDependencies(fixture);
  assert.deepEqual(findings, []);
  assert.deepEqual(graph.find((entry) => entry.tag === 'lr-tool-result-view')?.directComponents, ['lr-copy-button']);
  assert.deepEqual(graph.find((entry) => entry.tag === 'lr-tool-result-view')?.transitiveComponents, []);
  assert.deepEqual(graph.find((entry) => entry.tag === 'lr-tool-timeline')?.directComponents, ['lr-tool-result-view']);
  assert.deepEqual(graph.find((entry) => entry.tag === 'lr-tool-timeline')?.transitiveComponents, ['lr-copy-button']);
});

test('a side-effect-free .class.js import in the entry does NOT satisfy the dependency', () => {
  const findings = findMissingDependencies(
    toolResultViewFixture({ entryImports: "import '../../utility/copy-button/copy-button.class.js';" }),
  );
  assert.equal(findings.length, 1);
  assert.match(findings[0], /<lr-copy-button>/);
});

test('a type-only import of a registration entry does NOT register the dependency', () => {
  const findings = findMissingDependencies(
    toolResultViewFixture({
      entryImports: "import type { LyraCopyButton } from '../../utility/copy-button/copy-button.js';",
    }),
  );
  assert.equal(findings.length, 1);
  assert.match(findings[0], /<lr-copy-button>/);
});

test('a type-only re-export of a registration entry does NOT register the dependency', () => {
  const findings = findMissingDependencies(
    toolResultViewFixture({
      entryImports: "export type { LyraCopyButton } from '../../utility/copy-button/copy-button.js';",
    }),
  );
  assert.equal(findings.length, 1);
  assert.match(findings[0], /<lr-copy-button>/);
});

test('a transitive registration import satisfies the dependency', () => {
  const fixture = toolResultViewFixture();
  fixture.components.push({
    tag: 'lr-tool-timeline',
    classModule: 'src/components/agent-tools/tool-timeline/tool-timeline.class.ts',
    registrationModule: 'src/components/agent-tools/tool-timeline/tool-timeline.ts',
  });
  fixture.files.set(
    'src/components/agent-tools/tool-timeline/tool-timeline.ts',
    REGISTRATION('tool-timeline', "import '../tool-result-view/tool-result-view.js';"),
  );
  fixture.files.set('src/components/agent-tools/tool-timeline/tool-timeline.class.ts', 'export class Lyra {}');
  fixture.files.set(
    'src/components/agent-tools/tool-result-view/tool-result-view.ts',
    REGISTRATION('tool-result-view', "import '../../utility/copy-button/copy-button.js';"),
  );
  assert.deepEqual(findMissingDependencies(fixture), []);
});

test('lazy import() registration counts, as in phone-input -> lr-flag', () => {
  const fixture = toolResultViewFixture({
    classImports: "const registration = import('../../utility/copy-button/copy-button.js');",
  });
  assert.deepEqual(findMissingDependencies(fixture), []);
});

test('an import expression shown only in a string or template example does NOT register a dependency', () => {
  for (const example of [
    `const docs = "import('../../utility/copy-button/copy-button.js')";`,
    "const docs = `import('../../utility/copy-button/copy-button.js')`;",
  ]) {
    const fixture = toolResultViewFixture({ classImports: example });
    const findings = findMissingDependencies(fixture);
    assert.equal(findings.length, 1, example);
    assert.match(findings[0], /<lr-copy-button>/);
  }
});

test('an inherited render reaches the subclass entry, as in dropdown-item -> lr-menu', () => {
  const components = [
    {
      tag: 'lr-menu-item',
      classModule: 'src/components/layout/menu/menu-item.class.ts',
      registrationModule: 'src/components/layout/menu/menu-item.ts',
    },
    {
      tag: 'lr-dropdown-item',
      classModule: 'src/components/layout/menu/dropdown-item.class.ts',
      registrationModule: 'src/components/layout/menu/dropdown-item.ts',
    },
    {
      tag: 'lr-menu',
      classModule: 'src/components/layout/menu/menu.class.ts',
      registrationModule: 'src/components/layout/menu/menu.ts',
    },
  ];
  const files = new Map([
    [
      'src/components/layout/menu/menu-item.ts',
      "// policy-allow(component-dependency: lr-menu): cycle-bound, covered by menu.ts\n" + REGISTRATION('menu-item'),
    ],
    [
      'src/components/layout/menu/menu-item.class.ts',
      `import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
       const menuTag = unsafeStatic(tag('menu'));
       export class LyraMenuItem {
         render() { return staticHtml\`<\${menuTag} part="submenu"></\${menuTag}>\`; }
       }`,
    ],
    ['src/components/layout/menu/dropdown-item.ts', REGISTRATION('dropdown-item')],
    [
      'src/components/layout/menu/dropdown-item.class.ts',
      `import { LyraMenuItem } from './menu-item.class.js';
       export class LyraDropdownItem extends LyraMenuItem {}`,
    ],
    ['src/components/layout/menu/menu.ts', REGISTRATION('menu', "import './menu-item.js';")],
    ['src/components/layout/menu/menu.class.ts', 'export class Lyra {}'],
  ]);

  const findings = findMissingDependencies({ components, files });
  assert.equal(findings.length, 1, findings.join('\n'));
  assert.match(findings[0], /lr-dropdown-item/);
  assert.match(findings[0], /<lr-menu>/);

  files.set('src/components/layout/menu/dropdown-item.ts', REGISTRATION('dropdown-item', "import './menu.js';"));
  assert.deepEqual(findMissingDependencies({ components, files }), []);
});

test('markup in a shared helper module counts for the entry that pulls it in', () => {
  const fixture = toolResultViewFixture({ classImports: "import './tool-result-view-shared.js';" });
  fixture.files.set(
    'src/components/agent-tools/tool-result-view/tool-result-view.class.ts',
    "import './tool-result-view-shared.js';\nexport class Lyra { render() { return renderSkeleton(); } }",
  );
  fixture.files.set(
    'src/components/agent-tools/tool-result-view/tool-result-view-shared.ts',
    'export const renderSkeleton = () => html`<lr-copy-button></lr-copy-button>`;',
  );
  assert.equal(findMissingDependencies(fixture).length, 1);

  fixture.files.set(
    'src/components/agent-tools/tool-result-view/tool-result-view.ts',
    REGISTRATION('tool-result-view', "import '../../utility/copy-button/copy-button.js';"),
  );
  assert.deepEqual(findMissingDependencies(fixture), []);
});

test('an lr-* tag with no inventory entry is reported as unknown', () => {
  const fixture = toolResultViewFixture({ entryImports: "import '../../utility/copy-button/copy-button.js';" });
  fixture.files.set(
    'src/components/agent-tools/tool-result-view/tool-result-view.class.ts',
    'export class Lyra { render() { return html`<lr-not-a-component></lr-not-a-component>`; } }',
  );
  const findings = findMissingDependencies(fixture);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /unknown/);
  assert.match(findings[0], /<lr-not-a-component>/);
});

test('a suppression with a reason silences exactly its own tag', () => {
  const suppressed = toolResultViewFixture({});
  suppressed.files.set(
    'src/components/agent-tools/tool-result-view/tool-result-view.ts',
    '// policy-allow(component-dependency: lr-copy-button): registered by the composing entry\n' +
      REGISTRATION('tool-result-view'),
  );
  assert.deepEqual(findMissingDependencies(suppressed), []);

  const wrongTag = toolResultViewFixture({});
  wrongTag.files.set(
    'src/components/agent-tools/tool-result-view/tool-result-view.ts',
    '// policy-allow(component-dependency: lr-json-viewer): unrelated\n' + REGISTRATION('tool-result-view'),
  );
  const findings = findMissingDependencies(wrongTag);
  assert.equal(findings.length, 2, findings.join('\n'));
  assert.ok(findings.some((finding) => /<lr-copy-button>/.test(finding)), findings.join('\n'));
  assert.ok(findings.some((finding) => /unused suppression/.test(finding)), findings.join('\n'));
});

test('a suppression without a reason is itself a finding', () => {
  const fixture = toolResultViewFixture({});
  fixture.files.set(
    'src/components/agent-tools/tool-result-view/tool-result-view.ts',
    '// policy-allow(component-dependency: lr-copy-button):\n' + REGISTRATION('tool-result-view'),
  );
  const findings = findMissingDependencies(fixture);
  assert.equal(findings.length, 1, findings.join('\n'));
  assert.match(findings[0], /needs a reason/);
});

test('a suppression for a tag that is not missing is itself a finding', () => {
  const fixture = toolResultViewFixture({ entryImports: "import '../../utility/copy-button/copy-button.js';" });
  fixture.files.set(
    'src/components/agent-tools/tool-result-view/tool-result-view.ts',
    '// policy-allow(component-dependency: lr-copy-button): stale\n' +
      REGISTRATION('tool-result-view', "import '../../utility/copy-button/copy-button.js';"),
  );
  const findings = findMissingDependencies(fixture);
  assert.equal(findings.length, 1);
  assert.match(findings[0], /unused suppression/);
});

// ---------------------------------------------------------------------------
// Local `defineElement()` registrations (the widget-renderer shape)
// ---------------------------------------------------------------------------

/**
 * `widget-renderer.ts` reduced: an entry that imports eight side-effect-FREE `*.class.js` modules
 * and registers them itself, because its widget registry maps a document's declarative `type` onto
 * those elements at runtime rather than rendering them from a template. Reading only the inventory's
 * `registrationModule` map, the checker saw an entry that registers nothing but its own tag.
 */
const widgetRendererFixture = () => ({
  components: [
    {
      tag: 'lr-widget-renderer',
      classModule: 'src/components/conversation/widget-renderer/widget-renderer.class.ts',
      registrationModule: 'src/components/conversation/widget-renderer/widget-renderer.ts',
    },
    {
      tag: 'lr-card',
      classModule: 'src/components/layout/card/card.class.ts',
      registrationModule: 'src/components/layout/card/card.ts',
    },
    {
      tag: 'lr-stat',
      classModule: 'src/components/data/stat/stat.class.ts',
      registrationModule: 'src/components/data/stat/stat.ts',
    },
  ],
  files: new Map([
    [
      'src/components/conversation/widget-renderer/widget-renderer.ts',
      `export * from './widget-renderer.class.js';
       import { LyraWidgetRenderer } from './widget-renderer.class.js';
       import { LyraCard } from '../../layout/card/card.class.js';
       import { LyraStat } from '../../data/stat/stat.class.js';
       import { defineElement } from '../../../internal/prefix.js';
       defineElement('card', LyraCard);
       defineElement('stat', LyraStat);
       defineElement('widget-renderer', LyraWidgetRenderer);`,
    ],
    ['src/components/conversation/widget-renderer/widget-renderer.class.ts', 'export class Lyra {}'],
    ['src/components/layout/card/card.ts', REGISTRATION('card')],
    ['src/components/layout/card/card.class.ts', 'export class Lyra {}'],
    ['src/components/data/stat/stat.ts', REGISTRATION('stat')],
    ['src/components/data/stat/stat.class.ts', 'export class Lyra {}'],
  ]),
});

test('locallyRegisteredTags reads literal defineElement() calls and ignores computed names', () => {
  const source = `
    import { defineElement, defineElementForPackageVersion } from '../../../internal/prefix.js';
    defineElement('card', LyraCard);
    defineElement(\`stat\`, LyraStat);
    defineElementForPackageVersion('badge', LyraBadge, VERSION);
    defineElement(dynamicName, LyraUnknown);
    const documented = "defineElement('never-registered', X)";
  `;
  assert.deepEqual([...locallyRegisteredTags(source, 'entry.ts')].sort(), ['lr-badge', 'lr-card', 'lr-stat']);
});

test("an entry's own defineElement() calls register those components, as in widget-renderer", () => {
  const { findings, graph } = analyzeComponentDependencies(widgetRendererFixture());
  assert.deepEqual(findings, []);
  const entry = graph.find((component) => component.tag === 'lr-widget-renderer');
  assert.deepEqual(
    entry?.directComponents,
    ['lr-card', 'lr-stat'],
    'the components the entry defines itself are direct edges, not an empty dependency set',
  );
  assert.deepEqual(
    entry?.transitiveComponents,
    [],
    'importing a class module pulls in no further registrations, so nothing is transitive here',
  );
});

test('a locally registered component satisfies a tag the entry renders', () => {
  const fixture = widgetRendererFixture();
  fixture.files.set(
    'src/components/conversation/widget-renderer/widget-renderer.class.ts',
    'export class Lyra { render() { return html`<lr-card part="widget"></lr-card>`; } }',
  );
  assert.deepEqual(findMissingDependencies(fixture), []);
});

test('a locally registered component still owes ITS renders to the same entry', () => {
  const fixture = widgetRendererFixture();
  fixture.components.push({
    tag: 'lr-badge',
    classModule: 'src/components/overlays/badge/badge.class.ts',
    registrationModule: 'src/components/overlays/badge/badge.ts',
  });
  fixture.files.set('src/components/overlays/badge/badge.ts', REGISTRATION('badge'));
  fixture.files.set('src/components/overlays/badge/badge.class.ts', 'export class Lyra {}');
  fixture.files.set(
    'src/components/layout/card/card.class.ts',
    'export class Lyra { render() { return html`<lr-badge part="count"></lr-badge>`; } }',
  );
  const findings = findMissingDependencies(fixture);
  const inherited = findings.filter((finding) => finding.includes('widget-renderer.ts'));
  assert.equal(inherited.length, 1, 'seeing the registration also means owning what it renders');
  assert.match(inherited[0], /<lr-badge>/);
  assert.match(inherited[0], /through <lr-card>, which it registers/);
  // lr-card's own entry is separately at fault for the same render; both are real findings.
  assert.equal(findings.length, 2);
});

test('a defineElement() for a tag outside the inventory is ignored, not reported as unknown', () => {
  const fixture = widgetRendererFixture();
  fixture.files.set(
    'src/components/conversation/widget-renderer/widget-renderer.ts',
    `${fixture.files.get('src/components/conversation/widget-renderer/widget-renderer.ts')}
     defineElement('not-a-component', Something);`,
  );
  assert.deepEqual(findMissingDependencies(fixture), []);
});

// ---------------------------------------------------------------------------

if (failures > 0) {
  console.error(`check-component-dependencies self-test: ${passes} passed, ${failures} failed`);
  process.exitCode = 1;
} else {
  console.log(`check-component-dependencies self-test passed: ${passes} case(s).`);
}

