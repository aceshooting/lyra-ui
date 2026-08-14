/** A public Web Awesome-compatible validator result returned by form-control static validators. */
export interface LyraFormValidatorResult {
  isValid: boolean;
  message: string;
  invalidKeys: Exclude<keyof ValidityState, 'valid'>[];
}

/** Public validator shape exposed by mirrored form-control constructors. */
export interface LyraFormValidator<
  T extends { readonly validity: ValidityState; readonly validationMessage: string },
> {
  observedAttributes?: string[];
  checkValidity(element: T): LyraFormValidatorResult;
  message?: string | ((element: T) => string);
}

const VALIDITY_KEYS: Exclude<keyof ValidityState, 'valid'>[] = [
  'badInput',
  'customError',
  'patternMismatch',
  'rangeOverflow',
  'rangeUnderflow',
  'stepMismatch',
  'tooLong',
  'tooShort',
  'typeMismatch',
  'valueMissing',
];

/** Creates a fresh callable projection of a control's current intrinsic/custom validity. */
export function currentValidityValidator<
  T extends { readonly validity: ValidityState; readonly validationMessage: string },
>(...observedAttributes: string[]): LyraFormValidator<T> {
  return {
    observedAttributes,
    checkValidity(element: T): LyraFormValidatorResult {
      const invalidKeys = VALIDITY_KEYS.filter((key) => element.validity[key]);
      return {
        isValid: invalidKeys.length === 0,
        message: invalidKeys.length === 0 ? '' : element.validationMessage,
        invalidKeys,
      };
    },
  };
}
