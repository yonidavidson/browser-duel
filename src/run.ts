import { jevDriver } from "./jev.ts";
import { openaiDriver } from "./openai.ts";
import { race } from "./race.ts";
import type { RaceOptions, RaceResult } from "./race.ts";
import { LUNA, SOL } from "./types.ts";
import type { Driver } from "./types.ts";

interface Task extends RaceOptions {
  key: string;
  label: string;
}

const TASKS: Task[] = [
  {
    key: "easy",
    label: "easy — Coffee → Sanaa (the capital of Yemen)",
    start: "https://en.wikipedia.org/wiki/Coffee",
    goal: "Reach the Wikipedia article about Sanaa, the capital city of Yemen.",
    goalTitle: "Sanaa",
    goalUrlPart: "/wiki/Sanaa",
    maxSteps: 6,
  },
  {
    key: "hard",
    label: "hard — Coffee → Albert Einstein",
    start: "https://en.wikipedia.org/wiki/Coffee",
    goal:
      "Reach the Wikipedia article about Albert Einstein, the physicist who developed the theory of relativity.",
    goalTitle: "Albert Einstein",
    goalUrlPart: "/wiki/Albert_Einstein",
    maxSteps: 14,
  },
];

const args = process.argv.slice(2);
const driversArg = args.find((arg) => arg.startsWith("--drivers="))?.split("=")[1];
const tasksArg = args.find((arg) => arg.startsWith("--tasks="))?.split("=")[1];
const wantedDrivers = driversArg ? driversArg.split(",") : ["jev", "luna", "sol"];
const wantedTasks = tasksArg ? tasksArg.split(",") : ["easy", "hard"];

const driverFactories: Record<string, () => Driver> = {
  jev: jevDriver,
  luna: () => openaiDriver(LUNA),
  sol: () => openaiDriver(SOL),
};
const drivers = wantedDrivers
  .filter((key) => key in driverFactories)
  .map((key) => driverFactories[key]());

function summarize(result: RaceResult): string {
  const status = result.success
    ? "✅ reached"
    : result.gaveUp
      ? "🛑 gave up"
      : result.stuck
        ? "🔒 stuck"
        : "⏱ max steps";
  return (
    `| ${result.driver} | ${status} ` +
    `| ${result.clicks} | ${(result.wallMs / 1000).toFixed(1)} s | ${(result.decisionMs / 1000).toFixed(1)} s ` +
    `| ${result.inputTokens.toLocaleString("en-US")} / ${result.outputTokens.toLocaleString("en-US")} | $${result.costUsd.toFixed(6)} |`
  );
}

const combined: { task: Task; results: RaceResult[] }[] = [];

for (const task of TASKS.filter((candidate) => wantedTasks.includes(candidate.key))) {
  console.log(`\n## ${task.label}`);
  const results: RaceResult[] = [];
  for (const driver of drivers) {
    console.log(`\n=== ${task.key} · ${driver.name} ===`);
    try {
      const result = await race(driver, task);
      results.push(result);
      for (const entry of result.log) {
        console.log(
          `  ${String(entry.step).padStart(2)}. ${entry.title} → ${entry.choiceText} [${entry.choiceId}] ` +
            `(${entry.latencyMs.toFixed(0)} ms, ${entry.inputTokens} in / ${entry.outputTokens} out, $${entry.costUsd.toFixed(6)}) ${entry.note}`,
        );
      }
      console.log(
        `  ${result.success ? "🏁 reached" : result.gaveUp ? "🛑 gave up" : "⏱ out of steps"}: ` +
          `${result.clicks} clicks, ended on "${result.finalTitle}" (${(result.wallMs / 1000).toFixed(1)} s wall, ` +
          `${(result.decisionMs / 1000).toFixed(1)} s deciding, $${result.costUsd.toFixed(6)})`,
      );
    } catch (error) {
      console.log(`  failed: ${(error as Error).message}`);
    }
  }
  combined.push({ task, results });
}

console.log("\n## Results\n");
console.log("| task | driver | result | clicks | wall | deciding | tokens in/out | cost |");
console.log("| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |");
for (const { task, results } of combined) {
  for (const result of results) {
    console.log(`| ${task.key} ${summarize(result)}`);
  }
}
