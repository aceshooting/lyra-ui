/** @deprecated Import @aceshooting/lyra-ui/components/lr-stepper.js to register this component. */
export * from './stepper.class.js';
import { LyraStepper } from './stepper.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('stepper', LyraStepper);
