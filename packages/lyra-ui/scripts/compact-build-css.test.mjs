import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  compactBuildCss,
  compactCssModule,
  collapseCssWhitespaceChunks,
} from './compact-build-css.mjs';

const source =
  `import{css}from'lit';\n` +
  `const gap='4px';\n` +
  `const plain=css\`\n  .a { color: red; padding: 0px 0px 0px 0px; }\n\`;\n` +
  `const interpolated=css\`\n  .b { gap: \${gap}; content: "a   b"; }\n\`;\n` +
  `export{plain,interpolated};\n`;

const compacted = compactCssModule(source, 'entry.js');
const nestedSource = "import{css}from'lit';const fill=x=>x;export const s=css`.a { ${fill(css`var(--a, red)`)} }`;";
assert.equal(compactCssModule(nestedSource, 'nested.js').code,
  "import{css}from'lit';const fill=x=>x;export const s=/* @__PURE__ */(()=>css`.a{${fill(css`var(--a, red)`)}}`)();");
const unwrapped = (code) => code.replaceAll('/* @__PURE__ */(()=>', '').replaceAll(')();', ';');
assert.ok(unwrapped(compacted.code).length < source.length);
assert.ok(compacted.code.includes('${gap}'), 'interpolation source stays byte-identical');
assert.ok(compacted.code.includes('content:"a   b"'), 'CSS string whitespace stays significant');
assert.ok(!compacted.code.includes('0px 0px 0px 0px'));
assert.equal(compactCssModule(compacted.code, 'entry.js').code, compacted.code);

assert.deepEqual(
  collapseCssWhitespaceChunks([
    '\n  .a   .b {\n    width: calc(100% - ',
    ');\n    content: "a   b";\n  }\n',
  ]),
  [' .a .b{width:calc(100% - ', ');content:"a   b"}'],
);

// Combinators, arithmetic operators and the space beside an interpolation stay significant.
assert.deepEqual(
  collapseCssWhitespaceChunks([':host(:hover) .a > b + c ~ d, e :is( f ) { margin: calc(1px + 2px) var(--x, 0) !important; } ', ' ', ' x']),
  [':host(:hover) .a>b + c~d,e :is(f){margin:calc(1px + 2px) var(--x,0)!important}', ' ', ' x'],
);
assert.deepEqual(collapseCssWhitespaceChunks(['.sm\\: .x { }']), ['.sm\\: .x{}']);
assert.deepEqual(collapseCssWhitespaceChunks([':host { --on: ; --off: initial; --tail: }', '--x: ', ';']), [':host{--on: ;--off:initial;--tail: }', '--x: ', ';']);
// Custom property values keep their authored text, including across an interpolation.
assert.deepEqual(
  collapseCssWhitespaceChunks([':host { --a: color-mix(in srgb, red, blue); color: rgb(1, 2); --b: max(', ', 1px) ; }']),
  [':host{--a:color-mix(in srgb, red, blue);color:rgb(1,2);--b:max(', ', 1px) }'],
);
assert.deepEqual(collapseCssWhitespaceChunks(["[part='base'] [part~=\"a b\"] [x='1a'] [y='-z_9'] .c\\=']'{content:'x'}"]), ["[part=base] [part~=\"a b\"] [x='1a'] [y=-z_9] .c\\=']'{content:'x'}"]);

// Module-level fragments become droppable when unused; a component's own `styles` stays as written.
{
  const fragmentSource = "import{css,unsafeCSS}from'lit';const a=css`.a { color: red; }`;export const b=unsafeCSS('x');export const styles=css`.c { color: blue; }`;export{a};";
  const fragmentCode = compactCssModule(fragmentSource, 'fragments.js').code;
  assert.equal(fragmentCode,
    "import{css,unsafeCSS}from'lit';const a=/* @__PURE__ */(()=>css`.a{color:red}`)();export const b=/* @__PURE__ */(()=>unsafeCSS('x'))();export const styles=css`.c{color:#00f}`;export{a};");
  assert.equal(compactCssModule(fragmentCode, 'fragments.js').code.split('@__PURE__').length, 3, 'wrapping is not repeated');
}

// Frozen literal tables become droppable; a freeze of a reachable object or of a call result stays.
{
  const frozen = "const shared={};export const a=Object.freeze({x:1,y:[2,'z'],f:()=>0});export const b=Object.freeze(shared);export const c=Object.freeze([make()]);";
  assert.equal(compactCssModule(frozen, 'frozen.js').code,
    "const shared={};export const a=/* @__PURE__ */(()=>Object.freeze({x:1,y:[2,'z'],f:()=>0}))();export const b=Object.freeze(shared);export const c=Object.freeze([make()]);");
}

const fixture = await mkdtemp(path.join(tmpdir(), 'lyra-compact-css-'));
try {
  const styles = path.join(fixture, 'styles');
  await mkdir(styles);
  await writeFile(path.join(fixture, 'entry.js'), source);
  await writeFile(
    path.join(styles, 'theme.css'),
    '/* published CSS comment */\n.a { margin: 0px 0px 0px 0px; }\n',
  );
  const result = await compactBuildCss(fixture);
  assert.equal(result.modules, 1);
  assert.equal(result.stylesheets, 1);
  assert.ok(result.removedBytes > 0);
  assert.doesNotMatch(await readFile(path.join(styles, 'theme.css'), 'utf8'), /published CSS comment|0px 0px/);
} finally {
  await rm(fixture, { recursive: true, force: true });
}

console.log('published CSS compaction test passed.');
