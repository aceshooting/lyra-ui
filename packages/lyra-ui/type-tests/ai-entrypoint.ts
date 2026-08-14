import type { AgentRun, RetrievalQuery } from '../src/lyra.js';
import {
  AgUiStreamAdapter,
  adaptA2UiSurface,
  adaptAiSdkMessage,
  createAgentStreamState,
  reduceAgentStream,
  type GroundingAssessment,
} from '../src/ai/index.js';

const run: AgentRun = {
  id: 'run-1',
  status: { kind: 'done' },
  steps: [],
};
const query: RetrievalQuery = { text: 'search', mode: 'hybrid' };
const assessment: GroundingAssessment = {
  supportedClaims: 1,
  unsupportedClaims: 0,
  coverage: 1,
};

void run;
void query;
void assessment;
void AgUiStreamAdapter;
void adaptA2UiSurface;
void adaptAiSdkMessage;
void createAgentStreamState;
void reduceAgentStream;
