export * from './utility/number-ticker/number-ticker.class.js';
import { LyraNumberTicker } from './utility/number-ticker/number-ticker.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('number-ticker', LyraNumberTicker);
