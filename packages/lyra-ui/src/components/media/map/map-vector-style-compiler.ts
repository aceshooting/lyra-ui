import { isPlainDataRecord } from '../../../internal/data-descriptors.js';
import type { LyraMapStyleValue } from './map-style-override-admission.js';
import { inspectVectorStyle, isVectorNumericExpression, vectorScalarKind, vectorStyleBounds,
  type CanonicalMapVectorStyle, type LyraMapVectorStyleExpression, type ResolvedMapVectorStyle } from './map-vector-style.js';

type Output = 'color' | 'icon' | readonly [number, number];

function finiteInput(value: readonly LyraMapStyleValue[]): LyraMapStyleValue {
  return ['case', ['all', ['>=', value, -Number.MAX_VALUE], ['<=', value, Number.MAX_VALUE]], value, value[2]!];
}
function compileInputs(value: LyraMapStyleValue): LyraMapStyleValue {
  if (Array.isArray(value) && value[0] === 'has' && (value[1] === '$id' || value[1] === '$type')) return ['has', ['literal', value[1]!]];
  if (Array.isArray(value) && (value[0] === 'literal' || value[0] === 'get' || value[0] === 'has')) return value;
  if (Array.isArray(value) && (value[0] === '==' || value[0] === '!=') && vectorScalarKind(value[1]) !== undefined && vectorScalarKind(value[1]) !== vectorScalarKind(value[2])) {
    // A static type mismatch is unequal without coercion; native comparisons require matching types.
    return [value[0], ['literal', true], false];
  }
  if (isVectorNumericExpression(value)) return finiteInput(value);
  // Native filters otherwise interpret scalar comparisons as deprecated property-name filters.
  if (Array.isArray(value) && ['==', '!=', '<', '<=', '>', '>='].includes(value[0] as string) && !Array.isArray(value[1])) {
    return [value[0]!, ['literal', value[1]!], value[2]!];
  }
  return Array.isArray(value) ? value.map(compileInputs) : value;
}
function compileOutput(value: LyraMapStyleValue, type: Output, color: (authored: string) => string): LyraMapStyleValue {
  if (!Array.isArray(value)) {
    if (type !== 'color') return value;
    const resolved = color(value as string);
    if (typeof resolved !== 'string' || !resolved.trim()) throw new Error('Invalid vector style');
    return resolved;
  }
  if (isVectorNumericExpression(value)) return ['min', (type as readonly number[])[1]!, ['max', (type as readonly number[])[0]!, finiteInput(value)]];
  const result = [...value]; const op = value[0];
  if (op === 'case') {
    for (let i = 1; i < value.length - 1; i += 2) { result[i] = compileInputs(value[i]!); result[i + 1] = compileOutput(value[i + 1]!, type, color); }
    result[result.length - 1] = compileOutput(value[value.length - 1]!, type, color);
  } else if (op === 'match') {
    // Native match tables cannot represent every finite number or inherited object key.
    // Preserve those authored labels through typed equality predicates instead.
    const labels = value.filter((_, index) => index >= 2 && index < value.length - 1 && index % 2 === 0).flat();
    if (labels.some(label => typeof label === 'number' ? !Number.isSafeInteger(label) : typeof label === 'string' && label in {})) {
      const lowered: LyraMapStyleValue[] = ['case'];
      for (let i = 2; i < value.length - 1; i += 2) {
        const label = value[i]!; const items = Array.isArray(label) ? label : [label];
        const tests: LyraMapStyleValue[] = items.map(item => ['==', value[1]!, item]);
        lowered.push(tests.length === 1 ? tests[0]! : ['any', ...tests], compileOutput(value[i + 1]!, type, color));
      }
      lowered.push(compileOutput(value[value.length - 1]!, type, color));
      return lowered;
    }
    for (let i = 3; i < value.length - 1; i += 2) result[i] = compileOutput(value[i]!, type, color);
    result[result.length - 1] = compileOutput(value[value.length - 1]!, type, color);
  } else {
    const inputIndex = op === 'step' ? 1 : 2;
    result[inputIndex] = compileInputs(value[inputIndex]!);
    if (op === 'step') result[2] = compileOutput(value[2]!, type, color);
    for (let i = 4; i < value.length; i += 2) result[i] = compileOutput(value[i]!, type, color);
  }
  return result;
}
function freeze(value: LyraMapStyleValue): LyraMapStyleValue {
  if (Array.isArray(value)) { for (const child of value) freeze(child); Object.freeze(value); }
  else if (isPlainDataRecord(value)) { for (const child of Object.values(value)) freeze(child as LyraMapStyleValue); Object.freeze(value); }
  return value;
}
/** The color callback must reject unresolved/invalid native colors by throwing. Generated caps
 * supplement, never replace, final aggregate overlay admission before any native mutation. */
export function resolveMapVectorStyle(style: CanonicalMapVectorStyle, color: (authored: string) => string): ResolvedMapVectorStyle {
  const compile = (properties: ResolvedMapVectorStyle['paint'] | ResolvedMapVectorStyle['layout']): Record<string, LyraMapStyleValue> => Object.fromEntries(Object.entries(properties).map(([key, value]) => {
    const type: Output | undefined = key.endsWith('color') ? 'color' : key === 'icon-image' ? 'icon' : vectorStyleBounds[key];
    return [key, type ? compileOutput(value, type, color) : value];
  }));
  const result = { paint: compile(style.paint), layout: compile(style.layout), ...(style.filter === undefined ? {} : { filter: compileInputs(style.filter) as LyraMapVectorStyleExpression }) };
  inspectVectorStyle(result, 65_536, 20, 8 * 1024 * 1024);
  return freeze(result) as unknown as ResolvedMapVectorStyle;
}
