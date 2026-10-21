const escapes = {
  '<': '\\u003c',
  '>': '\\u003e',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029'
};

// JSON quoting handles strings and controls; these escapes also keep generated code safe in script text.
export function serializeJavaScript(value) {
  const json = JSON.stringify(value);
  if (json === undefined) throw new TypeError('Expected a JSON-serializable value for generated code.');
  return json.replace(/[<>\u2028\u2029]/g, character => escapes[character]);
}
