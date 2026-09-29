import { LyraNativeTimeInput } from '@aceshooting/lyra-ui/components/forms/input/native-time-input.class.js';
import { LyraInput } from '@aceshooting/lyra-ui/components/forms/input/input.class.js';
import { LyraNumberInput } from '@aceshooting/lyra-ui/components/forms/input/number-input.class.js';

const time = new LyraNativeTimeInput();
time.withoutSpinButtons = true;
// @ts-expect-error retired time-only alias must not leak from a shared implementation base
time.noSpinButtons = true;
const input = new LyraInput(); input.noSpinButtons = true;
const number = new LyraNumberInput(); number.noSpinButtons = true;
