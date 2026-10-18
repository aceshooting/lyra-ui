import type { RubricValue } from '../../forms/rubric-form/rubric-form.class.js';

/**
 * One model/prompt-version's output for a single evaluation example, plus whatever automated
 * `scores` it already carries and whatever `review` a human has entered for it so far. `scores`
 * and `review` are both keyed the same way as the `rubricKeys` passed to this component -- the
 * same `RubricValue` shape `<lr-rubric-form>` itself reads and writes -- so a `TableColumn`'s
 * `cell()` accessor and the rubric form's own `value` binding can both read a run's fields with
 * no conversion.
 */
export interface EvalRunResult {
  readonly id: string;
  readonly label: string;
  readonly model?: string;
  readonly promptVersion?: string;
  readonly output: string;
  readonly scores?: RubricValue;
  readonly review?: RubricValue;
}
