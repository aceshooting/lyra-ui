import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertNormalizedMixinCount,
  normalizeMixinDeclarationText,
} from './normalize-mixin-declarations.mjs';

test('rewrites compiler-expanded anchor-target constructors without weakening the base type', () => {
  const source = `declare class MarkdownBase {}\n` +
    `declare const Markdown_base: typeof MarkdownBase & (new (...args: any[]) => ` +
    `import("../../../internal/anchor-target.js").LyraAnchorTarget & {\n` +
    `    renderAnchorLiveRegion(): unknown;\n` +
    `});\n`;

  const result = normalizeMixinDeclarationText(source);

  assert.equal(result.replacements, 1);
  assert.doesNotMatch(result.text, /any\[\]/u);
  assert.match(result.text, /Omit<typeof MarkdownBase, 'prototype'>/u);
  assert.match(result.text, /ConstructorParameters<typeof MarkdownBase>/u);
  assert.match(result.text, /InstanceType<typeof MarkdownBase> & import/u);
});

test('rewrites the public-barrel specifier emitted by the current TypeScript build', () => {
  const source = `declare const SvgViewer_base: typeof SvgViewerBase & (new (...args: any[]) => ` +
    `import("../../../lyra.js").LyraAnchorTarget & { ` +
    `renderAnchorLiveRegion(): unknown; });\n`;

  const result = normalizeMixinDeclarationText(source);

  assert.equal(result.replacements, 1);
  assert.doesNotMatch(result.text, /any\[\]/u);
  assert.match(result.text, /ConstructorParameters<typeof SvgViewerBase>/u);
});

test('rewrites text-viewer targets and leaves unrelated mixin declarations alone', () => {
  const source = `declare const Html_base: typeof HtmlBase & (new (...args: any[]) => ` +
    `import("../../../internal/text-viewer-target.js").LyraTextViewerTarget & { ` +
    `renderAnchorLiveRegion(): unknown; });\n` +
    `declare const Input_base: typeof InputBase & (new (...args: any[]) => FormAssociated);\n`;

  const result = normalizeMixinDeclarationText(source);

  assert.equal(result.replacements, 1);
  assert.match(result.text, /Input_base: typeof InputBase & \(new \(\.\.\.args: any\[\]\)/u);
  assert.doesNotMatch(result.text, /any\[\].*text-viewer-target/u);
});

test('fails closed when a target constructor shape changes without being normalized', () => {
  assert.throws(
    () => normalizeMixinDeclarationText(
      `declare const Broken: typeof Base & (new (...args: any[]) => ` +
      `import("../internal/anchor-target.js").LyraAnchorTarget & { changed(): unknown; });\n`,
    ),
    /still exposes any\[\]/u,
  );
});

test('fails closed when the real build does not normalize its complete declaration set', () => {
  assert.doesNotThrow(() =>
    assertNormalizedMixinCount({ filesChanged: 20, replacements: 20 }, 20),
  );
  assert.throws(
    () => assertNormalizedMixinCount({ filesChanged: 0, replacements: 0 }, 20),
    /expected 20.*normalized 0/u,
  );
});
