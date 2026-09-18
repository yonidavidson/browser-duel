import { cost } from "./types.ts";
import type { Decision, DecisionInput, Driver } from "./types.ts";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const MODEL = "jev-latest";

/** The TypeSafe driver: one Choice per step, over the exact same links. */
export function jevDriver(): Driver {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error("TYPESAFE_API_KEY is not set");

  return {
    name: "jev",
    async choose(input: DecisionInput): Promise<Decision> {
      const criteria: Record<string, string> = {};
      for (const link of input.links) criteria[link.id] = link.text;
      criteria.none = "the current page is already the goal page";

      const body = {
        model: MODEL,
        state: {
          goal: input.goal,
          current_page: { title: input.pageTitle },
          already_visited: input.visited,
          links: input.links.map((link) => ({ id: link.id, text: link.text })),
        },
        questions: {
          goal_reached: {
            type: "noul",
            instructions: "Does the current page already satisfy the goal?",
          },
          next_link: {
            type: "choice",
            instructions: {
              question: "Which link should be clicked next to move toward the goal?",
              goal: input.goal,
              focus:
                "Judge the link text by meaning. Prefer a link clearly related to the goal, or one that widens the topic in a useful direction (science, history, technology, people). Avoid meta pages such as disambiguations, dictionaries (Wiktionary), and Wikipedia namespace pages unless nothing else is useful. Always choose a link unless the current page already is the goal page.",
            },
            criteria,
          },
        },
      };

      const started = performance.now();
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`typesafe ${response.status}: ${(await response.text()).slice(0, 200)}`);
      }
      const data = (await response.json()) as {
        answers: Record<
          string,
          { choice: string; probabilities: Record<string, number>; confidence?: number; noul?: number }
        >;
        usage?: { input_tokens: number; output_tokens: number };
      };
      const latencyMs = performance.now() - started;
      const answer = data.answers.next_link;
      const inputTokens = data.usage?.input_tokens ?? 0;
      const outputTokens = data.usage?.output_tokens ?? 0;
      const id = answer.choice;
      const confidence = answer.confidence ?? answer.probabilities[id] ?? 0;
      return {
        id,
        stopped: id === "none",
        latencyMs,
        inputTokens,
        outputTokens,
        costUsd: cost("jev", inputTokens, outputTokens),
        confidence,
        note: `p=${(answer.probabilities[id] ?? 0).toFixed(2)} conf=${confidence.toFixed(2)} reached=${(data.answers.goal_reached?.noul ?? 0).toFixed(2)}`,
      };
    },
  };
}
