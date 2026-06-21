import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTools, getAllTools } from "./registry.js";
import { executeToolCall, parseEndpointParams } from "./gateway-core.js";
import { loadFirewallRules, checkFirewall } from "./firewall.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOOLS_DIR = join(__dirname, "..", "tools");

const toolCount = loadTools(TOOLS_DIR);
const ruleCount = loadFirewallRules();

const server = new Server(
  { name: "agentbridge", version: process.env.npm_package_version || "1.7.0" },
  { capabilities: { tools: {} } }
);

function buildInputSchema(endpoint: string, needsAuthPassthrough: boolean) {
  const paramNames = parseEndpointParams(endpoint);
  const properties: Record<string, unknown> = {};
  for (const name of paramNames) properties[name] = { type: "string", description: `Parameter: ${name}` };
  if (needsAuthPassthrough) properties["auth_value"] = { type: "string", description: "API key or token (passthrough mode)" };
  return { type: "object" as const, properties, required: paramNames };
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = getAllTools().filter(t => t.enabled);
  return {
    tools: tools.map(t => ({
      name: t.name,
      description: `[${t.category || "Tool"}] ${t.label}: ${t.description}`,
      inputSchema: buildInputSchema(t.endpoint, t.auth.source === "passthrough"),
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params ?? {};
  if (!name) {
    return { content: [{ type: "text", text: "Error: tool name required" }], isError: true };
  }

  // Security firewall check
  const params: Record<string, unknown> = {};
  let authValue: string | undefined;
  if (args && typeof args === "object") {
    for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
      if (key === "auth_value") authValue = value as string;
      else params[key] = value;
    }
  }

  const fwCheck = checkFirewall(name, params, JSON.stringify(params).length, "mcp-stdio");
  if (fwCheck.blocked) {
    return {
      content: [{ type: "text", text: `🚫 BLOCKED: ${fwCheck.message}\n\nRule: ${fwCheck.rule_id}` }],
      isError: true,
    };
  }

  const result = await executeToolCall({ toolName: name, params, authValue, callerIp: "mcp-stdio" });
  const responseText = result.success
    ? JSON.stringify(result.data, null, 2)
    : `${result.error}\n\nCall ID: ${result.call_id}\nLatency: ${result.latency_ms}ms`;

  return { content: [{ type: "text", text: responseText }], isError: !result.success };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`\n  AgentBridge MCP v1.7.0 — ${toolCount} tools, ${ruleCount} security rules`);
  console.error(`  Connected via stdio. Security firewall ACTIVE.\n`);
}

main().catch(err => { console.error("Fatal:", err); process.exit(1); });
