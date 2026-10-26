import { snapshotJson, validateSchema } from './schema.js';
import type { JsonValue, LyraGenLimits, LyraGenResult, LyraGenSchema } from './types.js';

export interface LyraGenFunction {
  readonly arguments: LyraGenSchema;
  readonly result: LyraGenSchema;
  /** Trusted synchronous host implementation. It must be pure and terminate promptly. */
  readonly run: (argumentsValue: JsonValue, locale: string) => JsonValue;
}
export interface LyraGenFunctionCall { readonly name: string; readonly arguments: JsonValue; readonly locale: string }
const failed = (code: string, message: string): LyraGenResult<JsonValue> => ({ ok: false, diagnostics: [{ code, path: '', message, severity: 'error' }] });

/** A capability registry, not an expression evaluator or sandbox for untrusted callbacks. */
export class LyraGenFunctionRegistry {
  readonly #functions: ReadonlyMap<string, LyraGenFunction>;
  constructor(functions: ReadonlyMap<string, LyraGenFunction>) {
    if (functions.size > 128 || [...functions.keys()].some(name => !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u.test(name))) throw new TypeError('Invalid function registry.');
    this.#functions = new Map([...functions].map(([name, definition]) => [name, Object.freeze({ ...definition })]));
  }
  call(input: LyraGenFunctionCall, limits?: Partial<LyraGenLimits>): LyraGenResult<JsonValue> {
    const snapshot = snapshotJson(input, limits);
    if (!snapshot.ok) return snapshot;
    const call = snapshot.value as unknown as LyraGenFunctionCall;
    if (!call || typeof call !== 'object' || Array.isArray(call) || Object.keys(call).some(key => !['name', 'arguments', 'locale'].includes(key)) || typeof call.name !== 'string') return failed('function.call', 'Invalid function call.');
    const definition = this.#functions.get(call.name);
    if (!definition) return failed('function.unknown', 'Function is not registered.');
    if (typeof call.locale !== 'string' || call.locale.length > 128 || !call.locale.length) return failed('function.locale', 'A bounded explicit locale is required.');
    let locale: string;
    try { locale = Intl.getCanonicalLocales(call.locale)[0]!; } catch { return failed('function.locale', 'Invalid locale.'); }
    const argumentsValue = validateSchema(call.arguments, definition.arguments, limits);
    if (!argumentsValue.ok) return argumentsValue;
    try { return validateSchema(definition.run(argumentsValue.value, locale), definition.result, limits); }
    catch { return failed('function.failure', 'The registered function failed.'); }
  }
}

const numericArray: LyraGenSchema = { type: 'array', items: { type: 'number' }, maxItems: 2000 };
const numberArgument: LyraGenSchema = { type: 'number' };
/** Built-ins have finite input/output limits and never evaluate generated expressions. */
export function createDefaultFunctions(): LyraGenFunctionRegistry {
  return new LyraGenFunctionRegistry(new Map<string, LyraGenFunction>([
    ['formatNumber', { arguments: numberArgument, result: { type: 'string', maxLength: 512 }, run: (value, locale) => new Intl.NumberFormat(locale).format(value as number) }],
    ['pluralCategory', { arguments: numberArgument, result: { type: 'string', enum: ['zero', 'one', 'two', 'few', 'many', 'other'] }, run: (value, locale) => new Intl.PluralRules(locale).select(value as number) }],
    ['sum', { arguments: numericArray, result: numberArgument, run: value => (value as readonly number[]).reduce((sum, next) => sum + next, 0) }],
    ['count', { arguments: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }, { type: 'null' }] }, maxItems: 2000 }, result: { type: 'integer', minimum: 0 }, run: value => (value as readonly JsonValue[]).length }]
  ]));
}
