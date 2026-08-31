import { SafeError } from "./safety.js";
import type { DecisionRequestV1 } from "./contracts.js";
export type ModelReply = { text: string; metadata: { provider: string; model: string; returnedModel: string | null;
  temperature: number; maxOutputTokens: number; format: string; latencyMs: number; requestBytes: number;
  approximateTokens: number; decisionId: string; stepId: string; snapshotId: string } };
export interface LlmDecisionGateway { decide(request: DecisionRequestV1, repairCode: string | null, signal: AbortSignal): Promise<ModelReply> }

export class ProviderFailure extends SafeError {
  constructor(code: string, public metadata: ModelReply["metadata"]) { super(code); }
}
