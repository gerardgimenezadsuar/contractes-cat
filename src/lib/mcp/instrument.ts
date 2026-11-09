import { headers } from "next/headers";
import { track } from "@vercel/analytics/server";
import type { McpServer } from "@modelcontextprotocol/server";

/** Coarse client label from the User-Agent (no IPs, no query text stored). */
function clientFamily(ua: string | null): string {
  const s = (ua ?? "").toLowerCase();
  if (s.includes("claude")) return "claude";
  if (s.includes("openai") || s.includes("chatgpt")) return "openai";
  if (s.includes("cursor")) return "cursor";
  if (s.includes("codex")) return "codex";
  if (s.includes("node") || s.includes("python") || s.includes("curl")) return "script";
  return s ? "other" : "unknown";
}

/**
 * Wraps registerTool so every tool call emits one structured log line
 * (Vercel runtime logs) and one Web Analytics custom event "mcp_tool_call"
 * (durable counts, queryable by tool/client/status). Only the tool name,
 * outcome, duration and client family are recorded, never arguments.
 */
export function withUsageTracking(register: (server: McpServer) => void) {
  return (server: McpServer) => {
    const original = server.registerTool.bind(server) as (...a: unknown[]) => unknown;
    (server as unknown as { registerTool: unknown }).registerTool = (
      name: string,
      config: unknown,
      cb: (...a: unknown[]) => Promise<{ isError?: boolean }>
    ) =>
      original(name, config, async (...args: unknown[]) => {
        const start = Date.now();
        let status = "ok";
        try {
          const res = await cb(...args);
          if (res?.isError) status = "not_found";
          return res;
        } catch (err) {
          status = "error";
          throw err;
        } finally {
          const ms = Date.now() - start;
          let client = "unknown";
          try {
            client = clientFamily((await headers()).get("user-agent"));
          } catch {}
          console.log(JSON.stringify({ evt: "mcp_tool_call", tool: name, status, ms, client }));
          try {
            await track("mcp_tool_call", { tool: name, status, client });
          } catch {}
        }
      });
    register(server);
  };
}
