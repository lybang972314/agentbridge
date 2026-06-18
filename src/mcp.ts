// MCP Server Adapter — exposes the AgentBridge as a native MCP stdio server
// so Hermes, Codex, Claude Desktop, and other MCP clients can discover and use tools.
//
// Usage:  npx tsx src/mcp.ts
// Config: Add to ~/.codex/config.toml or claude_desktop_config.json

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTools, getAllTools } from "./registry.js";
import { executeToolCall, parseEndpointParams } from "./gateway-core.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = join(__dirname, "..", "tools");

// Load tool definitions from /tools/
const toolCount = loadTools(TOOLS_DIR);

const server = new Server(
  { name: "agentbridge", version: "0.2.0" },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Generate JSON Schema properties from a tool's endpoint params
function buildInputSchema(endpoint: string, needsAuthPassthrough: boolean) {
  const paramNames = parseEndpointParams(endpoint);
  const properties: Record<string, unknown> = {};

  for (const name of paramNames) {
    properties[name] = {
      type: "string",
      description: `Parameter: ${name}`,
    };
  }

  if (needsAuthPassthrough) {
    properties["auth_value"] = {
      type: "string",
      description: "API key or token for authentication (passthrough mode)",
    };
  }

  return {
    type: "object" as const,
    properties,
    required: paramNames,
  };
}

// tools/list — expose all enabled tools to the MCP client
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = getAllTools().filter((t) => t.enabled);
  return {
    tools: tools.map((t) => ({
      name: t.name,
      description: `[${t.category ?? "Tool"}] ${t.label}: ${t.description}`,
      inputSchema: buildInputSchema(
        t.endpoint,
        t.auth.source === "passthrough"
      ),
    })),
  };
});

// tools/call — execute a tool via the gateway core
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params ?? {};

  if (!name) {
    return {
      content: [{ type: "text" as const, text: "Error: tool name is required" }],
      isError: true,
    };
  }

  const params: Record<string, unknown> = {};
  const authValue: string | undefined = (args as any)?.auth_value;
  
  // Copy all args except auth_value into params
  if (args && typeof args === "object") {
    for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
      if (key !== "auth_value") {
        params[key] = value;
      }
    }
  }

  const result = await executeToolCall({
    toolName: name,
    params,
    authValue,
    callerIp: "mcp-stdio",
  });

  const responseText = result.success
    ? JSON.stringify(result.data, null, 2)
    : `${result.error}\n\nCall ID: ${result.call_id}\nLatency: ${result.latency_ms}ms`;

  return {
    content: [
      {
        type: "text" as const,
        text: responseText,
      },
    ],
    isError: !result.success,
  };
});

// Start the MCP server over stdio
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Log to stderr (stdio is for MCP protocol messages, stderr is for debugging)
  console.error(`\n  AgentBridge v0.2.0 — ${toolCount} tools loaded`);
  console.error(`  Connected via stdio. Waiting for MCP client requests...\n`);
}

main().catch((err) => {
  console.error("AgentBridge fatal error:", err);
  process.exit(1);
});
