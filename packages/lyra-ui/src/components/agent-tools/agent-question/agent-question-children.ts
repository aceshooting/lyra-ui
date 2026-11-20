/** Registration imports a question loads the first time its parameter form renders undefined. */
export const AGENT_QUESTION_CHILDREN: Record<string, () => Promise<unknown>> = {
  'tool-param-form': () => import('../../lr-tool-param-form.js'),
};
