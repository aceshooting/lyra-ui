export * from './rubric-form.class.js';
import { LyraRubricForm } from './rubric-form.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../layout/segmented/segmented.js';
import '../slider/slider.js';
import '../select/select.js';
import '../combobox/option.js';
import '../checkbox/checkbox.js';
import '../checkbox-group/checkbox-group.js';
import '../textarea/textarea.js';

defineElement('rubric-form', LyraRubricForm);
