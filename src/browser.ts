import { execFileSync } from "node:child_process";

/**
 * Thin wrapper over the agent-browser CLI (Chrome via CDP).
 * Both racers share this browser and this exact link extraction.
 */

const SESSION = process.env.AGENT_BROWSER_SESSION ?? "browser-duel";
const MAX_LINKS = 60;

function ab(args: string[]): string {
  return execFileSync("agent-browser", args, {
    encoding: "utf8",
    env: { ...process.env, AGENT_BROWSER_SESSION: SESSION },
    maxBuffer: 64 * 1024 * 1024,
  });
}

export interface PageLink {
  id: string;
  text: string;
  href: string;
}

export function open(url: string): void {
  ab(["open", url]);
  waitUntilReady();
}

function waitUntilReady(timeoutMs = 12_000): void {
  try {
    ab(["wait", "--load", "networkidle"]);
  } catch {
    // wait flag unsupported; fall through to polling
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const state = ab(["eval", "document.readyState"]);
      const content = ab(["eval", "document.querySelector('#mw-content-text') ? 'yes' : 'no'"]);
      if (state.includes("complete") && content.includes("yes")) return;
    } catch {
      // still navigating
    }
    try {
      ab(["wait", "300"]);
    } catch {
      // ignore
    }
  }
}

export function close(): void {
  try {
    ab(["close"]);
  } catch {
    // already closed
  }
}

export function getUrl(): string {
  const output = ab(["get", "url"]).trim().split("\n");
  return output[output.length - 1]?.trim() ?? "";
}

export function getTitle(): string {
  const output = ab(["get", "title"]).trim().split("\n");
  return output[output.length - 1]?.trim() ?? "";
}

const EXTRACT_SCRIPT = `(() => {
  const scope = document.querySelector("#mw-content-text") || document.body;
  const namespace = /\\/wiki\\/(File|Category|Help|Special|Talk|Template|Portal|Wikipedia|Draft|Module):/i;
  const citation = /^([A-Z][a-z]+( [A-Z][a-z]+)? \\d{4}|ISBN|doi|Archived|Retrieved|Jump (up|to)|\\[\\d+\\])/;
  const seen = new Set();
  const links = [];
  for (const anchor of scope.querySelectorAll('a[href*="/wiki/"]')) {
    const href = anchor.getAttribute("href") || "";
    const text = (anchor.innerText || anchor.textContent || "").replace(/\\s+/g, " ").trim();
    if (text.length < 2 || text.length > 60) continue;
    if (namespace.test(href) || citation.test(text)) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    links.push({ id: "L" + (links.length + 1), text, href });
    if (links.length >= ${MAX_LINKS}) break;
  }
  return links;
})()`;

export function extractLinks(): PageLink[] {
  const output = ab(["eval", EXTRACT_SCRIPT]);
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  return JSON.parse(output.slice(start, end + 1)) as PageLink[];
}

/**
 * Click the chosen link (programmatic click on the visible anchor — the CLI's
 * coordinate click silently misses some Wikipedia links) and wait for navigation.
 * Returns false when the page did not move.
 */
export function clickAndWait(link: PageLink, previousUrl: string, timeoutMs = 8000): boolean {
  const selector = `a[href=${JSON.stringify(link.href)}]`;
  const script = `(() => {
    const anchors = [...document.querySelectorAll(${JSON.stringify(selector)})].filter((a) => a.offsetParent !== null);
    const target = anchors[0];
    if (!target) return "missing";
    target.scrollIntoView({ block: "center" });
    target.click();
    return "clicked";
  })()`;
  try {
    ab(["eval", script]);
  } catch {
    return false;
  }
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      ab(["wait", "300"]);
      const url = getUrl();
      if (url && url !== previousUrl && !url.startsWith(`${previousUrl}#`)) {
        waitUntilReady();
        return true;
      }
    } catch {
      // keep waiting
    }
  }
  waitUntilReady();
  return getUrl() !== previousUrl;
}
