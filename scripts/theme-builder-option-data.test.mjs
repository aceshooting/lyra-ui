import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = new URL('../.storybook/theme-builder/option-data.js', import.meta.url);

test('motion maps preserve discrete and ambient roles without overriding preferences', async () => {
  const { BUILDER_MOTION_PRESETS } = await import(source);
  assert.deepEqual(Object.keys(BUILDER_MOTION_PRESETS), ['quick', 'gentle']);
  for (const [id, values] of Object.entries({ quick: ['90ms', '140ms', '900ms', '700ms'], gentle: ['160ms', '240ms', '2000ms', '1200ms'] })) {
    const preset = BUILDER_MOTION_PRESETS[id];
    assert.deepEqual(['fast', 'normal', 'slow', 'icon'].map(role => preset[`--lr-theme-duration-${role}`]), values);
    assert.deepEqual(Object.keys(preset).sort(), ['duration-fast', 'duration-normal', 'duration-slow', 'duration-icon', 'easing-standard', 'easing-emphasized'].map(role => `--lr-theme-${role}`).sort());
    assert.ok(Object.isFrozen(preset));
  }
  assert.ok(Object.isFrozen(BUILDER_MOTION_PRESETS));
});

test('font pairs retain every script catalog fallback and never alter script layout', async () => {
  const { BUILDER_FONT_PAIRS, composeBuilderFontTokens } = await import(source);
  const { presets } = JSON.parse(readFileSync(new URL('../packages/lyra-ui/tokens/options/typography.json', import.meta.url)));
  for (const pair of Object.keys(BUILDER_FONT_PAIRS)) {
    for (const [script, preset] of Object.entries(presets)) {
      const before = JSON.stringify(preset);
      const result = composeBuilderFontTokens(pair, preset);
      assert.deepEqual(Object.keys(result).sort(), ['body', 'heading', 'mono'].map(role => `--lr-theme-font-family-${role}`).sort());
      if (script !== 'system') {
        for (const role of ['body', 'heading']) {
          const firstFamily = preset[`--lr-theme-font-family-${role}`].split(',')[0];
          assert.ok(result[`--lr-theme-font-family-${role}`].startsWith(firstFamily), `${pair}/${script}/${role} retains script priority`);
        }
      }
      assert.equal(JSON.stringify(preset), before);
      assert.ok(Object.isFrozen(result));
      assert.ok(result['--lr-theme-font-family-mono'].includes('monospace'));
      assert.ok(!result['--lr-theme-font-family-mono'].includes('Nastaliq'));
    }
    assert.ok(Object.isFrozen(BUILDER_FONT_PAIRS[pair]));
    for (const families of Object.values(BUILDER_FONT_PAIRS[pair])) assert.ok(Object.isFrozen(families));
  }
  assert.ok(Object.isFrozen(BUILDER_FONT_PAIRS));
  assert.throws(() => composeBuilderFontTokens('unknown', presets.system), /Unknown/);
  assert.throws(() => composeBuilderFontTokens('__proto__', presets.system), /Unknown/);
});

test('font composition quotes names, deduplicates, and preserves an explicit script mono stack', async () => {
  const { composeBuilderFontTokens } = await import(source);
  const result = composeBuilderFontTokens('serif-sans', {
    '--lr-theme-font-family-heading': "'Example, Display', Georgia, 'Second, Display', system-ui, sans-serif",
    '--lr-theme-font-family-body': "'Example Body', system-ui, sans-serif",
    '--lr-theme-font-family-mono': "'Example Mono', Menlo, monospace",
  });
  assert.ok(result['--lr-theme-font-family-heading'].startsWith("'Example, Display', Georgia"));
  assert.equal(result['--lr-theme-font-family-heading'].match(/Georgia/g)?.length, 1);
  assert.ok(result['--lr-theme-font-family-heading'].includes("'Second, Display'"));
  assert.ok(result['--lr-theme-font-family-mono'].startsWith("'Example Mono', Menlo"));
  assert.ok(composeBuilderFontTokens('serif-sans')['--lr-theme-font-family-heading'].endsWith('serif'));
});
