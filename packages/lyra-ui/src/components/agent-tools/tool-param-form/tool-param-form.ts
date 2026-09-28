/** @deprecated Import @aceshooting/lyra-ui/components/lr-tool-param-form.js to register this component. */
export * from './tool-param-form.class.js';
import { LyraToolParamForm } from './tool-param-form.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../forms/select/select.js';
import '../../forms/input/number-input.js';
defineElement('tool-param-form', LyraToolParamForm);
