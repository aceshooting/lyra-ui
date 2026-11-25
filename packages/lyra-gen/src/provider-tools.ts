import { buildCatalogPrompt, exportCatalogJsonSchema } from './prompts.js';
import type { LyraGenJsonSchemaOptions, LyraGenPromptOptions } from './prompts.js';
import type { JsonObject, LyraGenCatalog } from './types.js';

export interface LyraGenProviderToolOptions {
  /** Tool or function name; 1-64 ASCII letters, digits, `_` or `-`. Default `render_view`. */
  readonly name?: string;
  /** Replaces the catalog prompt as the tool description, for hosts that send the prompt elsewhere. */
  readonly description?: string;
  /** Options for the default description built by `buildCatalogPrompt()`. */
  readonly prompt?: LyraGenPromptOptions;
  /** Options for the input schema built by `exportCatalogJsonSchema()`. */
  readonly schema?: LyraGenJsonSchemaOptions;
}

export interface LyraGenOpenAiToolOptions extends LyraGenProviderToolOptions {
  /**
   * Passed through as `function.strict` when set. Strict mode needs every property required and
   * accepts fewer keywords than the catalog schema uses, so leave it unset unless you have checked
   * the schema against your provider.
   */
  readonly strict?: boolean;
}

/** Anthropic Messages API tool definition. */
export interface LyraGenAnthropicTool { readonly name: string; readonly description: string; readonly input_schema: JsonObject }
/** OpenAI Chat Completions function tool. */
export interface LyraGenOpenAiTool {
  readonly type: 'function';
  readonly function: { readonly name: string; readonly description: string; readonly parameters: JsonObject; readonly strict?: boolean };
}
/** A plain `{ description, inputSchema }` tool; wrap `inputSchema` with the AI SDK's `jsonSchema()` helper. */
export interface LyraGenAiSdkTool { readonly description: string; readonly inputSchema: JsonObject }

const TOOL_NAME = /^[A-Za-z0-9_-]{1,64}$/;

function parts(catalog: LyraGenCatalog, options: LyraGenProviderToolOptions): { name: string; description: string; schema: JsonObject } {
  const name = options.name ?? 'render_view';
  if (!TOOL_NAME.test(name)) throw new RangeError('Tool names use 1 to 64 ASCII letters, digits, underscores or hyphens.');
  const description = options.description ?? buildCatalogPrompt(catalog, options.prompt);
  return { name, description, schema: exportCatalogJsonSchema(catalog, options.schema) };
}

/** The catalog prompt and view schema as an Anthropic tool; the tool input is the generated view. */
export function createAnthropicTool(catalog: LyraGenCatalog, options: LyraGenProviderToolOptions = {}): LyraGenAnthropicTool {
  const { name, description, schema } = parts(catalog, options);
  return { name, description, input_schema: schema };
}

/** The catalog prompt and view schema as an OpenAI function tool; the arguments are the generated view. */
export function createOpenAiTool(catalog: LyraGenCatalog, options: LyraGenOpenAiToolOptions = {}): LyraGenOpenAiTool {
  const { name, description, schema } = parts(catalog, options);
  return { type: 'function', function: { name, description, parameters: schema, ...(options.strict === undefined ? {} : { strict: options.strict }) } };
}

/** The catalog prompt and view schema as a dependency-free AI SDK-style tool object. */
export function createAiSdkTool(catalog: LyraGenCatalog, options: Omit<LyraGenProviderToolOptions, 'name'> = {}): LyraGenAiSdkTool {
  const { description, schema } = parts(catalog, options);
  return { description, inputSchema: schema };
}

const TOKEN_PIECE = /( ?[A-Za-z]+)|( ?[0-9]+)|(\s+)|([^\s])/gu;

/**
 * Approximate token count for comparing prompt variants; not a provider tokenizer. Letter runs cost
 * one piece per four letters and per camelCase segment, digit runs one per three digits, every
 * punctuation or non-ASCII code point one, and a whitespace run one unless it is a single space.
 */
export function estimatePromptTokens(text: string): number {
  let total = 0;
  for (const [, letters, digits, space] of text.matchAll(TOKEN_PIECE)) {
    if (letters !== undefined) for (const part of letters.trimStart().split(/(?<=[a-z])(?=[A-Z])/u)) total += Math.ceil(part.length / 4);
    else if (digits !== undefined) total += Math.ceil(digits.trimStart().length / 3);
    else if (space !== undefined) total += space.length === 1 && space !== '\n' ? 0 : 1;
    else total += 1;
  }
  return total;
}
