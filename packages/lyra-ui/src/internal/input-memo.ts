/**
 * Memoizes `compute` on its last argument tuple: a call whose arguments are all `Object.is` equal
 * to the previous call's (same count) returns the previous value without recomputing. One entry,
 * so a render getter fed the same inputs stays O(1) and returns a stable identity.
 */
export function createInputMemo<Args extends readonly unknown[], Value>(
  compute: (...args: Args) => Value
): (...args: Args) => Value {
  let last: { readonly args: Args; readonly value: Value } | undefined;
  return (...args: Args): Value => {
    if (last && last.args.length === args.length && last.args.every((arg, index) => Object.is(arg, args[index]))) {
      return last.value;
    }
    const value = compute(...args);
    last = { args, value };
    return value;
  };
}
