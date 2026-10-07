/** @deprecated Import @aceshooting/lyra-ui/components/lr-agent-question.js to register this component. */
export * from './agent-question.class.js';
import { LyraAgentQuestion } from './agent-question.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../tool-param-form/tool-param-form.js';
defineElement('agent-question', LyraAgentQuestion);
