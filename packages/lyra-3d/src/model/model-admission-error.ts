import type { ModelAdmissionFailure } from './types.js';

/** Stable reason codes are intended for localization by the owning component. */
export class ModelAdmissionError extends Error {
  readonly code: ModelAdmissionFailure;
  constructor(code: ModelAdmissionFailure) {
    super(`Model admission failed: ${code}`);
    this.name = 'ModelAdmissionError';
    this.code = code;
  }
}
