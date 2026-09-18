import { cost } from "./types.ts";
import type { Decision, DecisionInput, Driver } from "./types.ts";

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

/** The model driver: the same link list in a prompt, answer must be one id or NONE. */
export function openaiDriver(model: string): Driver {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  return {
    name: model,
    async choose(input: DecisionInput): Promise<Decision> {
      const linkLines = input.links.map((link) => `${link.id} = ${link.text}`).join("\n");
      const prompt = [
        `Goal: ${input.goal}`,
        `Current page: ${input.pageTitle}`,
        input.visited.length > 0 ? `Already visited: ${input.visited.join(" -> ")}` : "",
        "Links available on this page:",
        linkLines,
        "",
        'Reply with exactly one link id (for example "L17") to click next. Reply NONE only if the current page already IS the goal page.',
      ]
        .filter(Boolean)
        .join("\n");

      const started = performance.now();
      let response: Response | undefined;
      let lastError = "";
      for (let attempt = 0; attempt < 3; attempt++) {
        response = await fetch(ENDPOINT, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: "system",
                content:
                  "You navigate a web browser by choosing links. Answer with only the link id, or NONE if the current page already IS the goal page.",
              },
              { role: "user", content: prompt },
            ],
            max_completion_tokens: 1200,
          }),
        });
        if (response.ok) break;
        lastError = `openai ${response.status}: ${(await response.text()).slice(0, 200)}`;
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      }
      if (!response || !response.ok) throw new Error(lastError || "openai request failed");
      const data = (await response.json()) as {
        choices?: { message?: { content?: string | null } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const latencyMs = performance.now() - started;
      const inputTokens = data.usage?.prompt_tokens ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;

      const content = data.choices?.[0]?.message?.content ?? "";
      let id = "none";
      const match = content.match(/L\d+/i) ?? content.match(/NONE/i);
      if (match) id = match[0].toUpperCase() === "NONE" ? "none" : match[0].toUpperCase();
      const stopped = id === "none";

      return {
        id,
        stopped,
        latencyMs,
        inputTokens,
        outputTokens,
        costUsd: cost(model, inputTokens, outputTokens),
        note: content.trim().slice(0, 40),
      };
    },
  };
}
