import { clickAndWait, extractLinks, getTitle, getUrl, open } from "./browser.ts";
import type { Driver } from "./types.ts";

export interface StepLog {
  step: number;
  title: string;
  url: string;
  choiceId: string;
  choiceText: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  note: string;
  escalated: boolean;
}

export interface RaceResult {
  driver: string;
  success: boolean;
  gaveUp: boolean;
  stuck: boolean;
  clicks: number;
  escalations: number;
  wallMs: number;
  decisionMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  finalTitle: string;
  finalUrl: string;
  log: StepLog[];
}

export interface RaceOptions {
  start: string;
  goal: string;
  goalTitle: string;
  goalUrlPart: string;
  maxSteps: number;
}

export async function race(driver: Driver, options: RaceOptions): Promise<RaceResult> {
  open(options.start);
  const startedAt = Date.now();
  const visited: string[] = [];
  const log: StepLog[] = [];
  let success = false;
  let gaveUp = false;
  let stuck = false;

  const reached = (): boolean =>
    getUrl().includes(options.goalUrlPart) || getTitle().startsWith(options.goalTitle);

  for (let step = 1; step <= options.maxSteps; step++) {
    if (reached()) {
      success = true;
      break;
    }
    const title = getTitle();
    const url = getUrl();
    visited.push(title.replace(/ - Wikipedia$/, ""));

    const links = extractLinks();
    if (links.length === 0) break;

    const decision = await driver.choose({
      goal: options.goal,
      pageTitle: title,
      visited: [...visited],
      links,
      step,
    });

    const chosen = links.find((link) => link.id === decision.id);
    log.push({
      step,
      title,
      url,
      choiceId: decision.id,
      choiceText: chosen?.text ?? "(no link)",
      latencyMs: decision.latencyMs,
      inputTokens: decision.inputTokens,
      outputTokens: decision.outputTokens,
      costUsd: decision.costUsd,
      note: decision.note ?? "",
      escalated: decision.escalated ?? false,
    });

    if (decision.stopped || !chosen) {
      gaveUp = true;
      break;
    }
    if (!clickAndWait(chosen, url)) {
      stuck = true;
      log[log.length - 1].note += " · click did not navigate";
      break;
    }
  }

  if (reached()) success = true;

  return {
    driver: driver.name,
    success,
    gaveUp,
    stuck,
    clicks: log.filter((entry) => entry.choiceId !== "none").length,
    escalations: log.filter((entry) => entry.escalated).length,
    wallMs: Date.now() - startedAt,
    decisionMs: log.reduce((total, entry) => total + entry.latencyMs, 0),
    inputTokens: log.reduce((total, entry) => total + entry.inputTokens, 0),
    outputTokens: log.reduce((total, entry) => total + entry.outputTokens, 0),
    costUsd: log.reduce((total, entry) => total + entry.costUsd, 0),
    finalTitle: getTitle(),
    finalUrl: getUrl(),
    log,
  };
}
