import { createMcpHandler } from "mcp-handler";
import { withUsageTracking } from "@/lib/mcp/instrument";
import { MCP_INSTRUCTIONS, registerContractesTools } from "@/lib/mcp/server";

// Remote MCP endpoint: https://www.contractes.cat/api/mcp (Streamable HTTP,
// stateless, no auth: the data is public). Under /api so the firewall's
// AI-agent bypass and geo/ASN exemptions already apply.
const handler = createMcpHandler(withUsageTracking(registerContractesTools), {
  serverInfo: { name: "contractes-cat", version: "1.0.0" },
  instructions: MCP_INSTRUCTIONS,
});

export const maxDuration = 60;

export { handler as GET, handler as POST, handler as DELETE };
