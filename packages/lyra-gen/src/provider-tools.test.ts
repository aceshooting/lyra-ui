import assert from 'node:assert/strict';
import test from 'node:test';
import { dataCatalog, liveDashboardCatalog } from './catalog.js';
import { buildCatalogPrompt, exportCatalogJsonSchema } from './prompts.js';
import { createAiSdkTool, createAnthropicTool, createOpenAiTool, estimatePromptTokens } from './provider-tools.js';

test('estimatePromptTokens uses the dashboard benchmark heuristic', () => {
  assert.equal(estimatePromptTokens(''), 0);
  assert.equal(estimatePromptTokens('Hello world'), 4);
  assert.equal(estimatePromptTokens('{"type":"gauge","value":12345}'), 18);
  assert.equal(estimatePromptTokens('camelCaseWord  \n x'), 6);
  assert.equal(estimatePromptTokens('héllo \u{1F600}'), 4);
  const prompt = buildCatalogPrompt(dataCatalog);
  assert.ok(estimatePromptTokens(prompt) > prompt.length / 8 && estimatePromptTokens(prompt) < prompt.length);
});

test('provider tool definitions wrap the catalog prompt and JSON Schema', () => {
  const anthropic = createAnthropicTool(dataCatalog);
  assert.deepEqual(Object.keys(anthropic).sort(), ['description', 'input_schema', 'name']);
  assert.equal(anthropic.name, 'render_view');
  assert.equal(anthropic.description, buildCatalogPrompt(dataCatalog));
  assert.deepEqual(anthropic.input_schema, exportCatalogJsonSchema(dataCatalog));
  assert.equal(anthropic.input_schema['type'], 'object');

  const openai = createOpenAiTool(liveDashboardCatalog, { name: 'show_dashboard', prompt: { profile: 'signature' }, schema: { inline: true } });
  assert.equal(openai.type, 'function');
  assert.equal(openai.function.name, 'show_dashboard');
  assert.equal(openai.function.description, buildCatalogPrompt(liveDashboardCatalog, { profile: 'signature' }));
  assert.deepEqual(openai.function.parameters, exportCatalogJsonSchema(liveDashboardCatalog, { inline: true }));
  assert.equal(Object.hasOwn(openai.function, 'strict'), false);
  assert.equal(createOpenAiTool(dataCatalog, { strict: false }).function.strict, false);

  const sdk = createAiSdkTool(dataCatalog, { description: 'Render a data answer.' });
  assert.deepEqual(Object.keys(sdk).sort(), ['description', 'inputSchema']);
  assert.equal(sdk.description, 'Render a data answer.');
  assert.deepEqual(sdk.inputSchema, exportCatalogJsonSchema(dataCatalog));
  assert.notEqual(sdk.inputSchema, createAiSdkTool(dataCatalog).inputSchema);
});

test('provider tool names follow the portable function-name rule', () => {
  for (const name of ['', 'has space', 'x'.repeat(65), 'dot.name']) {
    assert.throws(() => createAnthropicTool(dataCatalog, { name }), RangeError, name);
    assert.throws(() => createOpenAiTool(dataCatalog, { name }), RangeError, name);
  }
  assert.equal(createAnthropicTool(dataCatalog, { name: 'a-b_9' }).name, 'a-b_9');
  assert.throws(() => createAnthropicTool(dataCatalog, { prompt: { maxCharacters: 10 } }), RangeError);
});
