import { jevDriver } from "./jev.ts";
import { openaiDriver } from "./openai.ts";
import { LUNA } from "./types.ts";
import type { Decision, DecisionInput, Driver } from "./types.ts";

export interface HybridOptions {
  /** escalate to the fallback when Jev's confidence is below this. */
  threshold?: number;
  /** the escalation model. Defaults to gpt-5.6-luna. */
  fallback?: Driver;
}

/**
 * Confidence-gated hybrid: Jev decides every step, and only when its
 * confidence is low does the same step escalate to a full LLM.
 *
 * The cost model is a normal TypeSafe pattern: cheap decisions almost always,
 * expensive intelligence only where the cheap model says it isn't sure.
 */
export function hybridDriver(options: HybridOptions = {}): Driver {
  const primary = jevDriver();
  const fallback = options.fallback ?? openaiDriver(LUNA);
  const threshold = options.threshold ?? 0.5;

  return {
    name: `hybrid(jev<${threshold}→${fallback.name})`,
    async choose(input: DecisionInput): Promise<Decision> {
      const first = await primary.choose(input);
      const confidence = first.confidence ?? 0;

      if (confidence >= threshold) {
        return { ...first, escalated: false };
      }

      const second = await fallback.choose(input);
      return {
        ...second,
        latencyMs: first.latencyMs + second.latencyMs,
        inputTokens: first.inputTokens + second.inputTokens,
        outputTokens: first.outputTokens + second.outputTokens,
        costUsd: first.costUsd + second.costUsd,
        confidence,
        escalated: true,
        note: `esc(conf ${confidence.toFixed(2)}) · ${second.note ?? ""}`,
      };
    },
  };
}
