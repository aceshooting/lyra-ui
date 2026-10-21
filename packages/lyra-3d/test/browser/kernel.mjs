/** Counts to `input.steps`, emitting the running count as a fresh Float32Array on every step. */
export function countingKernel(input) {
  let count = 0;
  let limit = input.steps;
  return {
    step() {
      count += 1;
      const busyUntil = performance.now() + (input.stepMs ?? 0);
      while (performance.now() < busyUntil);
      return { done: count >= limit, output: new Float32Array([count, limit]) };
    },
    update(next) {
      limit = next.steps;
    },
  };
}
