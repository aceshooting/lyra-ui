---
"@aceshooting/lyra-ui": minor
---

New `<lr-query-builder>` component: a composable structured-query builder for tabular/dashboard
data queries -- a flat list of field/operator/value condition rows combined with one AND/OR
combinator. Distinct from `<lr-graph-query-builder>`, which builds typed relationship/path
queries over a knowledge graph -- a genuinely different data model that never shares a file or a
value type with this one.

Fully controlled: a host supplies `fields` (available columns, each carrying a
`QueryBuilderFieldType` of `string` / `number` / `boolean` / `date` / `enum` that determines its
offered operators and value control) and a plain, serializable `value: { combinator, conditions }`
object, the same controlled-plain-object-`value` convention as `<lr-rubric-form>`. Each row
composes `<lr-select>` for the field and operator pickers and a value control chosen from the
selected field's type: `<lr-input type="text">`, `<lr-input type="number">`, `<lr-select>` with
True/False options, `<lr-date-input>`, or `<lr-select>`/a multi-select `<lr-combobox>` for `enum`
fields (`eq`/`neq` vs. `in`/`notIn`). A unary operator (`isEmpty`/`isNotEmpty`) renders no value
control. `<lr-icon-button icon="trash">` removes a row and `<lr-button>` appends one, both
surfaced through public `addCondition()`/`removeCondition(id)` methods and `lr-add-condition`/
`lr-remove-condition`/`lr-input` events -- the component never mutates `fields`/`value` in place
or touches storage/network itself.
