import { defineElement } from '@aceshooting/lyra-ui/utilities/prefix.js';
import { LyraGenDevtoolsElement } from './devtools.class.js';

defineElement('gen-devtools', LyraGenDevtoolsElement);
export { LyraGenDevtoolsElement, LYRA_GEN_INSPECTED_ATTRIBUTE } from './devtools.class.js';
export type { LyraGenDevtoolsTab } from './devtools.class.js';
export { LYRA_GEN_DEVTOOLS_STRINGS } from './devtools-strings.js';
export type { LyraGenDevtoolsStringKey } from './devtools-strings.js';
