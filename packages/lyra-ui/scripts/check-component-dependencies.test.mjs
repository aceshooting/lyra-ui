#!/usr/bin/env node
// Standalone test for scripts/check-component-dependencies.mjs -- plain `node:assert`, not wired
// into the wtr suite (this checker reads source text, it does not render components). Run
// directly: `node scripts/check-component-dependencies.test.mjs`.
//
// Every fixture below is a reduced copy of a real shape from src/components: the bug this checker
// exists to catch (`tool-result-view` renders `<lr-copy-button>` from a class module that imports
// only the side-effect-FREE `copy-button.class.js`, while its registration entry never imports
// `copy-button.js`), and -- just as importantly -- the correct shapes that must NOT be flagged
// (lazy `import()` registration as in `phone-input`, subclass inheritance as in `dropdown-item`,
// tags named only in comments or in plain string literals, and suppressed cycle-bound pairs).

import assert from 'node:assert/strict';
import {
  findMissingDependencies,
  htmlTemplateChunks,
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

test('a side-effect-free .class.js import in the entry does NOT satisfy the dependency', () => {
  const findings = findMissingDependencies(
    toolResultViewFixture({ entryImports: "import '../../utility/copy-button/copy-button.class.js';" }),
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

if (failures > 0) {
  console.error(`check-component-dependencies self-test: ${passes} passed, ${failures} failed`);
  process.exitCode = 1;
} else {
  console.log(`check-component-dependencies self-test passed: ${passes} case(s).`);
}
