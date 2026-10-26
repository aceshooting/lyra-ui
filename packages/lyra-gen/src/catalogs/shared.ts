import type { LyraGenSchema } from '../types.js';

export const string = (maxLength = 4096): LyraGenSchema => ({ type: 'string', maxLength });
export const label: LyraGenSchema = { type: 'string', minLength: 1, maxLength: 256 };
export const boolean: LyraGenSchema = { type: 'boolean' };
export const number: LyraGenSchema = { type: 'number', minimum: -1e12, maximum: 1e12 };
export const count = (maximum: number, minimum = 0): LyraGenSchema => ({ type: 'integer', minimum, maximum });
export const choice = (...values: string[]): LyraGenSchema => ({ type: 'string', enum: values });
export const array = (items: LyraGenSchema, maxItems: number): LyraGenSchema => ({ type: 'array', items, maxItems });
export const object = (properties: Readonly<Record<string, LyraGenSchema>>, required: readonly string[] = []): LyraGenSchema => ({ type: 'object', properties, required, additionalProperties: false });
export const scalar: LyraGenSchema = { anyOf: [string(), number, boolean, { type: 'null' }] };
export const size = choice('s', 'm', 'l');
export const variant = choice('neutral', 'brand', 'success', 'warning', 'danger');
export const appearance = choice('accent', 'filled', 'outlined', 'filled-outlined', 'plain');
export const frame = choice('card', 'plain');
export const named = { required: true, properties: ['label', 'accessibleLabel'] } as const;
export const documentation = (tag: string): string => `https://github.com/aceshooting/lyra-ui/blob/main/packages/lyra-ui/llms/components/${tag}.md`;
