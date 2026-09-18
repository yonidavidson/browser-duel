import type { PageLink } from "./browser.ts";

export interface DecisionInput {
  goal: string;
  pageTitle: string;
  visited: string[];
  links: PageLink[];
  step: number;
}

export interface Decision {
  /** chosen link id, or "none" to stop */
  id: string;
  stopped: boolean;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  note?: string;
  /** the primary decider's confidence, when it reports one (Jev does) */
  confidence?: number;
  /** true when a fallback model had to decide this step */
  escalated?: boolean;
}

export interface Driver {
  name: string;
  choose(input: DecisionInput): Promise<Decision>;
}

export const JEV = "jev";
export const LUNA = "gpt-5.6-luna";
export const SOL = "gpt-5.6-sol";

/** Catalog prices in USD per 1M tokens (OpenCode model list / TypeSafe docs). */
export const PRICES: Record<string, { input: number; output: number }> = {
  jev: { input: 0.042, output: 0 },
  "gpt-5.6-luna": { input: 0.2, output: 1.2 },
  "gpt-5.6-sol": { input: 4, output: 20 },
};

export function cost(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICES[model] ?? { input: 0, output: 0 };
  return (inputTokens / 1e6) * price.input + (outputTokens / 1e6) * price.output;
}
